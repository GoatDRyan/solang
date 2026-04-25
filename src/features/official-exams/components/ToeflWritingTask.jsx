import { useMemo } from 'react';
import {
  CheckCircle2,
  Mail,
  MessageSquareText,
  PenLine,
  RotateCcw,
} from 'lucide-react';

function countWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function formatSkill(skill) {
  return String(skill || 'sentence_structure')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTaskList(task) {
  const content = task?.content || {};
  const buildItems = Array.isArray(content.buildSentenceItems)
    ? content.buildSentenceItems
    : [];

  const tasks = buildItems.map((item, index) => ({
    type: 'build_sentence',
    label: `Sentence ${index + 1}`,
    item,
  }));

  if (content.emailTask) {
    tasks.push({
      type: 'email',
      label: 'Email',
      item: content.emailTask,
    });
  }

  if (content.academicDiscussionTask) {
    tasks.push({
      type: 'discussion',
      label: 'Discussion',
      item: content.academicDiscussionTask,
    });
  }

  return tasks;
}

function getAnsweredCount(tasks, answers) {
  return tasks.filter((task) => {
    const value = answers[task.item.id];

    if (task.type === 'build_sentence') {
      return String(value || '').trim().length > 0;
    }

    return countWords(value) > 0;
  }).length;
}

function TaskNavigator({
  tasks,
  currentTaskIndex,
  answers,
  onCurrentTaskIndexChange,
}) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <p className="mb-3 text-sm font-semibold text-text">Task Navigator</p>

      <div className="flex flex-wrap gap-2">
        {tasks.map((task, index) => {
          const isCurrent = index === currentTaskIndex;
          const isAnswered = Boolean(String(answers[task.item.id] || '').trim());

          return (
            <button
              key={task.item.id}
              type="button"
              onClick={() => onCurrentTaskIndexChange(index)}
              className={[
                'rounded-xl px-3 py-2 text-sm font-semibold transition',
                isCurrent
                  ? 'bg-primary text-white'
                  : isAnswered
                  ? 'bg-success-soft text-success-text'
                  : 'bg-surface-muted text-text-muted hover:bg-primary-soft hover:text-primary',
              ].join(' ')}
            >
              {task.type === 'build_sentence' ? index + 1 : task.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BuildSentenceTask({ item, value, onChange }) {
  const fragments = Array.isArray(item.fragments) ? item.fragments : [];

  const appendFragment = (fragment) => {
    const current = String(value || '').trim();

    if (!current) {
      onChange(fragment);
      return;
    }

    onChange(`${current} ${fragment}`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <PenLine size={20} />
          </div>

          <div>
            <p className="text-sm text-text-muted">Build a Sentence</p>
            <h2 className="mt-1 text-xl font-semibold text-text">
              {formatSkill(item.skill)}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {item.instruction ||
                'Arrange the words and phrases to form a complete grammatical sentence.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm font-semibold text-text">Fragments</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {fragments.map((fragment, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => appendFragment(fragment)}
              className="rounded-2xl bg-surface-muted px-4 py-2 text-sm font-semibold text-text transition hover:bg-primary-soft hover:text-primary"
            >
              {fragment}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">Your sentence</p>

          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-danger-soft hover:text-danger-text"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary focus:bg-surface"
          placeholder="Write the complete sentence here..."
        />

        <p className="mt-3 text-sm text-text-muted">
          You can click fragments or type manually.
        </p>
      </div>
    </div>
  );
}

function EmailTask({ item, value, onChange }) {
  const wordCount = countWords(value);

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <Mail size={20} />
          </div>

          <div>
            <p className="text-sm text-text-muted">Write an Email</p>
            <h2 className="mt-1 text-xl font-semibold text-text">
              {item.title || 'Write an Email'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {item.instructions ||
                'Write a clear email that addresses the situation and fulfills the purpose.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm font-semibold text-text">Situation</p>
        <p className="mt-3 text-sm leading-7 text-text-muted">{item.situation}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm text-text-muted">Recipient</p>
            <p className="mt-1 font-semibold text-text">{item.recipient}</p>
          </div>

          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm text-text-muted">Purpose</p>
            <p className="mt-1 font-semibold text-text">{item.purpose}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">Your email</p>

          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {wordCount} words / min {item.minWords || 80}
          </span>
        </div>

        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={12}
          className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary focus:bg-surface"
          placeholder="Write your email here..."
        />
      </div>
    </div>
  );
}

function AcademicDiscussionTask({ item, value, onChange }) {
  const wordCount = countWords(value);
  const studentPosts = Array.isArray(item.studentPosts) ? item.studentPosts : [];

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <MessageSquareText size={20} />
          </div>

          <div>
            <p className="text-sm text-text-muted">
              Write for an Academic Discussion
            </p>
            <h2 className="mt-1 text-xl font-semibold text-text">
              {item.course || 'Academic Discussion'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {item.instructions ||
                'Write a response that contributes to the discussion. State and support your opinion.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm font-semibold text-text">Professor question</p>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          {item.professorQuestion}
        </p>

        <div className="mt-5 space-y-3">
          {studentPosts.map((post) => (
            <div
              key={post.name}
              className="rounded-2xl bg-surface-muted p-4"
            >
              <p className="text-sm font-semibold text-text">{post.name}</p>
              <p className="mt-2 text-sm leading-7 text-text-muted">{post.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">Your response</p>

          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {wordCount} words / min {item.minWords || 100}
          </span>
        </div>

        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={14}
          className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm leading-7 text-text outline-none transition focus:border-primary focus:bg-surface"
          placeholder="Write your academic discussion response here..."
        />
      </div>
    </div>
  );
}

export default function ToeflWritingTask({
  task,
  answers,
  onAnswersChange,
  currentTaskIndex,
  onCurrentTaskIndexChange,
}) {
  const tasks = useMemo(() => getTaskList(task), [task]);
  const currentTask = tasks[currentTaskIndex] || tasks[0] || null;

  const answeredCount = getAnsweredCount(tasks, answers);

  const setAnswer = (taskId, value) => {
    onAnswersChange({
      ...answers,
      [taskId]: value,
    });
  };

  const goPrevious = () => {
    onCurrentTaskIndexChange(Math.max(0, currentTaskIndex - 1));
  };

  const goNext = () => {
    onCurrentTaskIndexChange(Math.min(tasks.length - 1, currentTaskIndex + 1));
  };

  if (!currentTask) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 text-sm text-text-muted shadow-[var(--shadow-card)] ring-1 ring-border">
        No TOEFL Writing content available.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-5">
        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm text-text-muted">TOEFL Writing</p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {task?.title || 'Writing Section'}
          </h2>

          <p className="mt-3 text-sm leading-7 text-text-muted">
            {task?.instructions ||
              'Complete the Build a Sentence items, then write an email and an academic discussion response.'}
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
            <CheckCircle2 size={17} />
            Answered {answeredCount} / {tasks.length}
          </div>
        </div>

        <TaskNavigator
          tasks={tasks}
          currentTaskIndex={currentTaskIndex}
          answers={answers}
          onCurrentTaskIndexChange={onCurrentTaskIndexChange}
        />

        <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
          <p className="text-sm text-text-muted">Current task</p>
          <p className="mt-1 text-lg font-semibold text-text">
            {currentTask.label}
          </p>

          <p className="mt-3 text-sm leading-7 text-text-muted">
            {currentTask.type === 'build_sentence'
              ? 'Build a grammatical sentence from the fragments.'
              : currentTask.type === 'email'
              ? 'Write a clear email that fits the situation and purpose.'
              : 'Write a short academic contribution with a clear opinion and support.'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentTaskIndex <= 0}
            className="rounded-2xl bg-surface-muted px-4 py-3 text-sm font-semibold text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={currentTaskIndex >= tasks.length - 1}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Task
          </button>
        </div>
      </div>

      <div>
        {currentTask.type === 'build_sentence' && (
          <BuildSentenceTask
            item={currentTask.item}
            value={answers[currentTask.item.id] || ''}
            onChange={(value) => setAnswer(currentTask.item.id, value)}
          />
        )}

        {currentTask.type === 'email' && (
          <EmailTask
            item={currentTask.item}
            value={answers[currentTask.item.id] || ''}
            onChange={(value) => setAnswer(currentTask.item.id, value)}
          />
        )}

        {currentTask.type === 'discussion' && (
          <AcademicDiscussionTask
            item={currentTask.item}
            value={answers[currentTask.item.id] || ''}
            onChange={(value) => setAnswer(currentTask.item.id, value)}
          />
        )}
      </div>
    </div>
  );
}