import WeeklyBlockCard from './WeeklyBlockCard';

export default function TodayBlocksPanel({
  blocks,
  onComplete,
  onSkip,
  activeActionId,
}) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Today</h2>
      <p className="mt-2 text-sm text-text-muted">
        These are the blocks scheduled for today.
      </p>

      <div className="mt-6 space-y-4">
        {blocks.length === 0 ? (
          <p className="text-sm text-text-muted">
            No block scheduled for today.
          </p>
        ) : (
          blocks.map((block) => (
            <WeeklyBlockCard
              key={block.id}
              block={block}
              onComplete={onComplete}
              onSkip={onSkip}
              isDisabled={activeActionId === block.id}
            />
          ))
        )}
      </div>
    </div>
  );
}