import { Body } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { AcceptanceLevelService } from './acceptance-levels.service';
import { SwaggerAcceptanceLevelsController, SwaggerAcceptanceLevelsList, SwaggerAcceptanceLevelsBulkUpdate, SwaggerAcceptanceLevelsGenerateDefaults } from './docs/acceptance-levels.swagger';
import { FilterAcceptanceLevelDto, BulkUpdateAcceptanceLevelsDto, GenerateDefaultAcceptanceLevelsDto } from '../model/acceptance-levels.dtos';

@SwaggerAcceptanceLevelsController()
export class AcceptanceLevelController {
	constructor(private readonly service: AcceptanceLevelService) {}

	@SwaggerAcceptanceLevelsList()
	async list(@Body() dto: FilterAcceptanceLevelDto) {
		return parseSuccessResponse(await this.service.list(dto));
	}

	@SwaggerAcceptanceLevelsBulkUpdate()
	async bulkUpdate(@Body() dto: BulkUpdateAcceptanceLevelsDto) {
		return parseSuccessResponse(await this.service.bulkUpdate(dto));
	}

	@SwaggerAcceptanceLevelsGenerateDefaults()
	async generateDefaults(@Body() dto: GenerateDefaultAcceptanceLevelsDto) {
		return parseSuccessResponse(await this.service.generateDefaults(dto));
	}
}
