import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { StudyPlansUploadService } from './study-plans-upload.service';
import { studyPlansUploadRoutes } from '../config/study-plans-upload.routes';
import { StudyPlansUploadDto, RollbackUploadDto } from '../model/study-plans-upload.dtos';

const routes = studyPlansUploadRoutes.study_plans_upload;

@ApiTags(routes.tag)
@Controller(routes.route)
export class StudyPlansUploadController {
	constructor(private readonly service: StudyPlansUploadService) {}

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
	async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: StudyPlansUploadDto) {
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
