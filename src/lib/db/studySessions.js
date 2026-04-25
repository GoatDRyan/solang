import { supabase } from '../supabase';

export async function getStudySessionsByLanguage(userId, languageCode) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load study sessions.');
  }

  return data ?? [];
}

export async function createStudySession(userId, values) {
  const payload = {
    user_id: userId,
    language_code: values.language_code,
    session_type: values.session_type,
    title: values.title || null,
    duration_minutes: Number(values.duration_minutes) || 0,
    started_at: values.started_at || null,
    ended_at: values.ended_at || null,
    notes: values.notes || null,
    metadata: values.metadata || {},
  };

  const { data, error } = await supabase
    .from('study_sessions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create study session.');
  }

  return data;
}

export async function deleteStudySession(sessionId, userId) {
  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to delete study session.');
  }

  return true;
}