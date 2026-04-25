import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'gemini-2.5-flash-lite';

const DEFAULT_GOAL = {
  target_exam: 'toefl_ibt',
  target_level: 'C1',
  target_score: 95,
  deadline: null,
  weekly_minutes: 600,
  priority: 'balanced',
};

const DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getMondayDate(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: unknown, min = 0, max = 30) {
  return clamp(safeNumber(value), min, max);
}

function getSectionScore(section: any) {
  const result = section.result || section.metadata?.result || {};

  if (section.section_key === 'speaking') {
    return clampScore(
      result.scaledScore ??
        result.scaled_score_30 ??
        section.metadata?.scaled_score_30 ??
        section.score
    );
  }

  if (section.section_key === 'writing') {
    return clampScore(
      result.legacyScore30 ??
        result.legacy_score_30 ??
        section.metadata?.legacy_score_30 ??
        section.score
    );
  }

  return clampScore(
    result.score ??
      result.scaledScore ??
      result.scaled_score_30 ??
      result.legacyScore30 ??
      section.score
  );
}

function toeflTotalToCefr(totalScore: number) {
  if (totalScore >= 114) return 'C2';
  if (totalScore >= 95) return 'C1';
  if (totalScore >= 72) return 'B2';
  if (totalScore >= 42) return 'B1';

  return 'Below B1';
}

function toeflSectionToCefr(sectionKey: string, scoreValue: number) {
  const score = safeNumber(scoreValue);

  if (sectionKey === 'reading') {
    if (score >= 29) return 'C2';
    if (score >= 24) return 'C1';
    if (score >= 18) return 'B2';
    if (score >= 4) return 'B1';
    return 'Below B1';
  }

  if (sectionKey === 'listening') {
    if (score >= 28) return 'C2';
    if (score >= 22) return 'C1';
    if (score >= 17) return 'B2';
    if (score >= 9) return 'B1';
    return 'Below B1';
  }

  if (sectionKey === 'speaking') {
    if (score >= 25) return 'C1';
    if (score >= 20) return 'B2';
    if (score >= 16) return 'B1';
    if (score >= 10) return 'A2';
    return 'Below A2';
  }

  if (sectionKey === 'writing') {
    if (score >= 29) return 'C2';
    if (score >= 24) return 'C1';
    if (score >= 17) return 'B2';
    if (score >= 13) return 'B1';
    if (score >= 7) return 'A2';
    return 'Below A2';
  }

  return 'Unknown';
}

function formatSectionLabel(sectionKey: string) {
  const map: Record<string, string> = {
    reading: 'Reading',
    listening: 'Listening',
    speaking: 'Speaking',
    writing: 'Writing',
  };

  return map[sectionKey] || sectionKey;
}

function buildLatestToeflSnapshot(sections: any[]) {
  const latestBySection: Record<string, any> = {
    reading: null,
    listening: null,
    speaking: null,
    writing: null,
  };

  sections.forEach((section) => {
    const key = section.section_key;

    if (!Object.prototype.hasOwnProperty.call(latestBySection, key)) return;

    if (!latestBySection[key]) {
      latestBySection[key] = section;
    }
  });

  const sectionScores = Object.entries(latestBySection).reduce(
    (acc: Record<string, any>, [sectionKey, section]) => {
      if (!section) {
        acc[sectionKey] = {
          sectionKey,
          label: formatSectionLabel(sectionKey),
          score: null,
          cefrLevel: null,
        };

        return acc;
      }

      const score = getSectionScore(section);

      acc[sectionKey] = {
        sectionKey,
        label: formatSectionLabel(sectionKey),
        score,
        cefrLevel: toeflSectionToCefr(sectionKey, score),
      };

      return acc;
    },
    {}
  );

  const completedSections = Object.values(sectionScores).filter(
    (item: any) => item.score !== null
  ).length;

  const isComplete = completedSections === 4;

  const totalScore = Object.values(sectionScores).reduce(
    (total: number, item: any) => {
      if (item.score === null) return total;
      return total + safeNumber(item.score);
    },
    0
  );

  const completedScores = Object.values(sectionScores).filter(
    (item: any) => item.score !== null
  );

  const weakestSection =
    completedScores.length > 0
      ? [...completedScores].sort((a: any, b: any) => a.score - b.score)[0]
      : null;

  const strongestSection =
    completedScores.length > 0
      ? [...completedScores].sort((a: any, b: any) => b.score - a.score)[0]
      : null;

  return {
    sectionScores,
    completedSections,
    isComplete,
    totalScore,
    cefrLevel: isComplete ? toeflTotalToCefr(totalScore) : null,
    weakestSection,
    strongestSection,
  };
}

