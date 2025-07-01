import { apiClient } from './apiClient';
import { 
  LoginCredentials, 
  LoginResponse, 
  RegisterData, 
  RegisterResponse,
  AccountData,
  AddAccountResponse,
  ImapTestData,
  ImapTestResponse,
  User
} from '../types';
import { API_ENDPOINTS } from '../../../constants';

export const authService = {
  // Authentication methods
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      API_ENDPOINTS.auth.login, 
      credentials
    );
    
    // Store token if login successful
    if (response.success && response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  },

  async register(userData: RegisterData): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>(
      API_ENDPOINTS.auth.register, 
      userData
    );
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.auth.logout);
    } catch (error) {
      // Even if logout fails on server, clear local token
      console.warn('Logout request failed:', error);
    } finally {
      // Always clear local authentication
      apiClient.setToken(null);
      this.clearSessionData();
    }
  },

  async refreshToken(): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(API_ENDPOINTS.auth.refresh);
    
    if (response.success && response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  },

  // Account management methods
  async testImapConnection(imapData: ImapTestData): Promise<ImapTestResponse> {
    return apiClient.post<ImapTestResponse>(
      API_ENDPOINTS.accounts.test, 
      imapData
    );
  },

  async addEmailAccount(accountData: AccountData): Promise<AddAccountResponse> {
    return apiClient.post<AddAccountResponse>(
      API_ENDPOINTS.accounts.add, 
      accountData
    );
  },

  async getAccounts(): Promise<{ success: boolean; accounts: any[] }> {
    return apiClient.get(API_ENDPOINTS.accounts.list);
  },

  async deleteAccount(accountId: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.delete(API_ENDPOINTS.accounts.delete(accountId));
  },

  // Session management
  saveUserToSession(user: User): void {
    sessionStorage.setItem('user', JSON.stringify(user));
  },

  getUserFromSession(): User | null {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error('Error parsing user data from session:', error);
        this.clearSessionData();
      }
    }
    return null;
  },

  clearSessionData(): void {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    // Clear any other session data
    sessionStorage.removeItem('hasActiveAccounts');
  },

  // Validation helpers
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = apiClient.getToken();
    const user = this.getUserFromSession();
    return !!(token && user);
  },

  // Get current user
  getCurrentUser(): User | null {
    return this.getUserFromSession();
  }
}; 