import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import CDP from 'chrome-remote-interface';

const CDP_HOST = process.env.CDP_HOST ?? 'localhost';
const CDP_PORT = parseInt(process.env.CDP_PORT ?? '9222', 10);

interface CDPClient {
  Console: any;
  Runtime: any;
  DOM: any;
  Network: any;
  Page: any;
  Input: any;
  close(): Promise<void>;
}

async function getClient(): Promise<CDPClient> {
  try {
    const client = await (CDP as any)({ host: CDP_HOST, port: CDP_PORT });
    return client as CDPClient;
  } catch (err: any) {
    throw new Error(
      `Cannot connect to Chrome at ${CDP_HOST}:${CDP_PORT}. ` +
        `Make sure Chrome is running with --remote-debugging-port=${CDP_PORT}. ` +
        `Original error: ${err.message}`
    );
  }
}

// ── Tool definitions ───────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: 'devtools_get_console_logs',
    description:
      'Retrieve browser console messages (log, warn, error, info, debug) from the current page. ' +
      'Returns the most recent messages up to the specified limit.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return (default: 50)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_evaluate',
    description:
      'Evaluate a JavaScript expression in the context of the current page. ' +
      'Returns the serialized result or any thrown error. ' +
      'Use awaitPromise=true for async expressions.',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate',
        },
        awaitPromise: {
          type: 'boolean',
          description: 'Await the result if it is a Promise (default: false)',
        },
      },
      required: ['expression'],
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_query_selector',
    description:
      'Query DOM elements matching a CSS selector. Returns element details including tag, id, class, and inner text. ' +
      'Optionally specify which properties to return.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to query',
        },
        returnProperties: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of element properties to return (e.g. ["tagName","id","className","textContent","href"]). ' +
            'Defaults to tagName, id, className, textContent.',
        },
      },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_get_network_requests',
    description:
      'Get a list of network requests made by the current page, including URL, method, status code, and timing. ' +
      'Note: only requests made after the MCP server connected are captured.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description:
            'Optional substring to filter request URLs (case-insensitive)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of requests to return (default: 50)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_take_screenshot',
    description: 'Take a screenshot of the current page viewport or the full scrollable page.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['png', 'jpeg'],
          description: 'Image format (default: png)',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 0-100 (only for jpeg format, default: 90)',
        },
        fullPage: {
          type: 'boolean',
          description: 'Capture the full scrollable page (default: false)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_get_page_info',
    description:
      'Get basic information about the current page: URL, title, and number of cookies.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_navigate',
    description: 'Navigate the browser to the specified URL and wait for the page to load.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to (must include protocol, e.g. https://)',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'devtools_click',
    description:
      'Click a DOM element identified by a CSS selector. Dispatches a mouse click event on the element.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the element to click',
        },
      },
      required: ['selector'],
      additionalProperties: false,
    },
  },
];

// ── Network request log ────────────────────────────────────────────────────────

interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  timing?: number; // ms
}

const networkLog: Map<string, NetworkRequest> = new Map();

// ── Console log buffer ─────────────────────────────────────────────────────────

interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: number;
}

const consoleLog: ConsoleEntry[] = [];

// ── Server factory ─────────────────────────────────────────────────────────────

