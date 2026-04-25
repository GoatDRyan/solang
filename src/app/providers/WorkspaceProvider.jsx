import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { getMyProfile, updateMyProfile } from '../../lib/db/profiles';
import {
  getMyLanguages,
  setActiveLanguage,
  setLanguageEnabled,
} from '../../lib/db/languages';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');

  const refreshWorkspace = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setProfile(null);
      setLanguages([]);
      setIsWorkspaceLoading(false);
      return;
    }

    setIsWorkspaceLoading(true);
    setWorkspaceError('');

    try {
      const [profileData, languagesData] = await Promise.all([
        getMyProfile(user.id),
        getMyLanguages(user.id),
      ]);

      setProfile(profileData);
      setLanguages(languagesData);
    } catch (error) {
      setWorkspaceError(error.message || 'Failed to load workspace.');
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const saveProfile = useCallback(
    async (values) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const updated = await updateMyProfile(user.id, values);
      setProfile(updated);
      return updated;
    },
    [user?.id]
  );

  const updateActiveLanguage = useCallback(
    async (languageCode) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const updated = await setActiveLanguage(user.id, languageCode);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              active_language: updated.active_language,
            }
          : prev
      );

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
    refreshWorkspace();
  }, [refreshWorkspace]);

  const enabledLanguages = useMemo(
    () => languages.filter((item) => item.is_enabled),
    [languages]
  );

  const activeLanguage = profile?.active_language || enabledLanguages[0]?.language_code || '';

  const value = useMemo(
    () => ({
      profile,
      languages,
      enabledLanguages,
      activeLanguage,
      isWorkspaceLoading,
      workspaceError,
      refreshWorkspace,
      saveProfile,
      updateActiveLanguage,
      updateLanguageEnabled,
    }),
    [
      profile,
      languages,
      enabledLanguages,
      activeLanguage,
      isWorkspaceLoading,
      workspaceError,
      refreshWorkspace,
      saveProfile,
      updateActiveLanguage,
      updateLanguageEnabled,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }

  return context;
}