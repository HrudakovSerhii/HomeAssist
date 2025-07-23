# Enhanced Email Processing - Backend Implementation

## Overview
Unified email processing system with single job scheduling engine that handles all types of email processing (historical date ranges, recurring schedules, specific dates) through one comprehensive cron-based system.

## Architecture Principles

### Unified Job System
- **Single execution engine** for all processing types
- **Schedule-driven processing**: Historical vs recurring is just configuration difference
- **Auto-generated default schedules** for new email accounts
- **User-configurable priorities** and processing preferences

---

## Database Schema

### Core Tables

```sql
-- Enhanced EmailAccount table  
ALTER TABLE email_accounts ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE email_accounts ADD COLUMN has_initial_schedule BOOLEAN DEFAULT false;

-- Main ProcessingSchedule table (replaces separate job types)
CREATE TABLE processing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Schedule Identity
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- for auto-created "Initial" schedules
  
  -- Processing Type & Configuration
  processing_type VARCHAR(20) NOT NULL, -- 'DATE_RANGE' | 'RECURRING' | 'SPECIFIC_DATES'
  
  -- Date Range Processing (for historical emails)
  date_range_from TIMESTAMP,
  date_range_to TIMESTAMP,
  
  -- Recurring Processing (for daily/weekly schedules)
  cron_expression VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Specific Dates Processing
  specific_dates JSONB, -- Array of ISO date strings
  
  -- Processing Preferences
  batch_size INTEGER DEFAULT 5,
  email_type_priorities JSONB DEFAULT '{}', -- { "APPOINTMENT": "HIGH", "INVOICE": "HIGH" }
  sender_priorities JSONB DEFAULT '{}', -- { "boss@company.com": "HIGH" }
  llm_focus VARCHAR(50) DEFAULT 'general', -- 'general' | 'sentiment' | 'urgency'
  
  -- Execution Tracking
  last_executed_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints & Indexes
  UNIQUE(user_id, name),
  INDEX idx_schedules_execution (next_execution_at, is_enabled),
  INDEX idx_schedules_user_account (user_id, email_account_id),
  INDEX idx_schedules_type (processing_type, is_enabled)
);

-- Job Execution History (for monitoring and debugging)
CREATE TABLE schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES processing_schedules(id) ON DELETE CASCADE,
  
  -- Execution Details
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Progress Tracking
  total_batches INTEGER DEFAULT 0,
  completed_batches INTEGER DEFAULT 0,
  total_emails INTEGER DEFAULT 0,  
  processed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  last_processed_uid VARCHAR(255),
  
  -- Error Handling
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  error_details JSONB,
  
  -- Performance Metrics
  processing_duration_ms INTEGER,
  average_email_processing_time_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_executions_schedule_status (schedule_id, status),
  INDEX idx_executions_started_at (started_at),
  INDEX idx_executions_status (status)
);

-- Enhanced ProcessedEmails table
ALTER TABLE processed_emails ADD COLUMN importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100);
ALTER TABLE processed_emails ADD COLUMN priority_reasoning TEXT;
ALTER TABLE processed_emails ADD COLUMN schedule_execution_id UUID REFERENCES schedule_executions(id);

-- Cron Job Registry (prevents overlapping executions)
CREATE TABLE cron_job_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time TIMESTAMP NOT NULL,
  schedule_ids UUID[] NOT NULL, -- Array of schedule IDs executing at this time
  is_locked BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent exact time conflicts
  UNIQUE(execution_time),
  INDEX idx_cron_registry_time (execution_time)
);

-- Indexes for performance
CREATE INDEX idx_processed_emails_received_at ON processed_emails(received_at);
CREATE INDEX idx_processed_emails_importance_score ON processed_emails(importance_score DESC);
CREATE INDEX idx_email_accounts_last_processed_at ON email_accounts(last_processed_at);
```

---

## Service Architecture

### 1. Core Scheduling Service

