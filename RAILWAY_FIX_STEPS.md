# Railway Dockerfile Fix - Step by Step

## Problem
Railway error: `Dockerfile 'Dockerfile' does not exist`

## Solution Applied

I've created a `railway.json` at the **project root** that points to `backend/Dockerfile`.

## What Changed

1. **Created**: `/railway.json` (project root)
   - Points to: `backend/Dockerfile`
   - Railway will read this from the root

2. **Updated**: `/backend/railway.json` 
   - Still exists for reference
   - Railway will use the root one if both exist

## Next Steps

### 1. Commit and Push

```bash
git add railway.json
git commit -m "Add railway.json at root to fix Dockerfile path"
git push origin main
```

### 2. In Railway Dashboard

**Option A: Use Root Directory (Recommended)**
1. Go to Railway Dashboard → Your Service → Settings
2. Set **Root Directory** to: (leave empty or set to `/`)
3. Railway will use the root `railway.json` which points to `backend/Dockerfile`

**Option B: Set Root Directory to `backend/`**
1. Go to Railway Dashboard → Your Service → Settings  
2. Set **Root Directory** to: `backend`
3. Railway will use `backend/railway.json` and look for `Dockerfile` in backend/

### 3. Redeploy

After pushing:
- Railway will automatically redeploy, OR
- Manually trigger redeploy in Railway dashboard

## File Structure

```
Invictus-plan/
├── railway.json          ← NEW: Points to backend/Dockerfile
├── backend/
│   ├── Dockerfile        ← Your Dockerfile
│   ├── railway.json      ← Alternative config (if root dir = backend)
│   ├── entrypoint.sh
│   └── ...
```

## Verification

After deploying, check Railway logs:
- ✅ Should see: `Using Detected Dockerfile` or `Building Dockerfile`
- ✅ Should see: Build steps starting
- ❌ Should NOT see: `Dockerfile does not exist`

## If Still Not Working

### Check 1: Verify Files Are Committed
```bash
git ls-files railway.json backend/Dockerfile
```
Both should be listed.

### Check 2: Railway Service Settings
- Go to Railway Dashboard → Your Service → Settings
- Check **Root Directory**:
  - If empty or `/`: Railway uses root `railway.json` → points to `backend/Dockerfile` ✅
  - If `backend`: Railway uses `backend/railway.json` → looks for `Dockerfile` in backend/ ✅

### Check 3: Manual Override
In Railway Dashboard → Service Settings:
- **Build Command**: (leave empty - Docker handles it)
- **Dockerfile Path**: Try setting explicitly to `backend/Dockerfile`

## Alternative: Move Dockerfile to Root (Not Recommended)

If nothing else works, you could move Dockerfile to root, but this breaks the monorepo structure:
```bash
# NOT RECOMMENDED - only if absolutely necessary
mv backend/Dockerfile ./Dockerfile
# Update COPY paths in Dockerfile
```

## Current Configuration

**Root railway.json** (what Railway will use):
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  }
}
```

This tells Railway: "Look for the Dockerfile at `backend/Dockerfile` relative to project root"

## Expected Behavior

After pushing the root `railway.json`:
1. Railway reads `railway.json` from project root
2. Sees `dockerfilePath: "backend/Dockerfile"`
3. Finds Dockerfile at `backend/Dockerfile`
4. Builds successfully ✅

