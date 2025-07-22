import React from 'react';
import { ACCOUNT_STATUS_COLORS } from '../constants';

interface UserAccount {
  id: string;
  displayName: string;
  email: string;
  accountType: string;
  isActive: boolean;
  isConnected: boolean;
}

interface DashboardAccountsInfoProps {
  accounts: UserAccount[];
}

export const DashboardAccountsInfo: React.FC<DashboardAccountsInfoProps> = ({
  accounts,
}) => {
  const accountCount = accounts.length;
  const pluralText = accountCount !== 1 ? 's' : '';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Monitoring {accountCount} Email Account{pluralText}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg"
          >
            <div
              className={`w-3 h-3 rounded-full ${
                account.isActive && account.isConnected
                  ? ACCOUNT_STATUS_COLORS.active
                  : ACCOUNT_STATUS_COLORS.inactive
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {account.displayName}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {account.email}
              </p>
            </div>
            <div className="text-xs text-gray-400">
              {account.accountType}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 