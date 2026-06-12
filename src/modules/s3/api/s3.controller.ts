import {
	BadRequestException,
	Body,
	HttpCode,
	HttpStatus,
	Query,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { S3Service } from './s3.service';
import { SwaggerS3Controller, SwaggerS3GetSize, SwaggerS3Upload } from './docs/s3.swagger';

@SwaggerS3Controller()
export class S3Controller {
	constructor(private readonly s3Service: S3Service) {}

	@SwaggerS3Upload()
	@ApiQuery({
		name: 'key',
		required: true,
		description: 'Object path/key in S3 (e.g. EISC/2025-1/project123/doc.pdf)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: { file: { type: 'string', format: 'binary' } },
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	async upload(@Query('key') key: string, @UploadedFile() file: any): Promise<string> {
		if (!key) throw new BadRequestException('The "key" query parameter is required.');
		if (!file) throw new BadRequestException('No file was found in the form-data.');

		await this.s3Service.uploadBuffer(key, file.buffer as Buffer);
		return `Uploaded successfully: ${key}`;
	}

	@SwaggerS3GetSize()
	@HttpCode(HttpStatus.OK)
	async getSize(@Body() prefixes: string[]) {
		if (!Array.isArray(prefixes) || prefixes.length === 0) {
			throw new BadRequestException('At least one prefix must be provided.');
		}
		return this.s3Service.getSize(prefixes);
	}
}
