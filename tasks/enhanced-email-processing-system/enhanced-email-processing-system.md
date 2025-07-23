# Enhanced Email Processing System

## Overview
Evolution from testing solution to production-ready email processing system with bulk historical processing and automated daily processing capabilities.

## Stage 1: Historical Email Processing (Bulk Processing)

### Goal
Process emails from the last month (1500+ emails) with priority-focused analysis to highlight important emails.

### Key Features
- **Date Range Processing**: Use IMAP `SINCE` search criteria with calendar month timeframe
- **Batch Processing**: Process emails in batches of 5 with resume capability
- **Priority Enhancement**: Enhanced LLM analysis with importance scoring (0-100)
- **Default Configuration**: Automatic initial config when user adds new email account
- **Manual Trigger**: Admin UI option to execute bulk processing

### Implementation Details

#### Database Schema Changes

```sql
-- Enhanced EmailAccount table
ALTER TABLE email_accounts ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE email_accounts ADD COLUMN last_bulk_processing_at TIMESTAMP;
ALTER TABLE email_accounts ADD COLUMN bulk_processing_enabled BOOLEAN DEFAULT true;

-- New ProcessingJob table
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  job_type VARCHAR(20) NOT NULL, -- 'BULK_HISTORICAL' | 'DAILY_INCREMENTAL'
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  
  -- Configuration
  date_range_from TIMESTAMP NOT NULL,
  date_range_to TIMESTAMP,
  batch_size INTEGER DEFAULT 5,
  cron_expression VARCHAR(50), -- for DAILY_INCREMENTAL jobs
  
  -- Progress tracking
  total_batches INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  processed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  last_processed_uid VARCHAR(255),
  
  -- Retry logic
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Timestamps
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_processing_jobs_status (status),
  INDEX idx_processing_jobs_scheduled (scheduled_at),
  INDEX idx_processing_jobs_user_account (user_id, email_account_id),
  INDEX idx_processing_jobs_type_status (job_type, status)
);

-- Enhanced ProcessedEmails table
ALTER TABLE processed_emails ADD COLUMN importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100);
ALTER TABLE processed_emails ADD COLUMN priority_reasoning TEXT;
ALTER TABLE processed_emails ADD COLUMN processing_job_id UUID REFERENCES processing_jobs(id);

-- Indexes for date-based queries
CREATE INDEX idx_processed_emails_received_at ON processed_emails(received_at);
CREATE INDEX idx_processed_emails_importance_score ON processed_emails(importance_score DESC);
CREATE INDEX idx_email_accounts_last_processed_at ON email_accounts(last_processed_at);
```

#### Service Architecture

```typescript
// New ScheduledEmailProcessingService
@Injectable()
export class ScheduledEmailProcessingService {
  
  /**
   * Create bulk historical processing job for new account
   */
  async createInitialBulkProcessingJob(
    userId: string, 
    accountId: string,
    dateRange: { since: Date; before?: Date }
  ): Promise<ProcessingJob>

  /**
   * Execute bulk processing job with batch resume capability
   */
  async executeBulkProcessingJob(jobId: string): Promise<void>

  /**
   * Process single batch with retry logic and IMAP reconnection
   */
  async processBatch(
    job: ProcessingJob,
    batchEmails: EmailMessage[]
  ): Promise<BatchResult>
}

// Enhanced EmailIngestionService
export class EmailIngestionService {
  
  /**
   * Fetch emails by date range using IMAP SINCE criteria
   */
  async fetchEmailsByDateRange(
    accountId: string,
    dateRange: { since: Date; before?: Date },  
    options: { limit?: number; folder?: string }
  ): Promise<EmailMessage[]>

  /**
   * Process emails with enhanced priority scoring
   */
  async processEmailsWithPriorityScoring(
    accountId: string,
    emails: EmailMessage[],
    jobId?: string
  ): Promise<EmailBatchProcessingResult>
}

// Enhanced ImapService with connection resilience
export class ImapService {
  
  /**
   * Fetch emails with IMAP SINCE search and connection management
   */
  async fetchEmailsWithDateFilter(
    accountId: string,
    since: Date,
    before?: Date,
    limit?: number
  ): Promise<EmailMessage[]>

  /**
   * Check connection health and reconnect if needed
   * Reconnect if less than 1 minute left before 10-minute timeout
   */
  async ensureHealthyConnection(
    accountId: string,
    batchStartTime: Date
  ): Promise<void>

  /**
   * Retry connection with exponential backoff
   */
  async retryConnection(
    accountId: string,
    maxRetries: number = 3
  ): Promise<ImapFlow>
}
```

