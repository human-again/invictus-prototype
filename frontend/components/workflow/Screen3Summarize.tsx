"use client";

import { useEffect, useState } from "react";
import type {
  ExtractComparisonResult,
  SummarizeComparisonResult,
} from "@/lib/api";
import { api } from "@/lib/api";
import ModelSelector from "../ModelSelector";
import PromptEditor from "../PromptEditor";
import SummarizationCompare from "../SummarizationCompare";
import BeforeAfterComparison from "./BeforeAfterComparison";
import CollapsibleSection from "../CollapsibleSection";

interface Screen3SummarizeProps {
  selectedExtraction: ExtractComparisonResult | null;
  summarizeModels: string[];
  summarizationResults: SummarizeComparisonResult[];
  onModelsChange: (models: string[]) => void;
  onSummarizationComplete: (results: SummarizeComparisonResult[]) => void;
  onComplete: () => void;
  onBack: () => void;
  onStartNew: () => void;
}

export default function Screen3Summarize({
  selectedExtraction,
  summarizeModels,
  summarizationResults,
  onModelsChange,
  onSummarizationComplete,
  onComplete,
  onBack,
  onStartNew,
}: Screen3SummarizeProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [format, setFormat] = useState<"structured" | "readable" | "both">(
    "both",
  );
  const [rerunHistory, setRerunHistory] = useState<
    SummarizeComparisonResult[][]
  >([]);
  const [consensus, setConsensus] = useState<Record<string, unknown> | null>(
    null,
  );
  const [outliers, setOutliers] = useState<Record<string, string[]>>({});
  const [diff, setDiff] = useState<unknown[]>([]);

  // Load default prompt on first render
  useEffect(() => {
    let isMounted = true;

    const loadDefaultPrompt = async () => {
      try {
        setLoadingPrompt(true);
        const promptData = await api.getPrompts("summarize");
        const defaultPrompt =
          promptData.defaults?.summarize_protocol_json ||
          promptData.task_default ||
          "";
        if (!isMounted) return;
        setCurrentPrompt((prev) => prev || defaultPrompt);
      } catch (error) {
        console.error("Error loading prompt:", error);
      } finally {
        if (isMounted) {
          setLoadingPrompt(false);
        }
      }
    };

    loadDefaultPrompt();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartSummarization = async () => {
    if (!selectedExtraction || summarizeModels.length === 0) {
      alert("Please select an extraction result and at least one model");
      return;
    }

    setSummarizing(true);

    try {
      const extractedText = selectedExtraction.extracted_text || "";
      if (!extractedText) {
        throw new Error("No extracted text available");
      }

      const response = await api.compareSummarize({
        extracted_methods: extractedText,
        models: summarizeModels,
        format: format,
      });

      if (response.results) {
        onSummarizationComplete(response.results);
        setConsensus(response.consensus || null);
        setOutliers(response.outliers || {});
        setDiff(response.diff || []);

        // Add to rerun history
        setRerunHistory((prev) => [...prev, response.results]);
      }
    } catch (error) {
      console.error("Error during summarization:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Summarization failed: ${message}`);
    } finally {
      setSummarizing(false);
    }
  };

  const handleRerun = async () => {
    // Rerun with current prompt (if edited)
    await handleStartSummarization();
  };

  // Get first successful result for before/after comparison
  const getBeforeAfterData = () => {
    if (!selectedExtraction) return null;

    const firstSuccess = summarizationResults.find(
      (r) => r.status === "success",
    );
    if (!firstSuccess) return null;

    return {
      before: selectedExtraction.extracted_text || "",
      after:
        format === "readable" || format === "both"
          ? firstSuccess.readable || ""
          : JSON.stringify(firstSuccess.structured, null, 2),
      format:
        format === "readable" || format === "both" ? "readable" : "structured",
    };
  };

  const beforeAfterData = getBeforeAfterData();

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Step 3 of 3: Summarize Protocol
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              Convert the extracted methods into a structured, step-by-step
              protocol. Edit the prompt and rerun as many times as needed.
            </p>
          </div>
          <div className="text-2xl font-bold text-purple-600">3/3</div>
        </div>
      </div>

      {/* Process Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          📋 What is Summarization?
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Summarization converts the raw extracted text into a structured
          protocol that's easy to follow in the laboratory. The process:
        </p>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 ml-2">
          <li>Takes the extracted Materials and Methods text</li>
          <li>Organizes it into clear, numbered steps</li>
          <li>Extracts and lists all materials with concentrations</li>
          <li>Identifies equipment and conditions</li>
          <li>Creates a readable, step-by-step protocol</li>
        </ul>
      </div>

      {/* Selected Extraction */}
      {selectedExtraction && (
        <CollapsibleSection
          title="Selected Extraction"
          icon="📄"
          id="selected-extraction"
          defaultExpanded={true}
        >
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">
                Model: {selectedExtraction.model_id}
              </span>
              {selectedExtraction.confidence !== undefined && (
                <span className="text-sm text-gray-700">
                  Confidence: {(selectedExtraction.confidence * 100).toFixed(0)}
                  %
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 line-clamp-3">
              {selectedExtraction.extracted_text?.substring(0, 200)}...
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* Model Selection */}
      <CollapsibleSection
        title="Select AI Models"
        icon="🤖"
        id="model-selection"
        defaultExpanded={true}
      >
        <ModelSelector
          task="summarize"
          selectedModels={summarizeModels}
          onSelectionChange={onModelsChange}
          mode="balanced"
        />
      </CollapsibleSection>

      {/* Format Selection */}
      <CollapsibleSection
        title="Output Format"
        icon="📝"
        id="output-format"
        defaultExpanded={true}
      >
        <div className="flex gap-2">
          {(["structured", "readable", "both"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              type="button"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                format === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {format === "structured" && "Machine-readable JSON format"}
          {format === "readable" && "Human-friendly step-by-step guide"}
          {format === "both" && "Both structured JSON and readable format"}
        </p>
      </CollapsibleSection>

      {/* Prompt Editor */}
      {summarizeModels.length > 0 && (
        <CollapsibleSection
          title="Edit Summarization Prompt"
          icon="✏️"
          id="prompt-editor"
          defaultExpanded={showPromptEditor}
        >
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              type="button"
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium"
            >
              {showPromptEditor ? "Hide Editor" : "Show Editor"}
            </button>
          </div>
          {showPromptEditor && (
            <div>
              {loadingPrompt ? (
                <div className="flex items-center gap-2 p-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-700">
                    Loading prompt...
                  </span>
                </div>
              ) : (
                <PromptEditor
                  task="summarize"
                  modelId={summarizeModels[0] || ""}
                  value={currentPrompt}
                  onChange={setCurrentPrompt}
                />
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Start/Rerun Summarization */}
      {selectedExtraction && summarizeModels.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          {summarizationResults.length === 0 ? (
            <button
              onClick={handleStartSummarization}
              disabled={summarizing}
              type="button"
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {summarizing ? "Summarizing..." : "Start Summarization"}
            </button>
          ) : (
            <button
              onClick={handleRerun}
              disabled={summarizing}
              type="button"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {summarizing ? "Rerunning..." : "🔄 Rerun with Edited Prompt"}
            </button>
          )}
        </div>
      )}

      {/* Before/After Comparison */}
      {beforeAfterData && summarizationResults.length > 0 && (
        <CollapsibleSection
          title="Before/After Comparison"
          icon="🔄"
          id="before-after"
          defaultExpanded={true}
        >
          <BeforeAfterComparison
            before={beforeAfterData.before}
            after={beforeAfterData.after}
            format={beforeAfterData.format}
          />
        </CollapsibleSection>
      )}

      {/* Summarization Results */}
      {summarizationResults.length > 0 && (
        <CollapsibleSection
          title="Summarization Results"
          icon="📋"
          id="summarization-results"
          defaultExpanded={true}
        >
          <SummarizationCompare
            results={summarizationResults}
            consensus={consensus}
            outliers={outliers}
            diff={diff}
            onRerun={handleRerun}
          />
        </CollapsibleSection>
      )}

      {/* Rerun History */}
      {rerunHistory.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📜 Rerun History
          </h3>
          <p className="text-sm text-gray-700 mb-4">
            You've run summarization {rerunHistory.length} time
            {rerunHistory.length > 1 ? "s" : ""}. Compare results from different
            runs to see how prompt changes affect the output.
          </p>
          <div className="space-y-2">
            {rerunHistory.map((run, idx) => {
              const runKey =
                run.map((result) => result.model_id).join("|") || `run-${idx}`;

              return (
                <div
                  key={runKey}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      Run #{idx + 1}
                    </span>
                    <span className="text-xs text-gray-600">
                      {run.filter((r) => r.status === "success").length} /{" "}
                      {run.length} models succeeded
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          type="button"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
        >
          ← Back to Extraction
        </button>
        <div className="flex gap-3">
          <button
            onClick={onStartNew}
            type="button"
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
          >
            Start New Workflow
          </button>
          {summarizationResults.length > 0 && (
            <button
              onClick={onComplete}
              type="button"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Complete ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
