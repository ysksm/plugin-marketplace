# Claude Code Plugin Marketplace

A marketplace for Claude Code MCP (Model Context Protocol) plugins, featuring a Next.js 14 web app and sample plugins.

## Structure

```
plugin-marketplace/
├── marketplace/          # Next.js 14 web app
├── plugins/              # MCP plugin implementations
│   └── chrome-devtools-mcp/
└── registry/             # Canonical plugin registry
```

## Getting Started

### Marketplace

```bash
cd marketplace
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Chrome DevTools MCP Plugin

```bash
cd plugins/chrome-devtools-mcp
npm install
npm run build
```

#### Usage

Start Chrome with remote debugging:
```bash
google-chrome --remote-debugging-port=9222
```

Add to Claude Code:
```bash
claude mcp add chrome-devtools npx @claude-plugins/chrome-devtools-mcp
```

## Adding a Plugin to the Registry

1. Create your MCP server in `plugins/<your-plugin-name>/`
2. Add a `plugin.json` manifest
3. Update `registry/index.json` with your plugin details
4. Submit a PR to add it to the marketplace

## License

MIT
