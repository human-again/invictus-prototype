"use client";

import { useEffect, useState } from "react";
import type { ExtractComparisonResult, Publication } from "@/lib/api";
import { api } from "@/lib/api";
import ExtractionCompare from "../ExtractionCompare";
import ModelSelector from "../ModelSelector";
import PromptEditor from "../PromptEditor";
import ExtractionMethodExplanation from "./ExtractionMethodExplanation";
import ExtractionProgressTracker from "./ExtractionProgressTracker";
import CollapsibleSection from "../CollapsibleSection";

interface Screen2ExtractProps {
  publication: Publication | null;
  extractModels: string[];
  extractionResults: ExtractComparisonResult[];
  selectedExtraction: ExtractComparisonResult | null;
  onModelsChange: (models: string[]) => void;
  onExtractionComplete: (results: ExtractComparisonResult[]) => void;
  onExtractionSelect: (result: ExtractComparisonResult) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function Screen2Extract({
  publication,
  extractModels,
  extractionResults,
  selectedExtraction,
  onModelsChange,
  onExtractionComplete,
  onExtractionSelect,
  onContinue,
  onBack,
}: Screen2ExtractProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<
    Record<
      string,
      | "pending"
      | "fetching"
      | "extracting"
      | "validating"
      | "success"
      | "failed"
    >
  >({});
  const [extractError, setExtractError] = useState<Record<string, string>>({});
  const [inputExcerpt, setInputExcerpt] = useState<string>("");
  const [truncationWarning, setTruncationWarning] = useState<string>("");
  const [consensus, setConsensus] = useState<Record<string, unknown> | null>(
    null,
  );

  // Load default prompt on first render so it's ready when editor opens
  useEffect(() => {
    let isMounted = true;

    const loadDefaultPrompt = async () => {
      try {
        setLoadingPrompt(true);
        const promptData = await api.getPrompts("extract");
        const defaultPrompt =
          promptData.defaults?.extract_methods || promptData.task_default || "";
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

  const handleStartExtraction = async () => {
    if (!publication || extractModels.length === 0) {
      alert("Please select a publication and at least one model");
      return;
    }

    // Clear previous extraction results when starting a new extraction
    onExtractionComplete([]);
    setExtracting(true);
    setExtractError({});

    // Initialize progress
    const initialProgress: Record<
      string,
      | "pending"
      | "fetching"
      | "extracting"
      | "validating"
      | "success"
      | "failed"
    > = {};
    extractModels.forEach((modelId) => {
      initialProgress[modelId] = "pending";
    });
    setProgress(initialProgress);

    try {
      // Update progress to fetching
      extractModels.forEach((modelId) => {
        setProgress((prev) => ({ ...prev, [modelId]: "fetching" }));
      });

      // Run extraction comparison
      const response = await api.compareExtract({
        publication: publication,
        models: extractModels,
        async_job: false,
      });

      // Update progress as models complete
      if (response.results) {
        response.results.forEach((result: ExtractComparisonResult) => {
          if (result.status === "success") {
            setProgress((prev) => ({ ...prev, [result.model_id]: "success" }));
          } else {
            setProgress((prev) => ({ ...prev, [result.model_id]: "failed" }));
            setExtractError((prev) => ({
              ...prev,
              [result.model_id]: result.error || "Extraction failed",
            }));
          }
        });
      }

      setInputExcerpt(response.input_excerpt || "");
      setTruncationWarning(response.truncation_warning || "");
      setConsensus(response.consensus || null);
      onExtractionComplete(response.results || []);
    } catch (error) {
      console.error("Error during extraction:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Extraction failed: ${message}`);
      extractModels.forEach((modelId) => {
        setProgress((prev) => ({ ...prev, [modelId]: "failed" }));
        setExtractError((prev) => ({
          ...prev,
          [modelId]: message || "Extraction failed",
        }));
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Step 2 of 3: Extract Methods
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              Extract the Materials and Methods section from the selected
              publication. Watch the progress as each model processes the text.
            </p>
          </div>
          <div className="text-2xl font-bold text-green-600">2/3</div>
        </div>
      </div>

      {/* Process Explanation */}
      <ExtractionMethodExplanation />

      {/* Selected Publication */}
      {publication && (
        <CollapsibleSection
          title="Selected Publication"
          icon="📄"
          id="selected-publication"
          defaultExpanded={true}
        >
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">
              {publication.title}
            </h4>
            <p className="text-sm text-gray-700">
              {publication.authors} • {publication.journal} ({publication.year})
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
          task="extract"
          selectedModels={extractModels}
          onSelectionChange={onModelsChange}
          mode="balanced"
        />
      </CollapsibleSection>

      {/* Prompt Editor */}
      {extractModels.length > 0 && (
        <CollapsibleSection
          title="Edit Extraction Prompt"
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
                  task="extract"
                  modelId={extractModels[0] || ""}
                  value={currentPrompt}
                  onChange={setCurrentPrompt}
                />
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Start Extraction Button */}
      {publication &&
        extractModels.length > 0 &&
        !extracting &&
        extractionResults.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button
              onClick={handleStartExtraction}
              type="button"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg shadow-md"
            >
              Start Extraction
            </button>
          </div>
        )}

      {/* Rerun Extraction Button - Show when results exist */}
      {publication &&
        extractModels.length > 0 &&
        !extracting &&
        extractionResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button
              onClick={handleStartExtraction}
              type="button"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg shadow-md"
            >
              Rerun Extraction
            </button>
          </div>
        )}

      {/* Progress Tracking */}
      {extracting && (
        <CollapsibleSection
          title="Extraction Progress"
          icon="⏳"
          id="extraction-progress"
          defaultExpanded={true}
        >
          <div className="space-y-3">
            {extractModels.map((modelId) => (
              <ExtractionProgressTracker
                key={modelId}
                modelId={modelId}
                status={progress[modelId] || "pending"}
                error={extractError[modelId]}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Extraction Results */}
      {extractionResults.length > 0 && (
        <CollapsibleSection
          title="Extraction Results"
          icon="📊"
          id="extraction-results"
          defaultExpanded={true}
        >
          <ExtractionCompare
            results={extractionResults}
            inputExcerpt={inputExcerpt}
            truncationWarning={truncationWarning}
            consensus={consensus}
            onSelect={onExtractionSelect}
          />
        </CollapsibleSection>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          type="button"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
        >
          ← Back to Search
        </button>
        {selectedExtraction && (
          <button
            onClick={onContinue}
            type="button"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Continue to Summarization →
          </button>
        )}
      </div>
    </div>
  );
}
