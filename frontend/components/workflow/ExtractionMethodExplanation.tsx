'use client';

export default function ExtractionMethodExplanation() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">🔬 Extraction Methods Explained</h3>
      <div className="space-y-3 text-sm text-gray-700">
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">1. Text Fetching</h4>
          <p>
            The system retrieves the full text of the publication from various sources including 
            PubMed Central, DOI repositories, and open access databases.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">2. Section Detection</h4>
          <p>
            AI models identify the Materials and Methods section using pattern recognition and 
            structural analysis of the document.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">3. Content Extraction</h4>
          <p>
            Each model independently extracts experimental procedures, materials, equipment, 
            and conditions from the identified section.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">4. Entity Recognition</h4>
          <p>
            The system identifies and categorizes chemicals, equipment, and experimental 
            conditions mentioned in the text.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">5. Validation</h4>
          <p>
            Extracted content is validated for completeness and cross-checked against the 
            original text to detect potential hallucinations or missing information.
          </p>
        </div>
      </div>
    </div>
  );
}

