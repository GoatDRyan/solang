import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Headphones, Target, TriangleAlert } from 'lucide-react';
import { useToeflListeningAttempt } from '../../../hooks/useToeflListeningAttempt';

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

function formatQuestionType(type) {
  return String(type || 'question')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ToeflListeningResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { attempt, section, isAttemptLoading, attemptError } =
    useToeflListeningAttempt(attemptId);

  const result = section?.metadata?.result || null;

  const missedQuestions = useMemo(() => {
    if (!Array.isArray(result?.details)) return [];

    return result.details.filter((item) => !item.isCorrect);
  }, [result]);

  const groupedWeaknesses = useMemo(() => {
    const map = new Map();

    missedQuestions.forEach((question) => {
      const previous = map.get(question.type) || {
        type: question.type,
        label: formatQuestionType(question.type),
        count: 0,
      };

      previous.count += 1;
      map.set(question.type, previous);
    });

    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [missedQuestions]);

  if (isAttemptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading results...
      </div>
    );
  }

  if (attemptError || !attempt || !section || !result) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Results unavailable</h1>
        <p className="mt-3 text-sm text-danger-text">
          {attemptError ||
            'This TOEFL Listening section has not been evaluated yet.'}
        </p>

        <button
          type="button"
          onClick={() => navigate('/official-exams')}
          className="mt-5 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white"
        >
          Back to Official Exams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-text-muted">TOEFL iBT Listening</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Estimated Score: {result.scaledScore}/30
        </h1>
        <p className="mt-2 text-sm font-semibold text-primary">{result.level}</p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-text-muted">
          Your TOEFL Listening result is based on {result.maxRawScore} questions
          across conversations and academic lectures. Weak question types are
          sent to Error DNA automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Target}
          label="Score"
          value={`${result.scaledScore}/30`}
          helper="Estimated TOEFL Listening score"
        />

        <StatCard
          icon={CheckCircle2}
          label="Correct"
          value={`${result.rawScore}/${result.maxRawScore}`}
          helper="Correct multiple-choice answers"
        />

        <StatCard
          icon={Headphones}
          label="Audios"
          value="5"
          helper="2 conversations + 3 lectures"
        />

        <StatCard
          icon={TriangleAlert}
          label="Weaknesses"
          value={groupedWeaknesses.length}
          helper="Question types to review"
        />
      </div>

      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Weak Question Types</h2>
        <p className="mt-2 text-sm text-text-muted">
          These are the listening question types you missed most.
        </p>

        <div className="mt-6 space-y-3">
          {groupedWeaknesses.length === 0 ? (
            <p className="text-sm text-text-muted">
              No missed question types detected.
            </p>
          ) : (
            groupedWeaknesses.map((item) => (
              <div
                key={item.type}
                className="rounded-2xl bg-surface-muted p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-text">{item.label}</p>

                  <span className="rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-warning-text">
                    {item.count} missed
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Question Review</h2>

        <div className="mt-6 space-y-3">
          {result.details.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-surface-muted p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">
                    {item.itemTitle} · {formatQuestionType(item.type)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    {item.question}
                  </p>
                </div>

                <span
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    item.isCorrect
                      ? 'bg-success-soft text-success-text'
                      : 'bg-danger-soft text-danger-text',
                  ].join(' ')}
                >
                  {item.isCorrect ? 'Correct' : 'Wrong'}
                </span>
              </div>

              <p className="mt-3 text-sm text-text-muted">
                Your answer:{' '}
                <span className="font-semibold text-text">
                  {item.selectedAnswer || '—'}
                </span>{' '}
                · Correct answer:{' '}
                <span className="font-semibold text-text">
                  {item.correctAnswer}
                </span>
              </p>

              {item.explanation && (
                <p className="mt-3 text-sm leading-7 text-text-muted">
                  {item.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate('/official-exams')}
          className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary"
        >
          Back to Official Exams
        </button>

        <button
          type="button"
          onClick={() => navigate('/error-dna')}
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          View Error DNA
        </button>

        <button
          type="button"
          onClick={() => navigate('/weekly-plan')}
          className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary"
        >
          Update Weekly Plan
        </button>
      </div>
    </div>
  );
}