```typescript
@Injectable()
export class UnifiedSchedulingService {
  
  /**
   * Main cron job - runs every minute to check for scheduled executions
   */
  @Cron('* * * * *')
  async checkAndExecuteScheduledJobs(): Promise<void> {
    const now = new Date();
    
    // Find schedules ready for execution
    const readySchedules = await this.findSchedulesReadyForExecution(now);
    
    // Group by execution time to prevent conflicts
    const executionGroups = this.groupSchedulesByExecutionTime(readySchedules);
    
    // Execute each group
    for (const [executionTime, schedules] of executionGroups) {
      await this.executeScheduleGroup(executionTime, schedules);
    }
  }

  /**
   * Execute a group of schedules at the same time with proper locking
   */
  private async executeScheduleGroup(
    executionTime: Date, 
    schedules: ProcessingSchedule[]
  ): Promise<void> {
    const scheduleIds = schedules.map(s => s.id);
    
    // Lock execution time to prevent conflicts
    const lockAcquired = await this.acquireExecutionLock(executionTime, scheduleIds);
    if (!lockAcquired) {
      this.logger.warn(`Execution time ${executionTime} already locked, skipping ${schedules.length} schedules`);
      return;
    }

    this.logger.log(`Executing ${schedules.length} schedules at ${executionTime.toISOString()}`);

    try {
      // Execute schedules in parallel with error isolation
      const executions = schedules.map(async (schedule) => {
        try {
          const execution = await this.executeSchedule(schedule);
          this.logger.log(`Successfully executed schedule: ${schedule.name} (${execution.id})`);
          return { schedule, execution, success: true };
        } catch (error) {
          this.logger.error(`Failed to execute schedule: ${schedule.name}`, error);
          return { schedule, error, success: false };
        }
      });
      
      const results = await Promise.allSettled(executions);
      
      // Log execution summary
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
      
      this.logger.log(`Execution group completed: ${successful} successful, ${failed} failed`);
      
    } finally {
      // Always release the lock
      await this.releaseExecutionLock(executionTime);
    }
  }

  /**
   * Acquire execution lock for specific time and schedules
   */
  private async acquireExecutionLock(
    executionTime: Date, 
    scheduleIds: string[]
  ): Promise<boolean> {
    try {
      await this.prisma.cronJobRegistry.create({
        data: {
          executionTime,
          scheduleIds,
          isLocked: true
        }
      });
      
      this.logger.debug(`Acquired execution lock for ${executionTime.toISOString()}`);
      return true;
      
    } catch (error) {
      if (error.code === 'P2002') { // Unique constraint violation
        this.logger.warn(`Execution time ${executionTime.toISOString()} already locked`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Release execution lock
   */
  private async releaseExecutionLock(executionTime: Date): Promise<void> {
    try {
      await this.prisma.cronJobRegistry.delete({
        where: { executionTime }
      });
      
      this.logger.debug(`Released execution lock for ${executionTime.toISOString()}`);
      
    } catch (error) {
      this.logger.error(`Failed to release execution lock for ${executionTime.toISOString()}:`, error);
    }
  }

  /**
   * Execute a single processing schedule
   */
  async executeSchedule(schedule: ProcessingSchedule): Promise<ScheduleExecution> {
    const execution = await this.createScheduleExecution(schedule);
    
    try {
      this.logger.log(`Starting execution for schedule: ${schedule.name}`);
      
      // Determine date range based on schedule type
      const dateRange = await this.calculateDateRangeForSchedule(schedule);
      
      // Fetch emails for processing
      const emails = await this.fetchEmailsForSchedule(schedule, dateRange);
      
      // Process emails in batches
      const results = await this.processEmailsInBatches(schedule, emails, execution);
      
      // Update execution as completed
      await this.completeScheduleExecution(execution, results);
      
      // Update schedule's next execution time
      await this.updateScheduleNextExecution(schedule);
      
      return execution;
      
    } catch (error) {
      await this.failScheduleExecution(execution, error);
      throw error;
    }
  }

  /**
   * Calculate date range based on schedule type
   */
  private async calculateDateRangeForSchedule(
    schedule: ProcessingSchedule
  ): Promise<{ since: Date; before?: Date }> {
    switch (schedule.processingType) {
      case 'DATE_RANGE':
        return {
          since: schedule.dateRangeFrom,
          before: schedule.dateRangeTo
        };
        
      case 'RECURRING':
        // For recurring schedules, process emails since last execution
        const lastExecution = await this.getLastSuccessfulExecution(schedule.id);
        const since = lastExecution?.completedAt || schedule.createdAt;
        return { since, before: new Date() };
        
      case 'SPECIFIC_DATES':
        // Process emails from the next specific date
        const nextDate = this.getNextSpecificDate(schedule);
        return {
          since: nextDate,
          before: new Date(nextDate.getTime() + 24 * 60 * 60 * 1000) // +1 day
        };
        
      default:
        throw new Error(`Unsupported processing type: ${schedule.processingType}`);
    }
  }
}
```

### 2. Enhanced Email Processing Service

