/**
 * Workflow state management utilities
 * Handles state persistence across screens
 */

import type {
  ExtractComparisonResult,
  Protein,
  ProteinDetails,
  Publication,
  SearchComparisonResult,
  SummarizeComparisonResult,
} from "@/lib/api";

export interface WorkflowState {
  screen: 1 | 2 | 3;
  protein: Protein | null;
  proteinDetails: ProteinDetails | null;
  searchResults: SearchComparisonResult[];
  selectedPublication: Publication | null;
  extractionResults: ExtractComparisonResult[];
  selectedExtraction: ExtractComparisonResult | null;
  summarizationResults: SummarizeComparisonResult[];
  searchModels: string[];
  extractModels: string[];
  summarizeModels: string[];
}

export const initialWorkflowState: WorkflowState = {
  screen: 1,
  protein: null,
  proteinDetails: null,
  searchResults: [],
  selectedPublication: null,
  extractionResults: [],
  selectedExtraction: null,
  summarizationResults: [],
  searchModels: [],
  extractModels: [],
  summarizeModels: [],
};

export function clearWorkflowState(): WorkflowState {
  return { ...initialWorkflowState };
}
