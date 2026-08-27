# Tasks: Per-integration response encryption

Spec requirement references use the requirement titles from
`openspec/changes/integration-response-encryption/specs/integration-response-encryption/spec.md`.

## 1. Storage layer — entity, migration

- [x] 1.1 Create migration via `pnpm migration:create src/database/migrations/add-integration-keys`;
      hand-write `up()`/`down()` per `design.md` (table, `UQ_integration_keys_api_token_id`, two
      FKs, `IF EXISTS` guards on `down()`).
      — Satisfies: Per-Integration Key Issuance and Rotation
- [x] 1.2 Create `src/modules/admin/iam/integration-keys/model/integration-key.entity.ts` —
      `IntegrationKeyEntity extends BaseEntity`: `apiTokenId` (`@IntegerFKIDColumn`), `keyEncrypted`
      (`@TextLargeColumn({ select: false })`), `issuedByUserId` (`@IntegerFKIDColumn`). Verify column
      names match migration 1.1.
      — Satisfies: Per-Integration Key Issuance and Rotation
- [x] 1.3 Create `src/modules/admin/iam/integration-keys/model/integration-keys.dtos.ts` —
      `IssueIntegrationKeyDto`, `IssuedIntegrationKeyDto` (plaintext `key`, one-time only),
      `IntegrationKeySummaryDto` (no key field).

## 2. Repository, validation, i18n strings

- [x] 2.1 Create `src/modules/admin/iam/integration-keys/config/strings/integration-keys.validation.ts`.
- [x] 2.2 Create `src/modules/admin/iam/integration-keys/core/integration-keys.repository.ts` —
      `findByApiTokenId`, `findByApiTokenIdWithKey` (explicit `select` including `keyEncrypted`),
      `rotateForApiToken`.
- [x] 2.3 Create `src/modules/admin/iam/integration-keys/core/integration-keys.validation.ts` +
      `.validation.spec.ts` — `validateIssue` (token must exist/be active, no existing key →
      `ConflictError` otherwise), `validateRotate` (token must exist/be active, key must already
      exist → `NotFoundError` otherwise).
      — Satisfies: Per-Integration Key Issuance and Rotation

## 3. Payload encryption primitives

- [x] 3.1 Create `src/modules/admin/iam/integration-keys/core/response-encryption.functions.ts` —
      `encryptWithKey(key: Buffer, text: string): string` / `decryptWithKey(key: Buffer, ciphertext:
string): string`, same GCM params/wire format as `EncryptService`, key passed explicitly. Does
      NOT modify `src/libs/encrypt.service.ts`.
- [x] 3.2 [P] `response-encryption.functions.spec.ts` — roundtrip, wrong key, tampered authTag,
      malformed wire format.
- [x] 3.3 Create `src/modules/admin/iam/integration-keys/core/response-encryption.service.ts` —
      `ResponseEncryptionService.encryptForApiToken(apiTokenId, payload)`: loads the key row via
      `findByApiTokenIdWithKey`, throws `ServiceUnavailableException` if none, else
      `encryptService.decrypt()` + `encryptWithKey(Buffer.from(hex,'hex'), JSON.stringify(payload))`.
      — Satisfies: Fail-Closed on Missing Key Provisioning
- [x] 3.4 [P] `response-encryption.service.spec.ts` — happy path (mocked repo/`EncryptService`), 503
      when no row found.

## 4. Admin CRUD for integration keys

- [x] 4.1 Create `src/modules/admin/iam/integration-keys/api/integration-keys.service.ts` (+
      `.spec.ts`) — `issue`, `rotate`, `getByApiToken`, injecting `IntegrationKeyRepository`,
      `ApiTokenRepository` (imported from `ApiTokenModule`, unmodified), `EncryptService`.
      — Satisfies: Per-Integration Key Issuance and Rotation
