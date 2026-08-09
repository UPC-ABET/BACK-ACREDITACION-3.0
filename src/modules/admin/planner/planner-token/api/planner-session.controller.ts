import { Body, HttpCode, HttpStatus } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
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
	 * Typed as `unknown` on purpose, so the global pipe has no metatype to validate and leaves the
	 * body untouched. `PlannerCredentialsValidation.parse` then validates it with implicit
	 * conversion off — the only way to see that `password` was an object rather than the string
	 * `"[object Object]"` the global pipe would have produced. Swagger still documents the real
	 * shape, from the `body:` on the decorator factory.
	 */
	@SwaggerPlannerCredentialsSave()
	@HttpCode(HttpStatus.OK)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async saveCredentials(@Body() body: unknown) {
		return parseSuccessResponse(await this.credentialsService.save(body));
	}
}
