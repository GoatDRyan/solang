import { supabase } from '../supabase';

export async function getResourcesByLanguage(userId, languageCode) {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load resources.');
  }

  return data ?? [];
}

export async function createResource(userId, values) {
  const payload = {
    user_id: userId,
    language_code: values.language_code,
    title: values.title,
    url: values.url || null,
    resource_type: values.resource_type || 'other',
    provider: values.provider || null,
    notes: values.notes || null,
  };

  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create resource.');
  }

  return data;
}

export async function deleteResource(resourceId, userId) {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', resourceId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to delete resource.');
  }

  return true;
}