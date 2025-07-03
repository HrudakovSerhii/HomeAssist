import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  AddEmailAccountDto,
  AddAccountResponse,
  AuthResponse,
  CreateUserDto,
  LoginDto,
  RegisterResponse,
  User,
} from '@home-assist/api-types';
import { authService } from '../services';
import { STORAGE_KEYS } from '../utils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<AuthResponse>;
  register: (userData: CreateUserDto) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  addEmailAccount: (
    accountData: AddEmailAccountDto
  ) => Promise<AddAccountResponse>;
  refreshUser: () => Promise<void>;
}

// Create a default context value to prevent undefined errors
const defaultAuthContext: AuthContextType = {
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => Promise.reject(new Error('AuthProvider not initialized')),
  register: async () =>
    Promise.reject(new Error('AuthProvider not initialized')),
  logout: async () => Promise.reject(new Error('AuthProvider not initialized')),
  checkAuth: async () =>
    Promise.reject(new Error('AuthProvider not initialized')),
  addEmailAccount: async () =>
    Promise.reject(new Error('AuthProvider not initialized')),
  refreshUser: async () =>
    Promise.reject(new Error('AuthProvider not initialized')),
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth().finally();
  }, []);

  const checkAuth = async (): Promise<void> => {
    setLoading(true);

    try {
      // Check if user exists in session storage
      const storedUser = authService.getUserFromSession();
      const isAuthenticated = authService.isAuthenticated();

      if (storedUser && isAuthenticated) {
        setUser(storedUser);
      } else {
        // Clear any invalid session data
        authService.clearSessionData();
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      authService.clearSessionData();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginDto): Promise<AuthResponse> => {
    setLoading(true);

    try {
      const response = await authService.login(credentials);

      if (response.user && response.token) {
        setUser(response.user);
        authService.saveUserToSession(response.user);

        // Store additional session info
        if (response.hasActiveAccounts !== undefined) {
          sessionStorage.setItem(
            STORAGE_KEYS.HAS_ACTIVE_ACCOUNTS,
            String(response.hasActiveAccounts)
          );
        }
      }

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    userData: CreateUserDto
  ): Promise<RegisterResponse> => {
    setLoading(true);

    try {
      const response = await authService.register(userData);

      if (response.user && response.token) {
        setUser(response.user);
        authService.saveUserToSession(response.user);

        // Store additional session info
        if (response.hasActiveAccounts !== undefined) {
          sessionStorage.setItem(
            STORAGE_KEYS.HAS_ACTIVE_ACCOUNTS,
            String(response.hasActiveAccounts)
          );
        }
      }

      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const addEmailAccount = async (
    accountData: AddEmailAccountDto
  ): Promise<AddAccountResponse> => {
    try {
      // Note: For now, we don't update user data since the response doesn't include full user info
      // In a real app, you might want to re-fetch user data or the API might return updated user info

      return await authService.addEmailAccount(accountData);
    } catch (error) {
      console.error('Add account failed:', error);
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!user) return;

    try {
      // In a real app, you might fetch updated user data from the server
      // For now, we'll just check the current session
      const storedUser = authService.getUserFromSession();
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    checkAuth,
    addEmailAccount,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