export async function createServer() {
  const server = new Server(
    { name: 'chrome-devtools-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Connect to CDP once and set up event listeners
  let cdpClient: CDPClient | null = null;
  let requestStartTimes: Map<string, number> = new Map();

  async function ensureClient(): Promise<CDPClient> {
    if (!cdpClient) {
      cdpClient = await getClient();
      await (cdpClient.Network as any).enable();
      await (cdpClient.Console as any).enable();
      await (cdpClient.Runtime as any).enable();

      // Capture console messages
      (cdpClient as any).Console.messageAdded(({ message }: any) => {
        consoleLog.push({
          level: message.level,
          text: message.text,
          timestamp: Date.now(),
        });
        if (consoleLog.length > 500) consoleLog.shift();
      });

      // Also capture via Runtime.consoleAPICalled for richer output
      (cdpClient as any).Runtime.consoleAPICalled(({ type, args }: any) => {
        const text = args
          .map((a: any) => (a.type === 'string' ? a.value : JSON.stringify(a.value ?? a.description)))
          .join(' ');
        consoleLog.push({ level: type, text, timestamp: Date.now() });
        if (consoleLog.length > 500) consoleLog.shift();
      });

      // Track network requests
      (cdpClient as any).Network.requestWillBeSent(({ requestId, request }: any) => {
        requestStartTimes.set(requestId, Date.now());
        networkLog.set(requestId, {
          requestId,
          url: request.url,
          method: request.method,
        });
      });

      (cdpClient as any).Network.responseReceived(({ requestId, response }: any) => {
        const entry = networkLog.get(requestId);
        if (entry) {
          const start = requestStartTimes.get(requestId);
          entry.status = response.status;
          entry.statusText = response.statusText;
          entry.mimeType = response.mimeType;
          if (start) entry.timing = Date.now() - start;
        }
      });
    }
    return cdpClient;
  }

  // ── List tools ───────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  // ── Call tool ────────────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const client = await ensureClient();

      switch (name) {
        case 'devtools_get_console_logs': {
          const { limit = 50 } = z
            .object({ limit: z.number().optional() })
            .parse(args ?? {});
          const entries = consoleLog.slice(-limit);
          return {
            content: [
              {
                type: 'text',
                text:
                  entries.length === 0
                    ? 'No console messages captured yet.'
                    : entries
                        .map(
                          (e) =>
                            `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] ${e.text}`
                        )
                        .join('\n'),
              },
            ],
          };
        }

        case 'devtools_evaluate': {
          const { expression, awaitPromise = false } = z
            .object({
              expression: z.string(),
              awaitPromise: z.boolean().optional(),
            })
            .parse(args);

          const result = await (client.Runtime as any).evaluate({
            expression,
            awaitPromise,
            returnByValue: true,
          });

          if (result.exceptionDetails) {
            const err = result.exceptionDetails;
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${err.exception?.description ?? err.text ?? 'Unknown error'}`,
                },
              ],
              isError: true,
            };
          }

          const value = result.result?.value;
          return {
            content: [
              {
                type: 'text',
                text: value === undefined ? 'undefined' : JSON.stringify(value, null, 2),
              },
            ],
          };
        }

        case 'devtools_query_selector': {
          const { selector, returnProperties } = z
            .object({
              selector: z.string(),
              returnProperties: z.array(z.string()).optional(),
            })
            .parse(args);

          const props = returnProperties ?? ['tagName', 'id', 'className', 'textContent'];
          const propList = props.map((p) => `"${p}": el["${p}"] ?? el.getAttribute?.("${p}") ?? null`).join(', ');

          const expression = `
            Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map(el => ({
              ${propList}
            }))
          `;

          const result = await (client.Runtime as any).evaluate({
            expression,
            returnByValue: true,
          });

          if (result.exceptionDetails) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${result.exceptionDetails.exception?.description ?? 'Query failed'}`,
                },
              ],
              isError: true,
            };
          }

          const elements = result.result?.value ?? [];
          return {
            content: [
              {
                type: 'text',
                text:
                  elements.length === 0
                    ? `No elements found matching selector: ${selector}`
                    : JSON.stringify(elements, null, 2),
              },
            ],
          };
        }

        case 'devtools_get_network_requests': {
          const { filter, limit = 50 } = z
            .object({ filter: z.string().optional(), limit: z.number().optional() })
            .parse(args ?? {});

          let requests = Array.from(networkLog.values());
          if (filter) {
            requests = requests.filter((r) =>
              r.url.toLowerCase().includes(filter.toLowerCase())
            );
          }
          requests = requests.slice(-limit);

          return {
            content: [
              {
                type: 'text',
                text:
                  requests.length === 0
                    ? 'No network requests captured yet.'
                    : JSON.stringify(requests, null, 2),
              },
            ],
          };
        }

        case 'devtools_take_screenshot': {
          const { format = 'png', quality = 90, fullPage = false } = z
            .object({
              format: z.enum(['png', 'jpeg']).optional(),
              quality: z.number().min(0).max(100).optional(),
              fullPage: z.boolean().optional(),
            })
            .parse(args ?? {});

          const captureParams: Record<string, any> = { format };
          if (format === 'jpeg') captureParams.quality = quality;

          if (fullPage) {
            // Get full page dimensions
            const dims = await (client.Runtime as any).evaluate({
              expression: 'JSON.stringify({width: document.body.scrollWidth, height: document.body.scrollHeight})',
              returnByValue: true,
            });
            const { width, height } = JSON.parse(dims.result?.value ?? '{"width":1280,"height":720}');
            await (client.Page as any).setDeviceMetricsOverride({
              width,
              height,
              deviceScaleFactor: 1,
              mobile: false,
            });
          }

          const screenshot = await (client.Page as any).captureScreenshot(captureParams);

          if (fullPage) {
            await (client.Page as any).clearDeviceMetricsOverride();
          }

          return {
            content: [
              {
                type: 'image',
                data: screenshot.data,
                mimeType: `image/${format}`,
              },
            ],
          };
        }

        case 'devtools_get_page_info': {
          const urlResult = await (client.Runtime as any).evaluate({
            expression: 'JSON.stringify({url: location.href, title: document.title, cookieCount: document.cookie.split(";").filter(Boolean).length})',
            returnByValue: true,
          });

          const info = JSON.parse(urlResult.result?.value ?? '{}');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(info, null, 2),
              },
            ],
          };
        }

        case 'devtools_navigate': {
          const { url } = z.object({ url: z.string().url() }).parse(args);

          await (client.Page as any).navigate({ url });
          await (client.Page as any).loadEventFired();

          return {
            content: [
              {
                type: 'text',
                text: `Navigated to ${url}`,
              },
            ],
          };
        }

        case 'devtools_click': {
          const { selector } = z.object({ selector: z.string() }).parse(args);

          const result = await (client.Runtime as any).evaluate({
            expression: `
              (function() {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { found: false };
                el.click();
                const rect = el.getBoundingClientRect();
                return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              })()
            `,
            returnByValue: true,
          });

          const val = result.result?.value;
          if (!val?.found) {
            return {
              content: [{ type: 'text', text: `No element found matching selector: ${selector}` }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Clicked element at (${Math.round(val.x)}, ${Math.round(val.y)}) matching selector: ${selector}`,
              },
            ],
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: any) {
      // If CDP connection is lost, reset so it reconnects on next call
      if (
        err.message?.includes('Cannot connect') ||
        err.message?.includes('ECONNREFUSED')
      ) {
        cdpClient = null;
      }
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  return {
    run: async () => {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('Chrome DevTools MCP server running on stdio');
    },
  };
}
