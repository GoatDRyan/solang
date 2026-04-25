import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  createStudySession,
  deleteStudySession,
  getStudySessionsByLanguage,
} from '../lib/db/studySessions';

export function useStudySessions(languageCode) {
  const { user, isAuthenticated } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const refreshSessions = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !languageCode) {
      setSessions([]);
      setIsSessionsLoading(false);
      return;
    }

    setIsSessionsLoading(true);
    setSessionsError('');

    try {
      const data = await getStudySessionsByLanguage(user.id, languageCode);
      setSessions(data);
    } catch (error) {
      setSessionsError(error.message || 'Failed to load study sessions.');
    } finally {
      setIsSessionsLoading(false);
    }
  }, [isAuthenticated, user?.id, languageCode]);

  const addSession = useCallback(
    async (values) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const created = await createStudySession(user.id, values);
      setSessions((prev) => [created, ...prev]);
      return created;
    },
    [user?.id]
  );

  const removeSession = useCallback(
    async (sessionId) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      await deleteStudySession(sessionId, user.id);
      setSessions((prev) => prev.filter((item) => item.id !== sessionId));
    },
    [user?.id]
  );

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    sessions,
    isSessionsLoading,
    sessionsError,
    refreshSessions,
    addSession,
    removeSession,
  };
}