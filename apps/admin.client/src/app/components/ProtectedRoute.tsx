import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requiresAccounts?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login',
  requiresAccounts = false 
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user is authenticated, redirect to login
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // If route requires accounts but user has none, redirect to add-account
  if (requiresAccounts && (!user.accounts || user.accounts.length === 0)) {
    return <Navigate to="/add-account" replace />;
  }

  // User is authenticated and meets requirements, render children
  return <>{children}</>;
};

export default ProtectedRoute; 