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

function buildToeflWritingPrompt() {
  return `
Generate a complete current TOEFL iBT Writing practice section.

Use the current TOEFL Writing structure:
- Build a Sentence
- Write an Email
- Write for an Academic Discussion

Requirements:
- Everything must be original.
- Do not use real TOEFL copyrighted material.
- Everything must be in English.
- The full section should contain exactly 12 items:
  - 10 Build a Sentence items
  - 1 Write an Email task
  - 1 Write for an Academic Discussion task
- Total section time: 23 minutes.
- Build a Sentence items must test grammar, word order, clause structure, modifiers, tense, agreement, and academic sentence control.
- Email task must be academic or campus-related.
- Academic Discussion task must include a professor question and two student posts.
- Topics must not require specialized background knowledge.

Return strict JSON only. No markdown.

Required JSON shape:
{
  "taskType": "toefl_writing_set",
  "title": "TOEFL iBT Writing Practice Section",
  "instructions": "Complete the Build a Sentence items, then write an email and an academic discussion response.",
  "content": {
    "version": "current_2026",
    "totalTimeMin": 23,
    "buildSentenceTimeMin": 8,
    "emailTimeMin": 7,
    "discussionTimeMin": 8,
    "buildSentenceItems": [
      {
        "id": "build_sentence_1",
        "skill": "word_order",
        "instruction": "Arrange the words and phrases to form a complete grammatical sentence.",
        "fragments": ["string", "string", "string"],
        "answer": "string",
        "explanation": "string"
      }
    ],
    "emailTask": {
      "id": "write_email",
      "title": "Write an Email",
      "situation": "string",
      "instructions": "string",
      "recipient": "string",
      "purpose": "string",
      "minWords": 80,
      "timeMinutes": 7
    },
    "academicDiscussionTask": {
      "id": "academic_discussion",
      "title": "Write for an Academic Discussion",
      "course": "string",
      "professorQuestion": "string",
      "studentPosts": [
        {
          "name": "Maya",
          "text": "string"
        },
        {
          "name": "Daniel",
          "text": "string"
        }
      ],
      "instructions": "Write a response that contributes to the discussion. State and support your opinion.",
      "minWords": 100,
      "timeMinutes": 8
    }
  }
}
`;
}

function normalizeString(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeBuildSentenceItem(item: any, index: number) {
  const id = normalizeString(item?.id, `build_sentence_${index + 1}`);

  const fragments = Array.isArray(item?.fragments)
    ? item.fragments
        .map((fragment: unknown) => String(fragment || '').trim())
        .filter(Boolean)
    : [];

  if (fragments.length < 3) {
    throw new Error(`Build Sentence item ${index + 1} must have at least 3 fragments.`);
  }

  const answer = normalizeString(item?.answer);

  if (!answer) {
    throw new Error(`Build Sentence item ${index + 1} is missing an answer.`);
  }

  return {
    id,
    skill: normalizeString(item?.skill, 'sentence_structure'),
    instruction:
      normalizeString(item?.instruction) ||
      'Arrange the words and phrases to form a complete grammatical sentence.',
    fragments,
    answer,
    explanation:
      normalizeString(item?.explanation) ||
      'This sentence requires correct word order and grammar.',
  };
}

function normalizeWritingTask(rawTask: any) {
  const rawContent = rawTask?.content || {};
  const rawBuildItems = Array.isArray(rawContent?.buildSentenceItems)
    ? rawContent.buildSentenceItems
    : [];

  if (rawBuildItems.length !== 10) {
    throw new Error('Generated TOEFL Writing task must contain exactly 10 Build a Sentence items.');
  }

  const buildSentenceItems = rawBuildItems.map(normalizeBuildSentenceItem);

  const emailTask = rawContent?.emailTask || {};
  const academicDiscussionTask = rawContent?.academicDiscussionTask || {};

  const studentPosts = Array.isArray(academicDiscussionTask?.studentPosts)
    ? academicDiscussionTask.studentPosts.slice(0, 2).map((post: any, index: number) => ({
        name: normalizeString(post?.name, index === 0 ? 'Maya' : 'Daniel'),
        text: normalizeString(post?.text),
      }))
    : [];

  while (studentPosts.length < 2) {
    studentPosts.push({
      name: studentPosts.length === 0 ? 'Maya' : 'Daniel',
      text: 'I think this topic has both advantages and disadvantages, depending on the situation.',
    });
  }

  return {
    taskType: 'toefl_writing_set',
    title: normalizeString(rawTask?.title, 'TOEFL iBT Writing Practice Section'),
    instructions:
      normalizeString(rawTask?.instructions) ||
      'Complete the Build a Sentence items, then write an email and an academic discussion response.',
    content: {
      version: 'current_2026',
      totalTimeMin: 23,
      buildSentenceTimeMin: 8,
      emailTimeMin: 7,
      discussionTimeMin: 8,
      buildSentenceItems,
      emailTask: {
        id: normalizeString(emailTask?.id, 'write_email'),
        title: normalizeString(emailTask?.title, 'Write an Email'),
        situation: normalizeString(emailTask?.situation),
        instructions:
          normalizeString(emailTask?.instructions) ||
          'Write a clear email that addresses the situation and fulfills the purpose.',
        recipient: normalizeString(emailTask?.recipient, 'University staff member'),
        purpose: normalizeString(emailTask?.purpose, 'Make a clear request or propose a solution.'),
        minWords: Number(emailTask?.minWords || 80),
        timeMinutes: 7,
      },
      academicDiscussionTask: {
        id: normalizeString(academicDiscussionTask?.id, 'academic_discussion'),
        title: normalizeString(
          academicDiscussionTask?.title,
          'Write for an Academic Discussion'
        ),
        course: normalizeString(academicDiscussionTask?.course, 'Academic English'),
        professorQuestion: normalizeString(academicDiscussionTask?.professorQuestion),
        studentPosts,
        instructions:
          normalizeString(academicDiscussionTask?.instructions) ||
          'Write a response that contributes to the discussion. State and support your opinion.',
        minWords: Number(academicDiscussionTask?.minWords || 100),
        timeMinutes: 8,
      },
    },
  };
}

async function generateWritingTask(ai: GoogleGenAI) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildToeflWritingPrompt(),
    config: {
      systemInstruction:
        'You generate realistic current TOEFL iBT Writing practice sections. Return valid JSON only. Do not use real TOEFL copyrighted content.',
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text?.trim() || '{}';
  return normalizeWritingTask(safeParseJson(rawText));
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

    const task = await generateWritingTask(ai);

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
          section: 'writing',
          source: 'gemini_text',
          toefl_version: 'current_2026',
          official_score_scale: '1_6',
          compatible_score_scale: '0_30',
        },
      })
      .select('*')
      .single();

    if (attemptError) {
      throw new Error(attemptError.message || 'Failed to create TOEFL Writing attempt.');
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .insert({
        attempt_id: attempt.id,
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        section_key: 'writing',
        section_label: 'Writing',
        duration_minutes: 23,
        status: 'in_progress',
        content: task,
        answers: {},
        max_score: 30,
        metadata: {
          remaining_seconds: 23 * 60,
          current_task_index: 0,
          toefl_version: 'current_2026',
          official_score_scale: '1_6',
          compatible_score_scale: '0_30',
          generated_with: {
            text_model: TEXT_MODEL,
          },
        },
      })
      .select('*')
      .single();

    if (sectionError) {
      throw new Error(sectionError.message || 'Failed to create TOEFL Writing section.');
    }

    return new Response(JSON.stringify({ attempt, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Writing generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Writing generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});