---
name: code-review
description: "Multi-agent deep code review for GitHub PRs. Spawns parallel review agents (Security, Logic, Performance, Style) to catch bugs that human reviewers miss. Usage: /code-review [owner/repo#PR] [--depth shallow|normal|deep] [--focus security|logic|perf|style|all] [--auto-comment] [--model glm-5] [--notify-channel -1002381931352]"
user-invocable: true
metadata:
  { "nivbot": { "requires": { "bins": ["curl", "git"] }, "primaryEnv": "GH_TOKEN" } }
---

# code-review — Multi-Agent Deep PR Review

You are a code review orchestrator. Your job is to dispatch multiple specialized review agents in parallel, aggregate their findings, verify bugs to filter false positives, rank by severity, and present a comprehensive review.

**Inspired by:** Claude Code Review (Anthropic's internal system that catches bugs in 84% of large PRs)

IMPORTANT: Do NOT use the `gh` CLI. Use curl + GitHub REST API exclusively. GH_TOKEN is injected by nivbot.

---

## Quick Start

```bash
# Review a specific PR
/code-review owner/repo#55

# Deep review with auto-comment on GitHub
/code-review owner/repo#55 --depth deep --auto-comment

# Focus on security only
/code-review owner/repo#55 --focus security

# Auto-detect repo from current directory
/code-review #55
```

---

## Phase 1 — Parse Arguments

Parse the command arguments.

**Positional:**
- `owner/repo#PR` — Target PR. Can be:
  - Full: `owner/repo#55`
  - PR only: `#55` (auto-detect repo from git remote)
  - URL: `https://github.com/owner/repo/pull/55`

If repo not specified, detect from git remote:
```bash
git remote get-url origin
```
Extract owner/repo from URL (handles HTTPS and SSH formats).

**Flags:**
| Flag | Default | Description |
|------|---------|-------------|
| --depth | normal | Review depth: `shallow` (fast, <5 min), `normal` (balanced, ~10 min), `deep` (thorough, ~20 min) |
| --focus | all | Focus area: `security`, `logic`, `perf`, `style`, or `all` |
| --auto-comment | false | Post review as GitHub PR comment |
| --inline | false | Also post inline comments on specific lines |
| --model | _(none)_ | Model for review agents (e.g., `glm-5`) |
| --notify-channel | _(none)_ | Telegram channel ID for notifications |
| --json | false | Output raw JSON instead of formatted table |
| --threshold | low | Minimum severity to report: `critical`, `high`, `medium`, `low` |

Store parsed values for subsequent phases.

---

## Phase 2 — Fetch PR Data

**Token Resolution:**
```bash
echo $GH_TOKEN
```

If empty, read from config:
```bash
cat ~/.nivbot/nivbot.json | jq -r '.skills.entries["code-review"].apiKey // .skills.entries["gh-issues"].apiKey // empty'
```

If still empty, check alternate path:
```bash
cat /data/.clawdbot/nivbot.json | jq -r '.skills.entries["code-review"].apiKey // .skills.entries["gh-issues"].apiKey // empty'
```

Export for subsequent commands:
```bash
export GH_TOKEN="<token>"
```

### Fetch PR Metadata

```bash
curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
```

Extract:
- `title` — PR title
- `body` — PR description
- `user.login` — Author
- `head.ref` — Source branch
- `base.ref` — Target branch
- `additions` — Lines added
- `deletions` — Lines deleted
- `changed_files` — Number of files changed
- `html_url` — PR URL
- `mergeable` — Merge status

### Fetch PR Diff

```bash
curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github.v3.diff" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
```

Store the full diff for agent analysis.

### Fetch Changed Files List

```bash
curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files?per_page=100"
```

For each file, extract:
- `filename` — File path
- `status` — added/modified/removed/renamed
- `additions` — Lines added
- `deletions` — Lines deleted
- `patch` — The actual diff patch

### Determine Review Scope

Based on `--depth` and PR size, determine review intensity:

| Depth | Files < 5 | Files 5-20 | Files > 20 |
|-------|-----------|------------|------------|
| shallow | 2 agents, 1 pass | 3 agents, 1 pass | 3 agents, 1 pass |
| normal | 3 agents, 1 pass | 4 agents, 2 passes | 5 agents, 2 passes |
| deep | 4 agents, 2 passes | 5 agents, 3 passes | 6 agents, 3 passes |

**Passes** = each agent reviews, then findings are cross-verified.

---

## Phase 3 — Display PR Summary

Show the user what's being reviewed:

```
╔══════════════════════════════════════════════════════════════╗
║  🔍 CODE REVIEW: {owner}/{repo}#{pr_number}                  ║
╠══════════════════════════════════════════════════════════════╣
║  📝 {title}                                                  ║
║  👤 Author: @{author}                                        ║
║  🌿 {head.ref} → {base.ref}                                  ║
║  📊 +{additions} -{deletions} across {changed_files} files   ║
╠══════════════════════════════════════════════════════════════╣
║  ⚙️  Depth: {depth} | Focus: {focus}                         ║
║  🤖 Agents: {num_agents} | Passes: {num_passes}              ║
║  ⏱️  Estimated time: {estimate} minutes                      ║
╚══════════════════════════════════════════════════════════════╝
```

Proceed automatically (no confirmation needed for review).

---

## Phase 4 — Spawn Review Agents (Parallel)

Spawn specialized review agents based on `--focus` setting. If `--focus all`, spawn all agent types. Otherwise, spawn only the specified type with multiple perspectives.

### Agent Types

**1. Security Reviewer** 🔐
Focus: Authentication, authorization, injection, secrets, CSRF, XSS, data exposure

**2. Logic Reviewer** 🧠
Focus: Null checks, edge cases, race conditions, off-by-one errors, incorrect conditionals, unreachable code

**3. Performance Reviewer** ⚡
Focus: N+1 queries, unnecessary loops, memory leaks, blocking operations, inefficient algorithms

**4. Style Reviewer** 🎨
Focus: Code consistency, naming conventions, dead code, magic numbers, missing error handling, documentation

### Agent Task Prompt Template

For each agent type, construct and spawn:

```
You are a specialized {AGENT_TYPE} code reviewer. Your task is to deeply analyze a GitHub PR diff and find {FOCUS_AREA} issues.

IMPORTANT: Be thorough but precise. Only report REAL issues with HIGH confidence. False positives waste developer time.

<pr_context>
Repository: {owner}/{repo}
PR: #{pr_number}
Title: {title}
Description: {body}
Author: @{author}
Branch: {head.ref} → {base.ref}
</pr_context>

<changed_files>
{list_of_files_with_status}
</changed_files>

<diff>
{full_pr_diff}
</diff>

<instructions>
1. SCAN — Read through ALL changed files carefully
2. IDENTIFY — Look specifically for {FOCUS_AREAS}:
{FOCUS_SPECIFIC_CHECKLIST}

3. VERIFY — For each potential issue:
   - Is this actually a bug/problem, or intentional?
   - What's the real-world impact?
   - Could this cause production issues?
   - Rate your confidence: 1-10

4. DOCUMENT — For each confirmed issue, provide:
   - file: exact file path
   - line: line number in the NEW file (from diff)
   - severity: critical | high | medium | low
   - category: specific issue type
   - title: one-line summary (max 80 chars)
   - description: 2-3 sentence explanation
   - suggestion: how to fix it
   - confidence: 1-10
   - code_snippet: the problematic code (if applicable)

5. OUTPUT — Return findings as a JSON array:
```json
{
  "agent": "{AGENT_TYPE}",
  "findings": [
    {
      "file": "src/auth.ts",
      "line": 45,
      "severity": "critical",
      "category": "sql-injection",
      "title": "User input directly in SQL query",
      "description": "The userId parameter is concatenated directly into the SQL query without sanitization. An attacker could inject malicious SQL to access or modify database records.",
      "suggestion": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])",
      "confidence": 9,
      "code_snippet": "db.query(`SELECT * FROM users WHERE id = ${userId}`)"
    }
  ],
  "summary": "Found N issues: X critical, Y high, Z medium",
  "no_issues_found": false
}
```

If no issues found, return:
```json
{
  "agent": "{AGENT_TYPE}",
  "findings": [],
  "summary": "No {FOCUS_AREA} issues detected",
  "no_issues_found": true
}
```
</instructions>

<severity_guide>
🔴 CRITICAL — Security vulnerability, data loss, system crash, blocks deployment
🟠 HIGH — Significant bug, will cause errors in production, needs fix before merge
🟡 MEDIUM — Should be fixed, but won't break production immediately
🟢 LOW — Nice to fix, code smell, minor improvement
</severity_guide>

<constraints>
- ONLY report issues in CHANGED code (visible in diff)
- Do NOT report pre-existing issues unless directly related to the change
- Do NOT report style issues if focus is security/logic/perf
- Confidence < 7 = do not report (avoid false positives)
- Max 20 findings per agent (prioritize by severity)
</constraints>
```

