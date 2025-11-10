# Railway Deployment Guide

This guide explains how to deploy the backend to Railway using Docker.

## Prerequisites

1. A Railway account (sign up at https://railway.app)
2. Railway CLI installed (optional, for local testing)
3. Git repository with your code

## Deployment Steps

### 1. Connect Your Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or GitLab/Bitbucket)
4. Select your repository
5. Railway will automatically detect the Dockerfile in the `backend/` directory

### 2. Configure Build Settings

Railway will automatically:
- Detect the Dockerfile in the `backend/` directory
- Use the `railway.json` configuration
- Build and deploy using Docker

**Note:** Make sure Railway is looking in the `backend/` directory. You may need to:
- Set the root directory to `backend/` in Railway settings, OR
- Move the Dockerfile to the root (not recommended if you have a monorepo)

### 3. Set Environment Variables

In Railway dashboard, go to your service → Variables tab and add:

#### Required Variables:
```
PERPLEXITY_API_KEY=your_perplexity_api_key_here
UNPAYWALL_EMAIL=your_email@example.com
```

#### Optional but Recommended:
```
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ENVIRONMENT=production
LOG_LEVEL=INFO
MAX_COMPARE_MODELS=5
MAX_CONCURRENT_MODELS=3
```

#### For AI Models (if using cloud services):
```
OLLAMA_BASE_URL=https://your-ollama-instance.com
OLLAMA_MODEL=llama3:8b
ENABLE_MODEL_COMPARISON=false
```

#### For Redis (if using):
```
REDIS_URL=redis://your-redis-instance:6379
REDIS_PASSWORD=your_password
```

**Note:** Railway automatically sets the `PORT` environment variable - you don't need to set it manually.

### 4. Deploy

Railway will automatically:
1. Build the Docker image from the Dockerfile
2. Install all dependencies
3. Download the spaCy model
4. Start the application using the entrypoint script

### 5. Verify Deployment

1. Check the deployment logs in Railway dashboard
2. Visit your service URL (Railway provides this automatically)
3. Test the health endpoint: `https://your-service.railway.app/`

## Dockerfile Details

The Dockerfile:
- Uses Python 3.9 slim base image
- Installs system dependencies (build tools, curl)
- Installs Python dependencies from `requirements.txt`
- Downloads spaCy English model
- Creates a non-root user for security
- Uses an entrypoint script that handles Railway's PORT variable
- Includes health checks

## Troubleshooting

### Build Fails

1. **Check logs**: View build logs in Railway dashboard
2. **Dependencies**: Ensure all packages in `requirements.txt` are available
3. **Memory**: Railway free tier has memory limits - if build fails, consider upgrading

### Application Won't Start

1. **Check environment variables**: Ensure all required variables are set
2. **Check logs**: View runtime logs in Railway dashboard
3. **Port binding**: The entrypoint script handles PORT automatically, but verify it's working
4. **Health check**: The health check runs on `/` endpoint - ensure it's responding

### Dependencies Issues

The Dockerfile installs dependencies in a specific order:
1. System packages first
2. Python packages second
3. spaCy model third

If you encounter dependency issues:
- Check `requirements.txt` for version conflicts
- Verify Python 3.9 compatibility
- Check build logs for specific error messages

### spaCy Model Download Fails

If the spaCy model download fails during build:
- The build will fail - check logs
- You may need to increase build timeout in Railway settings
- Consider downloading the model at runtime instead (not recommended)

## Local Testing

To test the Docker build locally:

```bash
cd backend
docker build -t invictus-backend .
docker run -p 8000:8000 -e PORT=8000 invictus-backend
```

## Railway-Specific Features

### Automatic Deployments
- Railway automatically deploys on every push to your main branch
- You can configure branch-based deployments in Railway settings

### Custom Domain
- Railway provides a default `.railway.app` domain
- You can add a custom domain in Railway settings

### Environment Variables
- Set variables in Railway dashboard
- Variables are encrypted and secure
- Changes require redeployment

### Logs
- View real-time logs in Railway dashboard
- Logs are retained for a limited time (depends on plan)

## Cost Considerations

- Railway offers a free tier with usage limits
- Docker builds use build minutes
- Running services use compute resources
- Monitor usage in Railway dashboard

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check Railway status: https://status.railway.app

