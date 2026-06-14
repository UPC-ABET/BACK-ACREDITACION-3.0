import { Body, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseOutcomeMappingController,
	SwaggerCourseOutcomeMappingCreate,
	SwaggerCourseOutcomeMappingUpdate,
	SwaggerCourseOutcomeMappingDelete,
	SwaggerCourseOutcomeMappingGetAll,
	SwaggerCourseOutcomeMappingGetById,
	SwaggerCourseOutcomeMappingGetByFilters,
	SwaggerCourseOutcomeMappingMaintenanceView,
	SwaggerCourseOutcomeMappingMaintenanceBulkSave,
	SwaggerCourseOutcomeMappingMaintenanceExport,
} from './docs/course-outcome-mappings.swagger';
import { CourseOutcomeMappingService } from './course-outcome-mappings.service';
import { ArticulationReportService } from './articulation-report.service';
import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingDto,
	CourseOutcomeMappingViewDto,
	BulkSaveCourseOutcomeMappingDto,
	ExportCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerCourseOutcomeMappingController()
export class CourseOutcomeMappingController extends BaseController<CourseOutcomeMappingService> {
	constructor(
		private readonly service: CourseOutcomeMappingService,
		private readonly reportService: ArticulationReportService,
	) {
		super(service);
	}

	@SwaggerCourseOutcomeMappingCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateCourseOutcomeMappingDto) {
		return await super.create(dto);
	}

	@SwaggerCourseOutcomeMappingUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseOutcomeMappingDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseOutcomeMappingDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseOutcomeMappingGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseOutcomeMappingGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseOutcomeMappingGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterCourseOutcomeMappingDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerCourseOutcomeMappingMaintenanceView()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async maintenanceView(@Body() dto: CourseOutcomeMappingViewDto) {
		return parseSuccessResponse(await this.service.getMaintenanceView(dto.programCommissionId));
	}

	@SwaggerCourseOutcomeMappingMaintenanceBulkSave()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async maintenanceBulkSave(@Body() dto: BulkSaveCourseOutcomeMappingDto) {
		return parseSuccessResponse(await this.service.bulkSaveMaintenance(dto));
	}

	@SwaggerCourseOutcomeMappingMaintenanceExport()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async maintenanceExport(
		@Body() dto: ExportCourseOutcomeMappingDto,
		@Res({ passthrough: false }) res: Response,
	) {
		const lang = dto.lang ?? 'es';
		const { pdf, filename } = await this.reportService.generatePdf(dto.programCommissionId, lang);
		const encoded = encodeURIComponent(filename);
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
		);
		res.setHeader('Content-Length', pdf.length.toString());
		res.end(pdf);
	}
}
