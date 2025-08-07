import {
  Controller,
  Get,
  Param,
  Logger,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ProcessingScheduleService } from './processing-schedule.service';
import { ProcessingSchedule } from '@prisma/client';

@Controller('api/email-accounts')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class EmailAccountsController {
  private readonly logger = new Logger(EmailAccountsController.name);

  constructor(
    private readonly scheduleService: ProcessingScheduleService
    // private readonly emailAccountService: EmailAccountService // Would be injected when available
  ) {}

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