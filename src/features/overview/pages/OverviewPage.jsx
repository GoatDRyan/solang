import {
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
  Brain,
  CalendarDays,
  Clock,
  Flame,
  GraduationCap,
  Headphones,
  Layers,
  Library,
  Mic,
  PenLine,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useOverview } from '../../../hooks/useOverview';

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown language';
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeType(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replaceAll('-', '_')
    .replaceAll(' ', '_');
}

function isValidCefrLevel(value) {
  return /^(A1|A1\+|A2|A2\+|B1|B1\+|B2|B2\+|C1|C1\+|C2|Below B1|Below A2)$/i.test(
    String(value || '').trim()
  );
}

function getKnownCefrLevel(stats) {
  const candidates = [
    stats?.latestToefl?.cefrLevel,
    stats?.officialCefrLevel,
    stats?.official_cefr_level,
    stats?.estimatedCefrLevel,
    stats?.estimated_cefr_level,
    stats?.cefrLevel,
    stats?.cefr_level,
    stats?.latestExamLevel,
    stats?.latest_exam_level,
    stats?.latestExam?.cefrLevel,
    stats?.latestExam?.cefr_level,
  ];

  const match = candidates.find(isValidCefrLevel);

  return match ? String(match).trim().toUpperCase() : null;
}

function computeLevelSignal(stats) {
  const latestToefl = stats?.latestToefl || null;

  if (latestToefl?.isComplete && latestToefl.cefrLevel) {
    return {
      label: latestToefl.cefrLevel,
      helper: `TOEFL ${latestToefl.totalScore}/120`,
      confidence: 'higher',
    };
  }

  if (latestToefl?.completedSections > 0 && !latestToefl.isComplete) {
    return {
      label: 'Incomplete',
      helper: `${latestToefl.completedSections}/4 TOEFL sections completed`,
      confidence: 'partial',
    };
  }

  const knownLevel = getKnownCefrLevel(stats);

  if (knownLevel) {
    return {
      label: knownLevel,
      helper: 'Based on diagnostic or exam data',
      confidence: 'higher',
    };
  }

  return {
    label: 'Needs data',
    helper: 'Complete exam sections first',
    confidence: 'low',
  };
}