#### LLM Priority Enhancement

```typescript
// Enhanced priority analysis
interface EnhancedEmailAnalysis {
  category: EmailCategory;
  priority: Priority;
  importance_score: number; // 0-100
  priority_reasoning: string;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  entities: EntityExtraction[];
  actionItems: ActionItem[];
}

// Enhanced LLM template
const PRIORITY_ENHANCED_TEMPLATE = `
Analyze this email with enhanced priority detection and importance scoring:

IMPORTANCE SCORING RULES (0-100):
- URGENT (90-100): Overdue payments, same-day meetings, critical deadlines, emergencies
- HIGH (70-89): This week meetings, upcoming invoices, work deadlines, important personal matters
- MEDIUM (40-69): General work emails, future appointments, routine business communications
- LOW (0-39): Newsletters, marketing, automated notifications, informational content

PRIORITY BOOSTERS:
- Meeting/appointment emails: +20 points
- Invoice/payment emails: +20 points
- Time-sensitive keywords (urgent, asap, deadline, today): +15 points
- Work domain senders: +10 points
- Personal important contacts: +10 points

PRIORITY REDUCERS:
- Marketing/promotional emails: -20 points
- Automated notifications: -15 points
- Newsletter/subscription emails: -15 points
- No-reply senders: -10 points

Email Subject: {{subject}}
From: {{fromAddress}}
Received: {{receivedAt}}
Content: {{bodyText}}

Return JSON with detailed priority analysis:
{
  "category": "APPOINTMENT",
  "priority": "HIGH", 
  "importance_score": 78,
  "priority_reasoning": "Meeting invitation from work colleague scheduled for this week, requires calendar booking and preparation",
  "sentiment": "NEUTRAL",
  "summary": "Team standup meeting scheduled for Thursday 2 PM in Conference Room A",
  "tags": ["meeting", "work", "team-standup"],
  "confidence": 0.9,
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add team standup to calendar",
      "priority": "HIGH",
      "dueDate": "2024-01-25"
    }
  ]
}
`;
```

#### API Endpoints

```typescript
// Bulk processing management
@Controller('email/bulk-processing')
export class BulkProcessingController {
  
  @Post('/create-job')
  async createBulkProcessingJob(
    @Body() dto: CreateBulkProcessingJobDto
  ): Promise<ProcessingJob>

  @Post('/execute/:jobId')
  async executeBulkProcessingJob(
    @Param('jobId') jobId: string
  ): Promise<{ success: boolean; message: string }>

  @Get('/job/:jobId/status')
  async getBulkProcessingJobStatus(
    @Param('jobId') jobId: string
  ): Promise<ProcessingJobStatus>

  @Post('/job/:jobId/pause')
  async pauseBulkProcessingJob(
    @Param('jobId') jobId: string
  ): Promise<{ success: boolean }>

  @Post('/job/:jobId/resume')  
  async resumeBulkProcessingJob(
    @Param('jobId') jobId: string
  ): Promise<{ success: boolean }>
}

// DTOs
interface CreateBulkProcessingJobDto {
  userId: string;
  accountId: string;
  dateRange: {
    since: string; // ISO date
    before?: string; // ISO date
  };
  batchSize?: number; // default 5
}

interface ProcessingJobStatus {
  id: string;
  status: JobStatus;
  progress: {
    totalBatches: number;
    currentBatch: number;
    processedEmails: number;
    failedEmails: number;
    completionPercentage: number;
  };
  timing: {
    startedAt?: Date;
    estimatedCompletion?: Date;
    elapsedTime?: number;
  };
  error?: string;
}
```

