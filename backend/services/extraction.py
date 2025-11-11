"""
Text extraction and cleaning service
Handles HTML removal, tokenization, and text normalization
Includes Materials and Methods section detection
"""
from bs4 import BeautifulSoup
import re
from typing import Optional, Dict
import spacy
import xml.etree.ElementTree as ET

# Try to load scispaCy model, fallback to regular spacy if unavailable
try:
    nlp = spacy.load("en_core_sci_sm")
    SCISPACY_AVAILABLE = True
except OSError:
    try:
        # Fallback to regular English model
        nlp = spacy.load("en_core_web_sm")
        SCISPACY_AVAILABLE = False
        print("Warning: en_core_sci_sm not found, using en_core_web_sm instead")
    except OSError:
        nlp = None
        SCISPACY_AVAILABLE = False
        print("Warning: No spaCy model found. Install with: python -m spacy download en_core_web_sm")


def clean_html(text: str) -> str:
    """
    Remove HTML tags and clean text
    
    Args:
        text: Raw text with potential HTML content
    
    Returns:
        Cleaned plain text
    """
    if not text:
        return ""
    
    # Remove HTML tags
    soup = BeautifulSoup(text, "html.parser")
    text = soup.get_text(separator=" ")
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text


def tokenize_text(text: str, max_tokens: int = 4000) -> tuple[str, int]:
    """
    Tokenize and truncate text for LLM input
    
    Args:
        text: Text to tokenize
        max_tokens: Maximum number of tokens (default: 4000)
    
    Returns:
        Tuple of (truncated_text, token_count)
    """
    if not text:
        return "", 0
    
    if nlp is None:
        # Fallback: simple word count approximation
        words = text.split()
        if len(words) > max_tokens:
            truncated = " ".join(words[:max_tokens])
            return truncated, max_tokens
        return text, len(words)
    
    # Use spaCy for proper tokenization
    doc = nlp(text)
    tokens = [token.text for token in doc]
    
    if len(tokens) > max_tokens:
        # Truncate to max_tokens, trying to preserve sentence boundaries
        truncated_tokens = tokens[:max_tokens]
        # Try to end at sentence boundary if possible
        truncated_text = " ".join(truncated_tokens)
        return truncated_text, max_tokens
    
    return text, len(tokens)


def extract_entities(text: str) -> dict:
    """
    Extract named entities using scispaCy NER
    
    Args:
        text: Text to analyze
    
    Returns:
        Dictionary with chemicals, equipment, and conditions
    """
    if not text or nlp is None:
        return {
            "chemicals": [],
            "equipment": [],
            "conditions": []
        }
    
    doc = nlp(text)
    entities = {
        "chemicals": [],
        "equipment": [],
        "conditions": []
    }
    
    # Keywords for classification
    chemical_keywords = [
        "buffer", "saline", "solution", "reagent", "enzyme", "protein",
        "dna", "rna", "polymerase", "ligase", "restriction", "antibody",
        "antigen", "substrate", "cofactor", "ion", "salt", "acid", "base",
        "detergent", "surfactant", "polymer", "monomer", "nucleotide", "amino acid"
    ]
    
    equipment_keywords = [
        "centrifuge", "incubator", "thermocycler", "pcr", "gel", "electrophoresis",
        "spectrophotometer", "microscope", "pipette", "vial", "tube", "plate",
        "chamber", "column", "bead", "membrane", "filter", "autoclave"
    ]
    
    condition_keywords = [
        "temperature", "celsius", "fahrenheit", "kelvin", "ph", "time", "hour",
        "minute", "second", "rpm", "g", "concentration", "molar", "molarity",
        "pressure", "atmosphere", "humidity", "buffer", "solution"
    ]
    
    for ent in doc.ents:
        entity_text = ent.text.lower()
        entity_label = ent.label_
        
        # Classify entities
        if any(keyword in entity_text for keyword in chemical_keywords) or entity_label in ["CHEMICAL", "MOLECULE"]:
            if ent.text not in entities["chemicals"]:
                entities["chemicals"].append(ent.text)
        
        elif any(keyword in entity_text for keyword in equipment_keywords) or entity_label in ["EQUIPMENT", "DEVICE"]:
            if ent.text not in entities["equipment"]:
                entities["equipment"].append(ent.text)
        
        elif any(keyword in entity_text for keyword in condition_keywords):
            if ent.text not in entities["conditions"]:
                entities["conditions"].append(ent.text)
    
    # Also extract patterns for conditions (numbers with units)
    condition_patterns = [
        r'\d+\s*°[CFK]',  # Temperature
        r'pH\s*[\d.]+',  # pH
        r'\d+\s*(min|hour|hr|sec)',  # Time
        r'\d+\s*(mM|μM|nM|M)',  # Concentration
        r'\d+\s*rpm',  # Speed
    ]
    
    for pattern in condition_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            full_match = re.search(pattern, text, re.IGNORECASE)
            if full_match and full_match.group() not in entities["conditions"]:
                entities["conditions"].append(full_match.group())
    
    return entities


