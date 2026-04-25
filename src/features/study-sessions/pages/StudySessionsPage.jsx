import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useStudySessions } from '../../../hooks/useStudySessions';
import StudySessionForm from '../components/StudySessionForm';
import StudySessionList from '../components/StudySessionList';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

export default function StudySessionsPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    sessions,
    isSessionsLoading,
    sessionsError,
    addSession,
    removeSession,
  } = useStudySessions(languageCode);

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
          Study Sessions · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Real session tracking connected to Supabase.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <StudySessionForm languageCode={languageCode} onSubmit={addSession} />

        <StudySessionList
          sessions={sessions}
          isLoading={isSessionsLoading}
          error={sessionsError}
          onDelete={removeSession}
        />
      </div>
    </div>
  );
}