---
name: Weather
description: Get weather information for any location
triggers: weather, mausam, temperature, rain, forecast, barish, garmi, sardi
---

# Weather Skill

Get current weather and forecasts for any location.

## API Options

### Option 1: wttr.in (No API key needed)
Best for quick weather checks. Works via curl.

```bash
# Current weather (short)
curl "wttr.in/Delhi?format=3"

# Detailed weather
curl "wttr.in/Delhi"

# JSON format for parsing
curl "wttr.in/Delhi?format=j1"
```

### Option 2: Open-Meteo API (No API key needed)
For more detailed data.

```bash
# Get coordinates first, then weather
curl "https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true"
```

## Workflow

1. **Extract location** from user's message
2. **Use wttr.in** for quick weather: `shell-execute` with curl
3. **Parse response** and present in a nice format
4. **For Hindi users**: Translate key terms (Rain=Barish, Hot=Garmi, Cold=Sardi)

## Response Format

Present weather like this:
```
🌤️ Delhi Weather
━━━━━━━━━━━━━━━━
🌡️ Temperature: 32°C (Feels like 35°C)
💨 Wind: 15 km/h NW
💧 Humidity: 45%
🌧️ Condition: Partly Cloudy

📅 Forecast:
- Tomorrow: 34°C, Sunny
- Day After: 31°C, Light Rain
```

## Common Locations (India)
- Delhi, Mumbai, Bangalore, Chennai, Kolkata
- Pune, Hyderabad, Ahmedabad, Jaipur

## Error Handling
- If location not found: Ask user to be more specific
- If API fails: Try alternative API
- If offline: Tell user to check internet
