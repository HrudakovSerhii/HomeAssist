import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessorService } from './email-processor.service';
import {
  EmailBatchProcessingResult,
} from '../../types/email-processing.types';
import { EmailIngestionService } from './email-ingestion.service';
import { EmailMessage } from '../../types/email.types';
import { EmailScheduleProcessorService } from './email-schedule-processor.service';
import { ProcessingSchedule, ScheduleExecution } from '@prisma/client';

@Injectable()
export class EmailProcessingService extends EmailIngestionService {
  protected readonly logger = new Logger(EmailProcessingService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly imapService: ImapService,
    protected readonly emailProcessor: EmailProcessorService,
    private readonly scheduleProcessor: EmailScheduleProcessorService
  ) {
    super(prisma, imapService, emailProcessor);
  }

  /**
   * Process emails with user-specific schedule configuration
   * Delegates to EmailScheduleProcessorService
   */
  async processEmailsWithScheduleConfig(
    schedule: ProcessingSchedule,
    emails: EmailMessage[],
    execution: ScheduleExecution
  ): Promise<EmailBatchProcessingResult> {
    return this.scheduleProcessor.processEmailsWithScheduleConfig(
      schedule,
      emails,
      execution
    );
  }

}
