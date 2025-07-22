import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner } from '../../../components';
import { DASHBOARD_LABELS, DASHBOARD_MESSAGES } from '../constants';

interface DashboardHeaderProps {
  user: {
    displayName?: string;
    username: string;
  };
  isIngesting: boolean;
  onIngestEmails: () => void;
  addAccountPath: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  isIngesting,
  onIngestEmails,
  addAccountPath,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {DASHBOARD_LABELS.dashboardTitle}
        </h1>
        <p className="text-gray-600 mt-1">
          {DASHBOARD_LABELS.dashboardSubtitle}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-500">
          Welcome back, {user.displayName || user.username}
        </span>
        <button
          onClick={() => navigate(addAccountPath)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {DASHBOARD_MESSAGES.addAccount}
        </button>
        <Button
          onClick={onIngestEmails}
          disabled={isIngesting || !user}
          variant="primary"
          size="md"
          className="flex items-center space-x-2"
        >
          <span>{DASHBOARD_MESSAGES.ingestEmails}</span>
          {isIngesting && <LoadingSpinner size="sm" />}
        </Button>
      </div>
    </div>
  );
}; 