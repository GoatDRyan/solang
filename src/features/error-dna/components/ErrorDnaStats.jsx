import { AlertTriangle, Brain, ListChecks, Repeat } from 'lucide-react';

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold text-text">{value}</p>
          <p className="mt-2 text-sm text-text-muted">{helper}</p>
        </div>

        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function ErrorDnaStats({ stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Brain}
        label="Detected patterns"
        value={stats.total}
        helper="Stored recurring issues"
      />

      <StatCard
        icon={AlertTriangle}
        label="High priority"
        value={stats.high}
        helper="Needs urgent attention"
      />

      <StatCard
        icon={Repeat}
        label="Frequency signal"
        value={stats.totalFrequency}
        helper="Total repeated occurrences"
      />

      <StatCard
        icon={ListChecks}
        label="Main weakness"
        value={stats.topPattern?.pattern || 'None yet'}
        helper="Highest frequency pattern"
      />
    </div>
  );
}