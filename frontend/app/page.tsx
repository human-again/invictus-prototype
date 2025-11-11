"use client";

import { useCallback, useEffect, useState } from "react";
import Screen1Search from "@/components/workflow/Screen1Search";
import Screen2Extract from "@/components/workflow/Screen2Extract";
import Screen3Summarize from "@/components/workflow/Screen3Summarize";
import {
  clearWorkflowState,
  initialWorkflowState,
  type WorkflowState,
} from "@/components/workflow/WorkflowState";
import {
  api,
  type ExtractComparisonResult,
  type Protein,
  type Publication,
  type SummarizeComparisonResult,
} from "@/lib/api";

export default function Home() {
  const [workflowState, setWorkflowState] =
    useState<WorkflowState>(initialWorkflowState);
  const [sessionCost, setSessionCost] = useState<number | null>(null);
  const [sessionCostLoading, setSessionCostLoading] = useState(false);

  const loadSessionCost = useCallback(async () => {
    try {
      setSessionCostLoading(true);
      const data = await api.getSessionCost();
      setSessionCost(data.session_cost || 0);
    } catch (error) {
      console.error("Error loading session cost:", error);
    } finally {
      setSessionCostLoading(false);
    }
  }, []);

  // Load protein details when protein is selected
  useEffect(() => {
    const selectedProtein = workflowState.protein;
    if (!selectedProtein) {
      return;
    }

    const fetchProteinDetails = async () => {
      try {
        const details = await api.getProteinDetails(selectedProtein.uniprot_id);
        setWorkflowState((prev) => ({ ...prev, proteinDetails: details }));
      } catch (error) {
        console.error("Error fetching protein details:", error);
      }
    };

    fetchProteinDetails();
  }, [workflowState.protein]);

  const handleProteinSelect = (protein: Protein) => {
    setWorkflowState((prev) => ({ ...prev, protein, screen: 1 }));
  };

  const handleSearchModelsChange = (models: string[]) => {
    setWorkflowState((prev) => ({ ...prev, searchModels: models }));
  };

  const handleSearchComplete = (
    results: import("@/lib/api").SearchComparisonResult[],
  ) => {
    setWorkflowState((prev) => ({ ...prev, searchResults: results }));
  };

  const handlePublicationSelect = (publication: Publication) => {
    setWorkflowState((prev) => ({ ...prev, selectedPublication: publication }));
  };

  const handleContinueToExtract = () => {
    setWorkflowState((prev) => ({ ...prev, screen: 2 }));
    // Scroll to top of screen
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const handleExtractModelsChange = (models: string[]) => {
    setWorkflowState((prev) => ({ ...prev, extractModels: models }));
  };

  const handleExtractionComplete = (results: ExtractComparisonResult[]) => {
    setWorkflowState((prev) => ({ ...prev, extractionResults: results }));
  };

  const handleExtractionSelect = (result: ExtractComparisonResult) => {
    setWorkflowState((prev) => ({ ...prev, selectedExtraction: result }));
  };

  const handleContinueToSummarize = () => {
    setWorkflowState((prev) => ({ ...prev, screen: 3 }));
    // Scroll to top of screen
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const handleSummarizeModelsChange = (models: string[]) => {
    setWorkflowState((prev) => ({ ...prev, summarizeModels: models }));
  };

  const handleSummarizationComplete = (
    results: SummarizeComparisonResult[],
  ) => {
    setWorkflowState((prev) => ({ ...prev, summarizationResults: results }));
  };

  const handleBackToSearch = () => {
    setWorkflowState((prev) => ({ ...prev, screen: 1 }));
    // Scroll to top of screen
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const handleBackToExtract = () => {
    setWorkflowState((prev) => ({ ...prev, screen: 2 }));
    // Scroll to top of screen
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const handleStartNew = () => {
    setWorkflowState(clearWorkflowState());
  };

  const handleComplete = () => {
    // Could show a completion screen or export results
    alert(
      "Workflow completed! You can start a new workflow or export the results.",
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Protein Synthesis AI Agent
              </h1>
              <p className="mt-2 text-gray-800">
                Search proteins, extract synthesis protocols from publications,
                and verify accuracy
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Session Cost</div>
              <div className="text-2xl font-bold text-blue-600">
                {sessionCost !== null ? `$${sessionCost.toFixed(4)}` : "—"}
              </div>
              <button
                onClick={loadSessionCost}
                disabled={sessionCostLoading}
                type="button"
                className="mt-2 text-xs text-blue-700 hover:text-blue-900 disabled:text-gray-400"
              >
                {sessionCostLoading
                  ? "Refreshing…"
                  : sessionCost === null
                    ? "Load"
                    : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {workflowState.screen === 1 && (
          <Screen1Search
            protein={workflowState.protein}
            proteinDetails={workflowState.proteinDetails}
            searchModels={workflowState.searchModels}
            selectedPublication={workflowState.selectedPublication}
            searchResults={workflowState.searchResults}
            onProteinSelect={handleProteinSelect}
            onModelsChange={handleSearchModelsChange}
            onPublicationSelect={handlePublicationSelect}
            onSearchComplete={handleSearchComplete}
            onContinue={handleContinueToExtract}
          />
        )}

        {workflowState.screen === 2 && (
          <Screen2Extract
            publication={workflowState.selectedPublication}
            extractModels={workflowState.extractModels}
            extractionResults={workflowState.extractionResults}
            selectedExtraction={workflowState.selectedExtraction}
            onModelsChange={handleExtractModelsChange}
            onExtractionComplete={handleExtractionComplete}
            onExtractionSelect={handleExtractionSelect}
            onContinue={handleContinueToSummarize}
            onBack={handleBackToSearch}
          />
        )}

        {workflowState.screen === 3 && (
          <Screen3Summarize
            selectedExtraction={workflowState.selectedExtraction}
            summarizeModels={workflowState.summarizeModels}
            summarizationResults={workflowState.summarizationResults}
            onModelsChange={handleSummarizeModelsChange}
            onSummarizationComplete={handleSummarizationComplete}
            onComplete={handleComplete}
            onBack={handleBackToExtract}
            onStartNew={handleStartNew}
          />
        )}
      </main>
    </div>
  );
}
