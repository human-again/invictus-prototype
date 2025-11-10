#!/bin/sh
# Entrypoint script for Railway deployment
# Handles PORT environment variable (Railway sets this automatically)

# Default to port 8000 if PORT is not set
PORT=${PORT:-8000}

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port $PORT

