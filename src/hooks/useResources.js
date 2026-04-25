import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  createResource,
  deleteResource,
  getResourcesByLanguage,
} from '../lib/db/resources';

export function useResources(languageCode) {
  const { user, isAuthenticated } = useAuth();

  const [resources, setResources] = useState([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState('');

  const refreshResources = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !languageCode) {
      setResources([]);
      setIsResourcesLoading(false);
      return;
    }

    setIsResourcesLoading(true);
    setResourcesError('');

    try {
      const data = await getResourcesByLanguage(user.id, languageCode);
      setResources(data);
    } catch (error) {
      setResourcesError(error.message || 'Failed to load resources.');
    } finally {
      setIsResourcesLoading(false);
    }
  }, [isAuthenticated, user?.id, languageCode]);

  const addResource = useCallback(
    async (values) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      const created = await createResource(user.id, values);
      setResources((prev) => [created, ...prev]);
      return created;
    },
    [user?.id]
  );

  const removeResource = useCallback(
    async (resourceId) => {
      if (!user?.id) {
        throw new Error('Missing authenticated user.');
      }

      await deleteResource(resourceId, user.id);
      setResources((prev) => prev.filter((item) => item.id !== resourceId));
    },
    [user?.id]
  );

  useEffect(() => {
    refreshResources();
  }, [refreshResources]);

  return {
    resources,
    isResourcesLoading,
    resourcesError,
    refreshResources,
    addResource,
    removeResource,
  };
}