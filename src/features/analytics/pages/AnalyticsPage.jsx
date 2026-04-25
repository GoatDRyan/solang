import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BookOpen,
  Clock,
  Flame,
  GraduationCap,
  Layers,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useAnalytics } from '../../../hooks/useAnalytics';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

function AnalyticsStatCard({ icon: Icon, title, value, helper, tone = 'default' }) {
  const iconClass =
    tone === 'danger'
      ? 'bg-danger-soft text-danger-text'
      : tone === 'warning'
      ? 'bg-warning-soft text-warning-text'
      : 'bg-primary-soft text-primary';

  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="mt-2 text-2xl font-bold text-text">{value}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{helper}</p>
        </div>

        <div className={['rounded-2xl p-3', iconClass].join(' ')}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ title, data }) {
  const delta = Number(data?.delta || 0);
  const deltaText = `${delta > 0 ? '+' : ''}${delta}%`;

  const tone =
    delta > 0
      ? 'text-success-text bg-success-soft'
      : delta < 0
      ? 'text-warning-text bg-warning-soft'
      : 'text-text-muted bg-surface-muted';

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          <p className="mt-2 text-sm text-text-muted">{data.note}</p>
        </div>

        <span className={['rounded-full px-3 py-1 text-sm font-semibold', tone].join(' ')}>
          {deltaText}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Current</p>
          <p className="mt-1 text-2xl font-bold text-text">{data.current}</p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Previous</p>
          <p className="mt-1 text-2xl font-bold text-text">{data.previous}</p>
        </div>
      </div>
    </div>
  );
}

