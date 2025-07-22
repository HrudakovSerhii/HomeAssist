import React from 'react';

interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
  noMargin?: boolean;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  className = '',
  spacing = 'md',
  noMargin = false,
}) => {
  const spacingClasses = {
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6',
  };

  const marginClasses = {
    sm: 'mb-3',
    md: 'mb-4', 
    lg: 'mb-6',
  };

  const groupClasses = `
    ${spacingClasses[spacing]}
    ${!noMargin ? marginClasses[spacing] : ''}
    ${className}
  `.trim();

  return (
    <div className={groupClasses}>
      {children}
    </div>
  );
}; 