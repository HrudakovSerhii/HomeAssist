import React, { useState } from 'react';
import { TableColumn } from '../../types';

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  renderCell?: (value: any, column: TableColumn, row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  renderCell,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: TableColumn) => {
    if (!column.sortable) return;

    const newDirection = 
      sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    
    setSortColumn(column.key);
    setSortDirection(newDirection);
    
    if (onSort) {
      onSort(column.key, newDirection);
    }
  };

  const getSortIcon = (column: TableColumn) => {
    if (!column.sortable) return null;
    
    if (sortColumn !== column.key) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const tableClasses = `
    min-w-full divide-y divide-gray-200 bg-white shadow-sm rounded-lg overflow-hidden
    ${className}
  `.trim();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClasses}>
        {/* Table Header */}
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${column.sortable ? 'cursor-pointer hover:bg-gray-100 transition-colors duration-200' : ''}
                  ${column.width ? column.width : ''}
                `}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.label}</span>
                  {getSortIcon(column)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={index}
                className={`
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors duration-200' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {renderCell ? 
                      renderCell(row[column.key], column, row) : 
                      row[column.key]
                    }
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
} 