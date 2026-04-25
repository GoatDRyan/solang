import { useMemo, useRef, useState } from 'react';
import { Headphones, Lock, Play, Sparkles, StickyNote } from 'lucide-react';

function formatQuestionType(type) {
  return String(type || 'question')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOptionLabel(option, index) {
  return option?.label || String.fromCharCode(65 + index);
}

function getOptionText(option) {
  return typeof option === 'string' ? option : option?.text || '';
}

function getItemLabel(item) {
  if (item.audioType === 'conversation') return 'Conversation';
  return 'Lecture';
}

export default function ToeflListeningTask({
  task,
  answers,
  onAnswersChange,
  notes,
  onNotesChange,
  playedItemIds,
  onPlayedItemIdsChange,
  currentItemIndex,
  onCurrentItemIndexChange,
  onGenerateAudio,
  generatingAudioItemId,
}) {
  const audioRef = useRef(null);

  const items = Array.isArray(task?.content?.items) ? task.content.items : [];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');

  const currentItem = items[currentItemIndex] || null;
  const questions = currentItem?.questions || [];
  const currentQuestion = questions[currentQuestionIndex] || null;

  const hasPlayedCurrentItem = currentItem
    ? playedItemIds.includes(currentItem.id)
    : false;

  const hasAudio = Boolean(currentItem?.audioUrl);
  const isGeneratingCurrentAudio =
    currentItem && generatingAudioItemId === currentItem.id;

  const answeredCount = useMemo(() => {
    return items
      .flatMap((item) => item.questions || [])
      .filter((question) => Boolean(answers[question.id])).length;
  }, [answers, items]);

  const totalQuestions = useMemo(() => {
    return items.reduce(
      (total, item) => total + (item.questions?.length || 0),
      0
    );
  }, [items]);

  const setAnswer = (questionId, optionLabel) => {
    onAnswersChange({
      ...answers,
      [questionId]: optionLabel,
    });
  };

  const setNote = (itemId, value) => {
    onNotesChange({
      ...notes,
      [itemId]: value,
    });
  };

  const handleStartAudio = async () => {
    if (!audioRef.current || !currentItem || hasPlayedCurrentItem || !hasAudio) {
      return;
    }

    setAudioError('');

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setIsAudioPlaying(true);
    } catch (error) {
      setAudioError(
        error.message || 'Audio could not start. Please try again.'
      );
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);

    if (!currentItem) return;

    if (!playedItemIds.includes(currentItem.id)) {
      onPlayedItemIdsChange([...playedItemIds, currentItem.id]);
    }

    setCurrentQuestionIndex(0);
  };

  const goToItem = (nextIndex) => {
    const target = items[nextIndex];

    if (!target) return;

    if (isAudioPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }

    onCurrentItemIndexChange(nextIndex);
    setCurrentQuestionIndex(0);
    setAudioError('');
  };

  if (!currentItem) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 text-sm text-text-muted shadow-[var(--shadow-card)] ring-1 ring-border">
        No TOEFL Listening content available.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm text-text-muted">TOEFL Listening</p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {task?.title || 'Listening Section'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            {task?.instructions ||
              'Listen to each audio once, take notes, then answer the questions.'}
          </p>

          <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
            Answered {answeredCount} / {totalQuestions}
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm text-text-muted">
            Item {currentItemIndex + 1} of {items.length}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-text">
            {getItemLabel(currentItem)} · {currentItem.title}
          </h3>

          <p className="mt-2 text-sm text-text-muted">{currentItem.topic}</p>

          {currentItem.setting && (
            <p className="mt-1 text-sm text-text-muted">
              Setting: {currentItem.setting}
            </p>
          )}

          <div className="mt-5 rounded-2xl bg-surface-muted p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary-soft p-2 text-primary">
                <Headphones size={18} />
              </div>

              <div>
                <p className="font-semibold text-text">Audio rules</p>
                <p className="mt-1 text-sm leading-7 text-text-muted">
                  Generate the audio when you are ready. You can play each audio
                  once. Questions become available after the audio ends.
                </p>
              </div>
            </div>

            {hasAudio && (
              <audio
                ref={audioRef}
                src={currentItem.audioUrl}
                preload="auto"
                onEnded={handleAudioEnded}
                onError={() =>
                  setAudioError('Audio failed to load. Check the generated audio URL.')
                }
              />
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {!hasAudio && (
                <button
                  type="button"
                  onClick={() => onGenerateAudio(currentItem)}
                  disabled={isGeneratingCurrentAudio}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  {isGeneratingCurrentAudio ? 'Generating audio...' : 'Generate audio'}
                </button>
              )}

              {hasAudio && (
                <button
                  type="button"
                  onClick={handleStartAudio}
                  disabled={hasPlayedCurrentItem || isAudioPlaying}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hasPlayedCurrentItem ? (
                    <>
                      <Lock size={16} />
                      Audio already played
                    </>
                  ) : isAudioPlaying ? (
                    'Playing...'
                  ) : (
                    <>
                      <Play size={16} />
                      Start audio
                    </>
                  )}
                </button>
              )}
            </div>

            {audioError && (
              <p className="mt-3 text-sm text-danger-text">{audioError}</p>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary-soft p-2 text-primary">
              <StickyNote size={18} />
            </div>

            <div>
              <h3 className="font-semibold text-text">Notes</h3>
              <p className="text-sm text-text-muted">
                Take notes while listening.
              </p>
            </div>
          </div>

          <textarea
            value={notes[currentItem.id] || ''}
            onChange={(event) => setNote(currentItem.id, event.target.value)}
            rows={8}
            className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary focus:bg-surface"
            placeholder="Write your listening notes here..."
          />
        </div>

        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="mb-3 text-sm font-semibold text-text">Audio Navigator</p>

          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => {
              const isCurrent = index === currentItemIndex;
              const isPlayed = playedItemIds.includes(item.id);
              const itemHasAudio = Boolean(item.audioUrl);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToItem(index)}
                  className={[
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    isCurrent
                      ? 'bg-primary text-white'
                      : isPlayed
                      ? 'bg-success-soft text-success-text'
                      : itemHasAudio
                      ? 'bg-primary-soft text-primary'
                      : 'bg-surface-muted text-text-muted hover:bg-primary-soft hover:text-primary',
                  ].join(' ')}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {!hasAudio ? (
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <div className="rounded-2xl bg-primary-soft p-4 text-primary">
              <p className="font-semibold">Audio not generated yet</p>
              <p className="mt-2 text-sm leading-7">
                Generate the audio first. Then listen to it once before answering
                the questions.
              </p>
            </div>
          </div>
        ) : !hasPlayedCurrentItem ? (
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <div className="rounded-2xl bg-primary-soft p-4 text-primary">
              <p className="font-semibold">Questions locked</p>
              <p className="mt-2 text-sm leading-7">
                Listen to the full audio first. The questions will appear after
                the audio ends.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
              <p className="text-sm text-text-muted">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>

              <h3 className="mt-1 text-lg font-semibold text-text">
                {formatQuestionType(currentQuestion?.type)}
              </h3>

              <p className="mt-4 text-sm leading-7 text-text">
                {currentQuestion?.question}
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
              <div className="space-y-3">
                {(currentQuestion?.options || []).map((option, index) => {
                  const label = getOptionLabel(option, index);
                  const text = getOptionText(option);
                  const isSelected = answers[currentQuestion.id] === label;

                  return (
                    <button
                      key={`${currentQuestion.id}-${label}`}
                      type="button"
                      onClick={() => setAnswer(currentQuestion.id, label)}
                      className={[
                        'w-full rounded-2xl border px-4 py-3 text-left text-sm transition',
                        isSelected
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border bg-surface-muted text-text hover:bg-primary-soft hover:text-primary',
                      ].join(' ')}
                    >
                      <span className="font-semibold">{label}.</span>{' '}
                      <span>{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
              <p className="mb-3 text-sm font-semibold text-text">
                Question Navigator
              </p>

              <div className="flex flex-wrap gap-2">
                {questions.map((question, index) => {
                  const isCurrent = index === currentQuestionIndex;
                  const isAnswered = Boolean(answers[question.id]);

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={[
                        'h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition',
                        isCurrent
                          ? 'bg-primary text-white'
                          : isAnswered
                          ? 'bg-success-soft text-success-text'
                          : 'bg-surface-muted text-text-muted hover:bg-primary-soft hover:text-primary',
                      ].join(' ')}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                }
                disabled={currentQuestionIndex <= 0}
                className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrentQuestionIndex((prev) =>
                    Math.min(questions.length - 1, prev + 1)
                  )
                }
                disabled={currentQuestionIndex >= questions.length - 1}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next Question
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}