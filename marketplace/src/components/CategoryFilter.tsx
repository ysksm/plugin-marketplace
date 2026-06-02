'use client';

import { Category } from '@/lib/types';

interface CategoryFilterProps {
  categories: Category[];
  active: Category | 'all';
  onChange: (cat: Category | 'all') => void;
}

const labels: Record<Category | 'all', string> = {
  all: 'All',
  'developer-tools': 'Developer Tools',
  productivity: 'Productivity',
  ai: 'AI',
  data: 'Data',
  testing: 'Testing',
  monitoring: 'Monitoring',
};

export default function CategoryFilter({ categories, active, onChange }: CategoryFilterProps) {
  const all: Array<Category | 'all'> = ['all', ...categories];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {all.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`text-sm px-3 py-1.5 rounded-lg transition-colors font-medium ${
            active === cat
              ? 'bg-violet-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          {labels[cat]}
        </button>
      ))}
    </div>
  );
}
