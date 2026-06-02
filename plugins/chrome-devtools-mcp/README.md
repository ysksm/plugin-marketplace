# Chrome DevTools MCP

An MCP server that connects Claude Code to the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) (CDP), giving your AI assistant direct browser access.

## Features

- Inspect DOM elements and their properties
- Read browser console output (errors, warnings, logs)
- Monitor network requests with status codes and timing
- Evaluate JavaScript expressions in the page context
- Capture full-page or viewport screenshots
- Navigate to URLs and click elements

## Requirements

Chrome or Chromium must be running with remote debugging enabled:

```bash
# Linux / Windows
google-chrome --remote-debugging-port=9222

# macOS
open -a 'Google Chrome' --args --remote-debugging-port=9222
```

## Installation

```bash
claude mcp add chrome-devtools npx @claude-plugins/chrome-devtools-mcp
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@claude-plugins/chrome-devtools-mcp"],
      "env": {
        "CDP_HOST": "localhost",
        "CDP_PORT": "9222"
      }
    }
  }
}
```

## Configuration

| Environment Variable | Default     | Description                       |
|---------------------|-------------|-----------------------------------|
| `CDP_HOST`          | `localhost` | Chrome remote debugging host      |
| `CDP_PORT`          | `9222`      | Chrome remote debugging port      |

## Available Tools

| Tool                           | Description                                         |
|-------------------------------|-----------------------------------------------------|
| `devtools_get_console_logs`   | Retrieve browser console output                     |
| `devtools_evaluate`           | Execute JavaScript in the page context              |
| `devtools_query_selector`     | Find DOM elements and extract properties            |
| `devtools_get_network_requests` | List XHR/fetch requests with status and timing    |
| `devtools_take_screenshot`    | Capture screenshots                                 |
| `devtools_get_page_info`      | Get URL, title, and cookie count                    |
| `devtools_navigate`           | Navigate to a URL                                   |
| `devtools_click`              | Click DOM elements by CSS selector                  |

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
