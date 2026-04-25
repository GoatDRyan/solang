import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_GOAL = {
  target_exam: 'toefl_ibt',
  target_level: 'C1',
  target_score: 95,
  deadline: '',
  weekly_minutes: 600,
  priority: 'balanced',
};

function normalizeGoal(goal) {
  return {
    ...DEFAULT_GOAL,
    ...(goal || {}),
    deadline: goal?.deadline || '',
  };
}

export function useLearningGoal(languageCode) {
  const [goal, setGoal] = useState(normalizeGoal(null));
  const [isGoalLoading, setIsGoalLoading] = useState(true);
  const [goalError, setGoalError] = useState('');

  const loadGoal = useCallback(async () => {
    if (!languageCode) {
      setIsGoalLoading(false);
      return;
    }

    setIsGoalLoading(true);
    setGoalError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const { data, error } = await supabase
        .from('learning_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to load learning goal.');
      }

      if (!data) {
        setGoal(normalizeGoal(null));
      } else {
        setGoal(normalizeGoal(data));
      }
    } catch (error) {
      setGoalError(error.message || 'Failed to load learning goal.');
    } finally {
      setIsGoalLoading(false);
    }
  }, [languageCode]);

  const saveGoal = useCallback(
    async (nextGoal) => {
      if (!languageCode) {
        throw new Error('Missing active language.');
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const payload = {
        user_id: user.id,
        language_code: languageCode,
        target_exam: nextGoal.target_exam || DEFAULT_GOAL.target_exam,
        target_level: nextGoal.target_level || DEFAULT_GOAL.target_level,
        target_score: Number(nextGoal.target_score || DEFAULT_GOAL.target_score),
        deadline: nextGoal.deadline || null,
        weekly_minutes: Number(
          nextGoal.weekly_minutes || DEFAULT_GOAL.weekly_minutes
        ),
        priority: nextGoal.priority || DEFAULT_GOAL.priority,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('learning_goals')
        .upsert(payload, {
          onConflict: 'user_id,language_code',
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to save learning goal.');
      }

      const normalized = normalizeGoal(data);
      setGoal(normalized);

      return normalized;
    },
    [languageCode]
  );

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  return {
    goal,
    isGoalLoading,
    goalError,
    saveGoal,
    refreshGoal: loadGoal,
  };
}