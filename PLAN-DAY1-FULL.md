# KARYA — Day 1 Complete Plan (Saturday 28th March 2026)

**Start Time:** 9:00 AM
**End Time:** 11:00 PM (14 hours)
**Goal:** Core Stability + Working Demo

---

## 🌅 MORNING SESSION (9:00 AM - 1:00 PM)

### 9:00 AM - 9:30 AM: Setup & Current State Check

```
□ Open VS Code with F:\karya
□ Open terminal in VS Code
□ Run: cd /d F:\karya
□ Run: git status (check everything committed)
□ Run: git log --oneline -5 (see recent commits)
□ Run: npm install (ensure all deps)
□ Run: npx tsc --noEmit (check for TypeScript errors)

Expected Issues:
- Import errors from new files (memory-v2, bridges, etc.)
- Missing type definitions
- Circular dependencies

Document all errors in: BUGS-DAY1.md
```

### 9:30 AM - 10:30 AM: Fix All Import/Build Errors

```
□ Open each error file one by one
□ Fix import paths:
  - "@/lib/memory-v2" should work
  - "@/lib/logger" should work
  - "@/bridges" should work

Common fixes needed:

1. src/lib/memory-v2/index.ts
   - Check if logger import works
   - Check if fs/path imports work

2. src/lib/context-compaction.ts
   - Import getMemoryManager from "./memory-v2"
   - Make sure logger import works

3. src/bridges/telegram.ts
   - grammy not installed yet
   - Add try-catch for dynamic import

4. src/lib/self-improving.ts
   - Check getMemoryManager import
   - Check logger import

5. src/lib/heartbeat.ts
   - Check all imports

□ Run: npx tsc --noEmit again
□ Goal: ZERO errors
```

### 10:30 AM - 11:30 AM: Server Crash Investigation

```
□ Run: npm run dev
□ Open http://localhost:3000
□ Wait and observe — when does it crash?
□ Check terminal for error messages

Possible causes:

1. WebSocket Server (port 3002)
   File: src/lib/websocket-server.ts
   Issue: May crash if port already in use
   Fix:
   ```typescript
   // Add port check before starting
   const net = require('net');
   const server = net.createServer();
   server.once('error', (err) => {
     if (err.code === 'EADDRINUSE') {
       console.log('[ws] Port 3002 in use, skipping WebSocket');
     }
   });
   ```

2. instrumentation.ts runs multiple times
   File: src/instrumentation.ts
   Issue: Next.js may call register() multiple times
   Fix:
   ```typescript
   let initialized = false;
   export async function register() {
     if (initialized) return;
     initialized = true;
     // ... rest of code
   }
   ```

3. LibSQL database lock
   Issue: Multiple processes accessing same DB
   Fix: Add connection pooling or single instance check

□ Apply fixes
□ Test: Server stays up for 5+ minutes
```

### 11:30 AM - 12:30 PM: Memory V2 Integration

```
Current State:
- memory-v2/ folder exists with 7 files
- Old semantic-memory.ts still being used
- Memory tools use old imports

Tasks:

1. Update src/mastra/tools/memory/index.ts
   □ Change imports:
   ```typescript
   // OLD:
   import { semanticSearch } from "@/lib/memory";
   
   // NEW:
   import { getMemoryManager } from "@/lib/memory-v2";
   ```

2. Update memory-recall tool execute function:
   ```typescript
   execute: async ({ query, threadId, topK }) => {
     const memory = getMemoryManager();
     const results = await memory.search(query, { 
       maxResults: topK || 5 
     });
     
     return {
       success: results.length > 0,
       messages: results.map(r => ({
         role: "assistant",
         content: r.snippet,
         source: r.entry.source,
         score: r.score,
       })),
       count: results.length,
       query,
       embeddingsEnabled: true,
     };
   }
   ```

3. Update memory-search tool:
   ```typescript
   execute: async ({ query, maxResults }) => {
     const memory = getMemoryManager();
     const results = await memory.search(query, { 
       maxResults: maxResults || 10 
     });
     
     return { 
       success: true, 
       results: results.map(r => ({
         file: r.entry.source,
         line: r.entry.lineStart,
         content: r.snippet,
         score: r.score,
       })),
       count: results.length 
     };
   }
   ```

4. Initialize memory on startup
   File: src/instrumentation.ts
   Add:
   ```typescript
   // Initialize memory manager
   const { getMemoryManager } = await import("./lib/memory-v2");
   const memory = getMemoryManager();
   await memory.indexAll();
   console.log("[karya] Memory indexed");
   ```

5. Create workspace folder with sample files
   □ Create F:\karya\workspace\MEMORY.md
   □ Create F:\karya\workspace\USER.md  
   □ Create F:\karya\workspace\memory\ folder

□ Test: memory-search tool returns actual results
```

### 12:30 PM - 1:00 PM: Lunch Break + Quick Test

```
□ Send a test message in chat
□ Verify AI responds
□ Try: "Search my memory for today's work"
□ Check if memory-search tool triggers
□ Document any issues found
```

---

