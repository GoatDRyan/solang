function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClasses(status) {
  if (status === 'mastered') {
    return 'bg-success-soft text-success-text';
  }

  if (status === 'learning') {
    return 'bg-warning-soft text-warning-text';
  }

  return 'bg-primary-soft text-primary';
}

export default function FlashcardList({
  flashcards,
  isLoading,
  error,
  onDelete,
}) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">All Flashcards</h2>
      <p className="mt-2 text-sm text-text-muted">
        Generated from Error DNA patterns and reviewed with spaced repetition.
      </p>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading flashcards...</p>
        ) : error ? (
          <p className="text-sm text-danger-text">{error}</p>
        ) : flashcards.length === 0 ? (
          <p className="text-sm text-text-muted">No flashcards yet.</p>
        ) : (
          flashcards.map((card) => (
            <div
              key={card.id}
              className="rounded-2xl border border-border bg-surface-muted p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        getStatusClasses(card.status),
                      ].join(' ')}
                    >
                      {card.status}
                    </span>

                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-muted ring-1 ring-border">
                      Due {formatDate(card.due_at)}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-text">
                    {card.front}
                  </p>

                  <p className="mt-3 text-xs text-text-muted">
                    Reviews: {card.review_count || 0} · Correct:{' '}
                    {card.correct_count || 0} · Wrong: {card.wrong_count || 0}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDelete(card.id)}
                  className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}