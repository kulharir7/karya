# KARYA — 100 Points Roadmap 🚀

**Goal:** Production-ready AI Computer Agent
**Timeline:** 1 week intensive development
**Current Score:** ~95/100 (architecture done, needs polish + integration)

---

## DAY 1: Core Stability (15 points)

### Morning (9 AM - 1 PM)

#### 1. Fix Server Crash Issue (3 points)
```
Problem: Next.js server crashing after ~60 seconds
Tasks:
- Debug instrumentation.ts (WebSocket server issue?)
- Check for memory leaks in event-bus
- Add proper error boundaries in server code
- Test: Server runs stable for 10+ minutes
```

#### 2. Memory V2 Integration (5 points)
```
Problem: memory-v2/ exists but not connected to agent
Tasks:
- Replace old semantic-memory.ts imports with memory-v2
- Update supervisor.ts to use MemoryManager
- Update memory tools to use new hybrid search
- Add embedder initialization (OpenAI or local)
- Test: memory-search returns real results
```

#### 3. Fix Import Errors (2 points)
```
Problem: Some new files have import issues
Tasks:
- Run `npx tsc --noEmit` to find all errors
- Fix circular dependencies
- Fix missing exports
- Test: `npm run build` succeeds
```

### Afternoon (2 PM - 6 PM)

#### 4. LLM Connection Test (3 points)
```
Problem: Agent may not be responding
Tasks:
- Verify .env has correct API keys
- Test ollama-cloud connection
- Add fallback to local Ollama
- Add connection health check on startup
- Test: Chat gets AI response within 5 seconds
```

#### 5. WebSocket Stability (2 points)
```
Problem: WebSocket may disconnect
Tasks:
- Add reconnection logic in frontend
- Add heartbeat ping/pong
- Test: WebSocket stays connected during chat
```

---

## DAY 2: UI Polish (20 points)

### Morning (9 AM - 1 PM)

#### 6. Fix Dark Mode Completely (3 points)
```
Tasks:
- Audit ALL components for hardcoded colors
- Replace with CSS variables
- Test toggle in all pages
- Fix any remaining #hex colors
```

#### 7. Mobile Responsive (5 points)
```
Tasks:
- Add hamburger menu for sidebar
- Make chat input sticky at bottom
- Test on phone (or Chrome DevTools mobile)
- Fix overflow issues
```

#### 8. Loading States Polish (2 points)
```
Tasks:
- Add skeleton loaders to all API calls
- Add loading spinners to buttons
- Test: No blank screens during load
```

### Afternoon (2 PM - 6 PM)

#### 9. Chat UX Improvements (5 points)
```
Tasks:
- Auto-scroll to new messages
- Add "Stop Generation" button
- Add message copy button
- Add retry failed message button
- Improve ToolCard animations
```

#### 10. Dashboard Stats Real Data (3 points)
```
Tasks:
- Connect to actual session/message counts
- Add real tool usage stats
- Add memory usage stats
- Real-time updates via WebSocket
```

#### 11. Workflows Page UX (2 points)
```
Tasks:
- Replace JSON input with proper forms
- Show workflow progress bar
- Add cancel button for running workflows
```

---

## DAY 3: Agent Intelligence (20 points)

### Morning (9 AM - 1 PM)

#### 12. Self-Improving Integration (5 points)
```
Tasks:
- Connect self-improving.ts to chat flow
- Auto-review after complex tasks
- Save lessons automatically
- Load lessons before similar tasks
- Test: lessons.md gets populated
```

#### 13. Heartbeat Activation (3 points)
```
Tasks:
- Create default HEARTBEAT.md with sample tasks
- Start HeartbeatManager in instrumentation.ts
- Connect heartbeat events to agent
- Test: Scheduled prompt triggers agent
```

#### 14. Context Compaction Test (4 points)
```
Tasks:
- Simulate long conversation (30+ messages)
- Verify memory flush triggers
- Verify compaction works
- Check daily log gets facts saved
```

### Afternoon (2 PM - 6 PM)

#### 15. Agent Routing Improvement (3 points)
```
Tasks:
- Test all 6 specialist agents
- Verify supervisor delegates correctly
- Add agent handoff logging
- Test complex multi-agent task
```

#### 16. Tool Permissions UI (3 points)
```
Tasks:
- Add confirmation dialog for dangerous tools
- Show risk badges prominently
- Add "always allow" option per tool
- Test: rm command asks for confirmation
```

#### 17. Browser Agent Test (2 points)
```
Tasks:
- Test Stagehand initialization
- Test web-scraper workflow
- Verify screenshot capture works
- Fix any Playwright issues
```

---

## DAY 4: Integrations (15 points)

### Morning (9 AM - 1 PM)

#### 18. Telegram Bot Live (5 points)
```
Tasks:
- Create Telegram bot via BotFather
- Add TELEGRAM_BOT_TOKEN to .env
- Install grammy: npm install grammy
- Start gateway in instrumentation.ts
- Test: Chat with bot on Telegram
```

#### 19. Skill System Test (3 points)
```
Tasks:
- Create 3 sample skills in workspace/skills/
- Test skill-list, skill-load tools
- Verify agent uses skill instructions
- Document skill creation process
```

#### 20. Git Integration Test (2 points)
```
Tasks:
- Test git-status, git-commit, git-push
- Verify agent can commit its own changes
- Add git credentials helper
```

