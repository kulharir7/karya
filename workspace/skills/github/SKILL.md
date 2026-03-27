---
name: GitHub
description: GitHub operations - repos, issues, PRs, commits
triggers: github, repo, repository, pull request, PR, issue, commit, clone, push, git
---

# GitHub Skill

Manage GitHub repositories, issues, and pull requests.

## Prerequisites
- Git CLI installed
- GitHub CLI (`gh`) recommended but optional

## Common Operations

### Check Repository Status
```bash
git status
git log --oneline -10
```

### Clone a Repository
```bash
git clone https://github.com/<owner>/<repo>.git
# or with gh
gh repo clone <owner>/<repo>
```

### Create Issue (gh CLI)
```bash
gh issue create --title "Bug: XYZ" --body "Description here"
```

### Create PR (gh CLI)
```bash
gh pr create --title "Feature: ABC" --body "Changes made"
```

### List Issues
```bash
gh issue list
```

### View Issue
```bash
gh issue view <number>
```

## Without gh CLI

Use api-call tool:
```
api-call({
  method: "GET",
  url: "https://api.github.com/repos/<owner>/<repo>/issues",
  headers: { "Authorization": "token <GITHUB_TOKEN>" }
})
```

## Workflow

1. Check if `gh` is available: `shell-execute("gh --version")`
2. If yes: use `gh` commands
3. If no: use `git` for local ops, `api-call` for GitHub API
4. Always confirm before push/PR operations

## Error Handling
- Auth failed: Ask user to run `gh auth login`
- Repo not found: Verify URL is correct
- Permission denied: Check if user has write access
