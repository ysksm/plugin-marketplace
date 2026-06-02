import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Github, Star, Download, Shield, CheckCircle, ExternalLink } from 'lucide-react';
import { getPluginBySlug, getAllPlugins } from '@/lib/registry';
import InstallButton from '@/components/InstallButton';

export async function generateStaticParams() {
  const plugins = getAllPlugins();
  return plugins.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const plugin = getPluginBySlug(params.slug);
  if (!plugin) return {};
  return {
    title: `${plugin.name} — Claude Code Plugins`,
    description: plugin.description,
  };
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const categoryLabel: Record<string, string> = {
  'developer-tools': 'Developer Tools',
  productivity: 'Productivity',
  ai: 'AI',
  data: 'Data',
  testing: 'Testing',
  monitoring: 'Monitoring',
};

export default function PluginDetailPage({ params }: { params: { slug: string } }) {
  const plugin = getPluginBySlug(params.slug);
  if (!plugin) notFound();

  const configJson = plugin.mcpConfig
    ? JSON.stringify(
        {
          mcpServers: {
            [plugin.id]: plugin.mcpConfig,
          },
        },
        null,
        2
      )
    : null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Plugin header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
          <div className="text-6xl w-20 h-20 flex items-center justify-center bg-gray-900 rounded-2xl border border-gray-800 flex-shrink-0">
            {plugin.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{plugin.name}</h1>
              {plugin.verified && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-950/50 border border-blue-800/50 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              )}
              {plugin.featured && (
                <span className="text-xs font-medium text-violet-400 bg-violet-950/50 border border-violet-800/50 rounded-full px-2 py-0.5">
                  Featured
                </span>
              )}
            </div>
            <p className="text-gray-400 mb-3">{plugin.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                {formatNumber(plugin.stats.downloads)} downloads
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5" />
                {formatNumber(plugin.stats.stars)} stars
              </span>
              <span>v{plugin.version}</span>
              <span
                className="bg-gray-800 rounded-full px-2 py-0.5 text-xs"
              >
                {categoryLabel[plugin.category] ?? plugin.category}
              </span>
              {plugin.githubUrl && (
                <a
                  href={plugin.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  Source
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Long description */}
            <section>
              <h2 className="text-xl font-semibold mb-4">About</h2>
              <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-line text-sm">
                {plugin.longDescription}
              </div>
            </section>

            {/* Tags */}
            {plugin.tags.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {plugin.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-gray-400 bg-gray-800 rounded-full px-3 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Screenshots placeholder */}
            <section>
              <h2 className="text-xl font-semibold mb-3">Screenshots</h2>
              <div className="rounded-xl border border-dashed border-gray-700 p-12 text-center text-gray-600">
                No screenshots available
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Install */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-3">Install</h3>
              <p className="text-xs text-gray-500 mb-3">
                Run this command in your terminal:
              </p>
              <code className="block bg-gray-950 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all mb-3">
                {plugin.installCommand}
              </code>
              <InstallButton command={plugin.installCommand} />
            </div>

            {/* MCP Config */}
            {configJson && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="font-semibold mb-3">MCP Config</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Add to your <code className="text-gray-300">.claude/settings.json</code>:
                </p>
                <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre">
                  {configJson}
                </pre>
              </div>
            )}

            {/* Author */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-3">Author</h3>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {plugin.author.name[0]}
                </div>
                <div>
                  {plugin.author.url ? (
                    <a
                      href={plugin.author.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-violet-400 transition-colors"
                    >
                      {plugin.author.name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{plugin.author.name}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-3">Stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Downloads</dt>
                  <dd className="font-medium">{plugin.stats.downloads.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Stars</dt>
                  <dd className="font-medium">{plugin.stats.stars.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Version</dt>
                  <dd className="font-medium">v{plugin.version}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="font-medium">
                    {new Date(plugin.stats.lastUpdated).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
