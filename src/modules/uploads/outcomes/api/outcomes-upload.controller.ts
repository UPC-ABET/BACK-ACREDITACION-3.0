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
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

import { OutcomesUploadService } from './outcomes-upload.service';
import { outcomesUploadRoutes } from '../config/outcomes-upload.routes';
import { OutcomesUploadDto, RollbackUploadDto } from '../model/outcomes-upload.dtos';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

const routes = outcomesUploadRoutes.outcomes_upload;

const ADMIN_MODULE = 'ADMIN';

@ApiTags(routes.tag)
@Controller(routes.route)
export class OutcomesUploadController {
	constructor(private readonly service: OutcomesUploadService) {}

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
				lang: { type: 'string', example: 'es' },
			},
			required: ['file'],
		},
	})
	@ApiAcademicPeriodHeader()
	@UseInterceptors(FileInterceptor('file'))
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: ADMIN_MODULE, action: 'POST' })
	async upload(
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: OutcomesUploadDto,
		@AcademicPeriodId() academicPeriodId: number,
		@Req() req: any,
	) {
		return parseSuccessResponse(
			await this.service.processUpload(
				file.buffer,
				file.originalname,
				req.user.userId,
				academicPeriodId,
				dto,
			),
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