---

## Stage 2: Daily Automated Processing

### Goal
Process only new emails daily at configured times, with user-specific scheduling and priority configurations.

### Key Features
- **Automated Scheduling**: NestJS `@nestjs/schedule` with cron jobs
- **Incremental Processing**: Track by `receivedAt` date using `lastProcessedAt`
- **User-Configurable**: Multiple configurations per user for different accounts
- **Non-Overlapping**: System-wide validation prevents overlapping cron jobs
- **Timezone Support**: Per-account timezone preferences

### Implementation Details

#### Database Schema Changes

```sql
-- ProcessingConfiguration table
CREATE TABLE processing_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Scheduling
  name VARCHAR(100) NOT NULL, -- e.g., "Business Stock Updates", "Personal Morning Review"
  cron_expression VARCHAR(50) NOT NULL, -- e.g., "0 6 * * *" 
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  is_enabled BOOLEAN DEFAULT true,
  
  -- Processing preferences
  batch_size INTEGER DEFAULT 5,
  email_type_priorities JSONB DEFAULT '{}', -- { "APPOINTMENT": "HIGH", "INVOICE": "HIGH" }
  sender_priorities JSONB DEFAULT '{}', -- { "boss@company.com": "HIGH" }
  llm_focus VARCHAR(50) DEFAULT 'general', -- 'general' | 'sentiment' | 'urgency'
  
  -- Metadata
  description TEXT,
  last_executed_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, name),
  INDEX idx_processing_configs_cron (cron_expression, timezone, is_enabled),
  INDEX idx_processing_configs_next_execution (next_execution_at),
  INDEX idx_processing_configs_user_account (user_id, email_account_id)
);

-- CronJobSchedule table (for overlap prevention)
CREATE TABLE cron_job_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_expression VARCHAR(50) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  next_execution_at TIMESTAMP NOT NULL,
  processing_config_id UUID REFERENCES processing_configurations(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent overlapping jobs
  UNIQUE(next_execution_at),
  INDEX idx_cron_schedule_execution_time (next_execution_at)
);
```

#### Service Architecture

```typescript
// Main scheduled processing service
@Injectable()
export class ScheduledEmailProcessingService {
  
  /**
   * Main cron job - runs every minute to check for scheduled jobs
   */
  @Cron('* * * * *') // Every minute
  async checkAndExecuteScheduledJobs(): Promise<void>

  /**
   * Execute daily processing for specific configuration
   */
  async executeIncrementalProcessing(
    configId: string
  ): Promise<ProcessingJob>

  /**
   * Process new emails since last processing
   */
  async processNewEmailsForAccount(
    accountId: string,
    config: ProcessingConfiguration
  ): Promise<EmailBatchProcessingResult>

  /**
   * Validate cron schedule doesn't overlap with existing jobs
   */
  async validateCronSchedule(
    cronExpression: string, 
    timezone: string,
    excludeConfigId?: string
  ): Promise<{ valid: boolean; conflicts?: Date[] }>
}

// Configuration management service
@Injectable() 
export class ProcessingConfigurationService {
  
  async createConfiguration(
    dto: CreateProcessingConfigDto
  ): Promise<ProcessingConfiguration>

  async updateConfiguration(
    id: string,
    dto: UpdateProcessingConfigDto
  ): Promise<ProcessingConfiguration>

  async deleteConfiguration(id: string): Promise<void>

  async getUserConfigurations(userId: string): Promise<ProcessingConfiguration[]>

  async validateConfiguration(
    dto: CreateProcessingConfigDto | UpdateProcessingConfigDto
  ): Promise<ValidationResult>
}

// Enhanced email processing with user preferences
@Injectable()
export class EnhancedEmailProcessorService extends EmailProcessorService {
  
  /**
   * Process email with user-specific priority configuration
   */
  async processEmailWithUserConfig(
    accountId: string,
    email: EmailMessage,
    config: ProcessingConfiguration
  ): Promise<EmailProcessingResult>

  /**
   * Apply user-defined priority overrides
   */
  private applyUserPriorityConfig(
    email: EmailMessage,
    analysis: EnhancedEmailAnalysis,
    config: ProcessingConfiguration
  ): EnhancedEmailAnalysis
}
```