## 🌞 AFTERNOON SESSION (2:00 PM - 6:00 PM)

### 2:00 PM - 3:00 PM: LLM Connection Verification

```
Current Config:
- Provider: custom (ollama-cloud)
- Model: qwen3-coder:480b
- Base URL: https://ollama.com/v1
- API Key: in .env (should be)

Tasks:

1. Check .env file exists
   □ F:\karya\.env should have:
   ```
   LLM_PROVIDER=custom
   LLM_MODEL=qwen3-coder:480b
   LLM_BASE_URL=https://ollama.com/v1
   LLM_API_KEY=your-key-here
   CUSTOM_PROVIDER_NAME=ollama-cloud
   ```

2. Test LLM directly
   □ Create test file: F:\karya\test-llm.ts
   ```typescript
   import { getModel } from "./src/lib/llm";
   import { generateText } from "ai";
   
   async function test() {
     const model = getModel();
     console.log("Testing LLM...");
     
     const result = await generateText({
       model,
       prompt: "Say hello in 5 words",
     });
     
     console.log("Response:", result.text);
   }
   
   test().catch(console.error);
   ```
   □ Run: npx tsx test-llm.ts
   □ Should get response

3. If fails, check error:
   - 401 = Invalid API key
   - 404 = Wrong endpoint
   - Timeout = Network issue
   - Model not found = Wrong model name

4. Fallback setup
   □ Install local Ollama (ollama.ai)
   □ Pull model: ollama pull qwen2:7b
   □ Update .env for local:
   ```
   LLM_PROVIDER=ollama
   LLM_MODEL=qwen2:7b
   LLM_BASE_URL=http://localhost:11434
   ```

□ Test: Chat response works
```

### 3:00 PM - 4:00 PM: Chat Flow Debug

```
If chat not responding, debug step by step:

1. Check API route
   File: src/app/api/chat/route.ts
   □ Add console.log at start:
   ```typescript
   export async function POST(req: Request) {
     console.log("[chat] Request received");
     // ... rest
   }
   ```

2. Check if supervisor agent initializes
   File: src/mastra/agents/supervisor.ts
   □ Add log:
   ```typescript
   console.log("[supervisor] Agent created with tools:", allTools.length);
   ```

3. Check browser network tab
   □ Open DevTools (F12)
   □ Go to Network tab
   □ Send message
   □ Look for /api/chat request
   □ Check response

4. Common issues:
   - CORS error → Check Next.js config
   - 500 error → Check server terminal for error
   - Streaming not working → Check SSE setup

5. Test streaming
   □ Add to api/chat/route.ts:
   ```typescript
   // After generating text
   console.log("[chat] Generated:", result.text.slice(0, 100));
   ```

□ Goal: Send "Hello" → Get AI response
```

### 4:00 PM - 5:00 PM: Tool Execution Test

```
Test each tool category:

1. System Tools
   □ Send: "What time is it?"
   □ Expect: system-datetime tool
   □ Send: "Show system info"
   □ Expect: system-info tool

2. File Tools
   □ Send: "List files in workspace"
   □ Expect: file-list tool
   □ Send: "Read MEMORY.md"
   □ Expect: file-read tool

3. Memory Tools
   □ Send: "Search memory for projects"
   □ Expect: memory-search tool
   □ Send: "Log that I tested tools today"
   □ Expect: memory-log tool

4. Code Tools
   □ Send: "Run this code: console.log(2+2)"
   □ Expect: code-execute tool

5. Web Tools
   □ Send: "Search web for Next.js 16"
   □ Expect: web-search tool

Document which tools work/fail in BUGS-DAY1.md

Common tool issues:
- Tool not in TOOL_NAME_MAP → Add it
- Tool returns error → Check execute function
- Tool not called → Check supervisor prompt
```

### 5:00 PM - 6:00 PM: Fix Critical Bugs

```
Based on testing, fix top 5 bugs:

Priority order:
1. Server crash (if still happening)
2. LLM not responding
3. Memory search not working
4. Tools not executing
5. UI not updating

For each bug:
□ Identify root cause
□ Write fix
□ Test fix
□ Commit: git commit -m "Fix: [bug description]"
```

---

## 🌙 EVENING SESSION (7:00 PM - 11:00 PM)

### 7:00 PM - 8:00 PM: Telegram Bot Setup

```
This is the "wow" demo — chat with Karya on Telegram!

1. Create Telegram Bot
   □ Open Telegram
   □ Search for @BotFather
   □ Send: /newbot
   □ Choose name: "Karya AI"
   □ Choose username: karya_ai_bot (must end in _bot)
   □ Copy the token (looks like: 123456:ABC-DEF...)

2. Add to .env
   □ Add line:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_ALLOWED_USERS=your_telegram_user_id
   ```
   
   To get your user ID:
   □ Search for @userinfobot on Telegram
   □ Send /start
   □ Copy your ID number

3. Install grammy
   □ Run: npm install grammy

