import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  // Serve static files (HTML) from root directory
  app.useStaticAssets(join(__dirname, '..'), {
    index: false,
  });

  // Enable CORS for browser testing
  app.enableCors({
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  });

  // Global validation pipe - COMMENTED OUT temporarily to allow login without password
  // TODO: Re-enable and apply validation per-route where DTOs are explicitly used
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: false,
  //     transform: true,
  //     skipMissingProperties: true,
  //     skipNullProperties: true,
  //     skipUndefinedProperties: true,
  //   }),
  // );

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Dashboard available at: http://localhost:${port}/dashboard.html`);
  console.log(`Login page available at: http://localhost:${port}/index.html`);
}

bootstrap();
