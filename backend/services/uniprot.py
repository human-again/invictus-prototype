"""
UniProt API integration service
"""
import requests
from typing import List, Dict, Optional


UNIPROT_BASE_URL = "https://rest.uniprot.org/uniprotkb/search"


def search_proteins(query: str, limit: int = 5) -> List[Dict]:
    """
    Search for proteins in UniProt database
    
    Args:
        query: Protein name or identifier to search for
        limit: Maximum number of results to return (default: 5)
    
    Returns:
        List of protein records with id, name, organism, and function
    """
    try:
        params = {
            "query": query,
            "format": "json",
            "size": limit
        }
        
        response = requests.get(UNIPROT_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        results = []
        
        for entry in data.get("results", [])[:limit]:
            # Extract name
            name = ""
            if "proteinDescription" in entry:
                rec_name = entry["proteinDescription"].get("recommendedName", {})
                if rec_name:
                    full_name = rec_name.get("fullName", {})
                    if full_name:
                        name = full_name.get("value", "")
            
            # Extract organism
            organism = ""
            if "organism" in entry:
                organism = entry["organism"].get("scientificName", "")
            
            # Extract function
            function = ""
            if "comments" in entry and entry["comments"]:
                for comment in entry["comments"]:
                    if comment.get("commentType") == "FUNCTION" and "texts" in comment:
                        if comment["texts"]:
                            function = comment["texts"][0].get("value", "")
                            break
            
            protein_info = {
                "id": entry.get("primaryAccession", ""),
                "uniprot_id": entry.get("primaryAccession", ""),
                "name": name or entry.get("uniProtkbId", ""),
                "organism": organism,
                "function": function
            }
            results.append(protein_info)
        
        return results
    
    except requests.exceptions.RequestException as e:
        print(f"Error querying UniProt: {e}")
        return []
    except Exception as e:
        print(f"Error processing UniProt response: {e}")
        return []


def get_protein_details(uniprot_id: str) -> Optional[Dict]:
    """
    Get detailed information for a specific UniProt ID
    Enhanced to include expression medium, purification factors, and other key information
    
    Args:
        uniprot_id: UniProt accession ID
    
    Returns:
        Detailed protein information or None if not found
    """
    try:
        url = f"https://rest.uniprot.org/uniprotkb/{uniprot_id}"
        # NOTE:
        # The UniProt REST API v3 no longer supports requesting multiple legacy
        # field names like ``comments`` or ``features`` in a single call. Passing
        # the old field list results in a 400 response with an "Invalid fields
        # parameter" error, which bubbles up as a 404 to the frontend. Request
        # the full JSON payload instead and let downstream parsing select the
        # pieces we need.
        params = {
            "format": "json"
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        entry = response.json()
        
        # Extract basic info
        protein_info = {
            "id": entry.get("primaryAccession", ""),
            "name": entry.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value", ""),
            "organism": entry.get("organism", {}).get("scientificName", ""),
            "function": "",
            "sequence": entry.get("sequence", {}).get("value", ""),
            "expression_medium": [],
            "solubility": "",
            "stability": "",
            "purification_tags": [],
            "other_factors": []
        }
        
        # Extract function from comments
        if "comments" in entry:
            for comment in entry["comments"]:
                comment_type = comment.get("commentType", "")
                if comment_type == "FUNCTION" and "texts" in comment:
                    if comment["texts"]:
                        protein_info["function"] = comment["texts"][0].get("value", "")
                
                # Extract expression system information
                elif comment_type == "BIOTECHNOLOGY" and "texts" in comment:
                    for text in comment["texts"]:
                        value = text.get("value", "")
                        if "expression" in value.lower() or "medium" in value.lower():
                            protein_info["expression_medium"].append(value)
                
                # Extract solubility information
                elif comment_type == "SOLUBILITY" and "texts" in comment:
                    if comment["texts"]:
                        protein_info["solubility"] = comment["texts"][0].get("value", "")
                
                # Extract stability information
                elif comment_type == "STABILITY" and "texts" in comment:
                    if comment["texts"]:
                        protein_info["stability"] = comment["texts"][0].get("value", "")
        
        # Extract purification tags from features
        if "features" in entry:
            for feature in entry["features"]:
                feature_type = feature.get("type", "")
                if feature_type in ["CHAIN", "PEPTIDE", "REGION"]:
                    description = feature.get("description", "")
                    if any(tag in description.lower() for tag in ["his-tag", "gst", "maltose", "flag", "ha", "myc", "streptavidin"]):
                        protein_info["purification_tags"].append(description)
        
        return protein_info
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching protein details: {e}")
        return None