- [x] 4.2 [P] Create `src/modules/admin/iam/integration-keys/config/integration-keys.routes.ts`.
- [x] 4.3 [P] Create `src/modules/admin/iam/integration-keys/api/docs/integration-keys.swagger.ts`.
- [x] 4.4 Create `src/modules/admin/iam/integration-keys/api/integration-keys.controller.ts` —
      admin-only (`PERMISSION_MODULES.ADMIN`), deliberately no `@ApiTokenAuth()` (a token must not
      rotate its own key), mirrors `ApiTokenController`'s `issue`/`rotate` naming.
      — Satisfies: Per-Integration Key Issuance and Rotation (plaintext-never-re-readable scenario)
- [x] 4.5 Create `src/modules/admin/iam/integration-keys/integration-keys.module.ts` — imports
      `TypeOrmModule.forFeature([IntegrationKeyEntity])` + `ApiTokenModule`; exports
      `IntegrationKeyService`, `IntegrationKeyRepository`, `ResponseEncryptionService`.

## 5. Opt-in encrypted-response mechanism

- [x] 5.1 Create `src/modules/auth/protocols/response-encryption/response-encryption.constants.ts` —
      `ENCRYPTED_RESPONSE_KEY`. New directory, does not touch `protocols/api-key/`.
- [x] 5.2 [P] Create
      `src/modules/auth/protocols/response-encryption/decorators/encrypted-response.decorator.ts` —
      `@EncryptedResponse()` (`SetMetadata`).
- [x] 5.3 Create
      `src/modules/auth/protocols/response-encryption/interceptors/encrypted-response.interceptor.ts`
      — `EncryptedResponseInterceptor`: no metadata → passthrough; metadata but no
      `request[API_TOKEN_PRINCIPAL]` → passthrough; metadata + principal → replace `body.data` via
      `ResponseEncryptionService.encryptForApiToken`.
      — Satisfies: Opt-In Response Encryption for Machine Callers, Fail-Closed on Missing Key Provisioning
- [x] 5.4 [P] `encrypted-response.interceptor.spec.ts` — the four branches above, mirroring
      `api-token-auth.guard.spec.ts` style.
- [x] 5.5 Modify `src/main.ts` — register `EncryptedResponseInterceptor` first in
      `app.useGlobalInterceptors(...)`, ahead of `CamelCaseInterceptor`/`ClassSerializerInterceptor`.
- [x] 5.6 Modify `src/shared/constants/permission-modules.ts` — add `INTEGRATIONS: 'INTEGRATIONS'`
      to `PERMISSION_MODULES`. Only existing shared file touched in this change.
- [x] 5.7 Modify `src/app.module.ts` — add `IntegrationKeyModule` and `IntegrationsHealthModule`
      (task 6) to `imports`. Do not touch the `APP_GUARD` provider list or its order.

## 6. Working end-to-end example

- [x] 6.1 Create `src/modules/integrations/health/model/health.dtos.ts` — `PingResponseDto { ok,
timestamp }`.
- [x] 6.2 [P] Create `src/modules/integrations/health/config/health.routes.ts`.
- [x] 6.3 [P] Create `src/modules/integrations/health/api/docs/health.swagger.ts`.
- [x] 6.4 Create `src/modules/integrations/health/api/health.controller.ts` — `GET
/integrations/health/ping`, `@ApiTokenAuth() @EncryptedResponse()
@RequirePermission({module: PERMISSION_MODULES.INTEGRATIONS, action: GET})`.
- [x] 6.5 Create `src/modules/integrations/health/health.module.ts`; register in `app.module.ts`
      (task 5.7), always-on (not gated like `RAW_DB_URL`-conditional modules).
      — Satisfies: Opt-In Response Encryption for Machine Callers (full-chain proof)

## 7. Documentation and contract

- [x] 7.1 Add `integrations/health` and `admin/iam/integration-keys` to `docs/CONTEXT.md`'s module
      exceptions / project structure notes as appropriate.
- [x] 7.2 Run `pnpm openapi:export` and commit the updated `openapi.json` (new routes:
      `admin-iam-integration-keys/*`, `integrations/health/ping`).
- [ ] 7.3 Manual end-to-end verification per the plan's "Verificación end-to-end" steps: issue a
      token scoped to `INTEGRATIONS:GET`, issue its integration key, curl `ping` with `X-Api-Key`,
      decrypt the returned `data` with the issued key, and confirm a JWT/cookie call to the same
      route stays plaintext.
