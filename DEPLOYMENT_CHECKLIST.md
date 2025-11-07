# Deployment Checklist - Invictus Plan

Complete checklist for deploying the Invictus Plan application to GitHub and production.

## 📋 Pre-Deployment Checklist

### 1. Repository Preparation

- [ ] **Initialize Git Repository** (if not already done)
  ```bash
  git init
  git add .
  git commit -m "Initial commit: Ready for deployment"
  ```

- [ ] **Verify .gitignore is complete**
  - [ ] `.env` files are ignored
  - [ ] `venv/` is ignored
  - [ ] `node_modules/` is ignored
  - [ ] `*.log` files are ignored
  - [ ] `.next/` is ignored
  - [ ] IDE files are ignored

- [ ] **Create GitHub Repository**
  - [ ] Go to https://github.com/new
  - [ ] Create new repository (don't initialize with README)
  - [ ] Copy repository URL

- [ ] **Push to GitHub**
  ```bash
  git remote add origin https://github.com/yourusername/invictus-plan.git
  git branch -M main
  git push -u origin main
  ```

### 2. Environment Variables Setup

#### Backend Environment Variables

Create `.env` file in `backend/` directory (DO NOT COMMIT):

- [ ] `PERPLEXITY_API_KEY` - Get from https://www.perplexity.ai/
- [ ] `UNPAYWALL_EMAIL` - Your email for Unpaywall API
- [ ] `ALLOWED_ORIGINS` - Comma-separated list (e.g., `https://your-app.vercel.app`)
- [ ] `SECRET_KEY` - Generate secure key: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] `ENVIRONMENT=production`
- [ ] `OLLAMA_BASE_URL` - If using cloud Ollama service
- [ ] `OLLAMA_MODEL` - Model name (e.g., `llama3:8b`)
- [ ] `REDIS_URL` - If using Redis (optional)
- [ ] `REDIS_PASSWORD` - If using Redis (optional)

#### Frontend Environment Variables

Create `.env.local` file in `frontend/` directory (DO NOT COMMIT):

- [ ] `NEXT_PUBLIC_API_URL` - Your backend URL (e.g., `https://your-backend.railway.app`)

### 3. Security Hardening

- [ ] **Verify no secrets in code**
  ```bash
  # Search for potential secrets
  grep -r "api_key\|secret\|password" --include="*.py" --include="*.ts" --include="*.tsx" backend/ frontend/
  ```

- [ ] **Generate secure SECRET_KEY**
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

- [ ] **Review CORS configuration**
  - [ ] Remove `localhost` from production `ALLOWED_ORIGINS`
  - [ ] Only include production frontend URLs
  - [ ] Use HTTPS URLs only

- [ ] **Check dependencies for vulnerabilities**
  ```bash
  # Backend
  cd backend
  pip install safety
  safety check
  
  # Frontend
  cd frontend
  npm audit
  npm audit fix
  ```

### 4. Code Quality

- [ ] **Run linters**
  ```bash
  # Frontend
  cd frontend
  npm run lint
  
  # Backend (if you have linting setup)
  # flake8 backend/
  # black backend/
  ```

- [ ] **Test locally**
  ```bash
  # Backend
  cd backend
  uvicorn main:app --reload
  
  # Frontend
  cd frontend
  npm run dev
  ```

- [ ] **Verify all features work**
  - [ ] Protein search
  - [ ] Publication retrieval
  - [ ] Protocol extraction
  - [ ] Model comparison
  - [ ] Verification dashboard

---

## 🚀 Frontend Deployment (Vercel)

### Step 1: Prepare Vercel Configuration

- [ ] **Verify `frontend/vercel.json` exists and is configured**
  - [ ] Security headers are set
  - [ ] API rewrites are configured (if needed)
  - [ ] Build settings are correct

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

- [ ] **Sign up/Login to Vercel**
  - Go to https://vercel.com
  - Sign up with GitHub account

- [ ] **Import Project**
  - Click "New Project"
  - Import your GitHub repository
  - Select the repository

- [ ] **Configure Project Settings**
  - **Framework Preset**: Next.js
  - **Root Directory**: `frontend`
  - **Build Command**: `npm run build` (default)
  - **Output Directory**: `.next` (default)
  - **Install Command**: `npm install` (default)

- [ ] **Add Environment Variables**
  - `NEXT_PUBLIC_API_URL` = `https://your-backend-domain.com`
  - Click "Add" for each variable

- [ ] **Deploy**
  - Click "Deploy"
  - Wait for build to complete
  - Note the deployment URL (e.g., `https://invictus-plan.vercel.app`)

#### Option B: Via Vercel CLI