function computeStreak(weeklyData) {
  let streak = 0;

  for (let index = weeklyData.length - 1; index >= 0; index -= 1) {
    if ((weeklyData[index]?.minutes || 0) > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

const SKILL_TARGET_MINUTES = 180;

const SKILL_PROFILES = [
  {
    id: 'reading',
    label: 'Reading',
    aliases: ['reading', 'toefl_reading', 'exam_reading', 'read'],
    getSignal: () => 0,
  },
  {
    id: 'listening',
    label: 'Listening',
    aliases: ['listening', 'toefl_listening', 'exam_listening', 'audio'],
    getSignal: () => 0,
  },
  {
    id: 'writing',
    label: 'Writing',
    aliases: ['writing', 'toefl_writing', 'exam_writing', 'written_practice'],
    getSignal: (stats) =>
      Math.min(12, safeNumber(stats?.errorPatternsCount) * 0.8),
  },
  {
    id: 'speaking',
    label: 'Speaking',
    aliases: ['speaking', 'toefl_speaking', 'exam_speaking', 'pronunciation'],
    getSignal: () => 0,
  },
  {
    id: 'grammar',
    label: 'Grammar',
    aliases: [
      'grammar',
      'grammar_vocabulary',
      'vocabulary',
      'grammar_tutor',
      'grammar_practice',
      'error_review',
    ],
    getSignal: (stats) =>
      Math.min(
        18,
        safeNumber(stats?.errorPatternsCount) * 1.2 +
          safeNumber(stats?.masteredFlashcards) * 0.15
      ),
  },
];

function getSkillMinutes(typeBreakdown, aliases) {
  return typeBreakdown.reduce((total, item) => {
    const type = normalizeType(item.type);

    const matches = aliases.some((alias) => {
      const normalizedAlias = normalizeType(alias);

      return type === normalizedAlias || type.includes(normalizedAlias);
    });

    return matches ? total + safeNumber(item.minutes) : total;
  }, 0);
}

function buildRadarData(typeBreakdown, stats) {
  return SKILL_PROFILES.map((profile) => {
    const minutes = getSkillMinutes(typeBreakdown, profile.aliases);
    const signal = safeNumber(profile.getSignal(stats));
    const trainingUnits = minutes + signal;

    const value = Math.min(
      100,
      Math.round((trainingUnits / SKILL_TARGET_MINUTES) * 100)
    );

    return {
      skill: profile.label,
      value,
      minutes,
      signal,
      sourceLabel:
        signal > 0
          ? `${minutes} min + ${Math.round(signal)} support signal`
          : `${minutes} min`,
    };
  });
}

function buildFocusData({ stats, radarData, recentSessions }) {
  const latestToefl = stats.latestToefl;

  if (latestToefl?.weakestSection) {
    return {
      mainFocus: `Improve ${latestToefl.weakestSection.label}`,
      secondary: `${latestToefl.weakestSection.label}: ${latestToefl.weakestSection.score}/30 · ${latestToefl.weakestSection.cefrLevel}`,
      strength: latestToefl.strongestSection
        ? `${latestToefl.strongestSection.label} is your strongest TOEFL section (${latestToefl.strongestSection.score}/30).`
        : 'Complete more TOEFL sections to identify your strongest area.',
    };
  }

  if (stats.dueFlashcards > 0) {
    return {
      mainFocus: 'Review due flashcards',
      secondary: `${stats.dueFlashcards} flashcard${
        stats.dueFlashcards > 1 ? 's are' : ' is'
      } ready for revision.`,
      strength:
        stats.masteredFlashcards > 0
          ? `${stats.masteredFlashcards} mastered card${
              stats.masteredFlashcards > 1 ? 's' : ''
            } so far.`
          : 'Start reviewing cards to build long-term memory.',
    };
  }

  if (stats.topErrorPattern) {
    return {
      mainFocus: `Fix: ${stats.topErrorPattern.pattern}`,
      secondary:
        stats.topErrorPattern.explanation ||
        'This is your most frequent detected error pattern.',
      strength:
        stats.totalSessions > 0
          ? 'Your practice data is now strong enough to guide revision.'
          : 'Use AI Tutor corrections to improve the quality of your Error DNA.',
    };
  }

  const weakestSkill =
    radarData.length > 0
      ? [...radarData].sort((a, b) => a.value - b.value)[0]?.skill
      : 'Speaking';

  const strongestSkill =
    radarData.length > 0
      ? [...radarData].sort((a, b) => b.value - a.value)[0]?.skill
      : 'Reading';

  return {
    mainFocus: `Increase ${weakestSkill} practice`,
    secondary:
      recentSessions[0]?.title ||
      'Log your next focused study session to improve tracking accuracy.',
    strength:
      stats.totalSessions > 0
        ? `${strongestSkill} is currently your strongest tracked area.`
        : 'Start logging sessions to detect your strongest skill.',
  };
}

function buildErrorDnaSnapshot(stats) {
  if (!stats.topErrorPattern) {
    return {
      pattern: 'No recurring pattern detected yet',
      frequency: 0,
      severity: 'low',
      impact:
        'Use AI Tutor in Correction, Grammar, Exam Coach, or Pronunciation mode to generate Error DNA automatically.',
    };
  }

  return {
    pattern: stats.topErrorPattern.pattern,
    frequency: stats.topErrorPattern.frequency || 1,
    severity: stats.topErrorPattern.severity || 'medium',
    impact:
      stats.topErrorPattern.explanation ||
      'This recurring issue was detected from your AI Tutor corrections.',
  };
}

function buildLastExamSnapshot({ languageCode, stats, levelSignal }) {
  const latestToefl = stats.latestToefl;

  if (latestToefl?.completedSections > 0) {
    return {
      name: 'Latest TOEFL iBT Estimate',
      score: latestToefl.isComplete
        ? `${latestToefl.totalScore}/120 · ${latestToefl.cefrLevel}`
        : `${latestToefl.completedSections}/4 sections completed`,
      weakest: latestToefl.weakestSection
        ? `${latestToefl.weakestSection.label}: ${latestToefl.weakestSection.score}/30`
        : 'No weakness detected yet',
      recommendation: latestToefl.isComplete
        ? 'Use the TOEFL breakdown below to guide your next revision plan.'
        : 'Complete the missing TOEFL sections to unlock a reliable global CEFR estimate.',
    };
  }

  return {
    name: `${formatLanguageLabel(languageCode)} Practice Snapshot`,
    score: levelSignal.label,
    weakest:
      stats.topErrorPattern?.pattern ||
      (stats.totalSessions === 0
        ? 'No study data yet'
        : 'No clear weakness detected'),
    recommendation:
      levelSignal.label === 'Needs data'
        ? 'Complete a TOEFL section, use AI Tutor corrections, or generate Error DNA to get a reliable estimate.'
        : stats.dueFlashcards > 0
        ? 'Start with your due flashcards, then use AI Tutor to correct a short answer.'
        : stats.topErrorPattern
        ? 'Review your top Error DNA pattern and generate flashcards from it.'
        : 'Log study sessions, complete official exam sections, and use AI Tutor corrections to make this estimate more precise.',
  };
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-text">
            {value}
          </p>
          <p className="mt-2 text-sm text-text-muted">{helper}</p>
        </div>

        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function StatsOverview({ stats, streak, levelSignal }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Flame}
        label="Streak"
        value={`${streak} day${streak > 1 ? 's' : ''}`}
        helper="Based on the last 7 days"
      />

      <StatCard
        icon={Clock}
        label="Study time"
        value={`${stats.totalMinutes || 0} min`}
        helper="Last 30 days"
      />

      <StatCard
        icon={Layers}
        label="Due flashcards"
        value={stats.dueFlashcards || 0}
        helper={`${stats.flashcardsCount || 0} total cards`}
      />

      <StatCard
        icon={GraduationCap}
        label="CEFR signal"
        value={levelSignal.label}
        helper={levelSignal.helper}
      />
    </div>
  );
}

function getToeflSectionIcon(sectionKey) {
  if (sectionKey === 'reading') return BookOpen;
  if (sectionKey === 'listening') return Headphones;
  if (sectionKey === 'speaking') return Mic;
  if (sectionKey === 'writing') return PenLine;

  return GraduationCap;
}

function ToeflSectionScore({ section }) {
  const Icon = getToeflSectionIcon(section.sectionKey);
  const hasScore = section.score !== null;

  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{section.label}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {hasScore ? `${section.score}/30` : '—'}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {hasScore ? section.cefrLevel : 'Not completed'}
          </p>
        </div>

        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function LatestToeflScoreCard({ latestToefl }) {
  const navigate = useNavigate();

  if (!latestToefl || latestToefl.completedSections === 0) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Latest TOEFL Score</h2>
        <p className="mt-2 text-sm text-text-muted">
          No completed TOEFL sections yet.
        </p>

        <button
          type="button"
          onClick={() => navigate('/official-exams')}
          className="mt-5 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Start TOEFL Practice
        </button>
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
          <p className="text-sm font-medium text-text-muted">
            Latest TOEFL iBT Estimate
          </p>

          <h2 className="mt-1 text-3xl font-bold text-text">
            {latestToefl.isComplete
              ? `${latestToefl.totalScore}/120`
              : `${latestToefl.completedSections}/4 sections`}
          </h2>

          <p className="mt-2 text-sm font-semibold text-primary">
            {latestToefl.isComplete
              ? `Global CEFR: ${latestToefl.cefrLevel}`
              : 'Incomplete TOEFL profile'}
          </p>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
            {latestToefl.isComplete
              ? 'This CEFR estimate is based on your latest completed TOEFL section scores.'
              : 'Complete all 4 sections to unlock a reliable global TOEFL CEFR estimate.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/official-exams')}
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Continue TOEFL Practice
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <ToeflSectionScore key={section.sectionKey} section={section} />
        ))}
      </div>

      {latestToefl.weakestSection && (
        <div className="mt-6 rounded-2xl bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning-text">
            Main TOEFL priority
          </p>
          <p className="mt-2 text-sm leading-7 text-text">
            Improve {latestToefl.weakestSection.label}. Current score:{' '}
            <span className="font-semibold">
              {latestToefl.weakestSection.score}/30
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;

  return (
    <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-card)] ring-1 ring-border">
      <p className="font-semibold text-text">{item.skill}</p>
      <p className="mt-1 text-text-muted">Training coverage: {item.value}/100</p>
      <p className="mt-1 text-text-muted">{item.sourceLabel}</p>
      <p className="mt-1 text-xs text-text-muted">
        100 means enough recent practice, not mastery.
      </p>
    </div>
  );
}

