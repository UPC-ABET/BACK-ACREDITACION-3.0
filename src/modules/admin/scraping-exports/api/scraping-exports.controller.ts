import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';
import { NotFoundError } from 'src/commons/domain-error';
import { parseSuccessResponse } from 'src/libs/global.functions';

import { ScrapingExportGenerationService } from './scraping-export-generation.service';
import type { GeneratedExcel } from './scraping-exports.service';
import { scrapingExportsRoutes } from '../config/scraping-exports.routes';
import { EXPORT_TYPE_PARAM_VALUES, parseExportTypeParam } from '../model/scraping-exports.dtos';
import { DEFAULT_TEMPLATE_LANGUAGE } from '../model/scraping-exports.labels';
import { ScrapingExportStatusResponseDto } from '../model/scraping-exports.response.dtos';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';

const routes = scrapingExportsRoutes.exports;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ScrapingExportsController {
	constructor(private readonly generationService: ScrapingExportGenerationService) {}

	@Get(routes.operation.status.route)
	@ApiOperation({ summary: routes.operation.status.summary })
	@ApiParam({ name: 'exportType', enum: [...EXPORT_TYPE_PARAM_VALUES] })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	@ApiResponse({ status: 200, type: ScrapingExportStatusResponseDto })
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async status(
		@Param('exportType') exportTypeParam: string,
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		const exportType = parseExportTypeParam(exportTypeParam);
		const periodo = await this.resolvePeriodo(academicPeriodId);
		return parseSuccessResponse(
			await this.generationService.getStatus(exportType, periodo, this.resolveLang(lang)),
		);
	}

	// The academic period is required here, unlike the module's previous synchronous export GETs:
	// generation is keyed on a specific periodo, so a missing scope means there is nothing to look
	// up rather than something to fall back on.
	@Get(routes.operation.download.route)
	@ApiOperation({ summary: routes.operation.download.summary })
	@ApiParam({ name: 'exportType', enum: [...EXPORT_TYPE_PARAM_VALUES] })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	@ApiResponse({ status: 200, description: 'The last successfully generated export file' })
	@ApiResponse({
		status: 404,
		description: 'No successful generation exists yet for this export/period/lang',
	})
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async download(
		@Param('exportType') exportTypeParam: string,
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		const exportType = parseExportTypeParam(exportTypeParam);
		const periodo = await this.resolvePeriodo(academicPeriodId);
		const result = await this.generationService.download(
			exportType,
			periodo,
			this.resolveLang(lang),
		);
		if (!result) {
			throw new NotFoundError(scrapingExportsValidationStrings.error.notGenerated);
		}
		this.send(res, { buffer: result.fileBytes, fileName: result.fileName });
	}

	@Post(routes.operation.regenerate.route)
	@ApiOperation({ summary: routes.operation.regenerate.summary })
	@ApiParam({ name: 'exportType', enum: [...EXPORT_TYPE_PARAM_VALUES] })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	@ApiResponse({ status: 200, type: ScrapingExportStatusResponseDto })
	@ApiResponse({
		status: 409,
		description: 'This export is already being generated; try again once it has finished',
	})
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async regenerate(
		@Param('exportType') exportTypeParam: string,
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		const exportType = parseExportTypeParam(exportTypeParam);
		const periodo = await this.resolvePeriodo(academicPeriodId);
		return parseSuccessResponse(
			await this.generationService.regenerate(
				exportType,
				periodo,
				this.resolveLang(lang),
				`user:${user.userId}`,
			),
		);
	}

	private resolveLang(lang: string): string {
		return lang || DEFAULT_TEMPLATE_LANGUAGE;
	}

	private async resolvePeriodo(academicPeriodId: number): Promise<string> {
		const periodo = await this.generationService.resolvePeriodo(academicPeriodId);
		if (!periodo) {
			throw new NotFoundError(scrapingExportsValidationStrings.error.periodNotFound);
		}
		return periodo;
	}

	private send(res: Response, { buffer, fileName }: GeneratedExcel): void {
		this.setDownloadHeaders(res, fileName);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	private setDownloadHeaders(res: Response, fileName: string): void {
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
	}
}