def parse_pmc_xml(xml_content: str) -> Optional[str]:
    """
    Parse PubMed Central XML and extract text content
    Focuses on Materials and Methods sections if available
    
    Args:
        xml_content: XML content from PMC
    
    Returns:
        Extracted text content or None if parsing fails
    """
    try:
        root = ET.fromstring(xml_content)
        
        # Namespace handling for PMC XML
        namespaces = {
            'article': 'http://www.ncbi.nlm.nih.gov/pmc/articles/',
            'xlink': 'http://www.w3.org/1999/xlink',
            'mml': 'http://www.w3.org/1998/Math/MathML'
        }
        
        # Try to find Materials and Methods section first
        sections = []
        
        # Look for sec elements with sec-type="Materials|Methods"
        for sec in root.findall(".//sec"):
            sec_type = sec.get("sec-type", "").lower()
            if "materials" in sec_type or "methods" in sec_type or "method" in sec_type:
                # Extract text from this section
                section_text = "".join(sec.itertext())
                if section_text.strip():
                    sections.append(section_text.strip())
        
        # If found Materials/Methods sections, return them
        if sections:
            return "\n\n".join(sections)
        
        # Fallback: extract all body text
        body = root.find(".//body")
        if body is not None:
            return "".join(body.itertext())
        
        return None
        
    except ET.ParseError as e:
        print(f"Error parsing PMC XML: {e}")
        return None
    except Exception as e:
        print(f"Error extracting text from PMC XML: {e}")
        return None


def detect_materials_methods_section(text: str) -> Optional[str]:
    """
    Detect and extract Materials and Methods section from publication text
    Uses pattern-based detection to find section boundaries
    
    Args:
        text: Full publication text
    
    Returns:
        Extracted Materials and Methods section or None if not found
    """
    if not text:
        return None
    
    # Patterns for Materials and Methods section headers
    # Common variations: "Materials and Methods", "Methods", "Experimental Procedures", etc.
    section_patterns = [
        r'(?i)(?:Materials?\s+and\s+Methods?|Methods?\s+and\s+Materials?)',
        r'(?i)(?:Experimental\s+(?:Procedures?|Methods?|Section))',
        r'(?i)(?:Methods?\s+Section)',
        r'(?i)(?:^Methods?\s*$)',
    ]
    
    # Find the start of Materials and Methods section
    start_pos = None
    start_pattern = None
    
    for pattern in section_patterns:
        match = re.search(pattern, text)
        if match:
            start_pos = match.start()
            start_pattern = pattern
            break
    
    if start_pos is None:
        return None
    
    # Find the end of the section (next major section or end of text)
    # Common section headers that might follow
    next_section_patterns = [
        r'(?i)(?:Results?\s+Section|Results?)',
        r'(?i)(?:Discussion\s+Section|Discussion)',
        r'(?i)(?:Conclusion\s+Section|Conclusion)',
        r'(?i)(?:References?\s+Section|References?)',
        r'(?i)(?:Acknowledgments?\s+Section|Acknowledgments?)',
        r'(?i)(?:^References?\s*$)',
    ]
    
    # Find the end position
    end_pos = len(text)
    search_start = start_pos + 100  # Start searching after the header
    
    for pattern in next_section_patterns:
        match = re.search(pattern, text[search_start:])
        if match:
            # Check if this is a real section header (not just a word in the text)
            # Look for line breaks or capitalization before it
            actual_pos = search_start + match.start()
            before_text = text[max(0, actual_pos - 50):actual_pos]
            if re.search(r'(?:\n\s*|\A)', before_text.rstrip()):
                end_pos = actual_pos
                break
    
    # Extract the section
    section_text = text[start_pos:end_pos].strip()
    
    # Clean up the section - remove the header line if it's just a title
    lines = section_text.split('\n')
    if len(lines) > 1:
        first_line = lines[0].strip()
        # If first line matches a section header pattern, remove it
        if any(re.match(pattern, first_line, re.IGNORECASE) for pattern in section_patterns):
            section_text = '\n'.join(lines[1:]).strip()
    
    return section_text if len(section_text) > 100 else None  # Minimum length check


