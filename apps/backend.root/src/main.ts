import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure Socket.IO adapter with CORS settings
  const ioAdapter = new IoAdapter(app);
  ioAdapter.createIOServer = function(port: number, options?: any) {
    const server = this.httpServer;
    const io = require('socket.io')(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      ...options,
    });
    return io;
  };
  app.useWebSocketAdapter(ioAdapter);

  // Serve static files (must be before global prefix)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Enable CORS for HTTP
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  });

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
  console.log(`WebSocket server is running on: ws://localhost:${port}`);
}

bootstrap().finally();
