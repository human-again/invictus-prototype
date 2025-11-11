'use client';

import { useState, useEffect } from 'react';
import { SummarizeComparisonResult, Protocol } from '@/lib/api';
import ComparisonGrid from './ComparisonGrid';
import MarkdownRenderer from './MarkdownRenderer';

// Helper function to format diff values in a human-readable way
function formatDiffValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">(not specified)</span>;
  }
  
  if (typeof value === 'string') {
    return <span>{value}</span>;
  }
  
  if (typeof value === 'number') {
    return <span className="font-mono">{value}</span>;
  }
  
  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-500 italic">(empty list)</span>;
    }
    return (
      <ul className="list-disc list-inside space-y-1 ml-2">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm">{formatDiffValue(item)}</li>
        ))}
      </ul>
    );
  }
  
  if (typeof value === 'object') {
    // Handle nested objects
    if (value.old !== undefined && value.new !== undefined) {
      // This is a modified value with old/new
      return (
        <div className="space-y-2">
          <div>
            <span className="text-xs font-semibold text-gray-600">Previous:</span>
            <div className="text-sm">{formatDiffValue(value.old)}</div>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-600">New:</span>
            <div className="text-sm">{formatDiffValue(value.new)}</div>
          </div>
        </div>
      );
    }
    
    // Regular object - show key-value pairs
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-500 italic">(empty)</span>;
    }
    return (
      <div className="space-y-1 ml-2">
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="font-semibold text-gray-700 capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
            {formatDiffValue(v)}
          </div>
        ))}
      </div>
    );
  }
  
  return <span>{String(value)}</span>;
}

interface SummarizationCompareProps {
  results: SummarizeComparisonResult[];
  consensus?: any;
  outliers?: Record<string, string[]>;
  diff?: any[];
  onRerun?: (modelId: string) => void;
  onExport?: (data: any) => void;
}

