import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function getMondayDate(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export function useWeeklyPlan(languageCode) {
  const weekStart = useMemo(() => toDateOnly(getMondayDate()), []);

  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [isWeeklyPlanLoading, setIsWeeklyPlanLoading] = useState(true);
  const [isGeneratingWeeklyPlan, setIsGeneratingWeeklyPlan] = useState(false);
  const [weeklyPlanError, setWeeklyPlanError] = useState('');

  const loadWeeklyPlan = useCallback(async () => {
    if (!languageCode) {
      setWeeklyPlan(null);
      setIsWeeklyPlanLoading(false);
      return;
    }

    setIsWeeklyPlanLoading(true);
    setWeeklyPlanError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const { data, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .eq('week_start', weekStart)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to load weekly plan.');
      }

      setWeeklyPlan(data || null);
    } catch (error) {
      setWeeklyPlanError(error.message || 'Failed to load weekly plan.');
    } finally {
      setIsWeeklyPlanLoading(false);
    }
  }, [languageCode, weekStart]);

  const generateWeeklyPlan = useCallback(async () => {
    if (!languageCode) {
      throw new Error('Missing active language.');
    }

    setIsGeneratingWeeklyPlan(true);
    setWeeklyPlanError('');

    try {
      const { data, error } = await supabase.functions.invoke(
        'ai-weekly-plan-generate',
        {
          body: {
            languageCode,
            weekStart,
          },
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to generate weekly plan.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setWeeklyPlan(data.weeklyPlan || null);

      return data.weeklyPlan;
    } catch (error) {
      setWeeklyPlanError(error.message || 'Failed to generate weekly plan.');
      throw error;
    } finally {
      setIsGeneratingWeeklyPlan(false);
    }
  }, [languageCode, weekStart]);

  useEffect(() => {
    loadWeeklyPlan();
  }, [loadWeeklyPlan]);

  return {
    weeklyPlan,
    weekStart,
    isWeeklyPlanLoading,
    isGeneratingWeeklyPlan,
    weeklyPlanError,
    refreshWeeklyPlan: loadWeeklyPlan,
    generateWeeklyPlan,
  };
}