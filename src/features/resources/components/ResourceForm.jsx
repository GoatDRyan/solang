import { useState } from 'react';

const RESOURCE_TYPES = [
  'video',
  'article',
  'podcast',
  'book',
  'app',
  'website',
  'course',
  'other',
];

export default function ResourceForm({ languageCode, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    url: '',
    resource_type: 'website',
    provider: '',
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
      });

      setForm({
        title: '',
        url: '',
        resource_type: 'website',
        provider: '',
        notes: '',
      });

      setMessage('Resource added.');
    } catch (error) {
      setMessage(error.message || 'Failed to add resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Add Resource</h2>
      <p className="mt-2 text-sm text-text-muted">
        Save a real learning resource for the active language.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">Title</label>
          <input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            required
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            placeholder="Example: BBC Learning English"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">URL</label>
          <input
            value={form.url}
            onChange={(event) => updateField('url', event.target.value)}
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            placeholder="https://..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Type</label>
            <select
              value={form.resource_type}
              onChange={(event) => updateField('resource_type', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            >
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">Provider</label>
            <input
              value={form.provider}
              onChange={(event) => updateField('provider', event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
              placeholder="YouTube, ETS, etc."
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
            placeholder="Why this resource is useful..."
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
          {isSubmitting ? 'Saving...' : 'Add Resource'}
        </button>
      </form>
    </div>
  );
}