```typescript
@Injectable()
export class EnhancedEmailProcessingService extends EmailIngestionService {
  
  /**
   * Process emails with user-specific schedule configuration
   */
  async processEmailsWithScheduleConfig(
    schedule: ProcessingSchedule,
    emails: EmailMessage[],
    execution: ScheduleExecution
  ): Promise<EmailBatchProcessingResult> {
    const results: EmailBatchProcessingResult = {
      processed: 0,
      failed: 0,
      results: []
    };

    // Process in batches according to schedule configuration
    const batchSize = schedule.batchSize || 5;
    const batches = this.chunkArray(emails, batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = new Date();
      
      try {
        // Ensure healthy IMAP connection before batch
        await this.imapService.ensureHealthyConnection(
          schedule.emailAccountId, 
          batchStartTime
        );

        // Process batch with schedule-specific configuration
        const batchResults = await this.processBatchWithScheduleConfig(
          schedule, 
          batch, 
          execution.id
        );
        
        // Update results
        results.processed += batchResults.processed;
        results.failed += batchResults.failed;
        results.results.push(...batchResults.results);
        
        // Update execution progress
        await this.updateExecutionProgress(execution.id, {
          completedBatches: i + 1,
          processedEmails: results.processed,
          failedEmails: results.failed
        });
        
      } catch (batchError) {
        this.logger.error(`Batch ${i + 1} failed:`, batchError);
        results.failed += batch.length;
        
        // Continue with next batch (resilient processing)
        continue;
      }
    }

    return results;
  }

  /**
   * Process single batch with schedule-specific LLM configuration
   */
  private async processBatchWithScheduleConfig(
    schedule: ProcessingSchedule,
    emails: EmailMessage[],
    executionId: string
  ): Promise<EmailBatchProcessingResult> {
    const results = [];
    
    for (const email of emails) {
      try {
        // Apply user-defined priority configuration before LLM processing
        const preprocessedEmail = this.applyUserPriorityPreprocessing(email, schedule);
        
        // Process with LLM (enhanced with schedule preferences)
        const llmResult = await this.processEmailWithEnhancedPriority(
          schedule.emailAccountId,
          preprocessedEmail,
          schedule
        );
        
        // Apply post-processing priority adjustments
        const finalResult = this.applyUserPriorityPostprocessing(llmResult, schedule);
        
        // Store with execution tracking
        const processedEmail = await this.storeProcessedEmail(
          finalResult, 
          executionId
        );
        
        results.push({
          messageId: email.messageId,
          subject: email.subject,
          success: true,
          processedEmail
        });
        
      } catch (error) {
        this.logger.error(`Failed to process email ${email.messageId}:`, error);
        results.push({
          messageId: email.messageId,
          subject: email.subject,
          success: false,
          error: error.message
        });
      }
    }

    return {
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Apply user-defined priority rules before LLM processing
   */
  private applyUserPriorityPreprocessing(
    email: EmailMessage, 
    schedule: ProcessingSchedule
  ): EmailMessage {
    // Check sender priorities
    const senderPriorities = schedule.senderPriorities || {};
    const senderDomain = email.from.split('@')[1];
    
    if (senderPriorities[email.from] || senderPriorities[senderDomain]) {
      // Add priority hints to email for LLM processing
      email.priorityHints = {
        senderPriority: senderPriorities[email.from] || senderPriorities[senderDomain],
        userConfiguredSender: true
      };
    }
    
    return email;
  }

  /**
   * Enhanced LLM processing with schedule-specific focus
   */
  private async processEmailWithEnhancedPriority(
    accountId: string,
    email: EmailMessage,
    schedule: ProcessingSchedule
  ): Promise<EmailProcessingResult> {
    // Select template based on LLM focus preference
    const templateName = this.selectTemplateByFocus(schedule.llmFocus);
    
    // Generate enhanced prompt with priority scoring
    const prompt = this.generateEnhancedPriorityPrompt(email, schedule);
    
    // Process with LLM
    const llmResponse = await this.llmService.executeChat(
      prompt,
      config().llm.defaultModel,
      'local',
      { temperature: 0.1 }
    );
    
    // Parse response with importance scoring
    const analysis = await this.parseEnhancedLLMResponse(llmResponse.response);
    
    return {
      messageId: email.messageId,
      subject: email.subject,
      success: true,
      analysis
    };
  }
}
```

### 3. Schedule Management Service

