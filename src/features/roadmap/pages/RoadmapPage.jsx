import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Flag,
  GraduationCap,
  RefreshCcw,
  Route,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useLearningGoal } from '../../../hooks/useLearningGoal';
import { useRoadmap } from '../../../hooks/useRoadmap';

const LEVEL_SCALE = {
  'Needs data': 0,
  Incomplete: 0,
  'Below A2': 0.5,
  'Below B1': 1,
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

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

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getTargetScoreForLevel(level) {
  if (level === 'C2') return 114;
  if (level === 'C1') return 95;
  if (level === 'B2') return 72;
  if (level === 'B1') return 42;

  return 42;
}

function getCurrentLevelFromAnalytics(latestToefl) {
  if (latestToefl?.isComplete && latestToefl.cefrLevel) {
    return latestToefl.cefrLevel;
  }

  if (latestToefl?.completedSections > 0) {
    return 'Incomplete';
  }

  return 'Needs data';
}

function getCurrentStatusFromAnalytics(latestToefl) {
  if (!latestToefl || latestToefl.completedSections === 0) {
    return 'Diagnostic needed';
  }

  if (!latestToefl.isComplete) {
    return `${latestToefl.completedSections}/4 TOEFL sections completed`;
  }

  return `TOEFL ${latestToefl.totalScore}/120`;
}

function buildTimeline({ currentLevel, targetLevel }) {
  const currentValue = LEVEL_SCALE[currentLevel] ?? 0;
  const targetValue = LEVEL_SCALE[targetLevel] ?? 5;

  return [
    {
      point: 'Now',
      current: currentValue,
      target: targetValue,
    },
    {
      point: '+1 month',
      current: Math.min(targetValue, currentValue + 0.7),
      target: targetValue,
    },
    {
      point: '+2 months',
      current: Math.min(targetValue, currentValue + 1.4),
      target: targetValue,
    },
    {
      point: '+3 months',
      current: Math.min(targetValue, currentValue + 2),
      target: targetValue,
    },
  ];
}

function getRoadmapContent(roadmap) {
  return roadmap?.content && typeof roadmap.content === 'object'
    ? roadmap.content
    : null;
}

function RoadmapStatCard({ icon: Icon, label, value, helper }) {
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

function GoalSettingsCard({ goal, onSave, hasRoadmap }) {
  const [form, setForm] = useState(goal);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm(goal);
  }, [goal]);

  const handleLevelChange = (targetLevel) => {
    setForm((prev) => ({
      ...prev,
      target_level: targetLevel,
      target_score: getTargetScoreForLevel(targetLevel),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      await onSave(form);
      setMessage(
        hasRoadmap
          ? 'Learning goal saved. Regenerate the AI Roadmap to update the strategy.'
          : 'Learning goal saved.'
      );
    } catch (error) {
      setMessage(error.message || 'Failed to save learning goal.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div>
        <h2 className="text-xl font-semibold text-text">Learning Goal</h2>
        <p className="mt-2 text-sm text-text-muted">
          Choose your target. The AI Roadmap and Weekly Plan should follow this
          goal.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Target exam
          </label>
          <select
            value={form.target_exam}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                target_exam: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            <option value="toefl_ibt">TOEFL iBT</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Target CEFR
          </label>
          <select
            value={form.target_level}
            onChange={(event) => handleLevelChange(event.target.value)}
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Target score
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={form.target_score}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                target_score: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Deadline
          </label>
          <input
            type="date"
            value={form.deadline || ''}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                deadline: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Weekly time
          </label>
          <select
            value={form.weekly_minutes}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                weekly_minutes: Number(event.target.value),
              }))
            }
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            <option value={300}>5h/week</option>
            <option value={600}>10h/week</option>
            <option value={900}>15h/week</option>
            <option value={1200}>20h/week</option>
            <option value={1800}>30h/week</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Priority
          </label>
          <select
            value={form.priority}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                priority: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            <option value="balanced">Balanced</option>
            <option value="toefl">TOEFL score</option>
            <option value="speaking">Speaking</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="pronunciation">Pronunciation</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Goal'}
        </button>

        {message && <p className="text-sm text-text-muted">{message}</p>}
      </div>
    </div>
  );
}

