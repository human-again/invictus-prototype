# Security Guide

This document outlines security best practices and considerations for the Invictus-plan application.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [API Security](#api-security)
3. [CORS Configuration](#cors-configuration)
4. [Input Validation](#input-validation)
5. [Rate Limiting](#rate-limiting)
6. [Authentication & Authorization](#authentication--authorization)
7. [HTTPS/SSL](#httpsssl)
8. [Dependency Security](#dependency-security)
9. [Logging & Monitoring](#logging--monitoring)
10. [Incident Response](#incident-response)

## Environment Variables

### ✅ Best Practices

- **Never commit `.env` files** - They are already in `.gitignore`
- **Use platform secrets management** - Vercel, Railway, Render all provide secure secret storage
- **Rotate keys regularly** - Especially API keys and secrets
- **Use different keys for dev/staging/prod** - Never reuse production keys in development
- **Limit access** - Only grant access to secrets to necessary team members

### Required Secrets

**Backend:**
- `PERPLEXITY_API_KEY` - Perplexity API key
- `UNPAYWALL_EMAIL` - Email for Unpaywall API
- `SECRET_KEY` - Secret key for signing (generate strong random key)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend origins

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL (public, but should be HTTPS in production)

### Generating Secure Keys

```bash
# Generate a secure secret key (Python)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate a secure secret key (OpenSSL)
openssl rand -hex 32
```

## API Security

### Current Status

The API currently has:
- ✅ CORS protection
- ✅ Input validation via Pydantic models
- ⚠️ No rate limiting (should be added)
- ⚠️ No authentication (should be added for production)

### Recommended Additions

#### 1. Rate Limiting

Add rate limiting to prevent abuse:

```python
# Install: pip install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/compare/search")
@limiter.limit("10/minute")  # 10 requests per minute
async def compare_search(request: Request, ...):
    ...
```

#### 2. API Key Authentication

For production, consider adding API key authentication:

```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key != os.getenv("API_KEY"):
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

@app.post("/compare/search")
async def compare_search(api_key: str = Security(verify_api_key), ...):
    ...
```

#### 3. Request Size Limits

FastAPI has built-in request size limits, but you can configure them:

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    if request.headers.get("content-length"):
        size = int(request.headers["content-length"])
        if size > 10 * 1024 * 1024:  # 10MB limit
            return JSONResponse(
                status_code=413,
                content={"detail": "Request too large"}
            )
    return await call_next(request)
```

## CORS Configuration

### Current Implementation

CORS is configured via environment variable `ALLOWED_ORIGINS`:

```python
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]
```

### ✅ Best Practices

- **Only allow specific origins** - Never use `["*"]` in production
- **Use HTTPS in production** - All origins should use `https://`
- **Remove localhost in production** - Only include production frontend URLs
- **Be specific** - Include protocol, domain, and port if needed

### Example Configuration

**Development:**
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Production:**
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
```

## Input Validation

### Current Status

✅ The API uses Pydantic models for request validation, which provides:
- Type checking
- Required field validation
- Data type conversion

### Additional Recommendations

1. **Sanitize user inputs** - Especially for text fields that might be used in prompts
2. **Validate file uploads** - If you add file upload functionality
3. **Limit string lengths** - Add max length constraints to Pydantic models
4. **Validate URLs** - If accepting URLs, validate format and protocol

Example:
```python
from pydantic import BaseModel, Field, HttpUrl

class PublicationRequest(BaseModel):
    title: str = Field(..., max_length=500)
    url: HttpUrl  # Validates URL format
    content: str = Field(..., max_length=100000)  # Limit content size
```

## Rate Limiting

### Why It's Important

Rate limiting prevents:
- API abuse
- DDoS attacks
- Cost overruns (especially with paid AI APIs)
- Resource exhaustion

### Implementation Options

1. **slowapi** (Recommended for FastAPI)
   ```bash
   pip install slowapi
   ```

2. **Redis-based rate limiting** (For distributed systems)
   ```bash
   pip install redis fastapi-limiter
   ```

3. **Platform-level rate limiting** (Vercel, Cloudflare, etc.)

### Recommended Limits

- **Public endpoints**: 10-100 requests/minute per IP
- **Authenticated endpoints**: 100-1000 requests/minute per user
- **AI model endpoints**: 5-20 requests/minute (due to cost)

## Authentication & Authorization

### Current Status

⚠️ **No authentication implemented** - The API is currently open.

### Recommended Implementation

For production, consider:

1. **API Key Authentication** (Simplest)
   - Generate API keys for users
   - Validate on each request
   - Track usage per key

2. **JWT Authentication** (For user accounts)
   ```python
   pip install python-jose[cryptography] passlib[bcrypt]
   ```

3. **OAuth 2.0** (For third-party integrations)

### Example: API Key Middleware

```python
from fastapi import Security, HTTPException, Depends
from fastapi.security import APIKeyHeader
import os

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    valid_keys = os.getenv("API_KEYS", "").split(",")
    if not api_key or api_key not in valid_keys:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API key"
        )
    return api_key

# Use in endpoints
@app.post("/compare/search")
async def compare_search(
    api_key: str = Depends(verify_api_key),
    request: CompareSearchRequest
):
    ...
```

## HTTPS/SSL

### Current Status

✅ Most hosting platforms (Vercel, Railway, Render, Fly.io) provide automatic HTTPS.

### ✅ Best Practices

- **Always use HTTPS in production** - Never use HTTP
- **Enable HSTS** - HTTP Strict Transport Security
- **Use valid SSL certificates** - Let's Encrypt is free
- **Redirect HTTP to HTTPS** - Configure at platform level

### Security Headers

The frontend `vercel.json` already includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

Consider adding to backend:
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["yourdomain.com", "*.yourdomain.com"]
)
```

## Dependency Security

### Regular Updates

1. **Check for vulnerabilities**:
   ```bash
   # Python
   pip install safety
   safety check
   
   # Or use pip-audit
   pip install pip-audit
   pip-audit
   
   # Node.js
   npm audit
   npm audit fix
   ```

2. **Keep dependencies updated**:
   ```bash
   # Python
   pip list --outdated
   pip install --upgrade package-name
   
   # Node.js
   npm outdated
   npm update
   ```

3. **Use dependency pinning**:
   - ✅ Already done in `requirements.txt` (specific versions)
   - ✅ Consider using `package-lock.json` for Node.js (already in use)

### Automated Scanning

Consider using:
- **GitHub Dependabot** - Automatic dependency updates
- **Snyk** - Vulnerability scanning
- **WhiteSource** - Open source security

## Logging & Monitoring

### ✅ Best Practices

- **Don't log sensitive data** - No API keys, passwords, or personal info
- **Use structured logging** - JSON format for easier parsing
- **Log security events** - Failed auth attempts, rate limit violations
- **Monitor error rates** - Set up alerts for unusual activity

### Recommended Tools

1. **Sentry** (Error tracking)
   ```python
   import sentry_sdk
   from sentry_sdk.integrations.fastapi import FastApiIntegration
   
   sentry_sdk.init(
       dsn=os.getenv("SENTRY_DSN"),
       integrations=[FastApiIntegration()],
       traces_sample_rate=1.0,
   )
   ```

2. **Logging Service**:
   - Platform logs (Vercel, Railway, etc.)
   - CloudWatch (AWS)
   - Datadog
   - LogRocket

### What to Log

✅ **Do log:**
- Request paths and methods
- Response status codes
- Error messages (sanitized)
- Performance metrics
- Security events (failed auth, rate limits)

❌ **Don't log:**
- API keys or secrets
- Passwords
- Full request/response bodies (may contain sensitive data)
- Personal information (unless necessary and compliant)

## Incident Response

### Preparation

1. **Document procedures** - Create runbook for common issues
2. **Set up alerts** - Monitor error rates, response times
3. **Have rollback plan** - Know how to revert deployments
4. **Keep backups** - Database, configuration, etc.

### If Security Incident Occurs

1. **Immediately rotate compromised keys**
2. **Review access logs** - Identify what was accessed
3. **Notify affected users** - If personal data was involved
4. **Document the incident** - For post-mortem
5. **Implement fixes** - Prevent recurrence

### Common Security Issues

**API Key Leaked:**
- Rotate key immediately
- Review logs for unauthorized access
- Update key in all environments

**CORS Misconfiguration:**
- Review `ALLOWED_ORIGINS` setting
- Test from different origins
- Update configuration if needed

**Rate Limit Bypassed:**
- Review rate limiting implementation
- Check for bypass methods
- Implement additional protections

## Security Checklist

Before going to production:

- [ ] All `.env` files are in `.gitignore`
- [ ] Environment variables are set in hosting platform
- [ ] API keys are rotated and secure
- [ ] CORS only allows frontend domain(s)
- [ ] HTTPS is enabled everywhere
- [ ] Security headers are configured
- [ ] Rate limiting is implemented
- [ ] Input validation is comprehensive
- [ ] Dependencies are up to date
- [ ] Error tracking is set up
- [ ] Logging doesn't expose sensitive data
- [ ] Monitoring/alerting is configured
- [ ] Backup procedures are in place
- [ ] Incident response plan is documented

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Vercel Security](https://vercel.com/docs/security)

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **Do not** open a public issue
2. Email security concerns privately
3. Allow time for fix before disclosure

