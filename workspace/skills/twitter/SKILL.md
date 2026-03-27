---
name: Twitter/X
description: Twitter/X operations - search tweets, profiles
triggers: twitter, x, tweet, tweets, x.com, elon
---

# Twitter/X Skill

Search and view Twitter/X content.

## ⚠️ Important Notes
- Twitter API is now paid (X API)
- Use browser automation for most tasks
- Rate limits are strict

## Search Tweets

### Via Browser
```
browser-navigate("https://x.com/search?q=<query>&src=typed_query")
browser-extract("Get tweets from search results")
```

### Via Nitter (if available)
Nitter is a privacy-friendly Twitter frontend.
```
web-fetch("https://nitter.net/search?q=<query>")
```

## View Profile

```
browser-navigate("https://x.com/<username>")
browser-extract("Get bio, follower count, recent tweets")
```

## View Specific Tweet

```
browser-navigate("https://x.com/<username>/status/<tweet_id>")
browser-extract("Get tweet content, likes, retweets")
```

## Search via Web

For basic search, use web-search:
```
web-search("site:twitter.com OR site:x.com <query>")
```

## Workflow

1. For search: use browser with x.com/search
2. For profile: navigate to x.com/username
3. For tweet: navigate to full tweet URL
4. Extract data using browser-extract

## Error Handling
- Login required: Some content needs auth
- Rate limited: Wait and retry
- Account suspended: Content unavailable
- Profile private: Can only see public info

## No Posting
This skill is READ-ONLY. Do not attempt to:
- Post tweets
- Like/retweet
- Follow/unfollow

These require authenticated API access.
