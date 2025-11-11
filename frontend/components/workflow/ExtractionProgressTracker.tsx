'use client';

interface ExtractionProgressTrackerProps {
  modelId: string;
  status: 'pending' | 'fetching' | 'extracting' | 'validating' | 'success' | 'failed';
  error?: string;
}

export default function ExtractionProgressTracker({
  modelId,
  status,
  error,
}: ExtractionProgressTrackerProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'fetching':
        return '📥';
      case 'extracting':
        return '🔬';
      case 'validating':
        return '✓';
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Waiting to start...';
      case 'fetching':
        return 'Fetching full text...';
      case 'extracting':
        return 'Extracting methods...';
      case 'validating':
        return 'Validating extraction...';
      case 'success':
        return 'Extraction complete';
      case 'failed':
        return 'Extraction failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      case 'fetching':
      case 'extracting':
      case 'validating':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const isActive = status === 'fetching' || status === 'extracting' || status === 'validating';

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()} border-opacity-50`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{modelId}</h4>
            <p className="text-sm text-gray-700">{getStatusText()}</p>
          </div>
        </div>
        {isActive && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
        )}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

