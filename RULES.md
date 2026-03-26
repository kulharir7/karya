# RULES.md — Karya Development Bible

> ⚠️ READ THIS BEFORE WRITING ANY CODE. No excuses.

## 🔴 Golden Rules

1. **NEVER guess an API** — check types/docs FIRST, code SECOND
2. **NEVER use deprecated patterns** — we use latest versions only
3. **Test EVERY change** before committing — `npx next build` must pass
4. **One file at a time** — finish it, test it, then next
5. **No shortcuts** — do it right or don't do it

---

## 📦 Mastra Framework Rules (v1.16+)

### Agent Creation
```typescript
// ✅ CORRECT — id is REQUIRED
new Agent({
  id: "my-agent",          // REQUIRED — unique identifier
  name: "My Agent",        // display name
  instructions: "...",     // system prompt
  model: getModel(),       // LLM model
  tools: { ... },          // tool objects
});

// ❌ WRONG — missing id
new Agent({ name: "My Agent", ... });
```

### Tool Creation
```typescript
// ✅ CORRECT — execute receives destructured input directly
createTool({
  id: "my-tool",
  description: "...",
  inputSchema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ name, age }) => {    // ← Direct destructure
    return { result: `${name} is ${age}` };
  },
});

// ❌ WRONG — no "context" wrapper
execute: async ({ context }) => { ... }
// ❌ WRONG — no "input" wrapper  
execute: async ({ input }) => { ... }
```

### Mastra Instance
```typescript
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: {
    agentId: agentInstance,  // key = id used in getAgent()
  },
});

// Usage
const agent = mastra.getAgent("agentId");
const result = await agent.generate("prompt");
const result = await agent.generate([
  { role: "user", content: "msg1" },
  { role: "user", content: "msg2" },
]);
```

### Model Configuration
```typescript
// ✅ CORRECT — use "any" return type to avoid AI SDK version conflicts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const provider = createOpenAICompatible({
  name: "ollama-cloud",
  baseURL: process.env.LLM_BASE_URL || "https://ollama.com/v1",
  apiKey: process.env.LLM_API_KEY || "ollama",
});

export function getModel(): any {   // ← "any" avoids LanguageModel vs LanguageModelV2 conflicts
  return provider(MODEL_ID);
}

// ❌ WRONG — type import causes version mismatch
import type { LanguageModelV1 } from "ai";  // DONT DO THIS
import type { LanguageModel } from "ai";     // DONT DO THIS
```

---

## 🌐 Stagehand v3 Rules (v3.2+)

### Constructor
```typescript
// ✅ CORRECT V3 constructor
new Stagehand({
  env: "LOCAL",                          // "LOCAL" or "BROWSERBASE"
  verbose: 1,                            // 0, 1, or 2
  localBrowserLaunchOptions: {           // ← NOT top-level headless
    headless: false,
  },
  model: {                               // ← ModelConfiguration type
    modelName: "gpt-4o",                 // ← "modelName" NOT "name"
    provider: "openai",
    apiKey: "...",
    baseURL: "...",
  },
});

// ❌ WRONG v2 patterns — DO NOT USE
{ headless: false }           // not top-level
{ modelName: "gpt-4o" }      // not top-level
{ enableCaching: true }       // doesn't exist in v3
```

### V3Options Available Fields
```
env, sessionId, apiKey, projectId, browserbaseSessionCreateParams,
browserbaseSessionID, keepAlive, localBrowserLaunchOptions, model,
llmClient, systemPrompt, logInferenceToFile, experimental, verbose,
selfHeal, waitForCaptchaSolves, actTimeoutMs, disablePino, logger,
cacheDir, domSettleTimeout, disableAPI, serverCache
```

### localBrowserLaunchOptions Fields
```
args, executablePath, port, userDataDir, preserveUserDataDir,
headless, devtools, chromiumSandbox, ignoreDefaultArgs, proxy,
locale, viewport, deviceScaleFactor, hasTouch, ignoreHTTPSErrors,
cdpUrl, cdpHeaders, connectTimeoutMs, downloadsPath, acceptDownloads
```

### ModelConfiguration
```typescript
type ModelConfiguration = 
  | AvailableModel               // just a string like "gpt-4o"
  | (ClientOptions & {
      modelName: AvailableModel;  // ← "modelName" required
    });
```

### Page Access
```typescript
// ✅ CORRECT — use context.pages()
const stagehand = await getStagehand();
const page = stagehand.context.pages()[0];
await page.goto(url);
await page.title();
await page.screenshot({ path: "..." });

// ❌ WRONG — no direct .page property in v3
stagehand.page  // DOES NOT EXIST
```

### Act (Perform Actions)
```typescript
// ✅ CORRECT v3 — string parameter
await stagehand.act("click the login button");
await stagehand.act("type hello in the search box");
await stagehand.act("scroll down");

// ❌ WRONG — v2 object syntax
await stagehand.act({ action: "click button" });  // WRONG
```

### Extract (Get Data)
```typescript
// ✅ CORRECT v3 — string parameter
const result = await stagehand.extract("get all product prices");

// With schema (optional)
const result = await stagehand.extract("get prices", {
  schema: z.object({ prices: z.array(z.string()) }),
});

// ❌ WRONG — v2 object syntax
await stagehand.extract({ instruction: "..." });  // WRONG
```

### Observe (Find Elements)
```typescript
const elements = await stagehand.observe("find all buttons on the page");
```

### Agent (Multi-step)
```typescript
const agent = stagehand.agent();
await agent.execute("search for flights and find cheapest");
```

---

## ⚙️ Next.js Rules (v16+)

