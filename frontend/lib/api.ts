/**
 * API client for backend communication
 */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Protein {
  id: string;
  uniprot_id: string;
  name: string;
  organism: string;
  function: string;
}

export interface Publication {
  title: string;
  abstract: string;
  authors: string;
  year: string;
  journal: string;
  url?: string;
  pmid?: string;
  doi?: string;
  pdf_url?: string;
  citation_count?: number;
  [key: string]: any; // Allow additional metadata fields
}

export interface Protocol {
  steps: string[] | Array<{
    step_number: number;
    description: string;
    conditions?: Record<string, string>;
    materials_used?: string[];
  }>;
  materials: string[] | Array<{
    name: string;
    concentration?: string;
    volume?: string;
    supplier?: string;
  }>;
  equipment?: string[];
  conditions: string[] | Array<{
    type: string;
    value: string;
    context?: string;
  }>;
  references?: string[];
}

export interface ProtocolResponse {
  structured?: Protocol;
  readable?: string;
}

export interface Entities {
  chemicals: string[];
  equipment: string[];
  conditions: string[];
}

export const api = {
  // Search for proteins
  searchProteins: async (query: string): Promise<Protein[]> => {
    const response = await apiClient.get('/protein/search', {
      params: { query },
    });
    return response.data.results || [];
  },

  // Get publications for a UniProt ID
  getPublications: async (
    uniprotId: string,
    proteinName: string = '',
    methodologyFocus: 'purification' | 'synthesis' | 'expression' | 'general' = 'purification'
  ): Promise<Publication[]> => {
    const params: Record<string, string> = {};
    if (proteinName) {
      params.protein_name = proteinName;
    }
    if (methodologyFocus) {
      params.methodology_focus = methodologyFocus;
    }
    const response = await apiClient.get(`/publications/${uniprotId}`, {
      params,
    });
    return response.data.results || [];
  },

  // Extract methods from publication text
  extractMethods: async (
    publicationText: string,
    proteinName: string = '',
    citationInfo?: {
      title?: string;
      authors?: string;
      journal?: string;
      year?: string;
    }
  ): Promise<{
    extracted_methods: string;
    token_count: number;
    entities: Entities;
  }> => {
    const response = await apiClient.post('/extract_methods', {
      publication_text: publicationText,
      protein_name: proteinName,
      title: citationInfo?.title || '',
      authors: citationInfo?.authors || '',
      journal: citationInfo?.journal || '',
      year: citationInfo?.year || '',
    });
    return response.data;
  },

  // Extract entities from text
  extractEntities: async (text: string): Promise<Entities> => {
    const response = await apiClient.post('/extract_entities', { text });
    return response.data;
  },

  // Summarize protocol
  summarizeProtocol: async (
    extractedMethods: string,
    citationInfo?: {
      title?: string;
      authors?: string;
      journal?: string;
      year?: string;
    },
    format: 'structured' | 'readable' | 'both' = 'both'
  ): Promise<ProtocolResponse> => {
    const response = await apiClient.post('/summarize_protocol', {
      extracted_methods: extractedMethods,
      title: citationInfo?.title || '',
      authors: citationInfo?.authors || '',
      journal: citationInfo?.journal || '',
      year: citationInfo?.year || '',
      format: format,
    });
    return response.data;
  },

  // Verify protocol
  verifyProtocol: async (
    aiProtocol: string,
    proteinName: string = '',
    uniprotId: string = ''
  ) => {
    const response = await apiClient.post('/verify_protocol', {
      ai_protocol: aiProtocol,
      protein_name: proteinName,
      uniprot_id: uniprotId,
    });
    return response.data;
  },

  // Get verification report
  getVerificationReport: async () => {
    const response = await apiClient.get('/verification/report');
    return response.data;
  },

  // ============================================================================
  // Model Comparison APIs
  // ============================================================================

  // Model Management
  getModels: async (): Promise<ModelInfo[]> => {
    const response = await apiClient.get('/models');
    return response.data.models || [];
  },

  getTop5Models: async (task: 'search' | 'extract' | 'summarize') => {
    const response = await apiClient.get('/models/top5', {
      params: { task },
    });
    return response.data;
  },

  getModelAlternatives: async (modelId: string) => {
    const response = await apiClient.get('/models/alternatives', {
      params: { model_id: modelId },
    });
    return response.data;
  },

  getModelStats: async (task?: string) => {
    const params = task ? { task } : {};
    const response = await apiClient.get('/models/stats', { params });
    return response.data;
  },

  rateModel: async (modelId: string, task: string, rating: number) => {
    const response = await apiClient.post('/models/rate', {
      model_id: modelId,
      task,
      rating,
    });
    return response.data;
  },

  // Prompt Management
  getPrompts: async (task?: string) => {
    const params = task ? { task } : {};
    const response = await apiClient.get('/prompts', { params });
    return response.data;
  },

  getPresets: async (task: string) => {
    const response = await apiClient.get('/prompts/presets', {
      params: { task },
    });
    return response.data;
  },

  savePrompt: async (name: string, task: string, prompt: string, description?: string) => {
    const response = await apiClient.post('/prompts', {
      name,
      task,
      prompt,
      description,
    });
    return response.data;
  },

  deletePrompt: async (name: string) => {
    const response = await apiClient.delete(`/prompts/${name}`);
    return response.data;
  },

  // Comparison Endpoints
  compareSearch: async (params: {
    uniprot_id: string;
    protein_name?: string;
    methodology_focus?: string;
    models: string[];
    prompts?: Record<string, string>;
    mode?: 'quick' | 'balanced' | 'thorough';
    async_job?: boolean;
  }) => {
    const response = await apiClient.post('/compare/search', params);
    return response.data;
  },

  compareExtract: async (params: {
    publication: Publication;
    models: string[];
    prompts?: Record<string, string>;
    async_job?: boolean;
  }) => {
    const response = await apiClient.post('/compare/extract', params);
    return response.data;
  },

  compareSummarize: async (params: {
    extracted_methods: string;
    models: string[];
    prompts?: Record<string, string>;
    format?: 'structured' | 'readable' | 'both';
    async_job?: boolean;
    title?: string;
    authors?: string;
    journal?: string;
    year?: string;
  }) => {
    const response = await apiClient.post('/compare/summarize', params);
    return response.data;
  },

  // Job Management
  getCompareStatus: async (jobId: string) => {
    const response = await apiClient.get(`/compare/status/${jobId}`);
    return response.data;
  },

  cancelCompare: async (jobId: string) => {
    const response = await apiClient.delete(`/compare/cancel/${jobId}`);
    return response.data;
  },

  // Cost Management
  estimateCost: async (task: string, models: string[], contentLength: number) => {
    const response = await apiClient.post('/compare/estimate', {
      task,
      models,
      content_length: contentLength,
    });
    return response.data;
  },

  getSessionCost: async () => {
    const response = await apiClient.get('/cost/session');
    return response.data;
  },
};

// Model Comparison Types
export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  context_window: number;
  capabilities: string[];
  cost_hint: string;
  status: 'active' | 'deprecated' | 'unavailable';
  max_tokens?: number;
  timeout: number;
}

export interface ComparisonSummary {
  model_id: string;
  status: 'success' | 'failed' | 'timeout';
  time_s?: number;
  tokens?: number;
  cost?: number;
  [key: string]: any;
}

export interface ComparisonResult extends ComparisonSummary {
  prompt_used?: string;
}

export interface SearchComparisonResult extends ComparisonSummary {
  error?: string;
  results: any[];
  relevancy_score?: number;
  explanation?: string;
}

export interface ExtractComparisonResult extends ComparisonSummary {
  error?: string;
  extracted_text: string;
  entities: Entities;
  flags?: any[];
  confidence?: number;
}

export interface SummarizeComparisonResult extends ComparisonSummary {
  error?: string;
  structured?: Protocol;
  readable?: string;
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

