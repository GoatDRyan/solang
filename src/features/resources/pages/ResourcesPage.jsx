import { useMemo } from 'react';
import { BookOpen, Link, PlusCircle } from 'lucide-react';
import { useWorkspace } from '../../../app/providers/WorkspaceProvider';
import { useResources } from '../../../hooks/useResources';
import ResourceForm from '../components/ResourceForm';
import ResourceList from '../components/ResourceList';

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

function formatDate(value) {
  if (!value) return 'No recent resource';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ResourceStatCard({ icon: Icon, label, value, helper }) {
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

export default function ResourcesPage() {
  const { activeLanguage } = useWorkspace();
  const languageCode = activeLanguage || '';

  const {
    resources,
    isResourcesLoading,
    resourcesError,
    addResource,
    removeResource,
  } = useResources(languageCode);

  const resourceStats = useMemo(() => {
    const safeResources = Array.isArray(resources) ? resources : [];

    const linkResources = safeResources.filter((resource) =>
      Boolean(resource.url || resource.link)
    ).length;

    const latestResource = [...safeResources].sort(
      (a, b) =>
        new Date(b.created_at || b.updated_at || 0) -
        new Date(a.created_at || a.updated_at || 0)
    )[0];

    return {
      total: safeResources.length,
      linkResources,
      latestDate: latestResource?.created_at || latestResource?.updated_at || null,
    };
  }, [resources]);

  if (!languageCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text">
        Loading active language...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-text-muted">Active language</p>
        <h1 className="mt-1 text-3xl font-bold text-text">
          Resources · {formatLanguageLabel(languageCode)}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Save useful learning materials, videos, websites, textbooks, and exam
          resources for this language.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ResourceStatCard
          icon={BookOpen}
          label="Saved resources"
          value={resourceStats.total}
          helper="Linked to the active language"
        />

        <ResourceStatCard
          icon={Link}
          label="External links"
          value={resourceStats.linkResources}
          helper="Resources with a URL"
        />

        <ResourceStatCard
          icon={PlusCircle}
          label="Latest addition"
          value={formatDate(resourceStats.latestDate)}
          helper="Most recently saved resource"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ResourceForm languageCode={languageCode} onSubmit={addResource} />

        <ResourceList
          languageCode={languageCode}
          resources={resources}
          isLoading={isResourcesLoading}
          error={resourcesError}
          onDelete={removeResource}
        />
      </div>
    </div>
  );
}