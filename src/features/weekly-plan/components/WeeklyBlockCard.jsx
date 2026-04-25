import { Check, ExternalLink, SkipForward } from 'lucide-react';

function getStatusClasses(status) {
  if (status === 'completed') {
    return 'bg-success-soft text-success-text';
  }

  if (status === 'skipped') {
    return 'bg-warning-soft text-warning-text';
  }

  return 'bg-primary-soft text-primary';
}

function formatBlockType(type) {
  return String(type || 'practice')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function WeeklyBlockCard({
  block,
  onComplete,
  onSkip,
  isDisabled,
}) {
  const isDone = block.status === 'completed' || block.status === 'skipped';

  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
              {block.duration_minutes} min
            </span>

            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
              {formatBlockType(block.block_type)}
            </span>

            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold',
                getStatusClasses(block.status),
              ].join(' ')}
            >
              {block.status}
            </span>
          </div>

          <h3 className="mt-4 text-lg font-semibold text-text">{block.title}</h3>

          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-muted">
            {block.instructions}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
            {block.skill_focus && <span>{block.skill_focus}</span>}

            {block.flashcard_focus && (
              <>
                {block.skill_focus && <span>·</span>}
                <span>Flashcard focus</span>
              </>
            )}
          </div>

          {block.resource_url && (
            <a
              href={block.resource_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              <ExternalLink size={16} />
              Open resource
            </a>
          )}
        </div>

        <div className="flex gap-3 md:flex-col">
          <button
            type="button"
            disabled={isDisabled || isDone}
            onClick={() => onComplete(block)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} />
            Complete
          </button>

          <button
            type="button"
            disabled={isDisabled || isDone}
            onClick={() => onSkip(block)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-warning-soft hover:text-warning-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SkipForward size={16} />
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}