```typescript
@Injectable()
export class ScheduleManagementService {
  
  /**
   * Create default "Initial" schedule when user adds first email account
   */
  async createDefaultScheduleForNewAccount(
    userId: string, 
    accountId: string
  ): Promise<ProcessingSchedule> {
    // Check if user already has default schedule for this account
    const existingDefault = await this.prisma.processingSchedule.findFirst({
      where: { 
        userId, 
        emailAccountId: accountId, 
        isDefault: true 
      }
    });
    
    if (existingDefault) {
      return existingDefault;
    }

    // Create default "Initial" schedule (1 month historical processing)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const defaultSchedule = await this.prisma.processingSchedule.create({
      data: {
        userId,
        emailAccountId: accountId,
        name: 'Initial',
        description: 'Initial processing of historical emails from the past month',
        isDefault: true,
        processingType: 'DATE_RANGE',
        dateRangeFrom: oneMonthAgo,
        dateRangeTo: new Date(),
        batchSize: 5,
        emailTypePriorities: {
          APPOINTMENT: 'HIGH',
          INVOICE: 'HIGH',
          WORK: 'MEDIUM'
        },
        llmFocus: 'general'
      }
    });

    // Mark account as having initial schedule
    await this.prisma.emailAccount.update({
      where: { id: accountId },
      data: { hasInitialSchedule: true }
    });

    return defaultSchedule;
  }

  /**
   * Create user-defined processing schedule
   */
  async createProcessingSchedule(
    dto: CreateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate schedule configuration
    await this.validateScheduleConfiguration(dto);
    
    // Check for conflicts if recurring schedule
    if (dto.processingType === 'RECURRING') {
      await this.validateCronScheduleConflicts(dto.cronExpression, dto.timezone);
    }
    
    // Calculate next execution time
    const nextExecution = this.calculateNextExecutionTime(dto);
    
    const schedule = await this.prisma.processingSchedule.create({
      data: {
        ...dto,
        nextExecutionAt: nextExecution
      }
    });
    
    this.logger.log(`Created processing schedule: ${schedule.name}`);
    return schedule;
  }

  /**
   * Update existing processing schedule
   */
  async updateProcessingSchedule(
    id: string, 
    dto: UpdateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate updated configuration
    await this.validateScheduleConfiguration(dto, id);
    
    // Recalculate next execution if timing changed
    let nextExecution = undefined;
    if (dto.cronExpression || dto.timezone || dto.specificDates) {
      nextExecution = this.calculateNextExecutionTime(dto);
    }
    
    const schedule = await this.prisma.processingSchedule.update({
      where: { id },
      data: {
        ...dto,
        nextExecutionAt: nextExecution,
        updatedAt: new Date()
      }
    });
    
    this.logger.log(`Updated processing schedule: ${schedule.name}`);
    return schedule;
  }

  /**
   * Validate schedule configuration for conflicts and correctness
   */
  async validateScheduleConfiguration(
    dto: CreateProcessingScheduleDto | UpdateProcessingScheduleDto,
    excludeId?: string
  ): Promise<ValidationResult> {
    const errors = [];
    const warnings = [];
    const cronConflicts = [];
    
    // Validate processing type specific fields
    switch (dto.processingType) {
      case 'DATE_RANGE':
        if (!dto.dateRangeFrom) {
          errors.push('Date range start is required');
        }
        if (dto.dateRangeFrom && dto.dateRangeTo && new Date(dto.dateRangeFrom) > new Date(dto.dateRangeTo)) {
          errors.push('Date range start must be before end date');
        }
        if (dto.dateRangeFrom && new Date(dto.dateRangeFrom) > new Date()) {
          warnings.push('Date range starts in the future - no historical emails will be processed');
        }
        break;
        
      case 'RECURRING':
        if (!dto.cronExpression) {
          errors.push('Cron expression is required for recurring schedules');
        } else {
          if (!this.isValidCronExpression(dto.cronExpression)) {
            errors.push('Invalid cron expression format');
          } else {
            // Check for execution time conflicts
            const conflicts = await this.checkCronExecutionConflicts(
              dto.cronExpression, 
              dto.timezone || 'UTC',
              excludeId
            );
            
            if (conflicts.length > 0) {
              errors.push('Schedule conflicts with existing executions at the same time');
              cronConflicts.push(...conflicts);
            }
          }
        }
        
        if (!dto.timezone) {
          warnings.push('No timezone specified, using UTC as default');
        }
        break;
        
      case 'SPECIFIC_DATES':
        if (!dto.specificDates || dto.specificDates.length === 0) {
          errors.push('At least one specific date is required');
        } else {
          // Check if specific dates conflict with existing executions
          const dateConflicts = await this.checkSpecificDateConflicts(
            dto.specificDates.map(d => new Date(d)),
            excludeId
          );
          
          if (dateConflicts.length > 0) {
            errors.push('Some specific dates conflict with existing scheduled executions');
            cronConflicts.push(...dateConflicts.map(date => ({
              conflictTime: date,
              conflictingSchedules: [],
              suggestedAlternatives: this.suggestAlternativeExecutionTimes(date)
            })));
          }
          
          // Validate dates are not in the past
          const pastDates = dto.specificDates.filter(d => new Date(d) < new Date());
          if (pastDates.length > 0) {
            warnings.push(`${pastDates.length} specific dates are in the past and will not be executed`);
          }
        }
        break;
    }
    
    // Validate name uniqueness for user
    if (dto.name) {
      const existing = await this.prisma.processingSchedule.findFirst({
        where: { 
          userId: dto.userId, 
          name: dto.name,
          ...(excludeId && { id: { not: excludeId } })
        }
      });
      
      if (existing) {
        errors.push('Schedule name must be unique for this user');
      }
    }
    
    // Validate email account exists and belongs to user
    if (dto.emailAccountId) {
      const account = await this.prisma.emailAccount.findFirst({
        where: {
          id: dto.emailAccountId,
          userId: dto.userId,
          isActive: true
        }
      });
      
      if (!account) {
        errors.push('Email account not found or not accessible');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cronConflicts
    };
  }

  /**
   * Check for cron execution time conflicts with existing schedules
   */
  async checkCronExecutionConflicts(
    cronExpression: string,
    timezone: string,
    excludeScheduleId?: string
  ): Promise<Array<{ conflictTime: Date; conflictingSchedules: string[]; suggestedAlternatives: Date[] }>> {
    // Calculate next 10 execution times for this cron expression
    const nextExecutions = this.calculateNextExecutions(cronExpression, timezone, 10);
    const conflicts = [];
    
    for (const executionTime of nextExecutions) {
      // Check if this execution time is already locked
      const existingLock = await this.prisma.cronJobRegistry.findUnique({
        where: { executionTime }
      });
      
      if (existingLock) {
        // Get details of conflicting schedules
        const conflictingSchedules = await this.prisma.processingSchedule.findMany({
          where: { 
            id: { in: existingLock.scheduleIds },
            ...(excludeScheduleId && { id: { not: excludeScheduleId } })
          },
          select: { id: true, name: true, userId: true }
        });
        
        if (conflictingSchedules.length > 0) {
          conflicts.push({
            conflictTime: executionTime,
            conflictingSchedules: conflictingSchedules.map(s => s.name),
            suggestedAlternatives: this.suggestAlternativeExecutionTimes(executionTime)
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check for conflicts with specific dates
   */
  async checkSpecificDateConflicts(
    specificDates: Date[],
    excludeScheduleId?: string
  ): Promise<Date[]> {
    const conflicts = [];
    
    for (const date of specificDates) {
      const existingLock = await this.prisma.cronJobRegistry.findUnique({
        where: { executionTime: date }
      });
      
      if (existingLock) {
        // Check if any non-excluded schedules are using this time
        const conflictingSchedules = await this.prisma.processingSchedule.findMany({
          where: { 
            id: { in: existingLock.scheduleIds },
            ...(excludeScheduleId && { id: { not: excludeScheduleId } })
          }
        });
        
        if (conflictingSchedules.length > 0) {
          conflicts.push(date);
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Suggest alternative execution times when conflicts occur
   */
  suggestAlternativeExecutionTimes(conflictTime: Date): Date[] {
    const alternatives = [];
    const baseTime = new Date(conflictTime);
    
    // Suggest times 5, 10, 15 minutes before and after
    const offsets = [-15, -10, -5, 5, 10, 15];
    
    for (const offset of offsets) {
      const alternativeTime = new Date(baseTime.getTime() + offset * 60 * 1000);
      alternatives.push(alternativeTime);
    }
    
    return alternatives;
  }

  /**
   * Calculate next execution times for cron expression
   */
  private calculateNextExecutions(
    cronExpression: string, 
    timezone: string, 
    count: number
  ): Date[] {
    // This would use a cron parsing library like 'cron-parser'
    // For now, showing the structure
    const parser = require('cron-parser');
    const interval = parser.parseExpression(cronExpression, { 
      currentDate: new Date(),
      tz: timezone 
    });
    
    const executions = [];
    for (let i = 0; i < count; i++) {
      executions.push(interval.next().toDate());
    }
    
    return executions;
  }
}
```

