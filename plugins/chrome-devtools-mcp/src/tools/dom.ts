/**
 * DOM query utilities for Chrome DevTools MCP.
 */

/**
 * Build the JavaScript expression used to query DOM elements via Runtime.evaluate.
 * Returns an array of plain objects with the requested properties.
 */
export function buildQueryExpression(selector: string, properties: string[]): string {
  const propList = properties
    .map((p) => `"${p}": el["${p}"] ?? el.getAttribute?.("${p}") ?? null`)
    .join(', ');

  return `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(el => ({${propList}}))`;
}

/**
 * Default properties to return for DOM element queries.
 */
export const DEFAULT_DOM_PROPERTIES = ['tagName', 'id', 'className', 'textContent'];
