import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../../configuration';

import {
  LoginDto,
  AuthResponse,
  CreateUserDto,
  RegisterResponse,
  AddEmailAccountDto,
  TestImapDto,
  ImapTestResponse,
  User,
  UserAccountsResponse,
  AddAccountResponse,
} from '@home-assist/api-types';

export const authService = {
  // Authentication methods
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.auth.login,
      credentials
    );

    // Store token if login successful
    if (response.token) {
      apiClient.setToken(response.token);
    }

    return response;
  },

  async register(userData: CreateUserDto): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>(
      API_ENDPOINTS.auth.register,
      userData
    );
  },

  async logout(): Promise<void> {
    try {
      // Note: logout endpoint not implemented in backend yet
      // await apiClient.post('/auth/logout');
      console.log(
        'Logout endpoint not implemented in backend, clearing local session only'
      );
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      // Always clear local authentication
      apiClient.setToken(null);
      this.clearSessionData();
    }
  },

  async refreshToken(): Promise<AuthResponse> {
    // Note: refresh endpoint not implemented in backend yet
    throw new Error('Token refresh not implemented in backend yet');
  },

  // Account management methods
  async testImapConnection(imapData: TestImapDto): Promise<ImapTestResponse> {
    return apiClient.post<ImapTestResponse>(
      API_ENDPOINTS.auth.testImap,
      imapData
    );
  },

  async addEmailAccount(
    accountData: AddEmailAccountDto
  ): Promise<AddAccountResponse> {
    return apiClient.post<AddAccountResponse>(
      API_ENDPOINTS.auth.addAccount,
      accountData
    );
  },

  async getAccounts(userId: string): Promise<UserAccountsResponse> {
    return apiClient.get<UserAccountsResponse>(
      `${API_ENDPOINTS.auth.accounts}?userId=${userId}`
    );
  },

  async deleteAccount(
    accountId: string
  ): Promise<{ success: boolean; message?: string }> {
    throw new Error(
      'Account management endpoints not implemented in backend yet'
    );
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
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
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
  },
};
