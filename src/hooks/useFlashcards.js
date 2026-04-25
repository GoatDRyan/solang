import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  deleteFlashcard,
  generateFlashcardsFromErrorPatterns,
  getFlashcardsByLanguage,
  reviewFlashcard,
} from '../lib/db/flashcards';

function isCardDue(card) {
  if (!card?.due_at) return true;
  return new Date(card.due_at).getTime() <= Date.now();
}

export function useFlashcards(languageCode) {
  const { user, isAuthenticated } = useAuth();

  const [flashcards, setFlashcards] = useState([]);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState('');

  const refreshFlashcards = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !languageCode) {
      setFlashcards([]);
      setIsFlashcardsLoading(false);
      return;
    }

    setIsFlashcardsLoading(true);
    setFlashcardsError('');

    try {
      const data = await getFlashcardsByLanguage(user.id, languageCode);
      setFlashcards(data);
    } catch (error) {
      setFlashcardsError(error.message || 'Failed to load flashcards.');
    } finally {
      setIsFlashcardsLoading(false);
    }
  }, [isAuthenticated, user?.id, languageCode]);

  const generateFromPatterns = useCallback(
    async (patterns) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      if (!languageCode) {
        throw new Error('Missing active language.');
      }

      setIsGenerating(true);
      setFlashcardsError('');

      try {
        const created = await generateFlashcardsFromErrorPatterns({
          userId: user.id,
          languageCode,
          patterns,
        });

        if (created.length > 0) {
          setFlashcards((prev) => [...created, ...prev]);
        }

        return created;
      } catch (error) {
        setFlashcardsError(error.message || 'Failed to generate flashcards.');
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [user?.id, languageCode]
  );

  const reviewCard = useCallback(async (card, wasCorrect) => {
    const updated = await reviewFlashcard(card, wasCorrect);

    setFlashcards((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

    return updated;
  }, []);

  const removeFlashcard = useCallback(
    async (cardId) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      await deleteFlashcard(cardId, user.id);
      setFlashcards((prev) => prev.filter((card) => card.id !== cardId));
    },
    [user?.id]
  );

  useEffect(() => {
    refreshFlashcards();
  }, [refreshFlashcards]);

  const dueFlashcards = useMemo(
    () =>
      flashcards.filter(
        (card) => card.status !== 'mastered' && isCardDue(card)
      ),
    [flashcards]
  );

  const learningFlashcards = useMemo(
    () => flashcards.filter((card) => card.status === 'learning'),
    [flashcards]
  );

  const masteredFlashcards = useMemo(
    () => flashcards.filter((card) => card.status === 'mastered'),
    [flashcards]
  );

  const stats = useMemo(
    () => ({
      total: flashcards.length,
      due: dueFlashcards.length,
      learning: learningFlashcards.length,
      mastered: masteredFlashcards.length,
    }),
    [flashcards.length, dueFlashcards.length, learningFlashcards.length, masteredFlashcards.length]
  );

  return {
    flashcards,
    dueFlashcards,
    learningFlashcards,
    masteredFlashcards,
    stats,
    isFlashcardsLoading,
    isGenerating,
    flashcardsError,
    refreshFlashcards,
    generateFromPatterns,
    reviewCard,
    removeFlashcard,
  };
}