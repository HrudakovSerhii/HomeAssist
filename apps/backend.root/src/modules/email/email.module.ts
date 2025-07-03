import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';

import { EmailIngestionService } from './email-ingestion.service';
import { LLMModule } from '../llm/llm.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TemplateService } from '../process-template/template.service';
import { AuthService } from '../auth/auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';

@Module({
  imports: [ConfigModule, PrismaModule, LLMModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailProcessorService,
    TemplateService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
  ],
  exports: [
    EmailService,
    EmailProcessorService,
    TemplateService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
  ],
})
export class EmailModule {}
