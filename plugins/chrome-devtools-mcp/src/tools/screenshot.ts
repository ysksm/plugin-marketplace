/**
 * Screenshot utilities for Chrome DevTools MCP.
 */

export interface ScreenshotOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
}

/**
 * Build CDP captureScreenshot parameters from user options.
 */
export function buildCaptureParams(opts: ScreenshotOptions): Record<string, any> {
  const params: Record<string, any> = {
    format: opts.format ?? 'png',
  };
  if (params.format === 'jpeg') {
    params.quality = opts.quality ?? 90;
  }
  return params;
}

/**
 * Build the JS expression used to get full-page scroll dimensions.
 */
export const FULL_PAGE_DIMS_EXPRESSION =
  'JSON.stringify({width: document.body.scrollWidth, height: document.body.scrollHeight})';
