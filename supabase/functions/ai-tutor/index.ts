import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TutorMode = 'chat' | 'correction' | 'grammar' | 'exam_coach' | 'pronunciation';

type ExtractedErrorPattern = {
  pattern: string;
  explanation?: string | null;
  example_wrong?: string | null;
  example_correct?: string | null;
  severity?: 'low' | 'medium' | 'high';
};

function formatLanguageLabel(languageCode: string) {
  const map: Record<string, string> = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[languageCode] || languageCode;
}

function buildSystemInstruction(languageCode: string, mode: TutorMode) {
  const language = formatLanguageLabel(languageCode);

  const base = `
You are Solang AI Tutor, a precise and supportive language tutor.

Target language: ${language}

Rules:
- Help the learner improve in the target language.
- Be clear, practical, and concise.
- Correct mistakes naturally.
- Explain important corrections.
- Do not invent user data.
- If the user writes in another language, still guide them toward the target language.
`;

  const modeInstructions: Record<TutorMode, string> = {
    chat: `
Mode: conversation practice.
Continue the conversation naturally.
Correct only important mistakes unless the user asks for detailed correction.
`,

    correction: `
Mode: correction.
Correct the user's text.
Return:
1. Corrected version
2. Main mistakes
3. Better alternatives
4. One short practice sentence
`,

    grammar: `
Mode: grammar tutor.
Explain grammar simply.
Give examples and one short exercise.
`,

    exam_coach: `
Mode: exam coach.
Give exam-oriented feedback.
Focus on structure, clarity, accuracy, and task response.
`,

    pronunciation: `
Mode: pronunciation coach.
Focus on pronunciation, rhythm, stress, connected speech, and natural delivery.
If audio is not provided, work from the written transcript.
`,
  };

  return `${base}\n${modeInstructions[mode] || modeInstructions.chat}`;
}

function buildConversationText(messages: Array<{ role: string; content: string }>) {
  return messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Tutor' : 'Learner';
      return `${role}: ${message.content}`;
    })
    .join('\n\n');
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

