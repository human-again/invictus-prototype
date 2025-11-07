"""
Comparison and diff tools for model results
Provides structured diff, consensus detection, and outlier identification
"""
import json
from typing import Dict, List, Any, Optional
from collections import defaultdict


def compute_json_diff(obj1: Dict[str, Any], obj2: Dict[str, Any]) -> Dict[str, Any]:
    """Compute structured diff between two JSON objects"""
    diff = {
        "added": {},
        "removed": {},
        "modified": {},
        "unchanged": {}
    }
    
    # Get all keys
    keys1 = set(obj1.keys())
    keys2 = set(obj2.keys())
    
    # Added keys
    for key in keys2 - keys1:
        diff["added"][key] = obj2[key]
    
    # Removed keys
    for key in keys1 - keys2:
        diff["removed"][key] = obj1[key]
    
    # Modified or unchanged keys
    for key in keys1 & keys2:
        val1 = obj1[key]
        val2 = obj2[key]
        
        if isinstance(val1, dict) and isinstance(val2, dict):
            # Recursive diff for nested objects
            nested_diff = compute_json_diff(val1, val2)
            if any(nested_diff[k] for k in ["added", "removed", "modified"]):
                diff["modified"][key] = nested_diff
            else:
                diff["unchanged"][key] = val1
        elif isinstance(val1, list) and isinstance(val2, list):
            # Compare lists
            if val1 != val2:
                diff["modified"][key] = {
                    "old": val1,
                    "new": val2,
                    "old_length": len(val1),
                    "new_length": len(val2)
                }
            else:
                diff["unchanged"][key] = val1
        elif val1 != val2:
            diff["modified"][key] = {
                "old": val1,
                "new": val2
            }
        else:
            diff["unchanged"][key] = val1
    
    return diff


def detect_outliers(
    model_results: List[Dict[str, Any]],
    threshold: float = 2.0
) -> Dict[str, List[str]]:
    """Detect statistical outliers across model results"""
    outliers = defaultdict(list)
    
    if len(model_results) < 3:
        return {}  # Need at least 3 for outlier detection
    
    # Analyze step counts
    step_counts = [len(r.get("steps", [])) for r in model_results]
    if step_counts:
        mean_steps = sum(step_counts) / len(step_counts)
        std_steps = _calculate_std(step_counts, mean_steps)
        
        for i, count in enumerate(step_counts):
            if std_steps > 0:
                z_score = abs((count - mean_steps) / std_steps)
                if z_score > threshold:
                    outliers["step_count"].append(f"Model {i+1}: {count} steps (mean: {mean_steps:.1f})")
    
    # Analyze material counts
    material_counts = [len(r.get("materials", [])) for r in model_results]
    if material_counts:
        mean_materials = sum(material_counts) / len(material_counts)
        std_materials = _calculate_std(material_counts, mean_materials)
        
        for i, count in enumerate(material_counts):
            if std_materials > 0:
                z_score = abs((count - mean_materials) / std_materials)
                if z_score > threshold:
                    outliers["material_count"].append(f"Model {i+1}: {count} materials (mean: {mean_materials:.1f})")
    
    return dict(outliers)


def _calculate_std(values: List[float], mean: float) -> float:
    """Calculate standard deviation"""
    if len(values) < 2:
        return 0.0
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def compute_consensus_view(
    model_results: List[Dict[str, Any]],
    model_ids: List[str]
) -> Dict[str, Any]:
    """Generate consensus view showing agreed vs disagreed fields"""
    if len(model_results) < 2:
        return {
            "consensus_available": False,
            "message": "Need at least 2 models for consensus"
        }
    
    agreed = {}
    disagreed = {}
    
    # Compare step counts
    step_counts = [len(r.get("steps", [])) for r in model_results]
    if len(set(step_counts)) == 1:
        agreed["step_count"] = step_counts[0]
    else:
        disagreed["step_count"] = {
            "values": step_counts,
            "models": model_ids
        }
    
    # Compare material counts
    material_counts = [len(r.get("materials", [])) for r in model_results]
    if len(set(material_counts)) == 1:
        agreed["material_count"] = material_counts[0]
    else:
        disagreed["material_count"] = {
            "values": material_counts,
            "models": model_ids
        }
    
    # Compare equipment lists (simplified)
    equipment_lists = [set(r.get("equipment", [])) for r in model_results]
    common_equipment = set.intersection(*equipment_lists) if equipment_lists else set()
    if common_equipment:
        agreed["common_equipment"] = list(common_equipment)
    
    return {
        "consensus_available": True,
        "agreed_fields": agreed,
        "disagreed_fields": disagreed,
        "model_count": len(model_results)
    }


def generate_comparison_report(
    model_results: List[Dict[str, Any]],
    model_ids: List[str],
    metadata: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """Generate comprehensive comparison report"""
    # Compute pairwise diffs
    diffs = []
    for i in range(len(model_results)):
        for j in range(i + 1, len(model_results)):
            diff = compute_json_diff(model_results[i], model_results[j])
            diffs.append({
                "model1": model_ids[i],
                "model2": model_ids[j],
                "diff": diff
            })
    
    # Detect outliers
    outliers = detect_outliers(model_results)
    
    # Compute consensus
    consensus = compute_consensus_view(model_results, model_ids)
    
    # Add metadata if available
    report = {
        "model_count": len(model_results),
        "model_ids": model_ids,
        "pairwise_diffs": diffs,
        "outliers": outliers,
        "consensus": consensus
    }
    
    if metadata:
        report["metadata"] = metadata
    
    return report

