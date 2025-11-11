'use client';

import { useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer';

interface BeforeAfterComparisonProps {
  before: string; // Extracted text
  after: string; // Summarized protocol
  format?: 'structured' | 'readable';
}

export default function BeforeAfterComparison({
  before,
  after,
  format = 'readable',
}: BeforeAfterComparisonProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'toggle'>('side-by-side');
  const [showBefore, setShowBefore] = useState(true);

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Before & After Comparison</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('toggle')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'toggle'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Toggle View
          </button>
        </div>
      </div>

      {/* Comparison Display */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Before */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-blue-400">
              <h4 className="font-semibold text-blue-900">Before: Extracted Text</h4>
              <span className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded font-medium">
                Raw Extraction
              </span>
            </div>
            <div className="bg-white rounded p-4 text-sm text-gray-800 max-h-96 overflow-y-auto border border-blue-200 leading-relaxed">
              {before}
            </div>
          </div>

          {/* After */}
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-green-400">
              <h4 className="font-semibold text-green-900">After: Summarized Protocol</h4>
              <span className="text-xs bg-green-200 text-green-900 px-2 py-1 rounded font-medium">
                {format === 'readable' ? 'Readable Format' : 'Structured JSON'}
              </span>
            </div>
            <div className="bg-white rounded p-4 text-sm text-gray-800 max-h-96 overflow-y-auto border border-green-200 leading-relaxed">
              {format === 'readable' ? (
                <MarkdownRenderer content={after} />
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap">{after}</pre>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setShowBefore(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showBefore
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Before: Extracted Text
              </button>
              <button
                onClick={() => setShowBefore(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !showBefore
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                After: Summarized Protocol
              </button>
            </div>
          </div>
          <div className={`rounded p-4 text-sm text-gray-800 max-h-96 overflow-y-auto border-2 leading-relaxed ${
            showBefore
              ? 'bg-blue-50 border-blue-300'
              : 'bg-green-50 border-green-300'
          }`}>
            {showBefore ? (
              <div className="whitespace-pre-wrap">{before}</div>
            ) : (
              format === 'readable' ? (
                <MarkdownRenderer content={after} />
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap">{after}</pre>
              )
            )}
          </div>
        </div>
      )}

      {/* Key Differences Highlight */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">💡 Key Differences</h4>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
          <li><strong>Before:</strong> Raw extracted text from the publication, may include incomplete sentences or formatting issues</li>
          <li><strong>After:</strong> Structured, organized protocol with clear steps, materials, and conditions</li>
          <li>The summarization process organizes the information into a usable format for laboratory work</li>
        </ul>
      </div>
    </div>
  );
}

