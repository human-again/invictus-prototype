'use client';

import { ExtractComparisonResult } from '@/lib/api';
import ComparisonGrid from './ComparisonGrid';

interface ExtractionCompareProps {
  results: ExtractComparisonResult[];
  inputExcerpt?: string;
  truncationWarning?: string;
  consensus?: any;
  onRerun?: (modelId: string) => void;
  onSelect?: (result: ExtractComparisonResult) => void;
}

export default function ExtractionCompare({
  results,
  inputExcerpt,
  truncationWarning,
  consensus,
  onRerun,
  onSelect,
}: ExtractionCompareProps) {
  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">🔬 Understanding Extraction Results</h3>
        <p className="text-sm text-gray-700 mb-2">
          Each AI model has extracted the Materials and Methods section from the publication. Compare what each model found - 
          when multiple models extract the same information, it's more reliable.
        </p>
        <p className="text-sm text-gray-700">
          <strong>Confidence scores</strong> show how well the extracted text matches the source. 
          <strong>Flags</strong> indicate potential issues like missing citations or implausible values.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Model Performance Summary</h3>
        <ComparisonGrid results={results} onRerun={onRerun} />
      </div>

      {/* Warnings */}
      {truncationWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">⚠️ {truncationWarning}</p>
        </div>
      )}

      {/* Side-by-side Extraction Results */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📄 Extracted Methods by Model</h3>
        <p className="text-sm text-gray-700 mb-1">
          <strong>Each container below shows extraction results from ONE specific AI model.</strong> Each model independently extracted the Materials and Methods section.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Compare the extracted text side-by-side. Look for agreements and differences between models.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {results.map((result) => (
            <div key={result.model_id} className="border-2 border-green-300 rounded-lg p-4 bg-green-50 shadow-md">
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-green-200">
                <div>
                  <h4 className="font-bold text-base text-gray-900">{result.model_id}</h4>
                  <p className="text-xs text-gray-600 mt-1">Extraction Results</p>
                </div>
                <div className="flex items-center gap-2">
                  {result.confidence !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-700 font-medium">Confidence:</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-700 font-semibold">
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.status}
                  </span>
                </div>
              </div>

              {/* Flags */}
              {result.flags && result.flags.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-700">⚠️ Potential Issues:</div>
                  {result.flags.map((flag: any, idx: number) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 text-xs rounded border ${
                        flag.severity === 'high'
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      }`}
                    >
                      <span className="font-semibold">{flag.type}:</span> {flag.field}
                      {flag.details && (
                        <div className="mt-1 text-xs opacity-90">{flag.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted Text */}
              {result.extracted_text ? (
                <div className="prose prose-sm max-w-none">
                  <div className="text-xs font-semibold text-gray-700 mb-2">📝 Extracted Text:</div>
                  <div className="bg-white rounded p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200 leading-relaxed">
                    {result.extracted_text}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                  ⚠️ No extraction available from this model
                </p>
              )}

              {/* Entities */}
              {result.entities && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">🔬 Extracted Entities</h5>
                  <div className="space-y-3">
                    {result.entities.chemicals && result.entities.chemicals.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-700">🧪 Chemicals Found:</span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.entities.chemicals.slice(0, 8).map((chem: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium"
                            >
                              {chem}
                            </span>
                          ))}
                          {result.entities.chemicals.length > 8 && (
                            <span className="px-2 py-1 text-xs text-gray-600">
                              +{result.entities.chemicals.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {result.entities.equipment && result.entities.equipment.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-700">⚙️ Equipment Found:</span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.entities.equipment.slice(0, 8).map((eq: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium"
                            >
                              {eq}
                            </span>
                          ))}
                          {result.entities.equipment.length > 8 && (
                            <span className="px-2 py-1 text-xs text-gray-600">
                              +{result.entities.equipment.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Select for Summarization Button */}
              {onSelect && result.status === 'success' && result.extracted_text && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200">
                  <button
                    onClick={() => onSelect(result)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    ➡️ Use This Extraction for Summarization
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input Excerpt */}
      {inputExcerpt && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📖 Source Text (What the models analyzed)</h3>
          <p className="text-sm text-gray-600 mb-3">
            This is the text from the publication that each model analyzed to extract the methods.
          </p>
          <div className="bg-white rounded p-4 text-sm text-gray-800 max-h-48 overflow-y-auto border border-gray-200 leading-relaxed">
            {inputExcerpt}
          </div>
        </div>
      )}

      {/* Consensus View */}
      {consensus && (
        <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">✅ Consensus Analysis</h3>
          <p className="text-sm text-gray-700 mb-4">
            This shows where the models agree (more reliable) vs. where they disagree (may need review).
          </p>
          <div className="space-y-4 text-sm">
            {consensus.agreed_fields && consensus.agreed_fields.length > 0 && (
              <div>
                <span className="font-semibold text-green-800 text-base">✓ Agreed Fields (Reliable):</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {consensus.agreed_fields.map((field: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded font-medium border border-green-200"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {consensus.disagreed_fields && consensus.disagreed_fields.length > 0 && (
              <div>
                <span className="font-semibold text-red-800 text-base">⚠️ Disagreed Fields (Review Needed):</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {consensus.disagreed_fields.map((field: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded font-medium border border-red-200"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

