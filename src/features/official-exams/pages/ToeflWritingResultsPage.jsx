import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  GraduationCap,
  MessageSquareText,
  PenLine,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useToeflWritingAttempt } from '../../../hooks/useToeflWritingAttempt';

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

function CriterionBar({ label, value }) {
  const percentage = Math.max(0, Math.min(100, (Number(value) / 6) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-sm font-semibold text-primary">{value}/6</p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackCard({ title, feedback, improvedVersion, criteria }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">{title}</h2>

      {criteria && (
        <div className="mt-6 space-y-4">
          {criteria.map((criterion) => (
            <CriterionBar
              key={criterion.label}
              label={criterion.label}
              value={criterion.value}
            />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-surface-muted p-4">
        <p className="text-sm font-semibold text-text">Feedback</p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          {feedback || 'No detailed feedback available.'}
        </p>
      </div>

      {improvedVersion && (
        <div className="mt-4 rounded-2xl bg-primary-soft p-4">
          <p className="text-sm font-semibold text-primary">Improved version</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text">
            {improvedVersion}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ToeflWritingResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { attempt, section, isAttemptLoading, attemptError } =
    useToeflWritingAttempt(attemptId);

  const result = section?.metadata?.result || section?.result || null;

  const sentenceDetails = useMemo(() => {
    return Array.isArray(result?.sentenceResults?.details)
      ? result.sentenceResults.details
      : [];
  }, [result]);

  const missedSentences = useMemo(() => {
    return sentenceDetails.filter((item) => !item.isCorrect);
  }, [sentenceDetails]);

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
          {attemptError || 'This TOEFL Writing section has not been evaluated yet.'}
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
        <p className="text-sm text-text-muted">TOEFL iBT Writing</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Estimated Score: {result.score6}/6
        </h1>
        <p className="mt-2 text-sm font-semibold text-primary">
          Compatible legacy score: {result.legacyScore30}/30
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-text-muted">
          This is a TOEFL-like practice evaluation. It estimates performance
          across Build a Sentence, Write an Email, and Academic Discussion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Score"
          value={`${result.score6}/6`}
          helper={result.level}
        />

        <StatCard
          icon={Target}
          label="Legacy score"
          value={`${result.legacyScore30}/30`}
          helper="For Solang dashboard compatibility"
        />

        <StatCard
          icon={CheckCircle2}
          label="Sentence items"
          value={`${result.sentenceResults?.correctCount || 0}/${
            result.sentenceResults?.total || 10
          }`}
          helper="Build a Sentence accuracy"
        />

        <StatCard
          icon={TriangleAlert}
          label="Weak sentences"
          value={missedSentences.length}
          helper="Added to Error DNA when relevant"
        />
      </div>

      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Overall Feedback</h2>
        <p className="mt-4 text-sm leading-7 text-text-muted">
          {result.overallFeedback || 'No overall feedback available.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FeedbackCard
          title="Write an Email"
          feedback={result.email?.feedback}
          improvedVersion={result.email?.improvedVersion}
          criteria={[
            {
              label: 'Task Fulfillment',
              value: result.email?.taskFulfillment || 0,
            },
            {
              label: 'Organization',
              value: result.email?.organization || 0,
            },
            {
              label: 'Language Control',
              value: result.email?.languageControl || 0,
            },
            {
              label: 'Tone',
              value: result.email?.tone || 0,
            },
          ]}
        />

        <FeedbackCard
          title="Academic Discussion"
          feedback={result.academicDiscussion?.feedback}
          improvedVersion={result.academicDiscussion?.improvedVersion}
          criteria={[
            {
              label: 'Idea Development',
              value: result.academicDiscussion?.ideaDevelopment || 0,
            },
            {
              label: 'Interaction With Prompt',
              value: result.academicDiscussion?.interactionWithPrompt || 0,
            },
            {
              label: 'Organization',
              value: result.academicDiscussion?.organization || 0,
            },
            {
              label: 'Language Control',
              value: result.academicDiscussion?.languageControl || 0,
            },
          ]}
        />
      </div>

      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <PenLine size={20} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-text">
              Build a Sentence Review
            </h2>
            <p className="text-sm text-text-muted">
              Review incorrect sentence-control items.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {sentenceDetails.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl bg-surface-muted p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">
                    Sentence {index + 1}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    Your answer:{' '}
                    <span className="font-semibold text-text">
                      {item.selectedAnswer || '—'}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    Correct answer:{' '}
                    <span className="font-semibold text-text">
                      {item.correctAnswer}
                    </span>
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
          onClick={() => navigate('/ai-tutor')}
          className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary"
        >
          <MessageSquareText size={17} />
          Practise with AI Tutor
        </button>
      </div>
    </div>
  );
}