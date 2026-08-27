# Per-integration response encryption for machine-to-machine callers

**Slug**: `integration-response-encryption`
**Branch**: `feat/integration-response-encryption`
**Repos affected**: backend
**Created**: 2026-08-27

## Problem

`api-tokens-auth` (merged 2026-08-27) gives external systems a way to authenticate against this
API, but every response an authenticated machine caller receives is still plaintext JSON, exactly
like a human caller's. Several distinct external systems will consume this API, each belonging to a
different institution/vendor. There is no mechanism to give each of them its own secret so that:

- The payload this API returns to system A cannot be read by system B even if it captures the
  traffic (each integration needs its own key, not one shared secret).
- The secret used for this purpose is not `APP_SECRET` — that key is internal (it also encrypts
  scraper credentials at rest, per ADR-001) and must never leave this system's process.

This change adds a per-`api_tokens`-row encryption key an admin can issue/rotate, and an opt-in
mechanism (`@EncryptedResponse()`) any future externally-exposed endpoint can use to have its `data`
field encrypted with the calling token's key before the response leaves the process. No business
endpoint is opted in yet — this change only ships the mechanism plus one real end-to-end example.

## What already exists

- **`api-tokens-auth`** (`src/modules/admin/iam/api-tokens/`) — M2M credential CRUD, `X-Api-Key:
<keyId>.<secret>` transport, `ApiTokenAuthGuard` (global `APP_GUARD`, order asserted by
  `src/app.module.spec.ts`), opt-in `@ApiTokenAuth()`, machine principal at
  `request[API_TOKEN_PRINCIPAL]` (`ApiTokenPrincipal { apiTokenId, keyId, name, permissions }`).
  Nothing in this change modifies any file under `src/modules/admin/iam/api-tokens/` or
  `src/modules/auth/protocols/api-key/`.
- **`EncryptService`** (`src/libs/encrypt.service.ts`, global via `EncryptModule`) — AES-256-GCM,
  wire format `iv:encrypted:authTag` (hex, `:`-joined), key derived as `sha256(APP_SECRET)`. Not
  modified by this change; reused only for at-rest encryption of the new key column, exactly as
  `ScraperCredentialEntity.passwordEncrypted` already does (ADR-001).
- **Global interceptor registration** — `src/main.ts` calls `app.useGlobalInterceptors(new
CamelCaseInterceptor(), new ClassSerializerInterceptor(...))`, the only existing precedent for a
  global response-transforming interceptor in this codebase (no `APP_INTERCEPTOR` usage exists).
- **`AllExceptionsFilter`** (`src/shared/filters/all-exceptions.filter.ts`) — already handles any
  `HttpException` generically (reads `getStatus()`/`getResponse()`), so a plain Nest
  `ServiceUnavailableException` needs no filter change to render correctly.

## Goals

- A new `IntegrationKeyEntity` (1:1 with `ApiTokenEntity` via `apiTokenId`), admin-only CRUD to
  issue/rotate a per-integration symmetric key. Plaintext is returned exactly once, at issuance or
  rotation, and is never retrievable afterwards (stored at rest as `EncryptService` ciphertext,
  `select: false`).
- A `ResponseEncryptionService` that, given an `apiTokenId` and a JSON-serializable payload,
  produces `iv:encrypted:authTag` ciphertext using that integration's key.
- An opt-in `@EncryptedResponse()` decorator + a global interceptor that encrypts `ResponseDto.data`
  only when both the route opted in and the caller is a resolved machine principal (a human JWT
  caller hitting the same route gets the plaintext response unchanged).
- One real, always-registered example endpoint (`GET /integrations/health/ping`) proving the full
  chain end-to-end, and the `src/modules/integrations/<resource>/` convention future
  externally-exposed endpoints will follow once their data requirements are defined.

## Design resolutions

