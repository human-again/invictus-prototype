"""
Hallucination detection service
Detects potential hallucinations using citation span matching, cross-model validation, and plausibility checks
"""
import re
from typing import Dict, List, Optional, Any, Set
from difflib import SequenceMatcher


def fuzzy_match(text1: str, text2: str, threshold: float = 0.7) -> bool:
    """Check if two texts are similar (fuzzy match)"""
    similarity = SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    return similarity >= threshold


def check_citation_span_matching(
    extracted_fact: str,
    source_text: str,
    threshold: float = 0.6
) -> Dict[str, Any]:
    """Check if extracted fact matches source text"""
    # Normalize texts
    fact_lower = extracted_fact.lower().strip()
    source_lower = source_text.lower()
    
    # Try exact match first
    if fact_lower in source_lower:
        return {
            "matched": True,
            "confidence": 1.0,
            "method": "exact"
        }
    
    # Try fuzzy match on words
    fact_words = fact_lower.split()
    if len(fact_words) > 0:
        # Check if significant portion of words appear in source
        matches = sum(1 for word in fact_words if len(word) > 3 and word in source_lower)
        match_ratio = matches / len(fact_words) if fact_words else 0
        
        if match_ratio >= threshold:
            return {
                "matched": True,
                "confidence": match_ratio,
                "method": "fuzzy"
            }
    
    # Try fuzzy string matching
    similarity = SequenceMatcher(None, fact_lower, source_lower[:len(fact_lower)*2]).ratio()
    if similarity >= threshold:
        return {
            "matched": True,
            "confidence": similarity,
            "method": "similarity"
        }
    
    return {
        "matched": False,
        "confidence": similarity,
        "method": "none"
    }


def check_plausibility(field_name: str, value: Any) -> Dict[str, Any]:
    """Check if a value is plausible for its field type"""
    flags = []
    confidence = 1.0
    
    if field_name == "ph" or "ph" in field_name.lower():
        # pH should be 0-14
        ph_value = _extract_number(value)
        if ph_value is not None:
            if not (0 <= ph_value <= 14):
                flags.append("pH out of range (0-14)")
                confidence = 0.3
    
    elif "temperature" in field_name.lower():
        # Temperature checks
        temp_value = _extract_number(value)
        if temp_value is not None:
            # Check for reasonable lab temperatures
            if "°C" in str(value) or "celsius" in str(value).lower():
                if not (-80 <= temp_value <= 200):
                    flags.append("Temperature outside typical lab range")
                    confidence = 0.5
            elif "°F" in str(value) or "fahrenheit" in str(value).lower():
                if not (-112 <= temp_value <= 392):
                    flags.append("Temperature outside typical lab range")
                    confidence = 0.5
    
    elif "concentration" in field_name.lower() or "molar" in field_name.lower():
        # Concentration should be positive
        conc_value = _extract_number(value)
        if conc_value is not None and conc_value < 0:
            flags.append("Negative concentration")
            confidence = 0.2
    
    elif "time" in field_name.lower() or "duration" in field_name.lower():
        # Time should be positive
        time_value = _extract_number(value)
        if time_value is not None and time_value < 0:
            flags.append("Negative time")
            confidence = 0.2
    
    elif "step_number" in field_name.lower():
        # Step numbers should be positive integers
        step_value = _extract_number(value)
        if step_value is not None:
            if step_value <= 0 or step_value != int(step_value):
                flags.append("Invalid step number")
                confidence = 0.3
    
    return {
        "plausible": len(flags) == 0,
        "flags": flags,
        "confidence": confidence
    }


def _extract_number(value: Any) -> Optional[float]:
    """Extract numeric value from string"""
    if isinstance(value, (int, float)):
        return float(value)
    
    if isinstance(value, str):
        # Try to extract number
        match = re.search(r'-?\d+\.?\d*', value)
        if match:
            try:
                return float(match.group())
            except ValueError:
                pass
    
    return None


