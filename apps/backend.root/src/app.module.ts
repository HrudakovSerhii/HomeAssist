import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { DataPreviewModule } from './modules/data-preview/data-preview.module';
import { AuthModule } from './modules/auth/auth.module';
import { LLMModule } from './modules/llm/llm.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    PrismaModule,
    EmailModule,
    HealthModule,
    DataPreviewModule,
    AuthModule,
    LLMModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
