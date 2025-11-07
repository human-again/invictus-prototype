from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from services import uniprot, publications, extraction, ai_models, verification
from services.model_registry import get_registry
from services.prompts import get_prompt_manager
from services.cache import get_cache, CACHE_KEYS
from services.metrics import get_metrics_tracker
from services.validation import validate_json_string
from services.hallucination import detect_hallucinations, compute_consensus
from services.truncation import truncate_content
from services.comparison import generate_comparison_report
from services.jobs import get_job_queue
import logging
import sys
import os
import asyncio
import json
import re
from typing import List, Optional, Dict, Any
import concurrent.futures

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

app = FastAPI(title="Protein Synthesis AI Agent API", version="1.0.0")

# Configure CORS for frontend
# Get allowed origins from environment variable (comma-separated)
# Default to localhost for development
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/protein/search")
async def search_protein(query: str = Query(..., description="Protein name or identifier to search")):
    """Search for proteins in UniProt database"""
    results = uniprot.search_proteins(query)
    return {"results": results}

@app.get("/publications/{uniprot_id}")
async def get_publications(
    uniprot_id: str, 
    protein_name: str = Query("", description="Optional protein name for better search results"),
    methodology_focus: str = Query("purification", description="Methodology focus: 'purification', 'synthesis', 'expression', or 'general'")
):
    """Get publications related to a UniProt ID
    Focused on specific methodology (default: purification)
    
    Examples:
    - purification: Find papers about protein purification methods
    - synthesis: Find papers about protein synthesis
    - expression: Find papers about protein expression
    - general: Find papers about any protein methodology
    """
    # Validate methodology_focus
    valid_focuses = ["purification", "synthesis", "expression", "general"]
    if methodology_focus not in valid_focuses:
        methodology_focus = "purification"  # Default to purification
    
    results = publications.get_publications(uniprot_id, protein_name, methodology_focus=methodology_focus)
    return {"results": results}


class ExtractMethodsRequest(BaseModel):
    publication_text: str
    protein_name: str = ""
    title: str = ""
    authors: str = ""
    journal: str = ""
    year: str = ""


@app.post("/extract_methods")
async def extract_methods(request: ExtractMethodsRequest):
    """Extract Materials and Methods section from publication text
    Enhanced with structure preservation and citation context"""
    try:
        # Build citation info if available
        citation_info = None
        if request.title or request.authors or request.journal or request.year:
            citation_info = {
                "title": request.title,
                "authors": request.authors,
                "journal": request.journal,
                "year": request.year
            }
        
        # Clean and prepare text with structure preservation
        processed = extraction.clean_and_prepare_text(
            request.publication_text,
            preserve_structure=True  # Try to detect Materials/Methods section
        )
        
        # Extract methods using AI with citation context
        extracted = ai_models.extract_methods(
            processed["cleaned_text"],
            request.protein_name,
            citation_info
        )
        
        if not extracted:
            raise HTTPException(status_code=500, detail="Failed to extract methods. Check if Ollama is running.")
        
        return {
            "extracted_methods": extracted,
            "token_count": processed["token_count"],
            "entities": processed["entities"]
        }
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class ExtractEntitiesRequest(BaseModel):
    text: str


@app.post("/extract_entities")
async def extract_entities(request: ExtractEntitiesRequest):
    """Extract chemicals, equipment, and conditions from text"""
    entities = extraction.extract_entities(request.text)
    return entities


class SummarizeProtocolRequest(BaseModel):
    extracted_methods: str
    title: str = ""
    authors: str = ""
    journal: str = ""
    year: str = ""
    format: str = "both"  # Options: "structured", "readable", "both"


