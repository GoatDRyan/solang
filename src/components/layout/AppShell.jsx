import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronDown,
  Fingerprint,
  GraduationCap,
  Layers,
  LogOut,
  Map,
  User,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useWorkspace } from '../../app/providers/WorkspaceProvider';

const ENABLED_LANGUAGE_CODES = ['english'];

function formatLanguageLabel(code) {
  const map = {
    english: 'English',
    spanish: 'Spanish',
    korean: 'Korean',
    italian: 'Italian',
    russian: 'Russian',
  };

  return map[code] || code || 'Unknown';
}

function isLanguageAvailable(languageCode) {
  return ENABLED_LANGUAGE_CODES.includes(languageCode);
}

const NAV_ITEMS = [
  {
    label: 'Overview',
    to: '/overview',
    icon: BarChart3,
  },
  {
    label: 'Analytics',
    to: '/analytics',
    icon: Activity,
  },
  {
    label: 'Roadmap',
    to: '/roadmap',
    icon: Map,
  },
  {
    label: 'Weekly Plan',
    to: '/weekly-plan',
    icon: CalendarDays,
  },
  {
    label: 'Official Exams',
    to: '/official-exams',
    icon: GraduationCap,
  },
  {
    label: 'AI Tutor',
    to: '/ai-tutor',
    icon: Bot,
  },
  {
    label: 'Error DNA',
    to: '/error-dna',
    icon: Fingerprint,
  },
  {
    label: 'Flashcards',
    to: '/flashcards',
    icon: Layers,
  },
  {
    label: 'Resources',
    to: '/resources',
    icon: BookOpen,
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: User,
  },
];

export default function AppShell() {
  const { user, signOut } = useAuth();
  const {
    profile,
    enabledLanguages,
    activeLanguage,
    updateActiveLanguage,
    isWorkspaceLoading,
    workspaceError,
  } = useWorkspace();

  useEffect(() => {
    if (!isWorkspaceLoading && activeLanguage && activeLanguage !== 'english') {
      updateActiveLanguage('english');
    }
  }, [activeLanguage, isWorkspaceLoading, updateActiveLanguage]);

  const availableLanguages = enabledLanguages.filter((language) =>
    isLanguageAvailable(language.language_code)
  );

  const languageOptions =
    availableLanguages.length > 0
      ? availableLanguages
      : [{ language_code: 'english' }];

  if (isWorkspaceLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-text">
        Loading workspace...
      </main>
    );
  }

  if (workspaceError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-text">
        <div className="max-w-xl rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
          <h1 className="text-2xl font-bold text-text">Workspace error</h1>
          <p className="mt-3 text-sm text-danger-text">{workspaceError}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-surface px-4 py-6 lg:block">
        <div className="flex h-full flex-col">
          <div className="px-3">
            <p className="text-sm font-semibold text-primary">Solang</p>
            <h1 className="mt-1 text-2xl font-bold text-text">Language OS</h1>
          </div>

          <nav className="mt-8 space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-primary-soft hover:text-primary',
                    ].join(' ')
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[1.25rem] bg-surface-muted p-4">
            <p className="text-xs font-medium text-text-muted">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold text-text">
              {profile?.display_name || user?.email}
            </p>
            <p className="mt-1 truncate text-xs text-text-muted">
              {user?.email}
            </p>

            <button
              type="button"
              onClick={signOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="lg:hidden">
              <p className="text-sm font-semibold text-primary">Solang</p>
              <h1 className="text-lg font-bold text-text">Language OS</h1>
            </div>

            <nav className="hidden gap-2 md:flex lg:hidden">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'rounded-2xl px-3 py-2 text-sm font-semibold transition',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-primary-soft hover:text-primary',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <select
                  value="english"
                  onChange={() => updateActiveLanguage('english')}
                  disabled
                  className="appearance-none rounded-2xl border border-border bg-surface px-4 py-3 pr-10 text-sm font-semibold text-text outline-none transition disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {languageOptions.map((language) => (
                    <option
                      key={language.language_code}
                      value={language.language_code}
                    >
                      {formatLanguageLabel(language.language_code)}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
              </div>

              <button
                type="button"
                onClick={signOut}
                className="hidden rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 sm:block lg:hidden"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}