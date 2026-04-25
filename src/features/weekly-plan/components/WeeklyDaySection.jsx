import WeeklyBlockCard from './WeeklyBlockCard';

function formatDate(value) {
  if (!value) return '';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function WeeklyDaySection({
  day,
  onComplete,
  onSkip,
  activeActionId,
}) {
  const date = day.blocks[0]?.scheduled_date || null;

  return (
    <section className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">{day.label}</h2>
          {date && (
            <p className="mt-1 text-sm text-text-muted">{formatDate(date)}</p>
          )}
        </div>

        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {day.blocks.length} block{day.blocks.length > 1 ? 's' : ''}
        </span>
      </div>

      {day.blocks.length === 0 ? (
        <p className="text-sm text-text-muted">No study block planned.</p>
      ) : (
        <div className="space-y-4">
          {day.blocks.map((block) => (
            <WeeklyBlockCard
              key={block.id}
              block={block}
              onComplete={onComplete}
              onSkip={onSkip}
              isDisabled={activeActionId === block.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}