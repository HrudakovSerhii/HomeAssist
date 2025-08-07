// LLM Processing Job
import {
  ActionType,
  EmailCategory,
  EntityType,
  Priority,
  Sentiment,
} from '@prisma/client';

interface LLMProcessingJob {
  id: string;
  emailId: string;
  userId: string;
  prompt: string;
  llmModel: string;
  status: JobStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
}

// LLM Response
interface LLMResponse {
  id: string;
  jobId: string;
  emailId: string;
  rawResponse: string;
  parsedData: any; // JSON object
  confidence: number;
  processingTimeMs: number;
  createdAt: Date;
}

enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// LLM Processing Types
export type LLMProcessingInput = {
  messageId: string;
  templateName?: string;
  modelName?: string;
  temperature?: number;
};

export type LLMRawResponse = {
  response?: string;
  message?: {
    content: string;
    role: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ParsedLLMResponse = {
  category: EmailCategory;
  priority: Priority;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  entities: {
    type: EntityType;
    value: string;
    confidence: number;
    context?: string;
  }[];
  actionItems: {
    description: string;
    actionType: ActionType;
    priority: Priority;
    dueDate?: string;
  }[];
};
