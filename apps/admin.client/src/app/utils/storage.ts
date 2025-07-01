// Storage utility functions for managing session and local storage

export const storage = {
  // Session Storage methods
  session: {
    get<T>(key: string): T | null {
      try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error(`Error getting ${key} from sessionStorage:`, error);
        return null;
      }
    },

    set<T>(key: string, value: T): void {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error setting ${key} in sessionStorage:`, error);
      }
    },

    remove(key: string): void {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing ${key} from sessionStorage:`, error);
      }
    },

    clear(): void {
      try {
        sessionStorage.clear();
      } catch (error) {
        console.error('Error clearing sessionStorage:', error);
      }
    }
  },

  // Local Storage methods
  local: {
    get<T>(key: string): T | null {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error(`Error getting ${key} from localStorage:`, error);
        return null;
      }
    },

    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error setting ${key} in localStorage:`, error);
      }
    },

    remove(key: string): void {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing ${key} from localStorage:`, error);
      }
    },

    clear(): void {
      try {
        localStorage.clear();
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
    }
  },

  // Utility methods
  isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
};

// Storage keys constants
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER: 'user',
  HAS_ACTIVE_ACCOUNTS: 'hasActiveAccounts',
  THEME: 'theme',
  LANGUAGE: 'language',
  REMEMBER_ME: 'rememberMe',
  LAST_LOGIN: 'lastLogin',
  FILTER_PREFERENCES: 'filterPreferences',
  TABLE_PREFERENCES: 'tablePreferences',
} as const; 