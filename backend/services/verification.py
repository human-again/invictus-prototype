"""
Protocol verification service
Compares AI-generated protocols against reference dataset
"""
import csv
import os
from difflib import SequenceMatcher
from typing import Dict, List, Optional
import json


def load_reference_dataset(file_path: str = None) -> List[Dict]:
    """
    Load reference dataset from CSV
    
    Args:
        file_path: Path to reference CSV file
    
    Returns:
        List of reference protein records
    """
    if file_path is None:
        # Default path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, "..", "data", "reference.csv")
    
    references = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                references.append({
                    "protein_name": row.get("protein_name", ""),
                    "uniprot_id": row.get("uniprot_id", ""),
                    "reference_protocol": row.get("reference_protocol", ""),
                    "publication_url": row.get("publication_url", "")
                })
    except FileNotFoundError:
        print(f"Warning: Reference dataset not found at {file_path}")
    except Exception as e:
        print(f"Error loading reference dataset: {e}")
    
    return references


def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity score between two texts using SequenceMatcher
    
    Args:
        text1: First text
        text2: Second text
    
    Returns:
        Similarity ratio between 0 and 1
    """
    if not text1 or not text2:
        return 0.0
    
    # Normalize texts
    text1 = text1.lower().strip()
    text2 = text2.lower().strip()
    
    return SequenceMatcher(None, text1, text2).ratio()


def verify_protocol(ai_protocol: str, reference_protocol: str) -> Dict:
    """
    Verify AI-generated protocol against reference protocol
    
    Args:
        ai_protocol: AI-generated protocol text
        reference_protocol: Reference protocol text
    
    Returns:
        Dictionary with similarity score and details
    """
    similarity = calculate_similarity(ai_protocol, reference_protocol)
    
    return {
        "similarity_score": similarity,
        "ai_protocol": ai_protocol,
        "reference_protocol": reference_protocol,
        "is_valid": similarity >= 0.7
    }


def verify_against_dataset(ai_protocol: str, protein_name: str = "", uniprot_id: str = "") -> Optional[Dict]:
    """
    Verify AI protocol against reference dataset
    
    Args:
        ai_protocol: AI-generated protocol
        protein_name: Protein name to match
        uniprot_id: UniProt ID to match
    
    Returns:
        Verification result or None if no match found
    """
    references = load_reference_dataset()
    
    # Try to find matching reference
    matching_ref = None
    
    for ref in references:
        if uniprot_id and ref.get("uniprot_id") == uniprot_id:
            matching_ref = ref
            break
        elif protein_name and ref.get("protein_name").lower() == protein_name.lower():
            matching_ref = ref
            break
    
    if not matching_ref:
        return None
    
    result = verify_protocol(ai_protocol, matching_ref["reference_protocol"])
    result["protein_name"] = matching_ref["protein_name"]
    result["uniprot_id"] = matching_ref["uniprot_id"]
    result["reference_publication"] = matching_ref["publication_url"]
    
    return result


def generate_validation_report() -> Dict:
    """
    Generate validation report for all proteins in reference dataset
    
    Returns:
        Dictionary with validation metrics
    """
    references = load_reference_dataset()
    results = []
    total_similarity = 0.0
    valid_count = 0
    
    for ref in references:
        # Note: In a real scenario, we would run the full pipeline here
        # For now, this is a template for the validation report structure
        results.append({
            "protein_name": ref["protein_name"],
            "uniprot_id": ref["uniprot_id"],
            "status": "pending"  # Would be "completed" after running pipeline
        })
    
    return {
        "total_proteins": len(references),
        "tested": 0,  # Would be updated after actual testing
        "mean_similarity": 0.0,
        "accuracy": 0.0,
        "results": results
    }


def save_validation_report(report: Dict, file_path: str = "validation_report.json"):
    """
    Save validation report to JSON file
    
    Args:
        report: Validation report dictionary
        file_path: Path to save report
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving validation report: {e}")






