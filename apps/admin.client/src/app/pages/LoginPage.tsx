import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AuthLayout,
  AlertMessage,
  LoginForm,
  RegisterForm,
  AuthTabs,
} from '../components';

import { APP_ENDPOINTS } from '../../configuration';

import type { User } from '@home-assist/api-types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSuccess = (
    authenticatedUser: User,
    hasAccounts: boolean
  ) => {
    setErrorMessage('');
    setSuccessMessage('Login successful! Redirecting...');

    // If route requires accounts but user has none, redirect to add-account
    if (authenticatedUser && !hasAccounts) {
      navigate(APP_ENDPOINTS.addAccount);
    } else {
      navigate(APP_ENDPOINTS.dashboard);
    }
  };

  const handleRegisterSuccess = () => {
    setErrorMessage('');
    setSuccessMessage('Account created successfully! Please log in.');
    setActiveTab('login');
  };

  const handleError = (error: string) => {
    setSuccessMessage('');
    setErrorMessage(error);
  };

  const clearMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  return (
    <AuthLayout
      title={activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
      subtitle="Simple email processing with IMAP authentication"
    >
      <div className="space-y-6">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-2xl font-bold text-primary-600 mb-2">
            HomeAI Assist
          </h2>
        </div>

        {/* Tab Navigation */}
        <AuthTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            clearMessages();
          }}
        />

        {/* Success/Error Messages */}
        {successMessage && (
          <AlertMessage
            type="success"
            message={successMessage}
            show={true}
            onClose={() => setSuccessMessage('')}
            autoHide={false}
          />
        )}

        {errorMessage && (
          <AlertMessage
            type="error"
            message={errorMessage}
            show={true}
            onClose={() => setErrorMessage('')}
            autoHide={false}
          />
        )}

        {/* Auth Forms */}
        <div className="transition-all duration-300 ease-in-out">
          {activeTab === 'login' ? (
            <LoginForm onSuccess={handleLoginSuccess} onError={handleError} />
          ) : (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onError={handleError}
            />
          )}
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>Secure IMAP email processing</p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
