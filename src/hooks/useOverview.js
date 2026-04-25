import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clampScore(value, min = 0, max = 30) {
  const number = safeNumber(value);
  return Math.min(max, Math.max(min, number));
}

function getDateNDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatDayLabel(date) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function buildWeeklyData(sessions) {
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);

    const key = date.toISOString().slice(0, 10);

    days.push({
      key,
      label: formatDayLabel(date),
      minutes: 0,
    });
  }

  sessions.forEach((session) => {
    const dateValue = session.started_at || session.created_at;

    if (!dateValue) return;

    const key = new Date(dateValue).toISOString().slice(0, 10);
    const day = days.find((item) => item.key === key);

    if (day) {
      day.minutes += safeNumber(session.duration_minutes);
    }
  });

  return days.map(({ label, minutes }) => ({
    label,
    minutes,
  }));
}

function buildTypeBreakdown(sessions) {
  const map = new Map();

  sessions.forEach((session) => {
    const type = session.session_type || 'other';

    const current = map.get(type) || {
      type,
      minutes: 0,
      sessions: 0,
    };

    current.minutes += safeNumber(session.duration_minutes);
    current.sessions += 1;

    map.set(type, current);
  });

  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
}

function toeflTotalToCefr(totalScore) {
  const score = safeNumber(totalScore);

  if (score >= 114) return 'C2';
  if (score >= 95) return 'C1';
  if (score >= 72) return 'B2';
  if (score >= 42) return 'B1';

  return 'Below B1';
}

function toeflSectionToCefr(sectionKey, scoreValue) {
  const score = safeNumber(scoreValue);

  if (sectionKey === 'reading') {
    if (score >= 29) return 'C2';
    if (score >= 24) return 'C1';
    if (score >= 18) return 'B2';
    if (score >= 4) return 'B1';
    return 'Below B1';
  }

  if (sectionKey === 'listening') {
    if (score >= 28) return 'C2';
    if (score >= 22) return 'C1';
    if (score >= 17) return 'B2';
    if (score >= 9) return 'B1';
    return 'Below B1';
  }

  if (sectionKey === 'speaking') {
    if (score >= 25) return 'C1';
    if (score >= 20) return 'B2';
    if (score >= 16) return 'B1';
    if (score >= 10) return 'A2';
    return 'Below A2';
  }

  if (sectionKey === 'writing') {
    if (score >= 29) return 'C2';
    if (score >= 24) return 'C1';
    if (score >= 17) return 'B2';
    if (score >= 13) return 'B1';
    if (score >= 7) return 'A2';
    return 'Below A2';
  }

  return 'Unknown';
}

function getSectionScore(section) {
  const result = section.result || section.metadata?.result || {};

  if (section.section_key === 'speaking') {
    return clampScore(
      result.scaledScore ??
        result.scaled_score_30 ??
        section.metadata?.scaled_score_30 ??
        section.score
    );
  }

  if (section.section_key === 'writing') {
    return clampScore(
      result.legacyScore30 ??
        result.legacy_score_30 ??
        section.metadata?.legacy_score_30 ??
        section.score
    );
  }

  return clampScore(
    result.score ??
      result.scaledScore ??
      result.scaled_score_30 ??
      result.legacyScore30 ??
      section.score
  );
}

function buildLatestToeflSnapshot(sections) {
  const latestBySection = {
    reading: null,
    listening: null,
    speaking: null,
    writing: null,
  };

  sections.forEach((section) => {
    const key = section.section_key;

    if (!Object.prototype.hasOwnProperty.call(latestBySection, key)) return;

    if (!latestBySection[key]) {
      latestBySection[key] = section;
    }
  });

  const sectionScores = Object.entries(latestBySection).reduce(
    (acc, [sectionKey, section]) => {
      if (!section) {
        acc[sectionKey] = {
          sectionKey,
          label: formatSectionLabel(sectionKey),
          score: null,
          cefrLevel: null,
          completedAt: null,
          section: null,
        };

        return acc;
      }

      const score = getSectionScore(section);

      acc[sectionKey] = {
        sectionKey,
        label: formatSectionLabel(sectionKey),
        score,
        cefrLevel: toeflSectionToCefr(sectionKey, score),
        completedAt:
          section.completed_at || section.updated_at || section.created_at || null,
        section,
      };

      return acc;
    },
    {}
  );

  const completedSections = Object.values(sectionScores).filter(
    (item) => item.score !== null
  ).length;

  const isComplete = completedSections === 4;

  const totalScore = Object.values(sectionScores).reduce((total, item) => {
    if (item.score === null) return total;
    return total + safeNumber(item.score);
  }, 0);

  const completedScores = Object.values(sectionScores).filter(
    (item) => item.score !== null
  );

  const weakestSection =
    completedScores.length > 0
      ? [...completedScores].sort((a, b) => a.score - b.score)[0]
      : null;

  const strongestSection =
    completedScores.length > 0
      ? [...completedScores].sort((a, b) => b.score - a.score)[0]
      : null;

  const latestCompletedAt =
    completedScores.length > 0
      ? completedScores
          .map((item) => item.completedAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0] || null
      : null;

  return {
    sectionScores,
    completedSections,
    isComplete,
    totalScore,
    cefrLevel: isComplete ? toeflTotalToCefr(totalScore) : null,
    weakestSection,
    strongestSection,
    latestCompletedAt,
  };
}

