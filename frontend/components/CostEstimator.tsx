'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface CostEstimatorProps {
  task: 'search' | 'extract' | 'summarize';
  models: string[];
  contentLength: number;
  onProceed?: () => void;
  onCancel?: () => void;
}

export default function CostEstimator({
  task,
  models,
  contentLength,
  onProceed,
  onCancel,
}: CostEstimatorProps) {
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionCost, setSessionCost] = useState(0);

  useEffect(() => {
    loadEstimate();
    loadSessionCost();
  }, [task, models, contentLength]);

  const loadEstimate = async () => {
    try {
      setLoading(true);
      const data = await api.estimateCost(task, models, contentLength);
      setEstimate(data);
    } catch (error) {
      console.error('Error estimating cost:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionCost = async () => {
    try {
      const data = await api.getSessionCost();
      setSessionCost(data.session_cost || 0);
    } catch (error) {
      console.error('Error loading session cost:', error);
    }
  };

  if (loading) {
    return <div className="p-4">Calculating cost estimate...</div>;
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Cost Estimate</h3>
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Task:</span>
          <span className="font-medium capitalize">{task}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Models:</span>
          <span className="font-medium">{models.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Estimated Tokens:</span>
          <span className="font-medium">{estimate.estimated_tokens?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cost per Model:</span>
          <span className="font-medium">${estimate.estimated_cost_per_model?.toFixed(4)}</span>
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="text-gray-900 font-semibold">Total Estimated Cost:</span>
          <span className="text-blue-600 font-bold text-lg">
            ${estimate.total_estimated_cost?.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Session Total:</span>
          <span>${sessionCost.toFixed(4)}</span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        {onProceed && (
          <button
            onClick={onProceed}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Proceed
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

