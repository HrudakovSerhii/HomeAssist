import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DataPreviewController } from './data-preview.controller';
import { DataPreviewService } from './data-preview.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [DataPreviewController],
  providers: [
    DataPreviewService,
  ],
  exports: [
    DataPreviewService,
  ],
})
export class DataPreviewModule {}
