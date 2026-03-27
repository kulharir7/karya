---
name: YouTube
description: YouTube video operations - search, transcript, download info
triggers: youtube, video, yt, transcript, subtitles, watch
---

# YouTube Skill

Search YouTube videos, get transcripts, and video information.

## Search Videos

Use web-search or browser:
```
web-search("site:youtube.com <query>")
```

Or use YouTube Data API (requires key):
```
api-call({
  url: "https://www.googleapis.com/youtube/v3/search?part=snippet&q=<query>&key=<API_KEY>"
})
```

## Get Video Info

Extract video ID from URL:
- youtube.com/watch?v=VIDEO_ID
- youtu.be/VIDEO_ID

Use noembed for basic info (no API key):
```
api-call({
  url: "https://noembed.com/embed?url=https://youtube.com/watch?v=<VIDEO_ID>"
})
```

## Get Transcript/Subtitles

Option 1: Use yt-dlp (if installed)
```bash
yt-dlp --write-auto-sub --skip-download --sub-lang en "https://youtube.com/watch?v=<VIDEO_ID>"
```

Option 2: Use browser-agent to extract from page
```
browser-agent("go to youtube video <URL>, click CC button, copy transcript")
```

## Download (Info Only)

Get downloadable formats (yt-dlp):
```bash
yt-dlp -F "https://youtube.com/watch?v=<VIDEO_ID>"
```

**Note**: Actual downloading may violate ToS. Provide info only.

## Workflow

1. Parse video URL to extract VIDEO_ID
2. For info: use noembed API
3. For transcript: check if yt-dlp available, else use browser
4. For search: use web-search with site:youtube.com

## Error Handling
- Video unavailable: Check if video is public/exists
- Transcript not available: Video may not have captions
- Age restricted: May need authenticated browser session
