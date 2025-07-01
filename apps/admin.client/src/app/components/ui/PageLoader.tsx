import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface PageLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ 
  message = 'Loading...',
  size = 'lg',
  className = ''
}) => {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className}`}>
      <div className="text-center">
        <LoadingSpinner size={size} />
        <p className="mt-4 text-gray-600 animate-pulse">{message}</p>
      </div>
    </div>
  );
}; 