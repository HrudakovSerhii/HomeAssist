# Enhanced Email Processing - API Endpoints

## Overview
REST API endpoints for managing processing schedules, validation, and execution monitoring.

## Processing Schedules Controller

```typescript
@Controller('api/processing-schedules')
export class ProcessingSchedulesController {
  private readonly logger = new Logger(ProcessingSchedulesController.name);

  constructor(
    private readonly scheduleService: ScheduleManagementService,
    private readonly schedulingService: UnifiedSchedulingService
  ) {}

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
    const schedule = await this.scheduleService.getScheduleById(id);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const execution = await this.schedulingService.executeSchedule(schedule);
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

  @Get('analytics/:userId')
  async getProcessingAnalytics(
    @Param('userId') userId: string
  ): Promise<ProcessingAnalytics> {
    return this.scheduleService.getProcessingAnalytics(userId);
  }
}
```

## Email Accounts Controller Enhancement

```typescript
@Controller('api/email-accounts')
export class EmailAccountsController {
  
  constructor(
    private readonly emailAccountService: EmailAccountService,
    private readonly scheduleService: ScheduleManagementService
  ) {}

  @Post()
  async createEmailAccount(
    @Body() dto: CreateEmailAccountDto
  ): Promise<{
    account: EmailAccount;
    defaultSchedule: ProcessingSchedule;
  }> {
    // Create email account with IMAP validation
    const account = await this.emailAccountService.createEmailAccount(dto.userId, dto);
    
    // Create default schedule
    const defaultSchedule = await this.scheduleService.createDefaultScheduleForNewAccount(
      dto.userId,
      account.id
    );

    return {
      account,
      defaultSchedule
    };
  }

  @Get(':id/schedules')
  async getAccountSchedules(
    @Param('id') accountId: string
  ): Promise<ProcessingSchedule[]> {
    return this.scheduleService.getAccountSchedules(accountId);
  }
}
```

## DTOs

