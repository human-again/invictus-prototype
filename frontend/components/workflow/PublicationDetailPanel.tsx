"use client";

import { useMemo } from "react";
import type { ProteinDetails, Publication } from "@/lib/api";

interface RankingInfo {
  modelId: string;
  score: number;
  explanation: string;
}

interface YieldInfo {
  yield?: string;
  yield_value?: string;
  yield_units?: string;
  context?: string;
  raw_text?: string;
}

interface PublicationDetailPanelProps {
  publication: Publication;
  rankingInfo: RankingInfo[];
  proteinDetails: ProteinDetails | null;
  onClose?: () => void;
  onContinue?: () => void;
}

export default function PublicationDetailPanel({
  publication,
  rankingInfo,
  proteinDetails,
  onClose,
  onContinue,
}: PublicationDetailPanelProps) {
  const yieldInfo = useMemo<YieldInfo | null>(() => {
    const text = `${publication.abstract ?? ""}\n${publication.title ?? ""}`;
    if (!text.trim()) {
      return null;
    }

    const patterns: RegExp[] = [
      /(?:protein\s+)?yield\s*(?:of|was|is|:)?\s*([\d.]+)\s*(?:mg\/?L|mg\s*per\s*L|%|fold|times)/gi,
      /([\d.]+)\s*(?:mg\/?L|mg\s*per\s*L)\s*(?:protein\s+)?yield/gi,
      /yielded\s+([\d.]+)\s*(?:mg\/?L|mg\s*per\s*L|%|fold)/gi,
      /yield\s*(?:of|was|is)\s*([\d.]+)\s*(?:mg\/?L|mg\s*per\s*L|%)/gi,
      /(?:final\s+)?yield\s*(?:of|was|is|:)?\s*([\d.]+)\s*%/gi,
      /([\d.]+)\s*%\s*(?:yield|recovery)/gi,
      /([\d.]+)\s*(?:fold|times)\s*(?:purification|enrichment)/gi,
      /purified\s+([\d.]+)\s*(?:fold|times)/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const valueStr = match[1];
        const numericValue = Number.parseFloat(valueStr);
        if (Number.isNaN(numericValue)) {
          continue;
        }

        const fullMatch = match[0];
        const lower = fullMatch.toLowerCase();

        let units = "unknown";
        if (lower.includes("mg/l") || lower.includes("mg per l")) {
          units = "mg/L";
        } else if (lower.includes("%")) {
          units = "%";
        } else if (lower.includes("fold") || lower.includes("times")) {
          units = "fold";
        }

        let context = "protein yield";
        if (lower.includes("purification")) {
          context = "purification yield";
        } else if (lower.includes("extraction")) {
          context = "extraction yield";
        } else if (lower.includes("recovery")) {
          context = "recovery yield";
        }

        const start = Math.max(0, (match.index ?? 0) - 50);
        const end = Math.min(
          text.length,
          (match.index ?? 0) + fullMatch.length + 50,
        );

        return {
          yield: fullMatch,
          yield_value: numericValue.toString(),
          yield_units: units,
          context,
          raw_text: text.slice(start, end).trim(),
        };
      }
    }

    return null;
  }, [publication]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {publication.title}
          </h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <span className="font-semibold">Authors:</span>{" "}
              {publication.authors}
            </p>
            <p>
              <span className="font-semibold">Journal:</span>{" "}
              {publication.journal} ({publication.year})
            </p>
            {publication.pmid && (
              <p>
                <span className="font-semibold">PubMed ID:</span>{" "}
                {publication.pmid}
              </p>
            )}
            {publication.doi && (
              <p>
                <span className="font-semibold">DOI:</span> {publication.doi}
              </p>
            )}
            {publication.citation_count !== undefined && (
              <p>
                <span className="font-semibold">Citations:</span>{" "}
                {publication.citation_count}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            className="ml-4 text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Relevancy Explanations */}
      {rankingInfo.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            🎯 Why This Publication is Relevant
          </h3>
          <div className="space-y-3">
            {rankingInfo.map((info) => (
              <div
                key={info.modelId}
                className="bg-white rounded p-3 border border-blue-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {info.modelId}
                  </span>
                  <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    Score: {info.score}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{info.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yield Information */}
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">
          📊 Yield Information
        </h3>
        {yieldInfo ? (
          <div className="space-y-2">
            <div className="bg-white rounded p-3 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  Yield Value
                </span>
                <span className="text-lg font-bold text-green-700">
                  {yieldInfo.yield_value} {yieldInfo.yield_units}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">
                <span className="font-semibold">Type:</span> {yieldInfo.context}
              </p>
              {yieldInfo.raw_text && (
                <p className="text-xs text-gray-600 italic">
                  "{yieldInfo.raw_text.substring(0, 150)}..."
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            No yield information found in the publication abstract.
          </p>
        )}
      </div>

      {/* Protein Purification Factors */}
      {proteinDetails && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            🧬 Key Protein Purification Factors
          </h3>
          <div className="space-y-3">
            {proteinDetails.expression_medium &&
              proteinDetails.expression_medium.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    Expression Medium:
                  </span>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {proteinDetails.expression_medium.map((medium: string) => (
                      <li key={medium} className="text-sm text-gray-700">
                        {medium}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {proteinDetails.solubility && (
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Solubility:
                </span>
                <p className="text-sm text-gray-700 mt-1">
                  {proteinDetails.solubility}
                </p>
              </div>
            )}
            {proteinDetails.stability && (
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Stability:
                </span>
                <p className="text-sm text-gray-700 mt-1">
                  {proteinDetails.stability}
                </p>
              </div>
            )}
            {proteinDetails.purification_tags &&
              proteinDetails.purification_tags.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    Purification Tags:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {proteinDetails.purification_tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Abstract */}
      {publication.abstract && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">📄 Abstract</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {publication.abstract}
          </p>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        {publication.url && (
          <a
            href={publication.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            🔗 View Publication
          </a>
        )}
        {publication.doi && (
          <a
            href={`https://doi.org/${publication.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            📄 View DOI
          </a>
        )}
        {publication.pmid && (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${publication.pmid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            📚 View PubMed
          </a>
        )}
      </div>

      {/* Continue Button */}
      {onContinue && (
        <div className="pt-4 border-t">
          <button
            onClick={onContinue}
            type="button"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg shadow-md"
          >
            Continue to Extraction →
          </button>
        </div>
      )}
    </div>
  );
}
