import { Body } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	SwaggerPortfolioSsoController,
	SwaggerPortfolioSsoGetConfig,
	SwaggerPortfolioSsoGetLink,
	SwaggerPortfolioSsoUpsertConfig,
} from './docs/portfolio-sso.swagger';
import { PortfolioSsoService } from './portfolio-sso.service';
import { UpsertPortfolioSsoConfigDto } from '../model/portfolio-sso-config.dtos';

/**
 * Admin-configured shared secret + base URL for PORTFOLIO-AUDIT (an external system), and the
 * self-service endpoint any permitted user calls to obtain a freshly-signed SSO link into it.
 */
@SwaggerPortfolioSsoController()
export class PortfolioSsoController {
	constructor(private readonly service: PortfolioSsoService) {}

	@SwaggerPortfolioSsoGetConfig()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getConfig() {
		return parseSuccessResponse(await this.service.getConfigSummary());
	}

	@SwaggerPortfolioSsoUpsertConfig()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async upsertConfig(@Body() dto: UpsertPortfolioSsoConfigDto) {
		return parseSuccessResponse(await this.service.upsertConfig(dto));
	}

	@SwaggerPortfolioSsoGetLink()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getLink(@CurrentUser() user: RequestUser) {
		return parseSuccessResponse(await this.service.buildLoginLink(user.userId));
	}
}