- [ ] **Install Vercel CLI**
  ```bash
  npm i -g vercel
  ```

- [ ] **Login**
  ```bash
  vercel login
  ```

- [ ] **Deploy from frontend directory**
  ```bash
  cd frontend
  vercel
  ```

- [ ] **Follow prompts**
  - Set up and deploy? Yes
  - Which scope? (select your account)
  - Link to existing project? No (first time)
  - Project name? invictus-plan-frontend
  - Directory? ./
  - Override settings? No

- [ ] **Deploy to production**
  ```bash
  vercel --prod
  ```

### Step 3: Post-Deployment Verification

- [ ] **Test Frontend**
  - [ ] Visit deployment URL
  - [ ] Check browser console for errors
  - [ ] Verify API calls work
  - [ ] Test all major features

- [ ] **Configure Custom Domain** (Optional)
  - [ ] Go to Vercel project settings
  - [ ] Add custom domain
  - [ ] Configure DNS records
  - [ ] Wait for SSL certificate

- [ ] **Set up Automatic Deployments**
  - [ ] Verify auto-deploy from `main` branch is enabled
  - [ ] Test by pushing a small change

---

## 🔧 Backend Deployment Options

Choose ONE of the following options:

### Option 1: Railway (Recommended - Easiest)

**Pros**: Easy setup, automatic HTTPS, good Python support, $5 free credit/month  
**Cons**: Limited free tier resources

#### Steps:

- [ ] **Sign up at Railway**
  - Go to https://railway.app
  - Sign up with GitHub account

- [ ] **Create New Project**
  - Click "New Project"
  - Select "Deploy from GitHub repo"
  - Choose your repository

- [ ] **Configure Service**
  - Add a new service
  - Select "Empty Service"
  - Set root directory to `backend`

- [ ] **Configure Build & Start**
  - **Build Command**: 
    ```bash
    pip install -r requirements.txt && python -m spacy download en_core_web_sm
    ```
  - **Start Command**: 
    ```bash
    uvicorn main:app --host 0.0.0.0 --port $PORT
    ```

- [ ] **Add Environment Variables**
  - Go to Variables tab
  - Add all variables from `backend/env.template`:
    - `PERPLEXITY_API_KEY`
    - `UNPAYWALL_EMAIL`
    - `ALLOWED_ORIGINS` (include your Vercel frontend URL)
    - `SECRET_KEY`
    - `ENVIRONMENT=production`
    - `OLLAMA_BASE_URL` (if using cloud Ollama)
    - `OLLAMA_MODEL`
    - Any other required variables

- [ ] **Deploy**
  - Railway will automatically deploy
  - Wait for deployment to complete
  - Note the generated domain (e.g., `https://invictus-plan-production.up.railway.app`)

- [ ] **Configure Custom Domain** (Optional)
  - Go to Settings → Domains
  - Add custom domain
  - Configure DNS records

---

### Option 2: Render

**Pros**: Free tier, easy setup, automatic SSL  
**Cons**: Free tier spins down after inactivity (cold starts)

#### Steps:

- [ ] **Sign up at Render**
  - Go to https://render.com
  - Sign up with GitHub account

- [ ] **Create New Web Service**
  - Click "New +" → "Web Service"
  - Connect GitHub repository
  - Select repository and branch

- [ ] **Configure Service**
  - **Name**: invictus-plan-backend
  - **Environment**: Python 3
  - **Region**: Choose closest to your users
  - **Branch**: main
  - **Root Directory**: `backend`
  - **Build Command**: 
    ```bash
    pip install -r requirements.txt && python -m spacy download en_core_web_sm
    ```
  - **Start Command**: 
    ```bash
    uvicorn main:app --host 0.0.0.0 --port $PORT
    ```
  - **Instance Type**: Free (or paid for better performance)

- [ ] **Add Environment Variables**
  - Go to Environment section
  - Add all required variables (same as Railway)

- [ ] **Deploy**
  - Click "Create Web Service"
  - Render will build and deploy automatically
  - Note the generated URL (e.g., `https://invictus-plan-backend.onrender.com`)

---

### Option 3: Fly.io

**Pros**: Global edge deployment, generous free tier, good performance  
**Cons**: More complex setup, requires CLI

#### Steps:

- [ ] **Install Fly CLI**
  ```bash
  curl -L https://fly.io/install.sh | sh
  ```

- [ ] **Login**
  ```bash
  fly auth login
  ```

- [ ] **Create App**
  ```bash
  cd backend
  fly launch
  ```

- [ ] **Follow prompts**
  - App name? invictus-plan-backend
  - Region? (choose closest)
  - PostgreSQL? No (unless needed)
  - Redis? No (unless needed)