#### API Endpoints

```typescript
@Controller('email/processing-config')
export class ProcessingConfigurationController {
  
  @Post()
  async createProcessingConfiguration(
    @Body() dto: CreateProcessingConfigDto
  ): Promise<ProcessingConfiguration>

  @Put(':id')
  async updateProcessingConfiguration(
    @Param('id') id: string,
    @Body() dto: UpdateProcessingConfigDto
  ): Promise<ProcessingConfiguration>

  @Delete(':id')
  async deleteProcessingConfiguration(
    @Param('id') id: string
  ): Promise<{ success: boolean }>

  @Get('user/:userId')
  async getUserProcessingConfigurations(
    @Param('userId') userId: string
  ): Promise<ProcessingConfiguration[]>

  @Post('validate')
  async validateProcessingConfiguration(
    @Body() dto: CreateProcessingConfigDto
  ): Promise<ValidationResult>

  @Get('cron-calendar')
  async getCronJobCalendar(): Promise<CronJobCalendarEntry[]>
}

// DTOs
interface CreateProcessingConfigDto {
  userId: string;
  emailAccountId: string;
  name: string;
  cronExpression: string; // e.g., "0 6 * * *"
  timezone: string; // e.g., "America/New_York"
  description?: string;
  batchSize?: number;
  emailTypePriorities?: Record<EmailCategory, Priority>;
  senderPriorities?: Record<string, Priority>;
  llmFocus?: 'general' | 'sentiment' | 'urgency';
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cronConflicts?: Date[];
}

interface CronJobCalendarEntry {
  configId: string;
  configName: string;
  userId: string;
  accountEmail: string;
  cronExpression: string;
  nextExecutions: Date[]; // Next 10 executions
  timezone: string;
}
```

---

## Error Handling & Resilience

### IMAP Connection Management

```typescript
interface IMAPConnectionManager {
  /**
   * Ensure healthy connection with timing awareness
   */
  async ensureHealthyConnection(
    accountId: string,
    batchStartTime: Date,
    timeoutMinutes: number = 10
  ): Promise<void> {
    const elapsed = Date.now() - batchStartTime.getTime();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const remainingMs = timeoutMs - elapsed;
    
    // Reconnect if less than 1 minute remaining
    if (remainingMs < 60000) {
      await this.retryConnection(accountId);
    }
  }

  /**
   * Retry connection with exponential backoff
   */
  async retryConnection(
    accountId: string,
    maxRetries: number = 3
  ): Promise<ImapFlow> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.closeConnection(accountId);
        return await this.createConnection(accountId);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
}
```

### Batch Processing Resilience

