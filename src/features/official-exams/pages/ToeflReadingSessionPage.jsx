import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, LogOut, Save } from 'lucide-react';
import { useToeflReadingAttempt } from '../../../hooks/useToeflReadingAttempt';
import {
  evaluateToeflReadingSection,
  saveToeflReadingProgress,
} from '../../../lib/db/toeflExam';
import ToeflReadingTask from '../components/ToeflReadingTask';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

function getLocalStorageKey(sectionId) {
  return `solang-toefl-reading-draft-${sectionId}`;
}

function getSavedLocalDraft(sectionId) {
  if (!sectionId) return null;

  try {
    const raw = window.localStorage.getItem(getLocalStorageKey(sectionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalDraft(sectionId, payload) {
  if (!sectionId) return;

  try {
    window.localStorage.setItem(
      getLocalStorageKey(sectionId),
      JSON.stringify(payload)
    );
  } catch {
    // Local backup is optional.
  }
}

function clearLocalDraft(sectionId) {
  if (!sectionId) return;

  try {
    window.localStorage.removeItem(getLocalStorageKey(sectionId));
  } catch {
    // Local backup is optional.
  }
}

export default function ToeflReadingSessionPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { attempt, section, isAttemptLoading, attemptError } =
    useToeflReadingAttempt(attemptId);

  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(35 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const dirtyRef = useRef(false);
  const hasLoadedDraftRef = useRef(false);

  const task = section?.content || null;

  const totalQuestions = useMemo(() => {
    const passages = task?.content?.passages || [];

    return passages.reduce(
      (total, passage) => total + (passage.questions?.length || 0),
      0
    );
  }, [task]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    }).length;
  }, [answers]);

  const handleAnswersChange = (nextAnswers) => {
    setAnswers(nextAnswers);
    dirtyRef.current = true;

    if (section?.id) {
      saveLocalDraft(section.id, {
        answers: nextAnswers,
        remainingSeconds,
        savedAt: new Date().toISOString(),
      });
    }
  };

  const handleSaveProgress = useCallback(
    async ({ silent = false } = {}) => {
      if (!section?.id || section.status !== 'in_progress') return null;

      setIsSaving(true);

      if (!silent) {
        setSaveMessage('');
        setSubmitError('');
      }

      try {
        const savedSection = await saveToeflReadingProgress({
          sectionId: section.id,
          answers,
          remainingSeconds,
        });

        dirtyRef.current = false;

        saveLocalDraft(section.id, {
          answers,
          remainingSeconds,
          savedAt: new Date().toISOString(),
        });

        if (!silent) {
          setSaveMessage('Progress saved.');
        }

        return savedSection;
      } catch (error) {
        if (!silent) {
          setSubmitError(error.message || 'Failed to save progress.');
        }

        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [answers, remainingSeconds, section?.id, section?.status]
  );

  const handleSaveAndExit = async () => {
    const shouldExit = window.confirm(
      'Save your TOEFL Reading progress and leave this section?'
    );

    if (!shouldExit) return;

    await handleSaveProgress();
    navigate('/official-exams');
  };

  const handleSubmit = useCallback(async () => {
    if (!section?.id || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');
    setSaveMessage('');

    try {
      await evaluateToeflReadingSection({
        sectionId: section.id,
        answers,
      });

      clearLocalDraft(section.id);
      navigate(`/official-exams/toefl-reading/${attemptId}/results`);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit TOEFL Reading.');
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, attemptId, isSubmitting, navigate, section?.id]);

  useEffect(() => {
    if (!section?.id || hasLoadedDraftRef.current) return;

    const localDraft = getSavedLocalDraft(section.id);
    const databaseAnswers =
      section.answers && Object.keys(section.answers).length > 0
        ? section.answers
        : null;

    const databaseRemainingSeconds =
      typeof section.metadata?.remaining_seconds === 'number'
        ? section.metadata.remaining_seconds
        : null;

    setAnswers(databaseAnswers || localDraft?.answers || {});

    setRemainingSeconds(
      databaseRemainingSeconds ||
        localDraft?.remainingSeconds ||
        (section.duration_minutes || 35) * 60
    );

    hasLoadedDraftRef.current = true;
  }, [section?.id, section?.answers, section?.duration_minutes, section?.metadata]);

  useEffect(() => {
    if (!section || section.status === 'completed') return;
    if (isSubmitting) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [section, isSubmitting]);

  useEffect(() => {
    if (!section?.id || section.status !== 'in_progress') return;

    const interval = window.setInterval(() => {
      if (dirtyRef.current || remainingSeconds % 10 === 0) {
        handleSaveProgress({ silent: true });
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [handleSaveProgress, remainingSeconds, section?.id, section?.status]);

  useEffect(() => {
    if (!section?.id) return;

    saveLocalDraft(section.id, {
      answers,
      remainingSeconds,
      savedAt: new Date().toISOString(),
    });
  }, [answers, remainingSeconds, section?.id]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (section?.id) {
        saveLocalDraft(section.id, {
          answers,
          remainingSeconds,
          savedAt: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [answers, remainingSeconds, section?.id]);

  useEffect(() => {
    if (remainingSeconds === 0 && section?.status !== 'completed') {
      handleSubmit();
    }
  }, [remainingSeconds, section?.status, handleSubmit]);

  useEffect(() => {
    if (section?.status === 'completed') {
      navigate(`/official-exams/toefl-reading/${attemptId}/results`);
    }
  }, [attemptId, navigate, section?.status]);

  if (isAttemptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading TOEFL Reading...
      </div>
    );
  }

  if (attemptError || !attempt || !section) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">TOEFL Reading error</h1>
        <p className="mt-3 text-sm text-danger-text">
          {attemptError || 'Attempt not found.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[88px] z-10 rounded-[1.5rem] bg-surface/95 p-5 shadow-[var(--shadow-card)] ring-1 ring-border backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-text-muted">TOEFL iBT</p>
            <h1 className="text-2xl font-bold text-text">Reading Section</h1>
            <p className="mt-1 text-sm text-text-muted">
              Answered {answeredCount} / {totalQuestions}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
              <Clock size={18} />
              {formatTime(remainingSeconds)}
            </div>

            <button
              type="button"
              onClick={() => handleSaveProgress()}
              disabled={isSaving || isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={isSaving || isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-warning-soft hover:text-warning-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={16} />
              Save & Exit
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isSaving}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Section'}
            </button>
          </div>
        </div>

        {saveMessage && (
          <p className="mt-4 text-sm text-success-text">{saveMessage}</p>
        )}

        {submitError && (
          <p className="mt-4 text-sm text-danger-text">{submitError}</p>
        )}
      </div>

      <ToeflReadingTask
        task={task}
        answers={answers}
        onChange={handleAnswersChange}
      />
    </div>
  );
}