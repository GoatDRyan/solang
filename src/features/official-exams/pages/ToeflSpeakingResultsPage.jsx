import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GraduationCap,
  Mic,
  MessageSquareText,
  Target,
  TriangleAlert,
  Volume2,
} from 'lucide-react';
import { useToeflSpeakingAttempt } from '../../../hooks/useToeflSpeakingAttempt';

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
  const percentage = Math.max(0, Math.min(100, (Number(value) / 4) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-sm font-semibold text-primary">{value}/4</p>
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

function TaskResultCard({ result }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">
            Task {result.taskNumber} · {result.taskType}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {result.title}
          </h2>
        </div>

        <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
          {result.score4}/4
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <CriterionBar label="Delivery" value={result.delivery} />
        <CriterionBar label="Language Use" value={result.languageUse} />
        <CriterionBar label="Topic Development" value={result.topicDevelopment} />
        <CriterionBar label="Pronunciation" value={result.pronunciation} />
        <CriterionBar label="Fluency" value={result.fluency} />
      </div>

      <div className="mt-6 rounded-2xl bg-surface-muted p-4">
        <p className="text-sm font-semibold text-text">Feedback</p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          {result.feedback || 'No detailed feedback available.'}
        </p>
      </div>

      {result.transcript && (
        <div className="mt-4 rounded-2xl bg-surface-muted p-4">
          <p className="text-sm font-semibold text-text">Detected transcript</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text-muted">
            {result.transcript}
          </p>
        </div>
      )}

      {Array.isArray(result.strengths) && result.strengths.length > 0 && (
        <div className="mt-4 rounded-2xl bg-success-soft p-4">
          <p className="text-sm font-semibold text-success-text">Strengths</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-text">
            {result.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(result.weaknesses) && result.weaknesses.length > 0 && (
        <div className="mt-4 rounded-2xl bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning-text">Weaknesses</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-text">
            {result.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.improvedAnswerOutline && (
        <div className="mt-4 rounded-2xl bg-primary-soft p-4">
          <p className="text-sm font-semibold text-primary">
            Improved answer outline
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text">
            {result.improvedAnswerOutline}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ToeflSpeakingResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { attempt, section, isAttemptLoading, attemptError } =
    useToeflSpeakingAttempt(attemptId);

  const result = section?.metadata?.result || section?.result || null;

  const taskResults = useMemo(() => {
    return Array.isArray(result?.taskResults) ? result.taskResults : [];
  }, [result]);

  const lowTaskCount = useMemo(() => {
    return taskResults.filter((item) => Number(item.score4 || 0) < 2.5).length;
  }, [taskResults]);

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
          {attemptError || 'This TOEFL Speaking section has not been evaluated yet.'}
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
        <p className="text-sm text-text-muted">TOEFL iBT Speaking</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Estimated Score: {result.scaledScore}/30
        </h1>
        <p className="mt-2 text-sm font-semibold text-primary">
          Average task score: {result.score4}/4 · {result.level}
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-text-muted">
          This score is estimated from your recorded audio responses. Gemini
          evaluates delivery, language use, pronunciation, fluency, and topic
          development.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Score"
          value={`${result.scaledScore}/30`}
          helper={result.level}
        />

        <StatCard
          icon={Target}
          label="Task average"
          value={`${result.score4}/4`}
          helper="Average across 4 speaking tasks"
        />

        <StatCard
          icon={Mic}
          label="Responses"
          value={taskResults.length}
          helper="Audio responses evaluated"
        />

        <StatCard
          icon={TriangleAlert}
          label="Weak tasks"
          value={lowTaskCount}
          helper="Tasks below 2.5/4"
        />
      </div>

      <div className="space-y-6">
        {taskResults.map((taskResult) => (
          <TaskResultCard key={taskResult.taskId} result={taskResult} />
        ))}
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

        <button
          type="button"
          onClick={() => navigate('/weekly-plan')}
          className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary"
        >
          <Volume2 size={17} />
          Update Weekly Plan
        </button>
      </div>
    </div>
  );
}