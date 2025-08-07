import {
  EmailCategory,
  Priority,
  Sentiment,
  ProcessingStatus,
  EntityType,
  ActionType,
} from '@prisma/client';

import { Email } from './email.types';

// Enhanced email analysis result interface
export interface EnhancedEmailAnalysis {
  category: EmailCategory;
  priority: Priority;
  importance_score: number; // 0-100
  priority_reasoning: string;
  scoring_breakdown: ScoringBreakdown;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  entities: EntityExtraction[];
  actionItems: ActionItem[];
}

// Scoring breakdown for detailed priority analysis
export interface ScoringBreakdown {
  base_score: number;
  time_sensitivity: number;
  content_type: number;
  sender_importance: number;
  urgency_language: number;
  user_overrides: number;
  penalties: number;
  final_score: number;
}

// Entity extraction interface
export interface EntityExtraction {
  id?: string;
  entityType: EntityType;
  entityValue: string;
  confidence: number;
  startPosition?: number;
  endPosition?: number;
  context?: string;
}

// Action item interface
export interface ActionItem {
  id?: string;
  actionType: ActionType;
  description: string;
  priority: Priority;
  dueDate?: string;
  completed?: boolean;
}

// Template configuration interface
export interface TemplateConfig {
  name: string;
  template: string;
  description: string;
}

export type ProcessedEmail = {
  messageId: string;
  emailAccountId: string;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  processingStatus: ProcessingStatus;
  category: EmailCategory;
  priority: Priority;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  importanceScore: number;
  priorityReasoning?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface EmailProcessingResult {
  success: boolean;
  error?: string;
  originalEmail?: Email;
  data?: ProcessedEmail;
}

export interface EmailBatchProcessingResult {
  processed: number;
  failed: number;
  results: EmailProcessingResult[];
}
