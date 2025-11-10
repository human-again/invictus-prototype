# Protein Synthesis AI Agent Prototype

An AI-powered web application that retrieves protein information from UniProt, finds related publications, extracts and summarizes the 'Materials and Methods' section for protein synthesis, and verifies accuracy on a reference dataset.

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (TypeScript, React, Tailwind CSS)
- **AI Models**: Ollama (local LLM inference)
- **NLP**: scispaCy, spaCy
- **APIs**: UniProt REST API, Perplexity.ai (primary), PubMed/PMC (NCBI E-utilities), Semantic Scholar (fallback)

## Features

- 🔍 Search proteins in UniProt database
- 📚 Retrieve related publications from Perplexity Search API (academic mode, domain-filtered) ([docs](https://docs.perplexity.ai/guides/search-quickstart)), with PubMed/PMC and Semantic Scholar as fallbacks
- 🤖 Extract synthesis protocols using local AI models (Ollama)
- 📊 Entity extraction (chemicals, equipment, conditions)
- ✅ Protocol verification against reference dataset
- 📈 Verification dashboard with accuracy metrics

## Prerequisites

### System Requirements

- Python 3.9+ 
- Node.js 18+ and npm
- At least 8GB RAM (16GB+ recommended for larger models)
- Optional: GPU for faster AI inference

### Ollama Installation

The application uses Ollama for local AI model inference. You must install and configure Ollama before running the application.

#### Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

#### Download AI Models

Choose one of the following models based on your system resources:

```bash
# Recommended: Balanced performance (requires ~8GB RAM)
ollama pull llama3:8b

# Alternative: Faster, smaller model (requires ~6GB RAM)
ollama pull mistral:7b

# Best quality: Larger model (requires ~40GB RAM/VRAM)
ollama pull llama3:70b
```

#### Verify Ollama Installation

```bash
# Check if Ollama is running
ollama list

# Test the model
ollama run llama3:8b "Hello, world!"
```

The Ollama service typically runs on `http://localhost:11434`. Make sure it's running before starting the backend.

## Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   # From project root
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Download spaCy model:**
   ```bash
   python -m spacy download en_core_web_sm
   # If scispaCy model is available:
   python -m spacy download en_core_sci_sm
   ```

5. **Create environment file:**
   ```bash
   # Create .env file in backend directory
   touch .env
   ```
   
   Edit `.env` and set:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3:8b
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   UNPAYWALL_EMAIL=your_email@example.com
   ```
   
   **Getting a Perplexity API Key:**
   - Sign up at https://www.perplexity.ai/
   - Navigate to Account Settings → API
   - Generate an API key
   - Copy the key to your `.env` file
   
   **Note:** The application will fallback to PubMed/Semantic Scholar if Perplexity API key is not configured.

6. **Run the backend:**
   ```bash
   uvicorn main:app --reload
   ```
   
   Backend will be available at `http://localhost:8000`
   API documentation at `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file (optional):**
   ```bash
   # Create .env.local if you need to customize API URL
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   Frontend will be available at `http://localhost:3000`

## Usage

1. **Start Ollama** (if not running automatically):
   ```bash
   ollama serve
   ```

2. **Start the backend:**
   ```bash
   cd backend
   source ../venv/bin/activate
   uvicorn main:app --reload
   ```

3. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Open the application:**
   Navigate to `http://localhost:3000` in your browser

5. **Search for a protein:**
   - Type a protein name (e.g., "hemoglobin", "insulin")
   - Select from the dropdown
   - View related publications
   - Click "Extract Protocol" to extract synthesis methods

6. **View verification dashboard:**
   - Click the "Verification" tab
   - View accuracy metrics and validation results

## API Endpoints

### Protein Search
```
GET /protein/search?query={protein_name}
```

### Publications
```
GET /publications/{uniprot_id}?protein_name={name}&methodology_focus={purification|synthesis|expression|general}
```
Uses Perplexity.ai as primary source, falls back to PubMed/PMC and Semantic Scholar if no results found. Supports methodology focus (default: purification).

### Extract Methods
```
POST /extract_methods
Body: {
  "publication_text": "...",
  "protein_name": "..."
}
```

### Extract Entities
```
POST /extract_entities
Body: {
  "text": "..."
}
```

### Summarize Protocol
```
POST /summarize_protocol
Body: {
  "extracted_methods": "..."
}
```

### Verify Protocol
```
POST /verify_protocol
Body: {
  "ai_protocol": "...",
  "protein_name": "...",
  "uniprot_id": "..."
}
```

### Verification Report
```
GET /verification/report
```

Full API documentation available at `http://localhost:8000/docs` when backend is running.

## Reference Dataset

The reference dataset (`backend/data/reference.csv`) contains 20 predefined proteins with validated synthesis protocols:
- Hemoglobin, Insulin, GFP, Lysozyme, Myoglobin
- Albumin, Cytochrome C, Trypsin, Collagen, Fibrinogen
- Actin, Tubulin, Catalase, Peroxidase, Lactate dehydrogenase
- Ribonuclease, Chymotrypsin, Elastase, Carbonic anhydrase

## Testing

### End-to-End Testing

Run the end-to-end test script:
```bash
cd backend
python tests/test_e2e.py
```

This will test the full pipeline for sample proteins and log performance metrics.

### Performance Metrics

The system validates:
- Response time < 5s per step
- Extraction accuracy >= 70%
- End-to-end success >= 80%

## Troubleshooting

### Ollama Connection Issues

If you see "Ollama service not available" errors:

1. **Check if Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **Start Ollama manually:**
   ```bash
   ollama serve
   ```

3. **Verify model is downloaded:**
   ```bash
   ollama list
   ```

### scispaCy Model Not Found

If `en_core_sci_sm` is not available, the application will fall back to `en_core_web_sm`. To install scispaCy models:

```bash
pip install https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.3/en_core_sci_sm-0.5.3.tar.gz
```

### Frontend API Connection Issues

1. Ensure backend is running on `http://localhost:8000`
2. Check CORS settings in `backend/main.py`
3. Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local` if using custom URL

## Project Structure

```
Invictus-plan/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment template
│   ├── services/            # Business logic
│   │   ├── uniprot.py       # UniProt API integration
│   │   ├── publications.py  # Publication retrieval (Perplexity/PubMed/Semantic Scholar)
│   │   ├── perplexity.py    # Perplexity.ai API integration
│   │   ├── extraction.py    # Text extraction and cleaning
│   │   ├── ai_models.py      # Ollama integration
│   │   └── verification.py  # Protocol verification
│   ├── data/
│   │   └── reference.csv    # Reference dataset
│   └── tests/
│       └── test_e2e.py      # End-to-end tests
├── frontend/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                 # API client
│   └── hooks/               # React hooks
└── README.md                # This file
```

## Development

### Backend Development

- FastAPI auto-reloads on code changes when using `--reload`
- API documentation available at `/docs`
- Environment variables loaded from `.env`

### Frontend Development

- Next.js hot-reloads on code changes
- TypeScript for type safety
- Tailwind CSS for styling

## GitHub Setup

### Initial Setup

1. **Initialize Git repository** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub repository**:
   - Go to [GitHub](https://github.com) and create a new repository
   - Don't initialize with README (you already have one)

3. **Connect and push**:
   ```bash
   git remote add origin https://github.com/yourusername/invictus-plan.git
   git branch -M main
   git push -u origin main
   ```

### Environment Variables

**Important**: Never commit `.env` files! They are already in `.gitignore`.

1. **Backend**: Copy `backend/env.template` to `backend/.env` and fill in your values
2. **Frontend**: Copy `frontend/env.template` to `frontend/.env.local` and fill in your values

See the template files for required environment variables.

## Deployment

### Quick Start

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

#### Frontend (Vercel)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set root directory to `frontend`
4. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`
5. Deploy!

#### Backend Options

**Recommended platform:**
- **Railway** (easiest, good free tier, Docker support) - See `backend/railway.json` and `RAILWAY_DEPLOYMENT.md`

**Alternative platforms:**
- **Fly.io** (global edge, generous free tier)
- **DigitalOcean** (reliable, paid)

**Docker deployment** (universal):
```bash
cd backend
docker build -t invictus-backend .
docker run -p 8000:8000 --env-file .env invictus-backend
```

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed Railway deployment instructions, or [DEPLOYMENT.md](./DEPLOYMENT.md) for other platform options.

### Security Checklist

Before deploying to production:

- [ ] All `.env` files are in `.gitignore` (already done)
- [ ] Environment variables are set in hosting platform (not in code)
- [ ] CORS is configured to only allow your frontend domain
- [ ] API keys are rotated and secure
- [ ] HTTPS is enabled (automatic on most platforms)
- [ ] Security headers are configured (see `frontend/vercel.json`)
- [ ] Rate limiting is considered (add if needed)
- [ ] Monitoring/alerting is set up

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive security guidelines.

## License

This is a prototype project for demonstration purposes.

## Acknowledgments

- UniProt for protein database
- Perplexity.ai for intelligent publication search (primary)
- PubMed/PMC (NCBI E-utilities) for publication access (fallback)
- Semantic Scholar for publication fallback access
- Unpaywall API for open access PDF retrieval
- Ollama for local LLM inference
- scispaCy for biomedical NLP

