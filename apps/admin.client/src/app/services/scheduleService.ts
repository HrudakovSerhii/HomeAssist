import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../../configuration';
import {
  CreateProcessingScheduleDto,
  UpdateProcessingScheduleDto,
  ProcessingSchedule,
  ProcessingScheduleWithAccount,
  ValidateScheduleResponse,
  CronJobCalendarEntry,
} from '@home-assist/api-types';

export class ScheduleService {
  async getUserSchedules(userId: string): Promise<ProcessingScheduleWithAccount[]> {
    const url = `${API_ENDPOINTS.schedules.list}?${new URLSearchParams({ userId }).toString()}`;
    return apiClient.get<ProcessingScheduleWithAccount[]>(url);
  }

  async create(dto: CreateProcessingScheduleDto): Promise<ProcessingSchedule> {
    return apiClient.post<ProcessingSchedule, CreateProcessingScheduleDto>(
      API_ENDPOINTS.schedules.create,
      dto
    );
  }

  async update(id: string, dto: UpdateProcessingScheduleDto): Promise<ProcessingSchedule> {
    return apiClient.put<ProcessingSchedule>(API_ENDPOINTS.schedules.update(id), dto);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(API_ENDPOINTS.schedules.remove(id));
  }

  async validate(dto: CreateProcessingScheduleDto, excludeId?: string): Promise<ValidateScheduleResponse> {
    const url = excludeId
      ? `${API_ENDPOINTS.schedules.validate}?${new URLSearchParams({ excludeId }).toString()}`
      : API_ENDPOINTS.schedules.validate;
    return apiClient.post<ValidateScheduleResponse, CreateProcessingScheduleDto>(url, dto);
  }

  async getCronCalendar(): Promise<CronJobCalendarEntry[]> {
    return apiClient.get<CronJobCalendarEntry[]>(API_ENDPOINTS.schedules.cronCalendar);
  }
}

export const scheduleService = new ScheduleService(); 