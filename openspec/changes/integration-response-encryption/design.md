# Design: Per-integration response encryption

## Schema

```sql
CREATE TABLE "core"."integration_keys" (
  "id" SERIAL NOT NULL,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "api_token_id" integer NOT NULL,
  "key_encrypted" character varying(5000) NOT NULL,
  "issued_by_user_id" integer NOT NULL,
  CONSTRAINT "PK_integration_keys" PRIMARY KEY ("id")
);
ALTER TABLE "core"."integration_keys" ADD CONSTRAINT "UQ_integration_keys_api_token_id" UNIQUE ("api_token_id");
ALTER TABLE "core"."integration_keys" ADD CONSTRAINT "FK_integration_keys_api_token_id" FOREIGN KEY ("api_token_id") REFERENCES "core"."api_tokens"("id");
ALTER TABLE "core"."integration_keys" ADD CONSTRAINT "FK_integration_keys_issued_by_user" FOREIGN KEY ("issued_by_user_id") REFERENCES "organization"."users"("id");
```

No `ON DELETE CASCADE`: `api_tokens` rows are revoked (`is_active = false`), never hard-deleted, so
the FK never needs cascade semantics. `key_encrypted` is sized like
`ScraperCredentialEntity.passwordEncrypted` (GCM ciphertext expands to `58 + 2 * utf8Bytes`; a
64-hex-char plaintext key yields a ~186-char ciphertext, comfortably under the 5000 cap of
`@TextLargeColumn`).

## Key material

- Generated with `crypto.randomBytes(32).toString('hex')` — 32 raw bytes is exactly the key length
  `aes-256-gcm` requires, so unlike `EncryptService` (which SHA-256-derives from an arbitrary-length
  human-supplied `APP_SECRET`), no derivation step is needed here: `Buffer.from(hex, 'hex')` is used
  directly as the cipher key.
- Returned in the `issue`/`rotate` response body exactly once, as `key: string` (64 hex chars).
  Never returned by any `get`/`list` endpoint.

## Response envelope contract

| Caller                                             | Route has `@EncryptedResponse()`? | `data` shape                                                                              |
| -------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- | ----- | -------------------- |
| Human (JWT)                                        | No                                | `{ code, message, data: <object                                                           | array | null> }` (unchanged) |
| Human (JWT)                                        | Yes                               | Same as above — encryption is skipped when no machine principal is attached               |
| Machine (`X-Api-Key`), route without the decorator | —                                 | Unchanged plaintext (opt-in, same as `@ApiTokenAuth()`)                                   |
| Machine (`X-Api-Key`), route with the decorator    | Yes                               | `{ code, message, data: "<ivHex>:<encryptedHex>:<authTagHex>" }` — `data` is now a string |

Integrator-side decryption: split `data` on `:` into three hex segments, `Buffer.from(hex, 'hex')`
each, `aes-256-gcm` decrypt with the 32-byte key issued to them, `setAuthTag`, then `JSON.parse()`
the resulting UTF-8 plaintext.

Errors are never encrypted — `EncryptedResponseInterceptor` only transforms the success path
(`next.handle().pipe(...)`); a thrown exception bypasses it entirely and reaches
`AllExceptionsFilter` unchanged.

## Interceptor ordering

```ts
// src/main.ts
app.useGlobalInterceptors(
	new EncryptedResponseInterceptor(app.get(Reflector), app.get(ResponseEncryptionService)),
	new CamelCaseInterceptor(),
	new ClassSerializerInterceptor(app.get(Reflector)),
);
```

Nest composes global interceptors so the first one registered runs its `pipe()` transform **last**
on the response path (the existing code's own comment documents this for
`CamelCaseInterceptor`/`ClassSerializerInterceptor`). Registering `EncryptedResponseInterceptor`
first means it encrypts the already-camelCased, already-serialized final body — an external
integrator's decrypted plaintext is byte-identical to what a human caller would have received
unencrypted.

## Failure mode: key not provisioned

`ResponseEncryptionService.encryptForApiToken()` throws `ServiceUnavailableException` (503) when no
`integration_keys` row exists for the calling `apiTokenId`. `DomainErrorKind` has no 5xx member
(`badRequest | unauthorized | forbidden | notFound | conflict`), and this is not a caller mistake —
it is an admin who marked a route `@EncryptedResponse()` without issuing that integration's key
first. `AllExceptionsFilter` already renders any `HttpException` via its generic branch
(`getStatus()`/`getResponse()`), so no filter change is required.

## Module graph

```
IntegrationKeyModule (new)
├── imports: TypeOrmModule.forFeature([IntegrationKeyEntity]), ApiTokenModule (reused, unmodified)
├── provides/exports: IntegrationKeyService, IntegrationKeyRepository, ResponseEncryptionService
└── (EncryptService injected via @Global() EncryptModule, no explicit import needed)

IntegrationsHealthModule (new, src/modules/integrations/health/)
└── controller uses @ApiTokenAuth() + @EncryptedResponse() + @RequirePermission(INTEGRATIONS, GET)

app.module.ts: adds both modules to `imports`. No change to the APP_GUARD list order
(app.module.spec.ts assertion untouched). No APP_INTERCEPTOR added — main.ts is the only existing
global-interceptor registration point in this codebase.
```
