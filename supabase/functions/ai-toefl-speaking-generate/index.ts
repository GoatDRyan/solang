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

function normalizeString(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildToeflSpeakingPrompt() {
  return `
Generate a complete TOEFL iBT Speaking practice section.

Use the classic TOEFL iBT Speaking structure:
- 4 tasks total
- Task 1: Independent Speaking
- Task 2: Integrated Campus Situation
- Task 3: Integrated Academic Course Topic
- Task 4: Integrated Academic Lecture
- Total section time: about 16 minutes

Timing:
- Task 1: 15 seconds preparation, 45 seconds response
- Task 2: 30 seconds preparation, 60 seconds response
- Task 3: 30 seconds preparation, 60 seconds response
- Task 4: 20 seconds preparation, 60 seconds response

Requirements:
- Everything must be original.
- Do not use real TOEFL copyrighted content.
- Everything must be in English.
- Integrated tasks should include the stimulus content needed to answer.
- The learner will record audio responses, not type answers.
- Prompts should be clear, realistic, and academic/campus-based.
- Avoid specialized background knowledge.

Return strict JSON only. No markdown.

Required JSON shape:
{
  "taskType": "toefl_speaking_set",
  "title": "TOEFL iBT Speaking Practice Section",
  "instructions": "Prepare, then record your spoken answer for each task.",
  "content": {
    "totalTimeMin": 16,
    "tasks": [
      {
        "id": "speaking_task_1",
        "taskNumber": 1,
        "taskType": "independent",
        "title": "Independent Speaking",
        "prepTimeSec": 15,
        "responseTimeSec": 45,
        "prompt": "string",
        "readingText": "",
        "listeningTranscript": "",
        "question": "string",
        "scoringFocus": ["delivery", "language_use", "topic_development"]
      },
      {
        "id": "speaking_task_2",
        "taskNumber": 2,
        "taskType": "integrated_campus",
        "title": "Integrated Speaking: Campus Situation",
        "prepTimeSec": 30,
        "responseTimeSec": 60,
        "prompt": "string",
        "readingText": "string",
        "listeningTranscript": "string",
        "question": "string",
        "scoringFocus": ["delivery", "language_use", "topic_development"]
      }
    ]
  }
}
`;
}

function normalizeSpeakingTask(item: any, index: number) {
  const taskNumber = Number(item?.taskNumber || index + 1);

  const defaultType =
    taskNumber === 1
      ? 'independent'
      : taskNumber === 2
      ? 'integrated_campus'
      : taskNumber === 3
      ? 'integrated_academic'
      : 'integrated_lecture';

  const defaultTitle =
    taskNumber === 1
      ? 'Independent Speaking'
      : taskNumber === 2
      ? 'Integrated Speaking: Campus Situation'
      : taskNumber === 3
      ? 'Integrated Speaking: Academic Course Topic'
      : 'Integrated Speaking: Academic Lecture';

  const prepTimeSec =
    taskNumber === 1 ? 15 : taskNumber === 4 ? 20 : 30;

  const responseTimeSec = taskNumber === 1 ? 45 : 60;

  return {
    id: normalizeString(item?.id, `speaking_task_${taskNumber}`),
    taskNumber,
    taskType: normalizeString(item?.taskType, defaultType),
    title: normalizeString(item?.title, defaultTitle),
    prepTimeSec: Number(item?.prepTimeSec || prepTimeSec),
    responseTimeSec: Number(item?.responseTimeSec || responseTimeSec),
    prompt: normalizeString(item?.prompt),
    readingText: normalizeString(item?.readingText),
    listeningTranscript: normalizeString(item?.listeningTranscript),
    question: normalizeString(item?.question),
    scoringFocus: Array.isArray(item?.scoringFocus)
      ? item.scoringFocus
      : ['delivery', 'language_use', 'topic_development'],
    responseAudioUrl: '',
    responseAudioPath: '',
    responseMimeType: '',
    responseDurationSec: 0,
  };
}

function normalizeSpeakingSet(rawTask: any) {
  const rawTasks = Array.isArray(rawTask?.content?.tasks)
    ? rawTask.content.tasks
    : [];

  if (rawTasks.length !== 4) {
    throw new Error('Generated TOEFL Speaking section must contain exactly 4 tasks.');
  }

  const tasks = rawTasks.map(normalizeSpeakingTask);

  return {
    taskType: 'toefl_speaking_set',
    title: normalizeString(rawTask?.title, 'TOEFL iBT Speaking Practice Section'),
    instructions:
      normalizeString(rawTask?.instructions) ||
      'Prepare, then record your spoken answer for each task.',
    content: {
      totalTimeMin: 16,
      tasks,
    },
  };
}

async function generateSpeakingTask(ai: GoogleGenAI) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildToeflSpeakingPrompt(),
    config: {
      systemInstruction:
        'You generate realistic TOEFL iBT Speaking practice sections. Return valid JSON only. Do not use real TOEFL copyrighted content.',
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text?.trim() || '{}';
  return normalizeSpeakingSet(safeParseJson(rawText));
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

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const now = new Date().toISOString();

    const task = await generateSpeakingTask(ai);

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('exam_attempts')
      .insert({
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        exam_label: 'TOEFL iBT',
        mode: 'single_section',
        status: 'in_progress',
        max_score: 30,
        started_at: now,
        metadata: {
          section: 'speaking',
          source: 'gemini_text',
          response_mode: 'audio_recording',
          score_scale: '0_30',
        },
      })
      .select('*')
      .single();

    if (attemptError) {
      throw new Error(attemptError.message || 'Failed to create TOEFL Speaking attempt.');
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .insert({
        attempt_id: attempt.id,
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        section_key: 'speaking',
        section_label: 'Speaking',
        duration_minutes: 16,
        status: 'in_progress',
        content: task,
        answers: {},
        max_score: 30,
        metadata: {
          remaining_seconds: 16 * 60,
          current_task_index: 0,
          recorded_task_ids: [],
          response_mode: 'audio_recording',
          generated_with: {
            text_model: TEXT_MODEL,
          },
        },
      })
      .select('*')
      .single();

    if (sectionError) {
      throw new Error(sectionError.message || 'Failed to create TOEFL Speaking section.');
    }

    return new Response(JSON.stringify({ attempt, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Speaking generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Speaking generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});