import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TEXT_MODEL = 'gemini-2.5-flash-lite';

type ErrorPatternInput = {
  pattern: string;
  explanation?: string | null;
  example_wrong?: string | null;
  example_correct?: string | null;
  severity?: 'low' | 'medium' | 'high';
};

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

function normalizeAnswerText(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(' ');
  }

  return String(value || '').trim();
}

function normalizeForComparison(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ');
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(max, Math.max(min, number));
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function scoreToLevel(score6: number) {
  if (score6 >= 5.5) return 'Advanced / C2 range';
  if (score6 >= 5) return 'Advanced / C1 range';
  if (score6 >= 4) return 'High-Intermediate / B2 range';
  if (score6 >= 3) return 'Low-Intermediate / B1 range';
  if (score6 >= 2) return 'Basic / A2 range';
  return 'Below Basic / A1 range';
}

function normalizePatternKey(pattern: string) {
  return pattern
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣а-яёáéíóúñü\s-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function normalizeSeverity(value: unknown): 'low' | 'medium' | 'high' {
  const raw = String(value || '').toLowerCase();

  if (raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

function getBuildSentenceResults(task: any, answers: Record<string, unknown>) {
  const items = Array.isArray(task?.content?.buildSentenceItems)
    ? task.content.buildSentenceItems
    : [];

  const details = items.map((item: any) => {
    const selectedAnswer = normalizeAnswerText(answers[item.id]);
    const correctAnswer = String(item.answer || '').trim();

    const isCorrect =
      normalizeForComparison(selectedAnswer) === normalizeForComparison(correctAnswer);

    return {
      id: item.id,
      skill: item.skill || 'sentence_structure',
      selectedAnswer,
      correctAnswer,
      isCorrect,
      explanation: item.explanation || '',
    };
  });

  const correctCount = details.filter((item: any) => item.isCorrect).length;

  return {
    correctCount,
    total: details.length,
    score6: details.length > 0 ? (correctCount / details.length) * 6 : 0,
    details,
  };
}

function buildEvaluationPrompt({
  task,
  answers,
  sentenceResults,
}: {
  task: any;
  answers: Record<string, unknown>;
  sentenceResults: any;
}) {
  const emailTask = task?.content?.emailTask || {};
  const discussionTask = task?.content?.academicDiscussionTask || {};

  const emailAnswer = normalizeAnswerText(answers[emailTask.id || 'write_email']);
  const discussionAnswer = normalizeAnswerText(
    answers[discussionTask.id || 'academic_discussion']
  );

  return `
Evaluate this TOEFL iBT Writing practice section.

Important:
- This is an estimated practice evaluation, not an official ETS score.
- Use TOEFL-like academic writing criteria.
- Be strict but pedagogical.
- Focus on clarity, organization, development, grammar, vocabulary, and task fulfillment.
- Extract recurring language-learning error patterns for Error DNA.

Build a Sentence result:
${JSON.stringify(sentenceResults, null, 2)}

Email task:
${JSON.stringify(emailTask, null, 2)}

Learner email response:
${emailAnswer || '[NO RESPONSE]'}

Academic Discussion task:
${JSON.stringify(discussionTask, null, 2)}

Learner academic discussion response:
${discussionAnswer || '[NO RESPONSE]'}

Return strict JSON only. No markdown.

Required JSON shape:
{
  "email": {
    "score6": 0,
    "taskFulfillment": 0,
    "organization": 0,
    "languageControl": 0,
    "tone": 0,
    "feedback": "string",
    "improvedVersion": "string"
  },
  "academicDiscussion": {
    "score6": 0,
    "ideaDevelopment": 0,
    "interactionWithPrompt": 0,
    "organization": 0,
    "languageControl": 0,
    "feedback": "string",
    "improvedVersion": "string"
  },
  "overallFeedback": "string",
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

async function evaluateConstructedResponses({
  ai,
  task,
  answers,
  sentenceResults,
}: {
  ai: GoogleGenAI;
  task: any;
  answers: Record<string, unknown>;
  sentenceResults: any;
}) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildEvaluationPrompt({ task, answers, sentenceResults }),
    config: {
      systemInstruction:
        'You are a strict TOEFL Writing evaluator and language tutor. Return valid JSON only.',
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text?.trim() || '{}';
  const parsed = safeParseJson(rawText);

  const email = parsed?.email || {};
  const academicDiscussion = parsed?.academicDiscussion || {};

  const errorPatterns = Array.isArray(parsed?.errorPatterns)
    ? parsed.errorPatterns
        .filter((item: ErrorPatternInput) => item?.pattern)
        .slice(0, 5)
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
    email: {
      score6: clampNumber(email.score6, 0, 6),
      taskFulfillment: clampNumber(email.taskFulfillment, 0, 6),
      organization: clampNumber(email.organization, 0, 6),
      languageControl: clampNumber(email.languageControl, 0, 6),
      tone: clampNumber(email.tone, 0, 6),
      feedback: String(email.feedback || '').trim(),
      improvedVersion: String(email.improvedVersion || '').trim(),
    },
    academicDiscussion: {
      score6: clampNumber(academicDiscussion.score6, 0, 6),
      ideaDevelopment: clampNumber(academicDiscussion.ideaDevelopment, 0, 6),
      interactionWithPrompt: clampNumber(academicDiscussion.interactionWithPrompt, 0, 6),
      organization: clampNumber(academicDiscussion.organization, 0, 6),
      languageControl: clampNumber(academicDiscussion.languageControl, 0, 6),
      feedback: String(academicDiscussion.feedback || '').trim(),
      improvedVersion: String(academicDiscussion.improvedVersion || '').trim(),
    },
    overallFeedback: String(parsed?.overallFeedback || '').trim(),
    errorPatterns,
  };
}

async function saveErrorPatterns({
  supabaseAdmin,
  userId,
  patterns,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  patterns: ErrorPatternInput[];
}) {
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
          severity: pattern.severity || existing.severity || 'medium',
          explanation: pattern.explanation || existing.explanation,
          example_wrong: pattern.example_wrong || existing.example_wrong,
          example_correct: pattern.example_correct || existing.example_correct,
          source: 'official_exam',
          last_seen_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            exam_key: 'toefl_ibt',
            section_key: 'writing',
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
        severity: pattern.severity || 'medium',
        frequency: 1,
        source: 'official_exam',
        last_seen_at: new Date().toISOString(),
        metadata: {
          exam_key: 'toefl_ibt',
          section_key: 'writing',
          exam_impact: true,
        },
      });
    }
  }
}

function buildSentenceErrorPatterns(sentenceResults: any): ErrorPatternInput[] {
  const missed = Array.isArray(sentenceResults?.details)
    ? sentenceResults.details.filter((item: any) => !item.isCorrect)
    : [];

  if (missed.length === 0) return [];

  const grouped = missed.reduce((acc: Record<string, number>, item: any) => {
    const skill = item.skill || 'sentence_structure';
    acc[skill] = (acc[skill] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped).map(([skill, count]) => ({
    pattern: `TOEFL Writing weakness: ${String(skill).replaceAll('_', ' ')}`,
    explanation: `You missed ${count} Build a Sentence item${
      count > 1 ? 's' : ''
    } related to ${String(skill).replaceAll('_', ' ')}.`,
    example_wrong: null,
    example_correct: null,
    severity: count >= 3 ? 'high' : count === 2 ? 'medium' : 'low',
  }));
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
    const answers = body.answers || {};

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
      .eq('section_key', 'writing')
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'TOEFL Writing section not found.');
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

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const sentenceResults = getBuildSentenceResults(section.content, answers);

    const constructedEvaluation = await evaluateConstructedResponses({
      ai,
      task: section.content,
      answers,
      sentenceResults,
    });

    const sentenceScore6 = sentenceResults.score6;
    const emailScore6 = constructedEvaluation.email.score6;
    const discussionScore6 = constructedEvaluation.academicDiscussion.score6;

    const score6 = roundToHalf(
      sentenceScore6 * 0.25 + emailScore6 * 0.35 + discussionScore6 * 0.4
    );

    const legacyScore30 = Math.round((score6 / 6) * 30);
    const completedAt = new Date().toISOString();

    const result = {
      section: 'writing',
      toeflVersion: 'current_2026',
      officialScoreScale: '1_6',
      compatibleScoreScale: '0_30',
      score6,
      legacyScore30,
      level: scoreToLevel(score6),
      sentenceResults,
      email: constructedEvaluation.email,
      academicDiscussion: constructedEvaluation.academicDiscussion,
      overallFeedback: constructedEvaluation.overallFeedback,
      completedAt,
    };

    const { data: updatedSection, error: updateSectionError } =
      await supabaseAdmin
        .from('exam_attempt_sections')
        .update({
          status: 'completed',
          completed_at: completedAt,
          answers,
          score: legacyScore30,
          result,
          metadata: {
            ...(section.metadata || {}),
            result,
            score6,
            legacy_score_30: legacyScore30,
          },
        })
        .eq('id', sectionId)
        .eq('user_id', user.id)
        .select('*')
        .single();

    if (updateSectionError) {
      throw new Error(
        updateSectionError.message || 'Failed to save TOEFL Writing result.'
      );
    }

    const { error: updateAttemptError } = await supabaseAdmin
      .from('exam_attempts')
      .update({
        status: 'completed',
        completed_at: completedAt,
        total_score: legacyScore30,
        result,
        metadata: {
          ...(section.metadata || {}),
          completed_section: 'writing',
          score6,
          legacy_score_30: legacyScore30,
          result,
        },
      })
      .eq('id', section.attempt_id)
      .eq('user_id', user.id);

    if (updateAttemptError) {
      throw new Error(updateAttemptError.message || 'Failed to update TOEFL attempt.');
    }

    const sentencePatterns = buildSentenceErrorPatterns(sentenceResults);

    await saveErrorPatterns({
      supabaseAdmin,
      userId: user.id,
      patterns: [...sentencePatterns, ...constructedEvaluation.errorPatterns],
    });

    await supabaseAdmin.from('study_sessions').insert({
      user_id: user.id,
      language_code: 'english',
      title: 'TOEFL iBT Writing Practice',
      session_type: 'writing',
      duration_minutes: 23,
      notes: `TOEFL Writing estimated score: ${score6}/6. Compatible legacy score: ${legacyScore30}/30.`,
      started_at: completedAt,
    });

    return new Response(JSON.stringify({ result, section: updatedSection }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Writing evaluation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Writing evaluation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});