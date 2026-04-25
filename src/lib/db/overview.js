import { supabase } from '../supabase';

export async function getOverviewData(userId, languageCode) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: sessions, error: sessionsError } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (sessionsError) {
    throw new Error(sessionsError.message || 'Failed to load overview sessions.');
  }

  const { count: resourcesCount, error: resourcesError } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('language_code', languageCode);

  if (resourcesError) {
    throw new Error(resourcesError.message || 'Failed to load resources count.');
  }

  return {
    sessions: sessions ?? [],
    resourcesCount: resourcesCount ?? 0,
  };
}