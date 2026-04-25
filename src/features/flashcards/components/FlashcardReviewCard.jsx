import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';

export default function FlashcardReviewCard({ card, onReview }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReview = async (wasCorrect) => {
    setIsSubmitting(true);

    try {
      await onReview(card, wasCorrect);
      setIsRevealed(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!card) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-text-muted">No due flashcard right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-muted">Review card</p>
          <h2 className="mt-1 text-xl font-semibold text-text">Due now</h2>
        </div>

        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {card.status}
        </span>
      </div>

      <div className="mt-6 rounded-2xl bg-surface-muted p-5">
        <p className="whitespace-pre-line text-base leading-8 text-text">
          {card.front}
        </p>
      </div>

      {isRevealed && (
        <div className="mt-4 rounded-2xl bg-success-soft p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-text">
            Answer
          </p>
          <p className="whitespace-pre-line text-sm leading-7 text-success-text">
            {card.back}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {!isRevealed ? (
          <button
            type="button"
            onClick={() => setIsRevealed(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <RotateCcw size={18} />
            Reveal answer
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleReview(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={18} />
              I missed it
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleReview(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold text-success-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={18} />
              I knew it
            </button>
          </>
        )}
      </div>
    </div>
  );
}