# Enhanced Email Processing - Core Services

## Overview
Core service layer for unified email processing system with scheduling engine, enhanced processing, and schedule management.

## 1. UnifiedSchedulingService

The main orchestrator that runs cron jobs and executes schedules.

```typescript
@Injectable()
export class UnifiedSchedulingService {
  private readonly logger = new Logger(UnifiedSchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProcessingService: EnhancedEmailProcessingService,
    private readonly imapService: ImapService
  ) {}

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
      const results = await this.emailProcessingService.processEmailsWithScheduleConfig(
        schedule,
        emails,
        execution
      );
      
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

  /**
   * Find schedules ready for execution
   */
  private async findSchedulesReadyForExecution(now: Date): Promise<ProcessingSchedule[]> {
    return this.prisma.processingSchedule.findMany({
      where: {
        isEnabled: true,
        nextExecutionAt: {
          lte: now
        }
      },
      include: {
        emailAccount: true
      }
    });
  }

  /**
   * Group schedules by execution time to handle conflicts
   */
  private groupSchedulesByExecutionTime(
    schedules: ProcessingSchedule[]
  ): Map<Date, ProcessingSchedule[]> {
    const groups = new Map<Date, ProcessingSchedule[]>();
    
    for (const schedule of schedules) {
      const executionTime = schedule.nextExecutionAt;
      const timeKey = new Date(executionTime.getTime());
      
      if (!groups.has(timeKey)) {
        groups.set(timeKey, []);
      }
      
      groups.get(timeKey).push(schedule);
    }
    
    return groups;
  }

  /**
   * Create new schedule execution record
   */
  private async createScheduleExecution(schedule: ProcessingSchedule): Promise<ScheduleExecution> {
    return this.prisma.scheduleExecution.create({
      data: {
        scheduleId: schedule.id,
        status: 'RUNNING',
        startedAt: new Date(),
        maxAttempts: 3
      }
    });
  }

  /**
   * Complete schedule execution with results
   */
  private async completeScheduleExecution(
    execution: ScheduleExecution,
    results: EmailBatchProcessingResult
  ): Promise<void> {
    const processingDuration = Date.now() - execution.startedAt.getTime();
    
    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        processedEmails: results.processed,
        failedEmails: results.failed,
        processingDurationMs: processingDuration
      }
    });
  }

  /**
   * Mark schedule execution as failed
   */
  private async failScheduleExecution(
    execution: ScheduleExecution,
    error: Error
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message,
        errorDetails: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Fetch emails for schedule processing
   */
  private async fetchEmailsForSchedule(
    schedule: ProcessingSchedule,
    dateRange: { since: Date; before?: Date }
  ): Promise<EmailMessage[]> {
    return this.imapService.fetchEmailsWithDateFilter(
      schedule.emailAccountId,
      dateRange.since,
      dateRange.before,
      1000 // Max emails per execution
    );
  }
}
```

## 2. EnhancedEmailProcessingService

Extends the existing EmailIngestionService with schedule-specific processing capabilities.

