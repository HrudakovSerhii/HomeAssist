import React, { useEffect, useState } from 'react';

interface AlertMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  show: boolean;
  onClose?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  message,
  show,
  onClose,
  autoHide = false,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  useEffect(() => {
    if (autoHide && isVisible && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoHide, isVisible, duration]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  const typeConfig = {
    error: {
      bgColor: 'bg-error-50',
      borderColor: 'border-error-200',
      textColor: 'text-error-800',
      iconColor: 'text-error-400',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    success: {
      bgColor: 'bg-success-50',
      borderColor: 'border-success-200',
      textColor: 'text-success-800',
      iconColor: 'text-success-400',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    warning: {
      bgColor: 'bg-warning-50',
      borderColor: 'border-warning-200',
      textColor: 'text-warning-800',
      iconColor: 'text-warning-400',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-400',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const config = typeConfig[type];

  const alertClasses = `
    border-l-4 p-4 rounded-md transition-all duration-300
    ${config.bgColor} ${config.borderColor}
  `;

  return (
    <div className={alertClasses} role="alert">
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          {config.icon}
        </div>
        
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${config.textColor}`}>
            {message}
          </p>
        </div>
        
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={handleClose}
              className={`
                inline-flex rounded-md p-1.5 transition-colors duration-200
                ${config.iconColor} hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500
              `}
              aria-label="Close alert"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 