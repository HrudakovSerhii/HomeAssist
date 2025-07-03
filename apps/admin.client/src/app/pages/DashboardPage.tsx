import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useApi } from '../hooks';
import { PageContainer, LoadingSpinner, Dropdown, AlertMessage } from '../components';
import { dataService } from '../services';
import { EmailData, FilterState } from '../types';
import { DashboardFilterOptions } from '../../../constants';

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
  
  // State management
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // API hooks
  const fetchDataApi = useApi(dataService.getExtractedEmailData);
  const updateActionApi = useApi(dataService.updateActionItem);

  // Convert FilterState to API params
  const getApiParams = useCallback(() => {
    return {
      search: filters.search || undefined,
      category: filters.category || undefined,
      priority: filters.priority || undefined,
      sentiment: filters.sentiment || undefined,
      minConfidence: filters.minConfidence ? parseFloat(filters.minConfidence) : undefined,
      entityType: filters.entityType || undefined,
      actionType: filters.actionType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: currentPage,
      limit: filters.limit,
    };
  }, [filters, currentPage]);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = getApiParams();
      const response = await fetchDataApi.execute(params);

      if (response) {
        setEmailData(response.data);
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getApiParams, fetchDataApi]);

  // Initial data load
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchData();
    }
  }, [filters]); // Only depend on filters, not fetchData to avoid infinite loops

  // Fetch data when page changes
  useEffect(() => {
    if (currentPage !== 1) {
      fetchData();
    }
  }, [currentPage, fetchData]);

  const handleFilterChange = (
    field: keyof FilterState,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(1);
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

  const handleActionToggle = async (emailId: string, actionIndex: number, isCompleted: boolean) => {
    try {
      await updateActionApi.execute(emailId, actionIndex, isCompleted);
      
      // Update local state to reflect the change
      setEmailData(prev => prev.map(email => {
        if (email.id === emailId && email.actionItems) {
          const updatedActionItems = [...email.actionItems];
          updatedActionItems[actionIndex] = {
            ...updatedActionItems[actionIndex],
            isCompleted
          };
          return { ...email, actionItems: updatedActionItems };
        }
        return email;
      }));
    } catch (err) {
      setError('Failed to update action item. Please try again.');
      console.error('Action update error:', err);
    }
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

        {/* Error Message */}
        {error && (
          <AlertMessage 
            type="error" 
            message={error} 
            show={true}
            onClose={() => setError('')}
          />
        )}

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
                disabled={loading}
              />
            </div>

            {/* Category Dropdown */}
            <Dropdown
              label="Category"
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
              options={DashboardFilterOptions.categories}
              allLabel="All Categories"
              disabled={loading}
            />

            {/* Priority Dropdown */}
            <Dropdown
              label="Priority"
              value={filters.priority}
              onChange={(value) => handleFilterChange('priority', value)}
              options={DashboardFilterOptions.priorities}
              allLabel="All Priorities"
              disabled={loading}
            />

            {/* Sentiment Dropdown */}
            <Dropdown
              label="Sentiment"
              value={filters.sentiment}
              onChange={(value) => handleFilterChange('sentiment', value)}
              options={DashboardFilterOptions.sentiments}
              allLabel="All Sentiments"
              disabled={loading}
            />

            {/* Min Confidence Dropdown */}
            <Dropdown
              label="Min Confidence"
              value={filters.minConfidence}
              onChange={(value) => handleFilterChange('minConfidence', value)}
              options={DashboardFilterOptions.confidenceLevels}
              allLabel="Any Confidence"
              disabled={loading}
            />

            {/* Entity Type Dropdown */}
            <Dropdown
              label="Entity Type"
              value={filters.entityType}
              onChange={(value) => handleFilterChange('entityType', value)}
              options={DashboardFilterOptions.entityTypes}
              allLabel="All Entities"
              disabled={loading}
            />

            {/* Action Type Dropdown */}
            <Dropdown
              label="Action Type"
              value={filters.actionType}
              onChange={(value) => handleFilterChange('actionType', value)}
              options={DashboardFilterOptions.actionTypes}
              allLabel="All Actions"
              disabled={loading}
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
                disabled={loading}
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={handleClearFilters}
              className="text-gray-600 hover:text-gray-800 text-sm disabled:opacity-50"
              disabled={loading}
            >
              Clear Filters
            </button>
            <div className="text-sm text-gray-500">
              {loading ? 'Loading...' : `Showing ${emailData.length} of ${totalItems} results`}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : emailData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
              <p className="text-gray-500">
                {Object.values(filters).some(v => v) 
                  ? 'Try adjusting your filters to see more results'
                  : 'No processed emails are available yet'
                }
              </p>
            </div>
          ) : (
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
                                              onChange={(e) => handleActionToggle(email.id, index, e.target.checked)}
                                              className="rounded text-primary-600"
                                              disabled={updateActionApi.loading}
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
          )}
        </div>

        {/* Pagination */}
        {!loading && emailData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {currentPage} of {totalPages} ({totalItems} total
                results)
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {[...Array(Math.min(5, totalPages))].map((_, index) => {
                    const pageNum = Math.max(1, currentPage - 2) + index;
                    if (pageNum > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
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
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default DashboardPage;
