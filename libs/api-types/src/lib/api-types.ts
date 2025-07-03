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

export type EmailData = components['schemas']['ExtractedEmailData'];
export type Email = components['schemas']['Email'];
export type EntityExtraction = components['schemas']['EntityExtraction'];
export type ActionItem = components['schemas']['ActionItem'];

export type ExtractedDataQueryDto = components['schemas']['ExtractedDataQueryDto'];
export type ExtractedDataResponse = components['schemas']['ExtractedDataResponse'];
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

// API utility types
export type ApiPaths = keyof paths;

// Extract request/response types for specific endpoints
export type GetExtractedDataParams = paths['/data/extracted']['get']['parameters']['query'];
export type GetExtractedDataResponse = paths['/data/extracted']['get']['responses']['200']['content']['application/json'];

export type LoginRequest = paths['/auth/login']['post']['requestBody']['content']['application/json'];
export type LoginResponse = paths['/auth/login']['post']['responses']['200']['content']['application/json'];

export type RegisterRequest = paths['/auth/register']['post']['requestBody']['content']['application/json'];
export type RegisterResponse = paths['/auth/register']['post']['responses']['201']['content']['application/json'];

export type AddAccountRequest = paths['/auth/add-account']['post']['requestBody']['content']['application/json'];
export type TestImapRequest = paths['/auth/test-imap']['post']['requestBody']['content']['application/json'];

export type UpdateActionRequest = paths['/data/emails/{emailId}/actions/{actionIndex}']['patch']['requestBody']['content']['application/json'];

export type LLMExecuteRequest = paths['/llm/execute']['post']['requestBody']['content']['application/json'];
export type LLMExecuteResponse = paths['/llm/execute']['post']['responses']['200']['content']['application/json'];

// Library metadata
export const API_TYPES_VERSION = '1.0.0';

// Helper function for development
export function apiTypes(): string {
  return 'api-types';
}
