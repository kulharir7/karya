---
name: GitHub
description: GitHub operations - repos, issues, PRs, commits
triggers: github, repo, repository, pull request, PR, issue, commit, clone, fork
---

# GitHub Skill

This skill helps you work with GitHub repositories using the GitHub CLI (`gh`).

## Prerequisites
- GitHub CLI must be installed: `winget install GitHub.cli`
- Must be authenticated: `gh auth login`

## Common Operations

### List Repositories
```bash
gh repo list [owner] --limit 10
```

### Clone Repository
```bash
gh repo clone owner/repo
```

### Create Issue
```bash
gh issue create --title "Title" --body "Description"
```

### List Issues
```bash
gh issue list --state open --limit 10
```

### Create Pull Request
```bash
gh pr create --title "Title" --body "Description" --base main
```

### List Pull Requests
```bash
gh pr list --state open
```

### View PR/Issue
```bash
gh pr view [number]
gh issue view [number]
```

### Merge PR
```bash
gh pr merge [number] --squash --delete-branch
```

## Workflow

1. **For repo operations**: Use `shell-execute` with `gh` commands
2. **For viewing**: Parse the output and present nicely to user
3. **For creating**: Confirm with user before executing write operations
4. **Always**: Check if `gh` is authenticated first with `gh auth status`

## Error Handling
- If `gh` not found: Tell user to install it
- If not authenticated: Guide them through `gh auth login`
- If repo not found: Check spelling, suggest alternatives
