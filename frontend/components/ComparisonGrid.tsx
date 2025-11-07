'use client';

import { ComparisonResult } from '@/lib/api';

interface ComparisonGridProps {
  results: ComparisonResult[];
  onRerun?: (modelId: string) => void;
}

export default function ComparisonGrid({ results, onRerun }: ComparisonGridProps) {
  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      timeout: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles] || styles.failed}`}>
        {status}
      </span>
    );
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result) => (
              <tr key={result.model_id} className="hover:bg-blue-50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{result.model_id}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(result.status)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                  {result.time_s?.toFixed(2)}s
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                  {result.tokens?.toLocaleString()}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                  {formatCost(result.cost || 0)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {onRerun && (
                    <button
                      onClick={() => onRerun(result.model_id)}
                      className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded hover:bg-blue-100"
                    >
                      🔄 Rerun
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

