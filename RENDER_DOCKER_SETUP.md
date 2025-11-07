# Render Docker Setup Guide

## Problem

Render is using Python 3.13.4 by default, but `blis` (a spacy dependency) fails to compile with Python 3.13. The build fails with compilation errors.

## Solution: Use Docker

Your project already has a `Dockerfile` that uses Python 3.9. Configuring Render to use Docker will ensure the correct Python version.

## Step-by-Step Instructions

### Option 1: Configure via Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Select your service: `invictus-prototype`

2. **Open Service Settings**
   - Click on your service
   - Go to **Settings** tab

3. **Change Build Type to Docker**
   - Scroll down to **Build & Deploy** section
   - Find **Build Command** or **Build Type** setting
   - Change from **"Native"** or **"Python"** to **"Docker"**
   - Or look for **"Dockerfile Path"** option and set it to `backend/Dockerfile`

4. **Update Build Command** (if needed)
   - If there's a build command field, you can clear it (Dockerfile handles this)
   - Or set it to: `docker build -t app .`

5. **Update Start Command** (if needed)
   - Should be: `docker run -p $PORT:8000 app`
   - Or if using Render's Docker support: Leave it as is, Render will handle it

6. **Save Changes**
   - Click **Save Changes**
   - Render will trigger a new deployment

### Option 2: Update render.yaml

If Render respects your `render.yaml` file, update it to use Docker:

```yaml
services:
  - type: web
    name: invictus-plan-backend
    dockerfilePath: backend/Dockerfile
    dockerContext: backend
    buildCommand: ""  # Dockerfile handles the build
    startCommand: ""   # Dockerfile CMD handles startup
    envVars:
      - key: PORT
        value: 8000
    healthCheckPath: /
```

### Option 3: Use Render API (Advanced)

You can update the service configuration via API:

```bash
curl -X PATCH "https://api.render.com/v1/services/srv-d473mfq4d50c73ft4l00" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceDetails": {
      "envSpecificDetails": {
        "dockerfilePath": "backend/Dockerfile",
        "dockerContext": "backend"
      }
    }
  }'
```

## Verify Dockerfile

Your existing `Dockerfile` is already configured correctly:

```dockerfile
FROM python:3.9-slim  # ✅ Uses Python 3.9

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## After Switching to Docker

1. **Monitor the Build**
   - Go to your service → **Logs** tab
   - Watch for Docker build progress
   - Should see: "Step 1/8 : FROM python:3.9-slim"

2. **Expected Build Steps**
   - ✅ Docker pulls Python 3.9 image
   - ✅ Installs system dependencies
   - ✅ Installs Python packages (blis should use pre-built wheels)
   - ✅ Downloads spaCy model
   - ✅ Build completes successfully

3. **If Build Succeeds**
   - Service will start automatically
   - Check health endpoint: `https://invictus-prototype.onrender.com/`

## Troubleshooting

### Docker Build Fails

- **Check Dockerfile path**: Should be `backend/Dockerfile` relative to repo root
- **Check Docker context**: Should be `backend/` directory
- **Check logs**: Look for Docker-specific error messages

### Service Won't Start

- **Check PORT**: Dockerfile exposes port 8000, Render sets `$PORT` env var
- **Update Dockerfile CMD**: May need to use `$PORT` environment variable:
  ```dockerfile
  CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
  ```

### Still Using Python 3.13

- **Clear build cache**: In Render Dashboard → Settings → Clear Build Cache
- **Force redeploy**: Manual deploy after clearing cache

## Alternative: Fix Without Docker

If you prefer to stay with native Python builds:

1. **Pin blis version** that has pre-built wheels for Python 3.13
2. **Use alternative to blis** if available
3. **Wait for blis to support Python 3.13** (may take time)

But Docker is the most reliable solution right now.

## Quick Reference

- **Service URL**: https://dashboard.render.com/web/srv-d473mfq4d50c73ft4l00
- **Dockerfile Location**: `backend/Dockerfile`
- **Python Version in Dockerfile**: 3.9 (correct)
- **Current Issue**: Native build uses Python 3.13.4 (incompatible)

