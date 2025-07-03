import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { UnknownRoute, PublicRoute, ProtectedRoute } from './routes';

import { PageLoader } from './components';

import LoginPage from './pages/LoginPage';
import AddAccountPage from './pages/AddAccountPage';

import { APP_ENDPOINTS } from '../configuration';

// Lazy load dashboard for better performance
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));

export const AppRouter: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public Routes */}
        <Route
          path={APP_ENDPOINTS.login}
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={APP_ENDPOINTS.login} replace />}
        />

        {/* Protected Routes */}
        <Route
          path={APP_ENDPOINTS.dashboard}
          element={
            <ProtectedRoute>
              <Suspense
                fallback={<PageLoader message="Loading dashboard..." />}
              >
                <DashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path={APP_ENDPOINTS.addAccount}
          element={
            <ProtectedRoute>
              <AddAccountPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </div>
  );
};
