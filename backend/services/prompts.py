"""
Prompt templates and management service
Handles default prompts, presets, and custom prompt storage
"""
import json
import os
from typing import Dict, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum

# Default prompt templates
DEFAULT_PROMPTS = {
    "search_rerank": """You are an expert biotech research assistant. I am searching for highly reliable scientific publications on {protein_name} ({uniprot_id}) with a focus on {methodology_focus}.

Query: {query}

Publications to analyze:
{publications}

Please analyze the literature you find and prioritize papers that meet the following criteria. For each paper you suggest, please provide a summary and explicitly justify its reliability based on these points:

1. Journal & Peer Review Status:
   - Prioritize papers from high-impact, peer-reviewed journals (e.g., Nature, Cell, Science, Nature Biotechnology, Cell Press journals, PNAS).
   - Ensure the journal is indexed in PubMed/PMC.
   - Exclude preprints from bioRxiv or other servers unless specifically relevant.

2. Authorship and Integrity:
   - Note the authors' affiliations (look for reputable universities, research institutes, or companies).
   - Check for and mention if a Conflict of Interest (COI) statement is present and what it says.

3. Methodological Rigor:
   - Look for key indicators in the methods section:
     * Are appropriate controls (positive/negative) clearly described?
     * Is the sample size ("n" value) and the nature of replicates (biological vs. technical) stated?
     * Are the statistical tests used clearly named and justified?
   - Flag any papers that seem to lack these elements.

4. Data and Reproducibility:
   - Prefer papers that include a Data Availability Statement indicating raw data is in a public repository (e.g., GEO, PDB, ProteomeXchange).
   - Check for comprehensive Supplementary Materials (methods, data, figures).

5. Context and Influence:
   - If possible, provide the citation count and note if the paper is frequently cited by other reputable works.
   - Briefly situate the paper in the field. Is it a foundational classic, a controversial challenge to the status quo, or a recent incremental advance?

Finally, for your final output:
   - Provide a ranked list of the most reliable papers you find based on the above criteria.
   - For each paper, format the output to include: Title, Authors, Journal, Year, DOI/PubMed Link, and a brief reliability justification.
   - Highlight what you believe to be the single most reliable and impactful paper on the topic and explain why.

Return results as a JSON array with this exact format:
[
  {{
    "title": "Publication title",
    "score": 85,
    "explanation": "Brief reliability justification including journal quality, methodological rigor, data availability, and field context"
  }},
  ...
]

IMPORTANT: Return ONLY valid JSON array, no markdown, no code blocks, no additional text.""",

    "extract_methods": """You are extracting the Materials and Methods section from a scientific publication about protein {protein_name}.

Citation context:
Title: {title}
Authors: {authors}
Journal: {journal}
Year: {year}

Publication text:
{publication_text}

Instructions:
- Extract ONLY the Materials and Methods section
- Preserve structure, subsections, and formatting
- Include all quantitative details (numbers, units, concentrations)
- Maintain original technical terminology
- Return the extracted section in a clear, organized format""",

    "summarize_protocol_json": """Convert the following protein synthesis protocol into a structured JSON format.

Protocol text:
{extracted_methods}

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

Instructions:
- Extract all materials with concentrations, volumes, and suppliers
- Break down procedure into clear, numbered steps
- Extract all reaction conditions with units
- List all equipment used
- Preserve references to other methods or papers
- Return ONLY valid JSON, no additional text""",

    "summarize_protocol_readable": """You are an expert scientific protocol writer. Your task is to convert raw Materials and Methods text into a clear, step-by-step protocol that anyone can follow.

Citation Information:
- Title: {title}
- Authors: {authors}
- Journal: {journal}
- Year: {year}

Original Materials and Methods Text:
{extracted_methods}

CRITICAL INSTRUCTIONS:
1. The text above is REAL extracted methods from a scientific publication. Do NOT treat it as placeholder text.
2. Convert this raw text into a well-structured, user-friendly protocol.
3. Extract and organize all information from the text above - do not ask for additional information.

REQUIRED OUTPUT FORMAT:

## Protocol: [Protein/Method Name from the text]

### Overview
[2-3 sentences explaining what this protocol does and its purpose, based on the extracted methods]

### Materials Needed

**Reagents and Chemicals:**
[List all chemicals, buffers, solutions mentioned in the text]
- Include concentrations, volumes, and units exactly as stated
- Note suppliers if mentioned
- Explain what each material is used for (in simple terms)

**Equipment:**
[List all equipment mentioned]
- Include model numbers if specified
- Briefly explain what each piece does

### Step-by-Step Procedure

**Step 1: [Step Name]**
- **What you're doing:** Clear description
- **How to do it:** Detailed instructions from the text
- **Why it matters:** Brief explanation
- **Conditions:** Temperature, pH, time, etc. (if mentioned)
- **Materials:** What's used in this step
- **Safety notes:** Any safety considerations

[Continue for all steps found in the text...]

### Important Notes and Tips
- Critical notes from the text
- Common mistakes to avoid
- Troubleshooting advice if mentioned
- Technical terms explained in simple language

### References
- Any citations or references mentioned in the text
- Link to the source paper if available

### Key Terms Explained
- Define technical terms in simple language
- Help beginners understand the concepts

GUIDELINES:
- Write in clear, simple language that beginners can understand
- Explain technical terms and concepts
- Break complex procedures into smaller, manageable steps
- Include "why" explanations so readers understand the purpose
- Preserve ALL quantitative details (numbers, units, concentrations) exactly as stated
- Maintain all citations and references
- Use markdown formatting (headers, bullet points, bold) for structure
- Add safety warnings where appropriate
- Make it step-by-step and sequential
- DO NOT ask for additional information - work with what's provided
- DO NOT say the text is placeholder - it's real extracted methods

Return the formatted protocol as plain text with markdown formatting. Do NOT wrap in code blocks or JSON."""
}

