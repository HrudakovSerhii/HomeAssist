import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  maxWidth = '2xl',
  padding = 'md',
  centered = true,
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    sm: 'px-4 py-4',
    md: 'px-6 py-6',
    lg: 'px-8 py-8',
    xl: 'px-12 py-12',
  };

  const containerClasses = `
    w-full
    ${maxWidthClasses[maxWidth]}
    ${paddingClasses[padding]}
    ${centered ? 'mx-auto' : ''}
    ${className}
  `.trim();

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
}; 