import {
  Controller,
  Get,
  Body,
  Query,
  Post,
  Logger,
  Put,
  BadRequestException,
  Param,
  Delete,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { ProcessingScheduleService } from './processing-schedule.service';
import { ScheduleOrchestratorService } from './schedule-orchestrator.service';
import {
  CreateProcessingScheduleDto,
  CronJobCalendarEntry,
  ProcessingAnalytics,
  EnhancedProcessingAnalytics,
  ProcessingScheduleWithAccount,
  ScheduleExecutionStatus,
  UpdateProcessingScheduleDto,
  ValidationResult,
} from '../../types/schedule.types';
import { ProcessingSchedule } from '@prisma/client';

@Controller('processing-schedules')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProcessingSchedulesController {
  private readonly logger = new Logger(ProcessingSchedulesController.name);

  constructor(
    private readonly processingScheduleService: ProcessingScheduleService,
    private readonly executionSchedulingService: ScheduleOrchestratorService
  ) {}

  @Get()
  async getUserProcessingSchedules(
    @Query('userId') userId: string
  ): Promise<ProcessingScheduleWithAccount[]> {
    return this.processingScheduleService.getUserSchedules(userId);
  }

  @Post()
  async createProcessingSchedule(
    @Body() dto: CreateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate schedule configuration and check for conflicts
    const validation =
      await this.processingScheduleService.validateScheduleConfiguration(dto);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Schedule validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
        cronConflicts: validation.cronConflicts,
      });
    }

    return this.processingScheduleService.createProcessingSchedule(dto);
  }

  @Put(':id')
  async updateProcessingSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Validate updated schedule configuration and check for conflicts
    const validation =
      await this.processingScheduleService.validateScheduleConfiguration(
        dto,
        id
      );

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Schedule validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
        cronConflicts: validation.cronConflicts,
      });
    }

    return this.processingScheduleService.updateProcessingSchedule(id, dto);
  }

  @Delete(':id')
  async deleteProcessingSchedule(
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    await this.processingScheduleService.deleteProcessingSchedule(id);
    return { success: true };
  }

  @Post(':id/execute')
  async executeScheduleManually(
    @Param('id') id: string
  ): Promise<{ success: boolean; executionId: string }> {
    const schedule = await this.processingScheduleService.getScheduleById(id);

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const execution = await this.executionSchedulingService.executeSchedule(
      schedule
    );

    return { success: true, executionId: execution.id };
  }

  @Get(':id/status')
  async getScheduleExecutionStatus(
    @Param('id') id: string
  ): Promise<ScheduleExecutionStatus> {
    return this.processingScheduleService.getScheduleExecutionStatus(id);
  }

  @Post('validate')
  async validateScheduleConfiguration(
    @Body() dto: CreateProcessingScheduleDto,
    @Query('excludeId') excludeId?: string
  ): Promise<ValidationResult> {
    return this.processingScheduleService.validateScheduleConfiguration(
      dto,
      excludeId
    );
  }

  @Post('check-conflicts')
  async checkScheduleConflicts(
    @Body()
    body: {
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
      const cronConflicts =
        await this.processingScheduleService.checkCronExecutionConflicts(
          body.cronExpression,
          body.timezone,
          body.excludeId
        );
      conflicts.push(...cronConflicts);
    }

    // Check specific date conflicts
    if (body.specificDates) {
      const dateConflicts =
        await this.processingScheduleService.checkSpecificDateConflicts(
          body.specificDates.map((d) => new Date(d)),
          body.excludeId
        );

      conflicts.push(
        ...dateConflicts.map((date) => ({
          conflictTime: date,
          conflictingSchedules: [],
          suggestedAlternatives:
            this.processingScheduleService.suggestAlternativeExecutionTimes(
              date
            ),
        }))
      );
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  @Get('cron-calendar')
  async getCronJobCalendar(): Promise<CronJobCalendarEntry[]> {
    return this.processingScheduleService.getCronJobCalendar();
  }

  @Get('analytics/:userId')
  async getProcessingAnalytics(
    @Param('userId') userId: string
  ): Promise<ProcessingAnalytics> {
    return this.processingScheduleService.getProcessingAnalytics(userId);
  }

  // ============================================================================
  // ENHANCED API METHODS (from Stage 3 API endpoints document)
  // ============================================================================

  /**
   * ENHANCED: Bulk operations for multiple schedules
   */
  @Post('bulk-enable')
  async bulkEnableSchedules(
    @Body() body: { scheduleIds: string[] }
  ): Promise<{ success: boolean; updatedCount: number; errors?: string[] }> {
    try {
      const results = await Promise.allSettled(
        body.scheduleIds.map((id) =>
          this.processingScheduleService.updateProcessingSchedule(id, {
            isEnabled: true,
          })
        )
      );

      const errors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        )
        .map((result) => result.reason?.message || 'Unknown error');

      return {
        success: errors.length === 0,
        updatedCount: results.filter((result) => result.status === 'fulfilled')
          .length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to bulk enable schedules:', error);
      throw new BadRequestException('Failed to bulk enable schedules');
    }
  }

  @Post('bulk-disable')
  async bulkDisableSchedules(
    @Body() body: { scheduleIds: string[] }
  ): Promise<{ success: boolean; updatedCount: number; errors?: string[] }> {
    try {
      const results = await Promise.allSettled(
        body.scheduleIds.map((id) =>
          this.processingScheduleService.updateProcessingSchedule(id, {
            isEnabled: false,
          })
        )
      );

      const errors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        )
        .map((result) => result.reason?.message || 'Unknown error');

      return {
        success: errors.length === 0,
        updatedCount: results.filter((result) => result.status === 'fulfilled')
          .length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to bulk disable schedules:', error);
      throw new BadRequestException('Failed to bulk disable schedules');
    }
  }

  /**
   * ENHANCED: Detailed schedule information with execution statistics
   */
  @Get(':id/details')
  async getScheduleDetails(@Param('id') id: string): Promise<any> {
    const schedule = await this.processingScheduleService.getScheduleById(id);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Get execution statistics
    const executionStats = {
      totalExecutions: schedule.totalExecutions || 0,
      successfulExecutions: schedule.successfulExecutions || 0,
      failedExecutions: schedule.failedExecutions || 0,
      averageProcessingTime: undefined, // Would be calculated from execution history
      lastExecutionAt: schedule.lastExecutedAt,
    };

    return {
      ...schedule,
      executionStats,
    };
  }
}
