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
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { S3Service } from './s3.service';
import { SwaggerS3Controller, SwaggerS3GetSize, SwaggerS3Upload } from './docs/s3.swagger';
import { s3ValidationStrings } from '../config/strings/s3.validation';

@SwaggerS3Controller()
export class S3Controller {
	constructor(private readonly s3Service: S3Service) {}

	@SwaggerS3Upload()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.POST })
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
	async upload(@Query('key') key: string, @UploadedFile() file: Express.Multer.File) {
		if (!key) throw new BadRequestException(s3ValidationStrings.error.keyRequired);
		if (!file) throw new BadRequestException(s3ValidationStrings.error.fileRequired);

		await this.s3Service.uploadBuffer(key, file.buffer);
		return parseSuccessResponse({ key });
	}

	@SwaggerS3GetSize()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	@HttpCode(HttpStatus.OK)
	async getSize(@Body() prefixes: string[]) {
		if (!Array.isArray(prefixes) || prefixes.length === 0) {
			throw new BadRequestException(s3ValidationStrings.error.prefixRequired);
		}
		return parseSuccessResponse(await this.s3Service.getSize(prefixes));
	}
}
