import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProcessTemplateModule } from '../process-template/process-template.module';
import { ProcessingScheduleService } from '../processing-schedule/processing-schedule.service';

@Module({
  imports: [PrismaModule, ProcessTemplateModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    ImapService,
    EncryptionService,
    ProcessingScheduleService,
  ],
  exports: [AuthService, ImapService, EncryptionService],
})
export class AuthModule {}
