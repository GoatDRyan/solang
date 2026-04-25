import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampScore(value, min = 0, max = 30) {
  return clamp(safeNumber(value), min, max);
}

function getDateNDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function toIsoDate(date) {
  return date.toISOString();
}

function formatShortDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDayLabel(date) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function severityWeight(severity) {
  const value = String(severity || '').toLowerCase();

  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
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

function formatSectionLabel(sectionKey) {
  const map = {
    reading: 'Reading',
    listening: 'Listening',
    speaking: 'Speaking',
    writing: 'Writing',
  };

  return map[sectionKey] || sectionKey;
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
          scorePercent: 0,
          cefrLevel: null,
          completedAt: null,
        };

        return acc;
      }

      const score = getSectionScore(section);

      acc[sectionKey] = {
        sectionKey,
        label: formatSectionLabel(sectionKey),
        score,
        scorePercent: Math.round((score / 30) * 100),
        cefrLevel: toeflSectionToCefr(sectionKey, score),
        completedAt:
          section.completed_at || section.updated_at || section.created_at || null,
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

  return {
    sectionScores,
    completedSections,
    isComplete,
    totalScore,
    cefrLevel: isComplete ? toeflTotalToCefr(totalScore) : null,
    weakestSection,
    strongestSection,
  };
}

function buildToeflHistory(sections) {
  return sections
    .slice()
    .sort(
      (a, b) =>
        new Date(a.completed_at || a.updated_at || a.created_at) -
        new Date(b.completed_at || b.updated_at || b.created_at)
    )
    .slice(-12)
    .map((section) => {
      const score = getSectionScore(section);
      const label = `${formatSectionLabel(section.section_key)} · ${formatShortDate(
        section.completed_at || section.updated_at || section.created_at
      )}`;

      return {
        label,
        section: formatSectionLabel(section.section_key),
        score,
      };
    });
}

function buildWeeklyTimeData(sessions) {
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);

    const key = date.toISOString().slice(0, 10);

    days.push({
      key,
      day: formatDayLabel(date),
      hours: 0,
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
      day.hours = Number((day.minutes / 60).toFixed(1));
    }
  });

  return days.map(({ day, hours, minutes }) => ({
    day,
    hours,
    minutes,
  }));
}

function sumSessionMinutesBetween(sessions, startDate, endDate) {
  const start = startDate.getTime();
  const end = endDate.getTime();

  return sessions.reduce((total, session) => {
    const dateValue = session.started_at || session.created_at;

    if (!dateValue) return total;

    const time = new Date(dateValue).getTime();

    if (time >= start && time < end) {
      return total + safeNumber(session.duration_minutes);
    }

    return total;
  }, 0);
}

