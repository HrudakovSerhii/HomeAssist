// This file will export custom utilities and re-export generated types
// The actual implementation will be added after running the type generation script

// Import the generated types
import type { components, paths, operations } from './generated-types';

// Re-export commonly used types with simpler names
export type { components, paths, operations } from './generated-types';

// Extract specific schemas for easier use
export type User = components['schemas']['User'];
export type CreateUserDto = components['schemas']['CreateUserDto'];
export type LoginDto = components['schemas']['LoginDto'];
export type AuthResponse = components['schemas']['AuthResponse'];

export type AddEmailAccountDto = components['schemas']['AddEmailAccountDto'];
export type TestImapDto = components['schemas']['TestImapDto'];
export type ImapTestResponse = components['schemas']['ImapTestResponse'];
export type EmailAccount = components['schemas']['EmailAccount'];
export type UserAccountsResponse =
  components['schemas']['UserAccountsResponse'];

export type ProcessedEmails = components['schemas']['ProcessedEmails'];
export type EntityExtraction = components['schemas']['EntityExtraction'];
export type ActionItem = components['schemas']['ActionItem'];

export type ProcessedEmailsQueryDto =
  components['schemas']['ProcessedEmailsQueryDto'];
export type ProcessedEmailsResponse =
  components['schemas']['ProcessedEmailsResponse'];
export type FilterOptions = components['schemas']['FilterOptions'];
export type Pagination = components['schemas']['Pagination'];
export type UpdateActionItemDto = components['schemas']['UpdateActionItemDto'];

export type HealthResponse = components['schemas']['HealthResponse'];
export type LLMExecuteDto = components['schemas']['LLMExecuteDto'];
export type LLMResponse = components['schemas']['LLMResponse'];
export type AppResponse = components['schemas']['AppResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

// Enums
export type EmailCategory = components['schemas']['EmailCategory'];
export type Priority = components['schemas']['Priority'];
export type Sentiment = components['schemas']['Sentiment'];
export type EntityType = components['schemas']['EntityType'];
export type ActionType = components['schemas']['ActionType'];
export type ProcessingStatus = components['schemas']['ProcessingStatus'];

// DTOs
export type IngestEmailsDto = components['schemas']['IngestEmailsDto'];
export type IngestUserEmailsDto = components['schemas']['IngestUserEmailsDto'];
export type ProcessEmailDto = components['schemas']['ProcessEmailDto'];
export type ProcessBatchDto = components['schemas']['ProcessBatchDto'];
export type EmailIngestionResponse =
  components['schemas']['EmailIngestionResponse'];
export type ProcessingStatusResponse =
  components['schemas']['ProcessingStatusResponse'];
export type EmailIngestionProgress =
  components['schemas']['EmailIngestionProgress'];
export type EmailIngestionStage = components['schemas']['EmailIngestionStage'];

// Schedule-related types
export type ProcessingType = components['schemas']['ProcessingType'];
export type LlmFocus = components['schemas']['LlmFocus'];
export type CreateProcessingScheduleDto = components['schemas']['CreateProcessingScheduleDto'];
export type UpdateProcessingScheduleDto = components['schemas']['UpdateProcessingScheduleDto'];
export type ProcessingSchedule = components['schemas']['ProcessingSchedule'];
export type ProcessingScheduleWithAccount = components['schemas']['ProcessingScheduleWithAccount'];
export type ValidationResult = components['schemas']['ValidationResult'];
export type ScheduleExecutionStatus = components['schemas']['ScheduleExecutionStatus'];
export type CronJobCalendarEntry = components['schemas']['CronJobCalendarEntry'];
export type ProcessingAnalytics = components['schemas']['ProcessingAnalytics'];
export type BulkUpdateResponse = components['schemas']['BulkUpdateResponse'];

// API utility types
export type ApiPaths = keyof paths;

// Extract request/response types for specific endpoints
export type GetProcessedEmailsParams =
  paths['/data/processed-emails']['get']['parameters']['query'];
export type GetProcessedEmailsResponse =
  paths['/data/processed-emails']['get']['responses']['200']['content']['application/json'];

export type LoginRequest =
  paths['/auth/login']['post']['requestBody']['content']['application/json'];
export type LoginResponse =
  paths['/auth/login']['post']['responses']['200']['content']['application/json'];

export type RegisterRequest =
  paths['/auth/register']['post']['requestBody']['content']['application/json'];
export type RegisterResponse =
  paths['/auth/register']['post']['responses']['201']['content']['application/json'];

export type AddAccountRequest =
  paths['/auth/add-account']['post']['requestBody']['content']['application/json'];
export type AddAccountResponse =
  paths['/auth/add-account']['post']['responses']['201']['content']['application/json'];
export type TestImapRequest =
  paths['/auth/test-imap']['post']['requestBody']['content']['application/json'];

export type GetAccountsResponse =
  paths['/auth/accounts']['get']['responses']['200']['content']['application/json'];

export type UpdateActionRequest =
  paths['/data/emails/{emailId}/actions/{actionIndex}']['patch']['requestBody']['content']['application/json'];

export type LLMExecuteRequest =
  paths['/llm/execute']['post']['requestBody']['content']['application/json'];
export type LLMExecuteResponse =
  paths['/llm/execute']['post']['responses']['200']['content']['application/json'];

// Schedule endpoints utility types
export type GetSchedulesResponse = paths['/processing-schedules']['get']['responses']['200']['content']['application/json'];
export type CreateScheduleRequest = paths['/processing-schedules']['post']['requestBody']['content']['application/json'];
export type CreateScheduleResponse = paths['/processing-schedules']['post']['responses']['201']['content']['application/json'];
export type UpdateScheduleRequest = paths['/processing-schedules/{id}']['put']['requestBody']['content']['application/json'];
export type UpdateScheduleResponse = paths['/processing-schedules/{id}']['put']['responses']['200']['content']['application/json'];
export type ValidateScheduleRequest = paths['/processing-schedules/validate']['post']['requestBody']['content']['application/json'];
export type ValidateScheduleResponse = paths['/processing-schedules/validate']['post']['responses']['200']['content']['application/json'];
export type DeleteScheduleResponse = paths['/processing-schedules/{id}']['delete']['responses']['200']['content']['application/json'];

// Library metadata
export const API_TYPES_VERSION = '1.0.0';

// Helper function for development
export function apiTypes(): string {
  return 'api-types';
}
