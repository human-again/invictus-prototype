# Railway Dockerfile Not Found - Fix Guide

## Problem
Railway error: `Dockerfile 'Dockerfile' does not exist`

## Root Cause
Railway needs to know where to find the Dockerfile. This happens when:
1. Railway service root directory is not set to `backend/`
2. Railway is looking from project root instead of backend directory

## Solution Options

### Option 1: Set Root Directory in Railway Dashboard (Recommended)

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Settings** tab
4. Find **Root Directory** setting
5. Set it to: `backend`
6. Save changes
7. Redeploy

### Option 2: Verify railway.json Location

The `railway.json` file should be in the `backend/` directory (which it is).

If Railway is looking from project root, you have two options:

**A. Create railway.json at project root** (if you want Railway to look from root):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**B. Keep railway.json in backend/** (current setup - recommended):
- Make sure Railway service root directory is set to `backend/`
- The dockerfilePath should be `Dockerfile` or `./Dockerfile`

### Option 3: Manual Dockerfile Path

If Railway still can't find it, try updating `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Step-by-Step Fix

### Method 1: Railway Dashboard (Easiest)

1. **Open Railway Dashboard**
   - Go to https://railway.app/dashboard
   - Select your project
   - Click on your service

2. **Set Root Directory**
   - Go to **Settings** tab
   - Scroll to **Root Directory** field
   - Enter: `backend`
   - Click **Save**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **Redeploy** or push a new commit

### Method 2: Check Service Configuration

1. **Verify Service Setup**
   - In Railway dashboard, go to your service
   - Check **Settings** → **Source**
   - Root directory should be: `backend`

2. **If Root Directory is Empty or Wrong**
   - Set it to: `backend`
   - Save and redeploy

### Method 3: Use Railway CLI

If you have Railway CLI installed:

```bash
# Set root directory
railway variables set RAILWAY_SERVICE_ROOT=backend

# Or update service settings
railway service update --root-directory backend
```

## Verification

After fixing, verify:

1. **Check Build Logs**
   - Should see: `Using Detected Dockerfile` or `Building Dockerfile`
   - Should NOT see: `Dockerfile does not exist`

2. **Verify File Structure**
   Railway should see:
   ```
   backend/
     ├── Dockerfile
     ├── entrypoint.sh
     ├── requirements.txt
     ├── main.py
     └── railway.json
   ```

## Common Issues

### Issue: "Root Directory not found"
- **Solution**: Make sure `backend/` directory exists in your repository
- Check: `git ls-files backend/` should show files

### Issue: "Still can't find Dockerfile"
- **Solution**: 
  1. Verify Dockerfile is committed: `git ls-files backend/Dockerfile`
  2. Check Railway service root directory is `backend`
  3. Try absolute path: `dockerfilePath: "backend/Dockerfile"` (if railway.json is at root)

### Issue: "Build fails after finding Dockerfile"
- **Solution**: This is a different issue - check build logs for specific errors
- Our Dockerfile is tested and working locally

## Quick Checklist

- [ ] Railway service root directory set to `backend/`
- [ ] `railway.json` exists in `backend/` directory
- [ ] `Dockerfile` exists in `backend/` directory
- [ ] Both files are committed to git
- [ ] Service redeployed after changes

## After Fix

Once Railway finds the Dockerfile:
- Build should proceed (takes 3-5 minutes)
- All dependencies will install
- spaCy model will download
- Application will start
- Service will be accessible at Railway URL

## Need More Help?

- Check Railway logs for specific error messages
- Verify file structure matches what Railway expects
- Ensure all files are committed to git
- Railway Docs: https://docs.railway.app/deploy/dockerfiles

