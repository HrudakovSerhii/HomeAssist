import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, PageLoader } from './components';
import LoginPage from './pages/LoginPage';

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
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Add Email Account</h1>
                    <p className="text-gray-600">Coming soon in Task 5...</p>
                    <div className="mt-6 text-sm text-gray-500">
                      <p>🚧 Under construction - IMAP account setup will be implemented next</p>
                    </div>
                  </div>
                </div>
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
