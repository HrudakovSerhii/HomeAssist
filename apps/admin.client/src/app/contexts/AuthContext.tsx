import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  LoginCredentials, 
  LoginResponse, 
  RegisterData, 
  RegisterResponse,
  AccountData,
  AddAccountResponse 
} from '../types';
import { authService } from '../services/authService';
import { STORAGE_KEYS } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (userData: RegisterData) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  addEmailAccount: (accountData: AccountData) => Promise<AddAccountResponse>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
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

  const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
    setLoading(true);
    try {
      const response = await authService.login(credentials);
      
      if (response.success && response.user) {
        setUser(response.user);
        authService.saveUserToSession(response.user);
        
        // Store additional session info
        if (response.hasActiveAccounts !== undefined) {
          sessionStorage.setItem(STORAGE_KEYS.HAS_ACTIVE_ACCOUNTS, String(response.hasActiveAccounts));
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

  const register = async (userData: RegisterData): Promise<RegisterResponse> => {
    setLoading(true);
    try {
      const response = await authService.register(userData);
      
      if (response.success && response.user) {
        setUser(response.user);
        authService.saveUserToSession(response.user);
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

  const addEmailAccount = async (accountData: AccountData): Promise<AddAccountResponse> => {
    try {
      const response = await authService.addEmailAccount(accountData);
      
      // If account was added successfully, refresh user data
      if (response.success && response.account && user) {
        const updatedUser = {
          ...user,
          accounts: [...(user.accounts || []), response.account],
        };
        setUser(updatedUser);
        authService.saveUserToSession(updatedUser);
      }
      
      return response;
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 