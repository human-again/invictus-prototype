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
    
    Args:
        uniprot_id: UniProt accession ID
    
    Returns:
        Detailed protein information or None if not found
    """
    try:
        url = f"https://rest.uniprot.org/uniprotkb/{uniprot_id}"
        params = {
            "format": "json",
            "fields": "accession,id,protein_name,organism_name,function,sequence"
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        entry = response.json()
        return {
            "id": entry.get("primaryAccession", ""),
            "name": entry.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value", ""),
            "organism": entry.get("organism", {}).get("scientificName", ""),
            "function": entry.get("comments", [{}])[0].get("texts", [{}])[0].get("value", "") if entry.get("comments") else "",
            "sequence": entry.get("sequence", {}).get("value", "")
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching protein details: {e}")
        return None

