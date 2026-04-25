import { supabase } from '../supabase';

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to load profile.');
  }

  return data;
}

export async function updateMyProfile(userId, values) {
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update profile.');
  }

  return data;
}