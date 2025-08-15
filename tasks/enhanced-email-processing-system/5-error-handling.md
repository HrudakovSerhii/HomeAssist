# Enhanced Email Processing - Error Handling & Resilience

## Overview
Comprehensive error handling, retry mechanisms, and resilience patterns for production-ready email processing.

## IMAP Connection Management

### Connection Health Monitoring

```typescript
@Injectable()
export class IMAPConnectionManager {
  private readonly logger = new Logger(IMAPConnectionManager.name);
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
          await this.delay(backoffMs);
        }
      }
    }
    
    throw new IMAPConnectionError(
      `IMAP reconnection failed after ${maxAttempts} attempts: ${lastError.message}`,
      accountId,
      lastError
    );
  }

  /**
   * Test connection with timeout and health check
   */
  async testConnectionHealth(accountId: string): Promise<ConnectionHealthResult> {
    const startTime = Date.now();
    
    try {
      const connection = await this.imapService.getConnection(accountId);
      
      // Test basic operations
      await connection.status('INBOX', { messages: true });
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        responseTimeMs: responseTime,
        lastChecked: new Date(),
        message: 'Connection healthy'
      };
      
    } catch (error) {
      return {
        healthy: false,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
        message: `Connection unhealthy: ${error.message}`
      };
    }
  }

  /**
   * Monitor connection pool and cleanup stale connections
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async cleanupStaleConnections(): Promise<void> {
    const connections = this.imapService.getAllConnections();
    
    for (const [accountId, connection] of connections.entries()) {
      const health = await this.testConnectionHealth(accountId);
      
      if (!health.healthy) {
        this.logger.warn(`Removing stale connection for account: ${accountId}`);
        await this.imapService.closeConnection(accountId);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ConnectionHealthResult {
  healthy: boolean;
  responseTimeMs: number;
  lastChecked: Date;
  error?: string;
  message: string;
}
```

### IMAP Error Classification

```typescript
export enum IMAPErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  MAILBOX_NOT_FOUND = 'MAILBOX_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN = 'UNKNOWN'
}

export class IMAPConnectionError extends Error {
  constructor(
    message: string,
    public accountId: string,
    public originalError?: Error,
    public errorType: IMAPErrorType = IMAPErrorType.UNKNOWN
  ) {
    super(message);
    this.name = 'IMAPConnectionError';
  }
}

@Injectable()
export class IMAPErrorClassifier {
  
  classifyError(error: Error): IMAPErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return IMAPErrorType.TIMEOUT;
    }
    
    if (message.includes('authentication failed') || message.includes('login failed')) {
      return IMAPErrorType.AUTHENTICATION_FAILED;
    }
    
    if (message.includes('connection') && message.includes('refused')) {
      return IMAPErrorType.CONNECTION_FAILED;
    }
    
    if (message.includes('mailbox') && message.includes('not found')) {
      return IMAPErrorType.MAILBOX_NOT_FOUND;
    }
    
    if (message.includes('network') || message.includes('socket')) {
      return IMAPErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('quota') || message.includes('storage')) {
      return IMAPErrorType.QUOTA_EXCEEDED;
    }
    
    return IMAPErrorType.UNKNOWN;
  }

  isRetryableError(errorType: IMAPErrorType): boolean {
    const retryableErrors = [
      IMAPErrorType.TIMEOUT,
      IMAPErrorType.CONNECTION_FAILED,
      IMAPErrorType.NETWORK_ERROR,
      IMAPErrorType.SERVER_ERROR
    ];
    
    return retryableErrors.includes(errorType);
  }

  getRetryDelayMs(errorType: IMAPErrorType, attempt: number): number {
    const baseDelays = {
      [IMAPErrorType.TIMEOUT]: 5000, // 5 seconds
      [IMAPErrorType.CONNECTION_FAILED]: 10000, // 10 seconds
      [IMAPErrorType.NETWORK_ERROR]: 3000, // 3 seconds
      [IMAPErrorType.SERVER_ERROR]: 15000, // 15 seconds
    };
    
    const baseDelay = baseDelays[errorType] || 5000;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    
    return Math.min(exponentialDelay + jitter, 60000); // Cap at 1 minute
  }
}
```

## Schedule Execution Error Handling

### Comprehensive Execution Error Handler

