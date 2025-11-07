"""
Model registry service for unified access to multiple AI providers
Supports AIML API, Perplexity, and Ollama with retry logic and graceful degradation
"""
import os
import time
import requests
import json
import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class ModelStatus(Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    UNAVAILABLE = "unavailable"


@dataclass
class ModelInfo:
    """Model metadata"""
    id: str
    provider: str
    name: str
    context_window: int
    capabilities: List[str]  # ["text", "chat", "search"]
    cost_hint: str  # "low", "medium", "high"
    status: ModelStatus
    max_tokens: Optional[int] = None
    timeout: int = 30  # seconds


@dataclass
class GenerationResult:
    """Result from model generation"""
    text: str
    tokens_in: int
    tokens_out: int
    time_s: float
    cost: float
    model_id: str
    prompt_used: str
    status: str  # "success", "failed", "timeout"
    error: Optional[str] = None  # Error message if status is failed


class BaseProvider:
    """Base class for AI providers"""
    
    def list_models(self) -> List[ModelInfo]:
        """List available models"""
        raise NotImplementedError
    
    def generate(
        self, 
        model_id: str, 
        prompt: str, 
        params: Optional[Dict] = None
    ) -> GenerationResult:
        """Generate text with the model"""
        raise NotImplementedError
    
    def check_availability(self, model_id: str) -> bool:
        """Check if model is available"""
        raise NotImplementedError
    
    def get_alternatives(self, model_id: str) -> List[str]:
        """Get alternative models if this one is unavailable"""
        raise NotImplementedError


class AIMLApiProvider(BaseProvider):
    """Unified AI/ML API provider for Anthropic/OpenAI/Gemini/Mistral"""
    
    def __init__(self):
        self.base_url = os.getenv("AIML_API_BASE", "https://api.aimlapi.com/v1")
        self.api_key = os.getenv("AIML_API_KEY", "")
        # Default timeout: 30s for regular models, but we'll adjust per-model
        self.timeout = int(os.getenv("PER_MODEL_TIMEOUT", "30"))
        # Extended timeout for large/slow models
        self.extended_timeout = int(os.getenv("PER_MODEL_TIMEOUT_EXTENDED", "90"))
    
    def list_models(self) -> List[ModelInfo]:
        """List models from AI/ML API"""
        if not self.api_key:
            return []
        
        try:
            # Cache this in production (handled by cache service)
            response = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            models = []
            for model_data in data.get("data", []):
                # Parse AI/ML API response format
                model_id = model_data.get("id", "")
                provider = model_data.get("provider", "unknown")
                context_window = model_data.get("context_window", 4096)
                capabilities = model_data.get("capabilities", ["text"])
                
                # Determine cost hint
                cost_hint = "medium"
                if "gpt-4" in model_id.lower() or "claude-3-opus" in model_id.lower():
                    cost_hint = "high"
                elif "gpt-3.5" in model_id.lower() or "claude-3-haiku" in model_id.lower():
                    cost_hint = "low"
                
                models.append(ModelInfo(
                    id=model_id,
                    provider=provider,
                    name=model_data.get("name", model_id),
                    context_window=context_window,
                    capabilities=capabilities,
                    cost_hint=cost_hint,
                    status=ModelStatus.ACTIVE,
                    max_tokens=model_data.get("max_tokens"),
                    timeout=self.timeout
                ))
            
            return models
        except Exception as e:
            logger.error(f"Error listing AIML API models: {e}")
            return []
    
    def generate(
        self, 
        model_id: str, 
        prompt: str, 
        params: Optional[Dict] = None
    ) -> GenerationResult:
        """Generate using AI/ML API"""
        params = params or {}
        start_time = time.time()
        
        try:
            # AIML API uses OpenAI-compatible format
            # Model IDs can be with or without provider prefix
            # According to docs: https://docs.aimlapi.com/
            # Use the model ID as-is from the API response
            request_model_id = model_id
            
            # Adjust timeout based on model - GPT-5 and larger models need more time
            request_timeout = self.timeout
            if "gpt-5" in model_id.lower() or "claude-opus" in model_id.lower() or "claude-sonnet-4" in model_id.lower():
                request_timeout = self.extended_timeout  # Use extended timeout for very large models
                logger.info(f"Using extended timeout ({request_timeout}s) for model: {request_model_id}")
            elif "gpt-4" in model_id.lower() and "mini" not in model_id.lower():
                request_timeout = max(self.timeout, 45)  # Medium timeout for GPT-4 (non-mini)
                logger.info(f"Using medium timeout ({request_timeout}s) for model: {request_model_id}")
            
            # AIML API expects OpenAI-compatible request format
            request_payload = {
                "model": request_model_id,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": params.get("max_tokens", 2000),
                "temperature": params.get("temperature", 0.7),
            }
            
            # Check API key before making request
            if not self.api_key:
                raise ValueError("AIML_API_KEY not configured. Set it in backend/.env")
            
            logger.info(f"Requesting AIML API model: {request_model_id} (timeout: {request_timeout}s)")
            # Log request details (without full prompt for security)
            logger.debug(f"Request to {self.base_url}/chat/completions with model: {request_model_id}")
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=request_payload,
                timeout=request_timeout
            )
            
            # Get response text before raising for status to capture error details
            response_text = response.text
            response.raise_for_status()
            data = response.json()
            
            elapsed = time.time() - start_time
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            tokens_in = usage.get("prompt_tokens", 0)
            tokens_out = usage.get("completion_tokens", 0)
            
            # Estimate cost (rough estimates)
            cost = self._estimate_cost(model_id, tokens_in, tokens_out)
            
            return GenerationResult(
                text=text,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                time_s=elapsed,
                cost=cost,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="success"
            )
        except requests.exceptions.Timeout:
            elapsed = time.time() - start_time
            # Provide helpful suggestions for timeout
            timeout_msg = f"Request timed out after {elapsed:.1f}s"
            if "gpt-5" in model_id.lower():
                timeout_msg += ". GPT-5 models can be slow. Try: openai/gpt-5-mini-2025-08-07 (faster) or openai/gpt-4o (more reliable)"
            elif "gpt-4" in model_id.lower():
                timeout_msg += ". Try: openai/gpt-4o-mini (faster) or reduce max_tokens"
            else:
                timeout_msg += ". The model may be overloaded. Try again or use a faster model."
            
            logger.warning(f"Timeout for model {model_id} after {elapsed:.1f}s")
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=elapsed,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="timeout",
                error=timeout_msg
            )
        except requests.exceptions.HTTPError as e:
            # Try to get detailed error message from AIML API response
            error_detail = "Unknown error"
            status_code = 'Unknown'
            
            if e.response is not None:
                status_code = e.response.status_code
                try:
                    error_data = e.response.json()
                    # AIML API error format
                    if isinstance(error_data, dict):
                        error_detail = error_data.get("error", {}).get("message", 
                                    error_data.get("message", 
                                    error_data.get("error", 
                                    str(error_data))))
                    else:
                        error_detail = str(error_data)
                except:
                    error_detail = e.response.text[:500] if e.response.text else str(e)
            else:
                error_detail = str(e)
            
            # Check API key status first
            api_key_status = "not set" if not self.api_key else f"set (length: {len(self.api_key)})"
            logger.error(f"API key status: {api_key_status}")
            
            # Provide helpful error message for common issues
            if status_code == 401:
                # Override with more specific message for 401
                if not self.api_key:
                    error_msg = "Unauthorized: API key not configured. Set AIML_API_KEY in backend/.env"
                else:
                    error_msg = f"Unauthorized (HTTP 401): Invalid API key. The AIML_API_KEY in backend/.env may be incorrect, expired, or has extra spaces. Verify the key at https://docs.aimlapi.com/"
                logger.error(f"401 Unauthorized - API key present: {bool(self.api_key)}, Key length: {len(self.api_key) if self.api_key else 0}")
                logger.error(f"Response details: {e.response.text[:200] if e.response and e.response.text else 'No response text'}")
            elif status_code == 400:
                error_msg = f"HTTP {status_code}: {error_detail}"
                # Check if it's a model validation error
                if "Invalid discriminator value" in error_detail or "fieldErrors" in str(error_detail):
                    # Suggest similar models
                    similar_models = []
                    if "gpt-5" in model_id.lower():
                        similar_models = [
                            "openai/gpt-5-2025-08-07",
                            "openai/gpt-5-mini-2025-08-07", 
                            "openai/gpt-5-nano-2025-08-07",
                            "openai/gpt-5-chat-latest"
                        ]
                    elif "gpt-4" in model_id.lower():
                        similar_models = [
                            "openai/gpt-4o",
                            "openai/gpt-4-turbo",
                            "openai/gpt-4"
                        ]
                    
                    if similar_models:
                        error_msg += f" | Model '{model_id}' is not available. Try: {', '.join(similar_models[:3])}"
                    else:
                        error_msg += f" | Model '{model_id}' is not available. Check valid models at https://docs.aimlapi.com/"
                else:
                    error_msg += f" | Request format may be invalid. Check https://docs.aimlapi.com/ for correct format."
            elif status_code == 404:
                error_msg += f" | Model '{model_id}' not found. Check available models at https://docs.aimlapi.com/"
            
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed",
                error=error_msg
            )
        except ValueError as e:
            # API key not configured
            error_msg = str(e)
            logger.error(f"Configuration error: {error_msg}")
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed",
                error=error_msg
            )
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error generating with AIML API: {error_msg}", exc_info=True)
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed",
                error=f"Unexpected error: {error_msg}"
            )
    
    def _estimate_cost(self, model_id: str, tokens_in: int, tokens_out: int) -> float:
        """Estimate cost in USD"""
        # Rough cost estimates per 1M tokens
        cost_per_1m = {
            "gpt-4": {"in": 30.0, "out": 60.0},
            "gpt-4-turbo": {"in": 10.0, "out": 30.0},
            "gpt-3.5-turbo": {"in": 0.5, "out": 1.5},
            "claude-3-opus": {"in": 15.0, "out": 75.0},
            "claude-3-sonnet": {"in": 3.0, "out": 15.0},
            "claude-3-haiku": {"in": 0.25, "out": 1.25},
            "gemini-pro": {"in": 0.5, "out": 1.5},
        }
        
        # Find matching model
        for key, costs in cost_per_1m.items():
            if key in model_id.lower():
                return (tokens_in / 1_000_000 * costs["in"]) + (tokens_out / 1_000_000 * costs["out"])
        
        # Default estimate
        return (tokens_in + tokens_out) / 1_000_000 * 1.0
    
    def check_availability(self, model_id: str) -> bool:
        """Check if model is available"""
        models = self.list_models()
        return any(m.id == model_id for m in models)
    
    def get_alternatives(self, model_id: str) -> List[str]:
        """Get alternative models"""
        models = self.list_models()
        # Return similar models from same provider
        provider = next((m.provider for m in models if m.id == model_id), None)
        if provider:
            return [m.id for m in models if m.provider == provider and m.id != model_id]
        return []


