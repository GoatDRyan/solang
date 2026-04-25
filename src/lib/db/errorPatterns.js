import { supabase } from '../supabase';

export async function getErrorPatternsByLanguage(userId, languageCode) {
  const { data, error } = await supabase
    .from('error_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .order('frequency', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load error patterns.');
  }

  return data ?? [];
}

export async function createErrorPattern(userId, values) {
  const payload = {
    user_id: userId,
    language_code: values.language_code,
    pattern: values.pattern,
    explanation: values.explanation || null,
    example_wrong: values.example_wrong || null,
    example_correct: values.example_correct || null,
    severity: values.severity || 'medium',
    frequency: Number(values.frequency) || 1,
    source: values.source || 'manual',
    last_seen_at: new Date().toISOString(),
    metadata: values.metadata || {},
  };

  const { data, error } = await supabase
    .from('error_patterns')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create error pattern.');
  }

  return data;
}

export async function deleteErrorPattern(patternId, userId) {
  const { error } = await supabase
    .from('error_patterns')
    .delete()
    .eq('id', patternId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to delete error pattern.');
  }

  return true;
}