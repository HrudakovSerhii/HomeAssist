import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchedule, useCreateSchedule, useUpdateSchedule } from '../hooks/useSchedules';
import { EmailAccount, ProcessingType } from '@home-assist/api-types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InputField } from '../components/forms/InputField';
import { SelectField } from '../components/forms/SelectField';
import { APP_ENDPOINTS } from '../../configuration';
import { useAccounts } from '../contexts/AccountsContext';

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Helper function to convert UTC ISO string to local datetime-local format
function utcToLocalDateTimeString(utcIsoString: string): string {
  const date = new Date(utcIsoString);
  // Get local time and format for datetime-local input (YYYY-MM-DDTHH:mm)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toCronFromPreset(preset: 'hourly' | 'daily' | 'weekly' | 'monthly', start: Date) {
  const m = start.getMinutes();
  const h = start.getHours();
  if (preset === 'hourly') return `${m} * * * *`;
  if (preset === 'daily') return `${m} ${h} * * *`;
  if (preset === 'weekly') {
    const dow = start.getDay(); // 0-6
    return `${m} ${h} * * ${dow}`;
  }
  const dom = start.getDate();
  return `${m} ${h} ${dom} * *`;
}

const ScheduleEditPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const isNew = window.location.pathname.endsWith('/new');
  const scheduleId = !isNew ? (params['id'] as string) : '';
  const { schedule } = useSchedule(scheduleId);
  const { create, loading: creating, error: createError } = useCreateSchedule();
  const { update, loading: updating, error: updateError } = useUpdateSchedule(scheduleId);

  const { accounts, loading: loadingAccounts } = useAccounts();

  const [name, setName] = useState('');
  const [emailAccountId, setEmailAccountId] = useState('');
  const [processingType, setProcessingType] = useState<ProcessingType>('DATE_RANGE' as ProcessingType);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPreset, setRecurringPreset] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [timezone, setTimezone] = useState<string>(browserTz);
  const [llmFocus, setLlmFocus] = useState<string>('general');
  const [useDefaultFocus, setUseDefaultFocus] = useState<boolean>(true);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (schedule) {
      setName(schedule.name || '');
      setEmailAccountId(schedule.emailAccountId || '');
      const isRec = schedule.processingType === 'RECURRING';
      setIsRecurring(isRec);
      setProcessingType(schedule.processingType as ProcessingType);
      setTimezone(schedule.timezone || browserTz);
      if (isRec) {
        const base = schedule.nextExecutionAt || schedule.lastExecutedAt || new Date().toISOString();
        setStartDate(utcToLocalDateTimeString(base));
      } else if (schedule.dateRangeFrom && schedule.dateRangeTo) {
        setStartDate(utcToLocalDateTimeString(schedule.dateRangeFrom));
        setEndDate(utcToLocalDateTimeString(schedule.dateRangeTo));
      }
      setLlmFocus((schedule.llmFocus as any) || 'general');
      setUseDefaultFocus(((schedule.llmFocus as any) || 'general') === 'general');
      setIsEnabled(!!schedule.isEnabled);
    }
  }, [schedule]);

  useEffect(() => {
    setProcessingType(isRecurring ? ('RECURRING' as ProcessingType) : ('DATE_RANGE' as ProcessingType));
    if (isRecurring) {
      setEndDate('');
      // Ensure timezone is set to browser IANA if empty or default UTC
      if (!timezone || timezone === 'UTC') {
        setTimezone(browserTz);
      }
    }
  }, [isRecurring]);

  const canSubmit = useMemo(() => {
    if (!name || !emailAccountId) return false;
    if (isRecurring) return !!startDate;
    return !!startDate && !!endDate;
  }, [name, emailAccountId, isRecurring, startDate, endDate]);

  async function onSubmit() {
    if (!canSubmit) return;
    const start = startDate ? new Date(startDate) : new Date();

    if (isNew) {
      const dto: any = {
        emailAccountId,
        name,
        processingType,
        isEnabled,
        llmFocus: useDefaultFocus ? 'general' : (llmFocus || 'general'),
      };
      if (isRecurring) {
        dto.processingType = 'RECURRING';
        dto.cronExpression = toCronFromPreset(recurringPreset, start);
        dto.timezone = timezone || browserTz;
      } else {
        dto.processingType = 'DATE_RANGE';
        dto.dateRangeFrom = new Date(startDate).toISOString();
        dto.dateRangeTo = new Date(endDate).toISOString();
      }
      const created = await create(dto);
      if (created) navigate(APP_ENDPOINTS.schedules);
      return;
    }

    const dto: any = {
      emailAccountId,
      name,
      processingType,
      isEnabled,
      llmFocus: useDefaultFocus ? 'general' : (llmFocus || 'general'),
    };
    if (isRecurring) {
      dto.processingType = 'RECURRING';
      dto.cronExpression = toCronFromPreset(recurringPreset, start);
      dto.timezone = timezone || browserTz;
    } else {
      dto.processingType = 'DATE_RANGE';
      dto.dateRangeFrom = new Date(startDate).toISOString();
      dto.dateRangeTo = new Date(endDate).toISOString();
    }
    const saved = await update(dto);
    if (saved) navigate(APP_ENDPOINTS.schedules);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{isNew ? 'Create Schedule' : 'Edit Schedule'}</h1>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <InputField label="Name" type="text" name="name" value={name} onChange={setName} required />

          <SelectField
            label="Email Account"
            name="emailAccountId"
            value={emailAccountId}
            onChange={setEmailAccountId}
            options={accounts.map(a => ({ label: `${a.displayName} (${a.email})`, value: a.id }))}
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Recurring</label>
            <div className="flex items-center space-x-2">
              <input id="recurring" type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              <label htmlFor="recurring" className="text-gray-700">Run with no ending date</label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Start</label>
              <input
                type="datetime-local"
                className="mt-1 block w-full border rounded px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {!isRecurring && (
              <div>
                <label className="text-sm font-medium text-gray-700">End</label>
                <input
                  type="datetime-local"
                  className="mt-1 block w-full border rounded px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {isRecurring ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Recurring"
                name="recurringPreset"
                value={recurringPreset}
                onChange={(v) => setRecurringPreset(v as any)}
                options={[
                  { label: 'Hourly', value: 'hourly' },
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
              />
              <InputField label="Timezone" type="text" name="timezone" value={timezone} onChange={setTimezone} />
              <div className="text-xs text-gray-500 md:col-span-2">
                {recurringPreset === 'hourly' 
                  ? `will run every hour at ${new Date(startDate || new Date().toISOString()).toLocaleTimeString()} (${recurringPreset})`
                  : `will recure every ${new Date(startDate || new Date().toISOString()).toLocaleString()} (${recurringPreset})`
                }
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="LLM Focus"
              type="text"
              name="llmFocus"
              value={useDefaultFocus ? 'general' : llmFocus}
              onChange={setLlmFocus}
              disabled={useDefaultFocus}
            />
            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <input id="defaultFocus" type="checkbox" checked={useDefaultFocus} onChange={(e) => setUseDefaultFocus(e.target.checked)} />
                <label htmlFor="defaultFocus" className="text-gray-700">Use default focus strategy</label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
              <span className="text-gray-700">{isEnabled ? 'On' : 'Off'}</span>
            </div>
          </div>

          {(createError || updateError) && (
            <div className="text-red-600">Can not create new schedule</div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" size="md" onClick={() => navigate(APP_ENDPOINTS.schedules)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={onSubmit} disabled={!canSubmit || creating || updating}>
              {isNew ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ScheduleEditPage; 