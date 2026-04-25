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

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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

  const totalScore = Object.values(sectionScores).reduce((total: number, item: any) => {
    if (item.score === null) return total;
    return total + safeNumber(item.score);
  }, 0);

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

function severityWeight(severity: string) {
  const value = String(severity || '').toLowerCase();

  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

function summarizeErrorPatterns(errorPatterns: any[]) {
  return errorPatterns.slice(0, 8).map((pattern) => ({
    pattern: pattern.pattern,
    severity: pattern.severity,
    frequency: pattern.frequency,
    explanation: pattern.explanation,
    weightedLoad: safeNumber(pattern.frequency) * severityWeight(pattern.severity),
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

function normalizeRoadmap(raw: any, fallbackContext: any) {
  const goal = fallbackContext.goal;
  const latestToefl = fallbackContext.latestToefl;

  const fallbackCurrentLevel =
    latestToefl?.isComplete && latestToefl.cefrLevel
      ? latestToefl.cefrLevel
      : latestToefl?.completedSections > 0
      ? 'Incomplete'
      : 'Needs data';

  return {
    currentLevel: String(raw?.currentLevel || fallbackCurrentLevel),
    targetLevel: String(raw?.targetLevel || goal.target_level || 'C1'),
    targetExam: String(raw?.targetExam || goal.target_exam || 'toefl_ibt'),
    targetScore: safeNumber(raw?.targetScore || goal.target_score || 95),
    currentStatus: String(
      raw?.currentStatus ||
        (latestToefl?.isComplete
          ? `TOEFL ${latestToefl.totalScore}/120`
          : `${latestToefl?.completedSections || 0}/4 TOEFL sections completed`)
    ),
    activePhaseId: String(raw?.activePhaseId || 'phase-1'),
    gapAnalysis: {
      gap: String(raw?.gapAnalysis?.gap || 'Complete diagnostic first'),
      priority: String(raw?.gapAnalysis?.priority || 'Complete TOEFL sections'),
      recommendation: String(
        raw?.gapAnalysis?.recommendation ||
          'Complete all TOEFL sections to generate a more reliable roadmap.'
      ),
    },
    milestones: normalizeArray(raw?.milestones).slice(0, 6).map((item: any, index) => ({
      id: String(item?.id || `milestone-${index + 1}`),
      title: String(item?.title || `Milestone ${index + 1}`),
      status: ['completed', 'current', 'locked'].includes(String(item?.status))
        ? String(item.status)
        : 'locked',
      target: String(item?.target || 'Target not specified'),
      current: String(item?.current || 'Current state not specified'),
      description: String(item?.description || 'No description available.'),
    })),
    phases: normalizeArray(raw?.phases).slice(0, 6).map((item: any, index) => ({
      id: String(item?.id || `phase-${index + 1}`),
      title: String(item?.title || `Phase ${index + 1}`),
      duration: String(item?.duration || 'Flexible'),
      focus: String(item?.focus || 'Balanced improvement'),
      actions: normalizeArray(item?.actions)
        .slice(0, 6)
        .map((action: any) => String(action)),
    })),
    recommendations: normalizeArray(raw?.recommendations)
      .slice(0, 8)
      .map((item: any) => String(item)),
  };
}

function buildFallbackRoadmap(context: any) {
  const goal = context.goal;
  const latestToefl = context.latestToefl;
  const weakest = latestToefl?.weakestSection;
  const targetScore = safeNumber(goal.target_score || 95);
  const scoreGap =
    latestToefl?.isComplete && latestToefl.totalScore
      ? Math.max(0, targetScore - latestToefl.totalScore)
      : null;

  return {
    currentLevel:
      latestToefl?.isComplete && latestToefl.cefrLevel
        ? latestToefl.cefrLevel
        : latestToefl?.completedSections > 0
        ? 'Incomplete'
        : 'Needs data',
    targetLevel: goal.target_level,
    targetExam: goal.target_exam,
    targetScore,
    currentStatus: latestToefl?.isComplete
      ? `TOEFL ${latestToefl.totalScore}/120`
      : `${latestToefl?.completedSections || 0}/4 TOEFL sections completed`,
    activePhaseId: latestToefl?.isComplete ? 'phase-2' : 'phase-1',
    gapAnalysis: {
      gap:
        scoreGap === null
          ? 'Incomplete TOEFL diagnostic'
          : scoreGap > 0
          ? `${scoreGap} TOEFL points away from target`
          : 'Target score reached',
      priority: weakest ? `Improve ${weakest.label}` : 'Complete TOEFL diagnostic',
      recommendation: weakest
        ? `Your weakest section is ${weakest.label} at ${weakest.score}/30. Prioritise it in the Weekly Plan.`
        : 'Complete all TOEFL sections to identify the main weakness.',
    },
    milestones: [
      {
        id: 'diagnostic',
        title: 'Complete TOEFL diagnostic',
        status: latestToefl?.isComplete ? 'completed' : 'current',
        target: '4/4 sections completed',
        current: `${latestToefl?.completedSections || 0}/4 sections`,
        description:
          'Complete Reading, Listening, Speaking, and Writing to create a reliable baseline.',
      },
      {
        id: 'weakest-skill',
        title: 'Repair weakest section',
        status: weakest ? 'current' : 'locked',
        target: 'Bring weakest section above intermediate threshold',
        current: weakest ? `${weakest.label}: ${weakest.score}/30` : 'No weakness detected yet',
        description:
          'Focus the next weeks on the section that currently limits the global score.',
      },
      {
        id: 'balanced-profile',
        title: 'Build a balanced TOEFL profile',
        status: 'locked',
        target: 'No section far behind the others',
        current: 'Pending',
        description:
          'Avoid relying only on strong sections. The goal is stable performance across all skills.',
      },
      {
        id: 'target-score',
        title: `Reach ${goal.target_level}`,
        status: latestToefl?.totalScore >= targetScore ? 'completed' : 'locked',
        target: `${targetScore}/120`,
        current: latestToefl?.isComplete ? `${latestToefl.totalScore}/120` : 'Incomplete',
        description:
          'Reach the selected TOEFL target score and keep section scores balanced.',
      },
    ],
    phases: [
      {
        id: 'phase-1',
        title: 'Phase 1 · Complete and verify the baseline',
        duration: 'Now → 2 weeks',
        focus: 'Finish missing TOEFL sections and confirm score reliability',
        actions: [
          'Complete all four TOEFL sections.',
          'Check if any 0/30 score is a real result or a technical issue.',
          'Use results to identify the weakest section.',
        ],
      },
      {
        id: 'phase-2',
        title: 'Phase 2 · Repair the weakest section',
        duration: '2 → 6 weeks',
        focus: weakest ? `Priority: ${weakest.label}` : `Priority: ${goal.priority}`,
        actions: [
          'Repeat the weakest TOEFL section every week.',
          'Use AI Tutor after each attempt.',
          'Generate flashcards from recurring Error DNA patterns.',
        ],
      },
      {
        id: 'phase-3',
        title: `Phase 3 · Build toward ${goal.target_level}`,
        duration: '6 → 10 weeks',
        focus: 'Reduce skill imbalance and stabilise performance',
        actions: [
          'Keep strong skills active with maintenance practice.',
          'Increase practice time on weak sections.',
          'Track progress in Analytics.',
        ],
      },
      {
        id: 'phase-4',
        title: 'Phase 4 · Exam performance push',
        duration: '10+ weeks',
        focus: `Target TOEFL score: ${targetScore}/120`,
        actions: [
          'Complete full TOEFL simulations.',
          'Analyse every section score after each full attempt.',
          'Use Weekly Plan for targeted revision.',
        ],
      },
    ],
    recommendations: [
      'Generate the Weekly Plan from the active Roadmap phase.',
      'Prioritise TOEFL sections that are below the target threshold.',
      'Keep Error DNA and flashcards connected to exam results.',
    ],
  };
}

function buildPrompt(context: any) {
  return `
You are Solang AI Roadmap Generator.

Create a personalised long-term English learning roadmap.

Return JSON only.

Context:
${JSON.stringify(context, null, 2)}

Rules:
- The user chooses the target. Do not change the target.
- Roadmap = long-term strategy.
- Weekly Plan = short-term execution, so phases must be usable by Weekly Plan later.
- Use TOEFL results as the strongest evidence.
- If TOEFL profile is incomplete, the first phase must focus on completing the diagnostic.
- If a section has 0/30, mention that it may need verification if it could be technical.
- Be practical and specific.
- Do not invent completed exam results.
- Keep output concise enough for UI cards.

Return this exact JSON shape:
{
  "currentLevel": "string",
  "targetLevel": "string",
  "targetExam": "string",
  "targetScore": 95,
  "currentStatus": "string",
  "activePhaseId": "phase-1",
  "gapAnalysis": {
    "gap": "string",
    "priority": "string",
    "recommendation": "string"
  },
  "milestones": [
    {
      "id": "string",
      "title": "string",
      "status": "completed | current | locked",
      "target": "string",
      "current": "string",
      "description": "string"
    }
  ],
  "phases": [
    {
      "id": "string",
      "title": "string",
      "duration": "string",
      "focus": "string",
      "actions": ["string"]
    }
  ],
  "recommendations": ["string"]
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
      goal: {
        target_exam: goal.target_exam,
        target_level: goal.target_level,
        target_score: goal.target_score,
        deadline: goal.deadline,
        weekly_minutes: goal.weekly_minutes,
        priority: goal.priority,
      },
      latestToefl,
      errorPatterns: summarizeErrorPatterns(errorPatternsResponse.data || []),
      flashcards: summarizeFlashcards(flashcardsResponse.data || []),
      studySessions: summarizeStudySessions(sessionsResponse.data || []),
    };

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    let roadmapContent;

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

      roadmapContent = normalizeRoadmap(parsed, {
        goal,
        latestToefl,
      });
    } catch (error) {
      console.error('AI roadmap generation failed, using fallback:', error);

      roadmapContent = buildFallbackRoadmap({
        goal,
        latestToefl,
      });
    }

    const { data: roadmap, error: roadmapError } = await supabase
      .from('learning_roadmaps')
      .upsert(
        {
          user_id: user.id,
          language_code: languageCode,
          goal_id: savedGoal?.id || null,
          target_exam: goal.target_exam,
          target_level: goal.target_level,
          target_score: safeNumber(goal.target_score),
          content: roadmapContent,
          status: 'active',
          model: MODEL,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,language_code',
        }
      )
      .select('*')
      .single();

    if (roadmapError) {
      throw new Error(roadmapError.message || 'Failed to save roadmap.');
    }

    return new Response(
      JSON.stringify({
        roadmap,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AI Roadmap generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI Roadmap generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});