```typescript
@Injectable()
export class ScheduleExecutionErrorHandler {
  private readonly logger = new Logger(ScheduleExecutionErrorHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: UnifiedSchedulingService,
    private readonly imapErrorClassifier: IMAPErrorClassifier
  ) {}

  /**
   * Handle schedule execution failures with intelligent retry logic
   */
  async handleExecutionError(
    execution: ScheduleExecution,
    error: Error
  ): Promise<void> {
    const maxAttempts = execution.maxAttempts || 3;
    const errorType = this.classifyExecutionError(error);
    
    // Log error details
    this.logger.error(`Schedule execution failed: ${execution.id}`, {
      scheduleId: execution.scheduleId,
      attempt: execution.attemptCount,
      errorType,
      error: error.message,
      stack: error.stack
    });

    if (execution.attemptCount < maxAttempts && this.isRetryableError(errorType)) {
      await this.scheduleRetry(execution, error, errorType);
    } else {
      await this.markAsPermanentlyFailed(execution, error, maxAttempts);
    }
  }

  /**
   * Schedule retry with intelligent backoff
   */
  private async scheduleRetry(
    execution: ScheduleExecution,
    error: Error,
    errorType: ExecutionErrorType
  ): Promise<void> {
    const retryDelayMinutes = this.calculateRetryDelay(errorType, execution.attemptCount);
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
    
    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        attemptCount: execution.attemptCount + 1,
        errorMessage: error.message,
        errorDetails: {
          errorType,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          attemptNumber: execution.attemptCount + 1,
          nextRetryAt: nextRetryAt.toISOString()
        }
      }
    });
    
    // Create new execution for retry
    await this.schedulingService.scheduleRetryExecution(execution.scheduleId, nextRetryAt);
    
    this.logger.warn(`Scheduled retry for execution ${execution.id} in ${retryDelayMinutes} minutes`, {
      errorType,
      nextRetryAt
    });
  }

  /**
   * Mark execution as permanently failed
   */
  private async markAsPermanentlyFailed(
    execution: ScheduleExecution,
    error: Error,
    maxAttempts: number
  ): Promise<void> {
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
          timestamp: new Date().toISOString(),
          permanentFailure: true
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
    
    // Send notification for permanent failure
    await this.notifyPermanentFailure(execution, error);
    
    this.logger.error(`Schedule execution ${execution.id} permanently failed after ${maxAttempts} attempts`, {
      scheduleId: execution.scheduleId,
      error: error.message
    });
  }

  /**
   * Classify execution errors for appropriate handling
   */
  private classifyExecutionError(error: Error): ExecutionErrorType {
    if (error instanceof IMAPConnectionError) {
      return ExecutionErrorType.IMAP_CONNECTION;
    }
    
    if (error.message.includes('LLM') || error.message.includes('AI')) {
      return ExecutionErrorType.LLM_PROCESSING;
    }
    
    if (error.message.includes('database') || error.message.includes('prisma')) {
      return ExecutionErrorType.DATABASE;
    }
    
    if (error.message.includes('timeout')) {
      return ExecutionErrorType.TIMEOUT;
    }
    
    if (error.message.includes('memory') || error.message.includes('resources')) {
      return ExecutionErrorType.RESOURCE_EXHAUSTION;
    }
    
    return ExecutionErrorType.UNKNOWN;
  }

  /**
   * Determine if error type is retryable
   */
  private isRetryableError(errorType: ExecutionErrorType): boolean {
    const retryableErrors = [
      ExecutionErrorType.IMAP_CONNECTION,
      ExecutionErrorType.TIMEOUT,
      ExecutionErrorType.DATABASE,
      ExecutionErrorType.LLM_PROCESSING,
      ExecutionErrorType.RESOURCE_EXHAUSTION
    ];
    
    return retryableErrors.includes(errorType);
  }

  /**
   * Calculate retry delay based on error type and attempt number
   */
  private calculateRetryDelay(errorType: ExecutionErrorType, attempt: number): number {
    const baseDelays = {
      [ExecutionErrorType.IMAP_CONNECTION]: 10, // 10 minutes
      [ExecutionErrorType.LLM_PROCESSING]: 5, // 5 minutes
      [ExecutionErrorType.DATABASE]: 15, // 15 minutes
      [ExecutionErrorType.TIMEOUT]: 20, // 20 minutes
      [ExecutionErrorType.RESOURCE_EXHAUSTION]: 30, // 30 minutes
      [ExecutionErrorType.UNKNOWN]: 10 // 10 minutes
    };
    
    const baseDelay = baseDelays[errorType] || 10;
    
    // Exponential backoff: 1x, 2x, 4x
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Send notification for permanent failures
   */
  private async notifyPermanentFailure(execution: ScheduleExecution, error: Error): Promise<void> {
    // Implementation would send email/webhook notification to user
    // For now, just log the event
    this.logger.error(`PERMANENT FAILURE NOTIFICATION: Schedule execution ${execution.id} failed permanently`, {
      scheduleId: execution.scheduleId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export enum ExecutionErrorType {
  IMAP_CONNECTION = 'IMAP_CONNECTION',
  LLM_PROCESSING = 'LLM_PROCESSING',
  DATABASE = 'DATABASE',
  TIMEOUT = 'TIMEOUT',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  UNKNOWN = 'UNKNOWN'
}
```

## Batch Processing Resilience

### Resilient Batch Processor

