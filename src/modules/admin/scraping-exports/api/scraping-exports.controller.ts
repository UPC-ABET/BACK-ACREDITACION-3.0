import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';
import { scrapingExportsRoutes } from '../config/scraping-exports.routes';

const routes = scrapingExportsRoutes.exports;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ScrapingExportsController {
	private readonly logger = new Logger(ScrapingExportsController.name);

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
	@Get(routes.operation.gradesRc.route)
	@ApiOperation({ summary: routes.operation.gradesRc.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async gradesRc(
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		// Written into `res` as it is produced rather than buffered — see
		// ScrapingExportsService.prepareGradesRc. The query has already succeeded by the time this
		// resolves, so a failure to build the rows still gets a normal error response.
		const { fileName, write } = await this.service.prepareGradesRc(academicPeriodId, lang);

		// No Content-Length: the file size isn't known until the stream finishes.
		this.setDownloadHeaders(res, fileName);

		try {
			await write(res);
		} catch (error) {
			this.logger.error(
				`Grades RC export failed after the download had started (period ${academicPeriodId})`,
				error instanceof Error ? error.stack : String(error),
			);
			res.destroy(error instanceof Error ? error : new Error(String(error)));
		}
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
