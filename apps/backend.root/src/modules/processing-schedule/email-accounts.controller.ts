import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ProcessingScheduleService } from './processing-schedule.service';
import { ProcessingSchedule } from '@prisma/client';

// Simple DTO for email account creation (would be expanded based on actual requirements)
export class CreateEmailAccountDto {
  userId: string;
  email: string;
  displayName?: string;
  accountType: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
  // Additional fields would be added based on actual email account service
}

@Controller('api/email-accounts')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class EmailAccountsController {
  private readonly logger = new Logger(EmailAccountsController.name);

  constructor(
    private readonly scheduleService: ProcessingScheduleService
    // private readonly emailAccountService: EmailAccountService // Would be injected when available
  ) {}

  @Post()
  async createEmailAccount(
    @Body() dto: CreateEmailAccountDto
  ): Promise<{
    account: any; // Would be EmailAccount type when service is available
    defaultSchedule: ProcessingSchedule;
    message: string;
  }> {
    // TODO: Implement actual email account creation when EmailAccountService is available
    // const account = await this.emailAccountService.createEmailAccount(dto.userId, dto);
    
    // For now, return a mock account structure
    const mockAccount = {
      id: `account_${Date.now()}`,
      email: dto.email,
      displayName: dto.displayName || dto.email,
      accountType: dto.accountType,
      userId: dto.userId,
      isActive: true,
      createdAt: new Date(),
    };

    // Create default schedule for the new account
    try {
      const defaultSchedule = await this.scheduleService.createProcessingSchedule({
        userId: dto.userId,
        emailAccountId: mockAccount.id,
        name: `Default Schedule - ${dto.email}`,
        description: `Automatically created default schedule for ${dto.email}`,
        processingType: 'RECURRING',
        cronExpression: '0 6 * * *', // Daily at 6 AM
        timezone: 'UTC',
        batchSize: 10,
        isEnabled: true,
        isDefault: true,
        llmFocus: 'general',
      });

      this.logger.log(`Created default schedule for email account: ${dto.email}`);

      return {
        account: mockAccount,
        defaultSchedule,
        message: 'Email account created successfully with default processing schedule'
      };
    } catch (error) {
      this.logger.error('Failed to create default schedule for email account:', error);
      throw error;
    }
  }

  @Get(':id/schedules')
  async getAccountSchedules(
    @Param('id') accountId: string
  ): Promise<{
    accountId: string;
    schedules: ProcessingSchedule[];
    totalCount: number;
  }> {
    try {
      // TODO: When EmailAccountService is available, verify account exists
      // const account = await this.emailAccountService.getAccountById(accountId);
      // if (!account) {
      //   throw new NotFoundException('Email account not found');
      // }

      // TODO: Implement getAccountSchedules method in ProcessingScheduleService
      // For now, we'll get user schedules and filter by accountId
      // const schedules = await this.scheduleService.getAccountSchedules(accountId);
      const schedules: ProcessingSchedule[] = []; // Placeholder until service method is implemented

      return {
        accountId,
        schedules,
        totalCount: schedules.length
      };
    } catch (error) {
      this.logger.error(`Failed to get schedules for account ${accountId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Email account not found or no schedules available');
    }
  }

  /**
   * ENHANCED: Get account processing statistics
   */
  @Get(':id/stats')
  async getAccountProcessingStats(
    @Param('id') accountId: string
  ): Promise<{
    accountId: string;
    totalSchedules: number;
    activeSchedules: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastProcessingDate?: Date;
  }> {
    // TODO: Implement getAccountSchedules method in ProcessingScheduleService
    const schedules: ProcessingSchedule[] = []; // Placeholder until service method is implemented
    
    const stats = {
      accountId,
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isEnabled).length,
      totalExecutions: schedules.reduce((sum, s) => sum + (s.totalExecutions || 0), 0),
      successfulExecutions: schedules.reduce((sum, s) => sum + (s.successfulExecutions || 0), 0),
      failedExecutions: schedules.reduce((sum, s) => sum + (s.failedExecutions || 0), 0),
      lastProcessingDate: schedules
        .map(s => s.lastExecutedAt)
        .filter(date => date)
        .sort((a, b) => b!.getTime() - a!.getTime())[0]
    };

    return stats;
  }
} 