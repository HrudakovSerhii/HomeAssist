import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../encrypt/encryption.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, ImapService, EncryptionService],
  exports: [AuthService, ImapService, EncryptionService],
})
export class AuthModule {}