# Preset configurations
PRESETS = {
    "Conservative": {
        "temperature": 0.3,
        "max_tokens": 1500,
        "top_p": 0.9,
        "description": "Conservative, focused responses with lower temperature"
    },
    "Detailed": {
        "temperature": 0.7,
        "max_tokens": 4000,
        "top_p": 0.95,
        "description": "Detailed, comprehensive responses"
    },
    "Fast": {
        "temperature": 0.5,
        "max_tokens": 1000,
        "top_p": 0.85,
        "description": "Fast, concise responses"
    }
}

# Task-specific presets
TASK_PRESETS = {
    "search": {
        "Conservative": {**PRESETS["Conservative"], "max_tokens": 500},
        "Detailed": {**PRESETS["Detailed"], "max_tokens": 2000},
        "Fast": {**PRESETS["Fast"], "max_tokens": 300}
    },
    "extract": {
        "Conservative": {**PRESETS["Conservative"], "max_tokens": 3000},
        "Detailed": {**PRESETS["Detailed"], "max_tokens": 6000},
        "Fast": {**PRESETS["Fast"], "max_tokens": 2000}
    },
    "summarize": {
        "Conservative": {**PRESETS["Conservative"], "max_tokens": 2000},
        "Detailed": {**PRESETS["Detailed"], "max_tokens": 5000},
        "Fast": {**PRESETS["Fast"], "max_tokens": 1500}
    }
}


class PromptManager:
    """Manages prompts, presets, and custom prompts"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or os.getenv(
            "PROMPT_STORAGE_PATH", 
            os.path.join(os.path.dirname(__file__), "..", "data", "custom_prompts.json")
        )
        self.custom_prompts: Dict[str, Dict] = self._load_custom_prompts()
    
    def get_default_prompt(self, task: str) -> str:
        """Get default prompt for a task"""
        return DEFAULT_PROMPTS.get(task, "")
    
    def format_prompt(self, task: str, **kwargs) -> str:
        """Format a prompt template with variables"""
        template = self.get_default_prompt(task)
        try:
            return template.format(**kwargs)
        except KeyError as e:
            # Missing variable, return template as-is
            return template
    
    def get_presets(self, task: Optional[str] = None) -> Dict:
        """Get presets for a task or all presets"""
        if task:
            return TASK_PRESETS.get(task, {})
        return PRESETS
    
    def get_preset_config(self, task: str, preset_name: str) -> Dict:
        """Get specific preset configuration"""
        task_presets = TASK_PRESETS.get(task, {})
        return task_presets.get(preset_name, PRESETS.get(preset_name, {}))
    
    def save_custom_prompt(
        self, 
        name: str, 
        task: str, 
        prompt: str, 
        description: Optional[str] = None
    ) -> bool:
        """Save a custom prompt"""
        try:
            self.custom_prompts[name] = {
                "task": task,
                "prompt": prompt,
                "description": description or "",
                "created_at": str(os.path.getmtime(self.storage_path) if os.path.exists(self.storage_path) else "")
            }
            self._save_custom_prompts()
            return True
        except Exception as e:
            print(f"Error saving custom prompt: {e}")
            return False
    
    def get_custom_prompt(self, name: str) -> Optional[Dict]:
        """Get a custom prompt by name"""
        return self.custom_prompts.get(name)
    
    def list_custom_prompts(self, task: Optional[str] = None) -> List[Dict]:
        """List all custom prompts, optionally filtered by task"""
        prompts = []
        for name, data in self.custom_prompts.items():
            if not task or data.get("task") == task:
                prompts.append({
                    "name": name,
                    "task": data.get("task", ""),
                    "description": data.get("description", ""),
                    "created_at": data.get("created_at", "")
                })
        return prompts
    
    def delete_custom_prompt(self, name: str) -> bool:
        """Delete a custom prompt"""
        if name in self.custom_prompts:
            del self.custom_prompts[name]
            self._save_custom_prompts()
            return True
        return False
    
    def get_prompt_for_model(
        self, 
        model_id: str, 
        task: str, 
        custom_prompt_name: Optional[str] = None,
        **kwargs
    ) -> str:
        """Get prompt for a specific model (with optional custom override)"""
        # Check for custom prompt
        if custom_prompt_name:
            custom = self.get_custom_prompt(custom_prompt_name)
            if custom and custom.get("task") == task:
                template = custom.get("prompt", "")
                try:
                    return template.format(**kwargs)
                except KeyError:
                    return template
        
        # Use default prompt
        return self.format_prompt(task, **kwargs)
    
    def export_prompts(self) -> Dict:
        """Export all prompts as JSON"""
        return {
            "defaults": DEFAULT_PROMPTS,
            "presets": PRESETS,
            "task_presets": TASK_PRESETS,
            "custom": self.custom_prompts
        }
    
    def import_prompts(self, data: Dict) -> bool:
        """Import prompts from JSON"""
        try:
            if "custom" in data:
                self.custom_prompts.update(data["custom"])
                self._save_custom_prompts()
            return True
        except Exception as e:
            print(f"Error importing prompts: {e}")
            return False
    
    def _load_custom_prompts(self) -> Dict:
        """Load custom prompts from file"""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading custom prompts: {e}")
        return {}
    
    def _save_custom_prompts(self):
        """Save custom prompts to file"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        try:
            with open(self.storage_path, "w") as f:
                json.dump(self.custom_prompts, f, indent=2)
        except Exception as e:
            print(f"Error saving custom prompts: {e}")


# Global prompt manager instance
_prompt_manager: Optional[PromptManager] = None


def get_prompt_manager() -> PromptManager:
    """Get global prompt manager instance"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager

