import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  Headphones,
  Library,
  MessageSquareText,
  Newspaper,
  PlayCircle,
} from 'lucide-react';

const STARTER_RESOURCES = {
  english: [
    {
      id: 'starter-english-ets-toefl',
      title: 'Official TOEFL iBT Preparation',
      resource_type: 'exam',
      provider: 'ETS',
      url: 'https://www.ets.org/toefl/test-takers/ibt/prepare.html',
      notes:
        'Official TOEFL preparation materials. Best for understanding the real exam format.',
      icon: GraduationCap,
    },
    {
      id: 'starter-english-bbc',
      title: 'BBC Learning English',
      resource_type: 'listening',
      provider: 'BBC',
      url: 'https://www.bbc.co.uk/learningenglish',
      notes:
        'Short lessons, listening practice, pronunciation, vocabulary, and grammar.',
      icon: Headphones,
    },
    {
      id: 'starter-english-cambridge-dictionary',
      title: 'Cambridge Dictionary',
      resource_type: 'dictionary',
      provider: 'Cambridge',
      url: 'https://dictionary.cambridge.org/',
      notes:
        'Useful for definitions, British pronunciation, examples, and grammar notes.',
      icon: BookOpen,
    },
    {
      id: 'starter-english-youtube-toefl',
      title: 'TOEFL Speaking & Writing Practice Search',
      resource_type: 'video',
      provider: 'YouTube',
      url: 'https://www.youtube.com/results?search_query=TOEFL+speaking+writing+practice',
      notes:
        'Quick way to find practice explanations and TOEFL answer structure examples.',
      icon: PlayCircle,
    },
  ],

  spanish: [
    {
      id: 'starter-spanish-dele',
      title: 'DELE Exam Information',
      resource_type: 'exam',
      provider: 'Instituto Cervantes',
      url: 'https://examenes.cervantes.es/es/dele/que-es',
      notes:
        'Official information about DELE exams and levels.',
      icon: GraduationCap,
    },
    {
      id: 'starter-spanish-spanishdict',
      title: 'SpanishDict',
      resource_type: 'dictionary',
      provider: 'SpanishDict',
      url: 'https://www.spanishdict.com/',
      notes:
        'Dictionary, conjugation, examples, and beginner-friendly explanations.',
      icon: BookOpen,
    },
    {
      id: 'starter-spanish-noticias',
      title: 'News in Slow Spanish',
      resource_type: 'listening',
      provider: 'News in Slow Spanish',
      url: 'https://www.newsinslowspanish.com/',
      notes:
        'Listening practice with slower Spanish audio.',
      icon: Newspaper,
    },
    {
      id: 'starter-spanish-youtube',
      title: 'Spanish Beginner Practice Search',
      resource_type: 'video',
      provider: 'YouTube',
      url: 'https://www.youtube.com/results?search_query=Spanish+beginner+listening+practice',
      notes:
        'Useful for finding beginner Spanish listening and pronunciation practice.',
      icon: PlayCircle,
    },
  ],

  korean: [
    {
      id: 'starter-korean-topik',
      title: 'TOPIK Official Website',
      resource_type: 'exam',
      provider: 'TOPIK',
      url: 'https://www.topik.go.kr/',
      notes:
        'Official TOPIK information and exam-related materials.',
      icon: GraduationCap,
    },
    {
      id: 'starter-korean-naver-dictionary',
      title: 'Naver Korean Dictionary',
      resource_type: 'dictionary',
      provider: 'Naver',
      url: 'https://korean.dict.naver.com/',
      notes:
        'Korean dictionary with examples, pronunciation, and usage.',
      icon: BookOpen,
    },
    {
      id: 'starter-korean-howtostudykorean',
      title: 'How to Study Korean',
      resource_type: 'grammar',
      provider: 'How to Study Korean',
      url: 'https://www.howtostudykorean.com/',
      notes:
        'Structured Korean grammar lessons from beginner to advanced.',
      icon: Library,
    },
    {
      id: 'starter-korean-youtube',
      title: 'Korean Listening Practice Search',
      resource_type: 'video',
      provider: 'YouTube',
      url: 'https://www.youtube.com/results?search_query=Korean+beginner+listening+practice',
      notes:
        'Useful for beginner listening, shadowing, and pronunciation practice.',
      icon: PlayCircle,
    },
  ],

  italian: [
    {
      id: 'starter-italian-cils',
      title: 'CILS Exam Information',
      resource_type: 'exam',
      provider: 'Università per Stranieri di Siena',
      url: 'https://cils.unistrasi.it/',
      notes:
        'Official CILS exam information for Italian learners.',
      icon: GraduationCap,
    },
    {
      id: 'starter-italian-treccani',
      title: 'Treccani Dictionary',
      resource_type: 'dictionary',
      provider: 'Treccani',
      url: 'https://www.treccani.it/vocabolario/',
      notes:
        'Italian dictionary and language reference.',
      icon: BookOpen,
    },
    {
      id: 'starter-italian-rai',
      title: 'Rai Cultura',
      resource_type: 'listening',
      provider: 'Rai',
      url: 'https://www.raicultura.it/',
      notes:
        'Italian videos and cultural content for immersion.',
      icon: Headphones,
    },
    {
      id: 'starter-italian-youtube',
      title: 'Italian Beginner Practice Search',
      resource_type: 'video',
      provider: 'YouTube',
      url: 'https://www.youtube.com/results?search_query=Italian+beginner+listening+practice',
      notes:
        'Useful for basic Italian listening and pronunciation practice.',
      icon: PlayCircle,
    },
  ],

  russian: [
    {
      id: 'starter-russian-torfl',
      title: 'TORFL / Russian Test Information',
      resource_type: 'exam',
      provider: 'Russian Language Testing',
      url: 'https://testingcenter.spbu.ru/en/exams/russian-language.html',
      notes:
        'Information about Russian language proficiency testing.',
      icon: GraduationCap,
    },
    {
      id: 'starter-russian-wiktionary',
      title: 'Russian Wiktionary',
      resource_type: 'dictionary',
      provider: 'Wiktionary',
      url: 'https://en.wiktionary.org/wiki/Category:Russian_language',
      notes:
        'Useful for word forms, declensions, conjugations, and examples.',
      icon: BookOpen,
    },
    {
      id: 'starter-russian-russianpod101',
      title: 'RussianPod101',
      resource_type: 'listening',
      provider: 'RussianPod101',
      url: 'https://www.russianpod101.com/',
      notes:
        'Audio-based Russian lessons for listening and vocabulary.',
      icon: Headphones,
    },
    {
      id: 'starter-russian-youtube',
      title: 'Russian Beginner Practice Search',
      resource_type: 'video',
      provider: 'YouTube',
      url: 'https://www.youtube.com/results?search_query=Russian+beginner+listening+practice',
      notes:
        'Useful for alphabet, pronunciation, and beginner listening practice.',
      icon: PlayCircle,
    },
  ],
};