---

## API Endpoints

### Processing Schedules Controller

```typescript
@Controller('api/processing-schedules')
export class ProcessingSchedulesController {
  
  @Get()
  async getUserProcessingSchedules(
    @Query('userId') userId: string
  ): Promise<ProcessingSchedule[]> {
    return this.scheduleService.getUserSchedules(userId);
  }

  @Post()
  async createProcessingSchedule(
    @Body() dto: CreateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate schedule configuration and check for conflicts
    const validation = await this.scheduleService.validateScheduleConfiguration(dto);
    
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Schedule validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
        cronConflicts: validation.cronConflicts
      });
    }

    return this.scheduleService.createProcessingSchedule(dto);
  }

  @Put(':id')
  async updateProcessingSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate updated schedule configuration and check for conflicts
    const validation = await this.scheduleService.validateScheduleConfiguration(dto, id);
    
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Schedule validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
        cronConflicts: validation.cronConflicts
      });
    }

    return this.scheduleService.updateProcessingSchedule(id, dto);
  }

  @Delete(':id')
  async deleteProcessingSchedule(
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    await this.scheduleService.deleteProcessingSchedule(id);
    return { success: true };
  }

  @Post(':id/execute')
  async executeScheduleManually(
    @Param('id') id: string
  ): Promise<{ success: boolean; executionId: string }> {
    const execution = await this.schedulingService.executeScheduleById(id);
    return { success: true, executionId: execution.id };
  }

  @Get(':id/status')
  async getScheduleExecutionStatus(
    @Param('id') id: string
  ): Promise<ScheduleExecutionStatus> {
    return this.scheduleService.getScheduleExecutionStatus(id);
  }

  @Post('validate')
  async validateScheduleConfiguration(
    @Body() dto: CreateProcessingScheduleDto,
    @Query('excludeId') excludeId?: string
  ): Promise<ValidationResult> {
    return this.scheduleService.validateScheduleConfiguration(dto, excludeId);
  }

  @Post('check-conflicts')
  async checkScheduleConflicts(
    @Body() body: { 
      cronExpression: string; 
      timezone: string; 
      specificDates?: string[];
      excludeId?: string; 
    }
  ): Promise<{
    hasConflicts: boolean;
    conflicts: {
      conflictTime: Date;
      conflictingSchedules: string[];
      suggestedAlternatives: Date[];
    }[];
  }> {
    const conflicts = [];
    
    // Check cron expression conflicts
    if (body.cronExpression) {
      const cronConflicts = await this.scheduleService.checkCronExecutionConflicts(
        body.cronExpression,
        body.timezone,
        body.excludeId
      );
      conflicts.push(...cronConflicts);
    }
    
    // Check specific date conflicts
    if (body.specificDates) {
      const dateConflicts = await this.scheduleService.checkSpecificDateConflicts(
        body.specificDates.map(d => new Date(d)),
        body.excludeId
      );
      
      conflicts.push(...dateConflicts.map(date => ({
        conflictTime: date,
        conflictingSchedules: [],
        suggestedAlternatives: this.scheduleService.suggestAlternativeExecutionTimes(date)
      })));
    }
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  @Get('cron-calendar')
  async getCronJobCalendar(): Promise<CronJobCalendarEntry[]> {
    return this.scheduleService.getCronJobCalendar();
  }
}
```