### Afternoon (2 PM - 6 PM)

#### 21. Docker Sandbox Test (3 points)
```
Tasks:
- Install Docker Desktop
- Build karya-sandbox image
- Test code-execute in sandbox
- Verify network isolation works
```

#### 22. MCP Tools Refresh (2 points)
```
Tasks:
- Verify MCP client connects
- List available MCP tools
- Test calling an MCP tool
- Fix any connection issues
```

---

## DAY 5: Testing & Bugs (15 points)

### Morning (9 AM - 1 PM)

#### 23. End-to-End Test Suite (5 points)
```
Tasks:
- Write 10 E2E tests for critical flows:
  1. Send message, get response
  2. Tool execution shows card
  3. Session create/switch/delete
  4. Memory search returns results
  5. Workflow run and status check
  6. Dark mode toggle
  7. File upload handling
  8. Error display
  9. Settings save
  10. Dashboard loads stats
```

#### 24. Fix All Console Errors (3 points)
```
Tasks:
- Open browser DevTools
- Note all console errors/warnings
- Fix each one
- Test: Clean console on page load
```

#### 25. Performance Audit (2 points)
```
Tasks:
- Run Lighthouse audit
- Fix performance issues
- Optimize bundle size
- Target: Score 80+ on Performance
```

### Afternoon (2 PM - 6 PM)

#### 26. Error Handling Audit (3 points)
```
Tasks:
- Test all error scenarios
- Verify error boundaries catch errors
- Add user-friendly error messages
- Test: No white screens on error
```

#### 27. Memory Leak Check (2 points)
```
Tasks:
- Run app for 30 minutes
- Monitor memory usage
- Fix any leaks found
- Test: Stable memory over time
```

---

## DAY 6: Documentation (10 points)

### Morning (9 AM - 1 PM)

#### 28. README Overhaul (3 points)
```
Tasks:
- Add proper installation guide
- Add screenshots/GIFs
- Add feature list with emojis
- Add architecture diagram
- Add FAQ section
```

#### 29. API Documentation (2 points)
```
Tasks:
- Document all API routes
- Add request/response examples
- Use JSDoc comments
- Generate API docs page
```

#### 30. User Guide (3 points)
```
Tasks:
- Write getting started guide
- Document all 73 tools
- Document 9 workflows
- Add tips and tricks
```

### Afternoon (2 PM - 6 PM)

#### 31. Developer Guide (2 points)
```
Tasks:
- Document project structure
- Explain how to add new tools
- Explain how to add new workflows
- Contribution guidelines
```

---

## DAY 7: Launch Prep (5 points)

### Morning (9 AM - 1 PM)

#### 32. Production Build Test (2 points)
```
Tasks:
- npm run build (no errors)
- npm start (production mode)
- Test all features work
- Check bundle size
```

#### 33. Environment Setup (1 point)
```
Tasks:
- Create .env.example with all vars
- Document each variable
- Add validation on startup
```

### Afternoon (2 PM - 6 PM)

#### 34. Final Testing (1 point)
```
Tasks:
- Fresh clone and install
- Follow README exactly
- Note any issues
- Fix and update docs
```

#### 35. GitHub Release (1 point)
```
Tasks:
- Create v1.0.0 tag
- Write release notes
- Update package.json version
- Push and celebrate! 🎉
```

---

## SCORING BREAKDOWN

| Day | Focus | Points |
|-----|-------|--------|
| Day 1 | Core Stability | 15 |
| Day 2 | UI Polish | 20 |
| Day 3 | Agent Intelligence | 20 |
| Day 4 | Integrations | 15 |
| Day 5 | Testing & Bugs | 15 |
| Day 6 | Documentation | 10 |
| Day 7 | Launch Prep | 5 |
| **Total** | | **100** |

---

## PRIORITY ORDER (If Short on Time)

### Must Have (60 points)
1. Server stability (3)
2. Memory V2 integration (5)
3. LLM connection (3)
4. Dark mode fix (3)
5. Chat UX (5)
6. Self-improving (5)
7. Telegram bot (5)
8. E2E tests (5)
9. README (3)
10. Production build (2)
+ Bug fixes throughout (21)

### Nice to Have (40 points)
- Mobile responsive
- Dashboard real data
- Docker sandbox
- Full documentation
- Performance optimization

---

## QUICK WINS (Do First)

1. **Fix imports** — `npx tsc --noEmit` and fix errors
2. **Test LLM** — Verify AI responds in chat
3. **Memory search** — Verify hybrid search works
4. **Telegram** — Quick win, impressive demo

---

## BLOCKERS TO RESOLVE

1. **API Keys** — Need valid LLM API key
2. **Docker** — Optional but needed for sandbox
3. **Telegram** — Need to create bot first
4. **Stagehand** — May need OpenAI key for browser

---

## SUCCESS METRICS

✅ Server runs 24 hours without crash
✅ Chat responds in <5 seconds
✅ Memory search returns relevant results
✅ All 73 tools work
✅ 9 workflows execute successfully
✅ Telegram bot responds
✅ Clean console (no errors)
✅ README is clear and complete
✅ Fresh install works first try

---

**Last Updated:** 2026-03-28 02:05 AM
**Author:** Karya + Human Collaboration 🤝
