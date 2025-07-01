import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (must be before global prefix)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Enable CORS
  app.enableCors();

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global prefix (after static assets)
  const port = process.env.PORT || 4000;
  const prefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(prefix);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/${prefix}`);
}

bootstrap().finally();
