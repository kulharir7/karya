---
name: YouTube
description: YouTube video operations - download, info, search
triggers: youtube, yt, video download, video info, yt-dlp, youtube-dl
---

# YouTube Skill

Work with YouTube videos using yt-dlp.

## Prerequisites
- yt-dlp must be installed: `winget install yt-dlp`
- ffmpeg for audio extraction: `winget install ffmpeg`

## Common Operations

### Get Video Info
```bash
yt-dlp --dump-json "URL" | jq '{title, duration, view_count, upload_date}'
```

### Download Video (Best Quality)
```bash
yt-dlp -f "best" -o "%(title)s.%(ext)s" "URL"
```

### Download Audio Only (MP3)
```bash
yt-dlp -x --audio-format mp3 -o "%(title)s.%(ext)s" "URL"
```

### Download with Subtitles
```bash
yt-dlp --write-subs --sub-lang en -o "%(title)s.%(ext)s" "URL"
```

### List Available Formats
```bash
yt-dlp -F "URL"
```

### Download Specific Format
```bash
yt-dlp -f 137+140 -o "%(title)s.%(ext)s" "URL"
```

### Download Playlist
```bash
yt-dlp -o "%(playlist)s/%(title)s.%(ext)s" "PLAYLIST_URL"
```

## Workflow

1. **Extract URL** from user's message
2. **Confirm download location** (default: workspace/downloads/)
3. **Get video info** first to show title/duration
4. **Download** using appropriate format
5. **Report** file location and size when done

## Output Location
Save downloads to: `workspace/downloads/`

## Error Handling
- If yt-dlp not found: Guide installation
- If video unavailable: Check if private/age-restricted
- If format not available: List available formats, let user choose
- If download fails: Try with `--force-overwrites` or different format
