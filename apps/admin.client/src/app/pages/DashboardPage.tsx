import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { PageContainer, LoadingSpinner, Dropdown } from '../components';

import { EmailData, FilterState } from '../types';
import { DashboardFilterOptions } from '../../../constants';

// Mock data for UI development
const mockEmailData: EmailData[] = [
  {
    id: '1',
    email: {
      subject: 'Important: Project deadline update',
      fromAddress: 'manager@company.com',
    },
    category: 'Work',
    priority: 'high',
    sentiment: 'neutral',
    confidence: 0.87,
    summary:
      'Project deadline has been moved to next Friday. Team needs to adjust sprint planning accordingly.',
    createdAt: '2024-01-15T10:30:00Z',
    entities: [
      { entityType: 'Date', entityValue: 'next Friday', confidence: 0.95 },
      { entityType: 'Organization', entityValue: 'Team', confidence: 0.82 },
    ],
    actionItems: [
      {
        actionType: 'meeting',
        description: 'Schedule sprint planning review',
        priority: 'high',
        isCompleted: false,
      },
      {
        actionType: 'task',
        description: 'Update timeline documentation',
        priority: 'medium',
        isCompleted: false,
      },
    ],
  },
  {
    id: '2',
    email: {
      subject: 'Thank you for your order!',
      fromAddress: 'orders@shop.com',
    },
    category: 'Personal',
    priority: 'low',
    sentiment: 'positive',
    confidence: 0.92,
    summary:
      'Order confirmation for laptop purchase. Delivery expected within 3-5 business days.',
    createdAt: '2024-01-14T15:45:00Z',
    entities: [
      { entityType: 'Product', entityValue: 'laptop', confidence: 0.89 },
      {
        entityType: 'Duration',
        entityValue: '3-5 business days',
        confidence: 0.91,
      },
    ],
    actionItems: [
      {
        actionType: 'tracking',
        description: 'Track delivery status',
        priority: 'low',
        isCompleted: true,
      },
    ],
  },
  {
    id: '3',
    email: {
      subject: 'Urgent: Server maintenance tonight',
      fromAddress: 'devops@company.com',
    },
    category: 'Work',
    priority: 'urgent',
    sentiment: 'negative',
    confidence: 0.94,
    summary:
      'Emergency server maintenance scheduled for tonight 11 PM - 2 AM. Applications will be unavailable.',
    createdAt: '2024-01-13T08:20:00Z',
    entities: [
      { entityType: 'Time', entityValue: '11 PM - 2 AM', confidence: 0.96 },
      {
        entityType: 'Event',
        entityValue: 'server maintenance',
        confidence: 0.93,
      },
    ],
    actionItems: [
      {
        actionType: 'notification',
        description: 'Notify team about downtime',
        priority: 'urgent',
        isCompleted: true,
      },
      {
        actionType: 'preparation',
        description: 'Prepare rollback plan',
        priority: 'high',
        isCompleted: false,
      },
    ],
  },
];

const initialFilters: FilterState = {
  search: '',
  category: '',
  priority: '',
  sentiment: '',
  minConfidence: '',
  entityType: '',
  actionType: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  limit: 10,
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Mock pagination data
  const totalItems = 150;
  const totalPages = Math.ceil(totalItems / filters.limit);

  const handleFilterChange = (
    field: keyof FilterState,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      case 'neutral':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Work':
        return 'bg-purple-100 text-purple-800';
      case 'Personal':
        return 'bg-indigo-100 text-indigo-800';
      case 'Finance':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Email Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Processed email insights and analytics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Welcome back, {user.displayName || user.username}
            </span>
            <button
              onClick={() => navigate('/add-account')}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Account
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search subjects, summaries..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Category Dropdown */}
            <Dropdown
              label="Category"
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
              options={DashboardFilterOptions.categories}
              allLabel="All Categories"
            />

            {/* Priority Dropdown */}
            <Dropdown
              label="Priority"
              value={filters.priority}
              onChange={(value) => handleFilterChange('priority', value)}
              options={DashboardFilterOptions.priorities}
              allLabel="All Priorities"
            />

            {/* Sentiment Dropdown */}
            <Dropdown
              label="Sentiment"
              value={filters.sentiment}
              onChange={(value) => handleFilterChange('sentiment', value)}
              options={DashboardFilterOptions.sentiments}
              allLabel="All Sentiments"
            />

            {/* Min Confidence Dropdown */}
            <Dropdown
              label="Min Confidence"
              value={filters.minConfidence}
              onChange={(value) => handleFilterChange('minConfidence', value)}
              options={DashboardFilterOptions.confidenceLevels}
              allLabel="Any Confidence"
            />

            {/* Entity Type Dropdown */}
            <Dropdown
              label="Entity Type"
              value={filters.entityType}
              onChange={(value) => handleFilterChange('entityType', value)}
              options={DashboardFilterOptions.entityTypes}
              allLabel="All Entities"
            />

            {/* Action Type Dropdown */}
            <Dropdown
              label="Action Type"
              value={filters.actionType}
              onChange={(value) => handleFilterChange('actionType', value)}
              options={DashboardFilterOptions.actionTypes}
              allLabel="All Actions"
            />

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => setFilters(initialFilters)}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Clear Filters
            </button>
            <div className="text-sm text-gray-500">
              Showing {mockEmailData.length} of {totalItems} results
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockEmailData.map((email) => (
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
                            ></div>
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
                          onClick={() => toggleRowExpansion(email.id)}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          {expandedRows.has(email.id)
                            ? '▲ Collapse'
                            : '▼ Expand'}
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
                                Summary
                              </h4>
                              <p className="text-sm text-gray-700">
                                {email.summary}
                              </p>
                            </div>

                            {/* Entities */}
                            {email.entities && email.entities.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                  Entities
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
                            {email.actionItems &&
                              email.actionItems.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                                    Action Items
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
                                            className="rounded text-primary-600"
                                            readOnly
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

        {/* Pagination */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {currentPage} of {totalPages} ({totalItems} total
              results)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex space-x-1">
                {[...Array(Math.min(5, totalPages))].map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default DashboardPage;
