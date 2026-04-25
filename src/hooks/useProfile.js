import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/db/profiles';

export function useProfile() {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    setProfileError('');

    try {
      const data = await getMyProfile(user.id);
      setProfile(data);
    } catch (error) {
      setProfileError(error.message || 'Failed to load profile.');
    } finally {
      setIsProfileLoading(false);
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

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return {
    profile,
    isProfileLoading,
    profileError,
    refreshProfile,
    saveProfile,
  };
}