@app.post("/summarize_protocol")
async def summarize_protocol(request: SummarizeProtocolRequest):
    """Summarize extracted protocol with optional model comparison
    Returns step-by-step protocol with explanations and citations for all levels"""
    try:
        # Build citation info if available
        citation_info = None
        if request.title or request.authors or request.journal or request.year:
            citation_info = {
                "title": request.title,
                "authors": request.authors,
                "journal": request.journal,
                "year": request.year
            }
        
        result = {}
        
        # Generate structured format if requested
        if request.format in ["structured", "both"]:
            structured = ai_models.summarize_protocol(request.extracted_methods)
            
            if not structured:
                if request.format == "structured":
                    raise HTTPException(status_code=500, detail="Failed to summarize protocol. Check if Ollama is running.")
            
            # Check if comparison mode is enabled
            if isinstance(structured, dict) and "primary_model" in structured:
                # Comparison mode - return both results
                result["comparison_mode"] = True
                result["primary"] = structured["primary_model"]
                result["comparison"] = structured["comparison_model"]
                result["metadata"] = structured["metadata"]
            else:
                # Single model mode
                result["comparison_mode"] = False
                result["structured"] = structured
        
        # Generate readable format if requested
        if request.format in ["readable", "both"]:
            readable = ai_models.format_protocol_readable(request.extracted_methods, citation_info)
            if readable:
                result["readable"] = readable
            else:
                if request.format == "readable":
                    raise HTTPException(status_code=500, detail="Failed to format protocol. Check if Ollama is running.")
        
        # Add citation info
        if citation_info:
            result["citation"] = citation_info
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to process protocol. Check if Ollama is running.")
        
        return result
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


class VerifyProtocolRequest(BaseModel):
    ai_protocol: str
    protein_name: str = ""
    uniprot_id: str = ""


@app.post("/verify_protocol")
async def verify_protocol(request: VerifyProtocolRequest):
    """Verify AI-generated protocol against reference dataset"""
    result = verification.verify_against_dataset(
        request.ai_protocol,
        request.protein_name,
        request.uniprot_id
    )
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="No matching reference protocol found for the given protein"
        )
    
    return result


@app.get("/verification/report")
async def get_verification_report():
    """Get validation report for reference dataset"""
    report = verification.generate_validation_report()
    return report


# ============================================================================
# Model Comparison Endpoints
# ============================================================================

# Top 5 defaults per task
TOP5_MODELS = {
    "search": ["sonar", "claude-3.5-sonnet", "gpt-4o", "gemini-1.5-pro", "llama-3.1-70b"],
    "extract": ["claude-3.5-sonnet", "gpt-4o", "gemini-1.5-pro", "llama-3.1-70b", "mixtral-8x7b"],
    "summarize": ["claude-3.5-sonnet", "gpt-4o", "gemini-1.5-pro", "llama-3.1-70b", "mixtral-8x7b"]
}

MAX_COMPARE_MODELS = int(os.getenv("MAX_COMPARE_MODELS", "5"))
MAX_CONCURRENT_MODELS = int(os.getenv("MAX_CONCURRENT_MODELS", "3"))


@app.get("/models")
async def list_models():
    """List all available models from all providers"""
    registry = get_registry()
    cache = get_cache()
    
    # Check cache
    cached = cache.get(CACHE_KEYS["models"])
    if cached:
        return {"models": cached}
    
    models = registry.list_models()
    models_dict = [{
        "id": m.id,
        "provider": m.provider,
        "name": m.name,
        "context_window": m.context_window,
        "capabilities": m.capabilities,
        "cost_hint": m.cost_hint,
        "status": m.status.value,
        "max_tokens": m.max_tokens,
        "timeout": m.timeout
    } for m in models]
    
    # Cache for 1 hour
    cache.set(CACHE_KEYS["models"], models_dict, ttl=3600)
    
    return {"models": models_dict}


@app.get("/models/top5")
async def get_top5_models(task: str = Query(..., description="Task: search, extract, or summarize")):
    """Get top 5 default models for a task"""
    model_ids = TOP5_MODELS.get(task, [])
    registry = get_registry()
    all_models = registry.list_models()
    
    # Filter to available models
    available = [m for m in all_models if m.id in model_ids and m.status.value == "active"]
    
    return {
        "task": task,
        "models": [{
            "id": m.id,
            "provider": m.provider,
            "name": m.name,
            "context_window": m.context_window,
            "capabilities": m.capabilities,
            "cost_hint": m.cost_hint
        } for m in available[:5]]
    }


@app.get("/models/alternatives")
async def get_model_alternatives(model_id: str = Query(..., description="Model ID")):
    """Get alternative models if this one is unavailable"""
    registry = get_registry()
    alternatives = registry.get_alternatives(model_id)
    
    all_models = registry.list_models()
    alternative_models = [m for m in all_models if m.id in alternatives]
    
    return {
        "model_id": model_id,
        "alternatives": [{
            "id": m.id,
            "provider": m.provider,
            "name": m.name,
            "context_window": m.context_window,
            "capabilities": m.capabilities
        } for m in alternative_models]
    }


