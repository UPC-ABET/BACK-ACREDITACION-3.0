import { Body, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { SavePlannerCredentialsDto } from '../model/planner-credentials.dtos';
import { PlannerCredentialsService } from './planner-credentials.service';
import { PlannerTokenService } from './planner-token.service';
import {
	SwaggerPlannerCredentialsGet,
	SwaggerPlannerCredentialsSave,
	SwaggerPlannerSessionController,
	SwaggerPlannerSessionRefresh,
	SwaggerPlannerSessionStatus,
} from './docs/planner-session.swagger';

// No scope headers: Planner credentials and the resulting session are system-wide, not scoped
// to a school, modality or academic period.
@SwaggerPlannerSessionController()
export class PlannerSessionController {
	constructor(
		private readonly tokenService: PlannerTokenService,
		private readonly credentialsService: PlannerCredentialsService,
	) {}

	@SwaggerPlannerSessionStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async getStatus() {
		return parseSuccessResponse(await this.tokenService.getStatus());
	}

	// @HttpCode is load-bearing: the Swagger factory's `status` only documents, it does not set.
	@SwaggerPlannerSessionRefresh()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async refresh() {
		return parseSuccessResponse(await this.tokenService.refresh());
	}

	@SwaggerPlannerCredentialsGet()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async getCredentials() {
		return parseSuccessResponse(await this.credentialsService.getSummary());
	}

	/**
	 * The pipe is route-scoped for one option: the global one sets
	 * `transformOptions.enableImplicitConversion`, which coerces *before* `@IsString()` runs, so
	 * `{"password": {"a": 1}}` would validate as the string `"[object Object]"` — and this endpoint
	 * spends a real u-planner login attempt on whatever it is given.
	 */
	@SwaggerPlannerCredentialsSave()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async saveCredentials(
		@Body(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: false },
			}),
		)
		dto: SavePlannerCredentialsDto,
	) {
		return parseSuccessResponse(await this.credentialsService.save(dto));
	}
}
