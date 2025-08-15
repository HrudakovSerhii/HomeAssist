import React from 'react';

import { AuthProvider } from './contexts/AuthContext';
import { AccountsProvider } from './contexts/AccountsContext';
import { AppRouter } from './router';

export function App() {
  return (
    <AuthProvider>
      <AccountsProvider>
        <AppRouter />
      </AccountsProvider>
    </AuthProvider>
  );
}

export default App;
