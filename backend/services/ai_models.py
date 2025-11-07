"""
AI model integration using Ollama for local LLM inference
"""
import requests
import json
import os
from typing import Optional, Dict
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
OLLAMA_MODEL_COMPARISON = os.getenv("OLLAMA_MODEL_COMPARISON", "meditron")  # For A/B testing
ENABLE_MODEL_COMPARISON = os.getenv("ENABLE_MODEL_COMPARISON", "false").lower() == "true"


def check_ollama_available() -> bool:
    """Check if Ollama service is running"""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        return response.status_code == 200
    except:
        return False


def generate_with_ollama(prompt: str, model: Optional[str] = None, max_tokens: int = 2000) -> Optional[str]:
    """
    Generate text using Ollama local LLM
    
    Args:
        prompt: Input prompt for the model
        model: Model name (defaults to OLLAMA_MODEL env var)
        max_tokens: Maximum tokens to generate
    
    Returns:
        Generated text or None if error
    """
    if not check_ollama_available():
        raise ConnectionError(f"Ollama service not available at {OLLAMA_BASE_URL}. Make sure Ollama is running.")
    
    model = model or OLLAMA_MODEL
    
    try:
        url = f"{OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.7,
                "top_p": 0.9
            }
        }
        
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "")
    
    except requests.exceptions.RequestException as e:
        print(f"Error calling Ollama API: {e}")
        return None
    except Exception as e:
        print(f"Error generating text: {e}")
        return None


def extract_methods(publication_text: str, protein_name: str = "", citation_info: Optional[Dict] = None) -> Optional[str]:
    """
    Extract Materials and Methods section from publication text
    Enhanced with better context preservation and focused extraction
    
    Args:
        publication_text: Full text of the publication (preferably Materials/Methods section)
        protein_name: Name of the protein (optional, for context)
        citation_info: Optional dictionary with title, authors, journal, year for context
    
    Returns:
        Extracted methods text with preserved structure
    """
    context = f" for {protein_name}" if protein_name else ""
    
    # Build citation context if available
    citation_context = ""
    if citation_info:
        title = citation_info.get("title", "")
        authors = citation_info.get("authors", "")
        journal = citation_info.get("journal", "")
        year = citation_info.get("year", "")
        if title or authors or journal:
            citation_context = f"\n\nCitation context:\n"
            if title:
                citation_context += f"Title: {title}\n"
            if authors:
                citation_context += f"Authors: {authors}\n"
            if journal:
                citation_context += f"Journal: {journal}\n"
            if year:
                citation_context += f"Year: {year}\n"
    
    prompt = f"""You are extracting the Materials and Methods section from a scientific publication about protein purification{context}.

Your task is to extract the complete experimental protocol with all relevant details. Focus on extracting:

1. **Materials and Reagents:**
   - All chemicals, buffers, solutions, and reagents used
   - Concentrations, volumes, and suppliers when mentioned
   - Proteins, enzymes, antibodies, and biological materials

2. **Equipment and Instruments:**
   - All equipment used (centrifuges, incubators, spectrometers, etc.)
   - Model numbers or specifications when mentioned

3. **Experimental Procedures:**
   - Step-by-step methodology in chronological order
   - All reaction conditions (temperature, pH, time, pressure, etc.)
   - Incubation times and temperatures
   - Mixing procedures and volumes

4. **Purification and Analysis Methods:**
   - Chromatography methods (if any)
   - Electrophoresis procedures
   - Quality control measures
   - Analytical techniques

5. **Key Parameters:**
   - Temperature values with units (°C, K, etc.)
   - pH values
   - Time durations (minutes, hours, days)
   - Concentrations (mM, μM, M, %, etc.)
   - Speeds (rpm, g-force, etc.)

{citation_context}

Publication text:
{publication_text}

Instructions:
- Extract ONLY the Materials and Methods section
- Preserve the structure, subsections, and formatting as much as possible
- Include all quantitative details (numbers, units, concentrations)
- If the section mentions "as described previously" or similar, note it but extract what is provided
- Maintain the original technical terminology
- If the text is already a Materials/Methods section, clean and organize it
- If the section is not clearly marked, extract any experimental procedures related to protein synthesis

Provide the extracted Materials and Methods section in a clear, organized format."""

    return generate_with_ollama(prompt, max_tokens=4000)


