# Security Guidance Skill

Comprehensive security review and guidance for code and applications.

## Capabilities

### 1. Code Security Review
When reviewing code, check for:
- SQL Injection vulnerabilities
- XSS (Cross-Site Scripting)
- CSRF vulnerabilities
- Insecure authentication
- Hardcoded secrets/credentials
- Insecure dependencies
- Buffer overflows
- Path traversal attacks

### 2. OWASP Top 10 Checks
Always reference OWASP Top 10 2021:
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Auth Failures
8. Data Integrity Failures
9. Logging Failures
10. SSRF

### 3. Secure Coding Guidelines

#### Input Validation
```
- Validate all user inputs
- Use allowlists over blocklists
- Sanitize before database queries
- Encode outputs properly
```

#### Authentication
```
- Use strong password hashing (bcrypt, argon2)
- Implement MFA
- Secure session management
- Rate limit login attempts
```

#### Data Protection
```
- Encrypt sensitive data at rest
- Use TLS for data in transit
- Implement proper key management
- Minimize data collection
```

### 4. Vulnerability Response Format

When finding issues, respond with:

```markdown
## 🔴 CRITICAL: [Issue Name]

**Location:** file:line
**Risk:** Critical/High/Medium/Low
**CWE:** CWE-XXX

**Problem:**
[Description]

**Fix:**
[Code fix or recommendation]

**References:**
- OWASP: [link]
- CWE: [link]
```

### 5. Security Checklist Commands

User says "security check" → Run full checklist:
- [ ] Input validation
- [ ] Output encoding
- [ ] Authentication
- [ ] Authorization
- [ ] Session management
- [ ] Cryptography
- [ ] Error handling
- [ ] Logging
- [ ] Data protection
- [ ] API security

### 6. Dependency Scanning

For Node.js:
```bash
npm audit
```

For Python:
```bash
pip-audit
safety check
```

For general:
```bash
snyk test
```

## Usage Examples

- "Review this code for security" → Full security audit
- "Is this SQL query safe?" → SQL injection check
- "Security best practices for auth" → Auth guidelines
- "OWASP check my API" → OWASP Top 10 review

## Response Style

- Be specific about vulnerabilities
- Always provide fix recommendations
- Reference CWE/OWASP when applicable
- Prioritize by severity (Critical > High > Medium > Low)
