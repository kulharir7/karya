# KARYA ROADMAP — From 0.1% to Production

## Current State: v0.1 (Basic)
- 1 main agent (planner) + 2 specialist agents
- 26 simple tools
- No MCP, No RAG, No multi-agent coordination
- Single-step thinking, no planning, no task decomposition
- No error recovery, no self-correction

---

## Phase 1: AGENT ARCHITECTURE (Week 1)

### 1.1 Task Planner Agent (Brain)
- Receives user task → decomposes into subtasks
- Creates execution plan with dependencies
- Assigns subtasks to specialist agents
- Monitors progress, handles failures, retries
- Maintains task state (pending, running, done, failed)

### 1.2 Specialist Agents (Workers)
- **Browser Agent** — web automation, scraping, form filling
- **File Agent** — file ops, PDF, images, archives, conversions
- **Code Agent** — write code, debug, refactor, execute scripts
- **Data Agent** — parse CSV/JSON/Excel, transform, analyze, visualize
- **Research Agent** — web search, summarize, compare, extract insights
- **System Agent** — OS control, processes, apps, clipboard, notifications
- **Communication Agent** — email drafts, message formatting, notifications

### 1.3 Agent Communication
- Agents talk to each other via message passing
- Planner delegates, workers report back
- Worker can request help from another worker
- Shared context/memory between agents

---

## Phase 2: ADVANCED TOOLS (Week 1-2)

### 2.1 Browser Tools (Enhanced)
- Multi-tab management
- Cookie/session persistence
- Form auto-fill with saved data
- CAPTCHA detection (alert user)
- Page monitoring (watch for changes)
- Screenshot comparison

### 2.2 Code Tools
- Write & execute TypeScript/JavaScript
- Write & execute Python scripts
- Code analysis & debugging
- Git operations (commit, push, pull, branch)
- Package management (npm, pip)

### 2.3 Data Tools
- CSV/Excel read & write (with formulas)
- JSON transform & query (jq-like)
- Data visualization (charts → images)
- Database queries (SQLite, Postgres)
- API calling (any REST/GraphQL endpoint)

### 2.4 Communication Tools
- Email draft generation
- Calendar event creation
- Slack/Discord message formatting
- PDF report generation
- HTML report generation

---

## Phase 3: MCP (Model Context Protocol) (Week 2)

### 3.1 MCP Client
- Connect to any MCP server
- Auto-discover available tools
- Execute remote tools via MCP
- Handle auth (API keys, OAuth)

### 3.2 MCP Server
- Expose Karya's tools as MCP server
- Other agents/apps can use Karya's tools
- Standard MCP protocol compliance

### 3.3 MCP Registry
- Browse available MCP servers
- One-click install MCP servers
- Popular servers: GitHub, Slack, Google, Stripe

---

## Phase 4: RAG (Knowledge Base) (Week 2-3)

### 4.1 Document Ingestion
- Upload PDFs, docs, text files
- Web page ingestion (URL → knowledge)
- Auto-chunking (recursive, token-aware)
- Embedding generation

### 4.2 Vector Store
- LibSQL vector store (local)
- Semantic search across documents
- Hybrid search (vector + keyword)
- Metadata filtering

### 4.3 Knowledge-Augmented Responses
- Agent searches knowledge base before answering
- Cites sources in responses
- Learns from uploaded documents
- Domain-specific expertise

---

## Phase 5: WORKFLOWS (Week 3)

### 5.1 Workflow Engine
- Visual workflow builder
- Branching, chaining, merging, conditions
- Parallel execution
- Suspend/resume (human-in-the-loop)
- Error handling & retry

### 5.2 Pre-built Workflows
- Web scraping pipeline
- Data ETL (extract, transform, load)
- Report generation
- Email automation
- File batch processing
- Price monitoring

### 5.3 Scheduled Tasks
- Cron-like scheduling
- "Every morning, check emails and summarize"
- "Monitor this URL every hour"
- "Generate weekly report every Friday"

---

## Phase 6: MULTI-AGENT ORCHESTRATION (Week 3-4)

### 6.1 Agent Supervisor
- Routes tasks to best agent
- Manages agent lifecycle
- Load balancing between agents
- Priority queue for tasks

### 6.2 Agent-to-Agent Communication
- Agents can delegate subtasks
- Shared memory/context
- Result aggregation
- Conflict resolution

### 6.3 Agent Chains
- Sequential agent pipelines
- Research → Analyze → Write → Review
- Scrape → Clean → Store → Report

---

## Phase 7: EVALS & RELIABILITY (Week 4)

### 7.1 Tool Usage Evals
- Is agent calling right tools?
- Are tool results accurate?
- Success rate per tool

### 7.2 Response Quality
- Accuracy scoring
- Hallucination detection
- Source verification

### 7.3 Self-Correction
- Agent detects own errors
- Automatic retry with different approach
- Escalation to user when stuck

---

## Architecture Target

```
User Command
    │
    ▼
┌─────────────┐
│  SUPERVISOR  │ ← Routes, monitors, retries
└──────┬──────┘
       │
  ┌────┼────┬────────┬──────────┐
  ▼    ▼    ▼        ▼          ▼
┌────┐┌────┐┌──────┐┌────────┐┌────────┐
│Web ││File││Code  ││Research││System  │
│Agent││Agent││Agent ││Agent   ││Agent   │
└──┬─┘└──┬─┘└──┬───┘└───┬────┘└───┬────┘
   │     │     │        │         │
   ▼     ▼     ▼        ▼         ▼
┌─────────────────────────────────────┐
│           TOOL LAYER                │
│  Browser │ Files │ Shell │ APIs    │
│  MCP     │ RAG   │ Code  │ Data   │
└─────────────────────────────────────┘
```
