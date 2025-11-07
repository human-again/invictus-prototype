'use client';

import { useState } from 'react';
import { api, Publication, SearchComparisonResult, ExtractComparisonResult, SummarizeComparisonResult } from '@/lib/api';
import ModelSelector from './ModelSelector';
import CostEstimator from './CostEstimator';
import SearchResultsCompare from './SearchResultsCompare';
import ExtractionCompare from './ExtractionCompare';
import SummarizationCompare from './SummarizationCompare';
import PublicationConfirmationPanel from './PublicationConfirmationPanel';

type ComparisonStep = 'search' | 'extract' | 'summarize';

export default function ModelComparison() {
  const [step, setStep] = useState<ComparisonStep>('search');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [mode, setMode] = useState<'quick' | 'balanced' | 'thorough'>('balanced');
  const [uniprotId, setUniprotId] = useState('');
  const [proteinName, setProteinName] = useState('');
  const [methodologyFocus, setMethodologyFocus] = useState('purification');
  
  // Search state
  const [searchResults, setSearchResults] = useState<SearchComparisonResult[]>([]);
  const [searchCandidates, setSearchCandidates] = useState<Publication[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Confirmation panel states
  const [showExtractConfirmation, setShowExtractConfirmation] = useState(false);
  const [showSummarizeConfirmation, setShowSummarizeConfirmation] = useState(false);
  const [selectedPublicationForExtract, setSelectedPublicationForExtract] = useState<Publication | null>(null);
  const [publicationRankingInfo, setPublicationRankingInfo] = useState<Array<{modelId: string, score: number, explanation: string}>>([]);
  const [selectedExtractionForSummarize, setSelectedExtractionForSummarize] = useState<ExtractComparisonResult | null>(null);
  
  // Extract state
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [extractModels, setExtractModels] = useState<string[]>([]);
  const [extractResults, setExtractResults] = useState<ExtractComparisonResult[]>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractInputExcerpt, setExtractInputExcerpt] = useState('');
  const [extractConsensus, setExtractConsensus] = useState<any>(null);
  const [extractPrompts, setExtractPrompts] = useState<Record<string, string>>({});
  
  // Summarize state
  const [summarizeModels, setSummarizeModels] = useState<string[]>([]);
  const [summarizeResults, setSummarizeResults] = useState<SummarizeComparisonResult[]>([]);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [summarizeConsensus, setSummarizeConsensus] = useState<any>(null);
  const [summarizeOutliers, setSummarizeOutliers] = useState<Record<string, string[]>>({});
  const [summarizeDiff, setSummarizeDiff] = useState<any[]>([]);
  const [summarizePrompts, setSummarizePrompts] = useState<Record<string, string>>({});
  
  const [showCostEstimate, setShowCostEstimate] = useState(false);
  const [costEstimate, setCostEstimate] = useState<any>(null);

  const handleSearch = async () => {
    if (!uniprotId || selectedModels.length === 0) {
      alert('Please enter a UniProt ID and select at least one model');
      return;
    }

    setSearchLoading(true);
    try {
      // Build the query
      const query = `${proteinName || uniprotId} protein ${methodologyFocus}`;
      setSearchQuery(query);
      
      // Get the prompt template to show user
      try {
        const prompts = await api.getPrompts('search');
        const promptTemplate = prompts.defaults?.search_rerank || prompts.task_default || '';
        if (promptTemplate) {
          const formattedPrompt = promptTemplate
            .replace('{query}', query)
            .replace('{protein_name}', proteinName || uniprotId)
            .replace('{uniprot_id}', uniprotId)
            .replace('{methodology_focus}', methodologyFocus)
            .replace('{publications}', '[Publications will be inserted here]');
          setSearchPrompt(formattedPrompt);
        }
      } catch (error) {
        console.error('Error fetching prompt:', error);
      }

      const response = await api.compareSearch({
        uniprot_id: uniprotId,
        protein_name: proteinName,
        methodology_focus: methodologyFocus as any,
        models: selectedModels,
        mode,
      });
      setSearchResults(response.results || []);
      setSearchCandidates(response.candidates || []);
      // Don't change step yet - keep showing search results until user selects a publication
      // setStep('extract'); // Only change when publication is selected
    } catch (error) {
      console.error('Error comparing search:', error);
      alert('Failed to compare search results');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle publication selection - opens confirmation panel
  const handleExtract = (publication: Publication, rankingInfo: Array<{modelId: string, score: number, explanation: string}>) => {
    setSelectedPublicationForExtract(publication);
    setPublicationRankingInfo(rankingInfo);
    setShowExtractConfirmation(true);
  };

  // Handle confirmation - navigates to extract step with model selection
  const handleExtractConfirm = () => {
    if (!selectedPublicationForExtract) return;
    setShowExtractConfirmation(false);
    setSelectedPublication(selectedPublicationForExtract);
    // Default to models from search, but allow user to change
    setExtractModels([...selectedModels]);
    setStep('extract');
  };

  // Actually start extraction after model selection
  const handleStartExtraction = async () => {
    if (extractModels.length === 0) {
      alert('Please select at least one model');
      return;
    }
    if (!selectedPublication) {
      alert('No publication selected');
      return;
    }

    setExtractLoading(true);
    try {
      // Get extract prompts for each model
      try {
        const prompts: Record<string, string> = {};
        const promptData = await api.getPrompts('extract');
        const template = promptData.defaults?.extract_methods || promptData.task_default || '';
        if (template) {
          for (const modelId of extractModels) {
            const formatted = template
              .replace('{protein_name}', selectedPublication.title || '')
              .replace('{title}', selectedPublication.title || '')
              .replace('{authors}', selectedPublication.authors || '')
              .replace('{journal}', selectedPublication.journal || '')
              .replace('{year}', selectedPublication.year || '')
              .replace('{publication_text}', '[Full publication text will be inserted here]');
            prompts[modelId] = formatted;
          }
          setExtractPrompts(prompts);
        }
      } catch (error) {
        console.error('Error fetching extract prompts:', error);
      }

      const response = await api.compareExtract({
        publication: selectedPublication,
        models: extractModels,
      });
      setExtractResults(response.results || []);
      setExtractInputExcerpt(response.input_excerpt || '');
      setExtractConsensus(response.consensus || null);
    } catch (error: any) {
      console.error('Error comparing extraction:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to compare extraction results';
      alert(`Failed to compare extraction results: ${errorMessage}`);
    } finally {
      setExtractLoading(false);
    }
  };

  // Handle extraction selection - opens confirmation panel
  const handleSummarize = (extractionResult: ExtractComparisonResult) => {
    setSelectedExtractionForSummarize(extractionResult);
    setShowSummarizeConfirmation(true);
  };

  // Handle confirmation - navigates to summarize step with model selection
  const handleSummarizeConfirm = () => {
    if (!selectedExtractionForSummarize) return;
    setShowSummarizeConfirmation(false);
    // Default to models from extraction, but allow user to change
    setSummarizeModels([...extractModels]);
    setStep('summarize');
  };

  // Actually start summarization after model selection
  const handleStartSummarization = async () => {
    if (summarizeModels.length === 0) {
      alert('Please select at least one model');
      return;
    }
    if (!selectedExtractionForSummarize) {
      alert('No extraction selected');
      return;
    }

    const extractedText = selectedExtractionForSummarize.extracted_text || '';
    if (!extractedText) {
      alert('No extracted text available');
      return;
    }

    setSummarizeLoading(true);
    try {
      // Get summarize prompts for each model
      try {
        const prompts: Record<string, string> = {};
        const promptData = await api.getPrompts('summarize');
        const template = promptData.defaults?.summarize_protocol_json || promptData.task_default || '';
        if (template) {
          for (const modelId of summarizeModels) {
            const formatted = template.replace('{extracted_methods}', extractedText.substring(0, 500) + '...');
            prompts[modelId] = formatted;
          }
          setSummarizePrompts(prompts);
        }
      } catch (error) {
        console.error('Error fetching summarize prompts:', error);
      }

      // Get citation info from selected publication
      const citationInfo = selectedPublication ? {
        title: selectedPublication.title || undefined,
        authors: selectedPublication.authors || undefined,
        journal: selectedPublication.journal || undefined,
        year: selectedPublication.year || undefined,
      } : {};

      const response = await api.compareSummarize({
        extracted_methods: extractedText,
        models: summarizeModels,
        format: 'both',
        ...citationInfo,
      });
      
      // Validate response structure
      if (!response || !response.results) {
        throw new Error('Invalid response from summarization endpoint');
      }
      
      console.log('Summarization response:', response);
      
      setSummarizeResults(response.results || []);
      setSummarizeConsensus(response.consensus || null);
      setSummarizeOutliers(response.outliers || {});
      setSummarizeDiff(response.diff || []);
    } catch (error: any) {
      console.error('Error comparing summarization:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to compare summarization results';
      alert(`Failed to compare summarization results: ${errorMessage}`);
      // Reset to allow user to try again
      setSummarizeResults([]);
    } finally {
      setSummarizeLoading(false);
    }
  };

  const estimateCost = async (task: ComparisonStep, contentLength: number) => {
    if (selectedModels.length === 0) return;
    
    try {
      const estimate = await api.estimateCost(task, selectedModels, contentLength);
      setCostEstimate(estimate);
      setShowCostEstimate(true);
    } catch (error) {
      console.error('Error estimating cost:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Model Comparison Workflow</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${step === 'search' ? 'text-blue-600' : step === 'extract' || step === 'summarize' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'search' ? 'bg-blue-600 text-white' : step === 'extract' || step === 'summarize' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              1
            </div>
            <span className="font-medium">Search</span>
          </div>
          <div className={`flex-1 h-1 ${step === 'extract' || step === 'summarize' ? 'bg-green-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${step === 'extract' ? 'text-blue-600' : step === 'summarize' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'extract' ? 'bg-blue-600 text-white' : step === 'summarize' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
            <span className="font-medium">Extract</span>
          </div>
          <div className={`flex-1 h-1 ${step === 'summarize' ? 'bg-green-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${step === 'summarize' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'summarize' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className="font-medium">Summarize</span>
          </div>
        </div>
      </div>

      {/* Step 1: Search Setup */}
      {step === 'search' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                <h2 className="text-2xl font-bold text-gray-900">Step 1: Search for Publications</h2>
              </div>
              <p className="text-gray-700 ml-11 mb-4">
                In this step, we'll search for scientific publications about your protein. Each AI model will rank the publications 
                by relevance to help you find the best sources for protein synthesis methods.
              </p>
            </div>
            
            {/* Protein Search */}
            <div className="mb-6 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Enter Protein Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UniProt ID <span className="text-red-600">*</span>
                    <span className="ml-2 text-xs text-gray-500 font-normal">(e.g., P68871 for Hemoglobin)</span>
                  </label>
                  <input
                    type="text"
                    value={uniprotId}
                    onChange={(e) => setUniprotId(e.target.value)}
                    placeholder="P68871"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Protein Name <span className="text-gray-500 text-xs">(optional, helps improve search)</span>
                  </label>
                  <input
                    type="text"
                    value={proteinName}
                    onChange={(e) => setProteinName(e.target.value)}
                    placeholder="Hemoglobin"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What are you looking for?
                  </label>
                  <select
                    value={methodologyFocus}
                    onChange={(e) => setMethodologyFocus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="purification">Protein Purification Methods</option>
                    <option value="synthesis">Protein Synthesis</option>
                    <option value="expression">Protein Expression</option>
                    <option value="general">General Methods</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-600">
                    This helps focus the search on the type of methodology you need.
                  </p>
                </div>
              </div>
            </div>

            {/* Model Selector */}
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Select AI Models to Compare</h3>
              <p className="text-sm text-gray-700 mb-4">
                Choose which AI models should search and rank the publications. More models = better comparison, but higher cost.
              </p>
              <ModelSelector
                task="search"
                selectedModels={selectedModels}
                onSelectionChange={setSelectedModels}
                mode={mode}
                onModeChange={setMode}
              />
            </div>

            {/* What Will Happen */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span>ℹ️</span> What Will Happen Next
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-6">
                <li>We'll search scientific databases for publications about your protein</li>
                <li>Each selected AI model will independently rank the publications by relevance</li>
                <li>You'll see side-by-side comparisons showing which publications each model recommends</li>
                <li>You can then select a publication to extract detailed methods from it</li>
              </ul>
            </div>

            {/* Cost Estimate */}
            {showCostEstimate && costEstimate && (
              <div className="mb-6">
                <CostEstimator
                  task="search"
                  models={selectedModels}
                  contentLength={1000}
                  onProceed={handleSearch}
                  onCancel={() => setShowCostEstimate(false)}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => estimateCost('search', 1000)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                💰 Estimate Cost
              </button>
              <button
                onClick={handleSearch}
                disabled={!uniprotId || selectedModels.length === 0 || searchLoading}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchLoading ? '🔄 Searching...' : '🚀 Start Search Comparison'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Search Results with Query/Prompt Display */}
      {/* Show search results if they exist and we're not in extract step yet */}
      {searchResults.length > 0 && (step === 'search' || (step !== 'extract' && !extractLoading)) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Show Query and Prompt */}
          {searchQuery && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🔍 Search Query Used</h3>
              <div className="bg-white rounded p-3 mb-3">
                <code className="text-sm text-gray-800">{searchQuery}</code>
              </div>
              {searchPrompt && (
                <>
                  <h3 className="font-semibold text-gray-900 mb-2 mt-4">📝 Prompt Sent to AI Models</h3>
                  <div className="bg-white rounded p-3 max-h-60 overflow-y-auto">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">{searchPrompt}</pre>
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">✅ Search Complete!</h3>
            <p className="text-gray-700">
              Each AI model has ranked the publications. Compare the results below and click on a publication to extract its methods.
            </p>
          </div>
          
          <SearchResultsCompare
            results={searchResults}
            candidates={searchCandidates}
            onSelectPublication={handleExtract}
            onRerun={(modelId) => {
              console.log('Rerun model:', modelId);
            }}
          />
          
          {/* Back button to return to search form */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => {
                setSearchResults([]);
                setSearchCandidates([]);
                setSearchQuery('');
                setSearchPrompt('');
                setStep('search');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              ← Back to Search
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Extract - Model Selection and Results */}
      {step === 'extract' && (
        <div className="space-y-6">
          {/* Model Selection UI (shown before extraction or if no results yet) */}
          {extractResults.length === 0 && !extractLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                  <h2 className="text-2xl font-bold text-gray-900">Step 2: Extract Methods from Publication</h2>
                </div>
                <p className="text-gray-700 ml-11 mb-4">
                  Select which AI models you want to use for extraction. Models from your search are pre-selected, but you can change them.
                </p>
              </div>

              {/* Selected Publication Info */}
              {selectedPublication && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Selected Publication</h3>
                  <p className="text-gray-800 font-medium">{selectedPublication.title}</p>
                  {selectedPublication.authors && (
                    <p className="text-sm text-gray-700 mt-1">{selectedPublication.authors}</p>
                  )}
                  {selectedPublication.journal && selectedPublication.year && (
                    <p className="text-sm text-gray-700">{selectedPublication.journal} ({selectedPublication.year})</p>
                  )}
                </div>
              )}

              {/* Model Selector */}
              <div className="mb-6">
                <ModelSelector
                  task="extract"
                  selectedModels={extractModels}
                  onSelectionChange={setExtractModels}
                  mode={mode}
                  onModeChange={setMode}
                />
              </div>

              {/* Start Extraction Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleStartExtraction}
                  disabled={extractModels.length === 0 || extractLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extractLoading ? '🔄 Extracting...' : '🚀 Start Extraction'}
                </button>
              </div>
            </div>
          )}

          {/* Extraction Loading State */}
          {extractLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-700 font-medium">Extracting methods from publication...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
              </div>
            </div>
          )}

          {/* Extraction Results */}
          {extractResults.length > 0 && !extractLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                  <h2 className="text-2xl font-bold text-gray-900">Step 2: Extract Methods from Publication</h2>
                </div>
                <p className="text-gray-700 ml-11 mb-4">
                  Each AI model has extracted the Materials and Methods section from the publication. 
                  We'll compare what each model extracted to ensure accuracy.
                </p>
              </div>

              {/* Show Prompts */}
              {Object.keys(extractPrompts).length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">📝 Prompts Sent to Each Model</h3>
                  <div className="space-y-3">
                    {Object.entries(extractPrompts).map(([modelId, prompt]) => (
                      <div key={modelId} className="bg-white rounded p-3">
                        <div className="font-medium text-sm text-gray-700 mb-2">Model: <span className="text-blue-600">{modelId}</span></div>
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{prompt}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">✅ Extraction Complete!</h3>
                <p className="text-gray-700">
                  Compare what each model extracted. Models that agree on key details are more reliable.
                </p>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Next Step: Summarize</h3>
                <p className="text-gray-700 mb-4">
                  Select an extraction result below to proceed to summarization, or go back to search for a different publication.
                </p>
              </div>

              <ExtractionCompare
                results={extractResults}
                inputExcerpt={extractInputExcerpt}
                consensus={extractConsensus}
                onRerun={(modelId) => {
                  if (selectedPublication) {
                    handleExtract(selectedPublication, publicationRankingInfo);
                  }
                }}
                onSelect={handleSummarize}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Summarize - Model Selection and Results */}
      {/* Show extraction results above summarization when in summarize step */}
      {step === 'summarize' && extractResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">2</div>
              <h2 className="text-2xl font-bold text-gray-900">Step 2: Extract Methods from Publication</h2>
            </div>
            <p className="text-gray-700 ml-11 mb-4">
              The extraction results below are preserved for reference while you review the summarization results.
            </p>
          </div>

          <ExtractionCompare
            results={extractResults}
            inputExcerpt={extractInputExcerpt}
            consensus={extractConsensus}
            onRerun={(modelId) => {
              if (selectedPublication) {
                handleExtract(selectedPublication, publicationRankingInfo);
              }
            }}
            onSelect={handleSummarize}
          />
        </div>
      )}

      {step === 'summarize' && (
        <div className="space-y-6">
          {/* Model Selection UI (shown before summarization or if no results yet) */}
          {summarizeResults.length === 0 && !summarizeLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                  <h2 className="text-2xl font-bold text-gray-900">Step 3: Summarize into Protocol</h2>
                </div>
                <p className="text-gray-700 ml-11 mb-4">
                  Select which AI models you want to use for summarization. Models from your extraction are pre-selected, but you can change them.
                </p>
              </div>

              {/* Selected Extraction Info */}
              {selectedExtractionForSummarize && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Selected Extraction</h3>
                  <p className="text-gray-800 font-medium">Model: {selectedExtractionForSummarize.model_id}</p>
                  {selectedExtractionForSummarize.extracted_text && (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-3">
                      {selectedExtractionForSummarize.extracted_text.substring(0, 200)}...
                    </p>
                  )}
                </div>
              )}

              {/* Model Selector */}
              <div className="mb-6">
                <ModelSelector
                  task="summarize"
                  selectedModels={summarizeModels}
                  onSelectionChange={setSummarizeModels}
                  mode={mode}
                  onModeChange={setMode}
                />
              </div>

              {/* Start Summarization Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleStartSummarization}
                  disabled={summarizeModels.length === 0 || summarizeLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {summarizeLoading ? '🔄 Summarizing...' : '🚀 Start Summarization'}
                </button>
              </div>
            </div>
          )}

          {/* Summarization Loading State */}
          {summarizeLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-900 font-semibold text-lg">Summarizing extracted methods into protocol...</p>
                <p className="text-sm text-gray-700 mt-2 font-medium">This may take a few moments</p>
              </div>
            </div>
          )}

          {/* Summarization Results */}
          {summarizeResults.length > 0 && !summarizeLoading && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                  <h2 className="text-2xl font-bold text-gray-900">Step 3: Summarize into Protocol</h2>
                </div>
                <p className="text-gray-700 ml-11 mb-4">
                  Each AI model has converted the extracted methods into a structured, step-by-step protocol. 
                  Compare the results to find consensus and identify any discrepancies.
                </p>
              </div>

              {/* Show Prompts */}
              {Object.keys(summarizePrompts).length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">📝 Prompts Sent to Each Model</h3>
                  <div className="space-y-3">
                    {Object.entries(summarizePrompts).map(([modelId, prompt]) => (
                      <div key={modelId} className="bg-white rounded p-3">
                        <div className="font-medium text-sm text-gray-700 mb-2">Model: <span className="text-blue-600">{modelId}</span></div>
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{prompt}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">✅ Summarization Complete!</h3>
                <p className="text-gray-700">
                  Compare the structured protocols from each model. Fields where all models agree are most reliable.
                </p>
              </div>

              <SummarizationCompare
                results={summarizeResults}
                consensus={summarizeConsensus}
                outliers={summarizeOutliers}
                diff={summarizeDiff}
                onRerun={(modelId) => {
                  // Find the result for this model and re-run
                  const result = extractResults.find(r => r.model_id === modelId);
                  if (result) {
                    handleSummarize(result);
                  }
                }}
                onExport={(data) => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'comparison-results.json';
                  a.click();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {step !== 'search' && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (step === 'summarize') setStep('extract');
                else if (step === 'extract') setStep('search');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                setStep('search');
                setSearchResults([]);
                setExtractResults([]);
                setSummarizeResults([]);
                setSearchPrompt('');
                setSearchQuery('');
                setExtractPrompts({});
                setSummarizePrompts({});
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              🔄 Start New Comparison
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Panels */}
      <PublicationConfirmationPanel
        isOpen={showExtractConfirmation}
        publication={selectedPublicationForExtract}
        rankingInfo={publicationRankingInfo}
        mode="extract"
        onClose={() => setShowExtractConfirmation(false)}
        onConfirm={handleExtractConfirm}
      />

      <PublicationConfirmationPanel
        isOpen={showSummarizeConfirmation}
        publication={null}
        rankingInfo={[]}
        extractionInfo={selectedExtractionForSummarize ? {
          model_id: selectedExtractionForSummarize.model_id,
          extracted_text: selectedExtractionForSummarize.extracted_text,
          status: selectedExtractionForSummarize.status,
        } : null}
        mode="summarize"
        onClose={() => setShowSummarizeConfirmation(false)}
        onConfirm={handleSummarizeConfirm}
      />
    </div>
  );
}