function buildTimeComparisons(sessions) {
  const now = new Date();

  const currentWeekStart = getDateNDaysAgo(7);
  const previousWeekStart = getDateNDaysAgo(14);

  const currentMonthStart = getDateNDaysAgo(30);
  const previousMonthStart = getDateNDaysAgo(60);

  const currentWeekMinutes = sumSessionMinutesBetween(
    sessions,
    currentWeekStart,
    now
  );

  const previousWeekMinutes = sumSessionMinutesBetween(
    sessions,
    previousWeekStart,
    currentWeekStart
  );

  const currentMonthMinutes = sumSessionMinutesBetween(
    sessions,
    currentMonthStart,
    now
  );

  const previousMonthMinutes = sumSessionMinutesBetween(
    sessions,
    previousMonthStart,
    currentMonthStart
  );

  const currentWeekHours = Number((currentWeekMinutes / 60).toFixed(1));
  const previousWeekHours = Number((previousWeekMinutes / 60).toFixed(1));
  const currentMonthHours = Number((currentMonthMinutes / 60).toFixed(1));
  const previousMonthHours = Number((previousMonthMinutes / 60).toFixed(1));

  return {
    week: {
      current: `${currentWeekHours}h`,
      previous: `${previousWeekHours}h`,
      delta:
        previousWeekHours > 0
          ? Math.round(((currentWeekHours - previousWeekHours) / previousWeekHours) * 100)
          : currentWeekHours > 0
          ? 100
          : 0,
      note:
        currentWeekHours >= previousWeekHours
          ? 'Your study workload is up compared with the previous 7 days.'
          : 'Your study workload is lower than the previous 7 days.',
    },
    month: {
      current: `${currentMonthHours}h`,
      previous: `${previousMonthHours}h`,
      delta:
        previousMonthHours > 0
          ? Math.round(
              ((currentMonthHours - previousMonthHours) / previousMonthHours) * 100
            )
          : currentMonthHours > 0
          ? 100
          : 0,
      note:
        currentMonthHours >= previousMonthHours
          ? 'Your monthly workload is trending upward.'
          : 'Your monthly workload is currently lower than the previous period.',
    },
  };
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

function buildErrorEvolution(errorPatterns) {
  const now = new Date();
  const recentStart = getDateNDaysAgo(14);
  const previousStart = getDateNDaysAgo(28);

  const recentLoad = errorPatterns.reduce((total, pattern) => {
    const dateValue = pattern.last_seen_at || pattern.updated_at || pattern.created_at;

    if (!dateValue) return total;

    const date = new Date(dateValue);

    if (date >= recentStart && date <= now) {
      return total + safeNumber(pattern.frequency) * severityWeight(pattern.severity);
    }

    return total;
  }, 0);

  const previousLoad = errorPatterns.reduce((total, pattern) => {
    const dateValue = pattern.last_seen_at || pattern.updated_at || pattern.created_at;

    if (!dateValue) return total;

    const date = new Date(dateValue);

    if (date >= previousStart && date < recentStart) {
      return total + safeNumber(pattern.frequency) * severityWeight(pattern.severity);
    }

    return total;
  }, 0);

  if (previousLoad === 0 && recentLoad === 0) {
    return {
      label: '0%',
      trend: 'stable',
      recentLoad,
      previousLoad,
      note: 'No recent recurring error pressure detected.',
    };
  }

  if (previousLoad === 0 && recentLoad > 0) {
    return {
      label: '+100%',
      trend: 'up',
      recentLoad,
      previousLoad,
      note: 'More recurring issues were detected recently.',
    };
  }

  const delta = Math.round(((recentLoad - previousLoad) / previousLoad) * 100);

  return {
    label: `${delta > 0 ? '+' : ''}${delta}%`,
    trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
    recentLoad,
    previousLoad,
    note:
      delta > 0
        ? 'Recurring error pressure increased recently.'
        : delta < 0
        ? 'Recurring error pressure decreased recently.'
        : 'Recurring error pressure is stable.',
  };
}

function buildSkillDistribution(latestToefl, errorPatterns, flashcards) {
  const grammarPenalty = errorPatterns
    .filter((item) =>
      /grammar|tense|preposition|article|accuracy|syntax|sentence/i.test(
        item.pattern || ''
      )
    )
    .reduce(
      (total, item) => total + safeNumber(item.frequency) * severityWeight(item.severity),
      0
    );

  const vocabularyPenalty = errorPatterns
    .filter((item) => /lexical|vocabulary|word|collocation/i.test(item.pattern || ''))
    .reduce(
      (total, item) => total + safeNumber(item.frequency) * severityWeight(item.severity),
      0
    );

  const masteredFlashcards = flashcards.filter(
    (card) => String(card.status || '').toLowerCase() === 'mastered'
  ).length;

  const grammarScore = clamp(70 - grammarPenalty * 2 + masteredFlashcards * 0.4, 15, 95);
  const vocabularyScore = clamp(
    70 - vocabularyPenalty * 2 + masteredFlashcards * 0.25,
    15,
    95
  );

  const sectionScores = latestToefl?.sectionScores || {};

  return [
    {
      skill: 'Reading',
      value:
        sectionScores.reading?.score !== null && sectionScores.reading?.score !== undefined
          ? Math.round((sectionScores.reading.score / 30) * 100)
          : 0,
      source: 'TOEFL',
    },
    {
      skill: 'Listening',
      value:
        sectionScores.listening?.score !== null &&
        sectionScores.listening?.score !== undefined
          ? Math.round((sectionScores.listening.score / 30) * 100)
          : 0,
      source: 'TOEFL',
    },
    {
      skill: 'Speaking',
      value:
        sectionScores.speaking?.score !== null &&
        sectionScores.speaking?.score !== undefined
          ? Math.round((sectionScores.speaking.score / 30) * 100)
          : 0,
      source: 'TOEFL',
    },
    {
      skill: 'Writing',
      value:
        sectionScores.writing?.score !== null && sectionScores.writing?.score !== undefined
          ? Math.round((sectionScores.writing.score / 30) * 100)
          : 0,
      source: 'TOEFL',
    },
    {
      skill: 'Grammar',
      value: Math.round(grammarScore),
      source: 'Error DNA + Flashcards',
    },
    {
      skill: 'Vocabulary',
      value: Math.round(vocabularyScore),
      source: 'Error DNA + Flashcards',
    },
  ];
}

export function useAnalytics(languageCode) {
  const [analytics, setAnalytics] = useState(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadAnalytics = useCallback(async () => {
    if (!languageCode) {
      setAnalytics(null);
      setIsAnalyticsLoading(false);
      return;
    }

    setIsAnalyticsLoading(true);
    setAnalyticsError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const since60Days = toIsoDate(getDateNDaysAgo(60));

      const [
        sessionsResponse,
        flashcardsResponse,
        errorPatternsResponse,
        toeflSectionsResponse,
      ] = await Promise.all([
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('language_code', languageCode)
          .gte('created_at', since60Days)
          .order('created_at', { ascending: false }),

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
      const flashcards = flashcardsResponse.data || [];
      const errorPatterns = errorPatternsResponse.data || [];
      const toeflSections = toeflSectionsResponse.data || [];

      const latestToefl = buildLatestToeflSnapshot(toeflSections);
      const toeflHistory = buildToeflHistory(toeflSections);
      const weeklyTime = buildWeeklyTimeData(sessions);
      const comparisons = buildTimeComparisons(sessions);
      const errorEvolution = buildErrorEvolution(errorPatterns);
      const skillDistribution = buildSkillDistribution(
        latestToefl,
        errorPatterns,
        flashcards
      );

      const masteredFlashcards = flashcards.filter(
        (card) => String(card.status || '').toLowerCase() === 'mastered'
      ).length;

      const dueFlashcards = countDueFlashcards(flashcards);

      const averageToeflSectionScore =
        toeflSections.length > 0
          ? Math.round(
              toeflSections.reduce(
                (total, section) => total + getSectionScore(section),
                0
              ) / toeflSections.length
            )
          : null;

      const highSeverityCount = errorPatterns.filter(
        (item) => String(item.severity || '').toLowerCase() === 'high'
      ).length;

      setAnalytics({
        stats: {
          cefr: latestToefl.isComplete ? latestToefl.cefrLevel : 'Incomplete',
          toeflTotal: latestToefl.isComplete ? latestToefl.totalScore : null,
          completedToeflSections: latestToefl.completedSections,
          averageToeflSectionScore,
          sessionsCompleted: sessions.length,
          errorEvolution: errorEvolution.label,
          dueFlashcards,
          masteredFlashcards,
          recurringPatterns: errorPatterns.length,
          highSeverityCount,
        },
        latestToefl,
        toeflHistory,
        weeklyTime,
        skillDistribution,
        comparisons,
        errorEvolution,
        topErrorPatterns: errorPatterns.slice(0, 5),
      });
    } catch (error) {
      setAnalyticsError(error.message || 'Failed to load analytics.');
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [languageCode]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    isAnalyticsLoading,
    analyticsError,
    refreshAnalytics: loadAnalytics,
  };
}