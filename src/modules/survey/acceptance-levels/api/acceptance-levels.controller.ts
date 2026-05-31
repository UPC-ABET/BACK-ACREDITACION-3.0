import { Body } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PerformanceLevelService } from './acceptance-levels.service';
import {
	SwaggerPerformanceLevelsController,
	SwaggerPerformanceLevelsList,
	SwaggerPerformanceLevelsBulkUpdate,
	SwaggerPerformanceLevelsGenerateDefaults,
} from './docs/acceptance-levels.swagger';
import {
	FilterPerformanceLevelDto,
	BulkUpdatePerformanceLevelsDto,
	GenerateDefaultPerformanceLevelsDto,
} from '../model/acceptance-levels.dtos';

@SwaggerPerformanceLevelsController()
export class PerformanceLevelController {
	constructor(private readonly service: PerformanceLevelService) {}

	@SwaggerPerformanceLevelsList()
	async list(@Body() dto: FilterPerformanceLevelDto) {
		return parseSuccessResponse(await this.service.list(dto));
	}

	@SwaggerPerformanceLevelsBulkUpdate()
	async bulkUpdate(@Body() dto: BulkUpdatePerformanceLevelsDto) {
		return parseSuccessResponse(await this.service.bulkUpdate(dto));
	}

	@SwaggerPerformanceLevelsGenerateDefaults()
	async generateDefaults(@Body() dto: GenerateDefaultPerformanceLevelsDto) {
		return parseSuccessResponse(await this.service.generateDefaults(dto));
	}
}