function RadarChartCard({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Training Coverage</h2>
      <p className="mt-2 text-sm text-text-muted">
        Shows recent practice coverage, not your real skill level.
      </p>

      <div className="mt-6 h-[320px] min-w-0">
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
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProgressLineChart({ data }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Weekly Progress</h2>
      <p className="mt-2 text-sm text-text-muted">
        Study minutes over the last 7 days.
      </p>

      <div className="mt-6 h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke="var(--primary)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FocusPanel({ focus }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Target size={22} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text">Today’s Focus</h2>
          <p className="text-sm text-text-muted">
            Generated from TOEFL scores, sessions, flashcards, and Error DNA.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Main focus</p>
          <p className="mt-1 font-semibold text-text">{focus.mainFocus}</p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Next action</p>
          <p className="mt-1 font-semibold text-text">{focus.secondary}</p>
        </div>

        <div className="rounded-2xl bg-surface-muted p-4">
          <p className="text-sm text-text-muted">Current strength</p>
          <p className="mt-1 font-semibold text-text">{focus.strength}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Quick Actions</h2>
      <p className="mt-2 text-sm text-text-muted">
        Jump directly to the next useful action.
      </p>

      <div className="mt-6 grid gap-3">
        <button
          onClick={() => navigate('/official-exams')}
          className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <GraduationCap size={18} />
          Continue TOEFL practice
        </button>

        <button
          onClick={() => navigate('/flashcards')}
          className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-primary-soft"
        >
          <Layers size={18} />
          Review flashcards
        </button>

        <button
          onClick={() => navigate('/ai-tutor')}
          className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-primary-soft"
        >
          <Brain size={18} />
          Start AI Tutor
        </button>

        <button
          onClick={() => navigate('/study-sessions')}
          className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-primary-soft"
        >
          <CalendarDays size={18} />
          Log activity
        </button>

        <button
          onClick={() => navigate('/resources')}
          className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-primary-soft"
        >
          <Library size={18} />
          Add a resource
        </button>
      </div>
    </div>
  );
}

function getSeverityClasses(severity) {
  if (severity === 'high') {
    return 'bg-danger-soft text-danger-text';
  }

  if (severity === 'medium') {
    return 'bg-warning-soft text-warning-text';
  }

  return 'bg-success-soft text-success-text';
}

function ErrorPriorityCard({ errorDna }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Error DNA Priority</h2>
      <p className="mt-2 text-sm text-text-muted">
        Your highest-priority recurring mistake.
      </p>

      <div className="mt-6 rounded-2xl bg-surface-muted p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text-muted">Pattern</p>
            <p className="mt-1 font-semibold text-text">{errorDna.pattern}</p>
          </div>

          <span
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold capitalize',
              getSeverityClasses(errorDna.severity),
            ].join(' ')}
          >
            {errorDna.severity}
          </span>
        </div>

        <p className="mt-4 text-sm leading-7 text-text-muted">{errorDna.impact}</p>

        <p className="mt-4 text-sm text-text-muted">
          Frequency signal:{' '}
          <span className="font-semibold text-text">{errorDna.frequency}</span>
        </p>
      </div>
    </div>
  );
}