@app.get("/prompts")
async def get_prompts(task: Optional[str] = Query(None, description="Filter by task")):
    """Get default prompts and custom prompts"""
    pm = get_prompt_manager()
    
    # Map task names to prompt keys
    task_to_prompt = {
        "search": "search_rerank",
        "extract": "extract_methods",
        "summarize": "summarize_protocol_json"
    }
    
    result = {
        "defaults": {
            "search_rerank": pm.get_default_prompt("search_rerank"),
            "extract_methods": pm.get_default_prompt("extract_methods"),
            "summarize_protocol_json": pm.get_default_prompt("summarize_protocol_json"),
            "summarize_protocol_readable": pm.get_default_prompt("summarize_protocol_readable")
        }
    }
    
    if task:
        # Get presets for the specific task
        task_key = task_to_prompt.get(task, task)
        result["presets"] = pm.get_presets(task)
        result["custom"] = pm.list_custom_prompts(task_key)
        # Also include the default prompt for this task
        if task_key in result["defaults"]:
            result["task_default"] = result["defaults"][task_key]
    else:
        result["presets"] = pm.get_presets()
        result["custom"] = pm.list_custom_prompts()
    
    return result


@app.get("/prompts/presets")
async def get_presets(task: str = Query(..., description="Task name")):
    """Get presets for a task"""
    pm = get_prompt_manager()
    return pm.get_presets(task)


class SavePromptRequest(BaseModel):
    name: str
    task: str
    prompt: str
    description: Optional[str] = None


@app.post("/prompts")
async def save_prompt(request: SavePromptRequest):
    """Save a custom prompt"""
    pm = get_prompt_manager()
    success = pm.save_custom_prompt(request.name, request.task, request.prompt, request.description)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save prompt")
    return {"success": True, "name": request.name}


@app.delete("/prompts/{name}")
async def delete_prompt(name: str):
    """Delete a custom prompt"""
    pm = get_prompt_manager()
    success = pm.delete_custom_prompt(name)
    if not success:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"success": True}


class CompareSearchRequest(BaseModel):
    uniprot_id: str
    protein_name: str = ""
    methodology_focus: str = "purification"
    models: List[str]
    prompts: Optional[Dict[str, str]] = None
    mode: str = "balanced"  # quick, balanced, thorough
    async_job: bool = False