### DTOs

```typescript
// Main schedule creation DTO
export class CreateProcessingScheduleDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  emailAccountId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['DATE_RANGE', 'RECURRING', 'SPECIFIC_DATES'])
  processingType: 'DATE_RANGE' | 'RECURRING' | 'SPECIFIC_DATES';

  // Date Range fields
  @ValidateIf(o => o.processingType === 'DATE_RANGE')
  @IsDateString()
  dateRangeFrom?: string;

  @ValidateIf(o => o.processingType === 'DATE_RANGE')
  @IsOptional()
  @IsDateString()
  dateRangeTo?: string;

  // Recurring fields
  @ValidateIf(o => o.processingType === 'RECURRING')
  @IsString()
  cronExpression?: string;

  @ValidateIf(o => o.processingType === 'RECURRING')
  @IsString()
  timezone?: string;

  // Specific dates fields
  @ValidateIf(o => o.processingType === 'SPECIFIC_DATES')
  @IsArray()
  @IsDateString({ each: true })
  specificDates?: string[];

  // Processing preferences
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  batchSize?: number;

  @IsOptional()
  @IsObject()
  emailTypePriorities?: Record<string, string>;

  @IsOptional()
  @IsObject()
  senderPriorities?: Record<string, string>;

  @IsOptional()
  @IsEnum(['general', 'sentiment', 'urgency'])
  llmFocus?: 'general' | 'sentiment' | 'urgency';
}

export class UpdateProcessingScheduleDto extends PartialType(CreateProcessingScheduleDto) {}

// Response DTOs
export interface ScheduleExecutionStatus {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: {
    totalBatches: number;
    completedBatches: number;
    totalEmails: number;
    processedEmails: number;
    failedEmails: number;
    completionPercentage: number;
  };
  timing: {
    startedAt: Date;
    completedAt?: Date;
    estimatedCompletion?: Date;
    processingDuration?: number;
  };
  error?: {
    message: string;
    details?: any;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cronConflicts?: {
    conflictTime: Date;
    conflictingSchedules: string[];
    suggestedAlternatives: Date[];
  }[];
}
```

---

## Enhanced LLM Priority Analysis

### Priority-Focused Template

```typescript
const ENHANCED_PRIORITY_TEMPLATE = `
Analyze this email with comprehensive priority scoring and importance assessment:

IMPORTANCE SCORING RULES (0-100):
- CRITICAL (90-100): Same-day deadlines, overdue payments, emergency situations, urgent meetings
- HIGH (70-89): This week meetings, pending invoices, work deadlines, important decisions needed
- MEDIUM (40-69): General work communications, future appointments, routine business matters
- LOW (0-39): Newsletters, marketing, automated notifications, informational content

PRIORITY CALCULATION FACTORS:
Base Score: 50 (default)

TIME SENSITIVITY BOOSTERS:
- Same day events/deadlines: +40 points
- This week events/deadlines: +25 points  
- Next week events/deadlines: +15 points
- Overdue items: +45 points

