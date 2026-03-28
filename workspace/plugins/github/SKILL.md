---
name: GitHub
description: GitHub operations — repos, issues, PRs, commits, actions
triggers: github, repo, repository, issue, pull request, PR, commit
---

# GitHub Plugin

You can interact with GitHub using the `shell-execute` tool with `gh` CLI.

## Available Commands

### Repository Operations
- `gh repo list` — List user's repos
- `gh repo view <owner/repo>` — View repo details
- `gh repo clone <owner/repo>` — Clone a repo
- `gh repo create <name> --public` — Create new repo

### Issue Operations
- `gh issue list -R <owner/repo>` — List issues
- `gh issue view <number> -R <owner/repo>` — View issue
- `gh issue create -R <owner/repo> -t "Title" -b "Body"` — Create issue
- `gh issue close <number> -R <owner/repo>` — Close issue

### Pull Request Operations
- `gh pr list -R <owner/repo>` — List PRs
- `gh pr view <number> -R <owner/repo>` — View PR
- `gh pr create -t "Title" -b "Body"` — Create PR
- `gh pr merge <number>` — Merge PR

### Workflow / Actions
- `gh run list -R <owner/repo>` — List workflow runs
- `gh run view <runId> -R <owner/repo>` — View run details

## Notes
- Always use `gh` CLI (GitHub's official tool)
- Check if `gh` is installed first: `gh --version`
- For private repos, user needs `GITHUB_TOKEN` set