function summarizeErrorPatterns(errorPatterns: any[]) {
  return errorPatterns.slice(0, 8).map((pattern) => ({
    pattern: pattern.pattern,
    severity: pattern.severity,
    frequency: pattern.frequency,
    explanation: pattern.explanation,
  }));
}

function summarizeFlashcards(flashcards: any[]) {
  const mastered = flashcards.filter(
    (card) => String(card.status || '').toLowerCase() === 'mastered'
  ).length;

  const due = flashcards.filter((card) => {
    const status = String(card.status || '').toLowerCase();

    if (status === 'mastered') return false;
    if (card.next_review_at) return new Date(card.next_review_at) <= new Date();

    return ['new', 'learning', 'review', 'due'].includes(status);
  }).length;

  return {
    total: flashcards.length,
    mastered,
    due,
  };
}

function summarizeStudySessions(sessions: any[]) {
  const totalMinutes = sessions.reduce(
    (total, session) => total + safeNumber(session.duration_minutes),
    0
  );

  const byType = sessions.reduce((acc: Record<string, number>, session) => {
    const type = session.session_type || 'other';
    acc[type] = (acc[type] || 0) + safeNumber(session.duration_minutes);
    return acc;
  }, {});

  return {
    sessionsCount: sessions.length,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    byType,
  };
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

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizePlan(raw: any, context: any) {
  const activePhase = context.activePhase;
  const goal = context.goal;

  const days = normalizeArray(raw?.days)
    .slice(0, 7)
    .map((day: any, index) => ({
      day: String(day?.day || DAY_LABELS[index] || `Day ${index + 1}`),
      focus: String(day?.focus || activePhase?.focus || goal.priority || 'Balanced practice'),
      totalMinutes: safeNumber(day?.totalMinutes || 0),
      blocks: normalizeArray(day?.blocks)
        .slice(0, 6)
        .map((block: any, blockIndex) => ({
          id: String(block?.id || `block-${index + 1}-${blockIndex + 1}`),
          time: String(block?.time || 'Flexible'),
          title: String(block?.title || 'Focused practice'),
          type: String(block?.type || 'practice'),
          durationMinutes: safeNumber(block?.durationMinutes || 30),
          description: String(block?.description || 'Complete this study block.'),
          linkedTo: String(block?.linkedTo || activePhase?.title || 'Roadmap'),
        })),
    }));

  const normalizedDays =
    days.length === 7
      ? days
      : DAY_LABELS.map((label, index) => {
          const existing = days[index];

          return (
            existing || {
              day: label,
              focus: activePhase?.focus || goal.priority || 'Balanced practice',
              totalMinutes: 0,
              blocks: [],
            }
          );
        });

  return {
    weekTitle: String(
      raw?.weekTitle ||
        `${goal.target_exam === 'toefl_ibt' ? 'TOEFL' : 'Language'} Weekly Plan`
    ),
    summary: String(
      raw?.summary ||
        'This week follows the active Roadmap phase and focuses on the highest-priority weaknesses.'
    ),
    roadmapPhase: {
      id: String(activePhase?.id || raw?.roadmapPhase?.id || 'none'),
      title: String(activePhase?.title || raw?.roadmapPhase?.title || 'No active phase'),
      focus: String(activePhase?.focus || raw?.roadmapPhase?.focus || goal.priority),
    },
    priorities: normalizeArray(raw?.priorities)
      .slice(0, 5)
      .map((item: any) => String(item)),
    successCriteria: normalizeArray(raw?.successCriteria)
      .slice(0, 5)
      .map((item: any) => String(item)),
    days: normalizedDays,
    notes: String(
      raw?.notes ||
        'Regenerate the plan after generating a new Roadmap or changing your learning goal.'
    ),
  };
}

function buildFallbackPlan(context: any) {
  const goal = context.goal;
  const activePhase = context.activePhase;
  const latestToefl = context.latestToefl;
  const weakest = latestToefl?.weakestSection;
  const weeklyMinutes = safeNumber(goal.weekly_minutes || 600);
  const weekdayMinutes = Math.max(30, Math.round(weeklyMinutes / 7 / 15) * 15);

  const mainFocus = weakest
    ? `Improve ${weakest.label}`
    : activePhase?.focus || goal.priority || 'Balanced TOEFL practice';

  return {
    weekTitle: `${goal.target_exam === 'toefl_ibt' ? 'TOEFL' : 'Language'} Weekly Plan`,
    summary: `This week follows the active Roadmap phase: ${
      activePhase?.title || 'Roadmap phase'
    }. Main focus: ${mainFocus}.`,
    roadmapPhase: {
      id: activePhase?.id || 'none',
      title: activePhase?.title || 'No active phase',
      focus: activePhase?.focus || mainFocus,
    },
    priorities: [
      mainFocus,
      'Review due flashcards',
      'Use AI Tutor after each written or spoken response',
    ],
    successCriteria: [
      'Complete all scheduled blocks',
      'Generate at least one AI correction',
      'Review all due flashcards',
    ],
    days: DAY_LABELS.map((day, index) => ({
      day,
      focus:
        index === 0
          ? mainFocus
          : index === 1
          ? 'Error DNA review'
          : index === 2
          ? 'TOEFL section practice'
          : index === 3
          ? 'AI Tutor correction'
          : index === 4
          ? 'Flashcards and weak skill repair'
          : index === 5
          ? 'Longer TOEFL practice'
          : 'Review and reset',
      totalMinutes: weekdayMinutes,
      blocks: [
        {
          id: `${day.toLowerCase()}-1`,
          time: 'Flexible',
          title:
            index === 5
              ? 'Long TOEFL practice block'
              : index === 6
              ? 'Weekly review'
              : `Focused ${mainFocus} practice`,
          type: 'practice',
          durationMinutes: weekdayMinutes,
          description:
            index === 6
              ? 'Review your week, check Error DNA, and prepare the next plan.'
              : `Work on ${mainFocus}. Use the AI Tutor for correction after the block.`,
          linkedTo: activePhase?.title || 'Roadmap',
        },
      ],
    })),
    notes:
      'Fallback plan generated because the AI plan was unavailable. It still follows your Roadmap data.',
  };
}

function buildPrompt(context: any) {
  return `
You are Solang AI Weekly Plan Generator.

Create a 7-day weekly plan that follows the user's active Roadmap phase.

Return JSON only.

Context:
${JSON.stringify(context, null, 2)}

Rules:
- Weekly Plan = execution of the Roadmap.
- The active Roadmap phase is the main strategic source.
- Use TOEFL scores as the strongest evidence.
- Use Error DNA and flashcards to make the plan actionable.
- Keep the plan realistic for the user's weekly_minutes.
- Do not create huge days. Spread the workload across the week.
- If Listening or Speaking is weak, include focused blocks.
- If TOEFL profile is incomplete, include missing section completion.
- Each day should be compact enough for UI.
- Do not invent completed results.

Return this exact JSON shape:
{
  "weekTitle": "string",
  "summary": "string",
  "roadmapPhase": {
    "id": "string",
    "title": "string",
    "focus": "string"
  },
  "priorities": ["string"],
  "successCriteria": ["string"],
  "days": [
    {
      "day": "Monday",
      "focus": "string",
      "totalMinutes": 90,
      "blocks": [
        {
          "id": "string",
          "time": "string",
          "title": "string",
          "type": "listening | speaking | reading | writing | grammar | flashcards | review | exam | ai_tutor",
          "durationMinutes": 30,
          "description": "string",
          "linkedTo": "string"
        }
      ]
    }
  ],
  "notes": "string"
}
`;
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    const languageCode = String(body.languageCode || 'english').trim();
    const requestedWeekStart = body.weekStart
      ? new Date(body.weekStart)
      : getMondayDate();

    const weekStart = toDateOnly(getMondayDate(requestedWeekStart));

    if (!languageCode) {
      return new Response(JSON.stringify({ error: 'languageCode is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: savedGoal, error: goalError } = await supabase
      .from('learning_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('language_code', languageCode)
      .maybeSingle();

    if (goalError) {
      throw new Error(goalError.message || 'Failed to load learning goal.');
    }

    const goal = {
      ...DEFAULT_GOAL,
      ...(savedGoal || {}),
    };

    const { data: roadmap, error: roadmapError } = await supabase
      .from('learning_roadmaps')
      .select('*')
      .eq('user_id', user.id)
      .eq('language_code', languageCode)
      .eq('status', 'active')
      .maybeSingle();

    if (roadmapError) {
      throw new Error(roadmapError.message || 'Failed to load roadmap.');
    }

    const roadmapContent =
      roadmap?.content && typeof roadmap.content === 'object'
        ? roadmap.content
        : null;

    const activePhaseId = roadmapContent?.activePhaseId || roadmapContent?.phases?.[0]?.id || null;

    const activePhase =
      roadmapContent?.phases?.find((phase: any) => phase.id === activePhaseId) ||
      roadmapContent?.phases?.[0] ||
      null;

    const since60Days = new Date();
    since60Days.setDate(since60Days.getDate() - 60);

    const [
      sectionsResponse,
      errorPatternsResponse,
      flashcardsResponse,
      sessionsResponse,
    ] = await Promise.all([
      supabase
        .from('exam_attempt_sections')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .eq('exam_key', 'toefl_ibt')
        .eq('status', 'completed')
        .in('section_key', ['reading', 'listening', 'speaking', 'writing'])
        .order('completed_at', { ascending: false }),

      supabase
        .from('error_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .order('frequency', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(12),

      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode),

      supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .gte('created_at', since60Days.toISOString())
        .order('created_at', { ascending: false }),
    ]);

    if (sectionsResponse.error) throw new Error(sectionsResponse.error.message);
    if (errorPatternsResponse.error) throw new Error(errorPatternsResponse.error.message);
    if (flashcardsResponse.error) throw new Error(flashcardsResponse.error.message);
    if (sessionsResponse.error) throw new Error(sessionsResponse.error.message);

    const latestToefl = buildLatestToeflSnapshot(sectionsResponse.data || []);

    const context = {
      languageCode,
      weekStart,
      goal: {
        target_exam: goal.target_exam,
        target_level: goal.target_level,
        target_score: goal.target_score,
        deadline: goal.deadline,
        weekly_minutes: goal.weekly_minutes,
        priority: goal.priority,
      },
      roadmap: roadmapContent
        ? {
            id: roadmap.id,
            activePhaseId,
            activePhase,
            gapAnalysis: roadmapContent.gapAnalysis,
            recommendations: roadmapContent.recommendations,
          }
        : null,
      activePhase,
      latestToefl,
      errorPatterns: summarizeErrorPatterns(errorPatternsResponse.data || []),
      flashcards: summarizeFlashcards(flashcardsResponse.data || []),
      studySessions: summarizeStudySessions(sessionsResponse.data || []),
    };

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    let planContent;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(context),
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text?.trim() || '{}';
      const parsed = safeParseJson(rawText);

      planContent = normalizePlan(parsed, {
        goal,
        activePhase,
        latestToefl,
      });
    } catch (error) {
      console.error('AI weekly plan generation failed, using fallback:', error);

      planContent = buildFallbackPlan({
        goal,
        activePhase,
        latestToefl,
      });
    }

    const { data: weeklyPlan, error: weeklyPlanError } = await supabase
      .from('weekly_plans')
      .upsert(
        {
          user_id: user.id,
          language_code: languageCode,
          goal_id: savedGoal?.id || null,
          roadmap_id: roadmap?.id || null,
          week_start: weekStart,
          content: planContent,
          status: 'active',
          model: MODEL,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,language_code,week_start',
        }
      )
      .select('*')
      .single();

    if (weeklyPlanError) {
      throw new Error(weeklyPlanError.message || 'Failed to save weekly plan.');
    }

    return new Response(
      JSON.stringify({
        weeklyPlan,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AI Weekly Plan generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI Weekly Plan generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});