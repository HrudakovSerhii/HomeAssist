import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DASHBOARD_MESSAGES } from '../constants';

interface DashboardEmptyStateProps {
  addAccountPath: string;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  addAccountPath,
}) => {
  const navigate = useNavigate();

  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {DASHBOARD_MESSAGES.noAccountsTitle}
      </h2>
      <p className="text-gray-600 mb-6">
        {DASHBOARD_MESSAGES.noAccountsDescription}
      </p>
      <button
        onClick={() => navigate(addAccountPath)}
        className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
      >
        {DASHBOARD_MESSAGES.noAccountsButton}
      </button>
    </div>
  );
}; 