def summarize_protocol_single_model(extracted_methods: str, model: str) -> Optional[Dict]:
    """
    Refactored single-model summarization (extracted from summarize_protocol)
    
    Args:
        extracted_methods: Raw extracted methods text
        model: Model name to use (e.g., "llama3:8b", "meditron")
    
    Returns:
        Structured protocol dictionary with steps, materials, and conditions
    """
    prompt = f"""Convert the following protein synthesis protocol into a structured JSON format. Extract all relevant information and organize it clearly.

Required JSON structure:
{{
  "steps": [
    {{
      "step_number": 1,
      "description": "Detailed step description",
      "conditions": {{"temperature": "37°C", "time": "2 hours", ...}},
      "materials_used": ["material 1", "material 2"]
    }},
    ...
  ],
  "materials": [
    {{
      "name": "Material name",
      "concentration": "10 mM",
      "volume": "50 mL",
      "supplier": "Supplier name if mentioned"
    }},
    ...
  ],
  "equipment": ["Equipment 1", "Equipment 2", ...],
  "conditions": [
    {{
      "type": "temperature",
      "value": "37°C",
      "context": "incubation"
    }},
    ...
  ],
  "references": ["any cited methods or papers mentioned"]
}}

Protocol text:
{extracted_methods}

Instructions:
- Extract all materials with their concentrations, volumes, and suppliers when mentioned
- Break down the procedure into clear, numbered steps
- Extract all reaction conditions (temperature, pH, time, speed, etc.) with their units
- List all equipment used
- Preserve any references to other methods or papers
- If values are given as ranges, include both values
- Standardize units where possible (convert to consistent units)
- Include all quantitative details

Return ONLY valid JSON, no additional text or explanation. Ensure proper JSON formatting."""

    response = generate_with_ollama(prompt, model=model, max_tokens=2000)
    
    if not response:
        return None
    
    # Try to extract JSON from response
    try:
        # Remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()
        
        # Parse JSON
        protocol = json.loads(response)
        
        # Ensure required fields exist
        if not isinstance(protocol, dict):
            return None
        
        return {
            "steps": protocol.get("steps", []),
            "materials": protocol.get("materials", []),
            "equipment": protocol.get("equipment", []),
            "conditions": protocol.get("conditions", []),
            "references": protocol.get("references", [])
        }
    
    except json.JSONDecodeError:
        # If JSON parsing fails, try to extract structure manually
        return {
            "steps": [line.strip() for line in response.split('\n') if line.strip() and not line.strip().startswith('{')],
            "materials": [],
            "equipment": [],
            "conditions": [],
            "references": [],
            "raw_response": response
        }


def log_comparison_results(results: Dict):
    """Log comparison metrics for analysis"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 80)
    logger.info("MODEL COMPARISON RESULTS")
    logger.info("=" * 80)
    
    for model_type in ["primary_model", "comparison_model"]:
        model_data = results[model_type]
        logger.info(f"\n{model_type.upper()}: {model_data['name']}")
        logger.info(f"Time: {model_data['time_seconds']}s")
        
        if model_data['result']:
            logger.info(f"Steps extracted: {len(model_data['result'].get('steps', []))}")
            logger.info(f"Materials extracted: {len(model_data['result'].get('materials', []))}")
            logger.info(f"Equipment extracted: {len(model_data['result'].get('equipment', []))}")
    
    logger.info("=" * 80)


def summarize_protocol_with_comparison(extracted_methods: str) -> Dict:
    """
    Summarize protocol using both models for comparison
    
    Returns:
        {
            "primary_model": {"name": "llama3:8b", "result": {...}, "time": 5.2},
            "comparison_model": {"name": "meditron", "result": {...}, "time": 4.8},
            "metadata": {"timestamp": "...", "input_length": 1234}
        }
    """
    import time
    import logging
    logger = logging.getLogger(__name__)
    
    results = {}
    
    # Generate with primary model
    logger.info(f"Generating protocol summary with primary model: {OLLAMA_MODEL}")
    start = time.time()
    primary_result = summarize_protocol_single_model(extracted_methods, OLLAMA_MODEL)
    primary_time = time.time() - start
    
    results["primary_model"] = {
        "name": OLLAMA_MODEL,
        "result": primary_result,
        "time_seconds": round(primary_time, 2)
    }
    
    # Generate with comparison model
    logger.info(f"Generating protocol summary with comparison model: {OLLAMA_MODEL_COMPARISON}")
    start = time.time()
    comparison_result = summarize_protocol_single_model(extracted_methods, OLLAMA_MODEL_COMPARISON)
    comparison_time = time.time() - start
    
    results["comparison_model"] = {
        "name": OLLAMA_MODEL_COMPARISON,
        "result": comparison_result,
        "time_seconds": round(comparison_time, 2)
    }
    
    results["metadata"] = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "input_length": len(extracted_methods),
        "comparison_enabled": True
    }
    
    # Log comparison results
    log_comparison_results(results)
    
    return results


def summarize_protocol(extracted_methods: str) -> Optional[Dict]:
    """
    Summarize extracted protocol into structured JSON format
    Routes to single model or comparison based on config
    
    Args:
        extracted_methods: Raw extracted methods text
    
    Returns:
        Structured protocol dictionary (single model) or comparison results (both models)
    """
    if ENABLE_MODEL_COMPARISON:
        return summarize_protocol_with_comparison(extracted_methods)
    else:
        return summarize_protocol_single_model(extracted_methods, OLLAMA_MODEL)


def format_protocol_readable(extracted_methods: str, citation_info: Optional[Dict] = None) -> Optional[str]:
    """
    Format protocol in an easy-to-read, step-by-step format with explanations
    Designed for people of all technical levels
    
    Args:
        extracted_methods: Raw extracted methods text
        citation_info: Optional citation information (title, authors, journal, year)
    
    Returns:
        Formatted protocol as readable text with explanations and citations
    """
    # Build citation header
    citation_header = ""
    if citation_info:
        title = citation_info.get("title", "")
        authors = citation_info.get("authors", "")
        journal = citation_info.get("journal", "")
        year = citation_info.get("year", "")
        
        citation_header = "\n## Protocol Source\n\n"
        if title:
            citation_header += f"**Title:** {title}\n\n"
        if authors:
            citation_header += f"**Authors:** {authors}\n\n"
        if journal:
            citation_header += f"**Journal:** {journal}\n\n"
        if year:
            citation_header += f"**Year:** {year}\n\n"
        citation_header += "---\n\n"
    
    prompt = f"""You are creating a user-friendly, step-by-step protocol guide for protein synthesis that is accessible to people of all technical levels.