function GenerateRoadmapCard({
  roadmap,
  isGeneratingRoadmap,
  roadmapError,
  onGenerate,
}) {
  const hasRoadmap = Boolean(roadmap);

  return (
    <div className="rounded-[1.5rem] bg-primary-soft p-6 ring-1 ring-primary/20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-surface p-3 text-primary">
            <Brain size={22} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-text">
              AI Roadmap Generator
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted">
              Generate a long-term learning strategy from your goal, TOEFL
              scores, Error DNA, flashcards, and study history. This roadmap
              will later drive your Weekly Plan.
            </p>

            {hasRoadmap && roadmap.updated_at && (
              <p className="mt-2 text-xs text-text-muted">
                Last generated:{' '}
                {new Date(roadmap.updated_at).toLocaleString(undefined, {
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
          disabled={isGeneratingRoadmap}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasRoadmap ? <RefreshCcw size={16} /> : <Sparkles size={16} />}
          {isGeneratingRoadmap
            ? 'Generating...'
            : hasRoadmap
            ? 'Regenerate Roadmap'
            : 'Generate AI Roadmap'}
        </button>
      </div>

      {roadmapError && (
        <div className="mt-4 rounded-2xl bg-danger-soft p-3 text-sm text-danger-text">
          {roadmapError}
        </div>
      )}
    </div>
  );
}

function CecrlRoadmapChart({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">CEFR Trajectory</h2>
      <p className="mt-2 text-sm text-text-muted">
        Estimated progression path toward your selected target level.
      </p>

      <div className="mt-6 h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="point" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 6]}
              ticks={[1, 2, 3, 4, 5, 6]}
              tickFormatter={(value) => {
                const map = {
                  1: 'A1',
                  2: 'A2',
                  3: 'B1',
                  4: 'B2',
                  5: 'C1',
                  6: 'C2',
                };

                return map[value] || '';
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="current"
              name="Projected path"
              stroke="var(--primary)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="target"
              name="Target"
              stroke="var(--text-muted)"
              strokeDasharray="6 6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MilestoneCard({ item }) {
  const statusClasses =
    item.status === 'completed'
      ? 'bg-success-soft text-success-text'
      : item.status === 'current'
      ? 'bg-warning-soft text-warning-text'
      : 'bg-surface-muted text-text-muted';

  const Icon =
    item.status === 'completed'
      ? CheckCircle2
      : item.status === 'current'
      ? Clock
      : Flag;

  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={20} />
        </div>

        <span
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold capitalize',
            statusClasses,
          ].join(' ')}
        >
          {item.status || 'locked'}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-text">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {item.description}
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-surface-muted p-3">
          <p className="text-xs text-text-muted">Current</p>
          <p className="mt-1 text-sm font-semibold text-text">{item.current}</p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-3">
          <p className="text-xs text-text-muted">Target</p>
          <p className="mt-1 text-sm font-semibold text-text">{item.target}</p>
        </div>
      </div>
    </div>
  );
}

function PhasePlanningCard({ item, isActive }) {
  return (
    <div
      className={[
        'rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1',
        isActive ? 'ring-primary' : 'ring-border',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{item.duration}</p>
          <h3 className="mt-2 text-lg font-semibold text-text">{item.title}</h3>
        </div>

        {isActive && (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            Active phase
          </span>
        )}
      </div>

      <p className="mt-2 text-sm leading-6 text-text-muted">{item.focus}</p>

      <div className="mt-5 space-y-3">
        {(item.actions || []).map((action) => (
          <div
            key={action}
            className="flex items-start gap-3 rounded-2xl bg-surface-muted p-3"
          >
            <CheckCircle2 size={17} className="mt-0.5 text-primary" />
            <p className="text-sm leading-6 text-text">{action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GapAnalysisCard({ gapAnalysis, latestToefl }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-warning-soft p-3 text-warning-text">
          <AlertTriangle size={22} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text">Gap Analysis</h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            What is blocking your next CEFR milestone.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Gap</p>
          <p className="mt-2 font-semibold text-text">
            {gapAnalysis?.gap || 'No gap analysis yet'}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Priority</p>
          <p className="mt-2 font-semibold text-text">
            {gapAnalysis?.priority || 'Generate roadmap first'}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">TOEFL status</p>
          <p className="mt-2 font-semibold text-text">
            {latestToefl?.isComplete
              ? `${latestToefl.totalScore}/120`
              : `${latestToefl?.completedSections || 0}/4 sections`}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-primary-soft p-4">
        <p className="text-sm font-semibold text-primary">Recommendation</p>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          {gapAnalysis?.recommendation ||
            'Generate your AI Roadmap to receive a personalised recommendation.'}
        </p>
      </div>
    </div>
  );
}

function RecommendationsCard({ recommendations }) {
  if (!recommendations?.length) return null;

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">AI Recommendations</h2>
      <p className="mt-2 text-sm text-text-muted">
        Strategic recommendations generated from your current data.
      </p>

      <div className="mt-6 space-y-3">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation}
            className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4"
          >
            <Sparkles size={17} className="mt-0.5 text-primary" />
            <p className="text-sm leading-6 text-text">{recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyRoadmapState() {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Sparkles size={22} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text">
            No AI Roadmap generated yet
          </h2>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            Save your learning goal, then generate a roadmap. Solang will use
            your TOEFL scores, Error DNA, flashcards, and study history to build
            the macro-planning.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const { analytics, isAnalyticsLoading, analyticsError } =
    useAnalytics(languageCode);

  const { goal, isGoalLoading, goalError, saveGoal } =
    useLearningGoal(languageCode);

  const {
    roadmap,
    isRoadmapLoading,
    isGeneratingRoadmap,
    roadmapError,
    generateRoadmap,
  } = useRoadmap(languageCode);

  const roadmapContent = getRoadmapContent(roadmap);
  const latestToefl = analytics?.latestToefl || null;

  const currentLevel =
    roadmapContent?.currentLevel || getCurrentLevelFromAnalytics(latestToefl);

  const targetLevel = roadmapContent?.targetLevel || goal.target_level;
  const targetExam = roadmapContent?.targetExam || goal.target_exam;
  const targetScore = roadmapContent?.targetScore || goal.target_score;

  const currentStatus =
    roadmapContent?.currentStatus || getCurrentStatusFromAnalytics(latestToefl);

  const timeline = useMemo(
    () =>
      buildTimeline({
        currentLevel,
        targetLevel,
      }),
    [currentLevel, targetLevel]
  );

  const milestones = Array.isArray(roadmapContent?.milestones)
    ? roadmapContent.milestones
    : [];

  const phases = Array.isArray(roadmapContent?.phases)
    ? roadmapContent.phases
    : [];

  const recommendations = Array.isArray(roadmapContent?.recommendations)
    ? roadmapContent.recommendations
    : [];

  const activePhaseId = roadmapContent?.activePhaseId || phases[0]?.id || null;
  const activePhase = phases.find((phase) => phase.id === activePhaseId) || null;

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  if (isAnalyticsLoading || isGoalLoading || isRoadmapLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading roadmap...
      </div>
    );
  }

  if (analyticsError || goalError || !analytics) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Roadmap error</h1>
        <p className="mt-3 text-sm text-danger-text">
          {analyticsError || goalError || 'Roadmap data unavailable.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Learning roadmap</p>
        <h1 className="mt-1 text-3xl font-bold text-text">Roadmap</h1>
        <p className="mt-2 text-sm text-text-muted">
          Visualise your {formatLanguageLabel(languageCode)} progression against
          your selected target.
        </p>
      </div>

      <GoalSettingsCard
        goal={goal}
        onSave={saveGoal}
        hasRoadmap={Boolean(roadmap)}
      />

      <GenerateRoadmapCard
        roadmap={roadmap}
        isGeneratingRoadmap={isGeneratingRoadmap}
        roadmapError={roadmapError}
        onGenerate={generateRoadmap}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <RoadmapStatCard
          icon={GraduationCap}
          label="Current level"
          value={currentLevel}
          helper={
            latestToefl?.isComplete
              ? `Based on TOEFL ${latestToefl.totalScore}/120`
              : 'Complete all TOEFL sections for a reliable level'
          }
        />

        <RoadmapStatCard
          icon={Target}
          label="Target level"
          value={targetLevel}
          helper={`${formatExamLabel(targetExam)} target: ${targetScore}/120`}
        />

        <RoadmapStatCard
          icon={Route}
          label="Current status"
          value={currentStatus}
          helper="Updated from your latest TOEFL and learning data"
        />
      </div>

      {!roadmapContent ? (
        <EmptyRoadmapState />
      ) : (
        <>
          {activePhase && (
            <div className="rounded-[1.5rem] bg-primary-soft p-6 ring-1 ring-primary/20">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-surface p-3 text-primary">
                  <Route size={22} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-primary">
                    Active Roadmap Phase
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-text">
                    {activePhase.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    {activePhase.focus}
                  </p>
                  <p className="mt-2 text-sm font-medium text-text-muted">
                    This phase should guide the next Weekly Plan generation.
                  </p>
                </div>
              </div>
            </div>
          )}

          <CecrlRoadmapChart data={timeline} />

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-text">Milestones</h2>
              <p className="mt-1 text-sm text-text-muted">
                Main progression checkpoints generated by the AI Roadmap.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              {milestones.map((item) => (
                <MilestoneCard key={item.id} item={item} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-text">
                Macro-planning
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Long-term strategic phases generated by AI from your goal and
                learning data.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {phases.map((item) => (
                <PhasePlanningCard
                  key={item.id}
                  item={item}
                  isActive={item.id === activePhaseId}
                />
              ))}
            </div>
          </div>

          <GapAnalysisCard
            gapAnalysis={roadmapContent.gapAnalysis}
            latestToefl={latestToefl}
          />

          <RecommendationsCard recommendations={recommendations} />
        </>
      )}
    </div>
  );
}