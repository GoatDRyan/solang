import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRoadmap(languageCode) {
  const [roadmap, setRoadmap] = useState(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(true);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState('');

  const loadRoadmap = useCallback(async () => {
    if (!languageCode) {
      setRoadmap(null);
      setIsRoadmapLoading(false);
      return;
    }

    setIsRoadmapLoading(true);
    setRoadmapError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated.');
      }

      const { data, error } = await supabase
        .from('learning_roadmaps')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_code', languageCode)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to load roadmap.');
      }

      setRoadmap(data || null);
    } catch (error) {
      setRoadmapError(error.message || 'Failed to load roadmap.');
    } finally {
      setIsRoadmapLoading(false);
    }
  }, [languageCode]);

  const generateRoadmap = useCallback(async () => {
    if (!languageCode) {
      throw new Error('Missing active language.');
    }

    setIsGeneratingRoadmap(true);
    setRoadmapError('');

    try {
      const { data, error } = await supabase.functions.invoke(
        'ai-roadmap-generate',
        {
          body: {
            languageCode,
          },
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to generate roadmap.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setRoadmap(data.roadmap || null);

      return data.roadmap;
    } catch (error) {
      setRoadmapError(error.message || 'Failed to generate roadmap.');
      throw error;
    } finally {
      setIsGeneratingRoadmap(false);
    }
  }, [languageCode]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  return {
    roadmap,
    isRoadmapLoading,
    isGeneratingRoadmap,
    roadmapError,
    refreshRoadmap: loadRoadmap,
    generateRoadmap,
  };
}