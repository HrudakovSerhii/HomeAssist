import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { UnknownRoute, PublicRoute, ProtectedRoute } from './routes';

import { PageLoader } from './components';

import LoginPage from './pages/LoginPage';
import AddAccountPage from './pages/AddAccountPage';

import { APP_ENDPOINTS } from '../configuration';

// Lazy load dashboard for better performance
const DashboardPage = React.lazy(
  () => import('./pages/dashboard/DashboardPage')
);
const SchedulesPage = React.lazy(() => import('./pages/SchedulesPage'));
const ScheduleEditPage = React.lazy(() => import('./pages/ScheduleEditPage'));

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

        <Route
          path={APP_ENDPOINTS.schedules}
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader message="Loading schedules..." />}>
                <SchedulesPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path={APP_ENDPOINTS.editScheduleNew}
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader message="Loading schedule..." />}>
                <ScheduleEditPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/schedules/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader message="Loading schedule..." />}>
                <ScheduleEditPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </div>
  );
};
