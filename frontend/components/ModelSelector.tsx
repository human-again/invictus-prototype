'use client';

import { useState, useEffect, useMemo } from 'react';
import { api, ModelInfo } from '@/lib/api';

interface ModelSelectorProps {
  task: 'search' | 'extract' | 'summarize';
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
  mode?: 'quick' | 'balanced' | 'thorough';
  onModeChange?: (mode: 'quick' | 'balanced' | 'thorough') => void;
}

const MODE_PRESETS = {
  quick: 2,
  balanced: 3,
  thorough: 5,
};

export default function ModelSelector({
  task,
  selectedModels,
  onSelectionChange,
  mode = 'balanced',
  onModeChange,
}: ModelSelectorProps) {
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [top5Models, setTop5Models] = useState<ModelInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, [task]);

  useEffect(() => {
    // Apply mode preset
    if (top5Models.length > 0 && onModeChange) {
      const presetCount = MODE_PRESETS[mode];
      const presetModels = top5Models.slice(0, presetCount).map(m => m.id);
      if (JSON.stringify(presetModels.sort()) !== JSON.stringify(selectedModels.sort())) {
        onSelectionChange(presetModels);
      }
    }
  }, [mode, top5Models]);

  const loadModels = async () => {
    try {
      setLoading(true);
      const [modelsResponse, top5] = await Promise.all([
        api.getModels(),
        api.getTop5Models(task),
      ]);
      
      // Handle both array and object response formats
      const models = Array.isArray(modelsResponse) ? modelsResponse : (modelsResponse?.models || []);
      
      console.log('Loaded models:', models.length);
      console.log('Models response type:', Array.isArray(modelsResponse) ? 'array' : typeof modelsResponse);
      
      if (models.length > 0) {
        console.log('Sample model:', models[0]);
        console.log('Sample model keys:', Object.keys(models[0]));
        // Test search for "open"
        const openModels = models.filter(m => {
          const id = String(m.id || '').toLowerCase();
          const name = String(m.name || '').toLowerCase();
          return id.includes('open') || name.includes('open');
        });
        console.log('Models with "open":', openModels.length);
        if (openModels.length > 0) {
          console.log('First open model:', openModels[0]);
        }
      }
      setAllModels(models);
      setTop5Models(top5.models || []);
      
      // Initialize selection with top models
      if (selectedModels.length === 0 && top5.models) {
        const presetCount = MODE_PRESETS[mode];
        onSelectionChange(top5.models.slice(0, presetCount).map((m: ModelInfo) => m.id));
      }
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    if (!allModels || allModels.length === 0) {
      console.log('filteredModels: allModels is empty');
      return [];
    }

    console.log('filteredModels: Processing', allModels.length, 'models, searchQuery:', searchQuery);

    const result = allModels.filter(model => {
      // First check status
      if (model.status !== 'active') {
        return false;
      }
      
      // Then check search query if provided
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        
        // Get values safely
        const name = String(model.name || '').toLowerCase();
        const id = String(model.id || '').toLowerCase();
        const provider = String(model.provider || '').toLowerCase();
        
        const nameMatch = name.includes(query);
        const idMatch = id.includes(query);
        const providerMatch = provider.includes(query);
        
        const matchesSearch = nameMatch || idMatch || providerMatch;
        
        if (matchesSearch) {
          console.log('Match found:', { id, name, provider, query });
        }
        
        if (!matchesSearch) return false;
        
        // When searching, show all active models that match the search (skip capability check)
        return true;
      }
      
      // When not searching, filter by capability
      const hasCapability = 
        (model.capabilities && model.capabilities.length > 0) ? (
          model.capabilities.includes(task) || 
          model.capabilities.includes('text') ||
          model.capabilities.includes('chat') ||
          model.capabilities.includes('search')
        ) : true; // If no capabilities specified, show it anyway
      
      return hasCapability;
    });

    console.log('filteredModels: Result count', result.length);
    return result;
  }, [allModels, searchQuery, task]);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      onSelectionChange(selectedModels.filter(id => id !== modelId));
    } else {
      if (selectedModels.length < 5) {
        onSelectionChange([...selectedModels, modelId]);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      deprecated: 'bg-yellow-100 text-yellow-800',
      unavailable: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status as keyof typeof colors] || colors.active}`}>
        {status}
      </span>
    );
  };

  const getCostBadge = (hint: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[hint as keyof typeof colors] || colors.medium}`}>
        {hint} cost
      </span>
    );
  };

  if (loading) {
    return <div className="p-4">Loading models...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {onModeChange && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Comparison Mode
          </label>
          <div className="flex gap-2">
            {(['quick', 'balanced', 'thorough'] as const).map(m => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  mode === m
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border-2 border-gray-300'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)} ({MODE_PRESETS[m]} models)
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-700 mt-2">
            {mode === 'quick' && 'Fast comparison with 2 models'}
            {mode === 'balanced' && 'Good balance of speed and accuracy with 3 models'}
            {mode === 'thorough' && 'Comprehensive comparison with 5 models'}
          </p>
        </div>
      )}

      {/* Search */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          🔍 Search Models
        </label>
        <input
          type="text"
          placeholder="Type to search by name, ID, or provider..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
        />
        {searchQuery && (
          <p className="text-xs text-gray-600 mt-1">
            Showing {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </p>
        )}
      </div>

      {/* Top 5 Models */}
      {top5Models.length > 0 && !searchQuery && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">⭐ Recommended for {task}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {top5Models.map((model) => (
              <div
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedModels.includes(model.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{model.name}</h4>
                    <p className="text-xs text-gray-700 font-medium">{model.provider}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs mb-2">
                  {getStatusBadge(model.status)}
                  {getCostBadge(model.cost_hint)}
                </div>
                <div className="mt-2 text-xs text-gray-800 font-medium">
                  📏 Context: {model.context_window.toLocaleString()} tokens
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Models */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          {searchQuery ? '🔍 Search Results' : '📋 All Models'} ({filteredModels.length})
        </h3>
        {filteredModels.length === 0 && searchQuery && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              No models found matching "{searchQuery}". Try a different search term.
            </p>
            <p className="text-xs text-gray-600">
              Debug: Total models loaded: {allModels.length} | Active models: {allModels.filter(m => m.status === 'active').length}
            </p>
          </div>
        )}
        {filteredModels.length === 0 && !searchQuery && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              No models available. Make sure models are loaded and have the required capabilities for {task}.
            </p>
          </div>
        )}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className={`p-3 border-2 rounded-lg flex items-center justify-between ${
                selectedModels.includes(model.id)
                  ? 'bg-blue-50 border-blue-400'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-gray-900">{model.name}</h4>
                  {getStatusBadge(model.status)}
                  {getCostBadge(model.cost_hint)}
                </div>
                <p className="text-xs text-gray-700 font-medium">
                  {model.provider} • {model.context_window.toLocaleString()} tokens
                </p>
              </div>
              <input
                type="checkbox"
                checked={selectedModels.includes(model.id)}
                onChange={() => toggleModel(model.id)}
                disabled={!selectedModels.includes(model.id) && selectedModels.length >= 5}
                className="ml-2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Selection Summary */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-semibold text-gray-900 mb-2">
          ✅ Selected: {selectedModels.length} / 5 models
        </p>
        {selectedModels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedModels.map((id) => {
              const model = allModels.find(m => m.id === id);
              return model ? (
                <span
                  key={id}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-semibold"
                >
                  {model.name}
                </span>
              ) : null;
            })}
          </div>
        )}
        {selectedModels.length === 0 && (
          <p className="text-xs text-gray-700 mt-1">
            Select models above to compare their results
          </p>
        )}
      </div>
    </div>
  );
}

