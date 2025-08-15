import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useUserSchedules,
  useDeleteSchedule,
  useCronCalendar,
} from '../hooks/useSchedules';
import { APP_ENDPOINTS } from '../../configuration';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card } from '../components/ui/Card';

const SchedulesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: schedules, loading, error, refetch } = useUserSchedules();
  const { remove } = useDeleteSchedule();

  const [showCalendar, setShowCalendar] = useState(false);
  const {
    data: calendar,
    loading: loadingCal,
    error: calError,
    refetch: refetchCal,
  } = useCronCalendar();
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const formatCronCell = (iso: string | Date | undefined) => {
    if (!iso) return '-';
    const d = new Date(iso as any);
    const local = d.toLocaleTimeString();
    const utc = d.toUTCString().split(' ')[4]; // HH:MM:SS from UTC string
    return `${local} (UTC ${utc})`;
  };

  const isScheduledToday = (nextExecutionAt: string | Date | null | undefined) => {
    if (!nextExecutionAt) return false;
    const executionDate = new Date(nextExecutionAt as any);
    const today = new Date();
    return (
      executionDate.getFullYear() === today.getFullYear() &&
      executionDate.getMonth() === today.getMonth() &&
      executionDate.getDate() === today.getDate()
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Processing Schedules</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowCalendar((v) => !v);
              if (!showCalendar) refetchCal();
            }}
          >
            {showCalendar ? 'Hide Cron Calendar' : 'Show Cron Calendar'}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(APP_ENDPOINTS.editScheduleNew)}
          >
            Create Schedule
          </Button>
        </div>
      </div>

      {showCalendar && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">
                Local timezone: {localTz}
              </div>
              <Button variant="secondary" size="sm" onClick={refetchCal}>
                Refresh
              </Button>
            </div>
            {loadingCal && <div>Loading cron calendar...</div>}
            {calError && <div className="text-red-600">{calError}</div>}
            {!loadingCal && calendar.length === 0 && (
              <div className="text-gray-600">No cron entries found.</div>
            )}
            {!loadingCal && calendar.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Schedule
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Next Run (Local & UTC)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Next Executions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {calendar.map((c) => (
                      <tr key={c.configId}>
                        <td className="px-4 py-2">{c.configName}</td>
                        <td className="px-4 py-2">{c.accountEmail}</td>
                        <td className="px-4 py-2">
                          {formatCronCell(c.nextExecutions?.[0])}
                        </td>
                        <td className="px-4 py-2">
                          <div className="space-y-1">
                            {c.nextExecutions.slice(0, 3).map((d, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="text-gray-800">
                                  {new Date(d as any).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-gray-500 mt-2">
                  Times are shown in your local timezone; the UTC part reflects
                  the same instant in UTC.
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {loading && <div>Loading schedules...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && schedules.length === 0 && (
        <Card>
          <div className="p-6 text-gray-600">
            No schedules yet. Create your first schedule.
          </div>
        </Card>
      )}

      {!loading && schedules.length > 0 && (
        <div className="bg-white shadow rounded overflow-hidden mt-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.map((s) => (
                <tr 
                  key={s.id} 
                  className={`hover:bg-gray-50 ${
                    isScheduledToday(s.nextExecutionAt) 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : ''
                  }`}
                >
                  <td
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => navigate(APP_ENDPOINTS.editSchedule(s.id))}
                  >
                    <div className={`text-sm font-medium ${
                      isScheduledToday(s.nextExecutionAt) ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {s.name}
                      {isScheduledToday(s.nextExecutionAt) && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.processingType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {s.emailAccount?.displayName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.emailAccount?.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {s.processingType === 'DATE_RANGE' && (
                      <div className="text-sm text-gray-900">
                        {s.dateRangeFrom
                          ? new Date(s.dateRangeFrom).toLocaleString()
                          : '-'}{' '}
                        –{' '}
                        {s.dateRangeTo
                          ? new Date(s.dateRangeTo).toLocaleString()
                          : '-'}
                      </div>
                    )}
                    {s.processingType === 'RECURRING' && (
                      <div className={`text-sm ${
                        isScheduledToday(s.nextExecutionAt) ? 'text-blue-900 font-medium' : 'text-gray-900'
                      }`}>
                        {s.nextExecutionAt && new Date(s.nextExecutionAt as any) > new Date()
                          ? `Next: ${new Date(s.nextExecutionAt as any).toLocaleString()}`
                          : 'not specified'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      status={s.isEnabled ? 'connected' : 'disconnected'}
                    >
                      {s.isEnabled ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(APP_ENDPOINTS.editSchedule(s.id))}
                      className="mr-2"
                    >
                      Edit
                    </Button>
                    {!s.isDefault && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          const ok = await remove(s.id);
                          if (ok) refetch();
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;
