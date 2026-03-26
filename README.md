# ⚡ Karya — AI Computer Agent

> **Bolo kya karna hai — Karya kar dega.**

Karya is an AI agent that **actually DOES things** on your computer — not just talks about them.

![Karya Screenshot](https://img.shields.io/badge/Status-Active-brightgreen) ![Tools](https://img.shields.io/badge/Tools-26-purple) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- 🌐 **Browser Automation** — Navigate, click, fill forms, extract data, web search
- 📁 **File Management** — Read, write, move, search, PDF extract, image resize, zip/unzip
- 💻 **Shell Commands** — Execute PowerShell commands, scripts, git operations
- 🖥️ **System Control** — Info, clipboard, processes, open/kill apps, notifications
- 🔍 **Command Palette** — `Ctrl+K` for quick actions
- 💬 **Multi-Session** — Multiple chat sessions with history
- 📎 **File Upload** — Drag & drop files for agent to process
- ⚙️ **Settings** — Switch models, configure API from UI
- 📱 **PWA** — Install as desktop app

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | [Mastra](https://mastra.ai) |
| Browser Automation | [Stagehand](https://stagehand.dev) v3 |
| Frontend | Next.js 16 + React + Tailwind |
| LLM | Ollama Cloud (any OpenAI-compatible) |
| Memory | LibSQL (persistent) |
| Streaming | Server-Sent Events |

## Quick Start

```bash
git clone https://github.com/kulharir7/karya.git
cd karya
npm install
cp .env.example .env   # Edit with your API key
npm run dev             # http://localhost:3000
```

Or on Windows: double-click `START.bat`

## 26 Tools

| Category | Tools |
|----------|-------|
| 🌐 Browser (6) | navigate, act, extract, screenshot, web-search, browser-agent |
| 📁 Files (9) | read, write, list, move, search, read-pdf, resize-image, zip, unzip, batch-rename, size-info |
| 💻 Shell (1) | execute command |
| 🖥️ System (10) | info, datetime, processes, open-app, kill-process, clipboard-read, clipboard-write, notify |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main chat interface |
| `/settings` | Model selection, API config |
| `/help` | All tools, shortcuts, examples |

## Docker

```bash
docker build -t karya .
docker run -p 3000:3000 --env-file .env karya
```

## License

MIT — Built by Ravi Kulhari
