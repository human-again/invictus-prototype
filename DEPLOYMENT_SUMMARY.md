# Deployment Summary - Quick Reference

This is a quick reference guide for deploying Invictus Plan to production.

## 🎯 Quick Start

### 1. GitHub Setup (5 minutes)

```bash
# Initialize and push to GitHub
git init
git add .
git commit -m "Initial commit: Ready for deployment"
git remote add origin https://github.com/yourusername/invictus-plan.git
git branch -M main
git push -u origin main
```

### 2. Frontend Deployment - Vercel (10 minutes)

1. Go to https://vercel.com → Sign up with GitHub
2. Click "New Project" → Import your repository
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js (auto-detected)
4. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.com` (add after backend is deployed)
5. Click "Deploy"
6. Note your frontend URL (e.g., `https://invictus-plan.vercel.app`)

### 3. Backend Deployment - Choose One Option

#### Option A: Railway (Recommended - Easiest)

1. Go to https://railway.app → Sign up with GitHub
2. New Project → Deploy from GitHub repo
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt && python -m spacy download en_core_web_sm`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   ```
   PERPLEXITY_API_KEY=your_key
   UNPAYWALL_EMAIL=your_email@example.com
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   SECRET_KEY=generate_secure_key
   ENVIRONMENT=production
   ```
5. Deploy → Note backend URL

#### Option B: Fly.io

```bash
# Install CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
cd backend
fly launch
fly secrets set PERPLEXITY_API_KEY=your_key
fly secrets set ALLOWED_ORIGINS=https://your-frontend.vercel.app
# ... add all other secrets
fly deploy
```

### 4. Connect Frontend to Backend

1. **Update Vercel Environment Variable**:
   - Go to Vercel project settings
   - Update `NEXT_PUBLIC_API_URL` to your backend URL
   - Redeploy

2. **Update Backend CORS**:
   - Go to backend hosting platform
   - Update `ALLOWED_ORIGINS` to include your Vercel frontend URL
   - Restart service

### 5. Test Everything

- [ ] Frontend loads at Vercel URL
- [ ] Backend health check works: `curl https://your-backend.com/`
- [ ] Frontend can call backend API (check browser console)
- [ ] All features work end-to-end

---

## 🔒 Security Checklist

### Before Going Live

