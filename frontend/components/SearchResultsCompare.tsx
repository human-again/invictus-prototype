'use client';

import { SearchComparisonResult, Publication } from '@/lib/api';
import ComparisonGrid from './ComparisonGrid';

interface RankingInfo {
  modelId: string;
  score: number;
  explanation: string;
}

interface SearchResultsCompareProps {
  results: SearchComparisonResult[];
  candidates: Publication[];
  onSelectPublication?: (publication: Publication, rankingInfo: RankingInfo[]) => void;
  onRerun?: (modelId: string) => void;
}

export default function SearchResultsCompare({
  results,
  candidates,
  onSelectPublication,
  onRerun,
}: SearchResultsCompareProps) {
  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">📊 Understanding the Results</h3>
        <p className="text-sm text-gray-700 mb-2">
          Each AI model has independently ranked the publications. Compare the rankings to see which publications 
          multiple models agree on - these are likely the most relevant.
        </p>
        <p className="text-sm text-gray-700">
          <strong>Next step:</strong> Click on any publication below to extract its detailed methods.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Model Performance Summary</h3>
        <ComparisonGrid results={results} onRerun={onRerun} />
      </div>

      {/* Multi-column Publication Results */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📚 Publications Ranked by Each Model</h3>
        <p className="text-sm text-gray-700 mb-1">
          <strong>Each container below shows results from ONE specific AI model.</strong> Compare how different models ranked the same publications.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Publications ranked #1 by multiple models are most likely relevant.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result) => (
            <div key={result.model_id} className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 shadow-md">
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-blue-200">
                <div>
                  <h4 className="font-bold text-base text-gray-900">{result.model_id}</h4>
                  <p className="text-xs text-gray-600 mt-1">Model Results</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                  result.status === 'success' ? 'bg-green-100 text-green-800' : 
                  result.status === 'timeout' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {result.status}
                </span>
              </div>
              
              {result.status === 'timeout' ? (
                <div className="space-y-2">
                  <div className="p-3 bg-orange-50 rounded border-2 border-orange-300">
                    <p className="text-sm font-semibold text-orange-800 mb-1">⏱️ Request Timed Out</p>
                    {result.error && (
                      <p className="text-xs text-orange-700 mt-1">{result.error}</p>
                    )}
                    {onRerun && (
                      <button
                        onClick={() => onRerun(result.model_id)}
                        className="mt-2 px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded hover:bg-orange-200 font-medium"
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                </div>
              ) : result.status === 'failed' ? (
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 rounded border-2 border-red-200">
                    <p className="text-sm font-semibold text-red-800 mb-1">❌ Model Failed</p>
                    {result.error && (
                      <p className="text-xs text-red-700 mt-1">{result.error}</p>
                    )}
                    {onRerun && (
                      <button
                        onClick={() => onRerun(result.model_id)}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200 font-medium"
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                </div>
              ) : result.results && result.results.length > 0 ? (
                <div className="space-y-2">
                  {result.results.slice(0, 5).map((pub: any, idx: number) => {
                    // Find full publication from candidates to get all metadata
                    const fullPub = candidates.find(
                      (cand: Publication) => 
                        cand.title === pub.title || 
                        cand.title?.toLowerCase() === pub.title?.toLowerCase()
                    ) || pub;
                    
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded border-2 border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                        onClick={() => {
                          if (!onSelectPublication) return;
                          
                          // Find full publication from candidates
                          const fullPub = candidates.find(
                            (cand: Publication) => 
                              cand.title === pub.title || 
                              cand.title?.toLowerCase() === pub.title?.toLowerCase()
                          ) || pub;
                          
                          // Collect ranking information from all models that ranked this publication
                          const rankingInfo: RankingInfo[] = [];
                          results.forEach((result) => {
                            if (result.status === 'success' && result.results) {
                              const rankedPub = result.results.find(
                                (r: any) => r.title === pub.title || r.title?.toLowerCase() === pub.title?.toLowerCase()
                              );
                              if (rankedPub) {
                                rankingInfo.push({
                                  modelId: result.model_id,
                                  score: rankedPub.score || 0,
                                  explanation: rankedPub.explanation || '',
                                });
                              }
                            }
                          });
                          
                          onSelectPublication(fullPub, rankingInfo);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">#{idx + 1}</span>
                          {pub.score && (
                            <span className="text-xs text-gray-700 font-medium">Score: {pub.score}</span>
                          )}
                        </div>
                        <h5 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">
                          {pub.title || 'Untitled'}
                        </h5>
                        {pub.explanation && (
                          <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed mb-2">{pub.explanation}</p>
                        )}
                        
                        {/* Citation Links */}
                        <div className="flex flex-wrap gap-2 mt-2 mb-2">
                          {fullPub.url && (
                            <a
                              href={fullPub.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <span>🔗</span> Article
                            </a>
                          )}
                          {fullPub.doi && (
                            <a
                              href={`https://doi.org/${fullPub.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <span>📄</span> DOI
                            </a>
                          )}
                          {fullPub.pmid && (
                            <a
                              href={`https://pubmed.ncbi.nlm.nih.gov/${fullPub.pmid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <span>📚</span> PubMed
                            </a>
                          )}
                          {(fullPub as any).pdf_url && (
                            <a
                              href={(fullPub as any).pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <span>📥</span> PDF
                            </a>
                          )}
                        </div>
                        
                        {/* Citation Count */}
                        {(fullPub as any).citation_count !== undefined && (fullPub as any).citation_count > 0 && (
                          <div className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Citations:</span> {(fullPub as any).citation_count}
                          </div>
                        )}
                        
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">From:</span> {result.model_id}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                    ⚠️ No results from this model
                  </p>
                  {result.status === 'success' && (
                    <p className="text-xs text-gray-600">
                      Model completed but returned no ranked publications.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

