import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailGateway } from './email.gateway';

import { EmailIngestionService } from './email-ingestion.service';
import { LLMModule } from '../llm/llm.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProcessTemplateModule } from '../process-template/process-template.module';
import { AuthService } from '../auth/auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';

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
    EmailGateway,
  ],
  exports: [
    EmailService,
    EmailProcessorService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
    EmailGateway,
  ],
})
export class EmailModule {}
