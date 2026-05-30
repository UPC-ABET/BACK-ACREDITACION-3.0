import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { DelegatesUploadService } from './delegates-upload.service';
import { delegatesUploadRoutes } from '../config/delegates-upload.routes';
import { DelegatesUploadDto, RollbackUploadDto } from '../model/delegates-upload.dtos';

const routes = delegatesUploadRoutes.delegates_upload;

@ApiTags(routes.tag)
@Controller(routes.route)
export class DelegatesUploadController {
	constructor(private readonly service: DelegatesUploadService) {}

	@Post(routes.operation.upload.route)
	@ApiOperation({ summary: routes.operation.upload.summary })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
				academic_period_id: { type: 'number' },
				user_id: { type: 'number' },
			},
			required: ['file', 'academic_period_id'],
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	@HttpCode(HttpStatus.OK)
	async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: DelegatesUploadDto) {
		return parseSuccessResponse(await this.service.processUpload(file.buffer, file.originalname, dto));
	}

	@Post(routes.operation.rollback.route)
	@ApiOperation({ summary: routes.operation.rollback.summary })
	@ApiBody({ type: RollbackUploadDto })
	@HttpCode(HttpStatus.OK)
	async rollback(@Body() dto: RollbackUploadDto) {
		return parseSuccessResponse(await this.service.rollback(dto.upload_log_id));
	}
}
