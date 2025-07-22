import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { HealthResponse } from '@home-assist/api-types';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      success: true,
      message: 'Health check successful',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: this.configService.get('nodeEnv') || 'development',
        version: '1.0.0',
        apiPrefix: this.configService.get('apiPrefix') || 'api',
      },
    };
  }
}