4. Update instrumentation.ts
   □ Add after WebSocket init:
   ```typescript
   // Start Telegram gateway
   if (process.env.TELEGRAM_BOT_TOKEN) {
     const { initGateway } = await import("./bridges");
     const { supervisorAgent } = await import("./mastra/agents/supervisor");
     
     await initGateway(async (msg) => {
       const result = await supervisorAgent.generate(msg.text, {
         threadId: msg.userId,
       });
       return result.text;
     });
     console.log("[karya] Telegram gateway started");
   }
   ```

5. Test
   □ Restart server: npm run dev
   □ Open Telegram
   □ Find your bot
   □ Send: /start
   □ Send: "Hello Karya!"
   □ Should get AI response!

□ Take screenshot for demo!
```

### 8:00 PM - 9:00 PM: UI Quick Fixes

```
Make UI look good for demo:

1. Fix any console errors
   □ Open DevTools Console
   □ Note all red errors
   □ Fix each one

2. Dark mode check
   □ Toggle dark mode
   □ Check all pages look correct
   □ Fix any white/wrong colors

3. Sidebar sessions
   □ Create new session
   □ Switch between sessions
   □ Delete a session
   □ All should work

4. Tool cards
   □ Send message that triggers tool
   □ Verify tool card appears
   □ Verify it shows running/done state
   □ Verify result displays

5. Quick CSS fixes
   □ Check spacing issues
   □ Check text overflow
   □ Check button hover states
```

### 9:00 PM - 10:00 PM: End-to-End Demo Flow

```
Create a demo script that shows all features:

Demo Script:

1. "Hi Karya, who are you?"
   → Should introduce itself

2. "What's the current time and date?"
   → Should use system-datetime tool

3. "Search the web for latest AI news"
   → Should use web-search tool

4. "Save to memory: Day 1 testing complete"
   → Should use memory-log tool

5. "What did I save to memory today?"
   → Should use memory-search tool

6. "Create a simple Python script that prints hello"
   → Should use code-write tool

7. "Run the script"
   → Should use code-execute tool

8. Switch to Telegram
   → Send same messages
   → Verify responses work

9. Check Dashboard
   → Stats should show activity

10. Check Memory page
    → Should show today's log

□ Record demo video (optional)
□ Take screenshots
```

### 10:00 PM - 10:30 PM: Bug Fixes Round 2

```
Fix any issues found during demo:

□ List all issues
□ Prioritize by severity
□ Fix top 3-5 issues
□ Commit each fix separately
```

### 10:30 PM - 11:00 PM: Commit & Document

```
1. Final git status
   □ Run: git status
   □ Add all changes: git add -A
   □ Commit: git commit -m "Day 1: Core stability + Telegram integration"
   □ Push: git push

2. Update BUGS-DAY1.md
   □ List all bugs found
   □ Mark which are fixed
   □ Note remaining for Day 2

3. Create DAY1-SUMMARY.md
   □ What was accomplished
   □ What's working
   □ What's not working
   □ Screenshots/recordings
   □ Time spent per task

4. Plan Day 2 priorities
   □ Top 3 things to fix first
   □ Top 3 features to add
```

---

## FILES TO CREATE TODAY

```
F:\karya\
├── .env                    (API keys)
├── BUGS-DAY1.md           (Bug tracking)
├── DAY1-SUMMARY.md        (End of day summary)
├── test-llm.ts            (LLM test script)
└── workspace/
    ├── MEMORY.md          (Long-term memory)
    ├── USER.md            (User info)
    ├── TOOLS.md           (Tool notes)
    └── memory/
        └── 2026-03-28.md  (Today's log)
```

---

## CHECKPOINTS

### Checkpoint 1 (11:00 AM)
- [ ] All TypeScript errors fixed
- [ ] npm run dev starts without crash

### Checkpoint 2 (1:00 PM)
- [ ] Server stable for 5+ minutes
- [ ] Memory V2 integrated

### Checkpoint 3 (4:00 PM)
- [ ] Chat responds with AI
- [ ] At least 5 tools working

### Checkpoint 4 (6:00 PM)
- [ ] Critical bugs fixed
- [ ] Demo flow works

### Checkpoint 5 (9:00 PM)
- [ ] Telegram bot working
- [ ] UI looks polished

### Checkpoint 6 (11:00 PM)
- [ ] All code committed
- [ ] Documentation updated
- [ ] Day 2 planned

---

## EMERGENCY CONTACTS

If stuck on something:
1. Check error message carefully
2. Search error on Google/Stack Overflow
3. Ask Claude/ChatGPT for help
4. Check Next.js docs
5. Check Mastra docs

---

## TOOLS NEEDED

- VS Code
- Terminal/PowerShell
- Chrome (for testing)
- Telegram app (for bot testing)
- Docker Desktop (optional, for sandbox)

---

## SUCCESS CRITERIA

Day 1 is successful if:
✅ Server runs stable (no crash for 10 mins)
✅ Can chat with AI and get responses
✅ At least 10 tools work correctly
✅ Memory search returns results
✅ Telegram bot responds
✅ No critical bugs remaining

---

**Good luck! You got this! 💪🔥**
