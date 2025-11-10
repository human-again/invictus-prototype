# Getting Started with Deployment

Welcome! This guide will help you deploy your Invictus Plan application to the internet.

## 📚 Documentation Overview

We've created several guides to help you:

1. **DEPLOYMENT_SUMMARY.md** - Quick reference (start here!)
2. **DEPLOYMENT_CHECKLIST.md** - Detailed step-by-step checklist
3. **DEPLOYMENT.md** - Comprehensive deployment guide (already existed)
4. **BACKEND_DEPLOYMENT_OPTIONS.md** - Detailed backend platform comparison
5. **SECURITY.md** - Security best practices (already existed)
6. **backend/RATE_LIMITING.md** - Optional rate limiting guide

## 🚀 Quick Start (15 minutes)

### Step 1: Push to GitHub (5 min)

```bash
# If not already a git repo
git init
git add .
git commit -m "Initial commit: Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/invictus-plan.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy Frontend to Vercel (5 min)

1. Go to https://vercel.com → Sign up with GitHub
2. Click "New Project" → Import your repository
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js (auto-detected)
4. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.com` (add after backend is deployed)
5. Click "Deploy"
6. **Note your frontend URL** (e.g., `https://invictus-plan.vercel.app`)

### Step 3: Deploy Backend (5 min)

**Recommended: Railway** (easiest)

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
   SECRET_KEY=generate_secure_key_here
   ENVIRONMENT=production
   ```
5. Deploy → **Note your backend URL**

### Step 4: Connect Frontend to Backend (2 min)

1. **Update Vercel**: Go to Vercel project settings → Update `NEXT_PUBLIC_API_URL` to your backend URL → Redeploy
2. **Update Backend CORS**: Go to Railway → Update `ALLOWED_ORIGINS` to include your Vercel frontend URL → Restart

### Step 5: Test (1 min)

- Visit your Vercel frontend URL
- Test a feature (e.g., search for a protein)
- Check browser console for errors
- ✅ Done!

## 🔑 Required Environment Variables

### Backend

```bash
PERPLEXITY_API_KEY=your_perplexity_key          # Get from https://www.perplexity.ai/
UNPAYWALL_EMAIL=your_email@example.com         # Your email
ALLOWED_ORIGINS=https://your-frontend.vercel.app  # Your Vercel URL
SECRET_KEY=generate_secure_32_char_key         # Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
ENVIRONMENT=production
```

### Frontend

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com  # Your backend URL
```

## 🎯 Backend Platform Recommendations

| Platform | Best For | Free Tier |
|----------|----------|-----------|
| **Railway** | Quick deployment, ease of use | $5 credit/month |
| **Fly.io** | Performance, global edge | 3 VMs free |
| **DigitalOcean** | Reliability, paid service | No |

**Recommendation**: Start with **Railway** for easiest setup with Docker support.

See `BACKEND_DEPLOYMENT_OPTIONS.md` for detailed comparison.

## 🔒 Security Checklist

Before going live, ensure:

- [ ] All `.env` files are in `.gitignore` ✅ (already done)
- [ ] No secrets committed to Git
- [ ] `ALLOWED_ORIGINS` only includes production frontend URL
- [ ] `SECRET_KEY` is a strong random key
- [ ] HTTPS enabled on both frontend and backend
- [ ] Security headers configured ✅ (already in `vercel.json`)

**Optional but recommended:**
- [ ] Add rate limiting (see `backend/RATE_LIMITING.md`)
- [ ] Set up error tracking (Sentry - free tier)
- [ ] Set up uptime monitoring (UptimeRobot - free tier)

## 📊 What's Already Configured

✅ **Git Configuration**
- `.gitignore` properly configured
- Environment templates in place
- No secrets in code

✅ **Frontend (Vercel)**
- `vercel.json` configured with security headers
- Next.js build configuration ready
- Environment variable template ready

✅ **Backend**
- `Dockerfile` ready for container deployment
- `railway.json` configured for Railway (Docker deployment)
- `entrypoint.sh` script for Railway PORT handling
- `.dockerignore` created
- Health check endpoint at `/`

✅ **Security**
- CORS configuration ready
- Security headers configured
- Environment variable templates
- Security documentation (`SECURITY.md`)

✅ **CI/CD**
- GitHub Actions workflow template (`.github/workflows/ci.yml`)

## 🆘 Need Help?

### Common Issues

**CORS Errors?**
- Check `ALLOWED_ORIGINS` includes exact frontend URL (with `https://`)
- Remove `localhost` from production
- Restart backend after changes

**Backend Won't Start?**
- Check build logs for missing dependencies
- Verify Python 3.9+
- Check environment variables are set
- Verify spaCy model downloads

**Frontend Build Fails?**
- Check Node.js version
- Run `npm install` locally to check for errors
- Verify TypeScript compiles: `npm run build`

### Documentation

- **Quick Reference**: `DEPLOYMENT_SUMMARY.md`
- **Step-by-Step**: `DEPLOYMENT_CHECKLIST.md`
- **Detailed Guide**: `DEPLOYMENT.md`
- **Backend Options**: `BACKEND_DEPLOYMENT_OPTIONS.md`
- **Security**: `SECURITY.md`

### Platform Docs

- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **Fly.io**: https://fly.io/docs

## ✅ Success Checklist

Your deployment is successful when:

- ✅ Frontend accessible at Vercel URL
- ✅ Backend accessible at hosting platform URL
- ✅ Frontend can communicate with backend (no CORS errors)
- ✅ All features work end-to-end
- ✅ HTTPS enabled everywhere
- ✅ Security headers configured
- ✅ Monitoring set up (optional but recommended)

## 🎉 Next Steps

After successful deployment:

1. **Set up monitoring** (UptimeRobot, Sentry)
2. **Configure custom domains** (optional)
3. **Add rate limiting** (recommended - see `backend/RATE_LIMITING.md`)
4. **Set up CI/CD** (GitHub Actions already configured)
5. **Add API authentication** (if needed for production)
6. **Document API** (if external users)

## 📝 Files Created/Updated

### New Files
- `DEPLOYMENT_CHECKLIST.md` - Comprehensive checklist
- `DEPLOYMENT_SUMMARY.md` - Quick reference guide
- `BACKEND_DEPLOYMENT_OPTIONS.md` - Backend platform comparison
- `backend/.dockerignore` - Docker ignore file
- `backend/RATE_LIMITING.md` - Rate limiting guide
- `.github/workflows/ci.yml` - CI/CD workflow template
- `GETTING_STARTED_DEPLOYMENT.md` - This file

### Existing Files (Verified)
- `.gitignore` - ✅ Properly configured
- `frontend/vercel.json` - ✅ Security headers configured
- `backend/Dockerfile` - ✅ Ready for deployment
- `backend/railway.json` - ✅ Railway config (Docker)
- `backend/entrypoint.sh` - ✅ Entrypoint script for Railway
- `DEPLOYMENT.md` - ✅ Comprehensive guide
- `SECURITY.md` - ✅ Security best practices

---

**Ready to deploy?** Start with `DEPLOYMENT_SUMMARY.md` for the quickest path to production!

**Questions?** Check the detailed guides or platform documentation.

Good luck with your deployment! 🚀

