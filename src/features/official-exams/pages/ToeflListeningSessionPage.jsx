import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, LogOut, Pause, Save } from 'lucide-react';
import { useToeflListeningAttempt } from '../../../hooks/useToeflListeningAttempt';
import {
  evaluateToeflListeningSection,
  generateToeflListeningAudio,
  saveToeflListeningProgress,
} from '../../../lib/db/toeflExam';
import ToeflListeningTask from '../components/ToeflListeningTask';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

function getLocalStorageKey(sectionId) {
  return `solang-toefl-listening-draft-${sectionId}`;
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

export default function ToeflListeningSessionPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const {
    attempt,
    section,
    isAttemptLoading,
    attemptError,
    refreshAttempt,
  } = useToeflListeningAttempt(attemptId);

  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState({});
  const [playedItemIds, setPlayedItemIds] = useState([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(36 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingAudioItemId, setGeneratingAudioItemId] = useState(null);
  const [isAudioBusy, setIsAudioBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const dirtyRef = useRef(false);
  const hasLoadedDraftRef = useRef(false);

  const task = section?.content || null;

  const isTimerPaused = isAudioBusy || Boolean(generatingAudioItemId);

  const totalQuestions = useMemo(() => {
    const items = task?.content?.items || [];

    return items.reduce(
      (total, item) => total + (item.questions?.length || 0),
      0
    );
  }, [task]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(Boolean).length;
  }, [answers]);

  const markDirtyAndSetAnswers = (nextAnswers) => {
    setAnswers(nextAnswers);
    dirtyRef.current = true;
  };

  const markDirtyAndSetNotes = (nextNotes) => {
    setNotes(nextNotes);
    dirtyRef.current = true;
  };

  const markDirtyAndSetPlayedItemIds = (nextPlayedItemIds) => {
    setPlayedItemIds(nextPlayedItemIds);
    dirtyRef.current = true;
  };

  const markDirtyAndSetCurrentItemIndex = (nextIndex) => {
    setCurrentItemIndex(nextIndex);
    dirtyRef.current = true;
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
        const savedSection = await saveToeflListeningProgress({
          sectionId: section.id,
          answers,
          remainingSeconds,
          playedItemIds,
          currentItemIndex,
          notes,
        });

        dirtyRef.current = false;

        saveLocalDraft(section.id, {
          answers,
          remainingSeconds,
          playedItemIds,
          currentItemIndex,
          notes,
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
    [
      answers,
      currentItemIndex,
      notes,
      playedItemIds,
      remainingSeconds,
      section?.id,
      section?.status,
    ]
  );

  const handleGenerateAudio = async (item) => {
    if (!section?.id || !item?.id) return;

    setGeneratingAudioItemId(item.id);
    setIsAudioBusy(true);
    setSubmitError('');
    setSaveMessage('');

    try {
      await handleSaveProgress({ silent: true });

      await generateToeflListeningAudio({
        sectionId: section.id,
        itemId: item.id,
      });

      await refreshAttempt();

      setSaveMessage('Audio generated.');
    } catch (error) {
      setSubmitError(error.message || 'Failed to generate listening audio.');
      throw error;
    } finally {
      setGeneratingAudioItemId(null);
      setIsAudioBusy(false);
    }
  };

  const handleSaveAndExit = async () => {
    const shouldExit = window.confirm(
      'Save your TOEFL Listening progress and leave this section?'
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
      await evaluateToeflListeningSection({
        sectionId: section.id,
        answers,
      });

      clearLocalDraft(section.id);
      navigate(`/official-exams/toefl-listening/${attemptId}/results`);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit TOEFL Listening.');
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
    setNotes(section.metadata?.notes || localDraft?.notes || {});
    setPlayedItemIds(
      section.metadata?.played_item_ids || localDraft?.playedItemIds || []
    );
    setCurrentItemIndex(
      Number.isInteger(section.metadata?.current_item_index)
        ? section.metadata.current_item_index
        : localDraft?.currentItemIndex || 0
    );

    setRemainingSeconds(
      databaseRemainingSeconds ||
        localDraft?.remainingSeconds ||
        (section.duration_minutes || 36) * 60
    );

    hasLoadedDraftRef.current = true;
  }, [section?.id, section?.answers, section?.duration_minutes, section?.metadata]);

  useEffect(() => {
    if (!section || section.status === 'completed') return undefined;
    if (isSubmitting) return undefined;
    if (isTimerPaused) return undefined;

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
  }, [section, isSubmitting, isTimerPaused]);

  useEffect(() => {
    if (!section?.id || section.status !== 'in_progress') return undefined;

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
      playedItemIds,
      currentItemIndex,
      notes,
      savedAt: new Date().toISOString(),
    });
  }, [
    answers,
    currentItemIndex,
    notes,
    playedItemIds,
    remainingSeconds,
    section?.id,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (section?.id) {
        saveLocalDraft(section.id, {
          answers,
          remainingSeconds,
          playedItemIds,
          currentItemIndex,
          notes,
          savedAt: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    answers,
    currentItemIndex,
    notes,
    playedItemIds,
    remainingSeconds,
    section?.id,
  ]);

  useEffect(() => {
    if (remainingSeconds === 0 && section?.status !== 'completed') {
      handleSubmit();
    }
  }, [remainingSeconds, section?.status, handleSubmit]);

  useEffect(() => {
    if (section?.status === 'completed') {
      navigate(`/official-exams/toefl-listening/${attemptId}/results`);
    }
  }, [attemptId, navigate, section?.status]);

  if (isAttemptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading TOEFL Listening...
      </div>
    );
  }

  if (attemptError || !attempt || !section) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">TOEFL Listening error</h1>
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
            <h1 className="text-2xl font-bold text-text">Listening Section</h1>
            <p className="mt-1 text-sm text-text-muted">
              Answered {answeredCount} / {totalQuestions}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={[
                'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold',
                isTimerPaused
                  ? 'bg-warning-soft text-warning-text'
                  : 'bg-primary-soft text-primary',
              ].join(' ')}
            >
              {isTimerPaused ? <Pause size={18} /> : <Clock size={18} />}
              {formatTime(remainingSeconds)}
              {isTimerPaused && <span>Paused</span>}
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

        {isTimerPaused && (
          <p className="mt-4 text-sm text-warning-text">
            Timer paused while Solang is generating or loading exam audio.
          </p>
        )}

        {saveMessage && (
          <p className="mt-4 text-sm text-success-text">{saveMessage}</p>
        )}

        {submitError && (
          <p className="mt-4 text-sm text-danger-text">{submitError}</p>
        )}
      </div>

      <ToeflListeningTask
        task={task}
        answers={answers}
        onAnswersChange={markDirtyAndSetAnswers}
        notes={notes}
        onNotesChange={markDirtyAndSetNotes}
        playedItemIds={playedItemIds}
        onPlayedItemIdsChange={markDirtyAndSetPlayedItemIds}
        currentItemIndex={currentItemIndex}
        onCurrentItemIndexChange={markDirtyAndSetCurrentItemIndex}
        onGenerateAudio={handleGenerateAudio}
        generatingAudioItemId={generatingAudioItemId}
        onAudioBusyChange={setIsAudioBusy}
      />
    </div>
  );
}