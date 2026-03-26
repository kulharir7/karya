// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.use(cookieParser());
  // Enable CORS for frontend dev server
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  await app.listen(4000);
  console.log('🚀 API listening on http://localhost:4000');
}
bootstrap();
