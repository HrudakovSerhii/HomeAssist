import React from 'react';
import { LoadingSpinner } from '../../../components';
import { DASHBOARD_MESSAGES } from '../constants';

export const DashboardLoadingState: React.FC = () => {
  return (
    <div className="flex justify-center items-center h-64">
      <LoadingSpinner />
      <span className="ml-2 text-gray-600">
        {DASHBOARD_MESSAGES.loadingAccounts}
      </span>
    </div>
  );
}; 