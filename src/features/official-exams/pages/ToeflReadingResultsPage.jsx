import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Target, TriangleAlert } from 'lucide-react';
import { useToeflReadingAttempt } from '../../../hooks/useToeflReadingAttempt';

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

export default function ToeflReadingResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const {
    attempt,
    section,
    isAttemptLoading,
    attemptError,
  } = useToeflReadingAttempt(attemptId);

  const result = section?.result || null;

  const weakestAreas = useMemo(() => {
    if (!Array.isArray(result?.breakdown)) return [];

    return [...result.breakdown]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);
  }, [result]);

  if (isAttemptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading results...
      </div>
    );
  }

  if (attemptError || !attempt || !section || !result?.estimatedScore) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Results unavailable</h1>
        <p className="mt-3 text-sm text-danger-text">
          {attemptError || 'This TOEFL Reading section has not been evaluated yet.'}
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
        <p className="text-sm text-text-muted">TOEFL iBT Reading</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Estimated Score: {result.estimatedScore}/30
        </h1>
        <p className="mt-2 text-sm font-semibold text-primary">
          {result.scoreLabel}
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-text-muted">
          {result.feedback}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Target}
          label="Score"
          value={`${result.estimatedScore}/30`}
          helper="Estimated TOEFL Reading score"
        />

        <StatCard
          icon={CheckCircle2}
          label="Correct"
          value={`${result.correctCount}/${result.totalQuestions}`}
          helper="Fully correct questions"
        />

        <StatCard
          icon={Clock}
          label="Raw points"
          value={`${result.rawPoints}/${result.maxRawPoints}`}
          helper="Summary questions may count more"
        />

        <StatCard
          icon={TriangleAlert}
          label="Weak areas"
          value={weakestAreas.length}
          helper="Sent to Error DNA if below target"
        />
      </div>

      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Question Type Breakdown</h2>
        <p className="mt-2 text-sm text-text-muted">
          This helps identify what should go into Error DNA and Weekly Plan.
        </p>

        <div className="mt-6 space-y-3">
          {result.breakdown.map((item) => (
            <div
              key={item.type}
              className="rounded-2xl bg-surface-muted p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-text">{item.label}</p>
                  <p className="mt-1 text-sm text-text-muted">
                    {item.points}/{item.maxPoints} points · {item.correct}/
                    {item.total} fully correct
                  </p>
                </div>

                <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                  {item.accuracy}%
                </span>
              </div>
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