class PerplexitySearchProvider(BaseProvider):
    """Perplexity Sonar models for search/rerank"""
    
    def __init__(self):
        self.api_key = os.getenv("PERPLEXITY_API_KEY", "")
        self.timeout = int(os.getenv("PER_MODEL_TIMEOUT", "30"))
    
    def list_models(self) -> List[ModelInfo]:
        """List Perplexity Sonar models"""
        return [
            ModelInfo(
                id="sonar",
                provider="perplexity",
                name="Perplexity Sonar",
                context_window=8192,
                capabilities=["search", "text"],
                cost_hint="medium",
                status=ModelStatus.ACTIVE,
                timeout=self.timeout
            ),
            ModelInfo(
                id="sonar-pro",
                provider="perplexity",
                name="Perplexity Sonar Pro",
                context_window=8192,
                capabilities=["search", "text"],
                cost_hint="high",
                status=ModelStatus.ACTIVE,
                timeout=self.timeout
            ),
        ]
    
    def generate(
        self, 
        model_id: str, 
        prompt: str, 
        params: Optional[Dict] = None
    ) -> GenerationResult:
        """Generate using Perplexity Chat API for ranking publications"""
        from services.perplexity import check_perplexity_available
        
        if not check_perplexity_available():
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=0.0,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed",
                error="Perplexity API not available"
            )
        
        start_time = time.time()
        try:
            from perplexity import Perplexity
            
            client = Perplexity(api_key=self.api_key)
            
            # Use Perplexity Chat API to rank publications
            # The prompt should contain the publications to rank
            response = client.chat.completions.create(
                model="sonar" if model_id == "sonar" else "sonar-pro",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a scientific publication ranking expert. Return ONLY a valid JSON array with ranked publications."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            # Extract response
            text = response.choices[0].message.content if response.choices else ""
            
            elapsed = time.time() - start_time
            
            # Estimate tokens from response
            tokens_in = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else len(prompt.split()) * 1.3
            tokens_out = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else len(text.split()) * 1.3
            
            return GenerationResult(
                text=text,
                tokens_in=int(tokens_in),
                tokens_out=int(tokens_out),
                time_s=elapsed,
                cost=0.01,  # Perplexity pricing estimate
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="success"
            )
        except Exception as e:
            logger.error(f"Error generating with Perplexity Chat API: {e}", exc_info=True)
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed",
                error=str(e)
            )
    
    def check_availability(self, model_id: str) -> bool:
        """Check if Perplexity is available"""
        from services.perplexity import check_perplexity_available
        return check_perplexity_available()
    
    def get_alternatives(self, model_id: str) -> List[str]:
        """Get alternatives"""
        return ["sonar-pro"] if model_id == "sonar" else ["sonar"]


