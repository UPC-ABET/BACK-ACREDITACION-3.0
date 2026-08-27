import { parseSuccessResponse } from 'src/libs/global.functions';
import { ApiTokenAuth } from 'src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator';
import { EncryptedResponse } from 'src/modules/auth/protocols/response-encryption/decorators/encrypted-response.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import {
	SwaggerIntegrationsHealthController,
	SwaggerIntegrationsHealthPing,
} from './docs/health.swagger';

/**
 * Working example of the full external-integration chain: `X-Api-Key` auth, permission scope, and
 * an encrypted response. Real business data modules will follow this same shape under
 * `src/modules/integrations/<resource>/` once their data requirements are defined.
 */
@SwaggerIntegrationsHealthController()
export class IntegrationsHealthController {
	@SwaggerIntegrationsHealthPing()
	@ApiTokenAuth()
	@EncryptedResponse()
	@RequirePermission({ module: PERMISSION_MODULES.INTEGRATIONS, action: PERMISSION_ACTIONS.GET })
	async ping() {
		return parseSuccessResponse({ ok: true, timestamp: new Date().toISOString() });
	}
}
