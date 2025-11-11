"""
Publication retrieval service using open-source APIs
Primary: Perplexity.ai API
Fallback: PubMed/PMC (NCBI E-utilities) and Semantic Scholar
Enhanced with Materials and Methods extraction
"""
import requests
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
import time
import os
from services import extraction
from services import perplexity

# PubMed/PMC APIs (NCBI E-utilities - free, open source)
PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

# Semantic Scholar API (free, open source - fallback)
SEMANTIC_SCHOLAR_URL = "https://api.semanticscholar.org/graph/v1/paper/search"

# Unpaywall API (free, no auth required)
UNPAYWALL_API_URL = "https://api.unpaywall.org/v2"
UNPAYWALL_EMAIL = os.getenv("UNPAYWALL_EMAIL", "invictus-plan@example.com")  # Required for API usage


def get_pubmed_publications(protein_name: str, uniprot_id: str = "", limit: int = 5, methodology_focus: str = "purification") -> List[Dict]:
    """
    Retrieve publications from PubMed/PMC using NCBI E-utilities
    Enhanced with semantic query construction focused on specific methodology (purification, synthesis, etc.)
    
    Args:
        protein_name: Name of the protein
        uniprot_id: UniProt accession ID (optional)
        limit: Maximum number of results
        methodology_focus: Focus area - "purification", "synthesis", "expression", or "general" (default: "purification")
    
    Returns:
        List of publication dictionaries sorted by relevance
    """
    try:
        # Build methodology-specific search terms
        if methodology_focus == "purification":
            # Focus on purification methodology with specific techniques
            methodology_terms = """(
                protein purification[Title/Abstract] OR 
                "protein isolation"[Title/Abstract] OR 
                "protein extraction"[Title/Abstract] OR
                chromatography[Title/Abstract] OR
                "affinity purification"[Title/Abstract] OR
                "ion exchange"[Title/Abstract] OR
                "size exclusion"[Title/Abstract] OR
                "gel filtration"[Title/Abstract] OR
                "protein purification method"[Title/Abstract] OR
                "purification protocol"[Title/Abstract]
            )"""
        elif methodology_focus == "synthesis":
            methodology_terms = "(protein synthesis[Title/Abstract] OR protein expression[Title/Abstract] OR recombinant protein[Title/Abstract])"
        elif methodology_focus == "expression":
            methodology_terms = "(protein expression[Title/Abstract] OR recombinant expression[Title/Abstract] OR heterologous expression[Title/Abstract])"
        else:  # general
            methodology_terms = "(protein synthesis OR protein expression OR protein purification OR protein method)"
        
        # Enhanced semantic query construction
        if protein_name:
            # Use protein name with related terms for better semantic matching
            # Search in title/abstract for protein-specific terms
            base_query = f"({protein_name}[Title/Abstract] OR {protein_name}[MeSH Terms])"
            if uniprot_id:
                base_query = f"({protein_name}[Title/Abstract] OR {protein_name}[MeSH Terms] OR {uniprot_id}[All Fields])"
            peer_review_filter = "(peer review[Filter] OR journal article[Publication Type])"
            search_query = f"{base_query} AND {methodology_terms} AND {peer_review_filter}"
        elif uniprot_id:
            # Fallback to UniProt ID with methodology and peer-review filter
            search_query = f"{uniprot_id}[All Fields] AND {methodology_terms} AND (peer review[Filter] OR journal article[Publication Type])"
        else:
            return []
        
        # Step 1: Search for PMIDs with relevance sorting
        search_params = {
            "db": "pubmed",
            "term": search_query,
            "retmax": min(limit * 2, 100),  # Fetch more to allow filtering
            "retmode": "json",
            "sort": "relevance"  # Use relevance ranking instead of date
        }
        
        search_response = requests.get(PUBMED_SEARCH_URL, params=search_params, timeout=15)
        search_response.raise_for_status()
        
        search_data = search_response.json()
        pmids = search_data.get("esearchresult", {}).get("idlist", [])
        
        if not pmids:
            return []
        
        # Step 2: Fetch publication details
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids[:limit]),
            "retmode": "xml",
            "rettype": "abstract"
        }
        
        fetch_response = requests.get(PUBMED_FETCH_URL, params=fetch_params, timeout=15)
        fetch_response.raise_for_status()
        
        # Parse XML response
        root = ET.fromstring(fetch_response.content)
        
        results = []
        # Find all articles
        articles = root.findall(".//PubmedArticle")
        
        if not articles:
            return []
        
        for article in articles:
            try:
                # Extract title
                title_elem = article.find(".//ArticleTitle")
                title = ""
                if title_elem is not None and title_elem.text:
                    title = title_elem.text.strip()
                
                if not title:
                    continue  # Skip articles without titles
                
                # Extract abstract
                abstract = ""
                abstract_elem = article.find(".//AbstractText")
                if abstract_elem is not None:
                    abstract = "".join(abstract_elem.itertext()).strip()
                
                # Extract authors
                authors_list = []
                for author in article.findall(".//Author"):
                    last_name = author.findtext("LastName", "")
                    first_name = author.findtext("FirstName", "")
                    if last_name:
                        authors_list.append(f"{first_name} {last_name}".strip())
                
                # Extract publication date
                year = ""
                pub_date_elem = article.find(".//PubDate/Year")
                if pub_date_elem is not None and pub_date_elem.text:
                    year = pub_date_elem.text.strip()
                
                # Extract journal
                journal = ""
                journal_elem = article.find(".//Journal/Title")
                if journal_elem is not None and journal_elem.text:
                    journal = journal_elem.text.strip()
                
                # Extract PMID
                pmid = ""
                pmid_elem = article.find(".//PMID")
                if pmid_elem is not None and pmid_elem.text:
                    pmid = pmid_elem.text.strip()
                
                # Extract DOI if available
                doi = ""
                for article_id in article.findall(".//ArticleId"):
                    if article_id.get("IdType") == "doi" and article_id.text:
                        doi = article_id.text.strip()
                        break
                
                pub_info = {
                    "title": title,
                    "abstract": abstract,
                    "authors": ", ".join(authors_list[:5]) if authors_list else "",
                    "year": year,
                    "journal": journal,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}" if pmid else "",
                    "pmid": pmid,
                    "doi": doi,
                    "source": "PubMed"
                }
                results.append(pub_info)
                
            except Exception as e:
                print(f"Error parsing PubMed article: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        return results
        
    except requests.exceptions.RequestException as e:
        print(f"Error querying PubMed: {e}")
        return []
    except ET.ParseError as e:
        print(f"Error parsing PubMed XML: {e}")
        return []
    except Exception as e:
        print(f"Error processing PubMed response: {e}")
        return []


def get_semantic_scholar_publications(protein_name: str, limit: int = 5, methodology_focus: str = "purification") -> List[Dict]:
    """
    Retrieve publications from Semantic Scholar API with enhanced semantic search
    Uses citation metrics, peer-reviewed filtering, and better field selection
    Focused on specific methodology (purification, synthesis, etc.)
    
    Args:
        protein_name: Name of the protein
        limit: Maximum number of results
        methodology_focus: Focus area - "purification", "synthesis", "expression", or "general" (default: "purification")
    
    Returns:
        List of publication dictionaries sorted by influence and citations
    """
    try:
        # Add small delay to respect rate limits
        time.sleep(0.5)
        
        # Enhanced query construction focused on methodology
        if methodology_focus == "purification":
            # Focus on purification methodology with specific techniques
            query = f"{protein_name} protein purification methodology chromatography isolation extraction affinity purification protocol"
        elif methodology_focus == "synthesis":
            query = f"{protein_name} protein synthesis expression recombinant production"
        elif methodology_focus == "expression":
            query = f"{protein_name} protein expression recombinant heterologous overexpression"
        else:  # general
            query = f"{protein_name} protein synthesis expression purification"
        
        # Enhanced fields: include citation metrics, open access status, and publication types
        fields = "title,abstract,authors,year,venue,externalIds,url,citationCount,influentialCitationCount,isOpenAccess,publicationTypes,openAccessPdf"
        
        params = {
            "query": query,
            "limit": min(limit * 2, 50),  # Fetch more to filter and rank
            "fields": fields,
            "sort": "relevance"  # Use semantic relevance ranking
        }
        
        response = requests.get(SEMANTIC_SCHOLAR_URL, params=params, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        papers = data.get("data", [])
        
        # Filter and rank results
        filtered_papers = []
        for paper in papers:
            # Filter for peer-reviewed publications (prefer journal articles)
            pub_types = paper.get("publicationTypes", [])
            # Accept if it's a journal article, or if no types specified (assume valid)
            if not pub_types or "JournalArticle" in pub_types or "Review" in pub_types:
                filtered_papers.append(paper)
        
        # If no filtered results, use all papers (lenient mode)
        if not filtered_papers:
            filtered_papers = papers
        
        # Sort by citation metrics (influential citations first, then total citations)
        filtered_papers.sort(
            key=lambda p: (
                p.get("influentialCitationCount", 0) * 2 +  # Weight influential citations higher
                p.get("citationCount", 0),
                p.get("year", 0) or 0  # Then by recency
            ),
            reverse=True
        )
        
        results = []
        for paper in filtered_papers[:limit]:
            # Extract authors
            authors_list = []
            for author in paper.get("authors", [])[:5]:
                authors_list.append(author.get("name", ""))
            
            # Get external IDs
            external_ids = paper.get("externalIds", {})
            pmid = external_ids.get("PubMed", "")
            doi = external_ids.get("DOI", "")
            
            # Get open access PDF URL if available
            open_access_pdf = paper.get("openAccessPdf", {})
            pdf_url = open_access_pdf.get("url", "") if open_access_pdf else ""
            
            pub_info = {
                "title": paper.get("title", ""),
                "abstract": paper.get("abstract", ""),
                "authors": ", ".join(authors_list) if authors_list else "",
                "year": str(paper.get("year", "")) if paper.get("year") else "",
                "journal": paper.get("venue", ""),
                "url": paper.get("url", ""),
                "pmid": pmid,
                "doi": doi,
                "source": "Semantic Scholar",
                "citation_count": paper.get("citationCount", 0),
                "influential_citations": paper.get("influentialCitationCount", 0),
                "is_open_access": paper.get("isOpenAccess", False),
                "pdf_url": pdf_url
            }
            results.append(pub_info)
        
        return results
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print("Semantic Scholar rate limit exceeded, skipping fallback")
        else:
            print(f"Error querying Semantic Scholar: {e}")
        return []
    except requests.exceptions.RequestException as e:
        print(f"Error querying Semantic Scholar: {e}")
        return []
    except Exception as e:
        print(f"Error processing Semantic Scholar response: {e}")
        return []


def get_publications_enhanced(uniprot_id: str, protein_name: str = "", limit: int = 5, methodology_focus: str = "purification") -> List[Dict]:
    """
    Enhanced publication retrieval with parallel search and result aggregation
    Queries both PubMed and Semantic Scholar simultaneously, then merges and ranks results
    Focused on specific methodology (purification, synthesis, etc.)
    
    Args:
        uniprot_id: UniProt accession ID
        protein_name: Protein name for search
        limit: Maximum number of results to return (default: 5)
        methodology_focus: Focus area - "purification", "synthesis", "expression", or "general" (default: "purification")
    
    Returns:
        List of publication records sorted by relevance and influence
    """
    # Use protein name for search, fall back to UniProt ID if name not available
    search_term = protein_name if protein_name else uniprot_id
    
    if not search_term:
        return []
    
    # Query both sources in parallel (or sequentially with timeout)
    pubmed_results = []
    semantic_results = []
    
    try:
        pubmed_results = get_pubmed_publications(search_term, uniprot_id, limit * 2, methodology_focus)
    except Exception as e:
        print(f"Error querying PubMed: {e}")
    
    try:
        semantic_results = get_semantic_scholar_publications(search_term, limit * 2, methodology_focus)
    except Exception as e:
        print(f"Error querying Semantic Scholar: {e}")
    
    # Merge and deduplicate results
    merged_results = {}
    
    # Add PubMed results
    for pub in pubmed_results:
        key = pub.get("pmid") or pub.get("doi") or pub.get("title", "")
        if key and key not in merged_results:
            merged_results[key] = pub
    
    # Add Semantic Scholar results, prefer if has better metadata
    for pub in semantic_results:
        key = pub.get("pmid") or pub.get("doi") or pub.get("title", "")
        if key:
            if key not in merged_results:
                merged_results[key] = pub
            else:
                # Merge: prefer results with more metadata
                existing = merged_results[key]
                # If Semantic Scholar has citation metrics, prefer it
                if pub.get("citation_count", 0) > 0 and existing.get("citation_count", 0) == 0:
                    merged_results[key] = pub
                # If Semantic Scholar has open access PDF, prefer it
                elif pub.get("pdf_url") and not existing.get("pdf_url"):
                    # Merge PDF URL into existing
                    existing["pdf_url"] = pub.get("pdf_url")
                    existing["is_open_access"] = pub.get("is_open_access", False)
    
    # Convert to list and rank
    results = list(merged_results.values())
    
    # Ranking algorithm: combine citation metrics, relevance, and recency
    def rank_score(pub):
        score = 0
        # Citation metrics (if available)
        score += pub.get("citation_count", 0) * 0.1
        score += pub.get("influential_citations", 0) * 0.3
        # Open access bonus
        if pub.get("is_open_access") or pub.get("pdf_url"):
            score += 5
        # Recency (prefer recent papers, but not too heavily)
        try:
            year = int(pub.get("year", 0) or 0)
            if year > 2000:
                score += (year - 2000) * 0.01
        except:
            pass
        return score
    
    # Sort by score (descending)
    results.sort(key=rank_score, reverse=True)
    
    return results[:limit]


def get_unpaywall_pdf_url(doi: str) -> Optional[str]:
    """
    Get open access PDF URL from Unpaywall API using DOI
    
    Args:
        doi: Digital Object Identifier
    
    Returns:
        PDF URL if available, None otherwise
    """
    if not doi:
        return None
    
    try:
        # Clean DOI (remove https://doi.org/ prefix if present)
        clean_doi = doi.replace("https://doi.org/", "").replace("http://doi.org/", "").strip()
        
        url = f"{UNPAYWALL_API_URL}/{clean_doi}"
        params = {"email": UNPAYWALL_EMAIL}
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Check if open access PDF is available
            if data.get("is_oa", False):
                best_oa_location = data.get("best_oa_location")
                if best_oa_location and best_oa_location.get("url_for_pdf"):
                    return best_oa_location.get("url_for_pdf")
        
        return None
    except Exception as e:
        print(f"Error querying Unpaywall API for DOI {doi}: {e}")
        return None


def extract_text_from_pdf(pdf_url: str) -> Optional[str]:
    """
    Extract text content from PDF URL
    
    Args:
        pdf_url: URL to PDF file
    
    Returns:
        Extracted text content or None if extraction fails
    """
    try:
        from PyPDF2 import PdfReader
        from io import BytesIO
        
        # Fetch PDF
        response = requests.get(pdf_url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Read PDF content
        pdf_content = BytesIO(response.content)
        reader = PdfReader(pdf_content)
        
        # Extract text from all pages
        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text())
        
        return "\n".join(text_parts)
    except ImportError:
        print("PyPDF2 not available, cannot extract PDF text")
        return None
    except Exception as e:
        print(f"Error extracting text from PDF {pdf_url}: {e}")
        return None


def get_publication_full_text_enhanced(publication: Dict) -> Optional[str]:
    """
    Enhanced full text retrieval with priority chain:
    1. Perplexity response content (if available)
    2. Open Access PDF from Semantic Scholar (if available)
    3. Unpaywall API (DOI-based)
    4. PubMed Central (PMC) full text
    5. PubMed abstract
    6. Fetch from original URL (HTML fallback)
    
    All fetched text is validated to ensure it matches the expected publication.
    
    Args:
        publication: Publication dictionary with metadata
    
    Returns:
        Full text content or None if not available
    """
    import logging
    logger = logging.getLogger(__name__)
    
    title = publication.get("title", "Unknown")
    logger.info(f"Attempting to fetch full text for: {title}")
    
    # Priority 1: Check if Perplexity provided protocol preview
    if publication.get("protocol_preview"):
        protocol_preview = publication.get("protocol_preview")
        if validate_publication_text(protocol_preview, publication):
            logger.info(f"Found Perplexity protocol_preview for {title} (validated)")
            return protocol_preview
        else:
            logger.warning(f"Perplexity protocol_preview failed validation for {title}")
    else:
        logger.debug(f"No protocol_preview available for {title}")
    
    # Priority 2: Open Access PDF from Semantic Scholar
    pdf_url = publication.get("pdf_url")
    if pdf_url:
        logger.info(f"Attempting to extract text from PDF: {pdf_url}")
        pdf_text = extract_text_from_pdf(pdf_url)
        if pdf_text:
            if validate_publication_text(pdf_text, publication):
                logger.info(f"Successfully extracted text from PDF ({len(pdf_text)} chars, validated)")
                return pdf_text
            else:
                logger.warning(f"PDF text failed validation for {title} - text may be from wrong publication")
        else:
            logger.warning(f"Failed to extract text from PDF: {pdf_url}")
    else:
        logger.debug(f"No pdf_url available for {title}")
    
    # Priority 3: Unpaywall API (DOI-based)
    doi = publication.get("doi")
    if doi:
        logger.info(f"Attempting Unpaywall API for DOI: {doi}")
        unpaywall_pdf_url = get_unpaywall_pdf_url(doi)
        if unpaywall_pdf_url:
            logger.info(f"Found Unpaywall PDF URL: {unpaywall_pdf_url}")
            pdf_text = extract_text_from_pdf(unpaywall_pdf_url)
            if pdf_text:
                if validate_publication_text(pdf_text, publication):
                    logger.info(f"Successfully extracted text from Unpaywall PDF ({len(pdf_text)} chars, validated)")
                    return pdf_text
                else:
                    logger.warning(f"Unpaywall PDF text failed validation for {title} - text may be from wrong publication")
            else:
                logger.warning(f"Failed to extract text from Unpaywall PDF: {unpaywall_pdf_url}")
        else:
            logger.debug(f"No Unpaywall PDF URL found for DOI: {doi}")
    else:
        logger.debug(f"No DOI available for {title}")
    
    # Priority 4: PubMed Central (PMC) full text
    pmid = publication.get("pmid")
    if pmid:
        logger.info(f"Attempting PubMed Central full text for PMID: {pmid}")
        pmc_text = get_publication_full_text(pmid)
        if pmc_text:
            if validate_publication_text(pmc_text, publication):
                logger.info(f"Successfully fetched PMC full text ({len(pmc_text)} chars, validated)")
                return pmc_text
            else:
                logger.warning(f"PMC text failed validation for {title} - text may be from wrong publication")
        else:
            logger.debug(f"No PMC full text available for PMID: {pmid}")
    else:
        logger.debug(f"No PMID available for {title}")
    
    # Priority 5: PubMed abstract (fallback)
    if pmid:
        try:
            logger.info(f"Attempting PubMed abstract for PMID: {pmid}")
            url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            params = {
                "db": "pubmed",
                "id": pmid,
                "rettype": "abstract",
                "retmode": "xml"
            }
            response = requests.get(url, params=params, timeout=15)
            if response.status_code == 200:
                root = ET.fromstring(response.text)
                abstract_elem = root.find(".//AbstractText")
                if abstract_elem is not None:
                    abstract_text = "".join(abstract_elem.itertext()).strip()
                    if validate_publication_text(abstract_text, publication):
                        logger.info(f"Successfully fetched PubMed abstract ({len(abstract_text)} chars, validated)")
                        return abstract_text
                    else:
                        logger.warning(f"PubMed abstract failed validation for {title}")
                else:
                    logger.debug(f"No abstract found in PubMed response for PMID: {pmid}")
            else:
                logger.warning(f"PubMed API returned status {response.status_code} for PMID: {pmid}")
        except Exception as e:
            logger.warning(f"Error fetching PubMed abstract for PMID {pmid}: {e}")
    
    # Priority 6: Fetch from original URL as last resort (HTML fallback)
    publication_url = publication.get("url")
    if publication_url:
        try:
            logger.info(f"Attempting to fetch from URL: {publication_url}")
            response = requests.get(publication_url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            if response.status_code == 200:
                html_text = response.text
                cleaned = extraction.clean_html(html_text)
                if cleaned and len(cleaned) > 100:  # Minimum content check
                    if validate_publication_text(cleaned, publication):
                        logger.info(f"Successfully extracted text from URL ({len(cleaned)} chars, validated)")
                        return cleaned
                    else:
                        logger.warning(f"URL text failed validation for {title} - URL may point to wrong publication")
                else:
                    logger.warning(f"Extracted text from URL too short or empty: {len(cleaned) if cleaned else 0} chars")
            else:
                logger.warning(f"URL fetch returned status {response.status_code} for: {publication_url}")
        except Exception as e:
            logger.warning(f"Error fetching publication URL {publication_url}: {e}")

    logger.warning(f"All methods failed to retrieve validated full text for: {title} (DOI: {doi}, PMID: {pmid}, URL: {publication_url})")
    return None


def get_publications(uniprot_id: str, protein_name: str = "", limit: int = 5, methodology_focus: str = "purification") -> List[Dict]:
    """
    Retrieve publications related to a UniProt ID
    Uses Perplexity.ai as primary source, with fallback to PubMed and Semantic Scholar
    Enhanced with methodology focus (default: purification)
    
    Args:
        uniprot_id: UniProt accession ID
        protein_name: Protein name for search
        limit: Maximum number of results to return (default: 5)
        methodology_focus: Focus area - "purification", "synthesis", "expression", or "general" (default: "purification")
    
    Returns:
        List of publication records with title, abstract, and URL
    """
    search_term = protein_name if protein_name else uniprot_id
    
    if not search_term:
        return []
    
    # Priority 1: Try Perplexity.ai first
    try:
        perplexity_results = perplexity.get_perplexity_publications(
            search_term, uniprot_id, limit, methodology_focus
        )
        if perplexity_results:
            return perplexity_results
    except Exception as e:
        print(f"Perplexity search failed, falling back to other sources: {e}")
    
    # Priority 2: Try enhanced search (PubMed + Semantic Scholar)
    try:
        results = get_publications_enhanced(uniprot_id, protein_name, limit, methodology_focus)
        if results:
            return results
    except Exception as e:
        print(f"Enhanced search failed, falling back to individual sources: {e}")
    
    # Priority 3: Try PubMed/PMC with methodology focus
    results = get_pubmed_publications(search_term, uniprot_id, limit, methodology_focus)
    
    # Priority 4: If no results from PubMed, try Semantic Scholar with methodology focus
    if not results:
        print("No results from PubMed, trying Semantic Scholar...")
        results = get_semantic_scholar_publications(search_term, limit, methodology_focus)
    
    return results[:limit]


def validate_publication_text(text: str, expected_publication: Dict) -> bool:
    """
    Validate that fetched text matches the expected publication
    
    Args:
        text: Fetched publication text
        expected_publication: Dictionary with expected publication metadata (title, authors, year, journal)
    
    Returns:
        True if text appears to match the expected publication, False otherwise
    """
    if not text or not expected_publication:
        return False
    
    text_lower = text.lower()
    
    # Check title match (at least 3 significant words from title should appear)
    expected_title = expected_publication.get("title", "").lower()
    if expected_title:
        # Extract significant words (3+ characters, not common words)
        title_words = [w for w in expected_title.split() if len(w) >= 3 and w not in ["the", "and", "for", "with", "from", "that", "this"]]
        if title_words:
            # Check if at least 50% of significant title words appear in text
            matching_words = sum(1 for word in title_words if word in text_lower)
            if matching_words < max(2, len(title_words) * 0.5):
                return False
    
    # Check author match (at least one author surname should appear)
    expected_authors = expected_publication.get("authors", "").lower()
    if expected_authors:
        # Extract author surnames (first word before comma, or first word if no comma)
        author_surnames = []
        for author in expected_authors.split(","):
            author = author.strip()
            if author:
                # Get first word (surname) - handle "et al" and "and"
                surname = author.split()[0] if author.split() else ""
                if surname and len(surname) >= 3 and surname not in ["et", "al", "and"]:
                    author_surnames.append(surname)
        
        if author_surnames:
            # At least one author surname should appear in text
            if not any(surname in text_lower for surname in author_surnames):
                return False
    
    # Check year match (year should appear in text)
    expected_year = expected_publication.get("year", "")
    if expected_year:
        if expected_year not in text:
            # Year might be in different format, check if it's close
            try:
                year_int = int(expected_year)
                # Check if year appears in text (allowing for some variation)
                if str(year_int) not in text and str(year_int - 1) not in text and str(year_int + 1) not in text:
                    return False
            except ValueError:
                pass
    
    return True


def get_pmc_id_from_pmid(pmid: str) -> Optional[str]:
    """
    Convert PubMed ID to PubMed Central ID
    
    Args:
        pmid: PubMed ID
    
    Returns:
        PMC ID if available, None otherwise
    """
    try:
        url = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
        params = {
            "ids": pmid,
            "format": "json"
        }
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            records = data.get("records", [])
            if records and records[0].get("pmcid"):
                return records[0]["pmcid"]
    except Exception as e:
        print(f"Error converting PMID {pmid} to PMC ID: {e}")
    return None


def get_publication_full_text(pmid: str) -> Optional[str]:
    """
    Retrieve full text of a publication by PMID (if available)
    Uses PubMed Central if available, with enhanced XML parsing
    
    Args:
        pmid: PubMed ID
    
    Returns:
        Full text content or None if not available
    """
    try:
        # First, try to get PMC ID from PMID
        pmc_id = get_pmc_id_from_pmid(pmid)
        
        if pmc_id:
            # Try to fetch from PubMed Central (PMC) using PMC ID
            url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            params = {
                "db": "pmc",
                "id": pmc_id,
                "retmode": "xml"
            }
            
            response = requests.get(url, params=params, timeout=15)
            if response.status_code == 200:
                # Try to parse PMC XML and extract Materials and Methods section
                parsed_text = extraction.parse_pmc_xml(response.text)
                if parsed_text:
                    return parsed_text
                # If parsing fails, return raw XML for fallback processing
                return response.text
        
        # Fallback to PubMed abstract
        url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        params = {
            "db": "pubmed",
            "id": pmid,
            "rettype": "abstract",
            "retmode": "xml"
        }
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        
        # Parse PubMed XML to extract abstract
        root = ET.fromstring(response.text)
        abstract_elem = root.find(".//AbstractText")
        if abstract_elem is not None:
            return "".join(abstract_elem.itertext()).strip()
        
        return response.text
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching full text for PMID {pmid}: {e}")
        return None
    except Exception as e:
        print(f"Error processing full text for PMID {pmid}: {e}")
        return None


def extract_materials_methods_section(pmid: str, full_text: Optional[str] = None) -> Optional[str]:
    """
    Extract Materials and Methods section from a publication
    
    Args:
        pmid: PubMed ID
        full_text: Optional pre-fetched full text (if None, will fetch)
    
    Returns:
        Extracted Materials and Methods section or None if not found
    """
    # Fetch full text if not provided
    if full_text is None:
        full_text = get_publication_full_text(pmid)
    
    if not full_text:
        return None
    
    # Try to detect Materials and Methods section
    methods_section = extraction.detect_materials_methods_section(full_text)
    
    if methods_section:
        return methods_section
    
    # If section detection failed, try PMC XML parsing
    # (This is already done in get_publication_full_text, but check again)
    if full_text.startswith("<?xml") or full_text.startswith("<"):
        try:
            parsed = extraction.parse_pmc_xml(full_text)
            if parsed:
                return parsed
        except:
            pass
    
    return None
