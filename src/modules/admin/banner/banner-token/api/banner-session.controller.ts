import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { BannerTokenService } from './banner-token.service';
import {
	SwaggerBannerSessionController,
	SwaggerBannerSessionStatus,
} from './docs/banner-session.swagger';

@SwaggerBannerSessionController()
export class BannerSessionController {
	constructor(private readonly tokenService: BannerTokenService) {}

	@SwaggerBannerSessionStatus()
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	getStatus() {
		return parseSuccessResponse(this.tokenService.getStatus());
	}
}
