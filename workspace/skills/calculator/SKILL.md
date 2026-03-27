---
name: Calculator
description: Math calculations, unit conversions, formulas
triggers: calculate, calc, math, ginti, plus, minus, multiply, divide, convert, percentage, kitna, hisab
---

# Calculator Skill

Perform mathematical calculations and conversions.

## Simple Calculations

Use code-execute for instant results:
```javascript
// Basic math
return 25 * 4 + 10; // 110

// Percentage
const total = 5000;
const percent = 18;
return total * (percent / 100); // 900 (18% of 5000)

// Compound interest
const principal = 10000;
const rate = 0.07;
const years = 5;
return principal * Math.pow(1 + rate, years); // 14025.52
```

## Unit Conversions

### Temperature
```javascript
const celsius = 32;
const fahrenheit = (celsius * 9/5) + 32; // 89.6°F

const fahr = 100;
const celsi = (fahr - 32) * 5/9; // 37.78°C
```

### Distance
```javascript
const km = 10;
const miles = km * 0.621371; // 6.21 miles

const miles = 5;
const km = miles * 1.60934; // 8.05 km
```

### Weight
```javascript
const kg = 70;
const lbs = kg * 2.20462; // 154.32 lbs

const lbs = 150;
const kg = lbs * 0.453592; // 68.04 kg
```

### Currency (approximate)
```javascript
// INR to USD (rate changes, use approximate)
const inr = 1000;
const usd = inr / 83; // ~$12.05 (as of 2024)
```

## Financial Calculations

### EMI Calculator
```javascript
const principal = 1000000; // 10 lakh
const annualRate = 8.5 / 100;
const monthlyRate = annualRate / 12;
const months = 240; // 20 years

const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
return Math.round(emi); // ₹8,678
```

### GST Calculator
```javascript
const amount = 1000;
const gstPercent = 18;
const gst = amount * (gstPercent / 100);
const total = amount + gst;
return { amount, gst, total }; // { 1000, 180, 1180 }
```

## Workflow

1. Parse the math expression from user query
2. Use code-execute with JavaScript
3. Return result with explanation

## Response Format

```
🔢 Calculation
━━━━━━━━━━━━━━
Input: 25 × 4 + 10
Result: 110
━━━━━━━━━━━━━━
```

## Tips
- For complex formulas: break into steps
- Show working for educational value
- Round results appropriately (2 decimal places usually)
