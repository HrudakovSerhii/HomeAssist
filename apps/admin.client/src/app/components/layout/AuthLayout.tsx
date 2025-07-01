import React from 'react';
import { Card } from '../ui/Card';
import { APP_NAME, COPYRIGHT_TEXT } from '../../../../constants';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  className = '',
}) => {
  const layoutClasses = `
    min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8
    ${className}
  `.trim();

  return (
    <div className={layoutClasses}>
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">
            {APP_NAME}
          </h1>
          {title && (
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-gray-600">
              {subtitle}
            </p>
          )}
        </div>

        {/* Auth Form Container */}
        <Card padding="lg" shadow="lg" className="mt-8">
          {children}
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>{COPYRIGHT_TEXT}</p>
        </div>
      </div>
    </div>
  );
}; 