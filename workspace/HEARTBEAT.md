# Karya Heartbeat — Proactive Agent Tasks

Karya runs these tasks automatically on schedule.
Edit this file to add/change/remove tasks.

Changes are detected automatically — no restart needed!

---

## System Health Check
- schedule: every 2 hours
- prompt: Check system health: CPU, memory, disk usage. Alert if anything is above 90%.
- enabled: false

## Daily Briefing
- schedule: at 09:00
- prompt: Good morning! Give me a brief summary of today's date, any scheduled tasks, and recent activity.
- enabled: false

## Git Status Check
- schedule: every 4 hours
- prompt: Check git status for projects in F:\ drive. Report any uncommitted changes or unsynced branches.
- enabled: false

## Downloads Cleanup Reminder
- schedule: daily
- prompt: Check my Downloads folder. If there are more than 20 files, suggest which ones to organize or delete.
- enabled: false

## Memory Review
- schedule: weekly
- prompt: Review the daily memory logs from the past week. Summarize key events and update MEMORY.md with important learnings.
- enabled: false

---

**To activate a task:** Change `enabled: false` to `enabled: true`

**Schedule formats:**
- `every 30 minutes` — run every 30 minutes
- `every 2 hours` — run every 2 hours
- `at 09:00` — run daily at 9:00 AM
- `at 17:30` — run daily at 5:30 PM
- `hourly` — run once per hour
- `daily` — run once per day
- `weekly` — run once per week