CONTENT TYPE BOOSTERS:
- Meeting/appointment invitations: +20 points
- Invoice/payment requests: +20 points
- Action required emails: +15 points
- Reply requested: +10 points

SENDER IMPORTANCE BOOSTERS:
- Work/business domain: +15 points
- Previous high-importance sender: +10 points
- Manager/supervisor: +20 points
- Client/customer: +15 points

URGENCY LANGUAGE BOOSTERS:
- "urgent", "asap", "immediately": +15 points
- "deadline", "due today", "time sensitive": +10 points
- "please confirm", "response required": +8 points

PRIORITY REDUCERS:
- Marketing/promotional: -25 points
- Automated/no-reply senders: -20 points
- Newsletter/subscription: -15 points
- Social media notifications: -10 points

USER PREFERENCES APPLICATION:
{{#if senderPriorities}}
Sender Priority Overrides: {{senderPriorities}}
{{/if}}
{{#if emailTypePriorities}}  
Email Type Priority Overrides: {{emailTypePriorities}}
{{/if}}
{{#if llmFocus}}
Analysis Focus: {{llmFocus}} (adjust scoring emphasis accordingly)
{{/if}}

Email Details:
Subject: {{subject}}
From: {{fromAddress}}
Received: {{receivedAt}}
Content: {{bodyText}}

Return detailed JSON analysis:
{
  "category": "APPOINTMENT",
  "priority": "HIGH",
  "importance_score": 78,
  "priority_reasoning": "Meeting invitation from work colleague for this week (+25 time sensitivity, +20 meeting type, +15 work domain) = 78/100",
  "scoring_breakdown": {
    "base_score": 50,
    "time_sensitivity": 25,
    "content_type": 20,
    "sender_importance": 15,
    "urgency_language": 0,
    "user_overrides": 0,
    "penalties": 0,
    "final_score": 78
  },
  "sentiment": "NEUTRAL",
  "summary": "Team standup meeting scheduled for Thursday 2 PM in Conference Room A - requires calendar booking",
  "tags": ["meeting", "work", "weekly-standup", "high-priority"],
  "confidence": 0.92,
  "actionItems": [
    {
      "actionType": "SCHEDULE_MEETING",
      "description": "Add team standup to calendar for Thursday 2 PM",
      "priority": "HIGH",
      "dueDate": "2024-01-25"
    }
  ]
}
`;
```

---

## Email Account Integration

### Auto-Schedule Creation Hook

```typescript
@Injectable()
export class EmailAccountService {
  
  /**
   * Enhanced email account creation with automatic schedule setup
   */
  async createEmailAccount(
    userId: string, 
    dto: CreateEmailAccountDto
  ): Promise<EmailAccount> {
    // Create email account
    const account = await this.prisma.emailAccount.create({
      data: {
        ...dto,
        userId,
        timezone: dto.timezone || 'UTC'
      }
    });

    // Test IMAP connection
    const connectionTest = await this.imapService.testConnection(account.id);
    if (!connectionTest.success) {
      // Rollback account creation
      await this.prisma.emailAccount.delete({ where: { id: account.id } });
      throw new BadRequestException(`IMAP connection failed: ${connectionTest.message}`);
    }

    // Create default "Initial" processing schedule
    try {
      await this.scheduleService.createDefaultScheduleForNewAccount(userId, account.id);
      this.logger.log(`Created default schedule for new email account: ${account.email}`);
    } catch (error) {
      this.logger.error('Failed to create default schedule:', error);
      // Don't fail account creation, but log the error
    }

    return account;
  }
}
```

---

## Error Handling & Resilience

### IMAP Connection Management

```typescript
@Injectable()
export class IMAPConnectionManager {
  private readonly TIMEOUT_MINUTES = 10;
  private readonly RECONNECT_THRESHOLD_MS = 60000; // 1 minute

  /**
   * Ensure connection remains healthy during batch processing
   */
  async ensureHealthyConnection(
    accountId: string,
    batchStartTime: Date
  ): Promise<void> {
    const elapsed = Date.now() - batchStartTime.getTime();
    const timeoutMs = this.TIMEOUT_MINUTES * 60 * 1000;
    const remainingMs = timeoutMs - elapsed;
    
    // Preemptive reconnection if less than 1 minute remaining
    if (remainingMs < this.RECONNECT_THRESHOLD_MS) {
      this.logger.log(`Preemptive IMAP reconnection for account ${accountId}`);
      await this.reconnectWithRetry(accountId);
    }
  }

  /**
   * Reconnect with exponential backoff retry logic
   */
  async reconnectWithRetry(
    accountId: string,
    maxAttempts: number = 3
  ): Promise<ImapFlow> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Close existing connection
        await this.imapService.closeConnection(accountId);
        
        // Create new connection
        const connection = await this.imapService.createConnection(accountId);
        
        this.logger.log(`IMAP reconnection successful on attempt ${attempt}`);
        return connection;
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`IMAP reconnection attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          // Exponential backoff: 2s, 4s, 8s
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    throw new Error(`IMAP reconnection failed after ${maxAttempts} attempts: ${lastError.message}`);
  }
}
```

### Schedule Execution Error Handling

```typescript
@Injectable()
export class ScheduleExecutionErrorHandler {
  
  /**
   * Handle schedule execution failures with retry logic
   */
  async handleExecutionError(
    execution: ScheduleExecution,
    error: Error
  ): Promise<void> {
    const maxAttempts = execution.maxAttempts || 3;
    
    if (execution.attemptCount < maxAttempts) {
      // Schedule retry with backoff
      const retryDelayMinutes = Math.pow(2, execution.attemptCount) * 5; // 5, 10, 20 minutes
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
      
      await this.prisma.scheduleExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          attemptCount: execution.attemptCount + 1,
          errorMessage: error.message,
          errorDetails: {
            stack: error.stack,
            timestamp: new Date().toISOString(),
            attemptNumber: execution.attemptCount + 1
          }
        }
      });
      
      // Create new execution for retry
      await this.schedulingService.scheduleRetryExecution(execution.scheduleId, nextRetryAt);
      
      this.logger.warn(`Scheduled retry for execution ${execution.id} in ${retryDelayMinutes} minutes`);
      
    } else {
      // Max attempts reached - mark as permanently failed
      await this.prisma.scheduleExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: `Failed after ${maxAttempts} attempts: ${error.message}`,
          errorDetails: {
            finalError: error.message,
            stack: error.stack,
            totalAttempts: maxAttempts,
            timestamp: new Date().toISOString()
          }
        }
      });
      
      // Update schedule failure count
      await this.prisma.processingSchedule.update({
        where: { id: execution.scheduleId },
        data: {
          failedExecutions: { increment: 1 }
        }
      });
      
      this.logger.error(`Schedule execution ${execution.id} permanently failed after ${maxAttempts} attempts`);
    }
  }
}
```

---

## Performance Monitoring

### Metrics Collection

```typescript
@Injectable()
export class ProcessingMetricsService {
  