export default function SummarizationCompare({
  results,
  consensus,
  outliers,
  diff,
  onRerun,
  onExport,
}: SummarizationCompareProps) {
  const [selectedView, setSelectedView] = useState<'structured' | 'readable'>('readable');
  // Initialize with all model IDs expanded by default
  const [expandedModels, setExpandedModels] = useState<Set<string>>(() => {
    const initialSet = new Set<string>();
    results.forEach((result) => {
      if (result.status === 'success') {
        initialSet.add(result.model_id);
      }
    });
    return initialSet;
  });

  // Update expanded models when results change
  useEffect(() => {
    const newExpanded = new Set<string>();
    results.forEach((result) => {
      if (result.status === 'success') {
        newExpanded.add(result.model_id);
      }
    });
    setExpandedModels(newExpanded);
  }, [results]);

  const toggleModel = (modelId: string) => {
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(modelId)) {
      newExpanded.delete(modelId);
    } else {
      newExpanded.add(modelId);
    }
    setExpandedModels(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">📋 Understanding Protocol Summaries</h3>
        <p className="text-sm text-gray-700 mb-2">
          Each AI model has converted the extracted methods into a structured, step-by-step protocol. 
          Compare the protocols to see where models agree (most reliable) and where they differ (may need human review).
        </p>
        <p className="text-sm text-gray-700">
          <strong>Consensus fields</strong> are where all models agree - these are most trustworthy. 
          <strong>Outliers</strong> are results that differ significantly from others and may need verification.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">⚡ Model Performance Summary</h3>
          {onExport && (
            <button
              onClick={() => onExport({ results, consensus, outliers, diff })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              💾 Export Results
            </button>
          )}
        </div>
        <ComparisonGrid results={results} onRerun={onRerun} />
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">View Format:</h3>
          <p className="text-xs text-gray-700">
            <strong className="text-gray-900">Structured JSON:</strong> Machine-readable format with steps, materials, and conditions. 
            <strong className="text-gray-900"> Readable Protocol:</strong> Human-friendly step-by-step guide (recommended for comparison).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedView('structured')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedView === 'structured'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            📊 Structured JSON
          </button>
          <button
            onClick={() => setSelectedView('readable')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedView === 'readable'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            📖 Readable Protocol
          </button>
        </div>
      </div>

      {/* Outliers */}
      {outliers && Object.keys(outliers).length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Statistical Outliers Detected</h3>
          <p className="text-sm text-gray-700 mb-4">
            These results differ significantly from the average. They may be errors or represent alternative valid approaches.
          </p>
          <div className="space-y-3">
            {Object.entries(outliers).map(([field, values]) => (
              <div key={field} className="bg-white rounded p-3 border border-yellow-200">
                <span className="font-semibold text-yellow-800 text-base">{field}:</span>
                <div className="mt-2 space-y-1">
                  {values.map((value, idx) => (
                    <div key={idx} className="text-sm text-yellow-900 font-medium">{value}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consensus View */}
      {consensus && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">✅ Consensus Analysis</h3>
          <p className="text-sm text-gray-700 mb-4">
            Compare where models agree (reliable) vs. disagree (needs review). More agreement = higher confidence.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {consensus.agreed_fields && Object.keys(consensus.agreed_fields).length > 0 && (
              <div className="bg-white rounded-lg p-4 border-2 border-green-300">
                <h4 className="font-semibold text-green-800 text-base mb-3">✓ Agreed Fields (Reliable)</h4>
                <div className="space-y-2">
                  {Object.entries(consensus.agreed_fields).map(([key, value]) => (
                    <div key={key} className="text-sm bg-green-50 p-2 rounded">
                      <span className="font-semibold text-gray-900">{key}:</span>{' '}
                      <span className="text-gray-800">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {consensus.disagreed_fields && Object.keys(consensus.disagreed_fields).length > 0 && (
              <div className="bg-white rounded-lg p-4 border-2 border-red-300">
                <h4 className="font-semibold text-red-800 text-base mb-3">⚠️ Disagreed Fields (Review Needed)</h4>
                <div className="space-y-2">
                  {Object.entries(consensus.disagreed_fields).map(([key, value]: [string, any]) => (
                    <div key={key} className="text-sm bg-red-50 p-2 rounded">
                      <span className="font-semibold text-gray-900">{key}:</span>{' '}
                      <span className="text-gray-800">
                        {Array.isArray(value.values) ? value.values.join(', ') : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Display */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📊 Protocol Results by Model ({selectedView === 'structured' ? 'Structured JSON' : 'Readable Format'})
        </h3>
        <p className="text-sm text-gray-800 mb-1 font-medium">
          <strong>Each container below shows summarization results from ONE specific AI model.</strong> Each model independently converted the extracted methods into a protocol.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          Compare the protocols generated by each model side-by-side. Click "Expand" to see full details. <strong className="text-gray-900">For best comparison, use the "Readable Protocol" view.</strong>
        </p>
        <div className={`grid gap-6 ${selectedView === 'readable' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {results.map((result) => (
            <div key={result.model_id} className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50 shadow-md">
              <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-purple-200">
                <div>
                  <h4 className="font-bold text-base text-gray-900">{result.model_id}</h4>
                  <p className="text-xs text-gray-600 mt-1">Summarization Results</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    result.status === 'success' ? 'bg-green-100 text-green-800' : 
                    result.status === 'timeout' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {result.status}
                  </span>
                  {result.validation && (
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        result.validation.valid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {result.validation.valid ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  )}
                  {result.status === 'success' && (
                    <button
                      onClick={() => toggleModel(result.model_id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded"
                    >
                      {expandedModels.has(result.model_id) ? '▼ Collapse' : '▶ Expand'}
                    </button>
                  )}
                </div>
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
              ) : selectedView === 'structured' && result.structured ? (
                <div className="space-y-3">
                  {expandedModels.has(result.model_id) ? (
                    <div className="bg-white rounded p-4 text-xs font-mono overflow-x-auto border border-gray-200">
                      <pre className="text-gray-800">{JSON.stringify(result.structured, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-white rounded p-3 border border-gray-200">
                      {result.structured.steps && (
                        <div className="flex justify-between">
                          <span className="text-xs font-semibold text-gray-700">📝 Steps:</span>
                          <span className="text-sm text-gray-900 font-medium">
                            {result.structured.steps.length}
                          </span>
                        </div>
                      )}
                      {result.structured.materials && (
                        <div className="flex justify-between">
                          <span className="text-xs font-semibold text-gray-700">🧪 Materials:</span>
                          <span className="text-sm text-gray-900 font-medium">
                            {result.structured.materials.length}
                          </span>
                        </div>
                      )}
                      {result.structured.equipment && (
                        <div className="flex justify-between">
                          <span className="text-xs font-semibold text-gray-700">⚙️ Equipment:</span>
                          <span className="text-sm text-gray-900 font-medium">
                            {result.structured.equipment.length}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : selectedView === 'readable' && result.readable ? (
                <div className="prose prose-sm max-w-none">
                  {expandedModels.has(result.model_id) ? (
                    <div className="bg-white rounded p-5 text-base text-gray-900 max-h-[800px] overflow-y-auto border-2 border-gray-300 leading-relaxed font-sans shadow-inner">
                      <MarkdownRenderer content={result.readable} />
                    </div>
                  ) : (
                    <div className="bg-white rounded p-4 text-sm text-gray-800 max-h-96 overflow-y-auto border-2 border-gray-300 leading-relaxed font-sans">
                      {result.readable.length > 500 ? (
                        <>
                          <MarkdownRenderer content={result.readable.substring(0, 500)} />
                          <p className="mt-3 text-gray-600 italic">[Click "Expand" to see full protocol]</p>
                        </>
                      ) : (
                        <MarkdownRenderer content={result.readable} />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                  ⚠️ No {selectedView} format available from this model
                </p>
              )}

              {/* Validation Errors */}
              {result.validation && !result.validation.valid && result.validation.errors && (
                <div className="mt-3 pt-3 border-t-2 border-red-200">
                  <h5 className="text-xs font-semibold text-red-800 mb-2">❌ Validation Errors:</h5>
                  <ul className="list-disc list-inside text-xs text-red-700 space-y-1 bg-red-50 p-2 rounded">
                    {result.validation.errors.map((error: string, idx: number) => (
                      <li key={idx} className="font-medium">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pairwise Differences - User-Friendly Version */}
      {diff && diff.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🔍 How Do the Models Compare?</h3>
            <p className="text-sm text-gray-700 mb-1">
              This section shows you where the AI models agreed and where they differed when creating the protocols. 
              <strong className="text-gray-900"> When models agree, you can be more confident in those parts.</strong> 
              When they differ, you may want to review those sections more carefully.
            </p>
          </div>
          <div className="space-y-4">
            {diff.map((d, idx) => {
              const addedKeys = d.diff.added ? Object.keys(d.diff.added) : [];
              const removedKeys = d.diff.removed ? Object.keys(d.diff.removed) : [];
              const modifiedKeys = d.diff.modified ? Object.keys(d.diff.modified) : [];
              const hasDifferences = addedKeys.length > 0 || removedKeys.length > 0 || modifiedKeys.length > 0;
              
              return (
                <div key={idx} className="border-2 border-gray-300 rounded-lg p-5 bg-gray-50">
                  <h4 className="font-semibold text-base text-gray-900 mb-3 pb-2 border-b-2 border-gray-300">
                    Comparing: <span className="text-blue-700">{d.model1}</span> vs <span className="text-purple-700">{d.model2}</span>
                  </h4>
                  
                  {!hasDifferences ? (
                    <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4">
                      <p className="text-green-900 font-semibold text-base">✅ These models created identical protocols!</p>
                      <p className="text-green-800 text-sm mt-1">Both models extracted the same information, which gives you high confidence in the results.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                        <p className="text-blue-900 font-semibold text-sm mb-2">📊 Summary of Differences:</p>
                        <ul className="text-sm text-blue-800 space-y-1 ml-4">
                          {addedKeys.length > 0 && (
                            <li>• <strong>{d.model2}</strong> included {addedKeys.length} {addedKeys.length === 1 ? 'item' : 'items'} that {d.model1} didn't mention</li>
                          )}
                          {removedKeys.length > 0 && (
                            <li>• <strong>{d.model1}</strong> included {removedKeys.length} {removedKeys.length === 1 ? 'item' : 'items'} that {d.model2} didn't mention</li>
                          )}
                          {modifiedKeys.length > 0 && (
                            <li>• Both models mentioned {modifiedKeys.length} {modifiedKeys.length === 1 ? 'item' : 'items'}, but with different details</li>
                          )}
                        </ul>
                      </div>

                      {/* Added Items */}
                      {addedKeys.length > 0 && (
                        <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
                          <h5 className="font-semibold text-base text-green-900 mb-2">
                            ➕ What {d.model2} Added (that {d.model1} didn't include):
                          </h5>
                          <p className="text-xs text-green-800 mb-2">This model found additional information:</p>
                          <div className="space-y-2">
                            {addedKeys.map((key) => {
                              const value = d.diff.added[key];
                              return (
                                <div key={key} className="bg-white rounded p-3 border border-green-300">
                                  <div className="font-semibold text-sm text-gray-900 mb-1 capitalize">{key.replace(/_/g, ' ')}:</div>
                                  <div className="text-sm text-gray-800">
                                    {formatDiffValue(value)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Removed Items */}
                      {removedKeys.length > 0 && (
                        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
                          <h5 className="font-semibold text-base text-orange-900 mb-2">
                            ➖ What {d.model1} Included (that {d.model2} missed):
                          </h5>
                          <p className="text-xs text-orange-800 mb-2">This model found information that the other didn't:</p>
                          <div className="space-y-2">
                            {removedKeys.map((key) => {
                              const value = d.diff.removed[key];
                              return (
                                <div key={key} className="bg-white rounded p-3 border border-orange-300">
                                  <div className="font-semibold text-sm text-gray-900 mb-1 capitalize">{key.replace(/_/g, ' ')}:</div>
                                  <div className="text-sm text-gray-800">
                                    {formatDiffValue(value)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Modified Items */}
                      {modifiedKeys.length > 0 && (
                        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                          <h5 className="font-semibold text-base text-yellow-900 mb-2">
                            🔄 Where They Disagreed (same topic, different details):
                          </h5>
                          <p className="text-xs text-yellow-800 mb-2">Both models mentioned these, but with different information:</p>
                          <div className="space-y-3">
                            {modifiedKeys.map((key) => {
                              const mod = d.diff.modified[key];
                              return (
                                <div key={key} className="bg-white rounded p-3 border border-yellow-300">
                                  <div className="font-semibold text-sm text-gray-900 mb-2 capitalize">{key.replace(/_/g, ' ')}:</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-blue-50 rounded p-2 border border-blue-200">
                                      <div className="text-xs font-semibold text-blue-900 mb-1">{d.model1} said:</div>
                                      <div className="text-sm text-gray-900">{formatDiffValue(mod.old || mod)}</div>
                                    </div>
                                    <div className="bg-purple-50 rounded p-2 border border-purple-200">
                                      <div className="text-xs font-semibold text-purple-900 mb-1">{d.model2} said:</div>
                                      <div className="text-sm text-gray-900">{formatDiffValue(mod.new || mod)}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* What This Means */}
                      <div className="bg-gray-100 border-2 border-gray-400 rounded-lg p-4">
                        <h5 className="font-semibold text-base text-gray-900 mb-2">💡 What This Means for You:</h5>
                        <ul className="text-sm text-gray-800 space-y-1 ml-4 list-disc">
                          <li>Review the sections where models disagreed - you may need to check the original publication</li>
                          <li>When models agree, those parts are more reliable</li>
                          <li>If one model found something the other missed, consider including both perspectives</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

