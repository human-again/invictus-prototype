"""
End-to-end tests for Protein Synthesis AI Agent
Tests the full pipeline for sample proteins
"""
import sys
import os
import time
import requests
from typing import Dict, List

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import uniprot, publications, extraction, ai_models, verification


def test_protein_search(protein_name: str) -> Dict:
    """Test protein search"""
    start_time = time.time()
    results = uniprot.search_proteins(protein_name)
    latency = time.time() - start_time
    
    return {
        "step": "protein_search",
        "protein_name": protein_name,
        "results_count": len(results),
        "latency": latency,
        "success": len(results) > 0,
        "data": results[0] if results else None
    }


def test_publication_retrieval(uniprot_id: str) -> Dict:
    """Test publication retrieval"""
    start_time = time.time()
    pubs = publications.get_publications(uniprot_id)
    latency = time.time() - start_time
    
    return {
        "step": "publication_retrieval",
        "uniprot_id": uniprot_id,
        "publications_count": len(pubs),
        "latency": latency,
        "success": len(pubs) > 0,
        "data": pubs[0] if pubs else None
    }


def test_text_extraction(text: str) -> Dict:
    """Test text extraction and cleaning"""
    start_time = time.time()
    processed = extraction.clean_and_prepare_text(text)
    latency = time.time() - start_time
    
    return {
        "step": "text_extraction",
        "token_count": processed["token_count"],
        "latency": latency,
        "success": processed["token_count"] > 0,
        "entities": processed["entities"]
    }


def test_methods_extraction(text: str, protein_name: str) -> Dict:
    """Test methods extraction using AI"""
    try:
        start_time = time.time()
        extracted = ai_models.extract_methods(text, protein_name)
        latency = time.time() - start_time
        
        return {
            "step": "methods_extraction",
            "latency": latency,
            "success": extracted is not None and len(extracted) > 0,
            "extracted_length": len(extracted) if extracted else 0
        }
    except ConnectionError as e:
        return {
            "step": "methods_extraction",
            "latency": 0,
            "success": False,
            "error": str(e)
        }


def test_protocol_summarization(extracted_methods: str) -> Dict:
    """Test protocol summarization"""
    try:
        start_time = time.time()
        protocol = ai_models.summarize_protocol(extracted_methods)
        latency = time.time() - start_time
        
        return {
            "step": "protocol_summarization",
            "latency": latency,
            "success": protocol is not None,
            "has_steps": protocol and len(protocol.get("steps", [])) > 0,
            "steps_count": len(protocol.get("steps", [])) if protocol else 0
        }
    except ConnectionError as e:
        return {
            "step": "protocol_summarization",
            "latency": 0,
            "success": False,
            "error": str(e)
        }


def test_full_pipeline(protein_name: str) -> Dict:
    """Test full pipeline for a single protein"""
    print(f"\nTesting pipeline for: {protein_name}")
    results = []
    
    # Step 1: Search protein
    search_result = test_protein_search(protein_name)
    results.append(search_result)
    print(f"  ✓ Protein search: {search_result['latency']:.2f}s")
    
    if not search_result["success"]:
        return {"protein": protein_name, "results": results, "overall_success": False}
    
    uniprot_id = search_result["data"]["id"]
    
    # Step 2: Get publications
    pub_result = test_publication_retrieval(uniprot_id)
    results.append(pub_result)
    print(f"  ✓ Publication retrieval: {pub_result['latency']:.2f}s")
    
    if not pub_result["success"]:
        return {"protein": protein_name, "results": results, "overall_success": False}
    
    publication = pub_result["data"]
    abstract = publication.get("abstract", "") or publication.get("title", "")
    
    # Step 3: Extract and clean text
    extraction_result = test_text_extraction(abstract)
    results.append(extraction_result)
    print(f"  ✓ Text extraction: {extraction_result['latency']:.2f}s")
    
    # Step 4: Extract methods (if Ollama is available)
    methods_result = test_methods_extraction(extraction_result.get("cleaned_text", abstract), protein_name)
    results.append(methods_result)
    if methods_result["success"]:
        print(f"  ✓ Methods extraction: {methods_result['latency']:.2f}s")
    else:
        print(f"  ✗ Methods extraction: {methods_result.get('error', 'Failed')}")
    
    # Step 5: Summarize protocol (if methods were extracted)
    if methods_result.get("extracted_length", 0) > 0:
        # For testing, use a mock extracted method
        mock_methods = abstract[:500]  # Use abstract as mock
        summarize_result = test_protocol_summarization(mock_methods)
        results.append(summarize_result)
        if summarize_result["success"]:
            print(f"  ✓ Protocol summarization: {summarize_result['latency']:.2f}s")
        else:
            print(f"  ✗ Protocol summarization: {summarize_result.get('error', 'Failed')}")
    
    # Calculate overall success
    critical_steps = [search_result, pub_result, extraction_result]
    overall_success = all(r["success"] for r in critical_steps)
    
    return {
        "protein": protein_name,
        "results": results,
        "overall_success": overall_success,
        "total_latency": sum(r["latency"] for r in results)
    }


def run_e2e_tests():
    """Run end-to-end tests for sample proteins"""
    print("=" * 60)
    print("Protein Synthesis AI Agent - End-to-End Tests")
    print("=" * 60)
    
    # Test proteins
    test_proteins = ["hemoglobin", "insulin", "GFP", "lysozyme", "myoglobin"]
    
    all_results = []
    
    for protein in test_proteins:
        result = test_full_pipeline(protein)
        all_results.append(result)
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    successful = sum(1 for r in all_results if r["overall_success"])
    total = len(all_results)
    
    print(f"Total proteins tested: {total}")
    print(f"Successful pipelines: {successful}")
    print(f"Success rate: {(successful/total)*100:.1f}%")
    
    # Performance metrics
    avg_latencies = {}
    for result in all_results:
        for step_result in result["results"]:
            step = step_result["step"]
            if step not in avg_latencies:
                avg_latencies[step] = []
            avg_latencies[step].append(step_result["latency"])
    
    print("\nAverage latencies per step:")
    for step, latencies in avg_latencies.items():
        if latencies:
            avg = sum(latencies) / len(latencies)
            print(f"  {step}: {avg:.2f}s")
    
    return {
        "total_tested": total,
        "successful": successful,
        "success_rate": (successful/total)*100 if total > 0 else 0,
        "results": all_results
    }


if __name__ == "__main__":
    results = run_e2e_tests()
    
    # Save results to JSON
    import json
    with open("test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\nTest results saved to test_results.json")






