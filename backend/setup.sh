#!/bin/bash
# Backend setup script

echo "Setting up backend environment..."

# Activate virtual environment
source ../venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Download scispaCy model
python -m spacy download en_core_sci_sm

echo "Backend setup complete!"
echo "Create a .env file in the backend directory with:"
echo "OLLAMA_BASE_URL=http://localhost:11434"
echo "OLLAMA_MODEL=llama3:8b"






