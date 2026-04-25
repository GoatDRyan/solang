import { useMemo, useState } from 'react';

function getInitialCursor() {
  return {
    passageIndex: 0,
    questionIndex: 0,
  };
}

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

export default function ToeflReadingTask({ task, answers, onChange }) {
  const passages = Array.isArray(task?.content?.passages)
    ? task.content.passages
    : [];

  const [cursor, setCursor] = useState(getInitialCursor);

  const flatQuestions = useMemo(
    () =>
      passages.flatMap((passage, passageIndex) =>
        (passage.questions || []).map((question, questionIndex) => ({
          ...question,
          passageIndex,
          questionIndex,
          passageTitle: passage.title,
        }))
      ),
    [passages]
  );

  const currentPassage = passages[cursor.passageIndex] || null;
  const currentQuestion =
    currentPassage?.questions?.[cursor.questionIndex] || null;

  const flatIndex = flatQuestions.findIndex(
    (item) =>
      item.passageIndex === cursor.passageIndex &&
      item.questionIndex === cursor.questionIndex
  );

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  const answeredCount = flatQuestions.filter((question) => {
    const value = answers[question.id];

    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }).length;

  const goToFlatIndex = (nextIndex) => {
    const target = flatQuestions[nextIndex];

    if (!target) return;

    setCursor({
      passageIndex: target.passageIndex,
      questionIndex: target.questionIndex,
    });
  };

  const setSingleAnswer = (questionId, optionLabel) => {
    onChange({
      ...answers,
      [questionId]: optionLabel,
    });
  };

  const setMultiAnswer = (questionId, optionLabel, selectCount = 3) => {
    const existing = Array.isArray(answers[questionId])
      ? answers[questionId]
      : [];

    const exists = existing.includes(optionLabel);

    let next;

    if (exists) {
      next = existing.filter((item) => item !== optionLabel);
    } else if (existing.length < selectCount) {
      next = [...existing, optionLabel];
    } else {
      next = existing;
    }

    onChange({
      ...answers,
      [questionId]: next,
    });
  };

  if (!currentPassage || !currentQuestion) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 text-sm text-text-muted shadow-[var(--shadow-card)] ring-1 ring-border">
        No TOEFL Reading content available.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">{task?.title}</p>
            <h2 className="mt-1 text-xl font-semibold text-text">
              Reading Section
            </h2>
          </div>

          <div className="rounded-2xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary">
            Answered {answeredCount} / {flatQuestions.length}
          </div>
        </div>

        <p className="mt-3 text-sm leading-7 text-text-muted">
          {task?.instructions}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-text-muted">
                Passage {cursor.passageIndex + 1} of {passages.length}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text">
                {currentPassage.title}
              </h3>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto pr-3">
            <p className="whitespace-pre-line text-sm leading-8 text-text-muted">
              {currentPassage.text}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
            <p className="text-sm text-text-muted">
              Question {flatIndex + 1} of {flatQuestions.length}
            </p>

            <h3 className="mt-1 text-lg font-semibold text-text">
              {formatQuestionType(currentQuestion.type)}
            </h3>

            {currentQuestion.paragraphNumber && (
              <p className="mt-2 text-xs font-medium text-primary">
                Paragraph {currentQuestion.paragraphNumber}
              </p>
            )}

            {currentQuestion.sentenceToSimplify && (
              <div className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm leading-7 text-text-muted">
                <span className="font-semibold text-text">
                  Sentence to simplify:{' '}
                </span>
                {currentQuestion.sentenceToSimplify}
              </div>
            )}

            {currentQuestion.sentenceToInsert && (
              <div className="mt-4 rounded-2xl bg-primary-soft p-4 text-sm leading-7 text-primary">
                <span className="font-semibold">Sentence to insert: </span>
                {currentQuestion.sentenceToInsert}
              </div>
            )}

            <p className="mt-4 text-sm leading-7 text-text">
              {currentQuestion.question}
            </p>

            {currentQuestion.answerMode === 'multi_select' && (
              <p className="mt-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary">
                Select {currentQuestion.selectCount || 3} answers.
              </p>
            )}
          </div>

          <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
            <div className="space-y-3">
              {(currentQuestion.options || []).map((option, index) => {
                const label = getOptionLabel(option, index);
                const text = getOptionText(option);

                const isSelected =
                  currentQuestion.answerMode === 'multi_select'
                    ? Array.isArray(currentAnswer) &&
                      currentAnswer.includes(label)
                    : currentAnswer === label;

                return (
                  <button
                    key={`${currentQuestion.id}-${label}`}
                    type="button"
                    onClick={() => {
                      if (currentQuestion.answerMode === 'multi_select') {
                        setMultiAnswer(
                          currentQuestion.id,
                          label,
                          currentQuestion.selectCount || 3
                        );
                      } else {
                        setSingleAnswer(currentQuestion.id, label);
                      }
                    }}
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
              {flatQuestions.map((question, index) => {
                const value = answers[question.id];
                const isAnswered = Array.isArray(value)
                  ? value.length > 0
                  : Boolean(value);

                const isCurrent = index === flatIndex;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => goToFlatIndex(index)}
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
              onClick={() => goToFlatIndex(flatIndex - 1)}
              disabled={flatIndex <= 0}
              className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => goToFlatIndex(flatIndex + 1)}
              disabled={flatIndex >= flatQuestions.length - 1}
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}