def clean_and_prepare_text(text: str, max_tokens: int = 4000, preserve_structure: bool = False) -> dict:
    """
    Complete text processing pipeline
    
    Args:
        text: Raw text to process
        max_tokens: Maximum tokens for LLM input
        preserve_structure: If True, try to preserve section structure (for Materials/Methods)
    
    Returns:
        Dictionary with cleaned_text, token_count, and entities
    """
    cleaned = clean_html(text)
    
    # If preserving structure, try to detect Materials and Methods section first
    if preserve_structure:
        methods_section = detect_materials_methods_section(cleaned)
        if methods_section:
            cleaned = methods_section
    
    truncated, token_count = tokenize_text(cleaned, max_tokens)
    entities = extract_entities(truncated)
    
    return {
        "cleaned_text": truncated,
        "token_count": token_count,
        "entities": entities
    }


def extract_yield(text: str) -> Optional[Dict]:
    """
    Extract yield information from publication text
    
    Args:
        text: Publication text (abstract, full text, or methods section)
    
    Returns:
        Dictionary with yield information or None if not found
        Format: {
            "yield": "value with units",
            "yield_value": float or None,
            "yield_units": "mg/L, %, etc.",
            "context": "extraction yield, purification yield, etc.",
            "raw_text": "original text snippet"
        }
    """
    if not text:
        return None
    
    import re
    
    # Patterns for yield extraction
    yield_patterns = [
        # Protein yield patterns
        r'(?:protein\s+)?yield\s*(?:of|was|is|:)?\s*([\d.]+)\s*(?:mg/L|mg/l|mg\s*per\s*L|%|fold|times)',
        r'([\d.]+)\s*(?:mg/L|mg/l|mg\s*per\s*L)\s*(?:protein\s+)?yield',
        r'yielded\s+([\d.]+)\s*(?:mg/L|mg/l|mg\s*per\s*L|%|fold)',
        r'yield\s*(?:of|was|is)\s*([\d.]+)\s*(?:mg/L|mg/l|mg\s*per\s*L|%)',
        # Percentage yield
        r'(?:final\s+)?yield\s*(?:of|was|is|:)?\s*([\d.]+)\s*%',
        r'([\d.]+)\s*%\s*(?:yield|recovery)',
        # Fold purification
        r'([\d.]+)\s*(?:fold|times)\s*(?:purification|enrichment)',
        r'purified\s+([\d.]+)\s*(?:fold|times)',
    ]
    
    # Search for yield patterns
    for pattern in yield_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            value_str = match.group(1)
            try:
                value = float(value_str)
                full_match = match.group(0)
                
                # Determine units
                units = "unknown"
                if "mg/L" in full_match.lower() or "mg per l" in full_match.lower():
                    units = "mg/L"
                elif "%" in full_match:
                    units = "%"
                elif "fold" in full_match.lower() or "times" in full_match.lower():
                    units = "fold"
                
                # Determine context
                context = "protein yield"
                if "purification" in full_match.lower():
                    context = "purification yield"
                elif "extraction" in full_match.lower():
                    context = "extraction yield"
                elif "recovery" in full_match.lower():
                    context = "recovery yield"
                
                # Get surrounding context (50 chars before and after)
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 50)
                context_text = text[start:end].strip()
                
                return {
                    "yield": full_match,
                    "yield_value": value,
                    "yield_units": units,
                    "context": context,
                    "raw_text": context_text
                }
            except ValueError:
                continue
    
    return None