function formatSectionLabel(sectionKey) {
  const map = {
    reading: 'Reading',
    listening: 'Listening',
    speaking: 'Speaking',
    writing: 'Writing',
  };

  return map[sectionKey] || sectionKey;
}

function countDueFlashcards(flashcards) {
  const now = new Date();

  return flashcards.filter((card) => {
    const status = String(card.status || '').toLowerCase();

    if (status === 'mastered') return false;

    if (card.next_review_at) {
      return new Date(card.next_review_at) <= now;
    }

    return ['new', 'learning', 'review', 'due'].includes(status);
  }).length;
}

export function useOverview(languageCode) {
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalSessions: 0,
    averageMinutes: 0,
    resourcesCount: 0,
    flashcardsCount: 0,
    dueFlashcards: 0,
    masteredFlashcards: 0,
    errorPatternsCount: 0,
    highPriorityErrors: 0,
    topErrorPattern: null,
    latestToefl: null,
    cefrLevel: null,
    latestExamLevel: null,
  });

  const [weeklyData, setWeeklyData] = useState([]);
  const [typeBreakdown, setTypeBreakdown] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const loadOverview = useCallback(async () => {
    if (!languageCode) {
      setIsOverviewLoading(false);
      return;
    }

    setIsOverviewLoading(true);
    setOverviewError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const since30Days = getDateNDaysAgo(30);
      const since7Days = getDateNDaysAgo(7);

      const [
        sessionsResponse,
        weeklySessionsResponse,
        resourcesResponse,
        flashcardsResponse,
        errorPatternsResponse,
        toeflSectionsResponse,
      ] = await Promise.all([
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode)
          .gte('created_at', since30Days)
          .order('created_at', { ascending: false }),

        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode)
          .gte('created_at', since7Days)
          .order('created_at', { ascending: true }),

        supabase
          .from('resources')
          .select('id')
          .eq('user_id', user.id)
          .eq('language_code', languageCode),

        supabase
          .from('flashcards')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode),

        supabase
          .from('error_patterns')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode)
          .order('frequency', { ascending: false })
          .order('last_seen_at', { ascending: false }),

        supabase
          .from('exam_attempt_sections')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode)
          .eq('exam_key', 'toefl_ibt')
          .eq('status', 'completed')
          .in('section_key', ['reading', 'listening', 'speaking', 'writing'])
          .order('completed_at', { ascending: false }),
      ]);

      if (sessionsResponse.error) {
        throw new Error(sessionsResponse.error.message);
      }

      if (weeklySessionsResponse.error) {
        throw new Error(weeklySessionsResponse.error.message);
      }

      if (resourcesResponse.error) {
        throw new Error(resourcesResponse.error.message);
      }

      if (flashcardsResponse.error) {
        throw new Error(flashcardsResponse.error.message);
      }

      if (errorPatternsResponse.error) {
        throw new Error(errorPatternsResponse.error.message);
      }

      if (toeflSectionsResponse.error) {
        throw new Error(toeflSectionsResponse.error.message);
      }

      const sessions = sessionsResponse.data || [];
      const weeklySessions = weeklySessionsResponse.data || [];
      const resources = resourcesResponse.data || [];
      const flashcards = flashcardsResponse.data || [];
      const errorPatterns = errorPatternsResponse.data || [];
      const toeflSections = toeflSectionsResponse.data || [];

      const totalMinutes = sessions.reduce(
        (total, session) => total + safeNumber(session.duration_minutes),
        0
      );

      const totalSessions = sessions.length;
      const averageMinutes =
        totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

      const masteredFlashcards = flashcards.filter(
        (card) => String(card.status || '').toLowerCase() === 'mastered'
      ).length;

      const dueFlashcards = countDueFlashcards(flashcards);

      const highPriorityErrors = errorPatterns.filter(
        (pattern) => String(pattern.severity || '').toLowerCase() === 'high'
      ).length;

      const topErrorPattern = errorPatterns[0] || null;

      const latestToefl = buildLatestToeflSnapshot(toeflSections);

      setStats({
        totalMinutes,
        totalSessions,
        averageMinutes,
        resourcesCount: resources.length,
        flashcardsCount: flashcards.length,
        dueFlashcards,
        masteredFlashcards,
        errorPatternsCount: errorPatterns.length,
        highPriorityErrors,
        topErrorPattern,
        latestToefl,
        cefrLevel: latestToefl.cefrLevel,
        latestExamLevel: latestToefl.cefrLevel,
      });

      setWeeklyData(buildWeeklyData(weeklySessions));
      setTypeBreakdown(buildTypeBreakdown(sessions));
      setRecentSessions(sessions.slice(0, 5));
    } catch (error) {
      setOverviewError(error.message || 'Failed to load overview.');
    } finally {
      setIsOverviewLoading(false);
    }
  }, [languageCode]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return {
    stats,
    weeklyData,
    typeBreakdown,
    recentSessions,
    isOverviewLoading,
    overviewError,
    refreshOverview: loadOverview,
  };
}