'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PromptEditorProps {
  task: string;
  modelId: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: (name: string, prompt: string) => void;
}

export default function PromptEditor({
  task,
  modelId,
  value,
  onChange,
  onSave,
}: PromptEditorProps) {
  const [presets, setPresets] = useState<any>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [saveName, setSaveName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPresets();
  }, [task]);

  const loadPresets = async () => {
    try {
      const data = await api.getPresets(task);
      setPresets(data);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const applyPreset = (presetName: string) => {
    if (presets && presets[presetName]) {
      // Presets contain params, not full prompts
      // This would need to be integrated with the prompt template system
      setSelectedPreset(presetName);
    }
  };

  const handleSave = async () => {
    if (!saveName || !onSave) return;
    
    try {
      setLoading(true);
      await api.savePrompt(saveName, task, value, `Custom prompt for ${modelId}`);
      onSave(saveName, value);
      setSaveName('');
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preset Selector */}
      {presets && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Presets
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => applyPreset(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a preset...</option>
            {Object.keys(presets).map((name) => (
              <option key={name} value={name}>
                {name} - {presets[name].description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Prompt Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prompt Template
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your prompt template here..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Use {'{variable_name}'} for template variables
        </p>
      </div>

      {/* Save Custom Prompt */}
      {onSave && (
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Prompt name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={!saveName || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

