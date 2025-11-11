"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Publication,
  SearchComparisonResult,
  SearchResultItem,
} from "@/lib/api";
import ComparisonGrid from "../ComparisonGrid";

export interface RankingInfo {
  modelId: string;
  score: number;
  explanation: string;
}

interface ProgressiveResultsGridProps {
  models: string[];
  uniprotId: string;
  proteinName: string;
  methodologyFocus?: string;
  prompts?: Record<string, string>;
  candidates: Publication[];
  onSelectPublication?: (
    publication: Publication,
    rankingInfo: RankingInfo[],
  ) => void;
  onRerun?: (modelId: string) => void;
  runTrigger: number;
  onSearchStateChange?: (isRunning: boolean) => void;
  onSearchComplete?: (results: SearchComparisonResult[]) => void;
  initialResults?: SearchComparisonResult[];
}

export default function ProgressiveResultsGrid({
  models,
  uniprotId,
  proteinName,
  methodologyFocus = "purification",
  prompts,
  candidates,
  onSelectPublication,
  onRerun,
  runTrigger,
  onSearchStateChange,
  onSearchComplete,
  initialResults = [],
}: ProgressiveResultsGridProps) {
  const [results, setResults] = useState<SearchComparisonResult[]>(initialResults);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const resultsRef = useRef<SearchComparisonResult[]>(initialResults);
  const latestConfigRef = useRef({
    models,
    uniprotId,
    proteinName,
    methodologyFocus,
    prompts,
    candidates,
  });
  const activeRunRef = useRef(0);

  const { normalizeTitle, candidateMap } = useMemo(() => {
    const normalize = (value: string) =>
      value.toLowerCase().replace(/\s+/g, " ").trim();

    const map = new Map<string, Publication>();
    candidates.forEach((publication) => {
      if (publication.title) {
        map.set(normalize(publication.title), publication);
      }
    });

    return {
      normalizeTitle: normalize,
      candidateMap: map,
    };
  }, [candidates]);

  useEffect(() => {
    latestConfigRef.current = {
      models,
      uniprotId,
      proteinName,
      methodologyFocus,
      prompts,
      candidates,
    };
  }, [models, uniprotId, proteinName, methodologyFocus, prompts, candidates]);

  // Update results when initialResults change (e.g., when navigating back)
  useEffect(() => {
    if (runTrigger === 0 && initialResults.length > 0) {
      setResults(initialResults);
      resultsRef.current = initialResults;
    }
  }, [initialResults, runTrigger]);

  useEffect(() => {
    if (runTrigger === 0) return;

    const {
      models: currentModels,
      uniprotId: currentUniprotId,
      proteinName: currentProteinName,
      methodologyFocus: currentMethodologyFocus,
      prompts: currentPrompts,
    } = latestConfigRef.current;

    if (!currentUniprotId || currentModels.length === 0) return;

    const runId = runTrigger;
    activeRunRef.current = runId;
    onSearchStateChange?.(true);

    // Initialize loading states
    const initialLoading: Record<string, boolean> = {};
    currentModels.forEach((modelId) => {
      initialLoading[modelId] = true;
    });
    setLoading(initialLoading);
    // Clear previous results when starting a new search
    setResults([]);
    resultsRef.current = [];

    const runSearches = async () => {
      const { api } = await import("@/lib/api");

      const promises = currentModels.map(async (modelId) => {
        try {
          const response = await api.compareSearch({
            uniprot_id: currentUniprotId,
            protein_name: currentProteinName,
            methodology_focus: currentMethodologyFocus,
            models: [modelId],
            prompts: currentPrompts,
            mode: "balanced",
            async_job: false,
          });

          if (activeRunRef.current !== runId) return;

          if (response.results && response.results.length > 0) {
            const result = response.results[0];
            setResults((prev) => {
              if (activeRunRef.current !== runId) return prev;
              const filtered = prev.filter((r) => r.model_id !== modelId);
              const updated = [...filtered, result];
              resultsRef.current = updated;
              return updated;
            });
          }

          setLoading((prev) => {
            if (activeRunRef.current !== runId) return prev;
            return { ...prev, [modelId]: false };
          });
        } catch (err) {
          if (activeRunRef.current !== runId) return;

          const message =
            err instanceof Error ? err.message : "Failed to fetch results";

          console.error(`Search failed for model ${modelId}:`, message);
          setLoading((prev) => ({ ...prev, [modelId]: false }));

          setResults((prev) => {
            if (activeRunRef.current !== runId) return prev;
            const filtered = prev.filter((r) => r.model_id !== modelId);
            const updated: SearchComparisonResult[] = [
              ...filtered,
              {
                model_id: modelId,
                status: "failed" as const,
                error: message,
                results: [],
                time_s: 0,
                tokens: 0,
                cost: 0,
              },
            ];
            resultsRef.current = updated;
            return updated;
          });
        }
      });

      await Promise.allSettled(promises);

      if (activeRunRef.current === runId) {
        onSearchStateChange?.(false);
        // Final notification after all searches complete
        onSearchComplete?.(resultsRef.current);
      }
    };

    runSearches();

    return () => {
      if (activeRunRef.current === runId) {
        onSearchStateChange?.(false);
      }
    };
  }, [runTrigger, onSearchStateChange]);

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          📊 Understanding the Results
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Results are appearing as each AI model completes its analysis. Compare
          the rankings to see which publications multiple models agree on -
          these are likely the most relevant.
        </p>
        <p className="text-sm text-gray-700">
          <strong>Next step:</strong> Click on any publication below to see
          detailed information and continue to extraction.
        </p>
      </div>

      {/* Comparison Grid */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ⚡ Model Performance Summary
          </h3>
          <ComparisonGrid results={results} onRerun={onRerun} />
        </div>
      )}

      {/* Loading indicators */}
      {Object.values(loading).some((l) => l) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ⏳ Waiting for Results
          </h3>
          <div className="space-y-2">
            {models.map(
              (modelId) =>
                loading[modelId] && (
                  <div
                    key={modelId}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-700 font-medium">
                      {modelId} - Analyzing publications...
                    </span>
                  </div>
                ),
            )}
          </div>
        </div>
      )}

      {/* Multi-column Publication Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            📚 Publications Ranked by Each Model
          </h3>
          <p className="text-sm text-gray-700 mb-1">
            <strong>
              Each container below shows results from ONE specific AI model.
            </strong>{" "}
            Compare how different models ranked the same publications.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Publications ranked #1 by multiple models are most likely relevant.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => (
              <div
                key={result.model_id}
                className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 shadow-md"
              >
                <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-blue-200">
                  <div>
                    <h4 className="font-bold text-base text-gray-900">
                      {result.model_id}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">Model Results</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      result.status === "success"
                        ? "bg-green-100 text-green-800"
                        : result.status === "timeout"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {result.status}
                  </span>
                </div>

                {result.status === "timeout" ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-orange-50 rounded border-2 border-orange-300">
                      <p className="text-sm font-semibold text-orange-800 mb-1">
                        ⏱️ Request Timed Out
                      </p>
                      {result.error && (
                        <p className="text-xs text-orange-700 mt-1">
                          {result.error}
                        </p>
                      )}
                      {onRerun && (
                        <button
                          onClick={() => onRerun(result.model_id)}
                          type="button"
                          className="mt-2 px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded hover:bg-orange-200 font-medium"
                        >
                          🔄 Retry
                        </button>
                      )}
                    </div>
                  </div>
                ) : result.status === "failed" ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 rounded border-2 border-red-200">
                      <p className="text-sm font-semibold text-red-800 mb-1">
                        ❌ Model Failed
                      </p>
                      {result.error && (
                        <p className="text-xs text-red-700 mt-1">
                          {result.error}
                        </p>
                      )}
                      {onRerun && (
                        <button
                          onClick={() => onRerun(result.model_id)}
                          type="button"
                          className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200 font-medium"
                        >
                          🔄 Retry
                        </button>
                      )}
                    </div>
                  </div>
                ) : result.results && result.results.length > 0 ? (
                  <div className="space-y-2">
                    {result.results
                      .slice(0, 5)
                      .map((pub: SearchResultItem, idx: number) => {
                        const matchedCandidate =
                          (pub.title &&
                            candidateMap.get(normalizeTitle(pub.title))) ||
                          null;

                        const authorsFromResult = Array.isArray(pub.authors)
                          ? pub.authors.join(", ")
                          : typeof pub.authors === "string"
                            ? pub.authors
                            : "";

                        const combinedPublication: Publication = {
                          title:
                            pub.title ??
                            matchedCandidate?.title ??
                            "Untitled publication",
                          abstract: matchedCandidate?.abstract ?? "",
                          authors:
                            authorsFromResult ??
                            matchedCandidate?.authors ??
                            "",
                          year:
                            (typeof pub.year === "number"
                              ? String(pub.year)
                              : pub.year) ??
                            matchedCandidate?.year ??
                            "",
                          journal:
                            pub.journal ?? matchedCandidate?.journal ?? "",
                          url: pub.url ?? matchedCandidate?.url ?? "",
                          pmid:
                            (pub.pmid as string | undefined) ??
                            matchedCandidate?.pmid ??
                            "",
                          doi:
                            (pub.doi as string | undefined) ??
                            matchedCandidate?.doi ??
                            "",
                          citation_count:
                            (typeof pub.citation_count === "number"
                              ? pub.citation_count
                              : undefined) ?? matchedCandidate?.citation_count,
                          pdf_url:
                            (typeof pub.pdf_url === "string"
                              ? pub.pdf_url
                              : undefined) ?? matchedCandidate?.pdf_url,
                          source:
                            (pub.source as string | undefined) ??
                            matchedCandidate?.source ??
                            "",
                        };

                        const handleSelectPublication = () => {
                          if (!onSelectPublication) return;

                          const rankingInfo: RankingInfo[] = [];
                          results.forEach((comparisonResult) => {
                            if (
                              comparisonResult.status === "success" &&
                              comparisonResult.results
                            ) {
                              const rankedPub = comparisonResult.results.find(
                                (candidate) =>
                                  candidate.title === pub.title ||
                                  candidate.title?.toLowerCase() ===
                                    pub.title?.toLowerCase(),
                              );
                              if (rankedPub) {
                                rankingInfo.push({
                                  modelId: comparisonResult.model_id,
                                  score: rankedPub.score || 0,
                                  explanation: rankedPub.explanation || "",
                                });
                              }
                            }
                          });

                          onSelectPublication(combinedPublication, rankingInfo);
                        };

                        return (
                          <div
                            key={`${result.model_id}-${pub.title ?? idx}`}
                            className="p-3 bg-white rounded border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500"
                          >
                            <button
                              type="button"
                              onClick={handleSelectPublication}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  #{idx + 1}
                                </span>
                                {pub.score !== undefined && (
                                  <span className="text-xs text-gray-700 font-medium">
                                    Score: {pub.score}
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                                {combinedPublication.title}
                              </h5>
                              {combinedPublication.authors && (
                                <p className="text-xs text-gray-600 line-clamp-2 mb-1">
                                  {combinedPublication.authors}
                                </p>
                              )}
                              {(combinedPublication.journal ||
                                combinedPublication.year) && (
                                <p className="text-xs text-gray-500 mb-2">
                                  {combinedPublication.journal}
                                  {combinedPublication.journal &&
                                    combinedPublication.year &&
                                    " • "}
                                  {combinedPublication.year}
                                </p>
                              )}
                              {pub.explanation && (
                                <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">
                                  {pub.explanation}
                                </p>
                              )}
                            </button>
                            {combinedPublication.url && (
                              <a
                                href={combinedPublication.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center text-xs font-medium text-blue-700 hover:text-blue-900"
                              >
                                Open article ↗
                              </a>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                      ⚠️ No results from this model
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
