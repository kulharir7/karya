---
name: Email
description: Compose and send emails
triggers: email, mail, send mail, email bhejo, mail karo
---

# Email Skill

Compose and send emails via various methods.

## ⚠️ Security Note
Email sending requires authentication. NEVER expose credentials in logs.

## Option 1: PowerShell (Outlook)

If user has Outlook configured:
```powershell
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = "recipient@example.com"
$mail.Subject = "Subject"
$mail.Body = "Body text"
$mail.Send()
```

## Option 2: Python (SMTP)

Create a temp script:
```python
import smtplib
from email.mime.text import MIMEText

msg = MIMEText("Body text")
msg["Subject"] = "Subject"
msg["From"] = "sender@gmail.com"
msg["To"] = "recipient@example.com"

with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
    server.login("sender@gmail.com", "app_password")
    server.send_message(msg)
```

## Option 3: mailto: Link

Open default email client:
```powershell
Start-Process "mailto:recipient@example.com?subject=Subject&body=Body"
```

## Workflow

1. **Ask for details**: To, Subject, Body
2. **Compose draft**: Show user the email content
3. **Confirm**: Get explicit confirmation before sending
4. **Send**: Use appropriate method based on setup
5. **Log**: memory-log the sent email (without sensitive content)

## 🚨 CRITICAL RULES

1. **ALWAYS confirm** before sending
2. **NEVER** log email passwords
3. **Show draft** to user before send
4. For sensitive content: suggest user sends manually

## Error Handling
- Outlook not installed: Try Python or mailto:
- SMTP auth failed: App password may be needed
- Network error: Check internet connection

## Draft Template

Present email like this before sending:
```
📧 Email Draft
━━━━━━━━━━━━━━
To: recipient@example.com
Subject: Meeting Tomorrow
━━━━━━━━━━━━━━
Body:
Hi,

This is the email content...

Best regards,
[Name]
━━━━━━━━━━━━━━
Should I send this? (yes/no)
```
