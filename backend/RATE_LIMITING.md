# Rate Limiting Guide (Optional Enhancement)

Rate limiting helps protect your API from abuse and prevents cost overruns with paid AI APIs.

## Quick Setup with slowapi

### 1. Install slowapi

Add to `requirements.txt`:
```
slowapi==0.1.9
```

Or install directly:
```bash
pip install slowapi
```

### 2. Add Rate Limiting to main.py

Add these imports at the top:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
```

Add rate limiter initialization after creating the FastAPI app:
```python
app = FastAPI(title="Protein Synthesis AI Agent API", version="1.0.0")

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

### 3. Add Rate Limits to Endpoints

Example for search endpoint:
```python
@app.get("/protein/search")
@limiter.limit("30/minute")  # 30 requests per minute per IP
async def search_protein(request: Request, query: str = Query(...)):
    """Search for proteins in UniProt database"""
    results = uniprot.search_proteins(query)
    return {"results": results}
```

Example for AI-intensive endpoints:
```python
@app.post("/extract_methods")
@limiter.limit("10/minute")  # Lower limit for expensive operations
async def extract_methods(request: Request, request_data: ExtractMethodsRequest):
    # ... existing code
```

### 4. Recommended Rate Limits

- **Search endpoints**: 30-60 requests/minute
- **AI model endpoints** (extract, summarize): 10-20 requests/minute
- **Comparison endpoints**: 5-10 requests/minute (most expensive)
- **Health check**: No limit (or very high limit)

### 5. Environment-Based Configuration

You can make rate limits configurable:

```python
import os

# Get rate limits from environment or use defaults
SEARCH_RATE_LIMIT = os.getenv("SEARCH_RATE_LIMIT", "30/minute")
AI_RATE_LIMIT = os.getenv("AI_RATE_LIMIT", "10/minute")

@app.get("/protein/search")
@limiter.limit(SEARCH_RATE_LIMIT)
async def search_protein(request: Request, query: str = Query(...)):
    # ...
```

### 6. Custom Rate Limit Messages

Customize error messages:

```python
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    response = JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "retry_after": exc.retry_after
        }
    )
    response.headers["Retry-After"] = str(exc.retry_after)
    return response
```

## Alternative: Redis-Based Rate Limiting

For distributed systems or more advanced rate limiting:

```bash
pip install redis fastapi-limiter
```

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
import redis.asyncio as redis

@app.on_event("startup")
async def startup():
    redis_connection = await redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379")
    )
    await FastAPILimiter.init(redis_connection)

@app.get("/protein/search")
@limiter.limit("30/minute")
async def search_protein(request: Request, query: str = Query(...)):
    # ...
```

## Testing Rate Limits

Test locally:
```bash
# Install httpie or use curl
for i in {1..35}; do
  curl http://localhost:8000/protein/search?query=test
  echo "Request $i"
done
```

You should see rate limit errors after exceeding the limit.

## Production Considerations

1. **IP-based limiting** works for most cases
2. **User-based limiting** requires authentication
3. **API key-based limiting** for different tiers
4. **Whitelist** certain IPs if needed

## Note

Rate limiting is **optional** but **highly recommended** for production to:
- Prevent API abuse
- Control costs (especially with paid AI APIs)
- Ensure fair usage
- Protect against DDoS

You can deploy without rate limiting initially and add it later.

