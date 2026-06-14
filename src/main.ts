import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, LogLevel, Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

const LOG_LEVELS: Record<string, LogLevel[]> = {
	error: ['error'],
	warn: ['error', 'warn'],
	log: ['error', 'warn', 'log'],
	debug: ['error', 'warn', 'log', 'debug'],
	verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
};

async function bootstrap() {
	const logLevel = process.env.LOG_LEVEL ?? 'log';
	const app = await NestFactory.create(AppModule, {
		logger: LOG_LEVELS[logLevel] ?? LOG_LEVELS.log,
	});
	const configService = app.get(ConfigService);
	const port = configService.getOrThrow<number>('APP_PORT');

	app.setGlobalPrefix('api');

	// Base64-encoded Excel uploads (bulk survey import) exceed the 100kb Express
	// default, so raise the JSON/urlencoded body limit.
	app.use(json({ limit: '25mb' }));
	app.use(urlencoded({ limit: '25mb', extended: true }));

	app.use(cookieParser(configService.get<string>('COOKIE_SECRET')));

	app.useGlobalFilters(new AllExceptionsFilter());
	app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

	const corsRaw = configService.get<string>('CORS_ALLOWED_ORIGINS', '');
	const frontendUrl = configService.get<string>('APP_FRONTEND_URL', '');
	const allowedOrigins = [corsRaw, frontendUrl]
		.join(',')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	if (allowedOrigins.length === 0) {
		throw new Error(
			'No valid CORS origins configured. Set APP_FRONTEND_URL or CORS_ALLOWED_ORIGINS.',
		);
	}

	app.enableCors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(null, false);
			}
		},
		exposedHeaders: ['Content-Disposition'],
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			transformOptions: { enableImplicitConversion: true },
		}),
	);

	const nodeEnv = configService.get<string>('NODE_ENV');

	if (nodeEnv !== 'production') {
		const config = new DocumentBuilder()
			.setTitle('API Base')
			.setDescription('API Base para UPC')
			.setVersion('1.0')
			.addBearerAuth(
				{
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
				'bearer',
			)
			.addSecurityRequirements('bearer')
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('docs', app, document);
	}

	await app.listen(port);

	const url = await app.getUrl();

	new Logger('Bootstrap').log(`API running at ${url}`);
}
void bootstrap();
