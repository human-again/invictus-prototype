FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Create entrypoint script to handle PORT variable
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    chown appuser:appuser /app/entrypoint.sh

USER appuser

# Run application using entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

