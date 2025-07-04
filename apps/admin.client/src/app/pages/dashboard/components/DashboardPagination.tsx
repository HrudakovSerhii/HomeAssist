import React from 'react';
import { DASHBOARD_MESSAGES, PAGINATION_CONFIG } from '../constants';

interface DashboardPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export const DashboardPagination: React.FC<DashboardPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  loading,
  onPageChange,
}) => {
  const handlePreviousPage = () => {
    onPageChange(Math.max(1, currentPage - 1));
  };

  const handleNextPage = () => {
    onPageChange(Math.min(totalPages, currentPage + 1));
  };

  const getVisiblePages = () => {
    const { maxVisiblePages } = PAGINATION_CONFIG;
    const pages = [];
    
    for (let i = 0; i < Math.min(maxVisiblePages, totalPages); i++) {
      const pageNum = Math.max(1, currentPage - 2) + i;
      if (pageNum <= totalPages) {
        pages.push(pageNum);
      }
    }
    
    return pages;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing page {currentPage} of {totalPages} ({totalItems} total results)
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {DASHBOARD_MESSAGES.previous}
          </button>

          {/* Page Numbers */}
          <div className="flex space-x-1">
            {getVisiblePages().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded ${
                  currentPage === pageNum
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {DASHBOARD_MESSAGES.next}
          </button>
        </div>
      </div>
    </div>
  );
}; 