import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    
    const message = exception instanceof HttpException
      ? (typeof exception.getResponse() === 'string' 
          ? exception.getResponse() 
          : (exception.getResponse() as any).message || exception.message)
      : exception instanceof Error
      ? exception.message
      : 'Internal server error';
    
    console.error(`[${request.method}] ${request.url} - Error:`, message, exception);
    
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      error: exception instanceof HttpException ? exception.name : 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

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

  // Global exception filter for better error messages
  app.useGlobalFilters(new AllExceptionsFilter());

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Dashboard available at: http://localhost:${port}/dashboard.html`);
  console.log(`Login page available at: http://localhost:${port}/index.html`);
}

bootstrap();
