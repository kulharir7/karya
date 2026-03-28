# Weather Skill

Get current weather and forecasts for any location.

## Usage

When user asks about weather, temperature, or forecast:

1. Use `wttr.in` API for quick weather:
```bash
curl "wttr.in/{location}?format=3"
```

2. For detailed forecast:
```bash
curl "wttr.in/{location}?format=v2"
```

## Examples

- "Weather in Delhi" → `curl wttr.in/Delhi?format=3`
- "Forecast Mumbai" → `curl wttr.in/Mumbai`

## Response Format

Reply with:
- Current temperature
- Condition (sunny/cloudy/rain)
- Humidity if available
