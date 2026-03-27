# ⚡ Karya — AI Computer Agent

**Karya** is an AI agent that actually **DOES things** on your computer. Not just chat — real actions.

```bash
npm install -g karya-ai
karya chat "what's my system info?"
```

## Features

- 🛠️ **73 Tools** — File, browser, shell, code, data, memory, git, etc.
- 🔄 **9 Workflows** — Automated multi-step pipelines
- 🤖 **6 Agents** — Specialized agents for different tasks
- 🧠 **Semantic Memory** — Remembers context across sessions
- ⏰ **Task Scheduler** — Cron, interval, one-shot tasks
- 🔔 **Triggers** — File watcher, clipboard, webhooks
- 🔌 **MCP Support** — External tool servers
- 🌐 **Web UI + CLI + API** — Multiple interfaces

## Quick Start

### 1. Install

```bash
npm install -g karya-ai
```

### 2. Run Server

```bash
cd your-project
karya serve
```

### 3. Chat

```bash
# One-shot command
karya chat "list files on my desktop"

# Interactive
karya run "organize my downloads folder"
```

## CLI Commands

```bash
karya chat <message>     # One-shot chat
karya run <task>         # Run task and exit
karya serve              # Start server
karya status             # Check server status
karya tools              # List all 73 tools
karya sessions           # List sessions
karya mcp list           # List MCP servers
karya help               # Show help
```

## Tools by Category

| Category | Count | Examples |
|----------|-------|----------|
| File | 12 | read, write, search, zip, resize |
| Browser | 6 | navigate, act, extract, screenshot |
| Shell | 2 | execute, kill process |
| Code | 4 | analyze, write, execute |
| System | 6 | info, datetime, notify, screenshot |
| Memory | 5 | read, write, search, log |
| Git | 5 | status, commit, push, log, diff |
| Data | 4 | JSON query, CSV parse, transform |
| Clipboard | 2 | read, write |
| Skills | 4 | list, match, load, create |
| Workflow | 7 | run, list, resume, cancel |
| Delegation | 5 | browser, coder, researcher, planner |

## Workflows

| Name | Pattern | Description |
|------|---------|-------------|
| web-scraper | `.then()` | Scrape multiple URLs |
| file-organizer | `.then()` | Organize files by type |
| data-processor | `.branch()` | Process data conditionally |
| research-pipeline | `.then()` | Multi-source research |
| backup | `.then()` | Backup files to archive |
| multi-source-research | `.parallel()` | Parallel web research |
| file-cleanup | `suspend/resume` | Human-approved deletion |
| batch-image-processor | `.foreach()` | Batch resize images |
| url-monitor | `.dountil()` | Monitor URL for changes |

## API

```bash
# Chat (streaming)
POST /api/chat
{"message": "your message", "sessionId": "optional"}

# Tools
GET /api/tools

# Sessions
GET /api/sessions
DELETE /api/sessions/:id

# Workflows
POST /api/workflows/run
GET /api/workflows/:id

# Tasks
GET /api/tasks
POST /api/tasks/schedule

# Triggers
GET /api/triggers
POST /api/triggers
```

## Environment Variables

```bash
# Required: At least one LLM provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Optional
KARYA_MODEL=gpt-4o          # Default model
KARYA_PORT=3000             # Server port
KARYA_WORKSPACE=./workspace # Memory directory
```

## Tech Stack

- **Runtime**: Node.js + Next.js 16
- **AI**: Mastra + Vercel AI SDK
- **Browser**: Stagehand v3 (Playwright)
- **Database**: LibSQL (SQLite)
- **Memory**: FastEmbed local embeddings

## License

MIT © Ravi Kulhari

---

**GitHub**: [github.com/kulharir7/karya](https://github.com/kulharir7/karya)
