function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  return date.toLocaleString();
}

export default function StudySessionList({
  sessions,
  isLoading,
  error,
  onDelete,
}) {
  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-text-muted">Loading study sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-danger-text">{error}</p>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Study Sessions</h2>
        <p className="mt-2 text-sm text-text-muted">
          No study sessions yet for this language.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Study Sessions</h2>

      <div className="mt-6 space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-border bg-surface-muted p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-text">
                  {session.title || 'Untitled session'}
                </h3>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                    {session.session_type}
                  </span>

                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted ring-1 ring-border">
                    {session.duration_minutes} min
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-text-muted">
                  <p>Started: {formatDate(session.started_at)}</p>
                  <p>Ended: {formatDate(session.ended_at)}</p>
                </div>

                {session.notes && (
                  <p className="mt-3 text-sm leading-7 text-text-muted">
                    {session.notes}
                  </p>
                )}
              </div>

              <button
                onClick={() => onDelete(session.id)}
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}