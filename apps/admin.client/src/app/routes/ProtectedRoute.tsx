import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { PageLoader } from '../components';

import { APP_ENDPOINTS } from '../../configuration';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requiresAccounts?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = APP_ENDPOINTS.login,
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return <PageLoader message="Loading..." size="lg" />;
  }

  // If no user is authenticated, redirect to login page
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // User is authenticated and meets requirements, render children
  return <>{children}</>;
};

export default ProtectedRoute;