```typescript
@Injectable()
export class EnhancedEmailProcessingService extends EmailIngestionService {
  private readonly logger = new Logger(EnhancedEmailProcessingService.name);

  constructor(
    prisma: PrismaService,
    imapService: ImapService,
    emailProcessor: EmailProcessorService,
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService
  ) {
    super(prisma, imapService, emailProcessor);
  }

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
    
    this.logger.log(`Processing ${emails.length} emails in ${batches.length} batches for schedule: ${schedule.name}`);
    
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

        this.logger.log(`Batch ${i + 1}/${batches.length} completed: ${batchResults.processed} processed, ${batchResults.failed} failed`);
        
      } catch (batchError) {
        this.logger.error(`Batch ${i + 1} failed:`, batchError);
        results.failed += batch.length;
        
        // Continue with next batch (resilient processing)
        continue;
      }
    }

    this.logger.log(`Schedule execution completed: ${results.processed} total processed, ${results.failed} total failed`);
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
        // Check if already processed
        const existing = await this.prisma.processedEmails.findUnique({
          where: { messageId: email.messageId }
        });
        
        if (existing) {
          this.logger.debug(`Email already processed, skipping: ${email.messageId}`);
          results.push({
            messageId: email.messageId,
            subject: email.subject,
            success: true,
            processedEmail: existing
          });
          continue;
        }

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
    
    // Check email type priorities based on subject/content
    const emailTypePriorities = schedule.emailTypePriorities || {};
    const detectedType = this.detectEmailType(email);
    
    if (emailTypePriorities[detectedType]) {
      email.priorityHints = {
        ...email.priorityHints,
        typePriority: emailTypePriorities[detectedType],
        userConfiguredType: true
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

  /**
   * Apply post-processing priority adjustments based on user configuration
   */
  private applyUserPriorityPostprocessing(
    result: EmailProcessingResult,
    schedule: ProcessingSchedule
  ): EmailProcessingResult {
    const analysis = result.analysis;
    
    // Apply user priority overrides
    if (result.email?.priorityHints?.senderPriority) {
      const overridePriority = result.email.priorityHints.senderPriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);
      
      analysis.importance_score = Math.min(100, analysis.importance_score + priorityBoost);
      analysis.priority_reasoning += ` [User override: +${priorityBoost} for sender priority]`;
    }
    
    if (result.email?.priorityHints?.typePriority) {
      const overridePriority = result.email.priorityHints.typePriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);
      
      analysis.importance_score = Math.min(100, analysis.importance_score + priorityBoost);
      analysis.priority_reasoning += ` [User override: +${priorityBoost} for email type]`;
    }
    
    return result;
  }

  /**
   * Store processed email with execution tracking
   */
  private async storeProcessedEmail(
    result: EmailProcessingResult,
    executionId: string
  ): Promise<ProcessedEmailWithRelations> {
    const analysis = result.analysis;
    
    return this.prisma.processedEmails.create({
      data: {
        messageId: result.messageId,
        subject: result.subject,
        // ... other email fields
        
        // Enhanced priority fields
        importance_score: analysis.importance_score,
        priority_reasoning: analysis.priority_reasoning,
        
        // Link to execution
        schedule_execution_id: executionId,
        
        // Standard analysis fields
        category: analysis.category,
        priority: analysis.priority,
        sentiment: analysis.sentiment,
        summary: analysis.summary,
        tags: analysis.tags,
        confidence: analysis.confidence,
        
        // Processing status
        processingStatus: 'COMPLETED'
      },
      include: {
        entities: true,
        actionItems: true
      }
    });
  }

  /**
   * Utility: Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Update execution progress
   */
  private async updateExecutionProgress(
    executionId: string,
    progress: {
      completedBatches: number;
      processedEmails: number;
      failedEmails: number;
    }
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: executionId },
      data: progress
    });
  }

  /**
   * Calculate priority boost based on user priority setting
   */
  private calculatePriorityBoost(priority: Priority): number {
    const boosts = {
      'URGENT': 30,
      'HIGH': 20,
      'MEDIUM': 10,
      'LOW': 0
    };
    
    return boosts[priority] || 0;
  }

  /**
   * Detect email type from content
   */
  private detectEmailType(email: EmailMessage): EmailCategory {
    const subject = email.subject.toLowerCase();
    const content = (email.bodyText || '').toLowerCase();
    
    if (subject.includes('meeting') || subject.includes('appointment') || content.includes('calendar')) {
      return EmailCategory.APPOINTMENT;
    }
    
    if (subject.includes('invoice') || subject.includes('bill') || subject.includes('payment')) {
      return EmailCategory.INVOICE;
    }
    
    // Add more detection logic
    return EmailCategory.PERSONAL;
  }

  /**
   * Select LLM template based on focus preference
   */
  private selectTemplateByFocus(focus: string): string {
    const templates = {
      'sentiment': 'sentiment-analysis',
      'urgency': 'urgency-detector',
      'general': 'email-analysis'
    };
    
    return templates[focus] || templates['general'];
  }
}
```

## 3. ScheduleManagementService

Handles CRUD operations and validation for processing schedules.

