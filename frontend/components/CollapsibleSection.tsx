"use client";

import { useState, useEffect, useRef } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: string;
  id?: string;
  scrollIntoView?: boolean;
}

export default function CollapsibleSection({
  title,
  children,
  defaultExpanded = true,
  icon,
  id,
  scrollIntoView = false,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollIntoView && sectionRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [scrollIntoView]);

  return (
    <div
      id={id}
      ref={sectionRef}
      className="bg-white rounded-lg shadow-sm p-6 transition-all duration-200"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h3>
        <span className="text-gray-500 text-xl transition-transform duration-200">
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>
      {isExpanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

