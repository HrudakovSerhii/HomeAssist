import React from 'react';
import { useAuth, useApi, useForm } from '../../hooks';
import { FormGroup, InputField, SubmitButton } from '../';
import { User, LoginCredentials } from '../../types';
import { validationSchemas } from '../../utils/validation';

interface LoginFormProps {
  onSuccess: (user: User, hasAccounts: boolean) => void;
  onError: (error: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const { login } = useAuth();
  const { execute, loading } = useApi();
  
  const form = useForm({
    initialValues: {
      username: '',
      password: ''
    },
    validationSchema: validationSchemas.login
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous errors
    onError('');
    
    // Validate using the form's built-in validation
    if (!form.validate()) {
      return;
    }

    try {
      const result = await execute(() => login(form.values as LoginCredentials));
      
      if (result?.success && result.user) {
        // Clear form on success
        form.reset();
        
        // Call success handler
        onSuccess(result.user, result.user.accounts?.length > 0);
      } else {
        onError(result?.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      onError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormGroup>
        <InputField
          label="Username"
          type="text"
          name="username"
          value={form.values.username}
          onChange={(value) => form.setValue('username', value)}
          error={form.errors.username}
          placeholder="Enter your username"
          required
          disabled={loading}
        />
      </FormGroup>

      <FormGroup>
        <InputField
          label="Password"
          type="password"
          name="password"
          value={form.values.password}
          onChange={(value) => form.setValue('password', value)}
          error={form.errors.password}
          placeholder="Enter your password"
          required
          disabled={loading}
        />
      </FormGroup>

      <div className="pt-4">
        <SubmitButton
          loading={loading}
          disabled={loading || !form.values.username || !form.values.password}
          fullWidth={true}
        >
          Sign In
        </SubmitButton>
      </div>

      {/* Additional Help Text */}
      <div className="text-center text-sm text-gray-500 pt-2">
        <p>Use your IMAP credentials to access your email accounts</p>
      </div>
    </form>
  );
}; 