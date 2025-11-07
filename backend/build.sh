#!/bin/bash
set -e

# Check Python version
echo "=== Python Version Check ==="
python --version
python3 --version 2>/dev/null || true

# The issue: Render is using Python 3.13.4 by default
# but blis (spacy dependency) doesn't compile with Python 3.13
# Solution: Use pre-built wheels or ensure Python 3.9

# Try to use Python 3.9 if available
if command -v python3.9 &> /dev/null; then
    PYTHON_CMD=python3.9
    echo "Using python3.9"
elif python --version 2>&1 | grep -qE "3\.9\."; then
    PYTHON_CMD=python
    echo "Using python (3.9.x detected)"
else
    PYTHON_CMD=python
    echo "WARNING: Python 3.9 not found, using default python"
    echo "This may cause blis compilation to fail with Python 3.13"
    python --version
fi

# Install dependencies
echo "=== Installing dependencies ==="
$PYTHON_CMD -m pip install --upgrade pip
$PYTHON_CMD -m pip install -r requirements.txt
$PYTHON_CMD -m spacy download en_core_web_sm

echo "=== Build completed successfully! ==="