@app.post("/compare/search")
async def compare_search(request: CompareSearchRequest):
    """Compare search/rerank across multiple models"""
    if len(request.models) > MAX_COMPARE_MODELS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_COMPARE_MODELS} models allowed")
    
    registry = get_registry()
    pm = get_prompt_manager()
    cache = get_cache()
    metrics = get_metrics_tracker()
    
    # Fetch candidates once (cached)
    cache_key = cache.generate_key(CACHE_KEYS["publication"], request.uniprot_id, request.protein_name, request.methodology_focus)
    candidates = cache.get(cache_key)
    
    if not candidates:
        candidates = publications.get_publications(
            request.uniprot_id,
            request.protein_name,
            limit=10,
            methodology_focus=request.methodology_focus
        )
        cache.set(cache_key, candidates, ttl=3600)
    
    # Run comparisons
    results = []
    for model_id in request.models:
        try:
            # Get prompt
            prompt_template = pm.get_prompt_for_model(
                model_id,
                "search_rerank",
                request.prompts.get(model_id) if request.prompts else None,
                query=f"{request.protein_name} {request.uniprot_id}",
                protein_name=request.protein_name,
                uniprot_id=request.uniprot_id,
                methodology_focus=request.methodology_focus,
                publications=json.dumps(candidates, indent=2)
            )
            
            # Generate
            result = registry.generate(model_id, prompt_template)
            
            # Record metrics
            metrics.record_execution(
                model_id, "search", result.time_s,
                result.tokens_in, result.tokens_out, result.cost, result.status == "success"
            )
            
            # Parse results
            parsed_results = []
            if result.status == "success" and result.text:
                try:
                    # Clean the response text - remove markdown code blocks if present
                    text_to_parse = result.text.strip()
                    
                    # Remove markdown code blocks (```json ... ``` or ``` ... ```)
                    if text_to_parse.startswith("```"):
                        # Find the closing ```
                        end_idx = text_to_parse.find("```", 3)
                        if end_idx > 0:
                            text_to_parse = text_to_parse[3:end_idx].strip()
                            # Remove "json" if present after opening ```
                            if text_to_parse.startswith("json"):
                                text_to_parse = text_to_parse[4:].strip()
                    
                    # Try to parse as JSON
                    parsed_results = json.loads(text_to_parse)
                    
                    # Ensure it's a list
                    if not isinstance(parsed_results, list):
                        # If it's a dict with a results key, extract it
                        if isinstance(parsed_results, dict) and "results" in parsed_results:
                            parsed_results = parsed_results["results"]
                        elif isinstance(parsed_results, dict):
                            # Single result, wrap in list
                            parsed_results = [parsed_results]
                        else:
                            parsed_results = []
                    
                    # Validate and normalize the results
                    normalized_results = []
                    for item in parsed_results:
                        if isinstance(item, dict):
                            # Ensure required fields exist - try multiple field name variations
                            title = item.get("title") or item.get("name") or item.get("publication_title") or ""
                            score = item.get("score") or item.get("relevancy_score") or item.get("relevance") or item.get("ranking") or 0
                            explanation = item.get("explanation") or item.get("reason") or item.get("description") or item.get("rationale") or ""
                            
                            # If we have a title, create normalized item
                            if title:
                                normalized_item = {
                                    "title": title,
                                    "score": float(score) if score else 0,
                                    "explanation": explanation
                                }
                                normalized_results.append(normalized_item)
                            # If no title but we have other publication data, try to construct it
                            elif item.get("url") or item.get("abstract"):
                                # Try to match with candidates to get title
                                normalized_item = {
                                    "title": item.get("url", "").split("/")[-1] if item.get("url") else "Untitled",
                                    "score": float(score) if score else 0,
                                    "explanation": explanation or item.get("abstract", "")[:100]
                                }
                                normalized_results.append(normalized_item)
                    
                    parsed_results = normalized_results
                    
                    if len(parsed_results) > 0:
                        logger.info(f"Successfully parsed {len(parsed_results)} results for {model_id}")
                    else:
                        logger.warning(f"No valid results parsed for {model_id} from {len(parsed_results) if isinstance(parsed_results, list) else 0} items")
                    
                except json.JSONDecodeError as je:
                    logger.error(f"JSON decode error for {model_id}: {je}")
                    logger.error(f"Response text (first 1000 chars): {result.text[:1000]}")
                    
                    # Try to extract structured data from text as fallback
                    try:
                        # Try to find JSON array in the text (more robust pattern)
                        # Look for [ followed by content and ending with ]
                        json_pattern = r'\[\s*\{.*?\}\s*\]'
                        json_match = re.search(json_pattern, result.text, re.DOTALL)
                        if json_match:
                            try:
                                parsed_results = json.loads(json_match.group(0))
                                logger.info(f"Extracted JSON from text for {model_id} using regex")
                            except:
                                # Try to find any array structure
                                array_start = result.text.find('[')
                                array_end = result.text.rfind(']')
                                if array_start >= 0 and array_end > array_start:
                                    try:
                                        parsed_results = json.loads(result.text[array_start:array_end+1])
                                        logger.info(f"Extracted JSON array for {model_id} using position")
                                    except:
                                        parsed_results = []
                                else:
                                    parsed_results = []
                        else:
                            parsed_results = []
                            logger.warning(f"Could not find JSON array in response for {model_id}")
                    except Exception as fallback_error:
                        logger.error(f"Fallback parsing failed for {model_id}: {fallback_error}")
                        parsed_results = []
            
            # If no results were parsed but we have candidates, create a fallback ranking
            # This helps when models return success but don't provide ranked results
            if len(parsed_results) == 0 and result.status == "success" and candidates:
                logger.warning(f"Model {model_id} returned success but no ranked results. Creating fallback ranking from candidates.")
                # Create a simple ranking from candidates (ordered as they appear)
                parsed_results = [
                    {
                        "title": pub.get("title", "Untitled"),
                        "score": 100 - idx,  # Decreasing score
                        "explanation": f"Ranked #{idx + 1} by {model_id} (fallback ranking)"
                    }
                    for idx, pub in enumerate(candidates[:5])
                ]
            
            results.append({
                "model_id": model_id,
                "results": parsed_results,
                "relevancy_score": 0.0,
                "explanation": "",
                "time_s": result.time_s,
                "tokens": result.tokens_in + result.tokens_out,
                "cost": result.cost,
                "prompt_used": result.prompt_used,
                "status": result.status,
                "error": getattr(result, 'error', None) if result.status != "success" else None
            })
        except Exception as e:
            logger.error(f"Error processing model {model_id}: {e}", exc_info=True)
            results.append({
                "model_id": model_id,
                "results": [],
                "status": "failed",
                "error": str(e),
                "time_s": 0.0,
                "tokens": 0,
                "cost": 0.0
            })
    
    return {"results": results, "candidates": candidates}


