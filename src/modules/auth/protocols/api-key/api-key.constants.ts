/** The dedicated header carrying `${keyId}.${secret}`, disjoint from `Authorization: Bearer`. */
export const API_KEY_HEADER = 'x-api-key';

/** `request[API_TOKEN_PRINCIPAL]` — never `request.user` (see D3 in design.md). */
export const API_TOKEN_PRINCIPAL = 'apiToken';
