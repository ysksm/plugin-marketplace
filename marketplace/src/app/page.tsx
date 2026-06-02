'use client';

import { useState, useMemo } from 'react';
import { Github, Puzzle } from 'lucide-react';
import { getAllPlugins, getAllCategories } from '@/lib/registry';
import { Category } from '@/lib/types';
import PluginCard from '@/components/PluginCard';
import PluginSearch from '@/components/PluginSearch';
import CategoryFilter from '@/components/CategoryFilter';

const allPlugins = getAllPlugins();
const categories = getAllCategories();

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    let plugins = allPlugins;

    if (activeCategory !== 'all') {
      plugins = plugins.filter((p) => p.category === activeCategory);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.author.name.toLowerCase().includes(q)
      );
    }

    return plugins;
  }, [query, activeCategory]);

  const featured = allPlugins.filter((p) => p.featured);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Puzzle className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Claude Code Plugins</span>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="https://github.com/ysksm/plugin-marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-violet-400 bg-violet-950/50 border border-violet-800/50 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            {allPlugins.length} plugins available
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Extend Claude Code with MCP Plugins
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto">
            Discover, install, and manage Model Context Protocol plugins that give Claude Code
            superpowers — browser control, databases, APIs, and more.
          </p>
          <PluginSearch value={query} onChange={setQuery} />
        </div>
      </section>

      {/* Featured */}
      {query === '' && activeCategory === 'all' && featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Featured
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        </section>
      )}

      {/* Main grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center justify-between mb-4">
          <CategoryFilter
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center text-gray-500">
            <Puzzle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No plugins found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        )}
      </section>
    </div>
  );
}