```typescript
interface BatchProcessingManager {
  async processBatchWithRetry(
    job: ProcessingJob,
    batchEmails: EmailMessage[]
  ): Promise<BatchResult> {
    const maxAttempts = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Track batch start time for IMAP timeout management
        const batchStartTime = new Date();
        
        // Ensure healthy IMAP connection
        await this.imapService.ensureHealthyConnection(
          job.emailAccountId, 
          batchStartTime
        );

        // Process batch
        const result = await this.processBatch(job, batchEmails);
        
        // Update job progress on success
        await this.updateJobProgress(job.id, {
          currentBatch: job.currentBatch + 1,
          processedEmails: job.processedEmails + result.processed,
          failedEmails: job.failedEmails + result.failed
        });

        return result;
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`Batch processing attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          // Wait before retry
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All attempts failed - mark batch as failed and continue
    await this.updateJobProgress(job.id, {
      currentBatch: job.currentBatch + 1,
      failedEmails: job.failedEmails + batchEmails.length,
      attemptCount: job.attemptCount + 1
    });

    throw lastError;
  }
}
```

---

## Implementation Phases

### Phase 1: Database & Core Services (Week 1-2)
- [ ] Create database migrations for ProcessingJob and ProcessingConfiguration tables
- [ ] Add indexes for date-based queries
- [ ] Implement ScheduledEmailProcessingService skeleton
- [ ] Add @nestjs/schedule dependency
- [ ] Enhance EmailIngestionService with date range filtering

### Phase 2: Stage 1 - Bulk Processing (Week 2-3)
- [ ] Implement IMAP date filtering with SINCE criteria
- [ ] Create batch processing logic with resume capability  
- [ ] Add IMAP connection resilience with timeout management
- [ ] Implement LLM priority enhancement with importance scoring
- [ ] Create bulk processing API endpoints
- [ ] Add ProcessingJob management

### Phase 3: Stage 2 - Automated Scheduling (Week 3-4)
- [ ] Implement cron job scheduling with overlap prevention
- [ ] Create ProcessingConfiguration management service
- [ ] Add timezone handling for scheduled jobs
- [ ] Implement incremental processing with lastProcessedAt tracking
- [ ] Create configuration management API endpoints

### Phase 4: Frontend Integration (Week 4-5)
- [ ] Add bulk processing configuration UI
- [ ] Create processing configuration management page
- [ ] Add cron job calendar visualization
- [ ] Implement configuration validation UI
- [ ] Add processing job status monitoring

### Phase 5: Testing & Monitoring (Week 5-6)
- [ ] Add comprehensive error logging
- [ ] Implement processing metrics collection
- [ ] Create monitoring dashboards
- [ ] Add unit and integration tests
- [ ] Performance testing with large email volumes

---

## Configuration Examples

### Business Account Configuration
```json
{
  "name": "Business Stock Updates", 
  "cronExpression": "0 * * * *", // Every hour
  "timezone": "America/New_York",
  "emailTypePriorities": {
    "NEWSLETTER": "HIGH", // Financial news
    "NOTIFICATION": "MEDIUM" // Stock alerts
  },
  "senderPriorities": {
    "bloomberg.com": "HIGH",
    "finance.yahoo.com": "HIGH"
  },
  "llmFocus": "sentiment", // Focus on market sentiment
  "batchSize": 5
}
```

### Personal Account Configuration  
```json
{
  "name": "Personal Morning Review",
  "cronExpression": "0 6 * * *", // 6 AM daily
  "timezone": "America/New_York", 
  "emailTypePriorities": {
    "APPOINTMENT": "HIGH",
    "INVOICE": "HIGH",
    "PERSONAL": "MEDIUM"
  },
  "senderPriorities": {
    "calendar@company.com": "URGENT",
    "family@gmail.com": "HIGH"
  },
  "llmFocus": "urgency", // Focus on time-sensitive items
  "batchSize": 5
}
```

---

## Success Metrics

### Stage 1 Metrics
- **Processing Speed**: 5 emails per batch, ~300 emails per hour
- **Success Rate**: >95% successful processing
- **Resume Capability**: Failed batches resume correctly
- **Priority Accuracy**: Enhanced importance scoring improves email ranking

### Stage 2 Metrics  
- **Scheduling Reliability**: 99.9% successful cron job execution
- **Incremental Processing**: Only new emails processed daily
- **Configuration Flexibility**: Support multiple configs per user
- **System Stability**: No overlapping job conflicts

### Overall System Health
- **IMAP Resilience**: <1% connection failures with retry logic
- **Processing Throughput**: Handle 10,000+ emails daily across all users
- **Resource Efficiency**: Batch processing limits system load
- **User Satisfaction**: Priority-based email dashboard improves workflow

---

## Future Enhancements (Post-MVP)

1. **Advanced Priority Scoring**: Machine learning model for personalized importance
2. **Smart Scheduling**: Dynamic scheduling based on email volume patterns  
3. **Real-time Processing**: WebSocket updates for critical emails
4. **Multi-Account Coordination**: Cross-account priority balancing
5. **Email Thread Analysis**: Context-aware processing for email conversations
6. **Performance Analytics**: User behavior insights and optimization recommendations

---

*This feature document serves as the implementation roadmap for transforming the email processing system from a testing solution to a production-ready, scalable email intelligence platform.* 