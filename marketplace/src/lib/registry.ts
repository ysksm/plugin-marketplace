import { Plugin, Category } from './types';
import pluginsData from '../data/plugins.json';

export function getAllPlugins(): Plugin[] {
  return pluginsData as Plugin[];
}

export function getPluginBySlug(slug: string): Plugin | undefined {
  return (pluginsData as Plugin[]).find((p) => p.slug === slug);
}

export function getPluginsByCategory(category: Category): Plugin[] {
  return (pluginsData as Plugin[]).filter((p) => p.category === category);
}

export function getFeaturedPlugins(): Plugin[] {
  return (pluginsData as Plugin[]).filter((p) => p.featured);
}

export function searchPlugins(query: string): Plugin[] {
  const q = query.toLowerCase();
  return (pluginsData as Plugin[]).filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.author.name.toLowerCase().includes(q)
  );
}

export function getAllCategories(): Category[] {
  return [
    'developer-tools',
    'productivity',
    'ai',
    'data',
    'testing',
    'monitoring',
  ];
}
