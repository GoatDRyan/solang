import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeAnswer(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function flattenQuestions(sectionContent: any) {
  const items = sectionContent?.content?.items || [];

  return items.flatMap((item: any) =>
    (item.questions || []).map((question: any) => ({
      ...question,
      itemId: item.id,
      itemTitle: item.title,
      audioType: item.audioType,
    }))
  );
}

function scoreToLevel(score: number) {
  if (score >= 22) return 'Advanced';
  if (score >= 17) return 'High-Intermediate';
  if (score >= 9) return 'Low-Intermediate';
  return 'Below Low-Intermediate';
}

function normalizePatternKey(pattern: string) {
  return pattern
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function formatQuestionType(type: string) {
  return String(type || 'question')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function updateExamWeaknessPatterns({
  supabaseAdmin,
  userId,
  missedQuestions,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  missedQuestions: any[];
}) {
  const grouped = missedQuestions.reduce(
    (acc: Record<string, any[]>, question) => {
      const type = question.type || 'listening_question';
      acc[type] = acc[type] || [];
      acc[type].push(question);
      return acc;
    },
    {}
  );

  for (const [questionType, questions] of Object.entries(grouped)) {
    const label = formatQuestionType(questionType);
    const pattern = `TOEFL Listening weakness: ${label}`;
    const patternKey = normalizePatternKey(pattern);

    const severity =
      questions.length >= 3 ? 'high' : questions.length === 2 ? 'medium' : 'low';

    const explanation = `You missed ${questions.length} TOEFL Listening ${label} question${
      questions.length > 1 ? 's' : ''
    }. This question type should be reviewed.`;

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
          frequency: Number(existing.frequency || 1) + questions.length,
          severity,
          explanation,
          source: 'official_exam',
          last_seen_at: new Date().toISOString(),
          metadata: {
            ...(existing.metadata || {}),
            exam_key: 'toefl_ibt',
            section_key: 'listening',
            question_type: questionType,
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
        pattern,
        explanation,
        example_wrong: null,
        example_correct: null,
        severity,
        frequency: questions.length,
        source: 'official_exam',
        last_seen_at: new Date().toISOString(),
        metadata: {
          exam_key: 'toefl_ibt',
          section_key: 'listening',
          question_type: questionType,
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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
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
      .eq('section_key', 'listening')
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'TOEFL Listening section not found.');
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

    const questions = flattenQuestions(section.content);

    const details = questions.map((question: any) => {
      const selected = normalizeAnswer(answers[question.id]);
      const correct = normalizeAnswer(question.answer);
      const isCorrect = selected === correct;

      return {
        id: question.id,
        itemId: question.itemId,
        itemTitle: question.itemTitle,
        audioType: question.audioType,
        type: question.type,
        question: question.question,
        selectedAnswer: selected || null,
        correctAnswer: correct,
        isCorrect,
        explanation: question.explanation || '',
      };
    });

    const rawScore = details.filter((item) => item.isCorrect).length;
    const maxRawScore = details.length;
    const scaledScore =
      maxRawScore > 0 ? Math.round((rawScore / maxRawScore) * 30) : 0;

    const missedQuestions = details.filter((item) => !item.isCorrect);

    const result = {
      section: 'listening',
      rawScore,
      maxRawScore,
      scaledScore,
      level: scoreToLevel(scaledScore),
      details,
      completedAt: new Date().toISOString(),
    };

    const { data: updatedSection, error: updateSectionError } =
      await supabaseAdmin
        .from('exam_attempt_sections')
        .update({
          status: 'completed',
          completed_at: result.completedAt,
          answers,
          score: scaledScore,
          result,
          metadata: {
            ...(section.metadata || {}),
            result,
          },
        })
        .eq('id', sectionId)
        .eq('user_id', user.id)
        .select('*')
        .single();

    if (updateSectionError) {
      throw new Error(
        updateSectionError.message || 'Failed to save TOEFL Listening result.'
      );
    }

    const { error: updateAttemptError } = await supabaseAdmin
      .from('exam_attempts')
      .update({
        status: 'completed',
        completed_at: result.completedAt,
        total_score: scaledScore,
        result,
        metadata: {
          ...(section.metadata || {}),
          completed_section: 'listening',
          result,
        },
      })
      .eq('id', section.attempt_id)
      .eq('user_id', user.id);

    if (updateAttemptError) {
      throw new Error(
        updateAttemptError.message || 'Failed to update TOEFL attempt.'
      );
    }

    await updateExamWeaknessPatterns({
      supabaseAdmin,
      userId: user.id,
      missedQuestions,
    });

    await supabaseAdmin.from('study_sessions').insert({
      user_id: user.id,
      language_code: 'english',
      title: 'TOEFL iBT Listening Practice',
      session_type: 'listening',
      duration_minutes: 36,
      notes: `TOEFL Listening estimated score: ${scaledScore}/30. Raw score: ${rawScore}/${maxRawScore}.`,
      started_at: result.completedAt,
    });

    return new Response(JSON.stringify({ result, section: updatedSection }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('TOEFL Listening evaluation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Listening evaluation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});