class OllamaProvider(BaseProvider):
    """Ollama local provider"""
    
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.timeout = int(os.getenv("PER_MODEL_TIMEOUT", "30"))
    
    def list_models(self) -> List[ModelInfo]:
        """List Ollama models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
            data = response.json()
            
            models = []
            for model_data in data.get("models", []):
                model_id = model_data.get("name", "")
                if model_id:
                    models.append(ModelInfo(
                        id=model_id,
                        provider="ollama",
                        name=model_id,
                        context_window=4096,  # Default, varies by model
                        capabilities=["text", "chat"],
                        cost_hint="low",  # Local = free
                        status=ModelStatus.ACTIVE,
                        timeout=self.timeout
                    ))
            return models
        except Exception as e:
            logger.error(f"Error listing Ollama models: {e}")
            return []
    
    def generate(
        self, 
        model_id: str, 
        prompt: str, 
        params: Optional[Dict] = None
    ) -> GenerationResult:
        """Generate using Ollama"""
        params = params or {}
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model_id,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "num_predict": params.get("max_tokens", 2000),
                        "temperature": params.get("temperature", 0.7),
                    }
                },
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            
            elapsed = time.time() - start_time
            text = data.get("response", "")
            
            # Estimate tokens (rough)
            tokens_in = len(prompt.split()) * 1.3
            tokens_out = len(text.split()) * 1.3
            
            return GenerationResult(
                text=text,
                tokens_in=int(tokens_in),
                tokens_out=int(tokens_out),
                time_s=elapsed,
                cost=0.0,  # Local = free
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="success"
            )
        except requests.exceptions.Timeout:
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="timeout"
            )
        except Exception as e:
            logger.error(f"Error generating with Ollama: {e}")
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=time.time() - start_time,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed"
            )
    
    def check_availability(self, model_id: str) -> bool:
        """Check if Ollama is available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            if response.status_code == 200:
                models = response.json().get("models", [])
                return any(m.get("name") == model_id for m in models)
        except:
            pass
        return False
    
    def get_alternatives(self, model_id: str) -> List[str]:
        """Get alternatives"""
        models = self.list_models()
        return [m.id for m in models if m.id != model_id]


