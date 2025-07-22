import React from 'react';

interface AuthTabsProps {
  activeTab: 'login' | 'register';
  onTabChange: (tab: 'login' | 'register') => void;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, onTabChange }) => {
  const tabClasses = (isActive: boolean) => `
    flex-1 py-3 px-4 bg-transparent border-none rounded-md font-medium 
    cursor-pointer transition-all duration-200 text-center
    ${isActive 
      ? 'bg-white text-primary-600 shadow-sm border-2 border-primary-100' 
      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    }
  `.trim();

  return (
    <div className="flex mb-6 rounded-lg bg-gray-50 p-1 border border-gray-200">
      <button
        type="button"
        className={tabClasses(activeTab === 'login')}
        onClick={() => onTabChange('login')}
        aria-selected={activeTab === 'login'}
        role="tab"
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" 
            />
          </svg>
          Login
        </div>
      </button>
      
      <button
        type="button"
        className={tabClasses(activeTab === 'register')}
        onClick={() => onTabChange('register')}
        aria-selected={activeTab === 'register'}
        role="tab"
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
            />
          </svg>
          Register
        </div>
      </button>
    </div>
  );
}; 