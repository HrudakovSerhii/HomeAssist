import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import { EmailGateway } from './email.gateway';

import { EmailIngestionService } from './email-ingestion.service';
import { LLMModule } from '../llm/llm.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TemplateService } from '../process-template/template.service';
import { TemplateValidatorService } from '../process-template/template-validator.service';
import { EntityValueParserService } from '../process-template/entity-value-parser.service';
import { DynamicEntityManagerService } from '../process-template/dynamic-entity-manager.service';
import { DynamicEntityTypesController } from '../process-template/dynamic-entity-types.controller';
import { AuthService } from '../auth/auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';

@Module({
  imports: [ConfigModule, PrismaModule, LLMModule],
  controllers: [EmailController, DynamicEntityTypesController],
  providers: [
    EmailService,
    EmailProcessorService,
    TemplateService,
    TemplateValidatorService,
    EntityValueParserService,
    DynamicEntityManagerService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
    EmailGateway,
  ],
  exports: [
    EmailService,
    EmailProcessorService,
    TemplateService,
    TemplateValidatorService,
    EntityValueParserService,
    DynamicEntityManagerService,
    AuthService,
    ImapService,
    EncryptionService,
    EmailIngestionService,
    EmailGateway,
  ],
})
export class EmailModule {}
