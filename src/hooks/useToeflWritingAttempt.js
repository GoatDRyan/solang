import { useCallback, useEffect, useState } from 'react';
import { getExamAttemptWithSections } from '../lib/db/toeflExam';

export function useToeflWritingAttempt(attemptId) {
  const [attempt, setAttempt] = useState(null);
  const [section, setSection] = useState(null);
  const [isAttemptLoading, setIsAttemptLoading] = useState(true);
  const [attemptError, setAttemptError] = useState('');

  const refreshAttempt = useCallback(async () => {
    if (!attemptId) {
      setAttempt(null);
      setSection(null);
      setIsAttemptLoading(false);
      return;
    }

    setIsAttemptLoading(true);
    setAttemptError('');

    try {
      const data = await getExamAttemptWithSections(attemptId);

      const writingSection =
        data.sections.find((item) => item.section_key === 'writing') ||
        data.sections[0] ||
        null;

      setAttempt(data.attempt);
      setSection(writingSection);
    } catch (error) {
      setAttemptError(error.message || 'Failed to load TOEFL Writing attempt.');
    } finally {
      setIsAttemptLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    refreshAttempt();
  }, [refreshAttempt]);

  return {
    attempt,
    section,
    isAttemptLoading,
    attemptError,
    refreshAttempt,
  };
}