import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { UploadLogService } from './upload-logs.service';
import { parseSuccessResponse } from 'src/libs/global.functions';

// Vista 4.3 — historial cronológico de cargas. Lectura desde audit.upload_logs.
@ApiTags('Cargas — Historial')
@Controller('uploads/upload-logs')
export class UploadLogController {
	constructor(private readonly service: UploadLogService) {}

	// GET /uploads/upload-logs?upload_type=SECCION&status=COMPLETED&academic_period_id=1&limit=50&offset=0
	@Get()
	@ApiOperation({ summary: 'Listar historial de cargas (audit.upload_logs) con filtros opcionales' })
	async list(
		@Query('upload_type') uploadType?: string,
		@Query('status') status?: string,
		@Query('academic_period_id') academicPeriodId?: string,
		@Query('limit') limit?: string,
		@Query('offset') offset?: string,
	) {
		return parseSuccessResponse(
			await this.service.listLogs({
				uploadType,
				status,
				academicPeriodId: academicPeriodId ? Number(academicPeriodId) : undefined,
				limit: limit ? Math.min(Number(limit), 200) : 50,
				offset: offset ? Number(offset) : 0,
			}),
		);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Obtener un registro de carga por id' })
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.findLog(id));
	}
}
