import { supabase } from '../supabase';

export async function getMyLanguages(userId) {
  const { data, error } = await supabase
    .from('user_languages')
    .select('*')
    .eq('user_id', userId)
    .order('language_code', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load user languages.');
  }

  return data ?? [];
}

export async function setActiveLanguage(userId, languageCode) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ active_language: languageCode })
    .eq('id', userId)
    .select('id, active_language')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update active language.');
  }

  return data;
}

export async function setLanguageEnabled(userId, languageCode, isEnabled) {
  const { data, error } = await supabase
    .from('user_languages')
    .update({ is_enabled: isEnabled })
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update language.');
  }

  return data;
}