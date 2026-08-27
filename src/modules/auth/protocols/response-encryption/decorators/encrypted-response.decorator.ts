import { SetMetadata } from '@nestjs/common';
import { ENCRYPTED_RESPONSE_KEY } from '../response-encryption.constants';

/**
 * Declares "this endpoint's response `data` must be encrypted for a machine caller". A no-op for a
 * human JWT caller hitting the same route — see `EncryptedResponseInterceptor`. Combine with
 * `@ApiTokenAuth()` so the route also accepts an `X-Api-Key` caller in the first place.
 */
export const EncryptedResponse = () => SetMetadata(ENCRYPTED_RESPONSE_KEY, true);
