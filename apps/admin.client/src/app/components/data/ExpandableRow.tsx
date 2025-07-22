import React, { useState } from 'react';

interface ExpandableRowProps {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
  expandedClassName?: string;
}

export const ExpandableRow: React.FC<ExpandableRowProps> = ({
  children,
  expandedContent,
  expanded: controlledExpanded,
  onToggle,
  className = '',
  expandedClassName = '',
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    
    if (controlledExpanded === undefined) {
      setInternalExpanded(newExpanded);
    }
    
    if (onToggle) {
      onToggle(newExpanded);
    }
  };

  const rowClasses = `
    cursor-pointer hover:bg-gray-50 transition-colors duration-200
    ${className}
  `.trim();

  const expandedRowClasses = `
    bg-gray-50 border-t border-gray-200
    ${expandedClassName}
  `.trim();

  return (
    <>
      {/* Main Row */}
      <tr className={rowClasses} onClick={handleToggle}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {/* Expand/Collapse Icon */}
            <button
              className="flex-shrink-0 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
            >
              <svg
                className={`w-5 h-5 transform transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </td>
        {children}
      </tr>

      {/* Expanded Content Row */}
      {isExpanded && (
        <tr className={expandedRowClasses}>
          <td colSpan={100} className="px-6 py-4">
            <div className="animate-fadeIn">
              {expandedContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}; 