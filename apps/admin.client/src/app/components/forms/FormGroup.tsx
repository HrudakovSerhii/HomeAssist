import React from 'react';

interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  className = '',
  spacing = 'md',
}) => {
  const spacingClasses = {
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6',
  };

  const groupClasses = `
    ${spacingClasses[spacing]}
    ${className}
  `.trim();

  return (
    <div className={groupClasses}>
      {children}
    </div>
  );
}; 