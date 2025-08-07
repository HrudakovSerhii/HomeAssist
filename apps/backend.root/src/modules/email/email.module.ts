import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailGateway } from './email.gateway';

import { EmailIngestionService } from './email-ingestion.service';
import { EmailProcessingService } from './email-processing.service';
import { EmailPriorityService } from './email-priority.service';
import { EmailAnalysisService } from './email-analysis.service';
import { EmailScheduleProcessorService } from './email-schedule-processor.service';
import { LLMModule } from '../llm/llm.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProcessTemplateModule } from '../process-template/process-template.module';
import { AuthService } from '../auth/auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';
import { ExecutionTrackingService } from '../processing-schedule/execution-tracking.service';

@Module({
  imports: [ConfigModule, PrismaModule, LLMModule, ProcessTemplateModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailProcessorService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
    EmailProcessingService,
    EmailPriorityService,
    EmailAnalysisService,
    EmailScheduleProcessorService,
    ExecutionTrackingService,
    EmailGateway,
  ],
  exports: [
    EmailService,
    EmailProcessorService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
    EmailProcessingService,
    EmailPriorityService,
    EmailAnalysisService,
    EmailScheduleProcessorService,
    ExecutionTrackingService,
    EmailGateway,
  ],
})
export class EmailModule {}
