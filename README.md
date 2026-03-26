# ⚡ Karya — AI Computer Agent

> **Bolo kya karna hai — Karya kar dega.**

Karya is an AI agent that **actually DOES things** on your computer — not just talks about them.

## What Karya Can Do

🌐 **Browser** — Navigate websites, click, fill forms, extract data, book tickets
📁 **Files** — Read, write, move, search, convert files
💻 **Shell** — Execute commands, run scripts, git operations
🖥️ **System** — Clipboard, screenshots, notifications, system info

## Tech Stack

- **Mastra** — AI agent orchestration framework (TypeScript)
- **Stagehand** — AI browser automation
- **Next.js 15** — Web UI + API
- **Ollama Cloud** — LLM provider (any OpenAI-compatible API)
- **Playwright** — Browser engine

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your LLM config

# Run development server
npm run dev

# Open http://localhost:3000
```

## Commands (Hindi + English)

```
"Google pe 'AI agents' search karo"
"Desktop pe kya files hain?"
"Is PDF se data nikaal ke Excel mein daalo"
"System info batao"
"Clipboard mein kya hai?"
"Ek file banao test.txt"
```

## Architecture

```
Karya
├── Mastra (Agent Orchestration)
│   ├── Planner Agent (task → steps)
│   ├── Browser Agent (Stagehand)
│   ├── File Agent (fs operations)
│   └── Shell Agent (commands)
├── Next.js (Frontend + API)
└── Any LLM (Ollama, OpenAI, etc.)
```

## License

MIT

---

Built with ❤️ by Ravi Kulhari
