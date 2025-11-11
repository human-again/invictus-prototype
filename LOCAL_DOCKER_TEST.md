# Local Docker Testing Guide

Before deploying to Railway, test your Docker setup locally to catch any issues early.

## Prerequisites

1. **Docker Desktop** installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Make sure Docker Desktop is running (you should see the Docker icon in your menu bar)

2. **Verify Docker is running:**
   ```bash
   docker --version
   docker ps
   ```

## Step 1: Build the Docker Image

```bash
cd backend
docker build -t invictus-backend .
```

**Expected output:**
- Should build successfully without errors
- Takes 3-5 minutes (downloads dependencies, spaCy model)
- Final line should be: `Successfully tagged invictus-backend:latest`

## Step 2: Test the Container Locally

### Basic Test (with default port)

```bash
docker run -p 8000:8000 \
  -e PORT=8000 \
  -e PERPLEXITY_API_KEY=your_test_key \
  -e UNPAYWALL_EMAIL=your_email@example.com \
  invictus-backend
```

### Test with Environment File

Create a test `.env` file (don't commit this):

```bash
# In backend directory
cat > .env.test << EOF
PERPLEXITY_API_KEY=your_test_key
UNPAYWALL_EMAIL=your_email@example.com
ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=development
LOG_LEVEL=INFO
EOF
```

Then run:
```bash
docker run -p 8000:8000 --env-file .env.test invictus-backend
```

## Step 3: Verify the Application

1. **Health Check:**
   ```bash
   curl http://localhost:8000/
   ```
   Should return: `{"status":"ok"}`

2. **API Documentation:**
   Open in browser: http://localhost:8000/docs
   - Should show FastAPI Swagger UI

3. **Test an Endpoint:**
   ```bash
   curl http://localhost:8000/protein/search?query=insulin
   ```

## Step 4: Check Logs

In another terminal, view container logs:
```bash
docker ps  # Get container ID
docker logs <container_id>
```

Or if running in foreground, logs will appear in the terminal.

## Step 5: Test with Railway PORT Variable

Railway sets a dynamic PORT. Test this:

```bash
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e PERPLEXITY_API_KEY=your_test_key \
  -e UNPAYWALL_EMAIL=your_email@example.com \
  invictus-backend
```

Then test:
```bash
curl http://localhost:3000/
```

## Common Issues & Solutions

### Issue: "Cannot connect to Docker daemon"

**Solution:**
- Start Docker Desktop
- Wait for it to fully start (whale icon should be steady)
- Try `docker ps` to verify

### Issue: "entrypoint.sh: not found"

**Solution:**
- Verify `entrypoint.sh` exists in `backend/` directory
- Check it's executable: `chmod +x backend/entrypoint.sh`
- Verify it's not in `.dockerignore`

### Issue: Build fails on spaCy download

**Solution:**
- Check internet connection
- spaCy download can take time - be patient
- If it times out, the build will fail (this is expected)

### Issue: Container starts but returns errors

**Solution:**
- Check logs: `docker logs <container_id>`
- Verify environment variables are set
- Check if required services (like Perplexity API) are accessible

### Issue: Port already in use

**Solution:**
- Use a different port: `docker run -p 8001:8000 ...`
- Or stop the existing container: `docker stop <container_id>`

## Step 6: Clean Up After Testing

```bash
# Stop running containers
docker ps
docker stop <container_id>

# Remove test image (optional)
docker rmi invictus-backend

# Remove test env file
rm backend/.env.test
```

## Verification Checklist

Before deploying to Railway, ensure:

- [ ] Docker build completes successfully
- [ ] Container starts without errors
- [ ] Health endpoint (`/`) returns `{"status":"ok"}`
- [ ] API docs accessible at `/docs`
- [ ] Application responds to PORT environment variable
- [ ] No errors in container logs
- [ ] All required environment variables work

## Next Steps

Once local testing passes:

1. **Commit your changes:**
   ```bash
   git add backend/Dockerfile backend/entrypoint.sh
   git commit -m "Fix Dockerfile: copy entrypoint.sh before COPY . ."
   git push origin main
   ```

2. **Deploy to Railway:**
   - Railway will automatically rebuild on push
   - Monitor the build logs in Railway dashboard
   - Should build successfully now!

## Quick Test Script

Save this as `test-docker.sh` in the backend directory:

```bash
#!/bin/bash
set -e

echo "Building Docker image..."
docker build -t invictus-backend .

echo "Starting container..."
docker run -d \
  -p 8000:8000 \
  -e PORT=8000 \
  -e PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-test_key} \
  -e UNPAYWALL_EMAIL=${UNPAYWALL_EMAIL:-test@example.com} \
  --name invictus-test \
  invictus-backend

echo "Waiting for container to start..."
sleep 5

echo "Testing health endpoint..."
curl -f http://localhost:8000/ || echo "Health check failed!"

echo "Container is running. Check logs with: docker logs invictus-test"
echo "Stop with: docker stop invictus-test && docker rm invictus-test"
```

Make it executable:
```bash
chmod +x backend/test-docker.sh
```

Run it:
```bash
cd backend
./test-docker.sh
```