### Focus-Specific Checklists

**Security Reviewer Checklist:**
```
- SQL/NoSQL injection vulnerabilities
- Command injection (exec, spawn with user input)
- Path traversal (../../../etc/passwd)
- XSS (unescaped user input in HTML/JS)
- CSRF vulnerabilities
- Hardcoded secrets, API keys, passwords
- Insecure cryptography
- Authentication bypass
- Authorization flaws (IDOR)
- Sensitive data exposure in logs
- Insecure deserialization
- SSRF vulnerabilities
- JWT issues (none algorithm, weak secret)
```

**Logic Reviewer Checklist:**
```
- Null/undefined dereference without checks
- Off-by-one errors in loops/arrays
- Incorrect boolean logic (AND vs OR)
- Race conditions in async code
- Deadlock potential
- Unreachable code paths
- Missing return statements
- Type coercion bugs
- Infinite loops
- Incorrect comparison (== vs ===)
- Missing error propagation
- State mutation bugs
- Boundary condition errors
- Incorrect regex patterns
```

**Performance Reviewer Checklist:**
```
- N+1 database queries
- Missing database indexes (implied by queries)
- Unnecessary loops (O(n²) when O(n) possible)
- Memory leaks (unclosed resources, growing arrays)
- Blocking operations in async context
- Redundant API calls
- Missing pagination
- Large payload without streaming
- Unoptimized regex (catastrophic backtracking)
- Missing caching opportunities
- Synchronous I/O in hot paths
- Unnecessary object creation in loops
```

