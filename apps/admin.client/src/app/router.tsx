import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { UnknownRoute, PublicRoute, ProtectedRoute } from './routes';

import { PageLoader } from './components';

import LoginPage from './pages/LoginPage';
import AddAccountPage from './pages/AddAccountPage';

// Lazy load dashboard for better performance
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));

export const AppRouter: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiresAccounts={true}>
              <Suspense
                fallback={<PageLoader message="Loading dashboard..." />}
              >
                <DashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-account"
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
