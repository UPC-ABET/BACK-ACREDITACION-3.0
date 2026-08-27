import { SetMetadata } from '@nestjs/common';

export const API_TOKEN_AUTH_KEY = 'apiTokenAuth';

/**
 * Declares "this endpoint also accepts a machine `X-Api-Key` token". Endpoints without this
 * decorator stay JWT-only even when a valid token is presented (AC-3).
 *
 * Recorded hazard: never combine with `@SkipPermissions()`. `SkipPermissions()` bypasses the
 * `PermissionsGuard` scope check entirely, so pairing it with `@ApiTokenAuth()` would authorize a
 * machine principal with no scope check at all. There is no route combining them today to enforce
 * this at runtime — keep it that way.
 */
export const ApiTokenAuth = () => SetMetadata(API_TOKEN_AUTH_KEY, true);