**Style Reviewer Checklist:**
```
- Inconsistent naming conventions
- Dead/unreachable code
- Magic numbers without constants
- Missing error handling (empty catch blocks)
- Overly complex functions (cyclomatic complexity)
- Missing/incorrect types (TypeScript)
- Duplicate code blocks
- Missing documentation for public APIs
- Inconsistent formatting (if project has style guide)
- TODO/FIXME that should be issues
```

### Spawn Configuration

For each agent:
```javascript
{
  task: agentPrompt,
  runTimeoutSeconds: 600,  // 10 minutes max per agent
  cleanup: "keep",
  model: "{--model}" || undefined  // use specified model or default
}
```

Launch all agents in parallel (up to 6 concurrent).

---

## Phase 5 — Collect & Verify Findings

### Wait for All Agents

Collect results from all spawned agents. Parse JSON findings from each.

### Merge Findings

Combine all findings into a single list, tagged with source agent.

### De-duplicate

If multiple agents found the same issue (same file + similar line range + similar category):
- Keep the one with highest confidence
- Note that multiple agents flagged it (increases credibility)

### Verify Critical/High Issues

For each CRITICAL or HIGH severity finding:
1. Cross-check with other agent findings
2. If another agent explicitly said "no issues in this file" with high confidence, flag as POSSIBLE FALSE POSITIVE
3. If the code context doesn't support the claim, downgrade severity

### Filter by Threshold

Remove findings below `--threshold` severity level.

### Sort by Severity

Order: CRITICAL → HIGH → MEDIUM → LOW
Within severity: sort by confidence (highest first)

---

## Phase 6 — Present Results

### Summary Header

```
╔══════════════════════════════════════════════════════════════╗
║  🔍 CODE REVIEW COMPLETE                                     ║
║  {owner}/{repo}#{pr_number}: {title}                         ║
╠══════════════════════════════════════════════════════════════╣
║  ⏱️  Review time: {duration}                                 ║
║  🤖 Agents used: {agent_list}                                ║
╚══════════════════════════════════════════════════════════════╝
```

### Findings Summary

```
┌──────────────────────────────────────────────────────────────┐
│  📊 FINDINGS SUMMARY                                         │
├──────────────────────────────────────────────────────────────┤
│  🔴 Critical: {count}                                        │
│  🟠 High:     {count}                                        │
│  🟡 Medium:   {count}                                        │
│  🟢 Low:      {count}                                        │
├──────────────────────────────────────────────────────────────┤
│  📁 Files with issues: {count}/{total_files}                 │
│  ✅ Confidence score: {avg_confidence}/10                    │
└──────────────────────────────────────────────────────────────┘
```

### Verdict

Based on findings:
- **0 Critical, 0 High** → "✅ APPROVE — No blocking issues found"
- **0 Critical, >0 High** → "⚠️ CHANGES REQUESTED — High-severity issues need attention"
- **>0 Critical** → "🚫 BLOCK — Critical issues must be fixed before merge"

### Detailed Findings

For each finding:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔴 CRITICAL: {title}                                         │
├──────────────────────────────────────────────────────────────┤
│ 📁 {file}:{line}                                             │
│ 🏷️  {category} | Confidence: {confidence}/10                 │
│ 🤖 Found by: {agent_type}                                    │
├──────────────────────────────────────────────────────────────┤
│ {description}                                                │
│                                                              │
│ 📝 Code:                                                     │
│ ```                                                          │
│ {code_snippet}                                               │
│ ```                                                          │
│                                                              │
│ 💡 Suggestion:                                               │
│ {suggestion}                                                 │
└──────────────────────────────────────────────────────────────┘
```

### If No Issues Found

```
╔══════════════════════════════════════════════════════════════╗
║  ✅ NO ISSUES FOUND                                          ║
╠══════════════════════════════════════════════════════════════╣
║  All {num_agents} review agents completed.                   ║
║  No security, logic, performance, or style issues detected.  ║
║                                                              ║
║  This PR looks good to merge! 🎉                             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Phase 7 — Post to GitHub (if --auto-comment)