class ModelRegistry:
    """Central registry for all model providers"""
    
    def __init__(self):
        self.providers: List[BaseProvider] = []
        
        # Initialize providers
        if os.getenv("AIML_API_KEY"):
            self.providers.append(AIMLApiProvider())
        
        if os.getenv("PERPLEXITY_API_KEY"):
            self.providers.append(PerplexitySearchProvider())
        
        # Always try Ollama (local fallback)
        self.providers.append(OllamaProvider())
    
    def list_models(self) -> List[ModelInfo]:
        """List all available models from all providers"""
        all_models = []
        for provider in self.providers:
            try:
                models = provider.list_models()
                all_models.extend(models)
            except Exception as e:
                logger.error(f"Error listing models from {provider.__class__.__name__}: {e}")
        return all_models
    
    def generate(
        self, 
        model_id: str, 
        prompt: str, 
        params: Optional[Dict] = None,
        max_retries: int = 3
    ) -> GenerationResult:
        """Generate with retry logic"""
        # Find provider for this model
        provider = self._get_provider_for_model(model_id)
        if not provider:
            return GenerationResult(
                text="",
                tokens_in=0,
                tokens_out=0,
                time_s=0.0,
                cost=0.0,
                model_id=model_id,
                prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
                status="failed"
            )
        
        # Retry with exponential backoff
        for attempt in range(max_retries):
            try:
                result = provider.generate(model_id, prompt, params)
                if result.status == "success":
                    return result
                
                # If timeout or rate limit, wait and retry
                if result.status == "timeout" and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                    continue
                
                return result
            except Exception as e:
                logger.error(f"Error in generation attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
        
        return GenerationResult(
            text="",
            tokens_in=0,
            tokens_out=0,
            time_s=0.0,
            cost=0.0,
            model_id=model_id,
            prompt_used=prompt[:100] + "..." if len(prompt) > 100 else prompt,
            status="failed"
        )
    
    def check_availability(self, model_id: str) -> bool:
        """Check if model is available"""
        provider = self._get_provider_for_model(model_id)
        if provider:
            return provider.check_availability(model_id)
        return False
    
    def get_alternatives(self, model_id: str) -> List[str]:
        """Get alternative models"""
        provider = self._get_provider_for_model(model_id)
        if provider:
            return provider.get_alternatives(model_id)
        return []
    
    def _get_provider_for_model(self, model_id: str) -> Optional[BaseProvider]:
        """Find provider for a model"""
        for provider in self.providers:
            models = provider.list_models()
            if any(m.id == model_id for m in models):
                return provider
        return None


# Global registry instance
_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    """Get global model registry instance"""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry

