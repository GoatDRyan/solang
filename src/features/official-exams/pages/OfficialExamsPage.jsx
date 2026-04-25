import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  GraduationCap,
  Headphones,
  Mic,
  PenLine,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  abandonToeflListeningAttempt,
  abandonToeflReadingAttempt,
  abandonToeflSpeakingAttempt,
  abandonToeflWritingAttempt,
  getLatestInProgressToeflListeningSection,
  getLatestInProgressToeflReadingSection,
  getLatestInProgressToeflSpeakingSection,
  getLatestInProgressToeflWritingSection,
  startToeflListeningAttempt,
  startToeflReadingAttempt,
  startToeflSpeakingAttempt,
  startToeflWritingAttempt,
} from '../../../lib/db/toeflExam';

function formatSavedDate(value) {
  if (!value) return 'Recently saved';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRemainingTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes} min ${remainingSeconds}s`;
}

function getReadingLocalStorageKey(sectionId) {
  return `solang-toefl-reading-draft-${sectionId}`;
}

function getListeningLocalStorageKey(sectionId) {
  return `solang-toefl-listening-draft-${sectionId}`;
}

function getWritingLocalStorageKey(sectionId) {
  return `solang-toefl-writing-draft-${sectionId}`;
}

function getSpeakingLocalStorageKey(sectionId) {
  return `solang-toefl-speaking-draft-${sectionId}`;
}

function clearLocalDraft(key) {
  if (!key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local backup removal is optional.
  }
}

function ResumeCard({
  title,
  description,
  lastSavedAt,
  remainingSeconds,
  onResume,
  onDiscard,
  isDiscarding,
}) {
  return (
    <div className="rounded-[1.5rem] bg-primary-soft p-6 ring-1 ring-primary/20">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex rounded-2xl bg-surface p-3 text-primary">
            <RotateCcw size={22} />
          </div>

          <h2 className="mt-4 text-xl font-bold text-text">{title}</h2>

          <p className="mt-2 text-sm text-text-muted">{description}</p>

          <p className="mt-3 text-sm text-text-muted">
            Last saved: {formatSavedDate(lastSavedAt)}
          </p>

          <p className="mt-1 text-sm text-text-muted">
            Remaining time: {formatRemainingTime(remainingSeconds)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onResume}
            disabled={isDiscarding}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlayCircle size={18} />
            Resume
          </button>

          <button
            type="button"
            onClick={onDiscard}
            disabled={isDiscarding}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-surface px-5 py-3 text-sm font-semibold text-danger-text ring-1 ring-border transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={18} />
            {isDiscarding ? 'Discarding...' : 'Discard'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamSectionCard({
  icon: Icon,
  title,
  description,
  duration,
  scoreLabel,
  generationLabel,
  buttonLabel,
  isStarting,
  onStart,
}) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex rounded-2xl bg-primary-soft p-3 text-primary">
            <Icon size={24} />
          </div>

          <h2 className="mt-4 text-2xl font-bold text-text">{title}</h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
            {description}
          </p>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-text-muted">
              <Clock size={16} />
              {duration}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-text-muted">
              <GraduationCap size={16} />
              {scoreLabel}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-text-muted">
              <Sparkles size={16} />
              {generationLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isStarting ? 'Generating...' : buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default function OfficialExamsPage() {
  const navigate = useNavigate();

  const [savedReadingSection, setSavedReadingSection] = useState(null);
  const [savedListeningSection, setSavedListeningSection] = useState(null);
  const [savedWritingSection, setSavedWritingSection] = useState(null);
  const [savedSpeakingSection, setSavedSpeakingSection] = useState(null);

  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [isStartingReading, setIsStartingReading] = useState(false);
  const [isStartingListening, setIsStartingListening] = useState(false);
  const [isStartingWriting, setIsStartingWriting] = useState(false);
  const [isStartingSpeaking, setIsStartingSpeaking] = useState(false);

  const [isDiscardingReading, setIsDiscardingReading] = useState(false);
  const [isDiscardingListening, setIsDiscardingListening] = useState(false);
  const [isDiscardingWriting, setIsDiscardingWriting] = useState(false);
  const [isDiscardingSpeaking, setIsDiscardingSpeaking] = useState(false);

  const [error, setError] = useState('');

  const loadSavedAttempts = async () => {
    setIsLoadingSaved(true);
    setError('');

    try {
      const [
        readingSection,
        listeningSection,
        writingSection,
        speakingSection,
      ] = await Promise.all([
        getLatestInProgressToeflReadingSection(),
        getLatestInProgressToeflListeningSection(),
        getLatestInProgressToeflWritingSection(),
        getLatestInProgressToeflSpeakingSection(),
      ]);

      setSavedReadingSection(readingSection);
      setSavedListeningSection(listeningSection);
      setSavedWritingSection(writingSection);
      setSavedSpeakingSection(speakingSection);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load saved TOEFL attempts.');
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    loadSavedAttempts();
  }, []);

  const handleStartReading = async () => {
    setIsStartingReading(true);
    setError('');

    try {
      const data = await startToeflReadingAttempt();
      navigate(`/official-exams/toefl-reading/${data.attempt.id}`);
    } catch (startError) {
      setError(startError.message || 'Failed to start TOEFL Reading.');
    } finally {
      setIsStartingReading(false);
    }
  };

  const handleStartListening = async () => {
    setIsStartingListening(true);
    setError('');

    try {
      const data = await startToeflListeningAttempt();
      navigate(`/official-exams/toefl-listening/${data.attempt.id}`);
    } catch (startError) {
      setError(startError.message || 'Failed to start TOEFL Listening.');
    } finally {
      setIsStartingListening(false);
    }
  };

  const handleStartWriting = async () => {
    setIsStartingWriting(true);
    setError('');

    try {
      const data = await startToeflWritingAttempt();
      navigate(`/official-exams/toefl-writing/${data.attempt.id}`);
    } catch (startError) {
      setError(startError.message || 'Failed to start TOEFL Writing.');
    } finally {
      setIsStartingWriting(false);
    }
  };

  const handleStartSpeaking = async () => {
    setIsStartingSpeaking(true);
    setError('');

    try {
      const data = await startToeflSpeakingAttempt();
      navigate(`/official-exams/toefl-speaking/${data.attempt.id}`);
    } catch (startError) {
      setError(startError.message || 'Failed to start TOEFL Speaking.');
    } finally {
      setIsStartingSpeaking(false);
    }
  };

  const handleResumeReading = () => {
    if (!savedReadingSection?.attempt_id) return;

    navigate(`/official-exams/toefl-reading/${savedReadingSection.attempt_id}`);
  };

  const handleResumeListening = () => {
    if (!savedListeningSection?.attempt_id) return;

    navigate(
      `/official-exams/toefl-listening/${savedListeningSection.attempt_id}`
    );
  };

  const handleResumeWriting = () => {
    if (!savedWritingSection?.attempt_id) return;

    navigate(`/official-exams/toefl-writing/${savedWritingSection.attempt_id}`);
  };

  const handleResumeSpeaking = () => {
    if (!savedSpeakingSection?.attempt_id) return;

    navigate(`/official-exams/toefl-speaking/${savedSpeakingSection.attempt_id}`);
  };

  const handleDiscardReading = async () => {
    if (!savedReadingSection) return;

    const shouldDiscard = window.confirm(
      'Discard this saved TOEFL Reading attempt? This cannot be undone.'
    );

    if (!shouldDiscard) return;

    setIsDiscardingReading(true);
    setError('');

    try {
      await abandonToeflReadingAttempt(savedReadingSection);
      clearLocalDraft(getReadingLocalStorageKey(savedReadingSection.id));
      setSavedReadingSection(null);
    } catch (discardError) {
      setError(discardError.message || 'Failed to discard TOEFL Reading attempt.');
    } finally {
      setIsDiscardingReading(false);
    }
  };

  const handleDiscardListening = async () => {
    if (!savedListeningSection) return;

    const shouldDiscard = window.confirm(
      'Discard this saved TOEFL Listening attempt? This cannot be undone.'
    );

    if (!shouldDiscard) return;

    setIsDiscardingListening(true);
    setError('');

    try {
      await abandonToeflListeningAttempt(savedListeningSection);
      clearLocalDraft(getListeningLocalStorageKey(savedListeningSection.id));
      setSavedListeningSection(null);
    } catch (discardError) {
      setError(
        discardError.message || 'Failed to discard TOEFL Listening attempt.'
      );
    } finally {
      setIsDiscardingListening(false);
    }
  };

  const handleDiscardWriting = async () => {
    if (!savedWritingSection) return;

    const shouldDiscard = window.confirm(
      'Discard this saved TOEFL Writing attempt? This cannot be undone.'
    );

    if (!shouldDiscard) return;

    setIsDiscardingWriting(true);
    setError('');

    try {
      await abandonToeflWritingAttempt(savedWritingSection);
      clearLocalDraft(getWritingLocalStorageKey(savedWritingSection.id));
      setSavedWritingSection(null);
    } catch (discardError) {
      setError(discardError.message || 'Failed to discard TOEFL Writing attempt.');
    } finally {
      setIsDiscardingWriting(false);
    }
  };

  const handleDiscardSpeaking = async () => {
    if (!savedSpeakingSection) return;

    const shouldDiscard = window.confirm(
      'Discard this saved TOEFL Speaking attempt? This cannot be undone.'
    );

    if (!shouldDiscard) return;

    setIsDiscardingSpeaking(true);
    setError('');

    try {
      await abandonToeflSpeakingAttempt(savedSpeakingSection);
      clearLocalDraft(getSpeakingLocalStorageKey(savedSpeakingSection.id));
      setSavedSpeakingSection(null);
    } catch (discardError) {
      setError(discardError.message || 'Failed to discard TOEFL Speaking attempt.');
    } finally {
      setIsDiscardingSpeaking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Official Exams</p>
        <h1 className="mt-1 text-3xl font-bold text-text">TOEFL iBT Practice</h1>
        <p className="mt-2 text-sm text-text-muted">
          Practice TOEFL iBT sections with Gemini-generated tasks, audio
          recording, save/resume, scoring, and Error DNA updates.
        </p>
      </div>

      {error && (
        <div className="rounded-[1.5rem] bg-surface p-4 text-sm text-danger-text shadow-[var(--shadow-card)] ring-1 ring-border">
          {error}
        </div>
      )}

      {!isLoadingSaved && savedReadingSection && (
        <ResumeCard
          title="Resume saved TOEFL Reading attempt"
          description="You have an unfinished Reading section."
          lastSavedAt={
            savedReadingSection.metadata?.last_saved_at ||
            savedReadingSection.updated_at
          }
          remainingSeconds={
            savedReadingSection.metadata?.remaining_seconds ||
            savedReadingSection.duration_minutes * 60
          }
          onResume={handleResumeReading}
          onDiscard={handleDiscardReading}
          isDiscarding={isDiscardingReading}
        />
      )}

      {!isLoadingSaved && savedListeningSection && (
        <ResumeCard
          title="Resume saved TOEFL Listening attempt"
          description="You have an unfinished Listening section."
          lastSavedAt={
            savedListeningSection.metadata?.last_saved_at ||
            savedListeningSection.updated_at
          }
          remainingSeconds={
            savedListeningSection.metadata?.remaining_seconds ||
            savedListeningSection.duration_minutes * 60
          }
          onResume={handleResumeListening}
          onDiscard={handleDiscardListening}
          isDiscarding={isDiscardingListening}
        />
      )}

      {!isLoadingSaved && savedWritingSection && (
        <ResumeCard
          title="Resume saved TOEFL Writing attempt"
          description="You have an unfinished Writing section."
          lastSavedAt={
            savedWritingSection.metadata?.last_saved_at ||
            savedWritingSection.updated_at
          }
          remainingSeconds={
            savedWritingSection.metadata?.remaining_seconds ||
            savedWritingSection.duration_minutes * 60
          }
          onResume={handleResumeWriting}
          onDiscard={handleDiscardWriting}
          isDiscarding={isDiscardingWriting}
        />
      )}

      {!isLoadingSaved && savedSpeakingSection && (
        <ResumeCard
          title="Resume saved TOEFL Speaking attempt"
          description="You have an unfinished Speaking section with audio responses."
          lastSavedAt={
            savedSpeakingSection.metadata?.last_saved_at ||
            savedSpeakingSection.updated_at
          }
          remainingSeconds={
            savedSpeakingSection.metadata?.remaining_seconds ||
            savedSpeakingSection.duration_minutes * 60
          }
          onResume={handleResumeSpeaking}
          onDiscard={handleDiscardSpeaking}
          isDiscarding={isDiscardingSpeaking}
        />
      )}

      <div className="grid gap-6">
        <ExamSectionCard
          icon={BookOpen}
          title="TOEFL iBT Reading"
          description="Practice a TOEFL-style Reading section with academic passages, timed completion, automatic scoring, save system, and Error DNA updates based on weak question types."
          duration="35 minutes"
          scoreLabel="Score /30"
          generationLabel="Gemini-generated"
          buttonLabel="Start New Reading Section"
          isStarting={isStartingReading}
          onStart={handleStartReading}
        />

        <ExamSectionCard
          icon={Headphones}
          title="TOEFL iBT Listening"
          description="Practice a TOEFL-style Listening section with campus and academic listening items, note-taking, one-time playback, automatic scoring, and Error DNA updates."
          duration="36 minutes"
          scoreLabel="Score /30"
          generationLabel="Gemini TTS audio"
          buttonLabel="Start New Listening Section"
          isStarting={isStartingListening}
          onStart={handleStartListening}
        />

        <ExamSectionCard
          icon={Mic}
          title="TOEFL iBT Speaking"
          description="Practice TOEFL Speaking with 4 generated tasks, preparation timers, real microphone recording, audio upload, Gemini audio evaluation, score /30, and Error DNA updates."
          duration="16 minutes"
          scoreLabel="Score /30"
          generationLabel="Audio recording + Gemini evaluation"
          buttonLabel="Start New Speaking Section"
          isStarting={isStartingSpeaking}
          onStart={handleStartSpeaking}
        />

        <ExamSectionCard
          icon={PenLine}
          title="TOEFL iBT Writing"
          description="Practice the current TOEFL Writing format with Build a Sentence, Write an Email, and Academic Discussion. Solang evaluates your responses, gives detailed feedback, and updates Error DNA."
          duration="23 minutes"
          scoreLabel="Score /6 + /30 compatibility"
          generationLabel="Gemini evaluation"
          buttonLabel="Start New Writing Section"
          isStarting={isStartingWriting}
          onStart={handleStartWriting}
        />
      </div>
    </div>
  );
}