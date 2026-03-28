---
name: searxng-mcp
description: |
  Use for web searches when SearXNG MCP server is available. Replaces external search APIs (Brave, Perplexity) with self-hosted SearXNG for free, privacy-respecting search. 
  Triggers when: (1) User asks to search the web, (2) Need to fetch information from URLs, (3) Web research is needed, (4) Replacing paid search APIs
---

# SearXNG MCP Server

Self-hosted search engine that replaces paid APIs (Brave, Perplexity).

## Prerequisites

1. **Docker installed and running**
2. **SearXNG container running** on port 8888
3. **MCP server configured** in nivbot

## Quick Start

### 1. Start SearXNG

```powershell
docker run --rm -d -p 8888:8080 --name searxng searxng/searxng:latest
```

Test: http://localhost:8888

### 2. Configure MCP (if not already done)

Add to MCP config:
```json
{
  "mcpServers": {
    "searxng": {
      "command": "npx",
      "args": ["-y", "mcp-searxng"],
      "env": {
        "SEARXNG_URL": "http://localhost:8888"
      }
    }
  }
}
```

## Usage

For now (MCP direct integration pending), use browser-based SearXNG:

1. Open browser to http://localhost:8888
2. Type query and search
3. Parse results from the page

**Future:** When MCP server connects properly, use `searxng_web_search` tool directly.

## Troubleshooting

- **Container not running**: `docker start searxng`
- **Port busy**: Check with `docker ps` or use different port
- **No results**: Verify SearXNG is accessible at http://localhost:8888

## Reference

- MCP Server: https://github.com/ihor-sokoliuk/mcp-searxng
- SearXNG Docs: https://docs.searxng.org
