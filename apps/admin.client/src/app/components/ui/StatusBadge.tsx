import React from 'react';

interface StatusBadgeProps {
  status: 'high' | 'medium' | 'low' | 'positive' | 'negative' | 'neutral' | 'connected' | 'disconnected' | 'error';
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  size = 'md',
  className = '',
}) => {
  const baseClasses = `
    inline-flex items-center font-medium rounded-full
    transition-all duration-200
  `;

  const statusClasses = {
    // Priority statuses
    high: 'bg-error-100 text-error-800 border border-error-200',
    medium: 'bg-warning-100 text-warning-800 border border-warning-200',
    low: 'bg-success-100 text-success-800 border border-success-200',
    
    // Sentiment statuses
    positive: 'bg-success-100 text-success-800 border border-success-200',
    negative: 'bg-error-100 text-error-800 border border-error-200',
    neutral: 'bg-gray-100 text-gray-800 border border-gray-200',
    
    // Connection statuses
    connected: 'bg-success-100 text-success-800 border border-success-200',
    disconnected: 'bg-warning-100 text-warning-800 border border-warning-200',
    error: 'bg-error-100 text-error-800 border border-error-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const badgeClasses = `
    ${baseClasses}
    ${statusClasses[status]}
    ${sizeClasses[size]}
    ${className}
  `.trim();

  // Status indicators
  const getStatusIcon = () => {
    switch (status) {
      case 'high':
        return (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'connected':
        return (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
      case 'disconnected':
        return (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <span className={badgeClasses}>
      {getStatusIcon()}
      {children}
    </span>
  );
}; 