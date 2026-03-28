---
name: Calculator
description: Advanced calculations — math, conversions, financial
triggers: calculate, math, convert, percentage, EMI, interest, GST, tax
---

# Calculator Plugin

Use `code-execute` tool with Python or JavaScript for calculations.

## Math Operations
- Basic: +, -, *, /, %, **
- Advanced: sqrt, sin, cos, tan, log, factorial
- Use Python `math` module for precision

## Financial Calculations

### EMI Calculator
```python
P = principal; R = annual_rate/12/100; N = months
EMI = P * R * (1+R)**N / ((1+R)**N - 1)
```

### GST Calculator
```python
base_price = amount / (1 + gst_rate/100)  # Extract from inclusive
gst_amount = base_price * gst_rate / 100
```

### Simple/Compound Interest
```python
SI = P * R * T / 100
CI = P * (1 + R/100)**T - P
```

## Unit Conversions
- Temperature: (°C × 9/5) + 32 = °F
- Distance: km × 0.621371 = miles
- Weight: kg × 2.20462 = pounds
- Currency: use web-search for live rates

## Hindi Support
- "50000 ka 18% GST kitna hoga?"
- "10 lakh ka EMI 8.5% pe 20 saal"
- "25 degree celsius to fahrenheit"