class CompareExtractRequest(BaseModel):
    publication: Dict[str, Any]
    models: List[str]
    prompts: Optional[Dict[str, str]] = None
    async_job: bool = False


@app.post("/compare/extract")
async def compare_extract(request: CompareExtractRequest):
    """Compare extraction across multiple models"""
    try:
        if len(request.models) > MAX_COMPARE_MODELS:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_COMPARE_MODELS} models allowed")
        
        registry = get_registry()
        pm = get_prompt_manager()
        cache = get_cache()
        metrics = get_metrics_tracker()
        
        # Get full text (cached)
        pub_key = cache.generate_key(CACHE_KEYS["publication"], request.publication.get("pmid") or request.publication.get("doi") or request.publication.get("title", ""))
        full_text = cache.get(pub_key)
        
        if not full_text:
            logger.info(f"Fetching full text for publication: {request.publication.get('title', 'Unknown')}")
            full_text = publications.get_publication_full_text_enhanced(request.publication)
            if full_text:
                cache.set(pub_key, full_text, ttl=3600)
                logger.info(f"Fetched and cached full text ({len(full_text)} chars)")
        
        # Fallback to abstract if full text not available
        if not full_text:
            abstract = request.publication.get("abstract", "")
            if abstract and len(abstract) > 100:
                logger.warning(f"Full text not available for publication: {request.publication.get('title', 'Unknown')}. Using abstract as fallback ({len(abstract)} chars).")
                full_text = abstract
            else:
                logger.warning(f"Full text not available for publication: {request.publication.get('title', 'Unknown')}. No abstract available either.")
                raise HTTPException(
                    status_code=404, 
                    detail=f"Publication full text not available for: {request.publication.get('title', 'Unknown')}. The publication may not have accessible full text or abstract. Try selecting a different publication with available full text."
                )
        
        # Truncate if needed
        truncation_result = truncate_content(full_text, max_tokens=4000)
        text_to_use = truncation_result["truncated_text"]
        
        # Run comparisons (max concurrent)
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_MODELS) as executor:
            futures = {}
            for model_id in request.models:
                future = executor.submit(_run_extract_model, model_id, text_to_use, request.publication, pm, registry, metrics)
                futures[future] = model_id
            
            for future in concurrent.futures.as_completed(futures):
                model_id = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error getting result for {model_id}: {e}", exc_info=True)
                    results.append({
                        "model_id": model_id,
                        "extracted_text": "",
                        "entities": {},
                        "status": "failed",
                        "error": str(e),
                        "time_s": 0.0,
                        "tokens": 0,
                        "cost": 0.0
                    })
        
        # Cross-model validation (only for successful extractions)
        extracted_texts = [r.get("extracted_text", "") for r in results if r.get("status") == "success"]
        hallucination_results = []
        for i, result in enumerate(results):
            if result.get("status") == "success" and result.get("extracted_text"):
                try:
                    other_results = [extracted_texts[j] for j in range(len(extracted_texts)) if j != i]
                    # For plain text extraction, use a simplified hallucination check
                    # The detect_hallucinations function expects structured data, so we'll do a basic check
                    hallucination = detect_hallucinations(
                        {"text": result["extracted_text"]},
                        text_to_use,
                        [{"text": t} for t in other_results] if other_results else None
                    )
                    result["flags"] = hallucination.get("flags", [])
                    result["confidence"] = hallucination.get("confidence", 1.0)
                    hallucination_results.append(hallucination)
                except Exception as e:
                    logger.warning(f"Error in hallucination detection for {result.get('model_id')}: {e}")
                    result["flags"] = []
                    result["confidence"] = 1.0
        
        return {
            "results": results,
            "input_excerpt": text_to_use[:500] + "..." if len(text_to_use) > 500 else text_to_use,
            "truncation_warning": truncation_result.get("warning"),
            "consensus": compute_consensus([{"text": t} for t in extracted_texts]) if extracted_texts else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in compare_extract endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to compare extraction results: {str(e)}")


def _run_extract_model(model_id, text, publication, pm, registry, metrics):
    """Helper to run extraction for one model"""
    try:
        prompt_template = pm.get_prompt_for_model(
            model_id,
            "extract_methods",
            None,
            protein_name=publication.get("title", ""),
            title=publication.get("title", ""),
            authors=publication.get("authors", ""),
            journal=publication.get("journal", ""),
            year=publication.get("year", ""),
            publication_text=text
        )
        
        result = registry.generate(model_id, prompt_template)
        
        metrics.record_execution(
            model_id, "extract", result.time_s,
            result.tokens_in, result.tokens_out, result.cost, result.status == "success"
        )
        
        entities = extraction.extract_entities(result.text) if result.status == "success" else {}
        
        return {
            "model_id": model_id,
            "extracted_text": result.text if result.status == "success" else "",
            "entities": entities,
            "time_s": result.time_s,
            "tokens": result.tokens_in + result.tokens_out,
            "cost": result.cost,
            "prompt_used": result.prompt_used,
            "status": result.status,
            "error": getattr(result, 'error', None) if result.status != "success" else None
        }
    except Exception as e:
        logger.error(f"Error in _run_extract_model for {model_id}: {e}", exc_info=True)
        return {
            "model_id": model_id,
            "extracted_text": "",
            "entities": {},
            "time_s": 0.0,
            "tokens": 0,
            "cost": 0.0,
            "prompt_used": "",
            "status": "failed",
            "error": str(e)
        }


class CompareSummarizeRequest(BaseModel):
    extracted_methods: str
    models: List[str]
    prompts: Optional[Dict[str, str]] = None
    format: str = "both"  # structured, readable, both
    async_job: bool = False
    # Citation info for readable format
    title: Optional[str] = None
    authors: Optional[str] = None
    journal: Optional[str] = None
    year: Optional[str] = None


@app.post("/compare/summarize")
async def compare_summarize(request: CompareSummarizeRequest):
    """Compare summarization across multiple models"""
    if len(request.models) > MAX_COMPARE_MODELS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_COMPARE_MODELS} models allowed")
    
    registry = get_registry()
    pm = get_prompt_manager()
    metrics = get_metrics_tracker()
    
    results = []
    structured_results = []
    
    # Run comparisons
    for model_id in request.models:
        try:
            validation = None
            structured_data = None
            readable = None
            result_json = None
            result_readable = None
            
            # Generate structured JSON
            if request.format in ["structured", "both"]:
                prompt_json = pm.get_prompt_for_model(
                    model_id,
                    "summarize_protocol_json",
                    request.prompts.get(model_id) if request.prompts else None,
                    extracted_methods=request.extracted_methods
                )
                
                result_json = registry.generate(model_id, prompt_json)
                
                # Validate JSON (only if we have text to validate)
                if result_json.status == "success" and result_json.text and result_json.text.strip():
                    validation = validate_json_string(result_json.text)
                    structured_data = validation.get("parsed_data") if validation and validation.get("valid") else None
                elif result_json.status == "success" and (not result_json.text or not result_json.text.strip()):
                    # Success status but empty text - create validation error
                    validation = {
                        "valid": False,
                        "errors": ["Model returned success but no JSON output"],
                        "warnings": [],
                        "parsed_data": None
                    }
                elif result_json.status != "success":
                    # Failed status - create validation error with the actual error message
                    error_msg = getattr(result_json, 'error', None) or "Model generation failed"
                    validation = {
                        "valid": False,
                        "errors": [error_msg],
                        "warnings": [],
                        "parsed_data": None
                    }
                
                structured_results.append(structured_data)
            
            # Generate readable format
            if request.format in ["readable", "both"]:
                prompt_readable = pm.get_prompt_for_model(
                    model_id,
                    "summarize_protocol_readable",
                    request.prompts.get(model_id) if request.prompts else None,
                    extracted_methods=request.extracted_methods,
                    title=request.title or "Unknown",
                    authors=request.authors or "Unknown",
                    journal=request.journal or "Unknown",
                    year=request.year or "Unknown"
                )
                result_readable = registry.generate(model_id, prompt_readable)
                readable = result_readable.text if result_readable.status == "success" else None
            
            # Use result_json for metrics if available, otherwise use result_readable
            primary_result = result_json if result_json else result_readable
            if primary_result:
                metrics.record_execution(
                    model_id, "summarize", primary_result.time_s,
                    primary_result.tokens_in, primary_result.tokens_out, primary_result.cost, primary_result.status == "success"
                )
                
                results.append({
                    "model_id": model_id,
                    "structured": structured_data,
                    "readable": readable,
                    "validation": validation,
                    "time_s": primary_result.time_s,
                    "tokens": primary_result.tokens_in + primary_result.tokens_out,
                    "cost": primary_result.cost,
                    "prompt_used": primary_result.prompt_used,
                    "status": primary_result.status,
                    "error": getattr(primary_result, 'error', None) if primary_result.status != "success" else None
                })
            else:
                # This shouldn't happen, but handle it gracefully
                logger.warning(f"No result generated for model {model_id} in summarization")
                results.append({
                    "model_id": model_id,
                    "structured": None,
                    "readable": None,
                    "validation": {
                        "valid": False,
                        "errors": ["No result generated"],
                        "warnings": [],
                        "parsed_data": None
                    },
                    "status": "failed",
                    "error": "No result generated",
                    "time_s": 0.0,
                    "tokens": 0,
                    "cost": 0.0,
                    "prompt_used": ""
                })
        except Exception as e:
            logger.error(f"Error processing model {model_id} in summarization: {e}", exc_info=True)
            results.append({
                "model_id": model_id,
                "structured": None,
                "readable": None,
                "validation": {
                    "valid": False,
                    "errors": [f"Error: {str(e)}"],
                    "warnings": [],
                    "parsed_data": None
                },
                "status": "failed",
                "error": str(e),
                "time_s": 0.0,
                "tokens": 0,
                "cost": 0.0,
                "prompt_used": ""
            })
    
    # Cross-model consensus and diff
    valid_structured = [r.get("structured") for r in results if r.get("structured")]
    comparison_report = None
    if len(valid_structured) >= 2:
        model_ids = [r["model_id"] for r in results if r.get("structured")]
        comparison_report = generate_comparison_report(valid_structured, model_ids)
    
    return {
        "results": results,
        "consensus": comparison_report.get("consensus") if comparison_report else None,
        "outliers": comparison_report.get("outliers") if comparison_report else {},
        "diff": comparison_report.get("pairwise_diffs") if comparison_report else []
    }


