import React from 'react';
import { FilterOptions } from '../../types';
import { InputField } from '../forms/InputField';
import { SelectField } from '../forms/SelectField';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, SENTIMENT_OPTIONS } from '../../../../constants';

interface FilterFormProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onReset: () => void;
  onApply: () => void;
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export const FilterForm: React.FC<FilterFormProps> = ({
  filters,
  onFiltersChange,
  onReset,
  onApply,
  loading = false,
  collapsed = false,
  onToggleCollapse,
  className = '',
}) => {
  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const updateDateRange = (field: 'from' | 'to', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    });
  };



  const hasActiveFilters = 
    filters.search ||
    filters.category ||
    filters.priority ||
    filters.sentiment ||
    filters.dateRange.from ||
    filters.dateRange.to;

  const formClasses = `
    transition-all duration-300 ease-in-out
    ${className}
  `.trim();

  return (
    <Card className={formClasses} padding="md">
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Active
            </span>
          )}
        </div>
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          >
            <svg
              className={`w-5 h-5 transform transition-transform duration-200 ${
                collapsed ? 'rotate-0' : 'rotate-180'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Form */}
      <div className={`transition-all duration-300 ${collapsed ? 'hidden' : 'block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Search */}
          <InputField
            label="Search"
            type="text"
            name="search"
            value={filters.search}
            onChange={(value) => updateFilter('search', value)}
            placeholder="Search emails, subjects..."
          />

          {/* Category */}
          <SelectField
            label="Category"
            name="category"
            value={filters.category}
            onChange={(value) => updateFilter('category', value)}
            options={CATEGORY_OPTIONS as any}
            placeholder="Select category..."
          />

          {/* Priority */}
          <SelectField
            label="Priority"
            name="priority"
            value={filters.priority}
            onChange={(value) => updateFilter('priority', value)}
            options={PRIORITY_OPTIONS as any}
            placeholder="Select priority..."
          />

          {/* Sentiment */}
          <SelectField
            label="Sentiment"
            name="sentiment"
            value={filters.sentiment}
            onChange={(value) => updateFilter('sentiment', value)}
            options={SENTIMENT_OPTIONS as any}
            placeholder="Select sentiment..."
          />

          {/* Date Range From */}
          <InputField
            label="From Date"
            type="date"
            name="dateFrom"
            value={filters.dateRange.from}
            onChange={(value) => updateDateRange('from', value)}
          />

          {/* Date Range To */}
          <InputField
            label="To Date"
            type="date"
            name="dateTo"
            value={filters.dateRange.to}
            onChange={(value) => updateDateRange('to', value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Button
            variant="primary"
            size="md"
            onClick={onApply}
            loading={loading}
            disabled={loading}
          >
            Apply Filters
          </Button>
          
          <Button
            variant="outline"
            size="md"
            onClick={onReset}
            disabled={loading || !hasActiveFilters}
          >
            Reset
          </Button>

          {hasActiveFilters && (
            <span className="text-sm text-gray-500">
              {Object.values(filters).filter(v => 
                typeof v === 'string' ? v : Object.values(v).some(d => d)
              ).length} filter(s) applied
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}; 