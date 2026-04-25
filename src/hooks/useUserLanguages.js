import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  getMyLanguages,
  setActiveLanguage,
  setLanguageEnabled,
} from '../lib/db/languages';

export function useUserLanguages() {
  const { user, isAuthenticated } = useAuth();

  const [languages, setLanguages] = useState([]);
  const [activeLanguage, setActiveLanguageState] = useState('');
  const [isLanguagesLoading, setIsLanguagesLoading] = useState(true);
  const [languagesError, setLanguagesError] = useState('');

  const refreshLanguages = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setLanguages([]);
      setActiveLanguageState('');
      setIsLanguagesLoading(false);
      return;
    }

    setIsLanguagesLoading(true);
    setLanguagesError('');

    try {
      const data = await getMyLanguages(user.id);
      setLanguages(data);

      const currentActive = data.find((item) => item.is_enabled)?.language_code || '';
      if (!activeLanguage && currentActive) {
        setActiveLanguageState(currentActive);
      }
    } catch (error) {
      setLanguagesError(error.message || 'Failed to load languages.');
    } finally {
      setIsLanguagesLoading(false);
    }
  }, [isAuthenticated, user?.id, activeLanguage]);

  const updateActiveLanguage = useCallback(
    async (languageCode) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const updated = await setActiveLanguage(user.id, languageCode);
      setActiveLanguageState(updated.active_language);
      return updated;
    },
    [user?.id]
  );

  const updateLanguageEnabled = useCallback(
    async (languageCode, isEnabled) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const updated = await setLanguageEnabled(user.id, languageCode, isEnabled);

      setLanguages((prev) =>
        prev.map((item) =>
          item.language_code === languageCode ? updated : item
        )
      );

      return updated;
    },
    [user?.id]
  );

  useEffect(() => {
    refreshLanguages();
  }, [refreshLanguages]);

  const enabledLanguages = useMemo(
    () => languages.filter((item) => item.is_enabled),
    [languages]
  );

  return {
    languages,
    enabledLanguages,
    activeLanguage,
    isLanguagesLoading,
    languagesError,
    refreshLanguages,
    updateActiveLanguage,
    updateLanguageEnabled,
    setActiveLanguageState,
  };
}