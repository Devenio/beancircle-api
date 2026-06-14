import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get('NODE_ENV') === 'production';

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance().set('json limit', '1mb');

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Bean Circle API')
      .setDescription('Cafe Community MVP REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
  if (!isProd) console.log(`Swagger UI at http://localhost:${port}/docs`);
}
bootstrap();
