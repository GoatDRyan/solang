import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, LogOut, Pause, Save } from 'lucide-react';
import { useToeflSpeakingAttempt } from '../../../hooks/useToeflSpeakingAttempt';
import {
  evaluateToeflSpeakingSection,
  generateToeflSpeakingStimulusAudio,
  saveToeflSpeakingProgress,
  uploadToeflSpeakingAudio,
} from '../../../lib/db/toeflExam';
import ToeflSpeakingTask from '../components/ToeflSpeakingTask';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

function getLocalStorageKey(sectionId) {
  return `solang-toefl-speaking-draft-${sectionId}`;
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

function getTasks(task) {
  return Array.isArray(task?.content?.tasks) ? task.content.tasks : [];
}

function getRecordedCount(task) {
  return getTasks(task).filter(
    (item) => item.responseAudioUrl || item.responseAudioPath
  ).length;
}

function getTaskCount(task) {
  return getTasks(task).length;
}

function getMissingStimulusTasks(task, stimulusPlayedTaskIds) {
  return getTasks(task).filter(
    (item) => item.listeningTranscript && !stimulusPlayedTaskIds.includes(item.id)
  );
}

export default function ToeflSpeakingSessionPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const {
    attempt,
    section,
    isAttemptLoading,
    attemptError,
    refreshAttempt,
  } = useToeflSpeakingAttempt(attemptId);

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(16 * 60);
  const [stimulusPlayedTaskIds, setStimulusPlayedTaskIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [generatingStimulusTaskId, setGeneratingStimulusTaskId] = useState(null);
  const [isAudioBusy, setIsAudioBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const dirtyRef = useRef(false);
  const hasLoadedDraftRef = useRef(false);

  const task = section?.content || null;

  const isTimerPaused = isAudioBusy || Boolean(generatingStimulusTaskId);

  const totalTasks = useMemo(() => getTaskCount(task), [task]);
  const recordedCount = useMemo(() => getRecordedCount(task), [task]);

  const markDirtyAndSetCurrentTaskIndex = (nextIndex) => {
    setCurrentTaskIndex(nextIndex);
    dirtyRef.current = true;
  };

  const markDirtyAndSetStimulusPlayedTaskIds = (nextIds) => {
    setStimulusPlayedTaskIds(nextIds);
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
        const savedSection = await saveToeflSpeakingProgress({
          sectionId: section.id,
          remainingSeconds,
          currentTaskIndex,
          stimulusPlayedTaskIds,
        });

        dirtyRef.current = false;

        saveLocalDraft(section.id, {
          remainingSeconds,
          currentTaskIndex,
          stimulusPlayedTaskIds,
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
      currentTaskIndex,
      remainingSeconds,
      section?.id,
      section?.status,
      stimulusPlayedTaskIds,
    ]
  );

  const handleGenerateStimulusAudio = async (speakingTask) => {
    if (!section?.id || !speakingTask?.id) return;

    setGeneratingStimulusTaskId(speakingTask.id);
    setIsAudioBusy(true);
    setSubmitError('');
    setSaveMessage('');

    try {
      await handleSaveProgress({ silent: true });

      await generateToeflSpeakingStimulusAudio({
        sectionId: section.id,
        taskId: speakingTask.id,
      });

      await refreshAttempt();

      setSaveMessage('Stimulus audio generated.');
    } catch (error) {
      setSubmitError(error.message || 'Failed to generate stimulus audio.');
      throw error;
    } finally {
      setGeneratingStimulusTaskId(null);
      setIsAudioBusy(false);
    }
  };

  const handleUploadAudio = async (speakingTask, audioBlob, durationSec) => {
    if (!section?.id || !speakingTask?.id) return;

    setUploadingTaskId(speakingTask.id);
    setSubmitError('');
    setSaveMessage('');

    try {
      await uploadToeflSpeakingAudio({
        sectionId: section.id,
        taskId: speakingTask.id,
        audioBlob,
        durationSec,
      });

      await refreshAttempt();

      setSaveMessage('Audio response uploaded.');
    } catch (error) {
      setSubmitError(error.message || 'Failed to upload speaking audio.');
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleSaveAndExit = async () => {
    const shouldExit = window.confirm(
      'Save your TOEFL Speaking progress and leave this section?'
    );

    if (!shouldExit) return;

    await handleSaveProgress();
    navigate('/official-exams');
  };

  const handleSubmit = useCallback(async () => {
    if (!section?.id || isSubmitting) return;

    if (recordedCount < totalTasks) {
      setSubmitError(
        `You must upload all ${totalTasks} speaking responses before submitting.`
      );
      return;
    }

    const missingStimulusTasks = getMissingStimulusTasks(task, stimulusPlayedTaskIds);

    if (missingStimulusTasks.length > 0) {
      setSubmitError(
        `You must listen to the stimulus audio for: ${missingStimulusTasks
          .map((item) => item.title || item.id)
          .join(', ')}.`
      );
      return;
    }

    const shouldSubmit = window.confirm(
      'Submit your TOEFL Speaking section for audio evaluation? You will not be able to edit it after submission.'
    );

    if (!shouldSubmit) return;

    setIsSubmitting(true);
    setSubmitError('');
    setSaveMessage('');

    try {
      await handleSaveProgress({ silent: true });

      await evaluateToeflSpeakingSection({
        sectionId: section.id,
      });

      clearLocalDraft(section.id);
      navigate(`/official-exams/toefl-speaking/${attemptId}/results`);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit TOEFL Speaking.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    attemptId,
    handleSaveProgress,
    isSubmitting,
    navigate,
    recordedCount,
    section?.id,
    stimulusPlayedTaskIds,
    task,
    totalTasks,
  ]);

  useEffect(() => {
    if (!section?.id || hasLoadedDraftRef.current) return;

    const localDraft = getSavedLocalDraft(section.id);

    const databaseRemainingSeconds =
      typeof section.metadata?.remaining_seconds === 'number'
        ? section.metadata.remaining_seconds
        : null;

    setCurrentTaskIndex(
      Number.isInteger(section.metadata?.current_task_index)
        ? section.metadata.current_task_index
        : localDraft?.currentTaskIndex || 0
    );

    setStimulusPlayedTaskIds(
      section.metadata?.stimulus_played_task_ids ||
        localDraft?.stimulusPlayedTaskIds ||
        []
    );

    setRemainingSeconds(
      databaseRemainingSeconds ||
        localDraft?.remainingSeconds ||
        (section.duration_minutes || 16) * 60
    );

    hasLoadedDraftRef.current = true;
  }, [section?.id, section?.duration_minutes, section?.metadata]);

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
      remainingSeconds,
      currentTaskIndex,
      stimulusPlayedTaskIds,
      savedAt: new Date().toISOString(),
    });
  }, [currentTaskIndex, remainingSeconds, section?.id, stimulusPlayedTaskIds]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (section?.id) {
        saveLocalDraft(section.id, {
          remainingSeconds,
          currentTaskIndex,
          stimulusPlayedTaskIds,
          savedAt: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentTaskIndex, remainingSeconds, section?.id, stimulusPlayedTaskIds]);

  useEffect(() => {
    if (section?.status === 'completed') {
      navigate(`/official-exams/toefl-speaking/${attemptId}/results`);
    }
  }, [attemptId, navigate, section?.status]);

  if (isAttemptLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading TOEFL Speaking...
      </div>
    );
  }

  if (attemptError || !attempt || !section) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">TOEFL Speaking error</h1>
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
            <h1 className="text-2xl font-bold text-text">Speaking Section</h1>
            <p className="mt-1 text-sm text-text-muted">
              Recorded {recordedCount} / {totalTasks}
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
              disabled={
                isSubmitting ||
                isSaving ||
                Boolean(uploadingTaskId) ||
                Boolean(generatingStimulusTaskId)
              }
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Evaluating...' : 'Submit Section'}
            </button>
          </div>
        </div>

        {isTimerPaused && (
          <p className="mt-4 text-sm text-warning-text">
            Timer paused while Solang is generating or loading stimulus audio.
          </p>
        )}

        {saveMessage && (
          <p className="mt-4 text-sm text-success-text">{saveMessage}</p>
        )}

        {submitError && (
          <p className="mt-4 text-sm text-danger-text">{submitError}</p>
        )}
      </div>

      <ToeflSpeakingTask
        task={task}
        currentTaskIndex={currentTaskIndex}
        onCurrentTaskIndexChange={markDirtyAndSetCurrentTaskIndex}
        stimulusPlayedTaskIds={stimulusPlayedTaskIds}
        onStimulusPlayedTaskIdsChange={markDirtyAndSetStimulusPlayedTaskIds}
        onGenerateStimulusAudio={handleGenerateStimulusAudio}
        generatingStimulusTaskId={generatingStimulusTaskId}
        onUploadAudio={handleUploadAudio}
        uploadingTaskId={uploadingTaskId}
        onAudioBusyChange={setIsAudioBusy}
      />
    </div>
  );
}