def detect_hallucinations(
    extracted_data: Dict[str, Any],
    source_text: str,
    cross_model_results: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Detect potential hallucinations in extracted data"""
    flags = []
    confidence_scores = {}
    
    # 1. Citation span matching for key facts
    if "steps" in extracted_data:
        for step in extracted_data["steps"]:
            description = step.get("description", "")
            if description:
                match_result = check_citation_span_matching(description, source_text)
                if not match_result["matched"]:
                    flags.append({
                        "type": "citation_mismatch",
                        "field": f"step_{step.get('step_number', 'unknown')}_description",
                        "severity": "medium",
                        "confidence": 1.0 - match_result["confidence"]
                    })
    
    # 2. Plausibility checks
    if "conditions" in extracted_data:
        for condition in extracted_data["conditions"]:
            field_type = condition.get("type", "")
            value = condition.get("value", "")
            plausibility = check_plausibility(field_type, value)
            
            if not plausibility["plausible"]:
                flags.append({
                    "type": "implausible_value",
                    "field": f"condition_{field_type}",
                    "value": value,
                    "severity": "high" if plausibility["confidence"] < 0.5 else "medium",
                    "details": plausibility["flags"]
                })
    
    # 3. Cross-model validation
    if cross_model_results and len(cross_model_results) >= 2:
        # Compare with other models
        outliers = _detect_outliers(extracted_data, cross_model_results)
        if outliers:
            flags.append({
                "type": "cross_model_outlier",
                "severity": "medium",
                "details": outliers
            })
    
    # Calculate overall confidence
    if flags:
        avg_confidence = sum(1.0 - f.get("confidence", 0.5) for f in flags) / len(flags)
        overall_confidence = 1.0 - min(avg_confidence, 0.8)
    else:
        overall_confidence = 1.0
    
    return {
        "has_hallucinations": len(flags) > 0,
        "flags": flags,
        "confidence": overall_confidence,
        "flagged_fields": [f.get("field", "unknown") for f in flags]
    }


def _detect_outliers(
    current_data: Dict[str, Any],
    other_results: List[Dict[str, Any]]
) -> List[str]:
    """Detect fields where current result differs significantly from others"""
    outliers = []
    
    # Compare step counts
    current_steps = len(current_data.get("steps", []))
    other_step_counts = [len(r.get("steps", [])) for r in other_results]
    if other_step_counts:
        avg_steps = sum(other_step_counts) / len(other_step_counts)
        if abs(current_steps - avg_steps) > avg_steps * 0.5:  # 50% difference
            outliers.append(f"Step count ({current_steps} vs avg {avg_steps:.1f})")
    
    # Compare material counts
    current_materials = len(current_data.get("materials", []))
    other_material_counts = [len(r.get("materials", [])) for r in other_results]
    if other_material_counts:
        avg_materials = sum(other_material_counts) / len(other_material_counts)
        if abs(current_materials - avg_materials) > avg_materials * 0.5:
            outliers.append(f"Material count ({current_materials} vs avg {avg_materials:.1f})")
    
    return outliers


def compute_consensus(
    model_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Compute consensus across multiple model results"""
    if len(model_results) < 2:
        return {
            "consensus_available": False,
            "agreed_fields": [],
            "disagreed_fields": []
        }
    
    # For now, simple consensus: fields where all models agree on structure
    # In a full implementation, you'd do deeper semantic comparison
    
    agreed = []
    disagreed = []
    
    # Check step counts
    step_counts = [len(r.get("steps", [])) for r in model_results]
    if len(set(step_counts)) == 1:
        agreed.append("step_count")
    else:
        disagreed.append("step_count")
    
    # Check material counts
    material_counts = [len(r.get("materials", [])) for r in model_results]
    if len(set(material_counts)) == 1:
        agreed.append("material_count")
    else:
        disagreed.append("material_count")
    
    return {
        "consensus_available": True,
        "agreed_fields": agreed,
        "disagreed_fields": disagreed,
        "model_count": len(model_results)
    }

