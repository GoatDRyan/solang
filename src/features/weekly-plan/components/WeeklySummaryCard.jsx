import { CheckCircle2, Clock3, ListTodo } from 'lucide-react';

function SummaryItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary-soft p-2 text-primary">
          <Icon size={18} />
        </div>

        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="font-semibold text-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function WeeklySummaryCard({ plan, stats }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Weekly Summary</h2>

      {plan ? (
        <>
          <p className="mt-2 text-sm leading-7 text-text-muted">{plan.summary}</p>

          <div className="mt-6 space-y-3">
            <SummaryItem
              icon={Clock3}
              label="Total time"
              value={`${stats.totalMinutes} min`}
            />

            <SummaryItem
              icon={ListTodo}
              label="Blocks"
              value={`${stats.totalBlocks} planned`}
            />

            <SummaryItem
              icon={CheckCircle2}
              label="Completion"
              value={`${stats.completionRate}%`}
            />
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm leading-7 text-text-muted">
          No weekly plan generated yet. Create a plan to get a full schedule for
          the week.
        </p>
      )}
    </div>
  );
}