import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	ApiSchoolHeader,
	SchoolId,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

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
	@ApiSchoolHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async docentes(
		@Query('lang') lang: string,
		@SchoolId({ optional: true }) schoolId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateDocentes(schoolId, lang));
	}

	@Get(routes.operation.secciones.route)
	@ApiOperation({ summary: routes.operation.secciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiSchoolHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async secciones(
		@Query('lang') lang: string,
		@SchoolId({ optional: true }) schoolId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateSecciones(schoolId, lang));
	}

	@Get(routes.operation.alumnosMatriculados.route)
	@ApiOperation({ summary: routes.operation.alumnosMatriculados.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiSchoolHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosMatriculados(
		@Query('lang') lang: string,
		@SchoolId({ optional: true }) schoolId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosMatriculados(schoolId, lang));
	}

	@Get(routes.operation.alumnosSecciones.route)
	@ApiOperation({ summary: routes.operation.alumnosSecciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiSchoolHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosSecciones(
		@Query('lang') lang: string,
		@SchoolId({ optional: true }) schoolId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosSecciones(schoolId, lang));
	}

	private send(res: Response, { buffer, fileName }: GeneratedExcel): void {
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}
}
