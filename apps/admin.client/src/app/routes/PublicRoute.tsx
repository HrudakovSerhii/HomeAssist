import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { PageLoader } from '../components';
import { APP_ENDPOINTS } from '../../configuration';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  redirectTo = APP_ENDPOINTS.dashboard,
}) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return <PageLoader message="Loading..." size="lg" />;
  }

  // If user is authenticated, redirect them away from public pages
  if (user && location.pathname === APP_ENDPOINTS.login) {
    return <Navigate to={redirectTo} replace />;
  }

  // User is not authenticated, render the public content (login page)
  return <>{children}</>;
};

export default PublicRoute;
