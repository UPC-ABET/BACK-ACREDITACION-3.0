import { Body, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { S3Service } from './s3.service';
import { S3SizeTotalRequestDto } from '../model/s3.dtos';

@ApiTags('Storage S3')
@Controller('s3')
export class S3Controller {
	constructor(private readonly service: S3Service) {}

	@Post('upload')
	@UseInterceptors(FileInterceptor('file'))
	@ApiConsumes('multipart/form-data')
	@ApiOperation({ summary: 'Subir un archivo a Amazon S3' })
	@ApiQuery({ name: 'key', description: 'Ruta/clave dentro del bucket', required: true, type: String })
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
			},
		},
	})
	async upload(@Query('key') key: string, @UploadedFile() file: any) {
		return parseSuccessResponse(await this.service.uploadStream(key, file));
	}

	@Post('size-total')
	@ApiOperation({ summary: 'Calcular tamaño total de prefijos en S3' })
	async sizeTotal(@Body() dto: S3SizeTotalRequestDto | string[]) {
		const prefixes = Array.isArray(dto) ? dto : (dto?.prefixes ?? []);
		return parseSuccessResponse(await this.service.getTotalSize(prefixes));
	}
}