```typescript
@Injectable()
export class ScheduleManagementService {
  private readonly logger = new Logger(ScheduleManagementService.name);

  constructor(
    private readonly prisma: PrismaService
  ) {}

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

    this.logger.log(`Created default schedule for email account: ${accountId}`);
    return defaultSchedule;
  }

  /**
   * Create user-defined processing schedule
   */
  async createProcessingSchedule(
    dto: CreateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
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
   * Delete processing schedule
   */
  async deleteProcessingSchedule(id: string): Promise<void> {
    await this.prisma.processingSchedule.delete({
      where: { id }
    });
    
    this.logger.log(`Deleted processing schedule: ${id}`);
  }

  /**
   * Get user's processing schedules
   */
  async getUserSchedules(userId: string): Promise<ProcessingSchedule[]> {
    return this.prisma.processingSchedule.findMany({
      where: { userId },
      include: {
        emailAccount: {
          select: { email: true, displayName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get schedule execution status
   */
  async getScheduleExecutionStatus(scheduleId: string): Promise<ScheduleExecutionStatus> {
    const schedule = await this.prisma.processingSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const latestExecution = schedule.executions[0];
    
    if (!latestExecution) {
      return {
        id: schedule.id,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        status: 'PENDING',
        progress: {
          totalBatches: 0,
          completedBatches: 0,
          totalEmails: 0,
          processedEmails: 0,
          failedEmails: 0,
          completionPercentage: 0
        },
        timing: {
          startedAt: schedule.createdAt
        }
      };
    }

    return {
      id: latestExecution.id,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      status: latestExecution.status,
      progress: {
        totalBatches: latestExecution.totalBatches,
        completedBatches: latestExecution.completedBatches,
        totalEmails: latestExecution.totalEmails,
        processedEmails: latestExecution.processedEmails,
        failedEmails: latestExecution.failedEmails,
        completionPercentage: latestExecution.totalEmails > 0 
          ? Math.round((latestExecution.processedEmails / latestExecution.totalEmails) * 100)
          : 0
      },
      timing: {
        startedAt: latestExecution.startedAt,
        completedAt: latestExecution.completedAt,
        processingDuration: latestExecution.processingDurationMs
      },
      error: latestExecution.errorMessage ? {
        message: latestExecution.errorMessage,
        details: latestExecution.errorDetails
      } : undefined
    };
  }

  /**
   * Calculate next execution time based on schedule type
   */
  private calculateNextExecutionTime(
    dto: CreateProcessingScheduleDto | UpdateProcessingScheduleDto
  ): Date | null {
    switch (dto.processingType) {
      case 'DATE_RANGE':
        // Date range schedules execute immediately
        return new Date();
        
      case 'RECURRING':
        if (!dto.cronExpression) return null;
        
        // Use cron parser to calculate next execution
        const parser = require('cron-parser');
        const interval = parser.parseExpression(dto.cronExpression, {
          currentDate: new Date(),
          tz: dto.timezone || 'UTC'
        });
        
        return interval.next().toDate();
        
      case 'SPECIFIC_DATES':
        if (!dto.specificDates || dto.specificDates.length === 0) return null;
        
        // Find next future date
        const now = new Date();
        const futureDates = dto.specificDates
          .map(d => new Date(d))
          .filter(d => d > now)
          .sort((a, b) => a.getTime() - b.getTime());
          
        return futureDates.length > 0 ? futureDates[0] : null;
        
      default:
        return null;
    }
  }

  /**
   * Get cron job calendar for monitoring
   */
  async getCronJobCalendar(): Promise<CronJobCalendarEntry[]> {
    const schedules = await this.prisma.processingSchedule.findMany({
      where: { 
        isEnabled: true,
        processingType: 'RECURRING',
        cronExpression: { not: null }
      },
      include: {
        emailAccount: {
          select: { email: true }
        }
      }
    });

    return schedules.map(schedule => {
      const parser = require('cron-parser');
      const interval = parser.parseExpression(schedule.cronExpression, {
        currentDate: new Date(),
        tz: schedule.timezone
      });

      const nextExecutions = [];
      for (let i = 0; i < 10; i++) {
        nextExecutions.push(interval.next().toDate());
      }

      return {
        configId: schedule.id,
        configName: schedule.name,
        userId: schedule.userId,
        accountEmail: schedule.emailAccount.email,
        cronExpression: schedule.cronExpression,
        nextExecutions,
        timezone: schedule.timezone
      };
    });
  }
}
```

---

**Result**: Complete core service layer providing unified scheduling execution, enhanced email processing with user preferences, and comprehensive schedule management with conflict detection. 