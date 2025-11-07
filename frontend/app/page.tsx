'use client';

import { useState, useEffect } from 'react';
import { ProteinSearch } from '@/components/ProteinSearch';
import { PublicationList } from '@/components/PublicationList';
import { VerificationDashboard } from '@/components/VerificationDashboard';
import ModelComparison from '@/components/ModelComparison';
import { api, type Protein } from '@/lib/api';
import { Tab } from '@headlessui/react';

export default function Home() {
  const [selectedProtein, setSelectedProtein] = useState<Protein | null>(null);
  const [publications, setPublications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);

  useEffect(() => {
    const loadSessionCost = async () => {
      try {
        const data = await api.getSessionCost();
        setSessionCost(data.session_cost || 0);
      } catch (error) {
        console.error('Error loading session cost:', error);
      }
    };
    loadSessionCost();
    const interval = setInterval(loadSessionCost, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleProteinSelect = async (protein: Protein) => {
    setSelectedProtein(protein);
    setLoading(true);

    try {
      const pubs = await api.getPublications(
        protein.uniprot_id,
        protein.name
      );
      setPublications(pubs);
    } catch (error) {
      console.error('Error fetching publications:', error);
      setPublications([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Protein Synthesis AI Agent
              </h1>
              <p className="mt-2 text-gray-800">
                Search proteins, extract synthesis protocols from publications, and
                verify accuracy
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Session Cost</div>
              <div className="text-2xl font-bold text-blue-600">
                ${sessionCost.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-blue-100 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 ${
                  selected
                    ? 'bg-white text-blue-900 shadow'
                    : 'text-blue-800 hover:bg-white/[0.80] hover:text-blue-900'
                }`
              }
            >
              Search & Extract
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 ${
                  selected
                    ? 'bg-white text-blue-900 shadow'
                    : 'text-blue-800 hover:bg-white/[0.80] hover:text-blue-900'
                }`
              }
            >
              Model Comparison
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 ${
                  selected
                    ? 'bg-white text-blue-900 shadow'
                    : 'text-blue-800 hover:bg-white/[0.80] hover:text-blue-900'
                }`
              }
            >
              Verification
            </Tab>
          </Tab.List>

          <Tab.Panels>
            <Tab.Panel>
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Search for a Protein
                  </h2>
                  <ProteinSearch onSelect={handleProteinSelect} />
                </div>

                {selectedProtein && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Protein Information
                    </h2>
                    <div className="space-y-2 text-gray-900">
                      <p className="text-gray-900">
                        <span className="font-semibold text-gray-900">Name:</span>{' '}
                        <span className="text-gray-800">{selectedProtein.name}</span>
                      </p>
                      <p className="text-gray-900">
                        <span className="font-semibold text-gray-900">UniProt ID:</span>{' '}
                        <span className="text-gray-800">{selectedProtein.id}</span>
                      </p>
                      <p className="text-gray-900">
                        <span className="font-semibold text-gray-900">Organism:</span>{' '}
                        <span className="text-gray-800">{selectedProtein.organism}</span>
                      </p>
                      {selectedProtein.function && (
                        <p className="text-gray-900">
                          <span className="font-semibold text-gray-900">Function:</span>{' '}
                          <span className="text-gray-800">{selectedProtein.function}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  </div>
                )}

                {!loading && publications.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Related Publications
                    </h2>
                    <PublicationList
                      publications={publications}
                      proteinName={selectedProtein?.name || ''}
                    />
                  </div>
                )}

                {!loading &&
                  selectedProtein &&
                  publications.length === 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <p className="text-gray-800">
                        No publications found for this protein.
                      </p>
                    </div>
                  )}
              </div>
            </Tab.Panel>

            <Tab.Panel>
              <ModelComparison />
            </Tab.Panel>

            <Tab.Panel>
              <VerificationDashboard />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </main>
    </div>
  );
}