### tsconfig.json
```json
{
  "compilerOptions": {
    "rootDir": ".",           // ← NOT "./src" (Next.js adds .next/types)
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "skipLibCheck": true      // ← ALWAYS true (avoids node_modules type conflicts)
  }
}
```

### Package.json
```json
{
  "type": "module"            // ← ESM mode for Mastra
}
```

### Import Paths
```typescript
// ✅ CORRECT — use @ alias
import { getStagehand } from "@/lib/stagehand";
import { getModel } from "@/lib/llm";

// ❌ WRONG — relative with .js extension
import { getStagehand } from "../../../lib/stagehand.js";
```

### API Routes
```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  // ... process
  return NextResponse.json({ ... });
}
```

### Server External Packages
```typescript
// next.config.ts — packages that shouldn't be bundled
const nextConfig = {
  serverExternalPackages: ["@browserbasehq/stagehand", "sharp"],
};
```

---

## 🔑 Ollama Cloud API Rules

### Authentication
```
Base URL: https://ollama.com/v1
Auth: Bearer <API_KEY>
API Key location: Stored in .env as LLM_API_KEY
```

### Working Key (from OpenClaw config)
```
File: C:\Users\kulha\.openclaw\openclaw.json
Path: models.providers.custom-ollama-com.apiKey
```

### Model Names
```
gpt-oss:120b          — GPT-OSS 120B (fast, good)
qwen3-coder:480b      — Qwen3 Coder 480B (needs -cloud suffix for local ollama)
glm-5:cloud           — GLM-5
glm-4.7:cloud         — GLM-4.7
deepseek-r1:671b      — DeepSeek R1
qwen3:235b            — Qwen3 235B
```

### Test Command
```powershell
$key = 'YOUR_KEY'
$headers = @{ 'Authorization' = "Bearer $key"; 'Content-Type' = 'application/json' }
$body = '{"model":"gpt-oss:120b","messages":[{"role":"user","content":"hi"}],"stream":false}'
Invoke-RestMethod -Uri "https://ollama.com/v1/chat/completions" -Method POST -Headers $headers -Body $body
```

---

## 🖥️ PowerShell Rules (Windows Dev)

```powershell
# ✅ Use semicolons, NOT &&
cd F:\karya; npm run dev

# ❌ WRONG — && doesn't work in PowerShell
cd F:\karya && npm run dev

# Kill process on port
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Run Next.js in background (use node directly)
node node_modules/next/dist/bin/next dev --port 3000

# ❌ WRONG — npx doesn't work with Start-Process
Start-Process -FilePath "npx" ...  # FAILS
```

---

## 📁 Project Structure (Official)

```
F:\karya/
├── .env                    # API keys (NEVER commit)
├── .env.example            # Template
├── .gitignore
├── package.json            # type: "module"
├── tsconfig.json           # rootDir: "."
├── next.config.ts
├── postcss.config.mjs
├── RULES.md                # THIS FILE — read before coding
├── README.md
│
├── src/
│   ├── lib/
│   │   ├── llm.ts          # LLM provider config (getModel)
│   │   └── stagehand.ts    # Stagehand singleton
│   │
│   ├── mastra/
│   │   ├── index.ts         # Mastra instance (agents registry)
│   │   ├── agents/
│   │   │   ├── planner.ts   # Main Karya agent (all tools)
│   │   │   ├── browser.ts   # Browser specialist
│   │   │   └── file.ts      # File specialist
│   │   └── tools/
│   │       ├── browser/     # navigate, act, extract, screenshot
│   │       ├── file/        # read, write, list, move, search
│   │       ├── shell/       # execute command
│   │       └── system/      # system-info, clipboard, notify
│   │
│   └── app/                 # Next.js frontend
│       ├── layout.tsx
│       ├── globals.css
│       ├── page.tsx         # Main UI
│       ├── api/
│       │   └── chat/route.ts
│       └── components/
│
├── public/
├── screenshots/             # Agent screenshots saved here
└── docker/
```

---

## 🚀 Dev Commands

```bash
# Start dev server
cd F:\karya; npm run dev

# Build (must pass before commit)
cd F:\karya; npx next build

# Test agent CLI
cd F:\karya; npx tsx src/test-agent.ts

# Git commit
cd F:\karya; git add -A; git commit -m "message"
```

---

## ⚠️ Common Pitfalls (Already Hit & Fixed)

| Problem | Cause | Fix |
|---------|-------|-----|
| `Property 'id' is missing` | Mastra Agent needs id | Add `id: "name"` |
| `context does not exist` | Tool execute API | Destructure directly: `({ name })` |
| `headless does not exist` | Stagehand v3 changed | Use `localBrowserLaunchOptions` |
| `modelName does not exist on V3Options` | model is nested object | `model: { modelName: "..." }` |
| `Property 'page' does not exist` | v3 removed .page | Use `stagehand.context.pages()[0]` |
| `act({ action })` wrong | v3 takes string | `stagehand.act("click button")` |
| `extract({ instruction })` wrong | v3 takes string | `stagehand.extract("get data")` |
| `LanguageModelV1 not found` | AI SDK v4 renamed | Use `any` return type |
| `rootDir doesn't contain .next` | tsconfig rootDir | Set `rootDir: "."` |
| `401 Unauthorized` | Wrong API key | Use key from openclaw.json |
| `EADDRINUSE port 3000` | Old process alive | Kill process on port first |
| `npx Start-Process fails` | Windows npx issue | Use `node node_modules/next/dist/bin/next` |

---

*Last updated: 2026-03-26*
*Update this file whenever you learn something new.*