| #   | Question                           | Resolution                                                                                                                                                                                         | Rationale                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Key scope                          | One key per `api_tokens` row (1:1 FK, `UNIQUE(apiTokenId)`), not one global key                                                                                                                    | Multiple distinct external systems will call this API; a shared key means any one of them can decrypt what every other one receives if traffic is ever compared. Rotation/compromise of one integration must not affect another.                                                                                                                                 |
| 2   | Key storage                        | Reuse `EncryptService.encrypt()`/`.decrypt()` (APP_SECRET-derived) to store the per-integration key at rest, mirroring `ScraperCredentialEntity.passwordEncrypted` exactly                         | Reuses the one reversible-encryption primitive this codebase already trusts (ADR-001) instead of inventing a second at-rest scheme. Accepted cost: losing/rotating `APP_SECRET` now also invalidates every integration key, same as it already does for scraper credentials.                                                                                     |
| 3   | Payload encryption primitive       | New key-parameterized `encryptWithKey`/`decryptWithKey` functions (same GCM params/wire format as `EncryptService`), added as new standalone functions, not a modification to `encrypt.service.ts` | `EncryptService`'s public methods hardcode the `APP_SECRET`-derived key; the payload key is per-token and generated fresh (`randomBytes(32)`), not derived from a human-supplied secret, so no SHA-256 derivation step is needed. Keeping `encrypt.service.ts` untouched satisfies "don't damage existing modules."                                              |
| 4   | Opt-in mechanism                   | `@EncryptedResponse()` metadata decorator + a global `NestInterceptor`, registered via `app.useGlobalInterceptors()` in `main.ts` ahead of `CamelCaseInterceptor`                                  | Mirrors `@ApiTokenAuth()`'s existing opt-in-decorator-plus-global-check pattern exactly, so route authors reuse a mental model that already exists. Registering first means it runs last on the response path (same ordering rule the existing `CamelCaseInterceptor`/`ClassSerializerInterceptor` comment documents), so it encrypts the final camelCased body. |
| 5   | Behavior for non-machine callers   | Passthrough, unencrypted, when `request[API_TOKEN_PRINCIPAL]` is absent                                                                                                                            | A route may legitimately be reachable by both a human JWT session and a machine token; forcing encryption on a human caller would break normal frontend consumption of the same endpoint for no security benefit (the transport is already TLS + authenticated).                                                                                                 |
| 6   | Missing-key failure mode           | `ServiceUnavailableException` (503) when a route requires encryption but the calling token has no key row                                                                                          | This is an admin misconfiguration (route marked `@EncryptedResponse()`, key never issued for that integration), not a caller-correctable 4xx. `DomainErrorKind` has no 5xx variant, so the plain Nest exception is used; `AllExceptionsFilter` already renders any `HttpException` correctly.                                                                    |
| 7   | Module path                        | `src/modules/admin/iam/integration-keys/` (sibling of `api-tokens`)                                                                                                                                | Same IAM/admin domain, same admin-only CRUD shape, same "admin modules live under `modules/admin/<domain>/<module>`" rule already documented in `docs/CONTEXT.md`.                                                                                                                                                                                               |
| 8   | Future external endpoints location | New top-level grouping `src/modules/integrations/<resource>/`, parallel to `admin/`                                                                                                                | "Reachable by an external system" is an orthogonal responsibility axis, same as the existing `admin/` grouping is for "admin responsibility" — not a domain. Keeps every externally-reachable route auditable in one directory and its DTOs decoupled from internal ones, without touching any existing feature module.                                          |

## Non-goals

- **No business data endpoint is exposed.** Which domain data external systems may query is not
  yet decided; this change ships only the mechanism plus `GET /integrations/health/ping` as a
  working proof, not a real integration.
- **No decryption of inbound request bodies.** Only outbound `data` is encrypted; nothing about
  request payloads changes.
- **No key rotation policy/automation, no per-key expiry.** Rotation is a manual admin action,
  same maturity level as the existing `api-tokens` module today.
- **No `core.types` seed for the new `INTEGRATIONS` permission module.** It is usable immediately
  by machine tokens (validated against the TS constant); a human role-assignment UI entry is a
  follow-up if a human ever needs that permission.
