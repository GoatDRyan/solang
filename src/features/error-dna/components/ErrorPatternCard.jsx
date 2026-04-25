function getSeverityClasses(severity) {
  if (severity === 'high') {
    return 'bg-danger-soft text-danger-text';
  }

  if (severity === 'medium') {
    return 'bg-warning-soft text-warning-text';
  }

  return 'bg-success-soft text-success-text';
}

function formatSeverity(severity) {
  return String(severity || 'low')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return 'Never';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ErrorPatternCard({ pattern, onDelete }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text">{pattern.pattern}</h3>

            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold',
                getSeverityClasses(pattern.severity),
              ].join(' ')}
            >
              {formatSeverity(pattern.severity)}
            </span>

            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
              x{pattern.frequency}
            </span>
          </div>

          {pattern.explanation && (
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {pattern.explanation}
            </p>
          )}

          {(pattern.example_wrong || pattern.example_correct) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pattern.example_wrong && (
                <div className="rounded-2xl bg-danger-soft p-3">
                  <p className="text-xs font-semibold text-danger-text">Wrong</p>
                  <p className="mt-1 text-sm text-danger-text">
                    {pattern.example_wrong}
                  </p>
                </div>
              )}

              {pattern.example_correct && (
                <div className="rounded-2xl bg-success-soft p-3">
                  <p className="text-xs font-semibold text-success-text">Correct</p>
                  <p className="mt-1 text-sm text-success-text">
                    {pattern.example_correct}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
            <span>Source: {pattern.source || 'unknown'}</span>
            <span>·</span>
            <span>Last seen: {formatDate(pattern.last_seen_at)}</span>
          </div>
        </div>

        <button
          onClick={() => onDelete(pattern.id)}
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}