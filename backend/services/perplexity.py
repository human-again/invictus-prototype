"""Perplexity Search API integration for publication discovery.

This module uses the Perplexity Search API to retrieve peer-reviewed publications
focused on protein protocols with detailed methods and materials. The search API
returns ranked web results, which we transform into the publication structure used
throughout the backend services.

Reference: https://docs.perplexity.ai/guides/search-quickstart
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import Iterable, List, Dict, Optional, Sequence, Union, TYPE_CHECKING
from urllib.parse import urlparse

if TYPE_CHECKING:
    from services import publications

from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

try:
    from perplexity import Perplexity
    from perplexity.types.search_create_response import Result
except ImportError:  # pragma: no cover - handled gracefully at runtime
    Perplexity = None  # type: ignore[assignment]
    Result = None  # type: ignore[assignment]

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")

DEFAULT_MAX_RESULTS = 10  # per query
DEFAULT_MAX_TOKENS_PER_PAGE = 2048
DEFAULT_LANGUAGE_FILTER = ["en"]

FOCUS_QUERY_TEMPLATES = {
    "purification": [
        "{term} protein purification Materials Methods protocol",
        "{term} chromatography purification experimental procedure",
        "{term} recombinant purification detailed protocol",
    ],
    "synthesis": [
        "{term} protein synthesis Materials Methods",
        "{term} expression construct protocol experimental",
        "{term} recombinant production detailed procedure",
    ],
    "expression": [
        "{term} protein expression Materials Methods",
        "{term} heterologous expression protocol procedure",
        "{term} expression optimization experimental protocol",
    ],
    "general": [
        "{term} protein Materials Methods protocol",
        "{term} experimental procedure detailed protocol",
    ],
}

DOI_PATTERN = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)

_perplexity_client: Optional[Perplexity] = None


def check_perplexity_available() -> bool:
    """Return True when the Perplexity SDK and API key are both available."""

    return bool(PERPLEXITY_API_KEY and PERPLEXITY_API_KEY.strip() and Perplexity)


def get_perplexity_publications(
    protein_name: str,
    uniprot_id: str = "",
    limit: int = 5,
    methodology_focus: str = "purification",
) -> List[Dict]:
    """Retrieve publication candidates using the Perplexity Search API.

    Args:
        protein_name: Human readable protein name.
        uniprot_id: Optional UniProt accession identifier.
        limit: Maximum number of publications to return.
        methodology_focus: Target methodology ("purification", "synthesis",
            "expression", or "general").

    Returns:
        List of publication dictionaries mirroring the structure produced by
        other data sources (PubMed, Semantic Scholar).
    """

    if not check_perplexity_available():
        print("Perplexity SDK not available or API key missing; skipping Perplexity search")
        return []

    search_term = protein_name.strip() if protein_name else uniprot_id.strip()
    if not search_term:
        return []

    client = _get_client()
    queries = _build_queries(search_term, methodology_focus)
    query_payload: Union[str, Sequence[str]] = queries[0] if len(queries) == 1 else queries

    request_kwargs = {
        "max_results": limit,  # Request exactly what we need (5)
        "max_tokens_per_page": 3000,  # Increased for more content
        # Note: search_mode not supported by Search API (only Chat API)
        "search_domain_filter": [  # Whitelist trusted academic domains (max 20)
            "ncbi.nlm.nih.gov",
            "pmc.ncbi.nlm.nih.gov",
            "pubmed.ncbi.nlm.nih.gov",
            "nature.com",
            "science.org",
            "cell.com",
            "plos.org",
            "plosbiology.org",
            "acs.org",
            "rsc.org",
            "springer.com",
            "springerlink.com",
            "wiley.com",
            "onlinelibrary.wiley.com",
            "elsevier.com",
            "sciencedirect.com",
            "frontiersin.org",
            "mdpi.com",
            "biorxiv.org",
            "arxiv.org",
        ],
        "search_language_filter": DEFAULT_LANGUAGE_FILTER,
    }

    # Log the query being sent to Perplexity
    print("\n" + "=" * 80)
    print("PERPLEXITY ACADEMIC SEARCH REQUEST")
    print("=" * 80)
    print(f"Search Term: {search_term}")
    print(f"Methodology Focus: {methodology_focus}")
    print(f"Domain Filter: {len(request_kwargs['search_domain_filter'])} trusted academic domains")
    print(f"Query Payload: {json.dumps(query_payload if isinstance(query_payload, str) else list(query_payload), indent=2)}")
    print("=" * 80 + "\n")
    
    logger.info("=" * 80)
    logger.info("PERPLEXITY ACADEMIC SEARCH REQUEST")
    logger.info("=" * 80)
    logger.info(f"Search Term: {search_term}")
    logger.info(f"Methodology Focus: {methodology_focus}")
    logger.info(f"Domain Filter: {len(request_kwargs['search_domain_filter'])} trusted academic domains")
    logger.info(f"Query Payload: {json.dumps(query_payload if isinstance(query_payload, str) else list(query_payload), indent=2)}")
    logger.info("=" * 80)

    try:
        response = client.search.create(query=query_payload, **request_kwargs)
        
        # Log the response from Perplexity
        print("\n" + "=" * 80)
        print("PERPLEXITY API RESPONSE")
        print("=" * 80)
        print(f"Search ID: {getattr(response, 'id', 'N/A')}")
        
        # Count results
        result_count = len(response.results) if hasattr(response, 'results') and response.results else 0
        print(f"Number of Results: {result_count}")
        
        # Log each result in detail
        if result_count > 0:
            for idx, result in enumerate(response.results, 1):
                print(f"\n--- Result {idx} ---")
                print(f"Title: {getattr(result, 'title', 'N/A')}")
                print(f"URL: {getattr(result, 'url', 'N/A')}")
                snippet = getattr(result, 'snippet', '')
                print(f"Snippet (first 200 chars): {snippet[:200] if snippet else 'N/A'}...")
        print("=" * 80 + "\n")
        
        logger.info("=" * 80)
        logger.info("PERPLEXITY API RESPONSE")
        logger.info("=" * 80)
        logger.info(f"Search ID: {getattr(response, 'id', 'N/A')}")
        logger.info(f"Number of Results: {result_count}")
        if result_count > 0:
            for idx, result in enumerate(response.results, 1):
                logger.info(f"\n--- Result {idx} ---")
                logger.info(f"Title: {getattr(result, 'title', 'N/A')}")
                logger.info(f"URL: {getattr(result, 'url', 'N/A')}")
                snippet = getattr(result, 'snippet', '')
                logger.info(f"Snippet (first 200 chars): {snippet[:200] if snippet else 'N/A'}...")
        logger.info("=" * 80)
        
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error(f"Perplexity Search API request failed: {exc}")
        print(f"Perplexity Search API request failed: {exc}")
        return []

    raw_results = list(_flatten_results(response.results))
    if not raw_results:
        return []

    publications: List[Dict] = []
    seen_urls: set[str] = set()

    logger.info(f"Processing {len(raw_results)} academic results from Perplexity")

    for idx, result in enumerate(raw_results, 1):
        if not result or not getattr(result, "url", None):
            logger.info(f"Result {idx}: Skipped (no URL)")
            continue

        url = result.url.strip()
        if not url or url in seen_urls:
            logger.info(f"Result {idx}: Skipped (duplicate URL)")
            continue

        seen_urls.add(url)
        snippet = (result.snippet or "").strip()
        title = (result.title or "").strip()
        doi = _extract_doi(snippet) or _extract_doi(title) or _extract_doi(url)
        year = _extract_year(getattr(result, "date", None), getattr(result, "last_updated", None))
        journal = _guess_journal_from_url(url)
        
        logger.info(f"\n--- Processing Academic Result {idx} ---")
        logger.info(f"Title: {title}")
        logger.info(f"URL: {url}")
        logger.info(f"Journal: {journal}")
        logger.info(f"DOI: {doi or 'Not found'}")
        logger.info(f"Year: {year}")
        logger.info(f"Snippet length: {len(snippet)} characters")

        # Build publication dict
        publication_data = {
            "title": title,
            "abstract": snippet,
            "authors": "",
            "year": year,
            "journal": journal,
            "url": url,
            "doi": doi or "",
            "pmid": "",
            "source": "Perplexity Academic Search",
            "protocol_preview": snippet,
            "perplexity_search_id": getattr(response, "id", ""),
        }
        
        # Priority: Attempt full-text retrieval for all academic results
        from services.publications import get_publication_full_text_enhanced, extract_materials_methods_section
        
        logger.info(f"Attempting full-text retrieval...")
        full_text = get_publication_full_text_enhanced(publication_data)
        
        if full_text and len(full_text) > len(snippet):
            logger.info(f"✓ Full text retrieved ({len(full_text)} chars)")
            
            # Extract Materials & Methods section specifically
            methods_section = extract_materials_methods_section(pmid="", full_text=full_text)
            
            if methods_section and len(methods_section) > 200:
                publication_data["protocol_preview"] = methods_section
                logger.info(f"✓ Materials & Methods extracted ({len(methods_section)} chars)")
            else:
                publication_data["protocol_preview"] = full_text
                logger.info(f"Using full text (Materials & Methods section not clearly identified)")
        else:
            logger.info(f"Full text unavailable, using snippet ({len(snippet)} chars)")
        
        publications.append(publication_data)
        logger.info(f"✓ Academic publication {idx} added")

        if len(publications) >= limit:
            break

    logger.info(f"\n✓ Final publication count: {len(publications)} academic sources")
    return publications[:limit]


def _get_client() -> Perplexity:
    """Create (or return cached) Perplexity SDK client."""

    global _perplexity_client
    if _perplexity_client is None:
        if not check_perplexity_available():
            raise RuntimeError("Perplexity API key or SDK missing")
        _perplexity_client = Perplexity(api_key=PERPLEXITY_API_KEY)
    return _perplexity_client


def _build_queries(search_term: str, focus: str) -> List[str]:
    focus = focus.lower().strip() if focus else "purification"
    templates = FOCUS_QUERY_TEMPLATES.get(focus, FOCUS_QUERY_TEMPLATES["purification"])

    queries = []
    for template in templates:
        built = template.format(term=search_term)
        if built not in queries:
            queries.append(built)

    # Fall back to a generic catch-all query at the end
    generic_query = f"{search_term} protein protocol materials methods step-by-step"
    if generic_query not in queries:
        queries.append(generic_query)

    return queries


def _flatten_results(results: Iterable) -> Iterable[Result]:
    if not results:
        return []

    flattened: List[Result] = []

    for item in results:
        if item is None:
            continue
        if isinstance(item, (list, tuple)):
            for sub_item in item:
                if sub_item is not None:
                    flattened.append(sub_item)
        else:
            flattened.append(item)

    return flattened


def _extract_doi(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    match = DOI_PATTERN.search(text)
    if match:
        return match.group(0)
    return None


def _extract_year(*values: Optional[str]) -> str:
    for value in values:
        if not value:
            continue
        match = re.search(r"(19|20)\d{2}", value)
        if match:
            return match.group(0)
    return ""


def _guess_journal_from_url(url: str) -> str:
    try:
        hostname = urlparse(url).netloc
    except ValueError:
        return ""
    hostname = hostname.lower().strip()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname

