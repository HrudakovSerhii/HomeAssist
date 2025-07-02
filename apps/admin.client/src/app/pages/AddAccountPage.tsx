import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useAuth } from '../hooks';
import { authService } from '../services';
import { ACCOUNT_TYPES } from '../../../constants';
import { AccountData, ImapTestData, ImapTestResponse } from '../types';

import {
  AlertMessage,
  Button,
  Card,
  FormGroup,
  InputField,
  LoadingSpinner,
  SelectField,
} from '../components';

export const AddAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, addEmailAccount } = useAuth();
  const [formData, setFormData] = useState<AccountData>({
    email: '',
    appPassword: '',
    displayName: '',
    accountType: ACCOUNT_TYPES.GMAIL,
    userId: '',
  });

  const testConnectionApi = useApi<ImapTestResponse>(
    authService.testImapConnection
  );

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<
    'form' | 'testing' | 'adding' | 'success'
  >('form');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setFormData((prev) => ({ ...prev, userId: user.id }));
    }
  }, [user, navigate]);

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev: AccountData) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTestConnection = async () => {
    setCurrentStep('testing');

    const testData: ImapTestData = {
      email: formData.email,
      appPassword: formData.appPassword,
    };

    await testConnectionApi.execute(testData);
  };

  const handleAddAccount = async () => {
    if (!user) return;

    setCurrentStep('adding');

    const accountData: AccountData = {
      ...formData,
      displayName: formData.displayName || formData.email,
      userId: user.id,
    };

    try {
      const result = await addEmailAccount(accountData);

      if (result.success) {
        setCurrentStep('success');
        setSuccessMessage(
          `Email account "${formData.email}" added successfully!`
        );

        // Clear form
        setFormData({
          email: '',
          appPassword: '',
          displayName: '',
          accountType: ACCOUNT_TYPES.GMAIL,
          userId: user.id,
        });

        // Auto-redirect after success
        setTimeout(() => {
          if (
            window.confirm(
              'Email account added successfully! Would you like to go to the dashboard to start processing emails?'
            )
          ) {
            navigate('/dashboard');
          } else {
            setCurrentStep('form');
            setSuccessMessage(null);
          }
        }, 2000);
      } else {
        setCurrentStep('form');
        // Error will be handled by the addEmailAccount method
      }
    } catch (error) {
      setCurrentStep('form');
      // Error handled by addEmailAccount
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    // First test the connection
    await handleTestConnection();
  };

  // Handle test connection success
  useEffect(() => {
    if (testConnectionApi.data?.success && currentStep === 'testing') {
      handleAddAccount().finally();
    }
  }, [testConnectionApi.data, currentStep]);

  const getActiveAccountsInfo = () => {
    if (!user?.accounts) return 'No email accounts connected yet';

    const activeAccounts = user.accounts.filter((acc) => acc.isActive);
    const count = activeAccounts.length;

    if (count === 0) return 'No email accounts connected yet';

    const accountsList = activeAccounts.map((acc) => acc.email).join(', ');
    return `${count} email account(s) connected • ${accountsList}`;
  };

  const getCurrentError = () => {
    if (currentStep === 'testing' && testConnectionApi.error) {
      return 'IMAP connection test failed. Please check your email and app password.';
    }
    return null;
  };

  const getCurrentMessage = () => {
    if (currentStep === 'testing' && !testConnectionApi.error) {
      return 'Testing IMAP connection...';
    }
    if (currentStep === 'adding') {
      return 'IMAP connection successful! Adding account...';
    }
    if (currentStep === 'success' && successMessage) {
      return successMessage;
    }
    return null;
  };

  const isLoading = testConnectionApi.loading || currentStep === 'adding';
  const isFormDisabled = isLoading || currentStep === 'success';

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-secondary-600 p-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-8 left-8 bg-white/20 text-white border-none px-4 py-3 rounded-lg text-sm cursor-pointer hover:bg-white/30 transition-colors"
      >
        ← Back
      </button>

      <Card className="max-w-2xl w-full text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Add Email Account
          </h1>
          <p className="text-slate-600 text-lg">
            Connect your email account to start processing emails
          </p>
        </div>

        {/* User Info */}
        <div className="bg-slate-50 rounded-lg p-4 mb-4 text-left">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            {user.displayName || user.username}
          </h3>
          <p className="text-slate-600 text-sm">{getActiveAccountsInfo()}</p>
        </div>

        {/* Messages */}
        {getCurrentError() && (
          <AlertMessage type="error" message={getCurrentError()!} show={true} />
        )}

        {getCurrentMessage() && !getCurrentError() && (
          <AlertMessage
            type={currentStep === 'success' ? 'success' : 'info'}
            message={getCurrentMessage()!}
            show={true}
          />
        )}

        {/* Add Account Form */}
        <form onSubmit={handleSubmit} className="text-left mt-4 mb-4">
          <FormGroup>
            <InputField
              name="account-email"
              label="Gmail Address"
              type="email"
              value={formData.email}
              onChange={(value) => handleInputChange('email', value)}
              placeholder="your.email@gmail.com"
              required
              disabled={isFormDisabled}
            />
          </FormGroup>

          <FormGroup>
            <InputField
              name="account-password"
              label="App Password"
              type="password"
              value={formData.appPassword}
              onChange={(value) => handleInputChange('appPassword', value)}
              placeholder="Gmail app password (16 characters)"
              required
              disabled={isFormDisabled}
            />
          </FormGroup>

          <FormGroup>
            <InputField
              name="account-display-name"
              label="Account Name (Optional)"
              type="text"
              value={formData.displayName}
              onChange={(value) => handleInputChange('displayName', value)}
              placeholder="Work Gmail, Personal Gmail, etc."
              disabled={isFormDisabled}
            />
          </FormGroup>

          <FormGroup>
            <SelectField
              name="account-type"
              label="Account Type"
              value={formData.accountType}
              onChange={(value) => handleInputChange('accountType', value)}
              options={[
                { value: ACCOUNT_TYPES.GMAIL, label: 'Gmail' },
                { value: ACCOUNT_TYPES.OUTLOOK, label: 'Outlook' },
                { value: ACCOUNT_TYPES.YAHOO, label: 'Yahoo' },
                { value: ACCOUNT_TYPES.IMAP_GENERIC, label: 'Other IMAP' },
              ]}
              disabled={isFormDisabled}
            />
          </FormGroup>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isFormDisabled}
            loading={isLoading}
            className="w-full mb-4"
          >
            {isLoading
              ? currentStep === 'testing'
                ? 'Testing Connection...'
                : 'Adding Account...'
              : 'Add Email Account'}
          </Button>

          {/* Info Box */}
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
            <h4 className="font-semibold mb-2">
              How to get Gmail App Password:
            </h4>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Go to your Google Account settings</li>
              <li>Enable 2-Step Verification if not already enabled</li>
              <li>Go to Security → App passwords</li>
              <li>Select "Mail" and generate password</li>
              <li>Use the 16-character password here</li>
            </ol>
          </div>
        </form>

        {/* Navigation Links */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/dashboard')}
            disabled={isLoading}
          >
            ← Dashboard
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              authService.logout();
              navigate('/login');
            }}
            disabled={isLoading}
          >
            Logout
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AddAccountPage;
