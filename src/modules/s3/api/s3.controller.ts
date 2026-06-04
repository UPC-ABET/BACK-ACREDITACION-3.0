import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { S3Service } from './s3.service';

@ApiTags('s3')
@Controller('s3')
export class S3Controller {
	constructor(private readonly s3Service: S3Service) {}

	@Post('upload')
	@ApiOperation({ summary: 'Sube un archivo a S3 (multipart para >5MiB, PUT simple para el resto)' })
	@ApiQuery({ name: 'key', required: true, description: 'Ruta/nombre del objeto en S3 (ej: EISC/2025-1/proyecto123/doc.pdf)' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: { file: { type: 'string', format: 'binary' } },
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	async upload(
		@Query('key') key: string,
		@UploadedFile() file: any,
	): Promise<string> {
		if (!key) throw new BadRequestException('El parámetro "key" es requerido.');

		if (!file) {
			throw new BadRequestException('No se encontró ningún archivo en el form-data.');
		}

		await this.s3Service.uploadBuffer(key, file.buffer as Buffer);
		return `Se subió correctamente: ${key}`;
	}

	@Post('size-total')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Calcula el tamaño total de uno o más prefijos en S3' })
	async getTotalSize(@Body() prefixes: string[]) {
		if (!Array.isArray(prefixes) || prefixes.length === 0) {
			throw new BadRequestException('Se debe proporcionar al menos un prefijo.');
		}
		return this.s3Service.getSize(prefixes);
	}
}
