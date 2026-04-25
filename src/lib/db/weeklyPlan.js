import { supabase } from '../supabase';

function getWeekStartKey(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);

  return copy.toISOString().slice(0, 10);
}

export async function getCurrentWeeklyPlan(userId, languageCode) {
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .eq('week_start', getWeekStartKey())
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load weekly plan.');
  }

  return data || null;
}

export async function getWeeklyPlanBlocks(planId) {
  if (!planId) return [];

  const { data, error } = await supabase
    .from('weekly_plan_blocks')
    .select('*')
    .eq('plan_id', planId)
    .order('scheduled_date', { ascending: true })
    .order('position', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load weekly plan blocks.');
  }

  return data ?? [];
}

export async function generateWeeklyPlan({
  languageCode,
  objective,
  mode,
  intensity,
  availability,
}) {
  const { data, error } = await supabase.functions.invoke('ai-weekly-plan', {
    body: {
      languageCode,
      objective,
      mode,
      intensity,
      availability,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate weekly plan.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    plan: data.plan,
    blocks: data.blocks || [],
  };
}

export async function completeWeeklyPlanBlock(block) {
  const now = new Date().toISOString();

  const { data: updatedBlock, error: blockError } = await supabase
    .from('weekly_plan_blocks')
    .update({
      status: 'completed',
      completed_at: now,
    })
    .eq('id', block.id)
    .eq('user_id', block.user_id)
    .select('*')
    .single();

  if (blockError) {
    throw new Error(blockError.message || 'Failed to complete weekly block.');
  }

  const { error: sessionError } = await supabase.from('study_sessions').insert({
    user_id: block.user_id,
    language_code: block.language_code,
    title: block.title,
    session_type: block.block_type,
    duration_minutes: block.duration_minutes,
    notes: block.instructions,
    started_at: now,
  });

  if (sessionError) {
    throw new Error(
      sessionError.message || 'Weekly block completed, but session log failed.'
    );
  }

  const blocks = await getWeeklyPlanBlocks(block.plan_id);
  const allFinished =
    blocks.length > 0 &&
    blocks.every((item) => item.status === 'completed' || item.status === 'skipped');

  if (allFinished) {
    await supabase
      .from('weekly_plans')
      .update({
        status: 'completed',
        completed_at: now,
      })
      .eq('id', block.plan_id)
      .eq('user_id', block.user_id);
  }

  return updatedBlock;
}

export async function skipWeeklyPlanBlock(block) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('weekly_plan_blocks')
    .update({
      status: 'skipped',
      completed_at: now,
    })
    .eq('id', block.id)
    .eq('user_id', block.user_id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to skip weekly block.');
  }

  return data;
}