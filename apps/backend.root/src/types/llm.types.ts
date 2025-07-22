// LLM Processing Job
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
