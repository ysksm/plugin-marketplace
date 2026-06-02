/**
 * Network request utilities for Chrome DevTools MCP.
 */

export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  timing?: number; // milliseconds
}

/**
 * Filter network requests by a substring match on their URL.
 */
export function filterByUrl(requests: NetworkRequest[], filter: string): NetworkRequest[] {
  const lower = filter.toLowerCase();
  return requests.filter((r) => r.url.toLowerCase().includes(lower));
}

/**
 * Filter network requests by HTTP status code range.
 * e.g. filterByStatus(requests, 400, 599) returns all error responses.
 */
export function filterByStatus(
  requests: NetworkRequest[],
  min: number,
  max: number
): NetworkRequest[] {
  return requests.filter(
    (r) => r.status !== undefined && r.status >= min && r.status <= max
  );
}

/**
 * Summarize request counts by HTTP status class (2xx, 3xx, 4xx, 5xx).
 */
export function summarizeByStatus(requests: NetworkRequest[]): Record<string, number> {
  const summary: Record<string, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };
  for (const r of requests) {
    if (!r.status) {
      summary['other']++;
    } else if (r.status < 300) {
      summary['2xx']++;
    } else if (r.status < 400) {
      summary['3xx']++;
    } else if (r.status < 500) {
      summary['4xx']++;
    } else {
      summary['5xx']++;
    }
  }
  return summary;
}
