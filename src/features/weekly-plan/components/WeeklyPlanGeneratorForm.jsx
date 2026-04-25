import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const DEFAULT_AVAILABILITY = [
  { dayIndex: 0, label: 'Monday', availableMinutes: 90 },
  { dayIndex: 1, label: 'Tuesday', availableMinutes: 90 },
  { dayIndex: 2, label: 'Wednesday', availableMinutes: 90 },
  { dayIndex: 3, label: 'Thursday', availableMinutes: 90 },
  { dayIndex: 4, label: 'Friday', availableMinutes: 90 },
  { dayIndex: 5, label: 'Saturday', availableMinutes: 180 },
  { dayIndex: 6, label: 'Sunday', availableMinutes: 180 },
];

export default function WeeklyPlanGeneratorForm({ onGenerate, isGenerating }) {
  const [objective, setObjective] = useState('Improve speaking fluency');
  const [mode, setMode] = useState('balanced');
  const [intensity, setIntensity] = useState('normal');
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);

  const updateAvailability = (dayIndex, availableMinutes) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayIndex === dayIndex
          ? { ...day, availableMinutes: Number(availableMinutes) || 0 }
          : day
      )
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onGenerate({
      objective,
      mode,
      intensity,
      availability,
    });
  };

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Generate Weekly Plan</h2>
      <p className="mt-2 text-sm leading-7 text-text-muted">
        Gemini will build a full weekly routine using your available time, Error
        DNA, flashcards, resources, and recent study history.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Main weekly objective
          </label>
          <input
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
            placeholder="Improve speaking fluency"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Mode
            </label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
            >
              <option value="balanced">Balanced</option>
              <option value="weak_points">Weak Points</option>
              <option value="immersion">Immersion</option>
              <option value="exam">Exam</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Intensity
            </label>
            <select
              value={intensity}
              onChange={(event) => setIntensity(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
            >
              <option value="light">Light</option>
              <option value="normal">Normal</option>
              <option value="intense">Intense</option>
            </select>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-text">
            Weekly availability
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {availability.map((day) => (
              <label
                key={day.dayIndex}
                className="flex items-center justify-between gap-4 rounded-2xl bg-surface-muted px-4 py-3"
              >
                <span className="text-sm font-medium text-text">{day.label}</span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={day.availableMinutes}
                    onChange={(event) =>
                      updateAvailability(day.dayIndex, event.target.value)
                    }
                    className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text outline-none"
                  />
                  <span className="text-sm text-text-muted">min</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={18} />
          {isGenerating ? 'Generating...' : 'Generate weekly plan'}
        </button>
      </form>
    </div>
  );
}