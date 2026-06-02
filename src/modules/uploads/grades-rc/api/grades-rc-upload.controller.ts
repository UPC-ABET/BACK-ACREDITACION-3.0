import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Req,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

import { GradesRcUploadService } from './grades-rc-upload.service';
import { gradesRcUploadRoutes } from '../config/grades-rc-upload.routes';
import { GradesRcUploadDto, RollbackUploadDto } from '../model/grades-rc-upload.dtos';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

const routes = gradesRcUploadRoutes.grades_rc_upload;

const ADMIN_MODULE = 'ADMIN';

@ApiTags(routes.tag)
@Controller(routes.route)
export class GradesRcUploadController {
	constructor(private readonly service: GradesRcUploadService) {}

	@Get(routes.operation.template.route)
	@ApiOperation({ summary: routes.operation.template.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@RequirePermission({ module: ADMIN_MODULE, action: 'GET' })
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
				academicPeriodId: { type: 'number' },
				lang: { type: 'string', example: 'es' },
			},
			required: ['file', 'academicPeriodId'],
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async upload(
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: GradesRcUploadDto,
		@Req() req: any,
	) {
		return parseSuccessResponse(
			await this.service.processUpload(file.buffer, file.originalname, req.user.userId, dto),
		);
	}

	@Post(routes.operation.rollback.route)
	@ApiOperation({ summary: routes.operation.rollback.summary })
	@ApiBody({ type: RollbackUploadDto })
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async rollback(@Body() dto: RollbackUploadDto) {
		return parseSuccessResponse(await this.service.rollback(dto.uploadLogId));
	}
}
