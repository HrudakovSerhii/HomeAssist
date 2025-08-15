import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EmailAccount, UserAccountsResponse } from '@home-assist/api-types';
import { useAuth } from './AuthContext';
import { authService } from '../services';

interface AccountsContextType {
  accounts: EmailAccount[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AccountsContext = createContext<AccountsContextType>({
  accounts: [],
  loading: false,
  error: null,
  refresh: () => Promise.resolve(),
});

export const AccountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res: UserAccountsResponse = await authService.getAccounts(user.id);
      setAccounts(res.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<AccountsContextType>(() => ({
    accounts,
    loading,
    error,
    refresh: load,
  }), [accounts, loading, error, load]);

  return (
    <AccountsContext.Provider value={value}>
      {children}
    </AccountsContext.Provider>
  );
};

export const useAccounts = (): AccountsContextType => useContext(AccountsContext); 