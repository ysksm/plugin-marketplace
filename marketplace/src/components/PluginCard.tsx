'use client';

import Link from 'next/link';
import { Download, Star, CheckCircle } from 'lucide-react';
import { Plugin } from '@/lib/types';
import InstallButton from './InstallButton';

interface PluginCardProps {
  plugin: Plugin;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const categoryLabel: Record<string, string> = {
  'developer-tools': 'Dev Tools',
  productivity: 'Productivity',
  ai: 'AI',
  data: 'Data',
  testing: 'Testing',
  monitoring: 'Monitoring',
};

export default function PluginCard({ plugin }: PluginCardProps) {
  return (
    <div
      className={`relative rounded-xl border bg-gray-900 flex flex-col overflow-hidden transition-all hover:border-gray-600 hover:-translate-y-0.5 ${
        plugin.featured
          ? 'border-transparent ring-1 ring-violet-500/50 before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-violet-500/10 before:to-indigo-500/5 before:pointer-events-none'
          : 'border-gray-800'
      }`}
    >
      <div className="p-5 flex-1 flex flex-col">
        {/* Icon + badges */}
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl w-12 h-12 flex items-center justify-center bg-gray-800 rounded-xl">
            {plugin.icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">
              v{plugin.version}
            </span>
            {plugin.verified && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <CheckCircle className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        </div>

        {/* Name + category */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              href={`/plugins/${plugin.slug}`}
              className="font-semibold hover:text-violet-400 transition-colors leading-tight"
            >
              {plugin.name}
            </Link>
          </div>
          <span className="text-xs text-gray-500">
            {categoryLabel[plugin.category] ?? plugin.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 flex-1 line-clamp-2 mb-3">{plugin.description}</p>

        {/* Author + stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>{plugin.author.name}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {formatNumber(plugin.stats.downloads)}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {formatNumber(plugin.stats.stars)}
            </span>
          </div>
        </div>

        {/* Install button */}
        <InstallButton command={plugin.installCommand} compact />
      </div>
    </div>
  );
}
