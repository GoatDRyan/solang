import { supabase } from '../supabase';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function buildFlashcardFromErrorPattern(userId, languageCode, pattern) {
  const front = pattern.example_wrong
    ? `Correct this sentence:\n\n${pattern.example_wrong}`
    : `What is the correct rule for this recurring mistake?\n\n${pattern.pattern}`;

  const backParts = [];

  if (pattern.example_correct) {
    backParts.push(`Correct version:\n${pattern.example_correct}`);
  }

  if (pattern.explanation) {
    backParts.push(`Explanation:\n${pattern.explanation}`);
  }

  backParts.push(`Pattern:\n${pattern.pattern}`);

  return {
    user_id: userId,
    language_code: languageCode,
    front,
    back: backParts.join('\n\n'),
    source_type: 'error_pattern',
    source_id: pattern.id,
    status: 'due',
    due_at: new Date().toISOString(),
    review_count: 0,
    correct_count: 0,
    wrong_count: 0,
    metadata: {
      severity: pattern.severity,
      frequency: pattern.frequency,
    },
  };
}

export async function getFlashcardsByLanguage(userId, languageCode) {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .order('due_at', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load flashcards.');
  }

  return data ?? [];
}

export async function createFlashcard(userId, values) {
  const payload = {
    user_id: userId,
    language_code: values.language_code,
    front: values.front,
    back: values.back,
    source_type: values.source_type || 'manual',
    source_id: values.source_id || null,
    status: values.status || 'due',
    due_at: values.due_at || new Date().toISOString(),
    review_count: Number(values.review_count) || 0,
    correct_count: Number(values.correct_count) || 0,
    wrong_count: Number(values.wrong_count) || 0,
    metadata: values.metadata || {},
  };

  const { data, error } = await supabase
    .from('flashcards')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create flashcard.');
  }

  return data;
}

export async function generateFlashcardsFromErrorPatterns({
  userId,
  languageCode,
  patterns,
}) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return [];
  }

  const { data: existingCards, error: existingError } = await supabase
    .from('flashcards')
    .select('source_id')
    .eq('user_id', userId)
    .eq('language_code', languageCode)
    .eq('source_type', 'error_pattern');

  if (existingError) {
    throw new Error(existingError.message || 'Failed to check existing flashcards.');
  }

  const existingSourceIds = new Set(
    (existingCards || []).map((card) => card.source_id).filter(Boolean)
  );

  const cardsToCreate = patterns
    .filter((pattern) => pattern?.id && !existingSourceIds.has(pattern.id))
    .map((pattern) => buildFlashcardFromErrorPattern(userId, languageCode, pattern));

  if (cardsToCreate.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('flashcards')
    .insert(cardsToCreate)
    .select('*');

  if (error) {
    throw new Error(error.message || 'Failed to generate flashcards.');
  }

  return data ?? [];
}

export async function reviewFlashcard(card, wasCorrect) {
  const now = new Date();
  const nextReviewCount = Number(card.review_count || 0) + 1;
  const nextCorrectCount = Number(card.correct_count || 0) + (wasCorrect ? 1 : 0);
  const nextWrongCount = Number(card.wrong_count || 0) + (wasCorrect ? 0 : 1);

  let nextStatus = 'due';
  let nextDueAt = addHours(now, 12);

  if (wasCorrect) {
    if (nextCorrectCount >= 5) {
      nextStatus = 'mastered';
      nextDueAt = addDays(now, 30);
    } else if (nextCorrectCount >= 4) {
      nextStatus = 'learning';
      nextDueAt = addDays(now, 14);
    } else if (nextCorrectCount >= 3) {
      nextStatus = 'learning';
      nextDueAt = addDays(now, 7);
    } else if (nextCorrectCount >= 2) {
      nextStatus = 'learning';
      nextDueAt = addDays(now, 3);
    } else {
      nextStatus = 'learning';
      nextDueAt = addDays(now, 1);
    }
  }

  const { data, error } = await supabase
    .from('flashcards')
    .update({
      status: nextStatus,
      due_at: nextDueAt.toISOString(),
      review_count: nextReviewCount,
      correct_count: nextCorrectCount,
      wrong_count: nextWrongCount,
      last_reviewed_at: now.toISOString(),
    })
    .eq('id', card.id)
    .eq('user_id', card.user_id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to review flashcard.');
  }

  return data;
}

export async function deleteFlashcard(cardId, userId) {
  const { error } = await supabase
    .from('flashcards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Failed to delete flashcard.');
  }

  return true;
}