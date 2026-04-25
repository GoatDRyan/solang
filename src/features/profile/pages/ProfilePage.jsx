import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';

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

export default function ProfilePage() {
  const { user } = useAuth();
  const {
    profile,
    languages,
    activeLanguage,
    saveProfile,
    updateActiveLanguage,
  } = useWorkspace();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activeLanguage && activeLanguage !== 'english') {
      updateActiveLanguage('english');
    }
  }, [activeLanguage, updateActiveLanguage]);

  const availableLanguages = languages.filter((language) =>
    isLanguageAvailable(language.language_code)
  );

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      await saveProfile({
        display_name: displayName.trim() || null,
      });

      setMessage('Profile updated.');
    } catch (error) {
      setMessage(error.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text">Profile</h1>
        <p className="mt-2 text-sm text-text-muted">
          Manage your account and language workspace.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
          <h2 className="text-xl font-semibold text-text">Account</h2>
          <p className="mt-2 text-sm text-text-muted">
            Your profile is stored in Supabase.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                Email
              </label>
              <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
                {user?.email}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                Display name
              </label>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
                placeholder="Your name"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>

            {message && (
              <div className="rounded-2xl bg-success-soft p-3 text-sm text-success-text">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
          <h2 className="text-xl font-semibold text-text">Languages</h2>
          <p className="mt-2 text-sm text-text-muted">
            For now, Solang is focused on English only. Spanish, Korean,
            Italian, and Russian will be re-enabled later.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-text">
              Active language
            </label>

            <select
              value="english"
              onChange={() => updateActiveLanguage('english')}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none"
            >
              {availableLanguages.map((language) => (
                <option
                  key={language.language_code}
                  value={language.language_code}
                >
                  {formatLanguageLabel(language.language_code)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 space-y-3">
            {languages.map((language) => {
              const languageCode = language.language_code;
              const isAvailable = isLanguageAvailable(languageCode);
              const isActive = languageCode === 'english';

              return (
                <div
                  key={languageCode}
                  className={[
                    'flex items-center justify-between gap-4 rounded-2xl p-4',
                    isAvailable
                      ? 'bg-surface-muted'
                      : 'bg-surface-muted opacity-60',
                  ].join(' ')}
                >
                  <div>
                    <p className="font-semibold text-text">
                      {formatLanguageLabel(languageCode)}
                    </p>

                    <p className="text-sm text-text-muted">
                      {isActive
                        ? 'Current workspace language'
                        : 'Temporarily disabled'}
                    </p>
                  </div>

                  {isAvailable ? (
                    <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-muted ring-1 ring-border">
                      <Lock size={13} />
                      Coming later
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}