'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function VerificationDashboard() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getVerificationReport()
      .then(setReport)
      .catch((error) => {
        console.error('Error loading verification report:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-gray-800">
        No verification data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Verification Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-800 font-medium">Total Proteins</div>
          <div className="text-3xl font-bold text-gray-900">
            {report.total_proteins || 0}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-800 font-medium">Tested</div>
          <div className="text-3xl font-bold text-gray-900">
            {report.tested || 0}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-800 font-medium">Mean Similarity</div>
          <div className="text-3xl font-bold text-gray-900">
            {report.mean_similarity
              ? (report.mean_similarity * 100).toFixed(1) + '%'
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Protein Results
        </h3>
        <div className="space-y-2">
          {report.results && report.results.length > 0 ? (
            report.results.map((result: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div>
                  <span className="font-medium text-gray-900">{result.protein_name}</span>
                  <span className="text-gray-700 ml-2">
                    ({result.uniprot_id})
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    result.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {result.status}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-800">No results available</div>
          )}
        </div>
      </div>
    </div>
  );
}

