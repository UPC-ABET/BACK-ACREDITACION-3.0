import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { PlannerTokenService } from './planner-token.service';
import {
	SwaggerPlannerSessionController,
	SwaggerPlannerSessionRefresh,
	SwaggerPlannerSessionStatus,
} from './docs/planner-session.swagger';

@SwaggerPlannerSessionController()
export class PlannerSessionController {
	constructor(private readonly tokenService: PlannerTokenService) {}

	@SwaggerPlannerSessionStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	getStatus() {
		return parseSuccessResponse(this.tokenService.getStatus());
	}

	@SwaggerPlannerSessionRefresh()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.POST })
	async refresh() {
		return parseSuccessResponse(await this.tokenService.refresh());
	}
}