function LastExamCard({ lastExam }) {
  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <h2 className="text-xl font-semibold text-text">Practice Snapshot</h2>
      <p className="mt-2 text-sm text-text-muted">
        Summary generated from the latest available data.
      </p>

      <div className="mt-6 rounded-2xl bg-surface-muted p-4">
        <p className="text-sm text-text-muted">{lastExam.name}</p>
        <p className="mt-2 text-3xl font-bold text-text">{lastExam.score}</p>

        <div className="mt-4 space-y-3 text-sm">
          <p className="text-text-muted">
            Weakest area:{' '}
            <span className="font-semibold text-text">{lastExam.weakest}</span>
          </p>
          <p className="leading-7 text-text-muted">{lastExam.recommendation}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, value, helper, tone = 'default' }) {
  const iconClass =
    tone === 'warning'
      ? 'bg-warning-soft text-warning-text'
      : tone === 'danger'
      ? 'bg-danger-soft text-danger-text'
      : 'bg-primary-soft text-primary';

  return (
    <div className="rounded-[1.5rem] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="mt-2 text-xl font-bold text-text">{value}</p>
          <p className="mt-2 text-sm text-text-muted">{helper}</p>
        </div>

        <div className={['rounded-2xl p-3', iconClass].join(' ')}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    stats,
    weeklyData,
    typeBreakdown,
    recentSessions,
    isOverviewLoading,
    overviewError,
  } = useOverview(languageCode);

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  if (isOverviewLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading overview...
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h1 className="text-2xl font-bold text-text">Overview error</h1>
        <p className="mt-3 text-sm text-danger-text">{overviewError}</p>
      </div>
    );
  }

  const safeStats = stats || {};
  const streak = computeStreak(weeklyData || []);
  const levelSignal = computeLevelSignal(safeStats);
  const radarData = buildRadarData(typeBreakdown || [], safeStats);

  const focusData = buildFocusData({
    stats: safeStats,
    radarData,
    recentSessions: recentSessions || [],
  });

  const errorDna = buildErrorDnaSnapshot(safeStats);

  const lastExam = buildLastExamSnapshot({
    languageCode,
    stats: safeStats,
    levelSignal,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text">Overview</h1>
        <p className="mt-2 text-sm text-text-muted">
          Your {formatLanguageLabel(languageCode)} learning dashboard at a glance.
        </p>
      </div>

      <StatsOverview
        stats={safeStats}
        streak={streak}
        levelSignal={levelSignal}
      />

      <LatestToeflScoreCard latestToefl={safeStats.latestToefl} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RadarChartCard data={radarData} />
        <ProgressLineChart data={weeklyData || []} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FocusPanel focus={focusData} />
        <QuickActions />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ErrorPriorityCard errorDna={errorDna} />
        <LastExamCard lastExam={lastExam} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={BookOpen}
          title="Resources"
          value={safeStats.resourcesCount || 0}
          helper="Saved learning resources"
        />

        <InfoCard
          icon={TriangleAlert}
          title="Error patterns"
          value={safeStats.errorPatternsCount || 0}
          helper={`${safeStats.highPriorityErrors || 0} high-priority issue${
            safeStats.highPriorityErrors > 1 ? 's' : ''
          }`}
          tone={safeStats.highPriorityErrors > 0 ? 'danger' : 'default'}
        />

        <InfoCard
          icon={Clock}
          title="Average session"
          value={`${safeStats.averageMinutes || 0} min`}
          helper="Calculated from real sessions"
        />
      </div>
    </div>
  );
}