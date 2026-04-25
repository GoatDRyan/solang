import { useState } from 'react';

const SESSION_TYPES = [
  'reading',
  'listening',
  'writing',
  'speaking',
  'grammar',
  'vocabulary',
  'revision',
  'exam',
  'shadowing',
  'immersion',
  'other',
];

function getNowLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function StudySessionForm({ languageCode, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    session_type: 'reading',
    duration_minutes: 30,
    started_at: getNowLocalDateTime(),
    ended_at: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      await onSubmit({
        ...form,
        language_code: languageCode,
        duration_minutes: Number(form.duration_minutes) || 0,
        started_at: form.started_at ? new Date(form.started_at).toISOString() : null,
        ended_at: form.ended_at ? new Date(form.ended_at).toISOString() : null,
      });

      setForm((prev) => ({
        ...prev,
        title: '',
        duration_minutes: 30,
        notes: '',
        ended_at: '',
      }));

      setMessage('Study session added.');
    } catch (error) {
      setMessage(error.message || 'Failed to add study session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Add Study Session</h2>
      <p className="mt-2 text-sm text-text-muted">
        Save a real study session for the active language.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">Title</label>
          <input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            placeholder="Example: TOEFL Reading practice"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Session type</label>
            <select
              value={form.session_type}
              onChange={(event) => updateField('session_type', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            >
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="0"
              value={form.duration_minutes}
              onChange={(event) => updateField('duration_minutes', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Started at</label>
            <input
              type="datetime-local"
              value={form.started_at}
              onChange={(event) => updateField('started_at', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">Ended at</label>
            <input
              type="datetime-local"
              value={form.ended_at}
              onChange={(event) => updateField('ended_at', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            placeholder="What you studied, what was hard, what to review next..."
          />
        </div>

        {message && (
          <div className="rounded-2xl bg-surface-muted p-3 text-sm text-text-muted">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Add Session'}
        </button>
      </form>
    </div>
  );
}