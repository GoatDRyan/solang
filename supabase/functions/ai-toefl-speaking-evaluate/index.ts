import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AUDIO_MODEL = 'gemini-2.5-flash-lite';
const AUDIO_BUCKET = 'exam-audio';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

type ErrorPatternInput = {
  pattern: string;
  explanation?: string | null;
  example_wrong?: string | null;
  example_correct?: string | null;
  severity?: 'low' | 'medium' | 'high';
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  return null;
}

function isRetryableGeminiError(error: unknown) {
  const status = getErrorStatus(error);

  if (status && RETRYABLE_STATUSES.has(status)) {
    return true;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();

  return (
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('temporarily')
  );
}

async function runWithRetry<T>(
  operation: () => Promise<T>,
  options: {
    label: string;
    maxAttempts?: number;
    baseDelayMs?: number;
  }
) {
  const maxAttempts = options.maxAttempts || 4;
  const baseDelayMs = options.baseDelayMs || 1500;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const retryable = isRetryableGeminiError(error);

      console.error(
        `${options.label} failed on attempt ${attempt}/${maxAttempts}:`,
        error
      );

      if (!retryable || attempt === maxAttempts) {
        break;
      }

      const waitMs = baseDelayMs * attempt + Math.floor(Math.random() * 750);
      await delay(waitMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${options.label} failed after retries.`);
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(cleaned);
  }
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(max, Math.max(min, number));
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function normalizeSeverity(value: unknown): 'low' | 'medium' | 'high' {
  const raw = String(value || '').toLowerCase();

  if (raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

function normalizePatternKey(pattern: string) {
  return pattern
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣а-яёáéíóúñü\s-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function scoreToLevel(score30: number) {
  if (score30 >= 26) return 'Advanced';
  if (score30 >= 18) return 'High-Intermediate';
  if (score30 >= 10) return 'Low-Intermediate';
  return 'Below Low-Intermediate';
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildTaskEvaluationPrompt(task: any) {
  return `
Evaluate this TOEFL iBT Speaking response from the uploaded audio.

Important:
- The response is audio. Analyze pronunciation, fluency, rhythm, clarity, grammar, vocabulary, organization, and content.
- This is practice scoring, not an official ETS score.
- Be strict but useful.
- Do not invent content that is not in the audio.
- If the audio is empty, too short, or unintelligible, score accordingly.
- Return JSON only.

Speaking task:
${JSON.stringify(
  {
    taskNumber: task.taskNumber,
    taskType: task.taskType,
    title: task.title,
    prompt: task.prompt,
    readingText: task.readingText,
    listeningTranscript: task.listeningTranscript,
    question: task.question,
    expectedResponseTimeSec: task.responseTimeSec,
  },
  null,
  2
)}

Required JSON shape:
{
  "score4": 0,
  "delivery": 0,
  "languageUse": 0,
  "topicDevelopment": 0,
  "pronunciation": 0,
  "fluency": 0,
  "transcript": "string",
  "feedback": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "improvedAnswerOutline": "string",
  "errorPatterns": [
    {
      "pattern": "string",
      "explanation": "string",
      "example_wrong": "string",
      "example_correct": "string",
      "severity": "medium"
    }
  ]
}
`;
}

async function evaluateTaskAudio({
  ai,
  task,
  audioBytes,
  mimeType,
}: {
  ai: GoogleGenAI;
  task: any;
  audioBytes: Uint8Array;
  mimeType: string;
}) {
  const audioBase64 = uint8ArrayToBase64(audioBytes);

  const response = await runWithRetry(
    () =>
      ai.models.generateContent({
        model: AUDIO_MODEL,
        contents: [
          {
            parts: [
              {
                text: buildTaskEvaluationPrompt(task),
              },
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are a strict TOEFL iBT Speaking evaluator and pronunciation coach. Return valid JSON only.',
          responseMimeType: 'application/json',
        },
      }),
    {
      label: `Gemini audio evaluation for ${task.id}`,
      maxAttempts: 4,
      baseDelayMs: 1800,
    }
  );

  const rawText = response.text?.trim() || '{}';
  const parsed = safeParseJson(rawText);

  const errorPatterns = Array.isArray(parsed?.errorPatterns)
    ? parsed.errorPatterns
        .filter((item: ErrorPatternInput) => item?.pattern)
        .slice(0, 4)
        .map((item: ErrorPatternInput) => ({
          pattern: String(item.pattern).trim(),
          explanation: item.explanation ? String(item.explanation).trim() : null,
          example_wrong: item.example_wrong ? String(item.example_wrong).trim() : null,
          example_correct: item.example_correct
            ? String(item.example_correct).trim()
            : null,
          severity: normalizeSeverity(item.severity),
        }))
    : [];

  return {
    taskId: task.id,
    taskNumber: task.taskNumber,
    taskType: task.taskType,
    title: task.title,
    score4: roundToHalf(clampNumber(parsed?.score4, 0, 4)),
    delivery: clampNumber(parsed?.delivery, 0, 4),
    languageUse: clampNumber(parsed?.languageUse, 0, 4),
    topicDevelopment: clampNumber(parsed?.topicDevelopment, 0, 4),
    pronunciation: clampNumber(parsed?.pronunciation, 0, 4),
    fluency: clampNumber(parsed?.fluency, 0, 4),
    transcript: String(parsed?.transcript || '').trim(),
    feedback: String(parsed?.feedback || '').trim(),
    strengths: Array.isArray(parsed?.strengths)
      ? parsed.strengths
          .map((item: unknown) => String(item || '').trim())
          .filter(Boolean)
      : [],
    weaknesses: Array.isArray(parsed?.weaknesses)
      ? parsed.weaknesses
          .map((item: unknown) => String(item || '').trim())
          .filter(Boolean)
      : [],
    improvedAnswerOutline: String(parsed?.improvedAnswerOutline || '').trim(),
    errorPatterns,
  };
}

async function saveErrorPatterns({
  supabaseAdmin,
  userId,
  taskResults,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  taskResults: any[];
}) {
  const patterns = taskResults.flatMap((result) => {
    const aiPatterns = Array.isArray(result.errorPatterns)
      ? result.errorPatterns
      : [];

    const deliveryPattern =
      result.delivery < 2.5
        ? [
            {
              pattern: 'TOEFL Speaking weakness: Delivery and clarity',
              explanation:
                'Your spoken response showed issues with delivery, clarity, rhythm, or pacing.',
              example_wrong: null,
              example_correct: null,
              severity: result.delivery < 2 ? 'high' : 'medium',
            },
          ]
        : [];

    const pronunciationPattern =
      result.pronunciation < 2.5
        ? [
            {
              pattern: 'TOEFL Speaking weakness: Pronunciation control',
              explanation:
                'Your spoken response showed pronunciation issues that may reduce clarity.',
              example_wrong: null,
              example_correct: null,
              severity: result.pronunciation < 2 ? 'high' : 'medium',
            },
          ]
        : [];

    const fluencyPattern =
      result.fluency < 2.5
        ? [
            {
              pattern: 'TOEFL Speaking weakness: Fluency and pacing',
              explanation:
                'Your spoken response needs smoother rhythm, fewer hesitations, or better pacing.',
              example_wrong: null,
              example_correct: null,
              severity: result.fluency < 2 ? 'high' : 'medium',
            },
          ]
        : [];

    const developmentPattern =
      result.topicDevelopment < 2.5
        ? [
            {
              pattern: 'TOEFL Speaking weakness: Topic development',
              explanation:
                'Your spoken response needs clearer structure, fuller support, or better connection to the prompt.',
              example_wrong: null,
              example_correct: null,
              severity: result.topicDevelopment < 2 ? 'high' : 'medium',
            },
          ]
        : [];

    return [
      ...aiPatterns,
      ...deliveryPattern,
      ...pronunciationPattern,
      ...fluencyPattern,
      ...developmentPattern,
    ];
  });

  for (const pattern of patterns) {
    const patternKey = normalizePatternKey(pattern.pattern);

    if (!patternKey) continue;

    const { data: existing } = await supabaseAdmin
      .from('error_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('language_code', 'english')
      .eq('pattern_key', patternKey)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('error_patterns')
        .update({
          frequency: Number(existing.frequency || 1) + 1,
          severity: normalizeSeverity(pattern.severity || existing.severity),
          explanation: pattern.explanation || existing.explanation,
          example_wrong: pattern.example_wrong || existing.example_wrong,
          example_correct: pattern.example_correct || existing.example_correct,
          source: 'official_exam',
          last_seen_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            exam_key: 'toefl_ibt',
            section_key: 'speaking',
            exam_impact: true,
          },
        })
        .eq('id', existing.id)
        .eq('user_id', userId);
    } else {
      await supabaseAdmin.from('error_patterns').insert({
        user_id: userId,
        language_code: 'english',
        pattern_key: patternKey,
        pattern: pattern.pattern,
        explanation: pattern.explanation || null,
        example_wrong: pattern.example_wrong || null,
        example_correct: pattern.example_correct || null,
        severity: normalizeSeverity(pattern.severity),
        frequency: 1,
        source: 'official_exam',
        last_seen_at: new Date().toISOString(),
        metadata: {
          exam_key: 'toefl_ibt',
          section_key: 'speaking',
          exam_impact: true,
        },
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    if (!geminiApiKey) {
      throw new Error('Missing GEMINI_API_KEY secret.');
    }

    const authorization = req.headers.get('Authorization') || '';

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const sectionId = String(body.sectionId || '').trim();

    if (!sectionId) {
      return new Response(JSON.stringify({ error: 'sectionId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .select('*')
      .eq('id', sectionId)
      .eq('user_id', user.id)
      .eq('exam_key', 'toefl_ibt')
      .eq('section_key', 'speaking')
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'TOEFL Speaking section not found.');
    }

    if (section.status === 'completed') {
      return new Response(
        JSON.stringify({
          result: section.result || section.metadata?.result || null,
          section,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tasks = Array.isArray(section.content?.content?.tasks)
      ? section.content.content.tasks
      : [];

    if (tasks.length !== 4) {
      throw new Error('TOEFL Speaking section must contain 4 tasks.');
    }

    const missingAudioTasks = tasks.filter(
      (task: any) => !task.responseAudioPath || !task.responseMimeType
    );

    if (missingAudioTasks.length > 0) {
      throw new Error(
        `Missing audio response for: ${missingAudioTasks
          .map((task: any) => task.title || task.id)
          .join(', ')}.`
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const taskResults = [];

    for (const task of tasks) {
      const { data: audioBlob, error: downloadError } = await supabaseAdmin.storage
        .from(AUDIO_BUCKET)
        .download(task.responseAudioPath);

      if (downloadError || !audioBlob) {
        throw new Error(
          downloadError?.message || `Failed to download audio for ${task.id}.`
        );
      }

      const audioBuffer = await audioBlob.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);

      const taskResult = await evaluateTaskAudio({
        ai,
        task,
        audioBytes,
        mimeType: task.responseMimeType || 'audio/webm',
      });

      taskResults.push(taskResult);

      await delay(600);
    }

    const averageScore4 =
      taskResults.reduce((total, item) => total + Number(item.score4 || 0), 0) /
      taskResults.length;

    const score4 = roundToHalf(averageScore4);
    const scaledScore = Math.round((score4 / 4) * 30);
    const completedAt = new Date().toISOString();

    const result = {
      section: 'speaking',
      responseMode: 'audio_recording',
      score4,
      scaledScore,
      level: scoreToLevel(scaledScore),
      taskResults,
      completedAt,
    };

    const { data: updatedSection, error: updateSectionError } =
      await supabaseAdmin
        .from('exam_attempt_sections')
        .update({
          status: 'completed',
          completed_at: completedAt,
          score: scaledScore,
          result,
          metadata: {
            ...(section.metadata || {}),
            result,
            score4,
            scaled_score_30: scaledScore,
          },
        })
        .eq('id', section.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

    if (updateSectionError) {
      throw new Error(
        updateSectionError.message || 'Failed to save TOEFL Speaking result.'
      );
    }

    const { error: updateAttemptError } = await supabaseAdmin
      .from('exam_attempts')
      .update({
        status: 'completed',
        completed_at: completedAt,
        total_score: scaledScore,
        result,
        metadata: {
          ...(section.metadata || {}),
          completed_section: 'speaking',
          score4,
          scaled_score_30: scaledScore,
          result,
        },
      })
      .eq('id', section.attempt_id)
      .eq('user_id', user.id);

    if (updateAttemptError) {
      throw new Error(updateAttemptError.message || 'Failed to update TOEFL attempt.');
    }

    await saveErrorPatterns({
      supabaseAdmin,
      userId: user.id,
      taskResults,
    });

    await supabaseAdmin.from('study_sessions').insert({
      user_id: user.id,
      language_code: 'english',
      title: 'TOEFL iBT Speaking Practice',
      session_type: 'speaking',
      duration_minutes: 16,
      notes: `TOEFL Speaking estimated score: ${scaledScore}/30. Average task score: ${score4}/4.`,
      started_at: completedAt,
    });

    return new Response(JSON.stringify({ result, section: updatedSection }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Speaking evaluation error:', error);

    const status = getErrorStatus(error);

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown TOEFL Speaking evaluation error.';

    const isGeminiCapacityError =
      status === 503 ||
      message.toLowerCase().includes('high demand') ||
      message.toLowerCase().includes('unavailable');

    return new Response(
      JSON.stringify({
        error: isGeminiCapacityError
          ? 'Gemini is temporarily overloaded while evaluating your speaking audio. Your recordings are saved. Please try submitting again in a few minutes.'
          : message,
      }),
      {
        status: isGeminiCapacityError ? 503 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});