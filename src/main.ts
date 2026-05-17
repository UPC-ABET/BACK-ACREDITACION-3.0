import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		logger: ['error', 'warn'], // 👈 solo errores y warnings
	});
	const configService = app.get(ConfigService);
	const port = configService.get<number>('APP_PORT') ?? 7777;

	app.setGlobalPrefix('api'); // 🔥 ESTA ES LA CLAVE

	app.use(cookieParser());

	app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

	// Habilitar CORS con opciones básicas
	app.enableCors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true);

			const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:6666', 'http://127.0.0.1:6666', 'http://localhost:7777', 'http://127.0.0.1:7777'];

			if (allowedOrigins.includes(origin) || origin.endsWith('.base.com')) {
				callback(null, true);
			} else {
				callback(new Error('Not allowed by CORS'));
			}
		},
		exposedHeaders: ['Content-Disposition'],
		credentials: true,
	});

	//Habilitamos Validation Pipe
	app.useGlobalPipes(new ValidationPipe());

	// Configuración de Swagger

	const config = new DocumentBuilder().setTitle('API Base').setDescription('API Base para UPC').setVersion('1.0').addBearerAuth().build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document);

	await app.listen(port);

	const url = await app.getUrl();

	console.log(`🚀🚀🚀🚀🚀 API lista y corriendo en ${url} ✅✅✅✅✅`);
}
void bootstrap();