@app.get("/compare/status/{job_id}")
async def get_compare_status(job_id: str):
    """Get status of async comparison job"""
    queue = get_job_queue()
    status = queue.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@app.delete("/compare/cancel/{job_id}")
async def cancel_compare(job_id: str):
    """Cancel a running comparison job"""
    queue = get_job_queue()
    success = queue.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")
    return {"success": True}


class EstimateCostRequest(BaseModel):
    task: str
    models: List[str]
    content_length: int


@app.post("/compare/estimate")
async def estimate_cost(request: EstimateCostRequest):
    """Estimate cost for a comparison"""
    # Rough estimates
    cost_per_1k_tokens = {
        "search": 0.01,
        "extract": 0.02,
        "summarize": 0.03
    }
    
    base_cost = cost_per_1k_tokens.get(request.task, 0.02)
    estimated_tokens = request.content_length / 4  # Rough estimate
    cost_per_model = (estimated_tokens / 1000) * base_cost
    
    total_cost = cost_per_model * len(request.models)
    
    return {
        "task": request.task,
        "models": request.models,
        "estimated_tokens": int(estimated_tokens),
        "estimated_cost_per_model": cost_per_model,
        "total_estimated_cost": total_cost
    }


@app.get("/cost/session")
async def get_session_cost():
    """Get cumulative session cost"""
    metrics = get_metrics_tracker()
    return {"session_cost": metrics.get_session_cost()}


@app.get("/models/stats")
async def get_model_stats(task: Optional[str] = Query(None, description="Filter by task")):
    """Get model performance statistics"""
    metrics = get_metrics_tracker()
    
    if task:
        stats = metrics.get_task_stats(task)
    else:
        # Return stats for all tasks
        stats = []
        for t in ["search", "extract", "summarize"]:
            stats.extend(metrics.get_task_stats(t))
    
    return {"stats": stats}


class RateModelRequest(BaseModel):
    model_id: str
    task: str
    rating: int  # 1-5


@app.post("/models/rate")
async def rate_model(request: RateModelRequest):
    """Submit user rating for a model"""
    if not (1 <= request.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    metrics = get_metrics_tracker()
    success = metrics.rate_model(request.model_id, request.task, request.rating)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to record rating")
    
    return {"success": True}

