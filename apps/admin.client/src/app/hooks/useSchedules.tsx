import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { scheduleService } from '../services';
import {
  CreateProcessingScheduleDto,
  UpdateProcessingScheduleDto,
  ProcessingSchedule,
  ProcessingScheduleWithAccount,
  ValidateScheduleResponse,
  CronJobCalendarEntry,
} from '@home-assist/api-types';

export function useUserSchedules() {
  const { user } = useAuth();
  const [data, setData] = useState<ProcessingScheduleWithAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const list = await scheduleService.getUserSchedules(user.id);
      setData(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useSchedule(id?: string) {
  const { data: list, loading, error, refetch } = useUserSchedules();
  const schedule = list.find((s) => s.id === id);
  return { schedule, loading, error, refetch };
}

export function useCreateSchedule() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (dto: Omit<CreateProcessingScheduleDto, 'userId'>): Promise<ProcessingSchedule | null> => {
      if (!user?.id) return null;
      setLoading(true);
      setError(null);
      try {
        const fullDto: CreateProcessingScheduleDto = { ...dto, userId: user.id } as CreateProcessingScheduleDto;
        const validation: ValidateScheduleResponse = await scheduleService.validate(fullDto);
        if (!validation.valid) {
          throw new Error('Can not create new schedule');
        }
        return await scheduleService.create(fullDto);
      } catch (e: any) {
        setError('Can not create new schedule');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return { create, loading, error };
}

export function useUpdateSchedule(id: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (dto: UpdateProcessingScheduleDto): Promise<ProcessingSchedule | null> => {
      if (!user?.id) return null;
      setLoading(true);
      setError(null);
      try {
        // Validate using Create DTO shape where possible
        const toValidate: CreateProcessingScheduleDto = {
          userId: user.id,
          emailAccountId: dto.emailAccountId!,
          name: dto.name!,
          processingType: (dto.processingType as any)!,
          dateRangeFrom: dto.dateRangeFrom,
          dateRangeTo: dto.dateRangeTo,
          cronExpression: dto.cronExpression,
          timezone: dto.timezone,
          specificDates: dto.specificDates as any,
          batchSize: dto.batchSize,
          emailTypePriorities: dto.emailTypePriorities as any,
          senderPriorities: dto.senderPriorities as any,
          llmFocus: dto.llmFocus as any,
          isEnabled: dto.isEnabled,
          isDefault: dto.isDefault,
        } as any;
        const validation = await scheduleService.validate(toValidate, id);
        if (!validation.valid) {
          throw new Error('Can not create new schedule');
        }
        return await scheduleService.update(id, dto);
      } catch (e: any) {
        setError('Can not create new schedule');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, id]
  );

  return { update, loading, error };
}

export function useDeleteSchedule() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await scheduleService.remove(id);
      return !!res?.success;
    } catch (e: any) {
      setError(e?.message || 'Failed to delete schedule');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}

export function useCronCalendar() {
  const [data, setData] = useState<CronJobCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await scheduleService.getCronCalendar();
      setData(entries);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cron calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
} 