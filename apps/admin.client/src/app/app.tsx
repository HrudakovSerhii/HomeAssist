// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';

import { Route, Routes, Link } from 'react-router-dom';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Client</h1>
            <div className="flex space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                NX + React + TypeScript
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Tailwind CSS
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <NxWelcome title="admin.client" />
          </div>
        </div>

        {/* START: routes */}
        {/* These routes and navigation have been generated for you */}
        {/* Feel free to move and update them to fit your needs */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <nav className="space-y-1" role="navigation">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Navigation</h3>
                <ul className="space-y-2">
                  <li>
                    <Link 
                      to="/" 
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link 
                      to="/page-2" 
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                    >
                      Page 2
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <Routes>
                <Route
                  path="/"
                  element={
                    <div className="text-center">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Welcome to the Admin Dashboard</h2>
                      <p className="text-gray-600 mb-6">
                        This is the generated root route with beautiful Tailwind CSS styling.
                      </p>
                      <Link 
                        to="/page-2" 
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      >
                        Go to Page 2
                      </Link>
                    </div>
                  }
                />
                <Route
                  path="/page-2"
                  element={
                    <div className="text-center">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Page 2</h2>
                      <p className="text-gray-600 mb-6">
                        You've successfully navigated to page 2!
                      </p>
                      <Link 
                        to="/" 
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      >
                        ← Back to Home
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </div>
          </div>
        </div>
        {/* END: routes */}
      </main>
    </div>
  );
}

export default App;
