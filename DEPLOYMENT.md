# Deployment Guide

This guide covers deploying the Invictus-plan application to production, including frontend deployment to Vercel and backend deployment options.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Preparing for GitHub](#preparing-for-github)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Backend Deployment Options](#backend-deployment-options)
5. [Security Considerations](#security-considerations)
6. [Availability & Monitoring](#availability--monitoring)
7. [Post-Deployment Checklist](#post-deployment-checklist)

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account
- [ ] Vercel account (free tier available)
- [ ] Backend hosting account (choose from options below)
- [ ] API keys for external services:
  - Perplexity API key
  - (Optional) OpenAI/Anthropic API keys if using cloud LLMs
- [ ] Domain name (optional, but recommended)

## Preparing for GitHub

### 1. Initialize Git Repository

```bash
# If not already initialized
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Protein Synthesis AI Agent"

# Add remote (replace with your GitHub repo URL)
git remote add origin https://github.com/yourusername/invictus-plan.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 2. Environment Variables Setup

**Never commit `.env` files!** They are already in `.gitignore`.

1. Copy environment templates:
   ```bash
   # Backend
   cp backend/env.template backend/.env
   
   # Frontend
   cp frontend/env.template frontend/.env.local
   ```

2. Fill in your values in the `.env` files (see templates for required variables)

### 3. GitHub Secrets (for CI/CD)

If you plan to use GitHub Actions, add these secrets in GitHub Settings → Secrets:
- `PERPLEXITY_API_KEY`
- `UNPAYWALL_EMAIL`
- Any other sensitive credentials

## Frontend Deployment (Vercel)

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select the repository

2. **Configure Project**
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (or leave default)
   - **Output Directory**: `.next` (or leave default)
   - **Install Command**: `npm install` (or leave default)

3. **Environment Variables**
   Add these in Vercel project settings:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically deploy on every push to main branch

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No (first time)
# - Project name? invictus-plan-frontend
# - Directory? ./
# - Override settings? No

# For production deployment
vercel --prod
```

### Vercel Configuration

The `frontend/vercel.json` file is already configured with:
- Security headers (XSS protection, frame options, etc.)
- API rewrites (if needed)
- Build settings

**Update the API rewrite URL** in `vercel.json` to point to your backend domain.

## Backend Deployment Options

### Option 1: Railway (Recommended for Python/FastAPI)

**Pros**: Easy setup, automatic HTTPS, good for Python apps, free tier available
**Cons**: Limited free tier resources

#### Steps:

1. **Sign up** at [railway.app](https://railway.app)

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Service**
   - Add a new service
   - Select "Empty Service"
   - Set root directory to `backend`

4. **Configure Build & Start**
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt && python -m spacy download en_core_web_sm
     ```
   - **Start Command**: 
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```

5. **Environment Variables**
   Add all variables from `backend/env.template`:
   ```
   PERPLEXITY_API_KEY=your_key
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   OLLAMA_BASE_URL=https://your-ollama-service.com  # If using cloud Ollama
   # ... etc
   ```

6. **Generate Domain**
   - Railway automatically provides a domain
   - Or add a custom domain in settings

### Option 2: Fly.io

**Pros**: Global edge deployment, good performance, generous free tier
**Cons**: More complex setup

#### Steps:

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**
   ```bash
   fly auth login
   ```

3. **Create App**
   ```bash
   cd backend
   fly launch
   ```

4. **Configure `fly.toml`** (created automatically, edit as needed):
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

5. **Set Secrets**
   ```bash
   fly secrets set PERPLEXITY_API_KEY=your_key
   fly secrets set ALLOWED_ORIGINS=https://your-frontend.vercel.app
   # ... etc
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

### Option 3: DigitalOcean App Platform

**Pros**: Reliable, scalable, good documentation
**Cons**: Paid service (no free tier)

#### Steps:

1. **Create App** in DigitalOcean dashboard
2. **Connect GitHub** repository
3. **Configure**:
   - **Type**: Web Service
   - **Source**: `backend/`
   - **Build Command**: `pip install -r requirements.txt && python -m spacy download en_core_web_sm`
   - **Run Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Add Environment Variables**
5. **Deploy**

### Option 4: AWS/GCP/Azure (Advanced)

For enterprise deployments, consider:
- **AWS**: Elastic Beanstalk, ECS, or Lambda
- **GCP**: Cloud Run or App Engine
- **Azure**: App Service or Container Instances

These require more setup but offer better scalability and control.

### Docker Deployment (Universal)

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `backend/.dockerignore`:
```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv/
env/
.env
*.log
```

Build and run:
```bash
cd backend
docker build -t invictus-backend .
docker run -p 8000:8000 --env-file .env invictus-backend
```

## Security Considerations

### 1. Environment Variables

- ✅ **Never commit** `.env` files
- ✅ Use platform secrets/environment variables
- ✅ Rotate API keys regularly
- ✅ Use different keys for dev/staging/prod

### 2. CORS Configuration

- ✅ Set `ALLOWED_ORIGINS` to your frontend domain(s) only
- ✅ Remove `localhost` from production `ALLOWED_ORIGINS`
- ✅ Use HTTPS in production

### 3. API Security

- ✅ Add rate limiting (consider using `slowapi` or `fastapi-limiter`)
- ✅ Add API key authentication for sensitive endpoints
- ✅ Implement request validation
- ✅ Add request size limits

### 4. HTTPS/SSL

- ✅ All platforms provide automatic HTTPS
- ✅ Use custom domain with SSL certificate
- ✅ Enable HSTS headers

### 5. Secrets Management

- ✅ Use platform secrets management (Vercel, Railway, etc.)
- ✅ Never log sensitive data
- ✅ Use environment-specific configurations

### 6. Dependencies

- ✅ Keep dependencies updated
- ✅ Use `pip-audit` or `safety` to check for vulnerabilities
- ✅ Review dependency licenses

### 7. Input Validation

- ✅ Validate all user inputs
- ✅ Sanitize data before processing
- ✅ Implement request size limits

### 8. Logging

- ✅ Don't log sensitive information
- ✅ Use structured logging
- ✅ Monitor error rates

## Availability & Monitoring

### 1. Health Checks

The backend already has a health check endpoint:
```
GET / → {"status": "ok"}
```

Configure your hosting platform to use this for health checks.

### 2. Monitoring Options

**Free Options:**
- **UptimeRobot**: Monitor uptime (free tier: 50 monitors)
- **Better Uptime**: Open-source uptime monitoring
- **Sentry**: Error tracking (free tier available)

**Paid Options:**
- **Datadog**: Full APM and monitoring
- **New Relic**: Application performance monitoring
- **LogRocket**: Frontend monitoring

### 3. Logging

- Use platform logging (Vercel, Railway, Fly.io all provide logs)
- Consider structured logging with JSON format
- Set up log aggregation if needed

### 4. Error Tracking

Add error tracking to backend:

```python
# In main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if os.getenv("ENVIRONMENT") == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0,
    )
```

### 5. Database Backups (if using database)

- Set up automated backups
- Test restore procedures
- Store backups in separate location

### 6. CDN (Optional)

For static assets:
- Vercel automatically provides CDN
- Consider Cloudflare for additional caching

## Post-Deployment Checklist

### Frontend (Vercel)

- [ ] Verify deployment URL is accessible
- [ ] Check that API calls work (check browser console)
- [ ] Test all major features
- [ ] Verify environment variables are set
- [ ] Check security headers (use securityheaders.com)
- [ ] Set up custom domain (if applicable)
- [ ] Configure automatic deployments from main branch

### Backend

- [ ] Verify API is accessible
- [ ] Test all endpoints (use `/docs` for Swagger UI)
- [ ] Verify CORS is working (test from frontend)
- [ ] Check environment variables are set correctly
- [ ] Test health check endpoint
- [ ] Verify external API integrations (Perplexity, etc.)
- [ ] Set up monitoring/alerting
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL certificate (usually automatic)

### Integration

- [ ] Frontend can connect to backend
- [ ] CORS is properly configured
- [ ] All API endpoints work from frontend
- [ ] Error handling works correctly
- [ ] Loading states display properly

### Security

- [ ] `.env` files are not in repository
- [ ] API keys are in platform secrets, not code
- [ ] CORS only allows frontend domain
- [ ] HTTPS is enabled everywhere
- [ ] Security headers are set
- [ ] Rate limiting is configured (if applicable)

### Documentation

- [ ] Update README with production URLs
- [ ] Document any deployment-specific configurations
- [ ] Create runbook for common issues

## Troubleshooting

### Frontend Issues

**Build fails:**
- Check Node.js version compatibility
- Verify all dependencies are in `package.json`
- Check for TypeScript errors

**API calls fail:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS configuration in backend
- Verify backend is accessible

### Backend Issues

**Deployment fails:**
- Check Python version (3.9+)
- Verify all dependencies in `requirements.txt`
- Check build logs for errors

**API not accessible:**
- Verify port configuration
- Check firewall/security group settings
- Verify health check endpoint

**CORS errors:**
- Check `ALLOWED_ORIGINS` includes frontend URL
- Verify frontend URL matches exactly (including https://)
- Check browser console for specific CORS error

## Cost Estimation

### Free Tier Options

- **Vercel**: Free tier includes 100GB bandwidth, unlimited requests
- **Railway**: $5 free credit/month
- **Fly.io**: 3 shared VMs free

### Paid Options (Approximate)

- **Vercel Pro**: $20/month
- **Railway**: $5-20/month depending on usage
- **Fly.io**: $1.94/month per VM
- **DigitalOcean**: $5-12/month

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions)
2. Add automated testing
3. Set up staging environment
4. Configure monitoring and alerting
5. Set up backup procedures
6. Document API for external users
7. Consider adding authentication/authorization
8. Implement rate limiting
9. Add API versioning
10. Set up analytics

## Support

For issues or questions:
- Check platform documentation
- Review application logs
- Test locally first
- Check GitHub issues (if public)

