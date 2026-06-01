import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { UploadLogService } from './upload-logs.service';
import { parseSuccessResponse } from 'src/libs/global.functions';

@ApiTags('Uploads — History')
@Controller('uploads/upload-logs')
export class UploadLogController {
	constructor(private readonly service: UploadLogService) {}

	@Get()
	@ApiOperation({ summary: 'List upload history (audit.upload_logs) with optional filters' })
	async list(
		@Query('uploadTypeCode') uploadTypeCode?: string,
		@Query('statusCode') statusCode?: string,
		@Query('academicPeriodId') academicPeriodId?: string,
		@Query('limit') limit?: string,
		@Query('offset') offset?: string,
	) {
		return parseSuccessResponse(
			await this.service.listLogs({
				uploadTypeCode,
				statusCode,
				academicPeriodId: academicPeriodId ? Number(academicPeriodId) : undefined,
				limit: limit ? Math.min(Number(limit), 200) : 50,
				offset: offset ? Number(offset) : 0,
			}),
		);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an upload log by id' })
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.findLog(id));
	}
}