- [ ] **Configure `fly.toml`** (created automatically)
  ```toml
  app = "invictus-plan-backend"
  primary_region = "iad"

  [build]
    builder = "paketobuildpacks/builder:base"

  [http_service]
    internal_port = 8000
    force_https = true
    auto_stop_machines = false
    auto_start_machines = true
    min_machines_running = 1

  [[services]]
    protocol = "tcp"
    internal_port = 8000
  ```

- [ ] **Set Secrets**
  ```bash
  fly secrets set PERPLEXITY_API_KEY=your_key
  fly secrets set ALLOWED_ORIGINS=https://your-frontend.vercel.app
  fly secrets set SECRET_KEY=your_secret_key
  fly secrets set ENVIRONMENT=production
  # ... add all other secrets
  ```

- [ ] **Deploy**
  ```bash
  fly deploy
  ```

---

### Option 4: DigitalOcean App Platform

**Pros**: Reliable, scalable, good documentation  
**Cons**: Paid service (no free tier), starts at $5/month

#### Steps:

- [ ] **Sign up at DigitalOcean**
  - Go to https://www.digitalocean.com
  - Create account

- [ ] **Create App**
  - Go to App Platform
  - Click "Create App"
  - Connect GitHub repository

- [ ] **Configure App**
  - **Type**: Web Service
  - **Source**: `backend/`
  - **Build Command**: 
    ```bash
    pip install -r requirements.txt && python -m spacy download en_core_web_sm
    ```
  - **Run Command**: 
    ```bash
    uvicorn main:app --host 0.0.0.0 --port $PORT
    ```
  - **Environment**: Python 3.9

- [ ] **Add Environment Variables**
  - Add all required variables in Environment Variables section

- [ ] **Deploy**
  - Click "Create Resources"
  - Wait for deployment

---

### Option 5: AWS/GCP/Azure (Advanced)

For enterprise deployments, consider:
- **AWS**: Elastic Beanstalk, ECS, or Lambda
- **GCP**: Cloud Run or App Engine
- **Azure**: App Service or Container Instances

These require more setup but offer better scalability and control.

---

### Option 6: Docker Deployment (Universal)

- [ ] **Verify Dockerfile exists** in `backend/`
- [ ] **Build Docker image**
  ```bash
  cd backend
  docker build -t invictus-backend .
  ```
- [ ] **Test locally**
  ```bash
  docker run -p 8000:8000 --env-file .env invictus-backend
  ```
- [ ] **Deploy to container platform**
  - Docker Hub + any container platform
  - AWS ECS
  - Google Cloud Run
  - Azure Container Instances

---

## 🔗 Post-Deployment Integration

### Update Frontend API URL

- [ ] **Update Vercel Environment Variable**
  - Go to Vercel project settings
  - Update `NEXT_PUBLIC_API_URL` to your backend URL
  - Redeploy frontend

### Update Backend CORS

- [ ] **Update Backend Environment Variable**
  - Go to your backend hosting platform
  - Update `ALLOWED_ORIGINS` to include your Vercel frontend URL
  - Example: `ALLOWED_ORIGINS=https://invictus-plan.vercel.app`
  - Restart backend service

### Test Integration

- [ ] **Test API Connection**
  - Open frontend in browser
  - Open browser DevTools → Network tab
  - Try a feature that calls the API
  - Verify requests succeed (status 200)
  - Check for CORS errors

- [ ] **Test All Features**
  - [ ] Protein search
  - [ ] Publication retrieval
  - [ ] Protocol extraction
  - [ ] Model comparison
  - [ ] Verification dashboard

---

## 🔒 Security Checklist

### Environment Variables

- [ ] All `.env` files are in `.gitignore`
- [ ] No secrets committed to Git
- [ ] Environment variables set in hosting platforms
- [ ] Different keys for dev/staging/prod
- [ ] API keys rotated and secure

### CORS Configuration

- [ ] `ALLOWED_ORIGINS` only includes frontend domain(s)
- [ ] No `localhost` in production `ALLOWED_ORIGINS`
- [ ] All origins use HTTPS
- [ ] CORS tested from frontend

### HTTPS/SSL

- [ ] HTTPS enabled on frontend (Vercel automatic)
- [ ] HTTPS enabled on backend (platform automatic)
- [ ] Custom domains have SSL certificates
- [ ] HTTP redirects to HTTPS

### Security Headers

- [ ] Frontend security headers configured (in `vercel.json`)
- [ ] Backend security headers configured (if applicable)
- [ ] Test with https://securityheaders.com

### API Security

