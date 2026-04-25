import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleStop,
  Headphones,
  Lock,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Upload,
} from 'lucide-react';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

function formatTaskType(type) {
  return String(type || 'speaking_task')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSupportedMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function getRecordedCount(tasks) {
  return tasks.filter((task) => task.responseAudioUrl || task.responseAudioPath)
    .length;
}

function requiresStimulusAudio(task) {
  return Boolean(task?.listeningTranscript);
}

function TaskNavigator({
  tasks,
  currentTaskIndex,
  onCurrentTaskIndexChange,
  stimulusPlayedTaskIds,
}) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <p className="mb-3 text-sm font-semibold text-text">Task Navigator</p>

      <div className="flex flex-wrap gap-2">
        {tasks.map((task, index) => {
          const isCurrent = index === currentTaskIndex;
          const isRecorded = Boolean(task.responseAudioUrl || task.responseAudioPath);
          const needsStimulus = requiresStimulusAudio(task);
          const stimulusPlayed = stimulusPlayedTaskIds.includes(task.id);

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onCurrentTaskIndexChange(index)}
              className={[
                'rounded-xl px-3 py-2 text-sm font-semibold transition',
                isCurrent
                  ? 'bg-primary text-white'
                  : isRecorded
                  ? 'bg-success-soft text-success-text'
                  : needsStimulus && !stimulusPlayed
                  ? 'bg-warning-soft text-warning-text'
                  : 'bg-surface-muted text-text-muted hover:bg-primary-soft hover:text-primary',
              ].join(' ')}
            >
              Task {task.taskNumber || index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PromptCard({ task }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-text-muted">
          Task {task.taskNumber} · {formatTaskType(task.taskType)}
        </p>

        <h2 className="mt-1 text-xl font-semibold text-text">{task.title}</h2>

        {task.prompt && (
          <p className="mt-4 text-sm leading-7 text-text-muted">{task.prompt}</p>
        )}
      </div>

      {task.readingText && (
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm font-semibold text-text">Reading passage</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">
            {task.readingText}
          </p>
        </div>
      )}

      <div className="rounded-[1.5rem] bg-primary-soft p-5 ring-1 ring-primary/20">
        <p className="text-sm font-semibold text-primary">Question</p>
        <p className="mt-3 text-sm leading-7 text-text">{task.question}</p>
      </div>
    </div>
  );
}

function StimulusAudioPanel({
  task,
  stimulusPlayedTaskIds,
  onStimulusPlayedTaskIdsChange,
  onGenerateStimulusAudio,
  isGeneratingStimulus,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');

  const needsStimulus = requiresStimulusAudio(task);
  const hasStimulusAudio = Boolean(task.stimulusAudioUrl);
  const hasPlayedStimulus = stimulusPlayedTaskIds.includes(task.id);

  useEffect(() => {
    setIsPlaying(false);
    setAudioError('');
  }, [task.id]);

  const handlePlayStimulus = async () => {
    if (!audioRef.current || hasPlayedStimulus || !hasStimulusAudio) return;

    setAudioError('');

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      setAudioError(error.message || 'Stimulus audio could not start.');
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);

    if (!stimulusPlayedTaskIds.includes(task.id)) {
      onStimulusPlayedTaskIdsChange([...stimulusPlayedTaskIds, task.id]);
    }
  };

  if (!needsStimulus) {
    return (
      <div className="rounded-[1.5rem] bg-success-soft p-4 text-sm font-semibold text-success-text">
        This independent task does not require stimulus audio.
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Headphones size={20} />
        </div>

        <div>
          <h3 className="font-semibold text-text">Stimulus audio</h3>
          <p className="mt-1 text-sm leading-7 text-text-muted">
            Listen to the stimulus audio before preparing your answer. For exam
            realism, the transcript is not displayed.
          </p>
        </div>
      </div>

      {hasStimulusAudio && (
        <audio
          ref={audioRef}
          src={task.stimulusAudioUrl}
          preload="auto"
          onEnded={handleAudioEnded}
          onError={() => setAudioError('Stimulus audio failed to load.')}
        />
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {!hasStimulusAudio && (
          <button
            type="button"
            onClick={() => onGenerateStimulusAudio(task)}
            disabled={isGeneratingStimulus}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles size={16} />
            {isGeneratingStimulus ? 'Generating audio...' : 'Generate stimulus audio'}
          </button>
        )}

        {hasStimulusAudio && (
          <button
            type="button"
            onClick={handlePlayStimulus}
            disabled={hasPlayedStimulus || isPlaying}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hasPlayedStimulus ? (
              <>
                <Lock size={16} />
                Stimulus already played
              </>
            ) : isPlaying ? (
              'Playing...'
            ) : (
              <>
                <Play size={16} />
                Play stimulus
              </>
            )}
          </button>
        )}
      </div>

      {audioError && <p className="mt-4 text-sm text-danger-text">{audioError}</p>}

      {hasPlayedStimulus && (
        <p className="mt-4 rounded-2xl bg-success-soft p-3 text-sm font-semibold text-success-text">
          Stimulus completed. You can now prepare and record your answer.
        </p>
      )}
    </div>
  );
}

function RecorderPanel({
  task,
  stimulusPlayedTaskIds,
  isUploading,
  onUploadAudio,
}) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);

  const [phase, setPhase] = useState('idle');
  const [prepRemaining, setPrepRemaining] = useState(task.prepTimeSec || 15);
  const [recordRemaining, setRecordRemaining] = useState(task.responseTimeSec || 60);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [recorderError, setRecorderError] = useState('');

  const existingAudioUrl = task.responseAudioUrl || '';
  const audioUrl = recordedUrl || existingAudioUrl;

  const needsStimulus = requiresStimulusAudio(task);
  const stimulusReady = !needsStimulus || stimulusPlayedTaskIds.includes(task.id);

  useEffect(() => {
    setPhase('idle');
    setPrepRemaining(task.prepTimeSec || 15);
    setRecordRemaining(task.responseTimeSec || 60);
    setRecordedBlob(null);
    setRecordedUrl('');
    setRecordedDurationSec(0);
    setRecorderError('');

    return () => {
      if (recordedUrl && recordedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    if (phase !== 'preparing') return undefined;

    if (prepRemaining <= 0) {
      setPhase('ready');
      return undefined;
    }

    const interval = window.setInterval(() => {
      setPrepRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, prepRemaining]);

  useEffect(() => {
    if (phase !== 'recording') return undefined;

    if (recordRemaining <= 0) {
      stopRecording();
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRecordRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recordRemaining]);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startPreparation = () => {
    if (!stimulusReady) {
      setRecorderError('Listen to the stimulus audio before starting preparation.');
      return;
    }

    setRecorderError('');
    setPrepRemaining(task.prepTimeSec || 15);
    setRecordRemaining(task.responseTimeSec || 60);
    setPhase('preparing');
  };

  const startRecording = async () => {
    if (!stimulusReady) {
      setRecorderError('Listen to the stimulus audio before recording.');
      return;
    }

    setRecorderError('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        const durationSec = Math.round(
          (Date.now() - recordingStartedAtRef.current) / 1000
        );

        const url = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecordedDurationSec(durationSec);
        setPhase('recorded');

        cleanupStream();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordRemaining(task.responseTimeSec || 60);
      setPhase('recording');
    } catch (error) {
      cleanupStream();
      setRecorderError(
        error.message ||
          'Could not access your microphone. Check browser permissions.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupStream();
      setPhase('recorded');
    }
  };

  const resetRecording = () => {
    if (recordedUrl && recordedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(recordedUrl);
    }

    setRecordedBlob(null);
    setRecordedUrl('');
    setRecordedDurationSec(0);
    setPrepRemaining(task.prepTimeSec || 15);
    setRecordRemaining(task.responseTimeSec || 60);
    setPhase('idle');
    setRecorderError('');
  };

  const handleUpload = async () => {
    if (!recordedBlob) {
      setRecorderError('Record a new response before uploading.');
      return;
    }

    await onUploadAudio(task, recordedBlob, recordedDurationSec);
  };

  return (
    <div className="space-y-5">
      {!stimulusReady && (
        <div className="rounded-[1.5rem] bg-warning-soft p-4 text-sm font-semibold text-warning-text">
          The response recorder is locked until you listen to the stimulus audio.
        </div>
      )}

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <Timer size={20} />
          </div>

          <div>
            <h3 className="font-semibold text-text">Timing</h3>
            <p className="mt-1 text-sm text-text-muted">
              Preparation: {task.prepTimeSec}s · Response: {task.responseTimeSec}s
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm text-text-muted">Preparation timer</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {formatTime(prepRemaining)}
            </p>
          </div>

          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm text-text-muted">Recording timer</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {formatTime(recordRemaining)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h3 className="font-semibold text-text">Record your answer</h3>

        <p className="mt-2 text-sm leading-7 text-text-muted">
          Use your microphone to record your spoken response. You can re-record
          before uploading.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startPreparation}
            disabled={
              !stimulusReady ||
              phase === 'preparing' ||
              phase === 'recording' ||
              isUploading
            }
            className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start preparation
          </button>

          <button
            type="button"
            onClick={startRecording}
            disabled={
              !stimulusReady ||
              phase === 'preparing' ||
              phase === 'recording' ||
              isUploading
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mic size={16} />
            {phase === 'ready' ? 'Start response' : 'Record'}
          </button>

          <button
            type="button"
            onClick={stopRecording}
            disabled={phase !== 'recording'}
            className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-text transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CircleStop size={16} />
            Stop
          </button>

          <button
            type="button"
            onClick={resetRecording}
            disabled={phase === 'recording' || isUploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-warning-soft hover:text-warning-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={16} />
            Re-record
          </button>
        </div>

        {recorderError && (
          <p className="mt-4 text-sm text-danger-text">{recorderError}</p>
        )}
      </div>

      {audioUrl && (
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-success-soft p-3 text-success-text">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <h3 className="font-semibold text-text">Audio response</h3>
              <p className="text-sm text-text-muted">
                {existingAudioUrl
                  ? 'This task already has an uploaded response.'
                  : `Recorded duration: ${recordedDurationSec}s`}
              </p>
            </div>
          </div>

          <audio src={audioUrl} controls className="mt-4 w-full" />

          {recordedBlob && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={16} />
              {isUploading ? 'Uploading...' : 'Upload response'}
            </button>
          )}
        </div>
      )}

      {existingAudioUrl && (
        <div className="rounded-[1.5rem] bg-success-soft p-4 text-sm font-semibold text-success-text">
          Response uploaded for this task.
        </div>
      )}
    </div>
  );
}

export default function ToeflSpeakingTask({
  task,
  currentTaskIndex,
  onCurrentTaskIndexChange,
  stimulusPlayedTaskIds,
  onStimulusPlayedTaskIdsChange,
  onGenerateStimulusAudio,
  generatingStimulusTaskId,
  onUploadAudio,
  uploadingTaskId,
}) {
  const tasks = Array.isArray(task?.content?.tasks) ? task.content.tasks : [];
  const currentTask = tasks[currentTaskIndex] || tasks[0] || null;

  const recordedCount = useMemo(() => getRecordedCount(tasks), [tasks]);

  if (!currentTask) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 text-sm text-text-muted shadow-[var(--shadow-card)] ring-1 ring-border">
        No TOEFL Speaking content available.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm text-text-muted">TOEFL Speaking</p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {task?.title || 'Speaking Section'}
          </h2>

          <p className="mt-3 text-sm leading-7 text-text-muted">
            {task?.instructions ||
              'Listen when required, prepare, then record your spoken answer for each task.'}
          </p>

          <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
            Recorded {recordedCount} / {tasks.length}
          </div>
        </div>

        <TaskNavigator
          tasks={tasks}
          currentTaskIndex={currentTaskIndex}
          onCurrentTaskIndexChange={onCurrentTaskIndexChange}
          stimulusPlayedTaskIds={stimulusPlayedTaskIds}
        />

        <PromptCard task={currentTask} />

        <StimulusAudioPanel
          task={currentTask}
          stimulusPlayedTaskIds={stimulusPlayedTaskIds}
          onStimulusPlayedTaskIdsChange={onStimulusPlayedTaskIdsChange}
          onGenerateStimulusAudio={onGenerateStimulusAudio}
          isGeneratingStimulus={generatingStimulusTaskId === currentTask.id}
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              onCurrentTaskIndexChange(Math.max(0, currentTaskIndex - 1))
            }
            disabled={currentTaskIndex <= 0}
            className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={() =>
              onCurrentTaskIndexChange(
                Math.min(tasks.length - 1, currentTaskIndex + 1)
              )
            }
            disabled={currentTaskIndex >= tasks.length - 1}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Task
          </button>
        </div>
      </div>

      <RecorderPanel
        task={currentTask}
        stimulusPlayedTaskIds={stimulusPlayedTaskIds}
        isUploading={uploadingTaskId === currentTask.id}
        onUploadAudio={onUploadAudio}
      />
    </div>
  );
}