import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

import { ProjectGradesUploadService } from './project-grades-upload.service';
import { projectGradesUploadRoutes } from '../config/project-grades-upload.routes';
import { ProjectGradesUploadDto, RollbackUploadDto } from '../model/project-grades-upload.dtos';

const routes = projectGradesUploadRoutes.project_grades_upload;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ProjectGradesUploadController {
	constructor(private readonly service: ProjectGradesUploadService) {}

	@Get(routes.operation.template.route)
	@ApiOperation({ summary: routes.operation.template.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.GET })
	async template(@Query('lang') lang: string, @Res({ passthrough: false }) res: Response) {
		const { buffer, fileName } = await this.service.generateTemplate(lang);
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	@Post(routes.operation.upload.route)
	@ApiOperation({ summary: routes.operation.upload.summary })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
				lang: { type: 'string', example: 'es' },
			},
			required: ['file'],
		},
	})
	@ApiAcademicPeriodHeader()
	@UseInterceptors(FileInterceptor('file'))
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async upload(
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: ProjectGradesUploadDto,
		@CurrentUser() user: RequestUser,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(
			await this.service.processUpload(
				file.buffer,
				file.originalname,
				user.userId,
				academicPeriodId,
				dto,
			),
		);
	}

	@Post(routes.operation.rollback.route)
	@ApiOperation({ summary: routes.operation.rollback.summary })
	@ApiBody({ type: RollbackUploadDto })
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.EVALUATION, action: PERMISSION_ACTIONS.POST })
	async rollback(@Body() dto: RollbackUploadDto) {
		return parseSuccessResponse(await this.service.rollback(dto.uploadLogId));
	}
}