function shouldExtractErrorPatterns(mode: TutorMode) {
  return ['correction', 'grammar', 'exam_coach', 'pronunciation'].includes(mode);
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

async function extractErrorPatterns({
  ai,
  languageCode,
  mode,
  learnerMessage,
  assistantText,
}: {
  ai: GoogleGenAI;
  languageCode: string;
  mode: TutorMode;
  learnerMessage: string;
  assistantText: string;
}) {
  if (!shouldExtractErrorPatterns(mode)) {
    return [];
  }

  const language = formatLanguageLabel(languageCode);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `
Extract recurring language-learning error patterns from this tutoring exchange.

Target language: ${language}
Tutor mode: ${mode}

Learner message:
${learnerMessage}

Tutor response:
${assistantText}

Return JSON only.

Rules:
- Extract only real language mistakes visible in the learner message or clearly corrected by the tutor.
- Do not invent errors.
- If there is no clear error, return {"patterns":[]}.
- Maximum 3 patterns.
- pattern must be short and reusable, like "Missing third-person -s" or "Wrong preposition after depend".
- severity must be "low", "medium", or "high".

Return this exact shape:
{
  "patterns": [
    {
      "pattern": "string",
      "explanation": "string",
      "example_wrong": "string",
      "example_correct": "string",
      "severity": "low"
    }
  ]
}
`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text?.trim() || '{"patterns":[]}';
  const parsed = safeParseJson(rawText);

  if (!Array.isArray(parsed?.patterns)) {
    return [];
  }

  return parsed.patterns
    .filter((item: ExtractedErrorPattern) => item?.pattern)
    .slice(0, 3)
    .map((item: ExtractedErrorPattern) => ({
      pattern: String(item.pattern).trim(),
      explanation: item.explanation ? String(item.explanation).trim() : null,
      example_wrong: item.example_wrong ? String(item.example_wrong).trim() : null,
      example_correct: item.example_correct ? String(item.example_correct).trim() : null,
      severity: normalizeSeverity(item.severity),
    }));
}

async function saveErrorPatterns({
  supabase,
  userId,
  languageCode,
  conversationId,
  mode,
  patterns,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  languageCode: string;
  conversationId: string;
  mode: TutorMode;
  patterns: ExtractedErrorPattern[];
}) {
  const savedPatterns = [];

  for (const pattern of patterns) {
    const patternKey = normalizePatternKey(pattern.pattern);

    if (!patternKey) continue;

    const { data: existing } = await supabase
      .from('error_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('language_code', languageCode)
      .eq('pattern_key', patternKey)
      .maybeSingle();

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('error_patterns')
        .update({
          frequency: Number(existing.frequency || 1) + 1,
          severity: pattern.severity || existing.severity || 'medium',
          explanation: pattern.explanation || existing.explanation,
          example_wrong: pattern.example_wrong || existing.example_wrong,
          example_correct: pattern.example_correct || existing.example_correct,
          source: 'ai_tutor',
          last_seen_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            last_conversation_id: conversationId,
            last_mode: mode,
          },
        })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (!updateError && updated) {
        savedPatterns.push(updated);
      }
    } else {
      const { data: created, error: insertError } = await supabase
        .from('error_patterns')
        .insert({
          user_id: userId,
          language_code: languageCode,
          pattern_key: patternKey,
          pattern: pattern.pattern,
          explanation: pattern.explanation || null,
          example_wrong: pattern.example_wrong || null,
          example_correct: pattern.example_correct || null,
          severity: pattern.severity || 'medium',
          frequency: 1,
          source: 'ai_tutor',
          last_seen_at: new Date().toISOString(),
          metadata: {
            conversation_id: conversationId,
            mode,
          },
        })
        .select('*')
        .single();

      if (!insertError && created) {
        savedPatterns.push(created);
      }
    }
  }

  return savedPatterns;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
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
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    const body = await req.json();

    const message = String(body.message || '').trim();
    const languageCode = String(body.languageCode || '').trim();
    const mode = String(body.mode || 'chat') as TutorMode;
    let conversationId = body.conversationId || null;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    if (!languageCode) {
      return new Response(JSON.stringify({ error: 'languageCode is required.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    if (!conversationId) {
      const title = message.length > 48 ? `${message.slice(0, 48)}...` : message;

      const { data: conversation, error: conversationError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          language_code: languageCode,
          mode,
          title,
        })
        .select('*')
        .single();

      if (conversationError) {
        throw new Error(conversationError.message);
      }

      conversationId = conversation.id;
    }

    const { error: userMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      language_code: languageCode,
      role: 'user',
      content: message,
      metadata: {
        mode,
      },
    });

    if (userMessageError) {
      throw new Error(userMessageError.message);
    }

    const { data: recentMessages, error: recentMessagesError } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (recentMessagesError) {
      throw new Error(recentMessagesError.message);
    }

    const orderedMessages = [...(recentMessages || [])].reverse();

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: buildConversationText(orderedMessages),
      config: {
        systemInstruction: buildSystemInstruction(languageCode, mode),
      },
    });

    const assistantText =
      response.text?.trim() ||
      'I could not generate a response. Please try again.';

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        language_code: languageCode,
        role: 'assistant',
        content: assistantText,
        metadata: {
          mode,
          model: 'gemini-2.5-flash-lite',
        },
      })
      .select('*')
      .single();

    if (assistantMessageError) {
      throw new Error(assistantMessageError.message);
    }

    let detectedPatterns = [];

    try {
      const extractedPatterns = await extractErrorPatterns({
        ai,
        languageCode,
        mode,
        learnerMessage: message,
        assistantText,
      });

      detectedPatterns = await saveErrorPatterns({
        supabase,
        userId: user.id,
        languageCode,
        conversationId,
        mode,
        patterns: extractedPatterns,
      });
    } catch (patternError) {
      console.warn('Error DNA extraction failed:', patternError);
    }

    await supabase
      .from('ai_conversations')
      .update({
        mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        conversationId,
        message: assistantMessage,
        detectedPatterns,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown AI Tutor error.',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});