Your task is to transform the following Materials and Methods section into a clear, easy-to-follow protocol with explanations.

{citation_header}## Original Materials and Methods:

{extracted_methods}

---

## Instructions:

Create a well-structured, easy-to-read protocol with the following format:

### **PROTOCOL: [Protein Name] Synthesis**

#### **Overview**
Start with a brief overview (2-3 sentences) explaining what this protocol does and its purpose.

#### **Materials Needed**

**Reagents and Chemicals:**
- List all chemicals, buffers, and solutions
- Include concentrations and volumes
- Note suppliers when mentioned
- Explain what each material is used for (in simple terms)

**Equipment:**
- List all equipment needed
- Include model numbers if mentioned
- Briefly explain what each piece of equipment does

#### **Step-by-Step Procedure**

Format each step as follows:

**Step 1: [Step Title]**
- **What you're doing:** Clear description of the step
- **How to do it:** Detailed instructions
- **Why it matters:** Brief explanation of why this step is important
- **Conditions:** Temperature, pH, time, etc. (if applicable)
- **Materials:** What materials are used in this step
- **Safety notes:** Any safety considerations (if applicable)

Continue for all steps...

#### **Important Notes and Tips**
- Add any critical notes, common mistakes to avoid, or tips for success
- Explain any technical terms in simple language
- Note any troubleshooting advice

#### **References**
- List any citations or references to other methods mentioned in the text
- If methods cite other papers, include those citations

#### **Key Terms Explained**
- Define any technical terms that might be confusing for beginners
- Use simple, clear language

**Guidelines:**
1. Write in clear, simple language that beginners can understand
2. Explain technical terms and concepts
3. Break complex procedures into smaller, manageable steps
4. Include "why" explanations so readers understand the purpose
5. Preserve all quantitative details (numbers, units, concentrations)
6. Maintain all citations and references
7. Use formatting (bold, bullet points) to make it easy to scan
8. Add safety warnings where appropriate
9. Include troubleshooting tips if the original text mentions common issues
10. Make it step-by-step and sequential

Return the formatted protocol as plain text (not JSON, not markdown code blocks). Use markdown formatting for structure but return it as readable text."""
    
    response = generate_with_ollama(prompt, max_tokens=6000)
    
    if not response:
        return None
    
    # Clean up the response
    response = response.strip()
    
    # Remove markdown code blocks if present
    if response.startswith("```"):
        lines = response.split('\n')
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip() == "```":
            lines = lines[:-1]
        response = '\n'.join(lines).strip()
    
    return response


