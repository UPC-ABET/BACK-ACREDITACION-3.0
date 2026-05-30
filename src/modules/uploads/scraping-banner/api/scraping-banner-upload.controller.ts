import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { ScrapingBannerUploadService } from './scraping-banner-upload.service';
import { scrapingBannerUploadRoutes } from '../config/scraping-banner-upload.routes';
import { ScrapingBannerUploadDto, RollbackUploadDto } from '../model/scraping-banner-upload.dtos';

const routes = scrapingBannerUploadRoutes.scraping_banner_upload;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ScrapingBannerUploadController {
	constructor(private readonly service: ScrapingBannerUploadService) {}

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
	async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: ScrapingBannerUploadDto) {
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
