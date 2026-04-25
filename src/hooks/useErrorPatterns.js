import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  createErrorPattern,
  deleteErrorPattern,
  getErrorPatternsByLanguage,
} from '../lib/db/errorPatterns';

export function useErrorPatterns(languageCode) {
  const { user, isAuthenticated } = useAuth();

  const [patterns, setPatterns] = useState([]);
  const [isPatternsLoading, setIsPatternsLoading] = useState(true);
  const [patternsError, setPatternsError] = useState('');

  const refreshPatterns = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !languageCode) {
      setPatterns([]);
      setIsPatternsLoading(false);
      return;
    }

    setIsPatternsLoading(true);
    setPatternsError('');

    try {
      const data = await getErrorPatternsByLanguage(user.id, languageCode);
      setPatterns(data);
    } catch (error) {
      setPatternsError(error.message || 'Failed to load error patterns.');
    } finally {
      setIsPatternsLoading(false);
    }
  }, [isAuthenticated, user?.id, languageCode]);

  const addPattern = useCallback(
    async (values) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const created = await createErrorPattern(user.id, values);
      setPatterns((prev) =>
        [created, ...prev].sort((a, b) => {
          if (b.frequency !== a.frequency) return b.frequency - a.frequency;
          return new Date(b.created_at) - new Date(a.created_at);
        })
      );

      return created;
    },
    [user?.id]
  );

  const removePattern = useCallback(
    async (patternId) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      await deleteErrorPattern(patternId, user.id);
      setPatterns((prev) => prev.filter((item) => item.id !== patternId));
    },
    [user?.id]
  );

  useEffect(() => {
    refreshPatterns();
  }, [refreshPatterns]);

  const stats = useMemo(() => {
    const total = patterns.length;
    const high = patterns.filter((item) => item.severity === 'high').length;
    const medium = patterns.filter((item) => item.severity === 'medium').length;
    const low = patterns.filter((item) => item.severity === 'low').length;

    const totalFrequency = patterns.reduce(
      (sum, item) => sum + (Number(item.frequency) || 0),
      0
    );

    const topPattern = patterns[0] || null;

    return {
      total,
      high,
      medium,
      low,
      totalFrequency,
      topPattern,
    };
  }, [patterns]);

  return {
    patterns,
    stats,
    isPatternsLoading,
    patternsError,
    refreshPatterns,
    addPattern,
    removePattern,
  };
}