'use client';

import { useState } from 'react';
import { type Protocol, type ProtocolResponse } from '@/lib/api';

export function ProtocolViewer({ 
  protocol, 
  protocolResponse 
}: { 
  protocol?: Protocol;
  protocolResponse?: ProtocolResponse;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'readable' | 'structured'>('readable');

  // Use protocolResponse if available, otherwise fall back to protocol
  const readable = protocolResponse?.readable;
  const structured = protocolResponse?.structured || protocol;

  const hasReadable = !!readable;
  const hasStructured = !!structured && (
    (Array.isArray(structured.steps) && structured.steps.length > 0) ||
    (Array.isArray(structured.materials) && structured.materials.length > 0)
  );

  // Default to readable if available, otherwise structured
  const defaultMode = hasReadable ? 'readable' : 'structured';
  const currentMode = hasReadable && hasStructured ? viewMode : defaultMode;

  const renderReadableFormat = () => {
    if (!readable) return null;

    // Simple markdown-like rendering
    const lines = readable.split('\n');
    const elements: React.ReactElement[] = [];
    let currentList: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith('### ')) {
        if (inList) {
          elements.push(renderList(currentList, listType));
          currentList = [];
          inList = false;
        }
        elements.push(
          <h3 key={idx} className="text-xl font-bold text-gray-900 mt-6 mb-3">
            {trimmed.substring(4)}
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        if (inList) {
          elements.push(renderList(currentList, listType));
          currentList = [];
          inList = false;
        }
        elements.push(
          <h4 key={idx} className="text-lg font-semibold text-gray-900 mt-4 mb-2">
            {trimmed.substring(5)}
          </h4>
        );
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        // Bold text
        if (inList) {
          currentList.push(trimmed.replace(/\*\*/g, ''));
        } else {
          elements.push(
            <p key={idx} className="font-semibold text-gray-900 mt-2 mb-1">
              {trimmed.replace(/\*\*/g, '')}
            </p>
          );
        }
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // List item
        if (!inList) {
          inList = true;
          listType = 'ul';
        }
        currentList.push(trimmed.substring(2));
      } else if (trimmed.match(/^\d+\.\s/)) {
        // Numbered list
        if (!inList || listType !== 'ol') {
          if (inList) {
            elements.push(renderList(currentList, listType));
          }
          inList = true;
          listType = 'ol';
          currentList = [];
        }
        currentList.push(trimmed.replace(/^\d+\.\s/, ''));
      } else if (trimmed === '---' || trimmed.startsWith('---')) {
        // Horizontal rule
        if (inList) {
          elements.push(renderList(currentList, listType));
          currentList = [];
          inList = false;
        }
        elements.push(<hr key={idx} className="my-4 border-gray-300" />);
      } else if (trimmed) {
        // Regular paragraph
        if (inList) {
          elements.push(renderList(currentList, listType));
          currentList = [];
          inList = false;
        }
        elements.push(
          <p key={idx} className="text-gray-900 mb-2 leading-relaxed">
            {trimmed}
          </p>
        );
      } else if (!trimmed && inList) {
        // Empty line ends list
        if (currentList.length > 0) {
          elements.push(renderList(currentList, listType));
          currentList = [];
          inList = false;
        }
      }
    });

    // Render any remaining list
    if (inList && currentList.length > 0) {
      elements.push(renderList(currentList, listType));
    }

    return <div className="prose max-w-none">{elements}</div>;
  };

  const renderList = (items: string[], type: 'ul' | 'ol') => {
    const ListComponent = type === 'ul' ? 'ul' : 'ol';
    const className = type === 'ul' 
      ? 'list-disc list-inside space-y-1 ml-4 mb-3'
      : 'list-decimal list-inside space-y-1 ml-4 mb-3';
    
    return (
      <ListComponent key={`list-${items.length}`} className={className}>
        {items.map((item, idx) => (
          <li key={idx} className="text-gray-900">
            {item}
          </li>
        ))}
      </ListComponent>
    );
  };

  const renderStructuredFormat = () => {
    if (!structured) return null;

    return (
      <div className="space-y-4">
        {Array.isArray(structured.steps) && structured.steps.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Steps:</h4>
            <ol className="list-decimal list-inside space-y-2">
              {structured.steps.map((step, idx) => {
                if (typeof step === 'string') {
                  return (
                    <li key={idx} className="text-gray-900">
                      {step}
                    </li>
                  );
                } else {
                  return (
                    <li key={idx} className="text-gray-900 mb-3">
                      <div className="ml-4">
                        <p className="font-medium">Step {step.step_number || idx + 1}: {step.description}</p>
                        {step.conditions && Object.keys(step.conditions).length > 0 && (
                          <p className="text-sm text-gray-700 mt-1">
                            Conditions: {Object.entries(step.conditions).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </p>
                        )}
                        {step.materials_used && step.materials_used.length > 0 && (
                          <p className="text-sm text-gray-700 mt-1">
                            Materials: {step.materials_used.join(', ')}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                }
              })}
            </ol>
          </div>
        )}

        {Array.isArray(structured.materials) && structured.materials.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Materials:</h4>
            <ul className="list-disc list-inside space-y-1">
              {structured.materials.map((material, idx) => {
                if (typeof material === 'string') {
                  return (
                    <li key={idx} className="text-gray-900">
                      {material}
                    </li>
                  );
                } else {
                  return (
                    <li key={idx} className="text-gray-900">
                      <strong>{material.name}</strong>
                      {material.concentration && ` - ${material.concentration}`}
                      {material.volume && ` - ${material.volume}`}
                      {material.supplier && ` (${material.supplier})`}
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        )}

        {Array.isArray(structured.equipment) && structured.equipment.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Equipment:</h4>
            <ul className="list-disc list-inside space-y-1">
              {structured.equipment.map((equipment, idx) => (
                <li key={idx} className="text-gray-900">
                  {equipment}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(structured.conditions) && structured.conditions.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Conditions:</h4>
            <ul className="list-disc list-inside space-y-1">
              {structured.conditions.map((condition, idx) => {
                if (typeof condition === 'string') {
                  return (
                    <li key={idx} className="text-gray-900">
                      {condition}
                    </li>
                  );
                } else {
                  return (
                    <li key={idx} className="text-gray-900">
                      <strong>{condition.type}</strong>: {condition.value}
                      {condition.context && ` (${condition.context})`}
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        )}

        {Array.isArray(structured.references) && structured.references.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">References:</h4>
            <ul className="list-disc list-inside space-y-1">
              {structured.references.map((ref, idx) => (
                <li key={idx} className="text-gray-900 text-sm">
                  {ref}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  if (!hasReadable && !hasStructured) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-left font-semibold text-gray-900 flex items-center gap-2"
        >
          <span>Extracted Protocol</span>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </button>
        
        {hasReadable && hasStructured && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('readable')}
              className={`px-3 py-1 text-sm rounded ${
                currentMode === 'readable'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Readable
            </button>
            <button
              onClick={() => setViewMode('structured')}
              className={`px-3 py-1 text-sm rounded ${
                currentMode === 'structured'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Structured
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4">
          {currentMode === 'readable' && hasReadable ? (
            renderReadableFormat()
          ) : (
            renderStructuredFormat()
          )}
        </div>
      )}
    </div>
  );
}

