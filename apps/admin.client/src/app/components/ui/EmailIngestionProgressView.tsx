import React from 'react';

import { LoadingSpinner } from './LoadingSpinner';

import {
  EmailIngestionProgress,
  EmailIngestionStage,
} from '@home-assist/api-types';

interface EmailIngestionProgressProps {
  isOpen: boolean;
  onClose: () => void;
  progress: EmailIngestionProgress | null;
}

export const EmailIngestionProgressView: React.FC<
  EmailIngestionProgressProps
> = ({ isOpen, onClose, progress }) => {
  if (!isOpen || !progress) return null;

  const getStageLabel = (stage: EmailIngestionStage) => {
    switch (stage) {
      case 'CONNECTING':
        return 'Connecting to email server...';
      case 'FETCHING':
        return 'Fetching emails...';
      case 'STORING':
        return 'Storing emails...';
      case 'PROCESSING':
        return 'Processing with AI...';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Processing...';
    }
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return '';
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    return `${Math.round(seconds / 60)}m remaining`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Email Ingestion Progress
          </h3>
          {progress.stage === 'COMPLETED' || progress.stage === 'FAILED' ? (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-sm font-semibold inline-block text-primary-600">
                  {getStageLabel(progress.stage)}
                </span>
              </div>
              {progress.estimatedTimeRemaining &&
                progress.stage !== 'COMPLETED' && (
                  <div className="text-right">
                    <span className="text-sm font-semibold inline-block text-gray-600">
                      {formatTimeRemaining(progress.estimatedTimeRemaining)}
                    </span>
                  </div>
                )}
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-100">
              <div
                style={{ width: `${progress.progress}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                  progress.stage === 'FAILED'
                    ? 'bg-red-500'
                    : progress.stage === 'COMPLETED'
                    ? 'bg-green-500'
                    : 'bg-primary-500'
                }`}
              />
            </div>
          </div>

          {/* Current Email Info */}
          {progress.currentEmail && (
            <div className="text-sm text-gray-600">
              <p className="font-medium">Processing:</p>
              <p className="truncate">{progress.currentEmail.subject}</p>
              <p className="text-xs text-gray-500">
                From: {progress.currentEmail.from}
              </p>
            </div>
          )}

          {/* Progress Stats */}
          {progress.totalEmails && (
            <div className="text-sm text-gray-600">
              <p>
                Processed {progress.processedEmails || 0} of{' '}
                {progress.totalEmails} emails
              </p>
            </div>
          )}

          {/* Error Message */}
          {progress.error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {progress.error}
            </div>
          )}

          {/* Loading Spinner */}
          {progress.stage !== 'COMPLETED' && progress.stage !== 'FAILED' && (
            <div className="flex justify-center mt-4">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
