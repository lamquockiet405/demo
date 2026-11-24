import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Enable CORS
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Requests from mobile apps and command-line clients may have no Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'x-tenant-id',
      'X-Tenant-Id',
      'x-requested-with',
      'X-Requested-With',
      'Range',
      'Origin',
      'Cache-Control',
      'Pragma',
      'If-Modified-Since',
      'If-None-Match',
    ],
  });

  // Global pipes, filters & interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('KidMeal API')
    .setDescription(
      'Hệ thống Quản lý Dinh dưỡng và Bữa ăn Bán trú tại Trường Mầm non theo Thông tư 28/2016/TT-BGDĐT & QĐ 1246/QĐ-BYT',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập access token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  SwaggerModule.setup('api-docs', app, document);

  // The single-container Render image also serves the Vite build on this port.
  if (process.env.FRONTEND_DIST_DIR) {
    const frontendDir = resolve(process.env.FRONTEND_DIST_DIR);
    const indexFile = join(frontendDir, 'index.html');
    if (!existsSync(indexFile)) throw new Error(`Frontend build not found: ${indexFile}`);
    app.use((req: any, res: any, next: () => void) => {
      if (req.method !== 'GET' || /^\/(api(?:\/|$)|api-docs(?:\/|$)|socket\.io(?:\/|$))/.test(req.path)) {
        return next();
      }
      const requestedFile = resolve(frontendDir, `.${req.path}`);
      const isAsset = requestedFile.startsWith(`${frontendDir}${sep}`) &&
        existsSync(requestedFile) && statSync(requestedFile).isFile();
      res.setHeader('Cache-Control', isAsset ? 'public, max-age=3600' : 'no-store');
      return res.sendFile(isAsset ? requestedFile : indexFile);
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 KidMeal Backend Server is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger API Docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
