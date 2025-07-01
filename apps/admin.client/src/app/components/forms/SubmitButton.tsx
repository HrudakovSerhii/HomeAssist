import React from 'react';

interface SubmitButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'submit' | 'button';
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  onClick,
  type = 'submit',
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantClasses = {
    primary: `
      bg-primary-600 text-white hover:bg-primary-700 
      focus:ring-primary-500 active:bg-primary-800
    `,
    secondary: `
      bg-secondary-600 text-white hover:bg-secondary-700 
      focus:ring-secondary-500 active:bg-secondary-800
    `,
    success: `
      bg-success-600 text-white hover:bg-success-700 
      focus:ring-success-500 active:bg-success-800
    `,
    danger: `
      bg-error-600 text-white hover:bg-error-700 
      focus:ring-error-500 active:bg-error-800
    `,
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const buttonClasses = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${widthClass}
    ${className}
  `.trim();

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={buttonClasses}
      aria-busy={loading}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {loading ? 'Processing...' : children}
    </button>
  );
}; 