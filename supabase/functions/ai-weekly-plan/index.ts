import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type WeeklyPlanMode = 'balanced' | 'exam' | 'weak_points' | 'immersion';
type WeeklyPlanIntensity = 'light' | 'normal' | 'intense';

type DayAvailability = {
  dayIndex: number;
  label: string;
  availableMinutes: number;
};

type WeeklyBlock = {
  dayIndex: number;
  blockType: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  skillFocus?: string | null;
  resourceId?: string | null;
  errorPatternId?: string | null;
  flashcardFocus?: boolean;
};

type WeeklyPlanPayload = {
  title: string;
  summary: string;
  blocks: WeeklyBlock[];
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

function getWeekStartDate(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;

  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);

  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeMode(value: unknown): WeeklyPlanMode {
  const raw = String(value || '').trim();

  if (raw === 'exam') return 'exam';
  if (raw === 'weak_points') return 'weak_points';
  if (raw === 'immersion') return 'immersion';

  return 'balanced';
}

function normalizeIntensity(value: unknown): WeeklyPlanIntensity {
  const raw = String(value || '').trim();

  if (raw === 'light') return 'light';
  if (raw === 'intense') return 'intense';

  return 'normal';
}

function normalizeAvailability(value: unknown): DayAvailability[] {
  const defaultLabels = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const rawArray = Array.isArray(value) ? value : [];

  return defaultLabels.map((label, index) => {
    const matching = rawArray.find((item) => Number(item?.dayIndex) === index);

    return {
      dayIndex: index,
      label,
      availableMinutes: clampNumber(
        matching?.availableMinutes,
        0,
        480,
        index >= 5 ? 180 : 90
      ),
    };
  });
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

function truncateText(value: unknown, max = 500) {
  const text = String(value || '').trim();

  if (text.length <= max) return text;

  return `${text.slice(0, max)}...`;
}

function buildContextSummary({
  resources,
  errorPatterns,
  dueFlashcards,
  recentSessions,
}: {
  resources: any[];
  errorPatterns: any[];
  dueFlashcards: any[];
  recentSessions: any[];
}) {
  return {
    resources: resources.map((resource) => ({
      id: resource.id,
      title: resource.title || 'Untitled resource',
      type: resource.resource_type || resource.type || 'resource',
      url: resource.url || null,
      notes: truncateText(resource.notes || resource.description || '', 160),
    })),
    errorPatterns: errorPatterns.map((pattern) => ({
      id: pattern.id,
      pattern: pattern.pattern,
      severity: pattern.severity,
      frequency: pattern.frequency,
      explanation: truncateText(pattern.explanation, 180),
      wrong: pattern.example_wrong || null,
      correct: pattern.example_correct || null,
    })),
    dueFlashcards: dueFlashcards.map((card) => ({
      id: card.id,
      front: truncateText(card.front, 160),
      status: card.status,
      due_at: card.due_at,
    })),
    recentSessions: recentSessions.map((session) => ({
      title: session.title || 'Study session',
      type: session.session_type,
      duration: session.duration_minutes,
      date: session.started_at || session.created_at,
    })),
  };
}

function buildWeeklyPrompt({
  languageCode,
  objective,
  mode,
  intensity,
  availability,
  context,
}: {
  languageCode: string;
  objective: string;
  mode: WeeklyPlanMode;
  intensity: WeeklyPlanIntensity;
  availability: DayAvailability[];
  context: any;
}) {
  const language = formatLanguageLabel(languageCode);
  const totalMinutes = availability.reduce(
    (sum, day) => sum + day.availableMinutes,
    0
  );

  return `
Generate a personalized weekly language-learning plan for Solang.

Target language: ${language}
Main objective: ${objective}
Mode: ${mode}
Intensity: ${intensity}
Total weekly time available: ${totalMinutes} minutes

Weekly availability:
${JSON.stringify(availability, null, 2)}

Real user context:
${JSON.stringify(context, null, 2)}

Rules:
- Return valid JSON only. No markdown fences.
- Create a plan for the whole week.
- Respect the available minutes for each day.
- If a day has 0 minutes, do not create blocks for that day.
- Each active day should have 1 to 4 blocks.
- Total block duration for a day must not exceed that day's available minutes.
- Use Error DNA if available.
- Include due flashcards if available.
- Suggest saved resources only if they appear in the provided resources list.
- If you use a resource, use its real id.
- If you use an error pattern, use its real id.
- Make instructions specific and actionable.
- Do not invent completed work.
- Do not invent user data.
- For dayIndex, use:
  0 Monday, 1 Tuesday, 2 Wednesday, 3 Thursday, 4 Friday, 5 Saturday, 6 Sunday.
- For blockType, use one of:
  "flashcards", "speaking", "listening", "reading", "writing", "grammar", "immersion", "exam", "review".

Return this exact shape:
{
  "title": "string",
  "summary": "string",
  "blocks": [
    {
      "dayIndex": 0,
      "blockType": "speaking",
      "title": "string",
      "instructions": "string",
      "durationMinutes": 20,
      "skillFocus": "string",
      "resourceId": null,
      "errorPatternId": null,
      "flashcardFocus": false
    }
  ]
}
`;
}

function buildFallbackPlan({
  languageCode,
  objective,
  mode,
  availability,
  errorPatterns,
  dueFlashcards,
  resources,
}: {
  languageCode: string;
  objective: string;
  mode: WeeklyPlanMode;
  availability: DayAvailability[];
  errorPatterns: any[];
  dueFlashcards: any[];
  resources: any[];
}): WeeklyPlanPayload {
  const language = formatLanguageLabel(languageCode);
  const blocks: WeeklyBlock[] = [];

  availability.forEach((day) => {
    let remaining = day.availableMinutes;

    if (remaining <= 0) return;

    if (dueFlashcards.length > 0 && remaining >= 10) {
      const duration = Math.min(15, remaining);

      blocks.push({
        dayIndex: day.dayIndex,
        blockType: 'flashcards',
        title: 'Review due flashcards',
        instructions:
          'Review your due flashcards. Say each answer out loud before revealing it, then mark the card honestly as known or missed.',
        durationMinutes: duration,
        skillFocus: 'memory',
        resourceId: null,
        errorPatternId: null,
        flashcardFocus: true,
      });

      remaining -= duration;
    }

    if (errorPatterns.length > 0 && remaining >= 15) {
      const topError = errorPatterns[0];
      const duration = Math.min(25, remaining);

      blocks.push({
        dayIndex: day.dayIndex,
        blockType: 'grammar',
        title: `Fix: ${topError.pattern}`,
        instructions: topError.example_wrong
          ? `Study the recurring mistake "${topError.pattern}". Correct this example, then create 5 original sentences using the correct structure: "${topError.example_wrong}".`
          : `Study the recurring mistake "${topError.pattern}". Write 5 original sentences that avoid this error, then explain the rule in your own words.`,
        durationMinutes: duration,
        skillFocus: 'accuracy',
        resourceId: null,
        errorPatternId: topError.id,
        flashcardFocus: false,
      });

      remaining -= duration;
    }

    if (remaining >= 20) {
      const resource = resources[0] || null;
      const duration = Math.min(mode === 'immersion' ? 35 : 25, remaining);

      blocks.push({
        dayIndex: day.dayIndex,
        blockType: mode === 'immersion' ? 'immersion' : 'speaking',
        title:
          mode === 'immersion'
            ? 'Focused immersion block'
            : 'Speaking fluency block',
        instructions:
          mode === 'immersion'
            ? 'Use the suggested saved resource if available. Listen or read actively, write down 5 useful expressions, then reuse them in 3 original sentences.'
            : `Speak for at least 5 minutes about this objective: "${objective}". Record yourself if possible, then write down 3 sentences you struggled to say naturally.`,
        durationMinutes: duration,
        skillFocus: mode === 'immersion' ? 'immersion' : 'speaking',
        resourceId: resource?.id || null,
        errorPatternId: null,
        flashcardFocus: false,
      });

      remaining -= duration;
    }

    if (remaining >= 15) {
      blocks.push({
        dayIndex: day.dayIndex,
        blockType: 'writing',
        title: 'Short written output',
        instructions: `Write one short paragraph in ${language} about: "${objective}". Focus on clarity, accuracy, and using at least 3 new expressions from this week.`,
        durationMinutes: remaining,
        skillFocus: 'writing',
        resourceId: null,
        errorPatternId: null,
        flashcardFocus: false,
      });
    }
  });

  if (blocks.length === 0) {
    blocks.push({
      dayIndex: 0,
      blockType: 'review',
      title: 'Quick weekly review',
      instructions:
        'Review your most recent notes or flashcards for 10 minutes. Say each answer aloud and write one corrected sentence.',
      durationMinutes: 10,
      skillFocus: 'review',
      resourceId: null,
      errorPatternId: null,
      flashcardFocus: dueFlashcards.length > 0,
    });
  }

  return {
    title: `${language} Weekly Plan`,
    summary:
      'Fallback weekly plan generated from your availability, Error DNA, flashcards, resources, and recent practice history.',
    blocks,
  };
}

function validateGeneratedPlan({
  generated,
  availability,
  resourceIds,
  errorPatternIds,
}: {
  generated: any;
  availability: DayAvailability[];
  resourceIds: Set<string>;
  errorPatternIds: Set<string>;
}): WeeklyPlanPayload | null {
  if (!generated || typeof generated !== 'object') return null;
  if (!Array.isArray(generated.blocks)) return null;

  const availabilityMap = new Map(
    availability.map((day) => [day.dayIndex, day.availableMinutes])
  );

  const dailyTotals = new Map<number, number>();

  const blocks = generated.blocks
    .map((block: any, index: number) => {
      const dayIndex = clampNumber(block.dayIndex, 0, 6, 0);
      const dayLimit = availabilityMap.get(dayIndex) || 0;

      if (dayLimit <= 0) return null;

      const durationMinutes = clampNumber(block.durationMinutes, 5, dayLimit, 15);

      const nextDailyTotal = (dailyTotals.get(dayIndex) || 0) + durationMinutes;

      if (nextDailyTotal > dayLimit + 5) {
        return null;
      }

      dailyTotals.set(dayIndex, nextDailyTotal);

      const resourceId =
        block.resourceId && resourceIds.has(block.resourceId)
          ? block.resourceId
          : null;

      const errorPatternId =
        block.errorPatternId && errorPatternIds.has(block.errorPatternId)
          ? block.errorPatternId
          : null;

      return {
        dayIndex,
        blockType: String(block.blockType || 'practice').trim() || 'practice',
        title:
          String(block.title || `Weekly Block ${index + 1}`).trim() ||
          `Weekly Block ${index + 1}`,
        instructions:
          String(block.instructions || 'Complete this study block.').trim() ||
          'Complete this study block.',
        durationMinutes,
        skillFocus: block.skillFocus ? String(block.skillFocus).trim() : null,
        resourceId,
        errorPatternId,
        flashcardFocus: Boolean(block.flashcardFocus),
      };
    })
    .filter(Boolean) as WeeklyBlock[];

  if (blocks.length === 0) return null;

  return {
    title: String(generated.title || 'Weekly Plan').trim() || 'Weekly Plan',
    summary:
      String(generated.summary || 'Personalized weekly plan generated by AI.').trim() ||
      'Personalized weekly plan generated by AI.',
    blocks,
  };
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

    const languageCode = String(body.languageCode || '').trim();
    const objective =
      String(body.objective || '').trim() || 'Improve overall fluency';
    const mode = normalizeMode(body.mode);
    const intensity = normalizeIntensity(body.intensity);
    const availability = normalizeAvailability(body.availability);

    if (!languageCode) {
      return new Response(JSON.stringify({ error: 'languageCode is required.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    const weekStart = getWeekStartDate();
    const weekStartKey = toDateKey(weekStart);
    const now = new Date().toISOString();

    const [
      resourcesResult,
      errorPatternsResult,
      dueFlashcardsResult,
      recentSessionsResult,
    ] = await Promise.all([
      supabase
        .from('resources')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('error_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .order('frequency', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),

      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .neq('status', 'mastered')
        .lte('due_at', now)
        .order('due_at', { ascending: true })
        .limit(10),

      supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (resourcesResult.error) throw new Error(resourcesResult.error.message);
    if (errorPatternsResult.error) throw new Error(errorPatternsResult.error.message);
    if (dueFlashcardsResult.error) throw new Error(dueFlashcardsResult.error.message);
    if (recentSessionsResult.error) throw new Error(recentSessionsResult.error.message);

    const resources = resourcesResult.data || [];
    const errorPatterns = errorPatternsResult.data || [];
    const dueFlashcards = dueFlashcardsResult.data || [];
    const recentSessions = recentSessionsResult.data || [];

    const resourceIds = new Set(resources.map((item) => item.id));
    const errorPatternIds = new Set(errorPatterns.map((item) => item.id));

    const context = buildContextSummary({
      resources,
      errorPatterns,
      dueFlashcards,
      recentSessions,
    });

    let planPayload: WeeklyPlanPayload | null = null;

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: buildWeeklyPrompt({
          languageCode,
          objective,
          mode,
          intensity,
          availability,
          context,
        }),
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text?.trim() || '{}';
      const parsed = safeParseJson(rawText);

      planPayload = validateGeneratedPlan({
        generated: parsed,
        availability,
        resourceIds,
        errorPatternIds,
      });
    } catch (aiError) {
      console.warn('AI weekly plan generation failed. Using fallback.', aiError);
    }

    if (!planPayload) {
      planPayload = buildFallbackPlan({
        languageCode,
        objective,
        mode,
        availability,
        errorPatterns,
        dueFlashcards,
        resources,
      });
    }

    await supabase
      .from('weekly_plans')
      .update({
        status: 'replaced',
      })
      .eq('user_id', user.id)
      .eq('language_code', languageCode)
      .eq('week_start', weekStartKey)
      .eq('status', 'active');

    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .insert({
        user_id: user.id,
        language_code: languageCode,
        week_start: weekStartKey,
        title: planPayload.title,
        objective,
        mode,
        intensity,
        summary: planPayload.summary,
        status: 'active',
        ai_model: 'gemini-2.5-flash-lite',
        metadata: {
          availability,
          generated_from: {
            resources_count: resources.length,
            error_patterns_count: errorPatterns.length,
            due_flashcards_count: dueFlashcards.length,
            recent_sessions_count: recentSessions.length,
          },
        },
      })
      .select('*')
      .single();

    if (planError) {
      throw new Error(planError.message);
    }

    const blocksToInsert = planPayload.blocks.map((block, index) => {
      const resource = block.resourceId
        ? resources.find((item) => item.id === block.resourceId)
        : null;

      return {
        plan_id: plan.id,
        user_id: user.id,
        language_code: languageCode,
        scheduled_date: toDateKey(addDays(weekStart, block.dayIndex)),
        day_index: block.dayIndex,
        position: index + 1,
        block_type: block.blockType,
        title: block.title,
        instructions: block.instructions,
        duration_minutes: block.durationMinutes,
        skill_focus: block.skillFocus || null,
        resource_id: block.resourceId || null,
        resource_title: resource?.title || null,
        resource_url: resource?.url || null,
        error_pattern_id: block.errorPatternId || null,
        flashcard_focus: Boolean(block.flashcardFocus),
        status: 'planned',
        metadata: {
          mode,
          intensity,
        },
      };
    });

    const { error: blocksError } = await supabase
      .from('weekly_plan_blocks')
      .insert(blocksToInsert);

    if (blocksError) {
      throw new Error(blocksError.message);
    }

    const { data: blocks, error: readBlocksError } = await supabase
      .from('weekly_plan_blocks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('scheduled_date', { ascending: true })
      .order('position', { ascending: true });

    if (readBlocksError) {
      throw new Error(readBlocksError.message);
    }

    return new Response(
      JSON.stringify({
        plan,
        blocks: blocks || [],
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
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI weekly plan generation error.',
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