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
import { parseSuccessResponse } from 'src/libs/global.functions';

import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';
import { scrapingExportsRoutes } from '../config/scraping-exports.routes';

const routes = scrapingExportsRoutes.exports;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ScrapingExportsController {
	constructor(private readonly service: ScrapingExportsService) {}

	@Get(routes.operation.docentes.route)
	@ApiOperation({ summary: routes.operation.docentes.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async docentes(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateDocentes(academicPeriodId, lang));
	}

	@Get(routes.operation.secciones.route)
	@ApiOperation({ summary: routes.operation.secciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async secciones(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateSecciones(academicPeriodId, lang));
	}

	@Get(routes.operation.alumnosMatriculados.route)
	@ApiOperation({ summary: routes.operation.alumnosMatriculados.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosMatriculados(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosMatriculados(academicPeriodId, lang));
	}

	@Get(routes.operation.alumnosSecciones.route)
	@ApiOperation({ summary: routes.operation.alumnosSecciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosSecciones(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosSecciones(academicPeriodId, lang));
	}

	// The academic period is required here, unlike the other exports: the grades are scoped to the
	// sections already loaded for that period, and a file carrying a section the app does not know
	// makes audit.fn_upload_grades_rc reject the upload wholesale. Without the period there is
	// nothing to scope against, so failing early beats handing back an unusable file.
	@Post(routes.operation.gradesRcStart.route)
	@ApiOperation({ summary: routes.operation.gradesRcStart.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	@ApiResponse({
		status: 409,
		description: 'A grades RC export is already running; try again once it has finished',
	})
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async gradesRcStart(
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		return parseSuccessResponse(
			await this.service.startGradesRcExport(academicPeriodId, lang, user.userId),
		);
	}

	@Get(routes.operation.gradesRcStatus.route)
	@ApiOperation({ summary: routes.operation.gradesRcStatus.summary })
	@ApiParam({ name: 'jobId', description: 'Grades RC export job id', type: String })
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async gradesRcStatus(@Param('jobId') jobId: string, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(this.service.getGradesRcStatus(jobId, user.userId));
	}

	@Get(routes.operation.gradesRcDownload.route)
	@ApiOperation({ summary: routes.operation.gradesRcDownload.summary })
	@ApiParam({ name: 'jobId', description: 'Grades RC export job id', type: String })
	@ApiResponse({ status: 200, description: 'The generated grades RC workbook' })
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async gradesRcDownload(
		@Param('jobId') jobId: string,
		@CurrentUser() user: RequestUser,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, this.service.getGradesRcFile(jobId, user.userId));
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
