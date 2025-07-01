import { VALIDATION } from '../../../constants';

// Validation utility functions
export const validation = {
  // Email validation
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  // Password validation
  isValidPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  },

  // Required field validation
  isRequired(value: string | null | undefined): boolean {
    return value !== null && value !== undefined && value.trim() !== '';
  },

  // Username validation
  isValidUsername(username: string): boolean {
    // 3-30 characters, alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  },

  // Display name validation
  isValidDisplayName(displayName: string): boolean {
    // 2-50 characters, letters, spaces, hyphens, apostrophes
    const displayNameRegex = /^[a-zA-Z\s\-']{2,50}$/;
    return displayNameRegex.test(displayName.trim());
  },

  // IMAP port validation
  isValidPort(port: string | number): boolean {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
  },

  // IMAP host validation
  isValidHost(host: string): boolean {
    // Basic hostname validation
    const hostRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return hostRegex.test(host.trim());
  }
};

// Form validation schemas
export const validationSchemas = {
  login: {
    username: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.required;
      }
      if (!validation.isValidUsername(value) && !validation.isValidEmail(value)) {
        return 'Please enter a valid username or email address';
      }
      return '';
    },

    password: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.password.required;
      }
      return '';
    }
  },

  register: {
    username: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.required;
      }
      if (!validation.isValidUsername(value)) {
        return 'Username must be 3-30 characters and contain only letters, numbers, and underscores';
      }
      return '';
    },

    password: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.password.required;
      }
      if (!validation.isValidPassword(value)) {
        return VALIDATION.password.pattern;
      }
      return '';
    },

    displayName: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.required;
      }
      if (!validation.isValidDisplayName(value)) {
        return 'Display name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes';
      }
      return '';
    },

    email: (value: string) => {
      if (value && !validation.isValidEmail(value)) {
        return VALIDATION.email.invalid;
      }
      return '';
    }
  },

  addAccount: {
    email: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.email.required;
      }
      if (!validation.isValidEmail(value)) {
        return VALIDATION.email.invalid;
      }
      return '';
    },

    appPassword: (value: string) => {
      if (!validation.isRequired(value)) {
        return 'App password is required';
      }
      if (value.length < 6) {
        return 'App password must be at least 6 characters';
      }
      return '';
    },

    displayName: (value: string) => {
      if (!validation.isRequired(value)) {
        return VALIDATION.required;
      }
      if (!validation.isValidDisplayName(value)) {
        return 'Display name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes';
      }
      return '';
    },

    imapHost: (value: string) => {
      if (value && !validation.isValidHost(value)) {
        return 'Please enter a valid IMAP host (e.g., imap.gmail.com)';
      }
      return '';
    },

    imapPort: (value: string) => {
      if (value && !validation.isValidPort(value)) {
        return 'Please enter a valid port number (1-65535)';
      }
      return '';
    }
  }
};

// Generic form validator
export function validateForm<T extends Record<string, any>>(
  values: T,
  schema: Record<keyof T, (value: any) => string>
): Record<keyof T, string> {
  const errors = {} as Record<keyof T, string>;
  
  Object.keys(schema).forEach((field) => {
    const key = field as keyof T;
    const validator = schema[key];
    const error = validator(values[key]);
    if (error) {
      errors[key] = error;
    }
  });
  
  return errors;
}

// Check if form has errors
export function hasFormErrors<T extends Record<string, any>>(
  errors: Record<keyof T, string>
): boolean {
  return Object.values(errors).some(error => error !== '');
} 