```typescript
@Injectable()
export class ResilientBatchProcessor {
  private readonly logger = new Logger(ResilientBatchProcessor.name);

  constructor(
    private readonly imapConnectionManager: IMAPConnectionManager,
    private readonly executionErrorHandler: ScheduleExecutionErrorHandler
  ) {}

  /**
   * Process batch with comprehensive error handling
   */
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
        await this.imapConnectionManager.ensureHealthyConnection(
          job.emailAccountId, 
          batchStartTime
        );

        // Process batch
        const result = await this.processBatchSafely(job, batchEmails, batchStartTime);
        
        // Update job progress on success
        await this.updateJobProgress(job.id, {
          currentBatch: job.currentBatch + 1,
          processedEmails: job.processedEmails + result.processed,
          failedEmails: job.failedEmails + result.failed
        });

        this.logger.log(`Batch processed successfully on attempt ${attempt}`, {
          jobId: job.id,
          processed: result.processed,
          failed: result.failed
        });

        return result;
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`Batch processing attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          // Wait before retry with exponential backoff
          const backoffMs = Math.pow(2, attempt) * 1000;
          await this.delay(backoffMs);
        }
      }
    }

    // All attempts failed - handle gracefully
    await this.handleBatchFailure(job, batchEmails, lastError);
    
    throw new BatchProcessingError(
      `Batch processing failed after ${maxAttempts} attempts`,
      job.id,
      lastError
    );
  }

  /**
   * Process batch with error isolation per email
   */
  private async processBatchSafely(
    job: ProcessingJob,
    emails: EmailMessage[],
    batchStartTime: Date
  ): Promise<BatchResult> {
    const results = {
      processed: 0,
      failed: 0,
      emails: []
    };

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      try {
        // Check if we're approaching IMAP timeout
        if (i > 0 && i % 2 === 0) { // Check every 2 emails
          await this.imapConnectionManager.ensureHealthyConnection(
            job.emailAccountId,
            batchStartTime
          );
        }

        // Process individual email
        const processedEmail = await this.processEmailSafely(email, job);
        
        results.processed++;
        results.emails.push({
          messageId: email.messageId,
          success: true,
          processedEmail
        });
        
      } catch (emailError) {
        this.logger.warn(`Failed to process email ${email.messageId}:`, emailError);
        
        results.failed++;
        results.emails.push({
          messageId: email.messageId,
          success: false,
          error: emailError.message
        });
        
        // Continue with other emails - don't let one failure stop the batch
      }
    }

    return results;
  }

  /**
   * Process individual email with timeout protection
   */
  private async processEmailSafely(
    email: EmailMessage,
    job: ProcessingJob
  ): Promise<ProcessedEmail> {
    const processingTimeout = 60000; // 1 minute per email
    
    return Promise.race([
      this.processEmailInternal(email, job),
      new Promise<never>((_, reject) => 
        setTimeout(
          () => reject(new Error(`Email processing timeout: ${email.messageId}`)),
          processingTimeout
        )
      )
    ]);
  }

  /**
   * Handle batch failure gracefully
   */
  private async handleBatchFailure(
    job: ProcessingJob,
    batchEmails: EmailMessage[],
    error: Error
  ): Promise<void> {
    // Update job progress with batch failure
    await this.updateJobProgress(job.id, {
      currentBatch: job.currentBatch + 1,
      failedEmails: job.failedEmails + batchEmails.length,
      attemptCount: job.attemptCount + 1
    });

    // Log batch failure details
    this.logger.error(`Batch completely failed for job ${job.id}`, {
      batchSize: batchEmails.length,
      currentBatch: job.currentBatch,
      error: error.message
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class BatchProcessingError extends Error {
  constructor(
    message: string,
    public jobId: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BatchProcessingError';
  }
}
```

## Circuit Breaker Pattern

### Service Circuit Breaker

```typescript
@Injectable()
export class ServiceCircuitBreaker {
  private readonly circuits = new Map<string, CircuitState>();
  private readonly logger = new Logger(ServiceCircuitBreaker.name);

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    options: CircuitBreakerOptions = {}
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName, options);
    
    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime < circuit.timeout) {
        throw new CircuitBreakerOpenError(`Circuit breaker is OPEN for ${circuitName}`);
      } else {
        // Move to HALF_OPEN state
        circuit.state = 'HALF_OPEN';
        this.logger.log(`Circuit breaker moved to HALF_OPEN: ${circuitName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(circuit);
      return result;
    } catch (error) {
      this.onFailure(circuit, error);
      throw error;
    }
  }

  private getOrCreateCircuit(name: string, options: CircuitBreakerOptions): CircuitState {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        threshold: options.failureThreshold || 5,
        timeout: options.timeout || 60000, // 1 minute
        resetSuccessCount: options.resetSuccessCount || 3
      });
    }
    
    return this.circuits.get(name)!;
  }

  private onSuccess(circuit: CircuitState): void {
    if (circuit.state === 'HALF_OPEN') {
      circuit.resetSuccessCount--;
      if (circuit.resetSuccessCount <= 0) {
        circuit.state = 'CLOSED';
        circuit.failureCount = 0;
        circuit.resetSuccessCount = 3;
        this.logger.log('Circuit breaker moved to CLOSED');
      }
    } else {
      circuit.failureCount = 0;
    }
  }

  private onFailure(circuit: CircuitState, error: Error): void {
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();
    
    if (circuit.failureCount >= circuit.threshold) {
      circuit.state = 'OPEN';
      this.logger.warn(`Circuit breaker moved to OPEN due to ${circuit.failureCount} failures`);
    }
  }
}

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  threshold: number;
  timeout: number;
  resetSuccessCount: number;
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeout?: number;
  resetSuccessCount?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

## Health Monitoring

### System Health Monitor

```typescript
@Injectable()
export class SystemHealthMonitor {
  private readonly logger = new Logger(SystemHealthMonitor.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly imapConnectionManager: IMAPConnectionManager
  ) {}

  /**
   * Comprehensive system health check
   */
  async getSystemHealth(): Promise<SystemHealthReport> {
    const checks = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkIMAPConnectionsHealth(),
      this.checkProcessingJobsHealth(),
      this.checkResourceUsage()
    ]);

    const [database, imap, processing, resources] = checks.map(result => 
      result.status === 'fulfilled' ? result.value : this.createFailedCheck(result.reason)
    );

    const overall = this.calculateOverallHealth([database, imap, processing, resources]);

    return {
      status: overall,
      timestamp: new Date(),
      checks: {
        database,
        imap,
        processing,
        resources
      }
    };
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime,
        message: 'Database connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: `Database connection failed: ${error.message}`
      };
    }
  }

  private async checkIMAPConnectionsHealth(): Promise<HealthCheck> {
    try {
      // Check all active connections
      const connections = await this.imapConnectionManager.getAllConnectionHealth();
      const unhealthyCount = connections.filter(c => !c.healthy).length;
      
      if (unhealthyCount === 0) {
        return {
          status: 'healthy',
          responseTime: Math.max(...connections.map(c => c.responseTimeMs)),
          message: `All ${connections.length} IMAP connections healthy`
        };
      } else {
        return {
          status: unhealthyCount === connections.length ? 'unhealthy' : 'degraded',
          responseTime: 0,
          message: `${unhealthyCount}/${connections.length} IMAP connections unhealthy`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: `IMAP health check failed: ${error.message}`
      };
    }
  }

  private async checkProcessingJobsHealth(): Promise<HealthCheck> {
    try {
      const [runningJobs, failedJobs] = await Promise.all([
        this.prisma.scheduleExecution.count({
          where: { status: 'RUNNING' }
        }),
        this.prisma.scheduleExecution.count({
          where: { 
            status: 'FAILED',
            startedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);

      const status = failedJobs > runningJobs * 2 ? 'degraded' : 'healthy';

      return {
        status,
        responseTime: 0,
        message: `${runningJobs} jobs running, ${failedJobs} failed in last 24h`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: `Processing jobs health check failed: ${error.message}`
      };
    }
  }

  private async checkResourceUsage(): Promise<HealthCheck> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (memoryUsagePercent > 0.9) status = 'unhealthy';
      else if (memoryUsagePercent > 0.7) status = 'degraded';

      return {
        status,
        responseTime: 0,
        message: `Memory usage: ${Math.round(memoryUsagePercent * 100)}%`,
        details: {
          memoryUsage: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            percent: Math.round(memoryUsagePercent * 100)
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: `Resource usage check failed: ${error.message}`
      };
    }
  }

  private calculateOverallHealth(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }

  private createFailedCheck(error: any): HealthCheck {
    return {
      status: 'unhealthy',
      responseTime: 0,
      message: `Health check failed: ${error.message || error}`
    };
  }

  /**
   * Periodic health monitoring
   */
  @Cron('*/2 * * * *') // Every 2 minutes
  async performPeriodicHealthCheck(): Promise<void> {
    const health = await this.getSystemHealth();
    
    if (health.status === 'unhealthy') {
      this.logger.error('System health is UNHEALTHY', health);
      // Could trigger alerts here
    } else if (health.status === 'degraded') {
      this.logger.warn('System health is DEGRADED', health);
    }
  }
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message: string;
  details?: any;
}

interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: HealthCheck;
    imap: HealthCheck;
    processing: HealthCheck;
    resources: HealthCheck;
  };
}
```

---

**Result**: Comprehensive error handling and resilience system with IMAP connection management, intelligent retry logic, circuit breaker protection, and system health monitoring for production-ready email processing. 