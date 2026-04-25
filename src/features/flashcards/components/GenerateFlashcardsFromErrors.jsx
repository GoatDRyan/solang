import { Wand2 } from 'lucide-react';

export default function GenerateFlashcardsFromErrors({
  patterns,
  flashcards,
  isGenerating,
  onGenerate,
}) {
  const existingSourceIds = new Set(
    flashcards
      .filter((card) => card.source_type === 'error_pattern')
      .map((card) => card.source_id)
      .filter(Boolean)
  );

  const availablePatterns = patterns.filter(
    (pattern) => pattern?.id && !existingSourceIds.has(pattern.id)
  );

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">
            Generate from Error DNA
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            Create flashcards from recurring mistakes detected by AI Tutor.
          </p>

          <p className="mt-3 text-sm text-text-muted">
            Available patterns:{' '}
            <span className="font-semibold text-text">
              {availablePatterns.length}
            </span>
          </p>
        </div>

        <button
          type="button"
          disabled={isGenerating || availablePatterns.length === 0}
          onClick={() => onGenerate(availablePatterns)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Wand2 size={18} />
          {isGenerating ? 'Generating...' : 'Generate cards'}
        </button>
      </div>
    </div>
  );
}