  /**
   * Collect and store processing metrics
   */
  async recordExecutionMetrics(
    execution: ScheduleExecution,
    processingStats: {
      totalEmails: number;
      processedEmails: number;
      failedEmails: number;
      processingDurationMs: number;
      averageEmailProcessingTimeMs: number;
    }
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        ...processingStats,
        completedAt: new Date()
      }
    });
    
    // Update schedule success metrics
    await this.prisma.processingSchedule.update({
      where: { id: execution.scheduleId },
      data: {
        totalExecutions: { increment: 1 },
        successfulExecutions: { increment: 1 },
        lastExecutedAt: new Date()
      }
    });
  }

  /**
   * Get processing analytics for dashboard
   */
  async getProcessingAnalytics(userId: string): Promise<ProcessingAnalytics> {
    const schedules = await this.prisma.processingSchedule.findMany({
      where: { userId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10
        }
      }
    });
    
    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isEnabled).length,
      totalExecutions: schedules.reduce((sum, s) => sum + s.totalExecutions, 0),
      successRate: this.calculateSuccessRate(schedules),
      recentExecutions: schedules.flatMap(s => s.executions).slice(0, 10),
      processedEmailsToday: await this.getProcessedEmailsCount(userId, 'today'),
      averageProcessingTime: this.calculateAverageProcessingTime(schedules)
    };
  }
}
```

---

## Implementation Timeline

### Week 1: Database & Core Structure
- [ ] Create database migrations
- [ ] Implement UnifiedSchedulingService skeleton
- [ ] Add @nestjs/schedule dependency
- [ ] Create ProcessingSchedule and ScheduleExecution models

### Week 2: Schedule Management
- [ ] Implement ScheduleManagementService
- [ ] Create default schedule auto-generation
- [ ] Build schedule validation logic
- [ ] Implement API endpoints for schedule CRUD

### Week 3: Email Processing Enhancement
- [ ] Enhanced priority scoring LLM templates
- [ ] User preference application logic
- [ ] IMAP connection resilience improvements
- [ ] Batch processing with execution tracking

### Week 4: Error Handling & Monitoring
- [ ] Comprehensive error handling and retry logic
- [ ] Performance metrics collection
- [ ] Execution status monitoring
- [ ] Logging and debugging infrastructure

### Week 5: Testing & Integration
- [ ] Unit tests for all services
- [ ] Integration tests for schedule execution
- [ ] Performance testing with large email volumes
- [ ] Frontend integration and API testing

---

**Result**: Unified, scalable email processing system where all job types (historical, recurring, specific dates) are handled through one comprehensive scheduling engine with user-configurable priorities and robust error handling. 