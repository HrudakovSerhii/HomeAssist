import React from 'react';
import { Dropdown } from '../../../components';
import { DASHBOARD_LABELS, DASHBOARD_MESSAGES, DASHBOARD_PLACEHOLDERS } from '../constants';
import type { FilterState } from '../../../types';
import type { DropdownOption } from '../../../components';

interface DashboardFiltersProps {
  filters: FilterState;
  loading: boolean;
  totalItems: number;
  emailDataLength: number;
  onFilterChange: (field: keyof FilterState, value: string | number) => void;
  onClearFilters: () => void;
  filterOptions: {
    categories: DropdownOption[];
    priorities: DropdownOption[];
    sentiments: DropdownOption[];
    confidenceLevels: DropdownOption[];
    entityTypes: DropdownOption[];
    actionTypes: DropdownOption[];
  };
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  loading,
  totalItems,
  emailDataLength,
  onFilterChange,
  onClearFilters,
  filterOptions,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {DASHBOARD_LABELS.filtersTitle}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder={DASHBOARD_PLACEHOLDERS.search}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loading}
          />
        </div>

        {/* Category Dropdown */}
        <Dropdown
          label="Category"
          value={filters.category}
          onChange={(value) => onFilterChange('category', value)}
          options={filterOptions.categories}
          allLabel="All Categories"
          disabled={loading}
        />

        {/* Priority Dropdown */}
        <Dropdown
          label="Priority"
          value={filters.priority}
          onChange={(value) => onFilterChange('priority', value)}
          options={filterOptions.priorities}
          allLabel="All Priorities"
          disabled={loading}
        />

        {/* Sentiment Dropdown */}
        <Dropdown
          label="Sentiment"
          value={filters.sentiment}
          onChange={(value) => onFilterChange('sentiment', value)}
          options={filterOptions.sentiments}
          allLabel="All Sentiments"
          disabled={loading}
        />

        {/* Min Confidence Dropdown */}
        <Dropdown
          label="Min Confidence"
          value={filters.minConfidence}
          onChange={(value) => onFilterChange('minConfidence', value)}
          options={filterOptions.confidenceLevels}
          allLabel="Any Confidence"
          disabled={loading}
        />

        {/* Entity Type Dropdown */}
        <Dropdown
          label="Entity Type"
          value={filters.entityType}
          onChange={(value) => onFilterChange('entityType', value)}
          options={filterOptions.entityTypes}
          allLabel="All Entities"
          disabled={loading}
        />

        {/* Action Type Dropdown */}
        <Dropdown
          label="Action Type"
          value={filters.actionType}
          onChange={(value) => onFilterChange('actionType', value)}
          options={filterOptions.actionTypes}
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
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={loading}
          />
        </div>
      </div>

      {/* Filter Actions */}
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={onClearFilters}
          className="text-gray-600 hover:text-gray-800 text-sm disabled:opacity-50"
          disabled={loading}
        >
          {DASHBOARD_MESSAGES.clearFilters}
        </button>
        <div className="text-sm text-gray-500">
          {loading
            ? 'Loading...'
            : `Showing ${emailDataLength} of ${totalItems} results`}
        </div>
      </div>
    </div>
  );
}; 