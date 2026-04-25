import { Brain, CheckCircle2, Clock3, Layers } from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useErrorPatterns } from '../../../hooks/useErrorPatterns';
import { useFlashcards } from '../../../hooks/useFlashcards';
import FlashcardReviewCard from '../components/FlashcardReviewCard';
import FlashcardList from '../components/FlashcardList';
import GenerateFlashcardsFromErrors from '../components/GenerateFlashcardsFromErrors';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold text-text">{value}</p>
          <p className="mt-2 text-sm text-text-muted">{helper}</p>
        </div>

        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    patterns,
    isPatternsLoading,
    patternsError,
  } = useErrorPatterns(languageCode);

  const {
    flashcards,
    dueFlashcards,
    stats,
    isFlashcardsLoading,
    isGenerating,
    flashcardsError,
    generateFromPatterns,
    reviewCard,
    removeFlashcard,
  } = useFlashcards(languageCode);

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  const currentDueCard = dueFlashcards[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Active language</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Flashcards · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Review cards generated from your Error DNA.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Total cards"
          value={stats.total}
          helper="All saved flashcards"
        />

        <StatCard
          icon={Clock3}
          label="Due now"
          value={stats.due}
          helper="Ready for review"
        />

        <StatCard
          icon={Brain}
          label="Learning"
          value={stats.learning}
          helper="In active repetition"
        />

        <StatCard
          icon={CheckCircle2}
          label="Mastered"
          value={stats.mastered}
          helper="Long-term interval"
        />
      </div>

      <GenerateFlashcardsFromErrors
        patterns={patterns}
        flashcards={flashcards}
        isGenerating={isGenerating}
        onGenerate={generateFromPatterns}
      />

      {patternsError && (
        <div className="rounded-[1.5rem] bg-surface p-4 text-sm text-danger-text shadow-[var(--shadow-card)] ring-1 ring-border">
          {patternsError}
        </div>
      )}

      {isPatternsLoading && (
        <div className="rounded-[1.5rem] bg-surface p-4 text-sm text-text-muted shadow-[var(--shadow-card)] ring-1 ring-border">
          Loading Error DNA patterns...
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <FlashcardReviewCard card={currentDueCard} onReview={reviewCard} />

        <FlashcardList
          flashcards={flashcards}
          isLoading={isFlashcardsLoading}
          error={flashcardsError}
          onDelete={removeFlashcard}
        />
      </div>
    </div>
  );
}