import { supabase } from '../supabase';

export async function getAiConversations(userId, languageCode) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load AI conversations.');
  }

  return data ?? [];
}

export async function getAiMessages(conversationId) {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load AI messages.');
  }

  return data ?? [];
}

export async function sendAiTutorMessage({
  conversationId,
  languageCode,
  mode,
  message,
}) {
  const { data, error } = await supabase.functions.invoke('ai-tutor', {
    body: {
      conversationId,
      languageCode,
      mode,
      message,
    },
  });

  if (error) {
    throw new Error(error.message || 'AI Tutor request failed.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}