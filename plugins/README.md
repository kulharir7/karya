# Karya Plugins

This directory contains custom plugins for Karya.

## Creating a Plugin

```typescript
import { createPlugin } from "../src/lib/plugin-api";
import { z } from "zod";

const myPlugin = createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
})

// Add custom tools
.tool({
  id: "my-tool",
  description: "Does something cool",
  inputSchema: z.object({
    input: z.string(),
  }),
  execute: async ({ input }) => {
    return { result: `Processed: ${input}` };
  },
})

// Hook into events
.on("tool:before_call", (data, ctx) => {
  ctx.log(`Tool called: ${data.tool}`);
})

// Add middleware
.use(async (req, next) => {
  console.log(`Middleware: ${req.tool}`);
  return next();
})

// Register the plugin
.register();

export default myPlugin;
```

## Available Hooks

| Event | Description |
|-------|-------------|
| `tool:before_call` | Before a tool executes |
| `tool:after_call` | After a tool completes |
| `tool:error` | When a tool fails |
| `agent:start` | Agent run begins |
| `agent:end` | Agent run completes |
| `agent:error` | Agent encounters error |
| `message:received` | User message received |
| `message:sent` | Assistant message sent |
| `session:created` | New session created |
| `session:deleted` | Session deleted |

## Plugin Context

Plugins receive a context object with:

```typescript
interface PluginContext {
  sessionId?: string;
  callTool: (toolId: string, args: any) => Promise<any>;
  emit: (event: string, data: any) => void;
  log: (message: string) => void;
}
```

## API

```bash
# List plugins
GET /api/plugins

# Get plugin stats
GET /api/plugins?action=stats

# List plugin tools
GET /api/plugins?action=tools

# Execute plugin tool
POST /api/plugins
{
  "action": "execute",
  "toolId": "my-tool",
  "args": { "input": "test" }
}

# Toggle plugin
POST /api/plugins
{
  "action": "toggle",
  "id": "my-plugin",
  "enabled": false
}

# Load plugin from file
POST /api/plugins
{
  "action": "load",
  "filePath": "./plugins/my-plugin.ts"
}
```

## Built-in Example Plugins

1. **Logging Plugin** — Logs all tool calls
2. **Rate Limit Middleware** — 60 calls/minute per tool
3. **Example Tools** — hello-world, random-number