- [ ] All `.env` files are in `.gitignore` ✅ (already done)
- [ ] No secrets in code (run: `grep -r "api_key\|secret" --include="*.py" backend/`)
- [ ] `ALLOWED_ORIGINS` only includes production frontend URL
- [ ] `SECRET_KEY` is a strong random key (generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- [ ] HTTPS enabled on both frontend and backend
- [ ] Security headers configured (already in `vercel.json`)

### Recommended Additions

- [ ] **Rate Limiting** (add `slowapi` to `requirements.txt` and implement)
- [ ] **API Key Authentication** (for production use)
- [ ] **Error Tracking** (Sentry - free tier available)
- [ ] **Uptime Monitoring** (UptimeRobot - free tier available)

---

## 📊 Backend Deployment Options Comparison

| Platform | Free Tier | Ease of Setup | Performance | Best For |
|----------|-----------|---------------|-------------|----------|
| **Railway** | $5 credit/month | ⭐⭐⭐⭐⭐ Very Easy | ⭐⭐⭐⭐ Good | Quick deployment, Docker support |
| **Fly.io** | 3 shared VMs | ⭐⭐⭐ Moderate | ⭐⭐⭐⭐⭐ Excellent | Global edge, performance |
| **DigitalOcean** | No | ⭐⭐⭐⭐ Easy | ⭐⭐⭐⭐ Good | Reliability, paid service |
| **AWS/GCP/Azure** | Limited | ⭐⭐ Complex | ⭐⭐⭐⭐⭐ Excellent | Enterprise, scalability |

**Recommendation**: Start with **Railway** for easiest setup with Docker support.

---

## 🔧 Environment Variables Reference

### Backend Required Variables

```bash
# API Keys
PERPLEXITY_API_KEY=your_perplexity_key
UNPAYWALL_EMAIL=your_email@example.com

# Security
SECRET_KEY=generate_secure_32_char_key
ALLOWED_ORIGINS=https://your-frontend.vercel.app
ENVIRONMENT=production

# Ollama (if using cloud Ollama service)
OLLAMA_BASE_URL=https://your-ollama-service.com
OLLAMA_MODEL=llama3:8b

# Optional
REDIS_URL=redis://... (if using Redis)
LOG_LEVEL=INFO
```

### Frontend Required Variables

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

---

## 🚨 Common Issues & Solutions

### CORS Errors

**Problem**: Frontend can't call backend API  
**Solution**: 
1. Check `ALLOWED_ORIGINS` includes exact frontend URL (with `https://`)
2. Remove `localhost` from production `ALLOWED_ORIGINS`
3. Restart backend after changing CORS

### Backend Not Starting

**Problem**: Build fails or service crashes  
**Solution**:
1. Check build logs for missing dependencies
2. Verify Python version (3.9+)
3. Check environment variables are set
4. Verify `spacy` model downloads: `python -m spacy download en_core_web_sm`

### Frontend Build Fails

**Problem**: Vercel build fails  
**Solution**:
1. Check Node.js version compatibility
2. Run `npm install` locally to check for errors
3. Check TypeScript errors: `npm run build` locally
4. Verify `NEXT_PUBLIC_API_URL` is set

### API Calls Fail

**Problem**: 404 or connection errors  
**Solution**:
1. Verify `NEXT_PUBLIC_API_URL` is correct in Vercel
2. Check backend is running and accessible
3. Test backend directly: `curl https://your-backend.com/`
4. Check browser console for specific errors

---

## 📈 Monitoring & Availability

### Free Monitoring Options

1. **UptimeRobot** (https://uptimerobot.com)
   - Free: 50 monitors
   - Check backend health endpoint every 5 minutes
   - Email alerts on downtime

2. **Sentry** (https://sentry.io)
   - Free tier: 5,000 errors/month
   - Error tracking for both frontend and backend
   - Real-time alerts

3. **Vercel Analytics** (Built-in)
   - Performance metrics
   - Core Web Vitals
   - Traffic analytics

### Setup Health Checks

Most platforms automatically check `/` endpoint. Ensure your backend has:
```python
@app.get("/")
async def root():
    return {"status": "ok"}
```

---

## 💰 Cost Estimation

### Free Tier (Starting Out)

- **Vercel**: Free (100GB bandwidth, unlimited requests)
- **Railway**: $5 free credit/month
- **Fly.io**: 3 shared VMs free
- **Total**: $0-5/month

### Paid Tier (Production)

- **Vercel Pro**: $20/month (if needed)
- **Railway**: $5-20/month (depending on usage)
- **Fly.io**: $1.94/month per VM
- **DigitalOcean**: $5-12/month
- **Total**: ~$15-50/month

---

## 📝 Next Steps After Deployment

1. **Set up monitoring** (UptimeRobot, Sentry)
2. **Configure custom domains** (optional)
3. **Add rate limiting** (recommended)
4. **Set up CI/CD** (GitHub Actions)
5. **Add API authentication** (if needed)
6. **Document API** (if external users)
7. **Set up staging environment** (optional)

---

## 🔗 Useful Links

- **Full Deployment Guide**: See `DEPLOYMENT.md`
- **Security Guide**: See `SECURITY.md`
- **Detailed Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Fly.io Docs**: https://fly.io/docs

---

## ✅ Success Criteria

Your deployment is successful when:

- ✅ Frontend accessible at Vercel URL
- ✅ Backend accessible at hosting platform URL
- ✅ Frontend can communicate with backend (no CORS errors)
- ✅ All features work end-to-end
- ✅ HTTPS enabled everywhere
- ✅ Security headers configured
- ✅ Monitoring active

---

**Need Help?** Check the detailed guides:
- `DEPLOYMENT.md` - Full deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
- `SECURITY.md` - Security best practices