function getStarterResources(languageCode) {
  return STARTER_RESOURCES[languageCode] || [];
}

function StarterResourceCard({ resource }) {
  const Icon = resource.icon || ExternalLink;

  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary-soft p-3 text-primary">
              <Icon size={18} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-text">
                {resource.title}
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                  {resource.resource_type}
                </span>

                {resource.provider && (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted ring-1 ring-border">
                    {resource.provider}
                  </span>
                )}
              </div>
            </div>
          </div>

          {resource.notes && (
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {resource.notes}
            </p>
          )}
        </div>

        {resource.url && (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <ExternalLink size={16} />
            Open
          </a>
        )}
      </div>
    </div>
  );
}

function StarterResources({ languageCode }) {
  const starterResources = getStarterResources(languageCode);

  if (starterResources.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary-soft p-3 text-primary">
          <Library size={20} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text">Starter Resources</h2>
          <p className="mt-2 text-sm text-text-muted">
            Suggested resources to start practising. These are not saved to your
            personal library unless you add them manually.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {starterResources.map((resource) => (
          <StarterResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  );
}

export default function ResourceList({
  languageCode,
  resources,
  isLoading,
  error,
  onDelete,
}) {
  const safeResources = Array.isArray(resources) ? resources : [];

  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-text-muted">Loading resources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <p className="text-sm text-danger-text">{error}</p>
      </div>
    );
  }

  if (safeResources.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
          <h2 className="text-xl font-semibold text-text">Your Resources</h2>
          <p className="mt-2 text-sm text-text-muted">
            No personal resources yet for this language. Add your own materials
            or start with the suggestions below.
          </p>
        </div>

        <StarterResources languageCode={languageCode} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-card)] ring-1 ring-border">
        <h2 className="text-xl font-semibold text-text">Your Resources</h2>

        <div className="mt-6 space-y-4">
          {safeResources.map((resource) => (
            <div
              key={resource.id}
              className="rounded-2xl border border-border bg-surface-muted p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {resource.title}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                      {resource.resource_type}
                    </span>

                    {resource.provider && (
                      <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted ring-1 ring-border">
                        {resource.provider}
                      </span>
                    )}
                  </div>

                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <ExternalLink size={15} />
                      Open resource
                    </a>
                  )}

                  {resource.notes && (
                    <p className="mt-3 text-sm leading-7 text-text-muted">
                      {resource.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDelete(resource.id)}
                  className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <StarterResources languageCode={languageCode} />
    </div>
  );
}