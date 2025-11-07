"""
Smart content truncation service
Prioritizes Materials/Methods sections when truncating to fit model context
"""
import re
from typing import Dict, Optional


def truncate_content(
    text: str,
    max_tokens: int = 4000,
    prioritize_sections: bool = True
) -> Dict[str, any]:
    """Truncate content intelligently, prioritizing important sections"""
    
    if not text:
        return {
            "truncated_text": "",
            "original_length": 0,
            "truncated_length": 0,
            "was_truncated": False,
            "warning": None
        }
    
    original_length = len(text)
    
    # Estimate tokens (rough: 1 token ≈ 4 characters)
    estimated_tokens = len(text) / 4
    
    if estimated_tokens <= max_tokens:
        return {
            "truncated_text": text,
            "original_length": original_length,
            "truncated_length": original_length,
            "was_truncated": False,
            "warning": None
        }
    
    # If prioritizing sections, try to extract Materials/Methods first
    if prioritize_sections:
        methods_section = _extract_materials_methods(text)
        if methods_section and len(methods_section) < len(text):
            # Check if methods section fits
            methods_tokens = len(methods_section) / 4
            if methods_tokens <= max_tokens:
                return {
                    "truncated_text": methods_section,
                    "original_length": original_length,
                    "truncated_length": len(methods_section),
                    "was_truncated": True,
                    "warning": f"Content truncated to Materials/Methods section ({len(methods_section)} chars)"
                }
    
    # Fallback: truncate from start, trying to preserve sentence boundaries
    max_chars = max_tokens * 4
    truncated = _truncate_at_sentence_boundary(text, max_chars)
    
    return {
        "truncated_text": truncated,
        "original_length": original_length,
        "truncated_length": len(truncated),
        "was_truncated": True,
        "warning": f"Content truncated from {original_length} to {len(truncated)} characters"
    }


def _extract_materials_methods(text: str) -> Optional[str]:
    """Extract Materials and Methods section from text"""
    # Patterns for Materials and Methods section headers
    section_patterns = [
        r'(?i)(?:Materials?\s+and\s+Methods?|Methods?\s+and\s+Materials?)',
        r'(?i)(?:Experimental\s+(?:Procedures?|Methods?|Section))',
        r'(?i)(?:Methods?\s+Section)',
    ]
    
    # Find the start
    start_pos = None
    for pattern in section_patterns:
        match = re.search(pattern, text)
        if match:
            start_pos = match.start()
            break
    
    if start_pos is None:
        return None
    
    # Find the end (next major section)
    next_section_patterns = [
        r'(?i)(?:Results?\s+Section|Results?)',
        r'(?i)(?:Discussion\s+Section|Discussion)',
        r'(?i)(?:Conclusion\s+Section|Conclusion)',
        r'(?i)(?:References?\s+Section|References?)',
    ]
    
    end_pos = len(text)
    search_start = start_pos + 100
    
    for pattern in next_section_patterns:
        match = re.search(pattern, text[search_start:])
        if match:
            actual_pos = search_start + match.start()
            before_text = text[max(0, actual_pos - 50):actual_pos]
            if re.search(r'(?:\n\s*|\A)', before_text.rstrip()):
                end_pos = actual_pos
                break
    
    section_text = text[start_pos:end_pos].strip()
    
    # Remove header line if it's just a title
    lines = section_text.split('\n')
    if len(lines) > 1:
        first_line = lines[0].strip()
        if any(re.match(p, first_line, re.IGNORECASE) for p in section_patterns):
            section_text = '\n'.join(lines[1:]).strip()
    
    return section_text if len(section_text) > 100 else None


def _truncate_at_sentence_boundary(text: str, max_chars: int) -> str:
    """Truncate text at sentence boundary"""
    if len(text) <= max_chars:
        return text
    
    # Try to find a sentence boundary near max_chars
    truncated = text[:max_chars]
    
    # Look for sentence endings
    sentence_endings = re.finditer(r'[.!?]\s+', truncated)
    last_match = None
    for match in sentence_endings:
        if match.end() <= max_chars:
            last_match = match
    
    if last_match:
        return truncated[:last_match.end()].rstrip()
    
    # Fall back to word boundary
    words = truncated.rsplit(' ', 1)
    if len(words) > 1:
        return words[0]
    
    return truncated

