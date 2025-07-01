import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  let controller: HealthController;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'apiPrefix') return 'api';
      if (key === 'version') return '1.0.0';
      return null;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', () => {
    const result = controller.getHealth();
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('environment', 'development');
    expect(result).toHaveProperty('version', '1.0.0');
    expect(result).toHaveProperty('apiPrefix', 'api');
  });
});