import React from 'react';
import { useAuth, useApi, useForm } from '../../hooks';
import { FormGroup, InputField, SubmitButton } from '../';
import { RegisterData } from '../../types';
import { validationSchemas } from '../../utils';

interface RegisterFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
}) => {
  const { register } = useAuth();
  const { execute, loading } = useApi(register);

  const form = useForm({
    initialValues: {
      username: 'Serhii',
      password: 'Serhii123',
      displayName: 'Serhii',
      email: 'hrudakovserhii@gmail.com',
    },
    validationSchema: validationSchemas.register,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous errors
    onError('');

    // Debug: Log form state before validation
    console.log('Form values:', form.values);
    console.log('Form errors before validation:', form.errors);

    // Validate using the form's built-in validation
    const isValid = form.validate();
    console.log('Validation result:', isValid);
    console.log('Form errors after validation:', form.errors);

    if (!isValid) {
      // Display validation errors to user
      const errorMessages = Object.values(form.errors).filter((error) => error);
      if (errorMessages.length > 0) {
        onError(`Please fix the following errors: ${errorMessages.join(', ')}`);
      }
      return;
    }

    try {
      debugger;
      const result = await execute(form.values as RegisterData);

      if (result?.success) {
        // Clear form on success
        form.reset();

        // Call success handler
        onSuccess();
      } else {
        onError(result?.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
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
          placeholder="Choose a username"
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
          placeholder="Choose a password (min 8 characters)"
          required
          disabled={loading}
          minLength={8}
        />
      </FormGroup>

      <FormGroup>
        <InputField
          label="Display Name"
          type="text"
          name="displayName"
          value={form.values.displayName}
          onChange={(value) => form.setValue('displayName', value)}
          error={form.errors.displayName}
          placeholder="Your display name"
          required
          disabled={loading}
        />
      </FormGroup>

      <FormGroup>
        <InputField
          label="Email (Optional)"
          type="email"
          name="email"
          value={form.values.email}
          onChange={(value) => form.setValue('email', value)}
          error={form.errors.email}
          placeholder="your@email.com"
          disabled={loading}
        />
      </FormGroup>

      <div className="pt-4">
        <SubmitButton
          loading={loading}
          disabled={
            loading ||
            !form.values.username ||
            !form.values.password ||
            !form.values.displayName
          }
          fullWidth={true}
        >
          Create Account
        </SubmitButton>
      </div>

      {/* Additional Help Text */}
      <div className="text-center text-sm text-gray-500 pt-2">
        <p>
          By creating an account, you agree to use secure IMAP authentication
        </p>
      </div>
    </form>
  );
};
