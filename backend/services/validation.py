"""
Validation service for JSON schema validation and data quality checks
"""
import json
import re
from typing import Dict, List, Optional, Any


def validate_protocol_json(protocol_data: Any) -> Dict[str, Any]:
    """Validate protocol JSON structure"""
    errors = []
    warnings = []
    
    if not isinstance(protocol_data, dict):
        return {
            "valid": False,
            "errors": ["Protocol must be a JSON object"],
            "warnings": []
        }
    
    # Check required top-level fields
    required_fields = ["steps", "materials"]
    for field in required_fields:
        if field not in protocol_data:
            errors.append(f"Missing required field: {field}")
    
    # Validate steps
    if "steps" in protocol_data:
        steps = protocol_data["steps"]
        if not isinstance(steps, list):
            errors.append("'steps' must be an array")
        else:
            for i, step in enumerate(steps):
                if not isinstance(step, dict):
                    errors.append(f"Step {i+1} must be an object")
                else:
                    if "step_number" not in step:
                        errors.append(f"Step {i+1} missing 'step_number'")
                    if "description" not in step:
                        errors.append(f"Step {i+1} missing 'description'")
    
    # Validate materials
    if "materials" in protocol_data:
        materials = protocol_data["materials"]
        if not isinstance(materials, list):
            errors.append("'materials' must be an array")
        else:
            for i, material in enumerate(materials):
                if isinstance(material, dict):
                    if "name" not in material:
                        warnings.append(f"Material {i+1} missing 'name'")
    
    # Validate equipment
    if "equipment" in protocol_data:
        if not isinstance(protocol_data["equipment"], list):
            warnings.append("'equipment' should be an array")
    
    # Validate conditions
    if "conditions" in protocol_data:
        conditions = protocol_data["conditions"]
        if not isinstance(conditions, list):
            warnings.append("'conditions' should be an array")
        else:
            for i, condition in enumerate(conditions):
                if isinstance(condition, dict):
                    if "type" not in condition or "value" not in condition:
                        warnings.append(f"Condition {i+1} missing 'type' or 'value'")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def validate_json_string(json_string: str) -> Dict[str, Any]:
    """Validate and parse JSON string"""
    try:
        # Handle None or empty string
        if not json_string or not isinstance(json_string, str):
            return {
                "valid": False,
                "errors": ["JSON parsing error: Empty or invalid input"],
                "warnings": [],
                "parsed_data": None
            }
        
        # Try to extract JSON from markdown code blocks
        cleaned = json_string.strip()
        if not cleaned:
            return {
                "valid": False,
                "errors": ["JSON parsing error: Expecting value: line 1 column 1 (char 0)"],
                "warnings": [],
                "parsed_data": None
            }
        
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        if not cleaned:
            return {
                "valid": False,
                "errors": ["JSON parsing error: Expecting value: line 1 column 1 (char 0)"],
                "warnings": [],
                "parsed_data": None
            }
        
        data = json.loads(cleaned)
        validation = validate_protocol_json(data)
        validation["parsed_data"] = data
        return validation
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "errors": [f"JSON parsing error: {str(e)}"],
            "warnings": [],
            "parsed_data": None
        }
    except Exception as e:
        return {
            "valid": False,
            "errors": [f"Validation error: {str(e)}"],
            "warnings": [],
            "parsed_data": None
        }

