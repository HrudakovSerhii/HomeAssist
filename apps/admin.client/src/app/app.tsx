import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PageLoader } from './components';
import LoginPage from './pages/LoginPage';
import { AddAccountPage } from './pages/AddAccountPage';

// Lazy load dashboard for better performance
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));

export function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Protected Routes - Placeholder pages for now */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiresAccounts={true}>
                <Suspense fallback={<PageLoader message="Loading dashboard..." />}>
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
          
          {/* Catch all route - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