### Main Schedule DTOs

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
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression format'
  })
  cronExpression?: string;

  @ValidateIf(o => o.processingType === 'RECURRING')
  @IsString()
  @IsTimeZone()
  timezone?: string;

  // Specific dates fields
  @ValidateIf(o => o.processingType === 'SPECIFIC_DATES')
  @IsArray()
  @IsDateString({ each: true })
  @ArrayMinSize(1, { message: 'At least one specific date is required' })
  specificDates?: string[];

  // Processing preferences
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Batch size must be at least 1' })
  @Max(20, { message: 'Batch size cannot exceed 20' })
  batchSize?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Transform(({ value }) => {
    // Validate email type priorities
    const validCategories = Object.values(EmailCategory);
    const validPriorities = Object.values(Priority);
    
    for (const [category, priority] of Object.entries(value || {})) {
      if (!validCategories.includes(category as EmailCategory)) {
        throw new BadRequestException(`Invalid email category: ${category}`);
      }
      if (!validPriorities.includes(priority as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
    }
    return value;
  })
  emailTypePriorities?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Transform(({ value }) => {
    // Validate sender priorities
    const validPriorities = Object.values(Priority);
    
    for (const [email, priority] of Object.entries(value || {})) {
      if (!email.includes('@')) {
        throw new BadRequestException(`Invalid email address: ${email}`);
      }
      if (!validPriorities.includes(priority as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
    }
    return value;
  })
  senderPriorities?: Record<string, string>;

  @IsOptional()
  @IsEnum(['general', 'sentiment', 'urgency'])
  llmFocus?: 'general' | 'sentiment' | 'urgency';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateProcessingScheduleDto extends PartialType(CreateProcessingScheduleDto) {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  emailAccountId?: string;
}
```

### Response DTOs

```typescript
export interface ScheduleExecutionStatus {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING';
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

export interface CronJobCalendarEntry {
  configId: string;
  configName: string;
  userId: string;
  accountEmail: string;
  cronExpression: string;
  nextExecutions: Date[]; // Next 10 executions
  timezone: string;
  isEnabled: boolean;
  lastExecution?: {
    startedAt: Date;
    status: string;
    processingDuration?: number;
  };
}

export interface ProcessingAnalytics {
  totalSchedules: number;
  activeSchedules: number;
  totalExecutions: number;
  successRate: number;
  recentExecutions: {
    id: string;
    scheduleName: string;
    status: string;
    startedAt: Date;
    processingDuration?: number;
    processedEmails: number;
  }[];
  processedEmailsToday: number;
  averageProcessingTime: number;
  upcomingExecutions: {
    scheduleId: string;
    scheduleName: string;
    nextExecutionAt: Date;
    accountEmail: string;
  }[];
}
```

### Validation DTOs

```typescript
export class ValidateCronExpressionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/)
  cronExpression: string;

  @IsString()
  @IsTimeZone()
  timezone: string;

  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class ValidateSpecificDatesDto {
  @IsArray()
  @IsDateString({ each: true })
  @ArrayMinSize(1)
  specificDates: string[];

  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class ConflictCheckDto {
  @IsOptional()
  @ValidateNested()
  cron?: ValidateCronExpressionDto;

  @IsOptional()
  @ValidateNested()
  dates?: ValidateSpecificDatesDto;
}
```

## Request/Response Examples

### Create Schedule Request

```json
{
  "userId": "user-123",
  "emailAccountId": "account-456",
  "name": "Daily Morning Review",
  "description": "Process new emails every morning at 6 AM",
  "processingType": "RECURRING",
  "cronExpression": "0 6 * * *",
  "timezone": "America/New_York",
  "batchSize": 5,
  "emailTypePriorities": {
    "APPOINTMENT": "HIGH",
    "INVOICE": "HIGH",
    "WORK": "MEDIUM"
  },
  "senderPriorities": {
    "boss@company.com": "URGENT",
    "team@company.com": "HIGH"
  },
  "llmFocus": "urgency"
}
```

### Validation Error Response

```json
{
  "statusCode": 400,
  "message": "Schedule validation failed",
  "errors": [
    "Schedule conflicts with existing executions at the same time"
  ],
  "warnings": [
    "No timezone specified, using UTC as default"
  ],
  "cronConflicts": [
    {
      "conflictTime": "2024-01-15T06:00:00Z",
      "conflictingSchedules": ["Personal Morning Review"],
      "suggestedAlternatives": [
        "2024-01-15T05:45:00Z",
        "2024-01-15T05:50:00Z",
        "2024-01-15T05:55:00Z",
        "2024-01-15T06:05:00Z",
        "2024-01-15T06:10:00Z",
        "2024-01-15T06:15:00Z"
      ]
    }
  ]
}
```

### Schedule Status Response

```json
{
  "id": "execution-789",
  "scheduleId": "schedule-123",
  "scheduleName": "Daily Morning Review",
  "status": "RUNNING",
  "progress": {
    "totalBatches": 10,
    "completedBatches": 7,
    "totalEmails": 50,
    "processedEmails": 35,
    "failedEmails": 0,
    "completionPercentage": 70
  },
  "timing": {
    "startedAt": "2024-01-15T06:00:00Z",
    "estimatedCompletion": "2024-01-15T06:08:00Z",
    "processingDuration": 420000
  }
}
```

### Cron Calendar Response

```json
[
  {
    "configId": "schedule-123",
    "configName": "Daily Morning Review",
    "userId": "user-123",
    "accountEmail": "user@example.com",
    "cronExpression": "0 6 * * *",
    "timezone": "America/New_York",
    "isEnabled": true,
    "nextExecutions": [
      "2024-01-15T11:00:00Z",
      "2024-01-16T11:00:00Z",
      "2024-01-17T11:00:00Z"
    ],
    "lastExecution": {
      "startedAt": "2024-01-14T11:00:00Z",
      "status": "COMPLETED",
      "processingDuration": 45000
    }
  }
]
```

## Error Handling

### Custom Exception Filters

```typescript
@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: exception.errors,
        warnings: exception.warnings,
        cronConflicts: exception.cronConflicts,
        timestamp: new Date().toISOString(),
      });
  }
}

@Catch(ScheduleConflictException)
export class ScheduleConflictExceptionFilter implements ExceptionFilter {
  catch(exception: ScheduleConflictException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response
      .status(HttpStatus.CONFLICT)
      .json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Schedule execution time conflicts with existing schedules',
        conflicts: exception.conflicts,
        suggestedAlternatives: exception.suggestedAlternatives,
        timestamp: new Date().toISOString(),
      });
  }
}
```

## API Module Configuration

```typescript
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    LLMModule
  ],
  controllers: [
    ProcessingSchedulesController,
    EmailAccountsController
  ],
  providers: [
    UnifiedSchedulingService,
    ScheduleManagementService,
    EnhancedEmailProcessingService,
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ScheduleConflictExceptionFilter,
    }
  ],
  exports: [
    UnifiedSchedulingService,
    ScheduleManagementService
  ]
})
export class ProcessingScheduleModule {}
```

---

**Result**: Complete REST API with comprehensive validation, conflict detection, execution monitoring, and user-friendly error responses for the unified email processing system. 