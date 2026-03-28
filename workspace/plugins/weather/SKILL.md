---
name: Weather
description: Weather information using wttr.in and Open-Meteo
triggers: weather, mausam, temperature, rain, forecast, humidity
---

# Weather Plugin

Get weather information using free APIs (no API key needed).

## Method 1: wttr.in (Quick, text-based)

Use `shell-execute` with curl:
```
curl -s "wttr.in/Delhi?format=3"          # One-line summary
curl -s "wttr.in/Delhi"                    # Detailed (ASCII art)
curl -s "wttr.in/Delhi?format=%C+%t+%h+%w" # Custom format
```

Format codes:
- %C = condition, %t = temperature, %h = humidity, %w = wind
- %l = location, %p = precipitation

## Method 2: Open-Meteo API (Structured JSON)

Use `api-call` tool:
```
URL: https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true
```

For city coordinates, use geocoding:
```
URL: https://geocoding-api.open-meteo.com/v1/search?name=Delhi&count=1
```

## Hindi Support
- "Delhi ka mausam" → Get Delhi weather
- "Kal barish hogi?" → Check tomorrow's forecast
- "Temperature kitna hai?" → Current temperature

## Always Include
- Current temperature (°C)
- Condition (sunny, cloudy, rain, etc.)
- Humidity
- Wind speed
- Forecast if asked
