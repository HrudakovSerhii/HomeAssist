import React from 'react';
import { LoadingSpinner } from '../../../components';
import { 
  DASHBOARD_COLUMNS, 
  DASHBOARD_MESSAGES, 
  DASHBOARD_LABELS, 
  EMPTY_STATE_EMOJI 
} from '../constants';
import { getPriorityColor, getSentimentColor, getCategoryColor } from '../utils';
import type { EmailData, FilterState } from '../../../types';

interface DashboardTableProps {
  emailData: EmailData[];
  loading: boolean;
  expandedRows: Set<string>;
  filters: FilterState;
  onToggleRowExpansion: (id: string) => void;
  onActionToggle: (emailId: string, actionIndex: number, isCompleted: boolean) => void;
  updateActionLoading: boolean;
}

export const DashboardTable: React.FC<DashboardTableProps> = ({
  emailData,
  loading,
  expandedRows,
  filters,
  onToggleRowExpansion,
  onActionToggle,
  updateActionLoading,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (emailData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">{EMPTY_STATE_EMOJI}</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {DASHBOARD_MESSAGES.noEmailsTitle}
          </h3>
          <p className="text-gray-500">
            {Object.values(filters).some((v) => v)
              ? DASHBOARD_MESSAGES.noEmailsFiltered
              : DASHBOARD_MESSAGES.noEmailsAvailable}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {DASHBOARD_COLUMNS.map((columnHeader) => (
                <th
                  key={columnHeader}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {columnHeader}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {emailData.map((email) => (
              <React.Fragment key={email.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {email.email.subject}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {email.email.fromAddress}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(
                        email.category
                      )}`}
                    >
                      {email.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                        email.priority
                      )}`}
                    >
                      {email.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSentimentColor(
                        email.sentiment
                      )}`}
                    >
                      {email.sentiment}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${email.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        {Math.round(email.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(email.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onToggleRowExpansion(email.id)}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      {expandedRows.has(email.id)
                        ? DASHBOARD_MESSAGES.collapseRow
                        : DASHBOARD_MESSAGES.expandRow}
                    </button>
                  </td>
                </tr>

                {/* Expanded Row Content */}
                {expandedRows.has(email.id) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-4">
                        {/* Summary */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            {DASHBOARD_LABELS.summaryTitle}
                          </h4>
                          <p className="text-sm text-gray-700">
                            {email.summary}
                          </p>
                        </div>

                        {/* Entities */}
                        {email.entities && email.entities.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">
                              {DASHBOARD_LABELS.entitiesTitle}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {email.entities.map((entity, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800"
                                >
                                  <span className="font-medium">
                                    {entity.entityType}:
                                  </span>
                                  <span className="ml-1">
                                    {entity.entityValue}
                                  </span>
                                  <span className="ml-1 text-blue-600">
                                    ({Math.round(entity.confidence * 100)}%)
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Items */}
                        {email.actionItems && email.actionItems.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">
                              {DASHBOARD_LABELS.actionItemsTitle}
                            </h4>
                            <div className="space-y-2">
                              {email.actionItems.map((action, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-2 bg-white rounded border"
                                >
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={action.isCompleted}
                                      onChange={(e) =>
                                        onActionToggle(
                                          email.id,
                                          index,
                                          e.target.checked
                                        )
                                      }
                                      className="rounded text-primary-600"
                                      disabled={updateActionLoading}
                                    />
                                    <span
                                      className={`text-sm ${
                                        action.isCompleted
                                          ? 'line-through text-gray-500'
                                          : 'text-gray-900'
                                      }`}
                                    >
                                      {action.description}
                                    </span>
                                  </div>
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                                      action.priority
                                    )}`}
                                  >
                                    {action.priority}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 