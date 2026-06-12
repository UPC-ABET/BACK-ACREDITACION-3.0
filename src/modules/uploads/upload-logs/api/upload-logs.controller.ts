import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';

import { UploadLogService } from './upload-logs.service';
import { ListUploadLogsQueryDto } from '../model/upload-logs.dtos';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@ApiTags('Uploads — History')
@Controller('uploads/upload-logs')
export class UploadLogController {
	constructor(private readonly service: UploadLogService) {}

	@Get()
	@ApiOperation({ summary: 'List upload history (audit.upload_logs) with optional filters' })
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async list(
		@Query() query: ListUploadLogsQueryDto,
		@AcademicPeriodId() academicPeriodId: number,
	) {
		return parseSuccessResponse(await this.service.listLogs(query, academicPeriodId));
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an upload log by id' })
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async find(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.findLog(id));
	}
}
