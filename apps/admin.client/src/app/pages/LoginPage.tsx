import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { AuthLayout, AlertMessage } from '../components';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { AuthTabs } from '../components/auth/AuthTabs';
import { User } from '../types';

const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Handle successful authentication navigation
  useEffect(() => {
    if (user && !loading) {
      // Navigate based on user's account status
      if (user.accounts && user.accounts.length > 0) {
        navigate('/dashboard');
      } else {
        navigate('/add-account');
      }
    }
  }, [user, loading, navigate]);

  const handleLoginSuccess = (authenticatedUser: User, hasAccounts: boolean) => {
    setErrorMessage('');
    setSuccessMessage('Login successful! Redirecting...');
    
    // Navigation is handled by the useEffect above
    setTimeout(() => {
      if (hasAccounts) {
        navigate('/dashboard');
      } else {
        navigate('/add-account');
      }
    }, 1000);
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

  // If user is already logged in, show loading or redirect
  if (user) {
    return (
      <AuthLayout title="Redirecting..." subtitle="Please wait...">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </AuthLayout>
    );
  }

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
            <LoginForm 
              onSuccess={handleLoginSuccess} 
              onError={handleError}
            />
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