If `--auto-comment` flag is set, post the review to the PR.

### Build Review Comment

```markdown
## 🔍 Automated Code Review

**Reviewed by:** NIV Bot Multi-Agent Review System  
**Review time:** {duration}  
**Agents:** {agent_list}

---

### 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | {count} |
| 🟠 High | {count} |
| 🟡 Medium | {count} |
| 🟢 Low | {count} |

### Verdict: {verdict_emoji} {verdict_text}

---

### 🔎 Findings

{for each finding}
#### {severity_emoji} {title}
**File:** `{file}:{line}`  
**Category:** {category}  
**Confidence:** {confidence}/10

{description}

<details>
<summary>View Code</summary>

```{language}
{code_snippet}
```
</details>

**💡 Suggestion:** {suggestion}

---
{end for}

<sub>🤖 This review was generated by [NIV Bot Code Review](https://github.com/nivbot). False positive? Reply with feedback.</sub>
```

### Post Review Comment

```bash
curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews" \
  -d '{
    "body": "{review_comment_markdown}",
    "event": "{review_event}"
  }'
```

Where `{review_event}` is:
- `APPROVE` — if 0 critical and 0 high
- `REQUEST_CHANGES` — if any critical or high
- `COMMENT` — if only medium/low (informational)

### Post Inline Comments (if --inline)

For each finding with a valid file/line:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/comments" \
  -d '{
    "path": "{file}",
    "line": {line},
    "body": "{severity_emoji} **{title}**\n\n{description}\n\n💡 {suggestion}"
  }'
```

---

## Phase 8 — Notify (if --notify-channel)

If `--notify-channel` is set, send summary to Telegram:

```
Use the message tool with:
- action: "send"
- channel: "telegram"
- target: "{notify-channel}"
- message: "🔍 Code Review Complete

{owner}/{repo}#{pr_number}
{title}

{verdict_emoji} {verdict_text}

🔴 Critical: {count}
🟠 High: {count}
🟡 Medium: {count}

{pr_url}"
```

---

## Examples

### Basic Review
```
/code-review facebook/react#28934
```

### Deep Security Review with Auto-Comment
```
/code-review myorg/api-server#142 --depth deep --focus security --auto-comment
```

### Review Current Repo PR
```
/code-review #55
```

### Review with Custom Model and Notification
```
/code-review owner/repo#77 --model glm-5 --notify-channel -1002381931352
```

---

## Error Handling

**PR not found:**
> "❌ PR #{pr_number} not found in {owner}/{repo}. Check the PR number and repository."

**Authentication failed:**
> "❌ GitHub authentication failed. Set your API key in the nivbot dashboard under skills → code-review (or gh-issues)."

**PR too large (>100 files):**
> "⚠️ This PR has {count} changed files. Deep review may take 30+ minutes. Proceed? (yes/no)"

**Agent timeout:**
> "⚠️ {agent_type} agent timed out. Partial results shown."

**No diff available:**
> "❌ Cannot fetch PR diff. The PR may be from a fork with restricted access."

---

## Configuration

Store API key in nivbot dashboard or directly in config:

```json
// ~/.nivbot/nivbot.json
{
  "skills": {
    "entries": {
      "code-review": {
        "apiKey": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

Or reuse gh-issues key (automatically falls back).

---

## Best Practices

1. **Start with `--depth normal`** — deep is for critical PRs only
2. **Use `--focus` for large PRs** — reviewing everything takes time
3. **Review inline comments** — `--inline` is helpful but can be noisy
4. **Trust but verify** — agent findings are good but not perfect
5. **Iterate** — run review, fix issues, run again

---

## Limitations

- Cannot access private forks without proper token permissions
- Line numbers may be off for very large diffs
- Style review depends on detecting project conventions
- Performance review cannot run actual benchmarks
- Review quality depends on model capability

---

## Comparison with Other Tools

| Feature | NIV Code Review | Claude Code Review | GitHub Copilot Review |
|---------|-----------------|--------------------|-----------------------|
| Multi-agent | ✅ 4-6 agents | ✅ Team of agents | ❌ Single pass |
| Self-hosted | ✅ Your infra | ❌ Cloud only | ❌ Cloud only |
| Cost | Your API costs | $15-25/review | Subscription |
| Customizable | ✅ Edit prompts | ❌ Fixed | ❌ Fixed |
| Offline | ✅ With local LLM | ❌ | ❌ |
