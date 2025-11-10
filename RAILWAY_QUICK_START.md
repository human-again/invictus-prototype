# Railway Deployment - Quick Start Guide

## 🚀 Step-by-Step Deployment

### Step 1: Prepare Your Code (if not already done)

Make sure your code is pushed to GitHub:

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Prepare for Railway deployment with Docker"

# Push to GitHub
git push origin main
```

### Step 2: Create Railway Account & Project

1. **Sign up/Login** at https://railway.app
   - Use GitHub login for easiest integration

2. **Create New Project**
   - Click "New Project" button
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub account
   - Select your repository: `Invictus-plan`

3. **Add Service**
   - Railway will detect your repository
   - Click "Add Service" → "GitHub Repo"
   - Select your repository again
   - **Important**: Set **Root Directory** to `backend`

### Step 3: Configure Railway Service

Railway should automatically detect:
- ✅ Dockerfile in `backend/` directory
- ✅ `railway.json` configuration
- ✅ Docker build

**Verify Settings:**
- Go to your service → Settings
- **Root Directory**: Should be `backend`
- **Build Command**: Should be empty (Docker handles this)
- **Start Command**: Should be empty (Dockerfile ENTRYPOINT handles this)

### Step 4: Set Environment Variables

Go to your service → **Variables** tab and add:

#### Required Variables:
```
PERPLEXITY_API_KEY=your_perplexity_api_key_here
UNPAYWALL_EMAIL=your_email@example.com
```

#### Recommended Variables:
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
ENVIRONMENT=production
LOG_LEVEL=INFO
MAX_COMPARE_MODELS=5
MAX_CONCURRENT_MODELS=3
```

#### Optional (if using cloud AI services):
```
OLLAMA_BASE_URL=https://your-ollama-instance.com
OLLAMA_MODEL=llama3:8b
ENABLE_MODEL_COMPARISON=false
```

**Note:** Railway automatically sets `PORT` - don't add it manually.

### Step 5: Deploy

1. Railway will automatically start building when you:
   - First add the service, OR
   - Push new commits to your main branch

2. **Monitor the Build:**
   - Go to your service → **Deployments** tab
   - Watch the build logs in real-time
   - Build typically takes 3-5 minutes

3. **Wait for Deployment:**
   - Build: Installing dependencies, downloading spaCy model
   - Deploy: Starting the application
   - Health check: Verifying service is running

### Step 6: Get Your Service URL

1. Go to your service → **Settings** → **Networking**
2. Railway automatically provides a domain like:
   - `https://your-service-name.up.railway.app`
3. Copy this URL - you'll need it for your frontend

### Step 7: Verify Deployment

1. **Test Health Endpoint:**
   ```bash
   curl https://your-service-name.up.railway.app/
   ```
   Should return: `{"status":"ok"}`

2. **Check API Docs:**
   Visit: `https://your-service-name.up.railway.app/docs`
   - Should show FastAPI Swagger UI

3. **View Logs:**
   - Go to service → **Logs** tab
   - Should see application startup messages
   - No errors should be present

### Step 8: Update Frontend (if applicable)

If you have a frontend deployed:

1. **Update Vercel Environment Variable:**
   - Go to Vercel project settings
   - Update `NEXT_PUBLIC_API_URL` to your Railway URL
   - Redeploy frontend

2. **Update Backend CORS:**
   - In Railway, update `ALLOWED_ORIGINS` to include your frontend URL
   - Railway will automatically redeploy

## 🔍 Troubleshooting

### Build Fails

**Common Issues:**
- **Memory limit**: Railway free tier has limits - upgrade if needed
- **Dependency conflicts**: Check build logs for specific errors
- **spaCy download timeout**: May need to increase build timeout

**Solutions:**
1. Check build logs in Railway dashboard
2. Verify `requirements.txt` has correct versions
3. Test Docker build locally first:
   ```bash
   cd backend
   docker build -t test-build .
   ```

### Service Won't Start

**Check:**
1. **Environment Variables**: All required vars set?
2. **Logs**: Check service logs for errors
3. **Port**: Entrypoint script should handle PORT automatically
4. **Health Check**: Service should respond at `/`

**Common Errors:**
- `ModuleNotFoundError`: Missing dependency in requirements.txt
- `Connection refused`: Service not binding to 0.0.0.0
- `Port already in use`: Shouldn't happen, but check logs

### Service Starts But Returns Errors

1. **Check Logs**: Railway dashboard → Logs tab
2. **Test Endpoints**: Use `/docs` to test API
3. **Environment Variables**: Verify all are set correctly
4. **External Services**: Check if Perplexity API key is valid

## 📊 Monitoring

### View Logs
- Railway Dashboard → Your Service → **Logs** tab
- Real-time log streaming
- Filter by deployment

### Check Status
- Railway Dashboard → Your Service → **Metrics** tab
- CPU, Memory, Network usage
- Request counts

### Health Checks
- Railway automatically checks `/` endpoint
- Service will restart if health check fails

## 🔄 Automatic Deployments

Railway automatically deploys when you:
- Push to your main branch (if connected to GitHub)
- Manually trigger deployment in dashboard

**To disable auto-deploy:**
- Settings → **Source** → Toggle "Auto Deploy"

## 💰 Cost Management

- **Free Tier**: $5 credit/month
- **Monitor Usage**: Dashboard → Usage tab
- **Upgrade**: If you exceed free tier limits

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Service added with `backend` as root directory
- [ ] Environment variables set
- [ ] Build successful
- [ ] Service running (health check passes)
- [ ] Service URL obtained
- [ ] API accessible at `/docs`
- [ ] Frontend updated with backend URL (if applicable)
- [ ] CORS configured correctly

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app
- **Check Logs**: Always check logs first for errors

---

**Ready to deploy?** Follow the steps above, and your backend will be live on Railway in minutes! 🚀

