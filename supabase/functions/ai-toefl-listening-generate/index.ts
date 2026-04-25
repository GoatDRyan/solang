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

function buildToeflListeningPrompt() {
  return `
Generate a complete TOEFL iBT Listening practice section.

Official-like structure:
- 2 campus conversations
- 3 academic lectures
- 5 questions per conversation
- 6 questions per lecture
- Total: 28 questions
- Total time: about 36 minutes
- The learner hears each audio once before seeing the questions.

Content requirements:
- Everything must be in English.
- Conversations must be realistic university campus situations.
- Lectures must be academic, university-level, but understandable.
- Use natural spoken language, but keep it clear enough for TTS.
- Each transcript must be self-contained.
- Do not mention TOEFL in the transcripts themselves.
- Do not include copyrighted passages or real test content.
- Questions must be answerable only from the audio.
- The first question of each item must be either gist_content or gist_purpose.
- Use a variety of question types:
  gist_content, gist_purpose, detail, function, attitude, organization, connecting_content, inference.
- Keep all questions as four-option multiple choice with labels A, B, C, D.
- For conversations, write the transcript with exactly these speaker labels:
  Student:
  Advisor:
- For lectures, write plain lecture text without speaker labels.

Length requirements:
- Conversations: around 430 to 520 words each.
- Lectures: around 620 to 780 words each.

Return strict JSON only. No markdown.

Required JSON shape:
{
  "taskType": "toefl_listening_set",
  "title": "TOEFL iBT Listening Practice Section",
  "instructions": "Listen to each conversation or lecture once. Take notes while listening. Answer the questions after the audio ends.",
  "content": {
    "totalTimeMin": 36,
    "items": [
      {
        "id": "conversation_1",
        "audioType": "conversation",
        "title": "Conversation 1",
        "topic": "string",
        "setting": "string",
        "durationHintMin": 3,
        "transcript": "Student: ...\\nAdvisor: ...",
        "audioUrl": "",
        "audioPath": "",
        "questions": [
          {
            "id": "conversation_1_q1",
            "type": "gist_purpose",
            "question": "string",
            "options": [
              { "label": "A", "text": "string" },
              { "label": "B", "text": "string" },
              { "label": "C", "text": "string" },
              { "label": "D", "text": "string" }
            ],
            "answer": "A",
            "explanation": "string"
          }
        ]
      }
    ]
  }
}
`;
}

function normalizeOptionLabels(question: any) {
  const labels = ['A', 'B', 'C', 'D'];

  const options = Array.isArray(question?.options)
    ? question.options.slice(0, 4).map((option: any, index: number) => ({
        label: labels[index],
        text: String(option?.text || option || '').trim(),
      }))
    : [];

  while (options.length < 4) {
    options.push({
      label: labels[options.length],
      text: `Option ${labels[options.length]}`,
    });
  }

  const answer = labels.includes(String(question?.answer || '').trim())
    ? String(question.answer).trim()
    : 'A';

  return {
    id: String(question?.id || '').trim(),
    type: String(question?.type || 'detail').trim(),
    question: String(question?.question || '').trim(),
    options,
    answer,
    explanation: String(question?.explanation || '').trim(),
  };
}

function normalizeListeningTask(rawTask: any) {
  const rawItems = Array.isArray(rawTask?.content?.items)
    ? rawTask.content.items
    : [];

  if (rawItems.length !== 5) {
    throw new Error('Generated TOEFL Listening task must contain exactly 5 items.');
  }

  const normalizedItems = rawItems.map((item: any, itemIndex: number) => {
    const audioType =
      item.audioType === 'lecture' || itemIndex >= 2 ? 'lecture' : 'conversation';

    const expectedQuestionCount = audioType === 'conversation' ? 5 : 6;
    const rawQuestions = Array.isArray(item?.questions) ? item.questions : [];

    if (rawQuestions.length !== expectedQuestionCount) {
      throw new Error(
        `Listening item ${itemIndex + 1} must contain exactly ${expectedQuestionCount} questions.`
      );
    }

    const itemNumber =
      audioType === 'conversation' ? itemIndex + 1 : itemIndex - 1;

    const itemId =
      String(item?.id || '').trim() ||
      `${audioType}_${itemNumber}`;

    const questions = rawQuestions.map((question: any, questionIndex: number) => {
      const normalized = normalizeOptionLabels(question);

      return {
        ...normalized,
        id:
          normalized.id ||
          `${itemId}_q${questionIndex + 1}`,
      };
    });

    return {
      id: itemId,
      audioType,
      title:
        String(item?.title || '').trim() ||
        `${audioType === 'conversation' ? 'Conversation' : 'Lecture'} ${itemNumber}`,
      topic: String(item?.topic || 'Academic topic').trim(),
      setting: String(item?.setting || '').trim(),
      durationHintMin: Number(item?.durationHintMin || (audioType === 'lecture' ? 4 : 3)),
      transcript: String(item?.transcript || '').trim(),
      audioUrl: '',
      audioPath: '',
      questions,
    };
  });

  return {
    taskType: 'toefl_listening_set',
    title: String(rawTask?.title || 'TOEFL iBT Listening Practice Section').trim(),
    instructions:
      String(rawTask?.instructions || '').trim() ||
      'Listen to each conversation or lecture once. Take notes while listening. Answer the questions after the audio ends.',
    content: {
      totalTimeMin: 36,
      items: normalizedItems,
    },
  };
}

async function generateListeningTask(ai: GoogleGenAI) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: buildToeflListeningPrompt(),
    config: {
      systemInstruction:
        'You generate realistic TOEFL iBT Listening practice sections. Return valid JSON only. No markdown fences. Do not use real TOEFL copyrighted content.',
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text?.trim() || '{}';
  return normalizeListeningTask(safeParseJson(rawText));
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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    if (!geminiApiKey) {
      throw new Error('Missing GEMINI_API_KEY secret.');
    }

    const authorization = req.headers.get('Authorization') || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const now = new Date().toISOString();

    const task = await generateListeningTask(ai);

    const { data: attempt, error: attemptError } = await supabase
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
          section: 'listening',
          source: 'gemini_text',
          audio_generation: 'on_demand',
        },
      })
      .select('*')
      .single();

    if (attemptError) {
      throw new Error(attemptError.message || 'Failed to create TOEFL attempt.');
    }

    const { data: section, error: sectionError } = await supabase
      .from('exam_attempt_sections')
      .insert({
        attempt_id: attempt.id,
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        section_key: 'listening',
        section_label: 'Listening',
        duration_minutes: 36,
        status: 'in_progress',
        content: task,
        answers: {},
        max_score: 30,
        metadata: {
          remaining_seconds: 36 * 60,
          played_item_ids: [],
          current_item_index: 0,
          notes: {},
          audio_generation: 'on_demand',
          generated_with: {
            text_model: TEXT_MODEL,
          },
        },
      })
      .select('*')
      .single();

    if (sectionError) {
      throw new Error(sectionError.message || 'Failed to create TOEFL Listening section.');
    }

    return new Response(JSON.stringify({ attempt, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Listening generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Listening generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});