- [ ] Rate limiting implemented (recommended)
- [ ] Request size limits configured
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose sensitive info

### Monitoring

- [ ] Error tracking set up (Sentry, etc.)
- [ ] Logging configured
- [ ] Uptime monitoring set up (UptimeRobot, etc.)
- [ ] Alerts configured for critical issues

---

## 📊 Monitoring & Availability

### Health Checks

- [ ] **Backend health check endpoint** (`GET /`)
  - Configure platform to use this for health checks
  - Test: `curl https://your-backend.com/`

### Monitoring Setup

- [ ] **Uptime Monitoring** (Choose one)
  - [ ] UptimeRobot (free: 50 monitors)
  - [ ] Better Uptime (open-source)
  - [ ] Pingdom (paid)

- [ ] **Error Tracking** (Choose one)
  - [ ] Sentry (free tier available)
  - [ ] LogRocket (paid)
  - [ ] Rollbar (paid)

- [ ] **Logging**
  - [ ] Platform logs reviewed (Vercel, Railway, etc.)
  - [ ] Structured logging configured
  - [ ] Log retention policy set

### Performance Monitoring

- [ ] **Frontend Performance**
  - [ ] Vercel Analytics enabled (optional)
  - [ ] Core Web Vitals monitored
  - [ ] Lighthouse score checked

- [ ] **Backend Performance**
  - [ ] Response time monitoring
  - [ ] API endpoint performance tracked
  - [ ] Database query performance (if applicable)

---

## 🧪 Testing Checklist

### Pre-Deployment Testing

- [ ] **Local Testing**
  - [ ] All features work locally
  - [ ] No console errors
  - [ ] API endpoints respond correctly
  - [ ] Error handling works

### Post-Deployment Testing

- [ ] **Frontend Testing**
  - [ ] Homepage loads
  - [ ] All pages accessible
  - [ ] API calls succeed
  - [ ] Error states display correctly
  - [ ] Loading states work
  - [ ] Mobile responsive

- [ ] **Backend Testing**
  - [ ] Health check endpoint works
  - [ ] All API endpoints accessible
  - [ ] CORS working correctly
  - [ ] External API integrations work (Perplexity, etc.)
  - [ ] Error responses are correct

- [ ] **Integration Testing**
  - [ ] Frontend → Backend communication works
  - [ ] CORS allows frontend requests
  - [ ] Authentication works (if implemented)
  - [ ] File uploads work (if applicable)

---

## 📝 Documentation

- [ ] **Update README.md**
  - [ ] Add production URLs
  - [ ] Update setup instructions
  - [ ] Add deployment links

- [ ] **Update DEPLOYMENT.md**
  - [ ] Document any deployment-specific configs
  - [ ] Add troubleshooting section

- [ ] **Create Runbook** (Optional)
  - [ ] Common issues and solutions
  - [ ] Rollback procedures
  - [ ] Emergency contacts

---

## 🚨 Rollback Plan

- [ ] **Know how to rollback**
  - [ ] Vercel: Previous deployments in dashboard
  - [ ] Railway: Rollback in dashboard
  - [ ] Render: Previous deployments available
  - [ ] Fly.io: `fly releases` and `fly releases rollback`

- [ ] **Test rollback procedure**
  - [ ] Know where to find previous deployments
  - [ ] Practice rollback in staging (if available)

---

## ✅ Final Verification

### Before Going Live

- [ ] All checklist items completed
- [ ] Security review done
- [ ] Performance tested
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team notified of deployment

### Post-Deployment

- [ ] Monitor for 24-48 hours
- [ ] Check error rates
- [ ] Review performance metrics
- [ ] Gather user feedback
- [ ] Document any issues

---

## 📞 Support & Resources

### Platform Documentation

- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **Render**: https://render.com/docs
- **Fly.io**: https://fly.io/docs

### Security Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **FastAPI Security**: https://fastapi.tiangolo.com/tutorial/security/
- **Next.js Security**: https://nextjs.org/docs/advanced-features/security-headers

### Monitoring Tools

- **UptimeRobot**: https://uptimerobot.com
- **Sentry**: https://sentry.io
- **Better Uptime**: https://betteruptime.com

---

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ Frontend accessible at Vercel URL
- ✅ Backend accessible at hosting platform URL
- ✅ Frontend can communicate with backend
- ✅ All features work end-to-end
- ✅ No CORS errors
- ✅ HTTPS enabled everywhere
- ✅ Security headers configured
- ✅ Monitoring active
- ✅ Error tracking working
- ✅ Documentation updated

---

**Last Updated**: [Current Date]  
**Maintained By**: [Your Name/Team]

