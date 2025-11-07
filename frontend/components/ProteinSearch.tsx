'use client';

import { useState, useEffect, useRef } from 'react';
import { api, type Protein } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

export function ProteinSearch({
  onSelect,
}: {
  onSelect: (protein: Protein) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  const debouncedQuery = useDebounce(query, 300);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Don't trigger search if we just selected a protein
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    if (debouncedQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    api
      .searchProteins(debouncedQuery)
      .then((proteins) => {
        setResults(proteins);
        setShowDropdown(true);
      })
      .catch((error) => {
        console.error('Error searching proteins:', error);
        setResults([]);
        setShowDropdown(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedQuery]);

  const handleSelect = (protein: Protein) => {
    isSelectingRef.current = true;
    setQuery(protein.name);
    setShowDropdown(false);
    setResults([]);
    onSelect(protein);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) {
              setShowDropdown(true);
            } else {
              setShowDropdown(false);
            }
          }}
          placeholder="Search for a protein (e.g., hemoglobin, insulin)..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          onFocus={() => {
            if (results.length > 0) {
              setShowDropdown(true);
            }
          }}
          onBlur={() => {
            // Small delay to allow click events to fire before closing
            setTimeout(() => {
              if (!isSelectingRef.current) {
                setShowDropdown(false);
              }
            }, 200);
          }}
        />
        {loading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((protein) => (
            <button
              key={protein.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur from firing first
                handleSelect(protein);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 focus:bg-gray-100 transition-colors"
            >
              <div className="font-semibold text-gray-900">{protein.name}</div>
              <div className="text-sm text-gray-700">
                {protein.organism} • {protein.id}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

