import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useErrorPatterns } from '../../../hooks/useErrorPatterns';
import ErrorDnaStats from '../components/ErrorDnaStats';
import ErrorPatternCard from '../components/ErrorPatternCard';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

export default function ErrorDnaPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    patterns,
    stats,
    isPatternsLoading,
    patternsError,
    removePattern,
  } = useErrorPatterns(languageCode);

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
          Error DNA · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Recurring mistakes detected automatically from AI Tutor corrections.
        </p>
      </div>

      <ErrorDnaStats stats={stats} />

      <div className="space-y-4">
        <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
          <h2 className="text-xl font-semibold text-text">Priority Patterns</h2>
          <p className="mt-2 text-sm text-text-muted">
            Sorted by frequency and recency. Use AI Tutor in Correction, Grammar,
            Exam Coach, or Pronunciation mode to generate new patterns.
          </p>
        </div>

        {isPatternsLoading ? (
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <p className="text-sm text-text-muted">Loading error patterns...</p>
          </div>
        ) : patternsError ? (
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <p className="text-sm text-danger-text">{patternsError}</p>
          </div>
        ) : patterns.length === 0 ? (
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <p className="text-sm text-text-muted">
              No error patterns detected yet. Go to AI Tutor and use Correction mode
              with a sentence that contains mistakes.
            </p>
          </div>
        ) : (
          patterns.map((pattern) => (
            <ErrorPatternCard
              key={pattern.id}
              pattern={pattern}
              onDelete={removePattern}
            />
          ))
        )}
      </div>
    </div>
  );
}