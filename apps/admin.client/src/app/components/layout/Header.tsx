import React from 'react';
import { User } from '../../types';
import { APP_NAME } from '../../../../constants';

interface HeaderProps {
  user?: User;
  onLogout?: () => void;
  title?: string;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  title = APP_NAME,
  className = '',
}) => {
  const headerClasses = `
    bg-white border-b border-gray-200 shadow-sm
    ${className}
  `.trim();

  return (
    <header className={headerClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-primary-600">
                {title}
              </h1>
            </div>
          </div>

          {/* Navigation and User Menu */}
          {user && (
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-3">
                {user.avatar ? (
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src={user.avatar}
                    alt={`${user.firstName || user.email} avatar`}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 text-sm font-medium">
                      {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                    </span>
                  </div>
                )}
                
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}
                  </p>
                  {user.firstName && (
                    <p className="text-xs text-gray-500">{user.email}</p>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="
                    inline-flex items-center px-3 py-2 border border-transparent text-sm 
                    leading-4 font-medium rounded-md text-gray-700 bg-white 
                    hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 
                    focus:ring-primary-500 transition-colors duration-200
                  "
                >
                  <svg 
                    className="mr-2 h-4 w-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                    />
                  </svg>
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}; 