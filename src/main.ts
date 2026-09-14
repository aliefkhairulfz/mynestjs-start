import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { HttpCustomValidationPipe } from './utils/pipes.js';
import { HttpExceptionFilter } from './utils/filters.js';
import { HttpResponseInterceptor } from './utils/interceptors.js';

/**
 * Bootstraps the NestJS application.
 * Configures middleware, global pipes for validation, exception filters,
 * and response interceptors before starting the server.
 */
async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule, {
        instrument: ObserveInstrument
        // logger: false
    });

    app.use(cookieParser());
    app.useGlobalPipes(new HttpCustomValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new HttpResponseInterceptor(app.get(Reflector)));

    app.enableCors({
        origin: [process.env.FRONTEND_URL],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
        credentials: true,
        maxAge: 300
    });

    const config = new DocumentBuilder().setTitle('API Documentation').setDescription('API documentation for the NestJS application').setVersion('1.0').addBearerAuth().build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory);

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`🚀 Application is running on: http://localhost:${port}`);
    logger.log(`📚 Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
await bootstrap();
