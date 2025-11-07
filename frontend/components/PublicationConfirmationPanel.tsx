'use client';

import { Publication } from '@/lib/api';

interface RankingInfo {
  modelId: string;
  score: number;
  explanation: string;
}

interface ExtractionInfo {
  model_id: string;
  extracted_text?: string;
  status?: string;
}

interface PublicationConfirmationPanelProps {
  isOpen: boolean;
  publication: Publication | null;
  rankingInfo?: RankingInfo[];
  extractionInfo?: ExtractionInfo | null;
  mode: 'extract' | 'summarize';
  onClose: () => void;
  onConfirm: () => void;
}

export default function PublicationConfirmationPanel({
  isOpen,
  publication,
  rankingInfo = [],
  extractionInfo = null,
  mode,
  onClose,
  onConfirm,
}: PublicationConfirmationPanelProps) {
  if (!isOpen) return null;
  if (mode === 'extract' && !publication) return null;
  if (mode === 'summarize' && !extractionInfo) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'extract' ? 'Confirm Publication for Extraction' : 'Confirm Extraction for Summarization'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          {/* Publication or Extraction Details */}
          <div className="space-y-6">
            {mode === 'extract' && publication && (
              <>
                {/* Title */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Title</h3>
                  <p className="text-gray-800">{publication.title}</p>
                </div>
              </>
            )}
            
            {mode === 'summarize' && extractionInfo && (
              <>
                {/* Extraction Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Selected Extraction</h3>
                  <p className="text-gray-800 font-medium">Model: {extractionInfo.model_id}</p>
                  {extractionInfo.status && (
                    <p className="text-sm text-gray-600 mt-1">Status: {extractionInfo.status}</p>
                  )}
                </div>
                
                {extractionInfo.extracted_text && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Extracted Text Preview</h3>
                    <div className="bg-gray-50 rounded p-4 max-h-60 overflow-y-auto border border-gray-200">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {extractionInfo.extracted_text.substring(0, 500)}
                        {extractionInfo.extracted_text.length > 500 && '...'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {mode === 'extract' && publication && (
              <>

                {/* Authors */}
                {publication.authors && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Authors</h3>
                    <p className="text-gray-800">{publication.authors}</p>
                  </div>
                )}

                {/* Journal & Year */}
                <div className="grid grid-cols-2 gap-4">
                  {publication.journal && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Journal</h3>
                      <p className="text-gray-800">{publication.journal}</p>
                    </div>
                  )}
                  {publication.year && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Year</h3>
                      <p className="text-gray-800">{publication.year}</p>
                    </div>
                  )}
                </div>

                {/* Abstract */}
                {publication.abstract && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Abstract</h3>
                    <p className="text-gray-800 leading-relaxed">{publication.abstract}</p>
                  </div>
                )}

                {/* Links */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Links & Resources</h3>
                  <div className="flex flex-wrap gap-3">
                    {publication.url && (
                      <a
                        href={publication.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <span>🔗</span> View Article
                      </a>
                    )}
                    {publication.doi && (
                      <a
                        href={`https://doi.org/${publication.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <span>📄</span> DOI
                      </a>
                    )}
                    {publication.pmid && (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${publication.pmid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <span>📚</span> PubMed
                      </a>
                    )}
                    {publication.pdf_url && (
                      <a
                        href={publication.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <span>📥</span> PDF
                      </a>
                    )}
                  </div>
                </div>

                {/* Citation Count */}
                {publication.citation_count !== undefined && publication.citation_count > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Citation Metrics</h3>
                    <p className="text-gray-800">
                      <span className="font-medium">Citations:</span> {publication.citation_count}
                    </p>
                  </div>
                )}

                {/* Model Ranking Information */}
                {rankingInfo.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Model Rankings</h3>
                    <div className="space-y-3">
                      {rankingInfo.map((ranking, idx) => (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">{ranking.modelId}</span>
                            <span className="text-sm font-medium text-blue-700">Score: {ranking.score}</span>
                          </div>
                          {ranking.explanation && (
                            <p className="text-sm text-gray-700 mt-2">{ranking.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Metadata */}
                {publication.pmid && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">PubMed ID</h3>
                    <p className="text-gray-800">{publication.pmid}</p>
                  </div>
                )}
                {publication.doi && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">DOI</h3>
                    <p className="text-gray-800">{publication.doi}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              ← Go Back
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {mode === 'extract' ? 'Proceed to Extract →' : 'Proceed to Summarize →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

