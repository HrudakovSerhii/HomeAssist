import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessingSchedulesController } from './processing-schedule.controller';
import { ProcessingScheduleService } from './processing-schedule.service';
import { ScheduleOrchestratorService } from './schedule-orchestrator.service';
import { ExecutionTrackingService } from './execution-tracking.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    LLMModule,
  ],
  controllers: [ProcessingSchedulesController],
  providers: [ProcessingScheduleService, ScheduleOrchestratorService, ExecutionTrackingService],
  exports: [ProcessingScheduleService, ScheduleOrchestratorService, ExecutionTrackingService],
})
export class ProcessingScheduleModule {} 