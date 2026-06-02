/**
 * Console log capture utilities for Chrome DevTools MCP.
 * This module provides helpers for formatting and filtering console entries.
 */

export interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: number;
}

/**
 * Format a console entry as a human-readable log line.
 */
export function formatConsoleEntry(entry: ConsoleEntry): string {
  return `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] ${entry.text}`;
}

/**
 * Filter console entries by level.
 */
export function filterByLevel(
  entries: ConsoleEntry[],
  levels: string[]
): ConsoleEntry[] {
  const set = new Set(levels.map((l) => l.toLowerCase()));
  return entries.filter((e) => set.has(e.level.toLowerCase()));
}
