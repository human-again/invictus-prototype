"use client";

import { useEffect, useState } from "react";
import type { Protein, ProteinDetails, Publication } from "@/lib/api";
import { api } from "@/lib/api";
import ModelSelector from "../ModelSelector";
import PromptEditor from "../PromptEditor";
import { ProteinSearch } from "../ProteinSearch";
import ProgressiveResultsGrid, {
  type RankingInfo,
} from "./ProgressiveResultsGrid";
import PublicationDetailPanel from "./PublicationDetailPanel";
import CollapsibleSection from "../CollapsibleSection";

interface Screen1SearchProps {
  protein: Protein | null;
  proteinDetails: ProteinDetails | null;
  searchModels: string[];
  selectedPublication: Publication | null;
  searchResults: import("@/lib/api").SearchComparisonResult[];
  onProteinSelect: (protein: Protein) => void;
  onModelsChange: (models: string[]) => void;
  onPublicationSelect: (publication: Publication) => void;
  onSearchComplete: (results: import("@/lib/api").SearchComparisonResult[]) => void;
  onContinue: () => void;
}

export default function Screen1Search({
  protein,
  proteinDetails,
  searchModels,
  selectedPublication,
  searchResults,
  onProteinSelect,
  onModelsChange,
  onPublicationSelect,
  onSearchComplete,
  onContinue,
}: Screen1SearchProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [methodologyFocus, setMethodologyFocus] = useState<
    "purification" | "synthesis" | "expression" | "general"
  >("purification");
  const [candidates, setCandidates] = useState<Publication[]>([]);
  const [rankingInfo, setRankingInfo] = useState<RankingInfo[]>([]);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [hasRunSearch, setHasRunSearch] = useState(searchResults.length > 0);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [isSearchRunning, setIsSearchRunning] = useState(false);

  // Load default prompt immediately so it's ready when editor opens
  useEffect(() => {
    let isMounted = true;

    const loadDefaultPrompt = async () => {
      try {
        setLoadingPrompt(true);
        const promptData = await api.getPrompts("search");
        const defaultPrompt =
          promptData.defaults?.search_rerank || promptData.task_default || "";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep prompts in sync with selected models
  useEffect(() => {
    if (searchModels.length === 0) {
      setPrompts({});
      return;
    }

    setPrompts((prev) => {
      const updated: Record<string, string> = {};
      searchModels.forEach((modelId) => {
        updated[modelId] = prev[modelId] ?? currentPrompt;
      });
      return updated;
    });
  }, [searchModels, currentPrompt]);

  // Fetch candidates when protein is selected
  useEffect(() => {
    if (protein) {
      const fetchCandidates = async () => {
        try {
          const pubs = await api.getPublications(
            protein.uniprot_id,
            protein.name,
            methodologyFocus,
          );
          setCandidates(pubs);
        } catch (error) {
          console.error("Error fetching publications:", error);
        }
      };
      fetchCandidates();
    }
  }, [protein, methodologyFocus]);

  const handlePublicationSelect = (
    publication: Publication,
    ranking: RankingInfo[],
  ) => {
    setRankingInfo(ranking);
    setShowDetailPanel(true);
    onPublicationSelect(publication);
  };

  const handlePromptChange = (value: string) => {
    setCurrentPrompt(value);
    // Apply to all models
    const updatedPrompts: Record<string, string> = {};
    searchModels.forEach((modelId) => {
      updatedPrompts[modelId] = value;
    });
    setPrompts(updatedPrompts);
  };

  const triggerSearch = () => {
    if (!protein || searchModels.length === 0 || isSearchRunning) return;

    setShowDetailPanel(false);
    setHasRunSearch(true);
    // Clear previous results when starting a new search
    onSearchComplete([]);
    setSearchTrigger((prev) => prev + 1);
  };

  const handleRunSearch = () => {
    triggerSearch();
  };

  const handleRerunSearch = (_modelId?: string) => {
    triggerSearch();
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Step 1 of 3: Search Publications
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              Search for relevant publications about your protein. Edit the
              search prompt and compare results from different AI models.
            </p>
          </div>
          <div className="text-2xl font-bold text-blue-600">1/3</div>
        </div>
      </div>

      {/* Protein Search */}
      <CollapsibleSection
        title="Search for a Protein"
        icon="🔍"
        id="protein-search"
        defaultExpanded={!protein}
      >
        <ProteinSearch onSelect={onProteinSelect} />

        {protein && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">
              Selected Protein
            </h4>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-semibold">Name:</span> {protein.name}
              </p>
              <p>
                <span className="font-semibold">UniProt ID:</span> {protein.id}
              </p>
              <p>
                <span className="font-semibold">Organism:</span>{" "}
                {protein.organism}
              </p>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Methodology Focus */}
      {protein && (
        <CollapsibleSection
          title="Methodology Focus"
          icon="🎯"
          id="methodology-focus"
          defaultExpanded={true}
        >
          <div className="flex gap-2">
            {(
              ["purification", "synthesis", "expression", "general"] as const
            ).map((focus) => (
              <button
                key={focus}
                onClick={() => setMethodologyFocus(focus)}
                type="button"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  methodologyFocus === focus
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {focus.charAt(0).toUpperCase() + focus.slice(1)}
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Model Selection */}
      {protein && (
        <CollapsibleSection
          title="Select AI Models"
          icon="🤖"
          id="model-selection"
          defaultExpanded={true}
        >
          <ModelSelector
            task="search"
            selectedModels={searchModels}
            onSelectionChange={onModelsChange}
            mode="balanced"
          />
        </CollapsibleSection>
      )}

      {/* Prompt Editor */}
      {protein && searchModels.length > 0 && (
        <CollapsibleSection
          title="Edit Search Prompt"
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
                  task="search"
                  modelId={searchModels[0] || ""}
                  value={currentPrompt}
                  onChange={handlePromptChange}
                />
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Search Results */}
      {protein && searchModels.length > 0 && (
        <CollapsibleSection
          title="Search Results"
          icon="📚"
          id="search-results"
          defaultExpanded={hasRunSearch || searchResults.length > 0}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex-1" />
            <button
              onClick={handleRunSearch}
              disabled={isSearchRunning || searchModels.length === 0}
              type="button"
              className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSearchRunning ? "Searching…" : "Run Search"}
            </button>
          </div>

          {!hasRunSearch && searchResults.length === 0 ? (
            <p className="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-4">
              Select one or more models and click{" "}
              <span className="font-semibold">Run Search</span> to fetch ranked
              publications.
            </p>
          ) : (
            <ProgressiveResultsGrid
              models={searchModels}
              uniprotId={protein.uniprot_id}
              proteinName={protein.name}
              methodologyFocus={methodologyFocus}
              prompts={Object.keys(prompts).length > 0 ? prompts : undefined}
              candidates={candidates}
              runTrigger={searchTrigger}
              initialResults={searchResults}
              onSelectPublication={handlePublicationSelect}
              onRerun={handleRerunSearch}
              onSearchStateChange={setIsSearchRunning}
              onSearchComplete={onSearchComplete}
            />
          )}
        </CollapsibleSection>
      )}

      {/* Publication Detail Panel */}
      {showDetailPanel && selectedPublication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <PublicationDetailPanel
              publication={selectedPublication}
              rankingInfo={rankingInfo}
              proteinDetails={proteinDetails}
              onClose={() => setShowDetailPanel(false)}
              onContinue={() => {
                setShowDetailPanel(false);
                onContinue();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
