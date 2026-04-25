import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function formatQuestionType(type: string) {
  return String(type || 'question')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizePatternKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function getReadingLevel(score: number) {
  if (score >= 24) return 'Advanced';
  if (score >= 18) return 'High-Intermediate';
  if (score >= 4) return 'Low-Intermediate';
  return 'Below Low-Intermediate';
}

function getAllQuestions(content: any) {
  const passages = content?.content?.passages || [];

  return passages.flatMap((passage: any) =>
    (passage.questions || []).map((question: any) => ({
      ...question,
      passageId: passage.id,
      passageTitle: passage.title,
    }))
  );
}

function scoreQuestion(question: any, userAnswer: any) {
  if (question.answerMode === 'multi_select') {
    const selected = Array.isArray(userAnswer) ? userAnswer : [];
    const correctAnswers = Array.isArray(question.correctAnswers)
      ? question.correctAnswers
      : [];

    const selectedSet = new Set(selected);
    const correctSet = new Set(correctAnswers);

    const correctSelected = selected.filter((answer) => correctSet.has(answer));
    const wrongSelected = selected.filter((answer) => !correctSet.has(answer));

    let points = 0;

    if (correctSelected.length === 3 && wrongSelected.length === 0) {
      points = 2;
    } else if (correctSelected.length === 2 && wrongSelected.length === 0) {
      points = 1;
    }

    return {
      questionId: question.id,
      type: question.type,
      userAnswer: selected,
      correctAnswer: correctAnswers,
      isCorrect: points === 2,
      points,
      maxPoints: 2,
      explanation: question.explanation || '',
    };
  }

  const expected = String(question.correctAnswer || '').trim();
  const received = String(userAnswer || '').trim();

  const isCorrect = expected && received === expected;

  return {
    questionId: question.id,
    type: question.type,
    userAnswer: received || null,
    correctAnswer: expected,
    isCorrect,
    points: isCorrect ? 1 : 0,
    maxPoints: 1,
    explanation: question.explanation || '',
  };
}

function buildBreakdown(questionResults: any[]) {
  const map = new Map();

  questionResults.forEach((result) => {
    const previous = map.get(result.type) || {
      type: result.type,
      label: formatQuestionType(result.type),
      points: 0,
      maxPoints: 0,
      correct: 0,
      total: 0,
    };

    previous.points += result.points;
    previous.maxPoints += result.maxPoints;
    previous.correct += result.points === result.maxPoints ? 1 : 0;
    previous.total += 1;

    map.set(result.type, previous);
  });

  return [...map.values()].map((item) => ({
    ...item,
    accuracy:
      item.maxPoints > 0 ? Math.round((item.points / item.maxPoints) * 100) : 0,
  }));
}

async function saveReadingWeaknessPatterns({
  supabase,
  userId,
  breakdown,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  breakdown: any[];
}) {
  try {
    const weakAreas = breakdown.filter((item) => item.accuracy < 70);

    for (const area of weakAreas.slice(0, 3)) {
      const pattern = `TOEFL Reading: ${area.label}`;
      const patternKey = normalizePatternKey(pattern);
      const severity =
        area.accuracy < 40 ? 'high' : area.accuracy < 60 ? 'medium' : 'low';

      const explanation = `This exam skill needs practice. You scored ${area.points}/${area.maxPoints} in ${area.label} questions.`;

      const { data: existing } = await supabase
        .from('error_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('language_code', 'english')
        .eq('pattern_key', patternKey)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('error_patterns')
          .update({
            frequency: Number(existing.frequency || 1) + 1,
            severity,
            explanation,
            source: 'toefl_reading',
            last_seen_at: new Date().toISOString(),
            metadata: {
              ...(existing.metadata || {}),
              latest_accuracy: area.accuracy,
              latest_points: area.points,
              latest_max_points: area.maxPoints,
            },
          })
          .eq('id', existing.id)
          .eq('user_id', userId);
      } else {
        await supabase.from('error_patterns').insert({
          user_id: userId,
          language_code: 'english',
          pattern_key: patternKey,
          pattern,
          explanation,
          example_wrong: null,
          example_correct: null,
          severity,
          frequency: 1,
          source: 'toefl_reading',
          last_seen_at: new Date().toISOString(),
          metadata: {
            latest_accuracy: area.accuracy,
            latest_points: area.points,
            latest_max_points: area.maxPoints,
          },
        });
      }
    }
  } catch (error) {
    console.warn('Could not save TOEFL Reading Error DNA patterns.', error);
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

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    const authorization = req.headers.get('Authorization') || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
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
    const sectionId = String(body.sectionId || '').trim();
    const answers = body.answers || {};

    if (!sectionId) {
      return new Response(JSON.stringify({ error: 'sectionId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: section, error: sectionError } = await supabase
      .from('exam_attempt_sections')
      .select('*')
      .eq('id', sectionId)
      .eq('user_id', user.id)
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'Section not found.');
    }

    const questions = getAllQuestions(section.content);
    const questionResults = questions.map((question: any) =>
      scoreQuestion(question, answers[question.id])
    );

    const rawPoints = questionResults.reduce(
      (sum: number, item: any) => sum + item.points,
      0
    );

    const maxRawPoints = questionResults.reduce(
      (sum: number, item: any) => sum + item.maxPoints,
      0
    );

    const correctCount = questionResults.filter((item: any) => item.isCorrect).length;
    const estimatedScore =
      maxRawPoints > 0 ? Math.round((rawPoints / maxRawPoints) * 30) : 0;

    const breakdown = buildBreakdown(questionResults);

    const result = {
      section: 'Reading',
      estimatedScore,
      scoreLabel: getReadingLevel(estimatedScore),
      rawPoints,
      maxRawPoints,
      correctCount,
      totalQuestions: questions.length,
      breakdown,
      questionResults,
      feedback:
        estimatedScore >= 24
          ? 'Strong TOEFL Reading performance. Focus on speed and consistency.'
          : estimatedScore >= 18
          ? 'Good base. Improve weaker question types and timing.'
          : 'Prioritise passage mapping, vocabulary in context, and inference questions.',
      evaluatedAt: new Date().toISOString(),
    };

    const now = new Date().toISOString();

    const { error: updateSectionError } = await supabase
      .from('exam_attempt_sections')
      .update({
        answers,
        result,
        score: estimatedScore,
        status: 'completed',
        completed_at: now,
      })
      .eq('id', section.id)
      .eq('user_id', user.id);

    if (updateSectionError) throw new Error(updateSectionError.message);

    const { error: updateAttemptError } = await supabase
      .from('exam_attempts')
      .update({
        total_score: estimatedScore,
        result,
        status: 'completed',
        completed_at: now,
      })
      .eq('id', section.attempt_id)
      .eq('user_id', user.id);

    if (updateAttemptError) throw new Error(updateAttemptError.message);

    await saveReadingWeaknessPatterns({
      supabase,
      userId: user.id,
      breakdown,
    });

    await supabase.from('study_sessions').insert({
      user_id: user.id,
      language_code: 'english',
      title: 'TOEFL iBT Reading Practice',
      session_type: 'reading',
      duration_minutes: 35,
      notes: `TOEFL Reading estimated score: ${estimatedScore}/30. Raw score: ${rawPoints}/${maxRawPoints}.`,
      started_at: now,
    });

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Reading evaluation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});