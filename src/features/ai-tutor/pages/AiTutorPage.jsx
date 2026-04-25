import { useState } from 'react';
import { Bot, MessageSquarePlus, Send } from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useAiTutor } from '../../../hooks/useAiTutor';

const MODES = [
  {
    value: 'chat',
    label: 'Chat',
  },
  {
    value: 'correction',
    label: 'Correction',
  },
  {
    value: 'grammar',
    label: 'Grammar',
  },
  {
    value: 'exam_coach',
    label: 'Exam Coach',
  },
  {
    value: 'pronunciation',
    label: 'Pronunciation',
  },
];

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

function formatDate(value) {
  if (!value) return '';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[82%] rounded-[1.25rem] px-4 py-3 text-sm leading-7',
          isUser
            ? 'bg-primary text-white'
            : 'bg-surface-muted text-text',
        ].join(' ')}
      >
        <p className="whitespace-pre-line">{message.content}</p>
      </div>
    </div>
  );
}

export default function AiTutorPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    conversations,
    activeConversationId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    aiTutorError,
    selectConversation,
    startNewConversation,
    sendMessage,
  } = useAiTutor(languageCode);

  const [mode, setMode] = useState('chat');
  const [input, setInput] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const message = input.trim();
    if (!message || isSending) return;

    setInput('');

    try {
      await sendMessage({
        message,
        mode,
      });
    } catch {
      setInput(message);
    }
  };

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Active language</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          AI Tutor · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Gemini-powered tutor with conversations saved in Supabase.
        </p>
      </div>

      <div className="grid min-h-[680px] gap-6 xl:grid-cols-[0.32fr_0.68fr]">
        <aside className="rounded-[1.5rem] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-border">
          <button
            onClick={startNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <MessageSquarePlus size={18} />
            New conversation
          </button>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-text">
              Tutor mode
            </label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            >
              {MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold text-text">Conversations</p>

            {isLoadingConversations ? (
              <p className="text-sm text-text-muted">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-text-muted">No conversations yet.</p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => selectConversation(conversation.id)}
                      className={[
                        'w-full rounded-2xl px-4 py-3 text-left transition',
                        isActive
                          ? 'bg-primary text-white'
                          : 'bg-surface-muted text-text hover:bg-primary-soft',
                      ].join(' ')}
                    >
                      <p className="truncate text-sm font-semibold">
                        {conversation.title}
                      </p>
                      <p
                        className={[
                          'mt-1 text-xs',
                          isActive ? 'text-white/80' : 'text-text-muted',
                        ].join(' ')}
                      >
                        {formatDate(conversation.updated_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col rounded-[1.5rem] bg-surface shadow-[var(--shadow-card)] ring-1 ring-border">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary-soft p-3 text-primary">
                <Bot size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text">Tutor Chat</h2>
                <p className="text-sm text-text-muted">
                  Mode: {MODES.find((item) => item.value === mode)?.label}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isLoadingMessages ? (
              <p className="text-sm text-text-muted">Loading messages...</p>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Bot size={26} />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-text">
                    Start practising
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    Ask a question, paste a sentence for correction, or start a
                    conversation in {formatLanguageLabel(languageCode)}.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-[1.25rem] bg-surface-muted px-4 py-3 text-sm text-text-muted">
                  Solang AI is thinking...
                </div>
              </div>
            )}
          </div>

          {aiTutorError && (
            <div className="mx-5 mb-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
              {aiTutorError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-border p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
                placeholder="Write your message..."
              />

              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={18} />
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}