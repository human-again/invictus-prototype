'use client';

import { useState } from 'react';
import { api, type Publication, type ProtocolResponse } from '@/lib/api';
import { ProtocolViewer } from './ProtocolViewer';

export function PublicationList({
  publications,
  proteinName,
}: {
  publications: Publication[];
  proteinName: string;
}) {
  const [extracting, setExtracting] = useState<string | null>(null);
  const [protocols, setProtocols] = useState<Record<string, ProtocolResponse>>({});

  const handleExtract = async (publication: Publication) => {
    const key = publication.pmid || publication.url;
    setExtracting(key);

    try {
      // Build citation info from publication
      const citationInfo = {
        title: publication.title,
        authors: publication.authors,
        journal: publication.journal,
        year: publication.year,
      };

      // Extract methods with citation info
      const extracted = await api.extractMethods(
        publication.abstract || publication.title,
        proteinName,
        citationInfo
      );

      // Summarize protocol with citation info and both formats
      const protocolResponse = await api.summarizeProtocol(
        extracted.extracted_methods,
        citationInfo,
        'both' // Get both structured and readable formats
      );

      setProtocols((prev) => ({
        ...prev,
        [key]: protocolResponse,
      }));
    } catch (error) {
      console.error('Error extracting protocol:', error);
      alert('Failed to extract protocol. Make sure Ollama is running.');
    } finally {
      setExtracting(null);
    }
  };

  return (
    <div className="space-y-4">
      {publications.map((pub) => {
        const key = pub.pmid || pub.url;
        const protocol = protocols[key];
        const isExtracting = extracting === key;

        return (
          <div
            key={key}
            className="border border-gray-200 rounded-lg p-6 shadow-sm"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {pub.title}
            </h3>
            <div className="text-sm text-gray-800 mb-3">
              <p className="text-gray-800">
                {pub.authors} • {pub.year} • {pub.journal}
              </p>
              {pub.url && (
                <a
                  href={pub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                >
                  View Publication
                </a>
              )}
            </div>
            <p className="text-gray-900 mb-4 line-clamp-3">{pub.abstract}</p>

            <button
              onClick={() => handleExtract(pub)}
              disabled={isExtracting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExtracting ? 'Extracting...' : 'Extract Protocol'}
            </button>

            {protocol && (
              <div className="mt-4">
                <ProtocolViewer protocolResponse={protocol} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

