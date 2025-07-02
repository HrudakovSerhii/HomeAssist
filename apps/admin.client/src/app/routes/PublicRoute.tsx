import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { PageLoader } from '../components';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  redirectTo = '/dashboard'
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return (
      <PageLoader message="Loading..." size="lg" />
    );
  }

  // If user is authenticated, redirect them away from public pages
  if (user) {
    // Determine redirect based on user's account status
    if (user.accounts && user.accounts.length > 0) {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/add-account" replace />;
    }
  }

  // User is not authenticated, render the public content (login page)
  return <>{children}</>;
};

export default PublicRoute; 