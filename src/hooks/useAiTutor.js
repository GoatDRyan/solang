import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../app/providers/AuthProvider';
import {
  getAiConversations,
  getAiMessages,
  sendAiTutorMessage,
} from '../lib/db/aiTutor';

export function useAiTutor(languageCode) {
  const { user, isAuthenticated } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastDetectedPatterns, setLastDetectedPatterns] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiTutorError, setAiTutorError] = useState('');

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !languageCode) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setIsLoadingConversations(false);
      return;
    }

    setIsLoadingConversations(true);
    setAiTutorError('');

    try {
      const data = await getAiConversations(user.id, languageCode);
      setConversations(data);

      setActiveConversationId((currentId) => {
        const currentStillExists = data.some(
          (conversation) => conversation.id === currentId
        );

        if (currentStillExists) {
          return currentId;
        }

        return data[0]?.id || null;
      });
    } catch (error) {
      setAiTutorError(error.message || 'Failed to load AI Tutor.');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated, user?.id, languageCode]);

  const refreshMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    setAiTutorError('');

    try {
      const data = await getAiMessages(conversationId);
      setMessages(data);
    } catch (error) {
      setAiTutorError(error.message || 'Failed to load AI messages.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback(
    async (conversationId) => {
      setActiveConversationId(conversationId);
      await refreshMessages(conversationId);
    },
    [refreshMessages]
  );

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setLastDetectedPatterns([]);
    setAiTutorError('');
  }, []);

  const sendMessage = useCallback(
    async ({ message, mode }) => {
      if (!isAuthenticated || !user?.id) {
        throw new Error('Missing authenticated user.');
      }

      if (!languageCode) {
        throw new Error('Missing active language.');
      }

      const cleanMessage = String(message || '').trim();

      if (!cleanMessage) {
        throw new Error('Message cannot be empty.');
      }

      setIsSending(true);
      setAiTutorError('');
      setLastDetectedPatterns([]);

      const optimisticId = `local-${Date.now()}`;

      const optimisticUserMessage = {
        id: optimisticId,
        role: 'user',
        content: cleanMessage,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMessage]);

      try {
        const result = await sendAiTutorMessage({
          conversationId: activeConversationId,
          languageCode,
          mode,
          message: cleanMessage,
        });

        const nextConversationId = result.conversationId;

        setActiveConversationId(nextConversationId);

        setMessages((prev) => {
          const withoutOptimisticDuplicate = prev.filter(
            (item) => item.id !== optimisticId
          );

          return [
            ...withoutOptimisticDuplicate,
            {
              id: `saved-user-${Date.now()}`,
              role: 'user',
              content: cleanMessage,
              created_at: optimisticUserMessage.created_at,
            },
            result.message,
          ];
        });

        if (
          Array.isArray(result.detectedPatterns) &&
          result.detectedPatterns.length > 0
        ) {
          setLastDetectedPatterns(result.detectedPatterns);
          console.info('Error DNA updated:', result.detectedPatterns);
        }

        const updatedConversations = await getAiConversations(user.id, languageCode);
        setConversations(updatedConversations);

        return result;
      } catch (error) {
        setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
        setAiTutorError(error.message || 'Failed to send message.');
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [activeConversationId, isAuthenticated, languageCode, user?.id]
  );

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (activeConversationId) {
      refreshMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, refreshMessages]);

  return {
    conversations,
    activeConversationId,
    messages,
    lastDetectedPatterns,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    aiTutorError,
    refreshConversations,
    refreshMessages,
    selectConversation,
    startNewConversation,
    sendMessage,
  };
}