function WeeklyTimeChart({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Weekly Study Time</h2>
      <p className="mt-2 text-sm text-text-muted">
        Real logged study time from the last 7 days.
      </p>

      <div className="mt-6 h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill="var(--primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ExamScoreChart({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">TOEFL Score History</h2>
      <p className="mt-2 text-sm text-text-muted">
        Real completed TOEFL section scores.
      </p>

      {data.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface-muted p-5 text-sm text-text-muted">
          No TOEFL score history yet.
        </div>
      ) : (
        <div className="mt-6 h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 30]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SkillDistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;

  return (
    <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-card)] ring-1 ring-border">
      <p className="font-semibold text-text">{item.skill}</p>
      <p className="mt-1 text-text-muted">Score: {item.value}/100</p>
      <p className="mt-1 text-text-muted">Source: {item.source}</p>
    </div>
  );
}

function SkillDistributionChart({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Skill Distribution</h2>
      <p className="mt-2 text-sm text-text-muted">
        TOEFL-based skill profile with grammar and vocabulary support signals.
      </p>

      <div className="mt-6 h-[360px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
            <Radar
              dataKey="value"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.2}
            />
            <Tooltip content={<SkillDistributionTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ToeflBreakdownCard({ latestToefl }) {
  if (!latestToefl || latestToefl.completedSections === 0) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">TOEFL Breakdown</h2>
        <p className="mt-2 text-sm text-text-muted">
          Complete TOEFL sections to unlock detailed score analytics.
        </p>
      </div>
    );
  }

  const sections = [
    latestToefl.sectionScores.reading,
    latestToefl.sectionScores.listening,
    latestToefl.sectionScores.speaking,
    latestToefl.sectionScores.writing,
  ];

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">TOEFL Breakdown</h2>
          <p className="mt-2 text-sm text-text-muted">
            Your latest completed score for each section.
          </p>
        </div>

        <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
          {latestToefl.isComplete
            ? `${latestToefl.totalScore}/120 · ${latestToefl.cefrLevel}`
            : `${latestToefl.completedSections}/4 completed`}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <div key={section.sectionKey} className="rounded-2xl bg-surface-muted p-4">
            <p className="text-sm font-semibold text-text">{section.label}</p>
            <p className="mt-2 text-2xl font-bold text-text">
              {section.score !== null ? `${section.score}/30` : '—'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {section.cefrLevel || 'Not completed'}
            </p>
          </div>
        ))}
      </div>

      {latestToefl.weakestSection && (
        <div className="mt-6 rounded-2xl bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning-text">Main weakness</p>
          <p className="mt-2 text-sm text-text">
            {latestToefl.weakestSection.label}:{' '}
            <span className="font-semibold">
              {latestToefl.weakestSection.score}/30
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function ErrorPatternList({ patterns }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Top Error DNA Patterns</h2>
      <p className="mt-2 text-sm text-text-muted">
        Highest-frequency recurring issues.
      </p>

      <div className="mt-6 space-y-3">
        {patterns.length === 0 ? (
          <p className="text-sm text-text-muted">No recurring errors detected yet.</p>
        ) : (
          patterns.map((pattern) => (
            <div key={pattern.id} className="rounded-2xl bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-text">{pattern.pattern}</p>
                  <p className="mt-1 text-sm text-text-muted">
                    {pattern.explanation || 'No explanation available.'}
                  </p>
                </div>

                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold capitalize text-primary">
                  {pattern.severity || 'medium'}
                </span>
              </div>

              <p className="mt-3 text-sm text-text-muted">
                Frequency:{' '}
                <span className="font-semibold text-text">
                  {pattern.frequency || 1}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const { analytics, isAnalyticsLoading, analyticsError } =
    useAnalytics(languageCode);

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  if (isAnalyticsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading analytics...
      </div>
    );
  }

  if (analyticsError || !analytics) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Analytics error</h1>
        <p className="mt-3 text-sm text-danger-text">
          {analyticsError || 'Analytics data unavailable.'}
        </p>
      </div>
    );
  }

  const averageScoreLabel =
    analytics.stats.averageToeflSectionScore !== null
      ? `${analytics.stats.averageToeflSectionScore}/30`
      : '—';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Analytics</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          {formatLanguageLabel(languageCode)} Progress Analytics
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Track real study time, TOEFL performance, flashcard pressure, and Error
          DNA progression.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsStatCard
          icon={GraduationCap}
          title="CEFR level"
          value={analytics.stats.cefr}
          helper={
            analytics.stats.toeflTotal !== null
              ? `TOEFL ${analytics.stats.toeflTotal}/120`
              : `${analytics.stats.completedToeflSections}/4 TOEFL sections completed`
          }
        />

        <AnalyticsStatCard
          icon={Target}
          title="Average TOEFL section"
          value={averageScoreLabel}
          helper="Average from completed TOEFL sections"
        />

        <AnalyticsStatCard
          icon={Clock}
          title="Sessions completed"
          value={analytics.stats.sessionsCompleted}
          helper="Logged sessions from the last 60 days"
        />

        <AnalyticsStatCard
          icon={Flame}
          title="Error evolution"
          value={analytics.stats.errorEvolution}
          helper={analytics.errorEvolution.note}
          tone={analytics.errorEvolution.trend === 'up' ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsStatCard
          icon={Layers}
          title="Due flashcards"
          value={analytics.stats.dueFlashcards}
          helper="Cards waiting for review"
          tone={analytics.stats.dueFlashcards > 0 ? 'warning' : 'default'}
        />

        <AnalyticsStatCard
          icon={BookOpen}
          title="Mastered cards"
          value={analytics.stats.masteredFlashcards}
          helper="Cards marked as mastered"
        />

        <AnalyticsStatCard
          icon={TriangleAlert}
          title="Recurring patterns"
          value={analytics.stats.recurringPatterns}
          helper="Tracked in Error DNA"
          tone={analytics.stats.highSeverityCount > 0 ? 'danger' : 'default'}
        />

        <AnalyticsStatCard
          icon={TriangleAlert}
          title="High severity"
          value={analytics.stats.highSeverityCount}
          helper="High-priority Error DNA issues"
          tone={analytics.stats.highSeverityCount > 0 ? 'danger' : 'default'}
        />
      </div>

      <ToeflBreakdownCard latestToefl={analytics.latestToefl} />

      <div className="grid gap-6 xl:grid-cols-2">
        <WeeklyTimeChart data={analytics.weeklyTime} />
        <ExamScoreChart data={analytics.toeflHistory} />
      </div>

      <SkillDistributionChart data={analytics.skillDistribution} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ComparisonCard
          title="Current Week vs Previous Week"
          data={analytics.comparisons.week}
        />

        <ComparisonCard
          title="Current Month vs Previous Month"
          data={analytics.comparisons.month}
        />
      </div>

      <ErrorPatternList patterns={analytics.topErrorPatterns} />
    </div>
  );
}