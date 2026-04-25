import { useMemo, useState } from 'react';
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  RefreshCcw,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useLearningGoal } from '../../../hooks/useLearningGoal';
import { useRoadmap } from '../../../hooks/useRoadmap';
import { useWeeklyPlan } from '../../../hooks/useWeeklyPlan';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    italian: 'Italian',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

function formatExamLabel(value) {
  const map = {
    toefl_ibt: 'TOEFL iBT',
  };

  return map[value] || value || 'Unknown exam';
}

function getRoadmapContent(roadmap) {
  return roadmap?.content && typeof roadmap.content === 'object'
    ? roadmap.content
    : null;
}

function getPlanContent(weeklyPlan) {
  return weeklyPlan?.content && typeof weeklyPlan.content === 'object'
    ? weeklyPlan.content
    : null;
}

function getActivePhase(roadmap) {
  const content = getRoadmapContent(roadmap);

  if (!content?.phases?.length) return null;

  const activePhaseId = content.activePhaseId || content.phases[0]?.id;

  return (
    content.phases.find((phase) => phase.id === activePhaseId) ||
    content.phases[0] ||
    null
  );
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold text-text">{value}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{helper}</p>
        </div>

        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function LinkedRoadmapCard({ roadmap, activePhase }) {
  if (!roadmap || !activePhase) {
    return (
      <div className="rounded-[1.5rem] bg-warning-soft p-6 ring-1 ring-warning-text/10">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-surface p-3 text-warning-text">
            <Route size={22} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-text">
              No linked Roadmap phase yet
            </h2>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              Generate an AI Roadmap first. Then the Weekly Plan will use its
              active phase as the strategy source.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-primary-soft p-6 ring-1 ring-primary/20">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-surface p-3 text-primary">
          <Route size={22} />
        </div>

        <div>
          <p className="text-sm font-semibold text-primary">
            Linked Roadmap Phase
          </p>
          <h2 className="mt-1 text-xl font-semibold text-text">
            {activePhase.title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            {activePhase.focus}
          </p>
          <p className="mt-2 text-sm font-medium text-text-muted">
            Weekly Plan generation now follows this phase.
          </p>
        </div>
      </div>
    </div>
  );
}

function GenerateWeeklyPlanCard({
  weeklyPlan,
  isGenerating,
  error,
  onGenerate,
}) {
  const hasPlan = Boolean(weeklyPlan);

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary">
            <Brain size={22} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-text">
              AI Weekly Plan Generator
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted">
              Generate a weekly plan from your active Roadmap phase, TOEFL
              scores, Error DNA, flashcards, and learning goal.
            </p>

            {hasPlan && weeklyPlan.updated_at && (
              <p className="mt-2 text-xs text-text-muted">
                Last generated:{' '}
                {new Date(weeklyPlan.updated_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasPlan ? <RefreshCcw size={16} /> : <Sparkles size={16} />}
          {isGenerating
            ? 'Generating...'
            : hasPlan
            ? 'Regenerate Week'
            : 'Generate Weekly Plan'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
          {error}
        </div>
      )}
    </div>
  );
}

function PrioritiesCard({ title, items, emptyText }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">{title}</h2>

      <div className="mt-6 space-y-3">
        {items?.length ? (
          items.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4"
            >
              <CheckCircle2 size={17} className="mt-0.5 text-primary" />
              <p className="text-sm leading-6 text-text">{item}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-text-muted">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function DaySelector({ days, selectedDayIndex, onSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      {days.map((day, index) => (
        <button
          key={day.day}
          type="button"
          onClick={() => onSelect(index)}
          className={[
            'rounded-2xl p-4 text-left transition ring-1',
            selectedDayIndex === index
              ? 'bg-primary text-white ring-primary'
              : 'bg-surface text-text ring-border hover:bg-primary-soft hover:text-primary',
          ].join(' ')}
        >
          <p className="text-sm font-semibold">{day.day}</p>
          <p
            className={[
              'mt-1 text-xs',
              selectedDayIndex === index ? 'text-white/80' : 'text-text-muted',
            ].join(' ')}
          >
            {day.totalMinutes || 0} min
          </p>
        </button>
      ))}
    </div>
  );
}

function SelectedDayPlan({ day }) {
  if (!day) return null;

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-text-muted">Selected day</p>
          <h2 className="mt-1 text-2xl font-bold text-text">{day.day}</h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">{day.focus}</p>
        </div>

        <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
          {day.totalMinutes || 0} min
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {day.blocks?.length ? (
          day.blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-2xl border border-border bg-surface-muted p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                      {block.type}
                    </span>

                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted ring-1 ring-border">
                      {block.time}
                    </span>

                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted ring-1 ring-border">
                      {block.durationMinutes} min
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-text">
                    {block.title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    {block.description}
                  </p>

                  {block.linkedTo && (
                    <p className="mt-3 text-xs font-medium text-text-muted">
                      Linked to: {block.linkedTo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-text-muted">
            No blocks scheduled for this day.
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyWeeklyPlanState() {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Sparkles size={22} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text">
            No Weekly Plan generated yet
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            Generate your AI Weekly Plan after creating your Roadmap. The plan
            will follow your active Roadmap phase.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPlanPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const { goal, isGoalLoading, goalError } = useLearningGoal(languageCode);

  const {
    roadmap,
    isRoadmapLoading,
    roadmapError,
  } = useRoadmap(languageCode);

  const {
    weeklyPlan,
    weekStart,
    isWeeklyPlanLoading,
    isGeneratingWeeklyPlan,
    weeklyPlanError,
    generateWeeklyPlan,
  } = useWeeklyPlan(languageCode);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const activePhase = useMemo(() => getActivePhase(roadmap), [roadmap]);
  const planContent = getPlanContent(weeklyPlan);
  const days = Array.isArray(planContent?.days) ? planContent.days : [];
  const selectedDay = days[selectedDayIndex] || days[0] || null;

  const totalWeekMinutes = days.reduce(
    (total, day) => total + Number(day.totalMinutes || 0),
    0
  );

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  if (isGoalLoading || isRoadmapLoading || isWeeklyPlanLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading weekly plan...
      </div>
    );
  }

  if (goalError || roadmapError) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Weekly Plan error</h1>
        <p className="mt-3 text-sm text-danger-text">
          {goalError || roadmapError}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">
          Weekly execution plan
        </p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Weekly Plan · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Your week is generated from your learning goal and active Roadmap
          phase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={GraduationCap}
          label="Target"
          value={goal.target_level}
          helper={`${formatExamLabel(goal.target_exam)} · ${
            goal.target_score
          }/120`}
        />

        <StatCard
          icon={Clock}
          label="Weekly target"
          value={`${Math.round(Number(goal.weekly_minutes || 0) / 60)}h`}
          helper="Configured in Roadmap goal settings"
        />

        <StatCard
          icon={CalendarDays}
          label="Week start"
          value={weekStart}
          helper="Current weekly plan period"
        />
      </div>

      <LinkedRoadmapCard roadmap={roadmap} activePhase={activePhase} />

      <GenerateWeeklyPlanCard
        weeklyPlan={weeklyPlan}
        isGenerating={isGeneratingWeeklyPlan}
        error={weeklyPlanError}
        onGenerate={generateWeeklyPlan}
      />

      {!planContent ? (
        <EmptyWeeklyPlanState />
      ) : (
        <>
          <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-text-muted">
                  Generated plan
                </p>
                <h2 className="mt-1 text-2xl font-bold text-text">
                  {planContent.weekTitle}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted">
                  {planContent.summary}
                </p>
              </div>

              <div className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
                {totalWeekMinutes} min this week
              </div>
            </div>

            {planContent.roadmapPhase && (
              <div className="mt-5 rounded-2xl bg-surface-muted p-4">
                <p className="text-sm font-semibold text-text">
                  Roadmap source
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {planContent.roadmapPhase.title} ·{' '}
                  {planContent.roadmapPhase.focus}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <PrioritiesCard
              title="Weekly Priorities"
              items={planContent.priorities}
              emptyText="No priorities generated."
            />

            <PrioritiesCard
              title="Success Criteria"
              items={planContent.successCriteria}
              emptyText="No success criteria generated."
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-text">Week Schedule</h2>
              <p className="mt-1 text-sm text-text-muted">
                Select a day to view its blocks. This avoids scrolling through
                the whole week.
              </p>
            </div>

            <DaySelector
              days={days}
              selectedDayIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
            />

            <SelectedDayPlan day={selectedDay} />
          </div>

          {planContent.notes && (
            <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-soft p-3 text-primary">
                  <Target size={20} />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-text">Notes</h2>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    {planContent.notes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}