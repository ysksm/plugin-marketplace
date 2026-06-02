'use client';

import { Search, X } from 'lucide-react';

interface PluginSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PluginSearch({ value, onChange }: PluginSearchProps) {
  return (
    <div className="relative max-w-xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search plugins by name, tag, or author..."
        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-10 py-3 text-sm placeholder:text-gray-600 text-gray-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
