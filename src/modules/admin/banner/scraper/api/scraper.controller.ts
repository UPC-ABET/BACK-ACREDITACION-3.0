import { Body, HttpStatus, Param } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { ScraperService } from './scraper.service';
import { RunScrapeDto } from '../model/scraper.dtos';
import {
	SwaggerScraperController,
	SwaggerScraperGetRun,
	SwaggerScraperRun,
} from './docs/scraper.swagger';

@SwaggerScraperController()
export class ScraperController {
	constructor(private readonly service: ScraperService) {}

	@SwaggerScraperRun()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async run(@Body() dto: RunScrapeDto, @CurrentUser() user: RequestUser) {
		return parseSuccessResponse(
			await this.service.run(dto, `user:${user.userId}`),
			HttpStatus.CREATED,
		);
	}

	@SwaggerScraperGetRun()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async getRun(@Param('runId') runId: string) {
		return parseSuccessResponse(await this.service.getRun(runId));
	}
}
