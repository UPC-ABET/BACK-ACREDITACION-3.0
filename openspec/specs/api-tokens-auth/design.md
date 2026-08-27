# Design: Generic machine-to-machine API-token authentication

## Technical Approach

Three separable pieces, one direction of dependency:

1. **Storage + admin CRUD** — `src/modules/admin/iam/api-tokens/`, standard module layout
   (`api/`, `core/`, `model/`, `config/`), `core.api_tokens` table, `ApiTokenEntity extends BaseEntity`.
2. **Auth protocol** — `src/modules/auth/protocols/api-key/`, mirroring the existing
   `protocols/jwt/` folder: one `ApiTokenAuthGuard`, one `@ApiTokenAuth()` decorator, one
   `ApiTokenPrincipal` type. This folder depends on (1); (1) never imports it.
3. **Two surgical edits to the existing guard chain** — `JwtAuthGuard` yields when a machine
   principal is already resolved; `PermissionsGuard` gains a principal-resolution seam.

`AuthModule` is untouched. `RequestUser`, `@CurrentUser()`, `JwtStrategy`, the login flow and
`AllExceptionsFilter` wiring are untouched.

## Architecture Decisions

| #   | Decision                           | Choice                                                                                                                | Rejected                                                                                    | Rationale                                                                                                                                                                                                                                                           |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Guard placement                    | `ApiTokenAuthGuard` first in `AppModule.providers`, before `JwtAuthGuard`, before `PermissionsGuard`                  | Route-level `@UseGuards`                                                                    | APP_GUARD runs in registration order; the machine principal must exist before `JwtAuthGuard` decides, and before `PermissionsGuard` reads scopes.                                                                                                                   |
| D2  | Making `JwtAuthGuard` yield        | Add an early `return true` when `request[API_TOKEN_PRINCIPAL]` is set, mirroring the existing `isPublic` early return | Leaving `JwtAuthGuard` untouched                                                            | Guards do not short-circuit each other: without this, `AuthGuard('jwt')` 401s every API-key request (no bearer). This is the minimum edit; it is unreachable when no `X-Api-Key` was presented (AC-2).                                                              |
| D3  | Machine principal location         | `request.apiToken` (`API_TOKEN_PRINCIPAL = 'apiToken'`), **never** `request.user`                                     | Writing a synthetic `RequestUser` into `request.user`                                       | `@CurrentUser()` reads `request.user` only, so it can never receive a machine principal, and no consumer inherits a fake `userId` (AC-10).                                                                                                                          |
| D4  | `isAdmin` containment              | `PermissionsGuard` calls `isAdmin(request.user)` **only when no machine principal is present**                        | Giving the principal an empty `roles: []` and relying on `isAdmin` returning false          | Structural, not incidental: `ApiTokenPrincipal` has no `roles` field at all, so `isAdmin` is not merely false — it is unreachable and untypable for a machine (AC-10).                                                                                              |
| D5  | Permission module for the CRUD     | Reuse `PERMISSION_MODULES.ADMIN`                                                                                      | New `API_TOKENS` module const + `core.types` TG2001 seed + `role_module_permissions` grants | Exact precedent of the three siblings in `admin/iam/` (`roles`, `user-roles`, `role-module-permissions`), all `ADMIN`. A new module code buys no enforcement until it is granted, and adds a seed migration plus a grant migration for zero behavioural difference. |
| D6  | Escalation containment             | The api-tokens controller carries **no** `@ApiTokenAuth()`                                                            | —                                                                                           | A token scoped `{ADMIN, POST}` would otherwise mint tokens. AC-3 makes the omission load-bearing: no opt-in, no machine access.                                                                                                                                     |
| D7  | Revoke is not `BaseService.delete` | Override `delete()`; `BaseRepository.remove()` is a **hard** delete                                                   | Inheriting `super.delete(id)`                                                               | AC-7 requires the row to survive with `revokedAt`/`revokedByUserId`.                                                                                                                                                                                                |
| D8  | Domain errors                      | Throw `UnauthorizedError` / `ForbiddenError` from `src/commons/domain-error.ts`                                       | Nest `UnauthorizedException`                                                                | Project convention (`docs/POLICIES.md`). `PermissionsGuard` currently deviates (`ForbiddenException`); the new code follows the correct convention and the existing throw is left alone to keep AC-2 byte-identical.                                                |
| D9  | `@Public()` precedence             | A public route ignores `X-Api-Key` entirely and attaches no principal                                                 | Rejecting the stray header per AC-3                                                         | AC-2 requires public routes to behave exactly as today for every caller; a client that always sends the header must not be broken on `/auth/login`.                                                                                                                 |

## Data Flow

```
request ──► ApiTokenAuthGuard ──► JwtAuthGuard ──► PermissionsGuard ──► handler
                │                     │                  │
   no X-Api-Key │ return true         │ passport JWT     │ isAdmin(request.user)
                │                     │ ► request.user   │ ► request.user.permissions
                │                                        │
   X-Api-Key    │ @ApiTokenAuth()? ──no──► Unauthorized  │ machine principal present:
                │ split "<keyId>.<secret>"               │  skip isAdmin entirely,
                │ ► 1 indexed row by key_id              │  match @RequirePermission
                │ ► 1 bcrypt.compare                     │  against principal.permissions
                │ ► request.apiToken = principal ──true──► return true ──►
```

## File Changes

| File                                                                        | Action | Description                                                                    |
| --------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `src/modules/admin/iam/api-tokens/model/api-token.entity.ts`                | Create | `ApiTokenEntity`                                                               |
| `src/modules/admin/iam/api-tokens/model/api-tokens.dtos.ts`                 | Create | Create/Update/Filter/Scope DTOs + issuance response                            |
| `src/modules/admin/iam/api-tokens/core/api-tokens.repository.ts`            | Create | `BaseRepository` + `findAuthCandidateByKeyId`                                  |
| `src/modules/admin/iam/api-tokens/core/api-tokens.validation.ts`            | Create | Scope-vocabulary + lifecycle validation                                        |
| `src/modules/admin/iam/api-tokens/core/api-tokens.validation.spec.ts`       | Create | Unit tests                                                                     |
| `src/modules/admin/iam/api-tokens/core/api-token-auth.service.ts`           | Create | Key resolution + verification, consumed by the guard                           |
| `src/modules/admin/iam/api-tokens/api/api-tokens.service.ts`                | Create | Issue / list / update / revoke                                                 |
| `src/modules/admin/iam/api-tokens/api/api-tokens.service.spec.ts`           | Create | Unit tests (issuance, revoke)                                                  |
| `src/modules/admin/iam/api-tokens/api/api-tokens.controller.ts`             | Create | `BaseController` subclass                                                      |
| `src/modules/admin/iam/api-tokens/api/docs/api-tokens.swagger.ts`           | Create | Swagger decorators                                                             |
| `src/modules/admin/iam/api-tokens/config/api-tokens.routes.ts`              | Create | Route/tag config                                                               |
| `src/modules/admin/iam/api-tokens/config/strings/api-tokens.validation.ts`  | Create | i18n keys                                                                      |
| `src/modules/admin/iam/api-tokens/api-tokens.module.ts`                     | Create | Wiring; exports `ApiTokenAuthService`                                          |
| `src/modules/auth/protocols/api-key/api-key.constants.ts`                   | Create | `API_KEY_HEADER`, `API_TOKEN_PRINCIPAL`                                        |
| `src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator.ts` | Create | `@ApiTokenAuth()` + `API_TOKEN_AUTH_KEY`                                       |
| `src/modules/auth/protocols/api-key/guards/api-token-auth.guard.ts`         | Create | The guard                                                                      |
| `src/modules/auth/protocols/api-key/guards/api-token-auth.guard.spec.ts`    | Create | Unit tests (AC-1/3/5/11)                                                       |
| `src/modules/auth/model/authorization.types.ts`                             | Modify | Add `ApiTokenScope`, `MachinePermission`, `ApiTokenPrincipal`                  |
| `src/modules/auth/protocols/jwt/guards/jwt-auth.guard.ts`                   | Modify | D2 early return                                                                |
| `src/modules/auth/protocols/jwt/guards/permissions.guard.ts`                | Modify | D3/D4 principal seam                                                           |
| `src/modules/auth/protocols/jwt/guards/permissions.guard.spec.ts`           | Modify | Add machine-principal cases                                                    |
| `src/libs/secure.functions.ts`                                              | Modify | Add `compareSecret`, `generateApiKeyMaterial`                                  |
| `src/app.module.ts`                                                         | Modify | Import `ApiTokenModule`; register `ApiTokenAuthGuard` as the first `APP_GUARD` |
| `src/app.module.spec.ts`                                                    | Create | Guard-order regression test (see Testing)                                      |
| `src/main.ts`                                                               | Modify | `.addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'apiKey')`    |
| `src/database/migrations/<ts>-add-api-tokens.ts`                            | Create | `pnpm migration:create src/database/migrations/add-api-tokens`                 |
| `openapi.json`                                                              | Modify | `pnpm openapi:export`                                                          |

## Interfaces / Contracts

### Entity

```ts
@Entity({ name: 'api_tokens', schema: 'core' })
export class ApiTokenEntity extends BaseEntity {
	@NameColumn({ nullable: false }) name: string;
	@CodeColumn({ unique: true, indexName: 'UQ_api_tokens_key_id' }) keyId: string;
	@PasswordColumn({ nullable: false }) secretHash: string; // select: false
	@JsonColumn({ nullable: false, withDefault: false }) scopes: ApiTokenScope[];
	@DateColumn({ nullable: true, withDefault: false }) expiresAt: Date | null;
	@IntegerFKIDColumn({ nullable: false }) createdByUserId: number;
	@IntegerFKIDColumn({ nullable: true }) revokedByUserId: number | null;
	@DateColumn({ nullable: true, withDefault: false }) revokedAt: Date | null;
}
```

`indexName` is mandatory: `applyColumn` would otherwise derive `IDX_api_token_key_id` (singular)
and drift from the migration's constraint name. `withDefault: false` on the date columns overrides
`DateColumn`'s `CURRENT_TIMESTAMP` default; on `scopes` it overrides `JsonColumn`'s `'{}'` object
default (the column holds an array).

### Principal types (`authorization.types.ts`, additive)

```ts
export type ApiTokenScope = { module: string; action: string };
export type MachinePermission = Pick<AuthorizationPermission, 'module' | 'permissions'>;

export type ApiTokenPrincipal = {
	apiTokenId: number;
	keyId: string;
	name: string;
	permissions: MachinePermission[]; // no userId, no roles — by construction
};
```

### Guard contract

```ts
// api-key.constants.ts
export const API_KEY_HEADER = 'x-api-key';
export const API_TOKEN_PRINCIPAL = 'apiToken';

// api-token-auth.decorator.ts
export const API_TOKEN_AUTH_KEY = 'apiTokenAuth';
export const ApiTokenAuth = () => SetMetadata(API_TOKEN_AUTH_KEY, true);

// api-token-auth.guard.ts
canActivate(ctx): Promise<boolean>
//  1. isPublic                  -> true, header ignored              (D9, AC-2)
//  2. no X-Api-Key              -> true, request untouched            (AC-2)
//  3. no @ApiTokenAuth() on route -> throw UnauthorizedError          (AC-3)
//  4. malformed "<keyId>.<secret>" (split on FIRST '.') -> Unauthorized
//  5. authService.resolve(keyId, secret) -> ApiTokenPrincipal
//  6. request[API_TOKEN_PRINCIPAL] = principal; return true
```

```ts
// api-token-auth.service.ts — the whole hot path
async resolve(keyId: string, secret: string): Promise<ApiTokenPrincipal> {
	const row = await this.repository.findAuthCandidateByKeyId(keyId); // exactly one row (AC-11)
	const invalid = !row || row.isActive === false
		|| (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now());
	if (invalid) throw new UnauthorizedError(strings.error.invalidApiKey);      // AC-5
	if (!(await compareSecret(secret, row.secretHash)))                          // AC-11: one compare
		throw new UnauthorizedError(strings.error.invalidApiKey);                // same key (AC-5)
	return toPrincipal(row);
}
```

```ts
// api-tokens.repository.ts
findAuthCandidateByKeyId(keyId: string) {
	return this.repository.findOne({
		where: { keyId },                                  // UQ_api_tokens_key_id -> single-row read
		select: { id: true, keyId: true, name: true, secretHash: true,
		          scopes: true, expiresAt: true, isActive: true },   // secretHash is select:false
	});
}
```

`toPrincipal` groups `ApiTokenScope[]` into `MachinePermission[]` by uppercased module:
`[{module:'ACADEMIC',action:'GET'},{module:'ACADEMIC',action:'POST'}]` →
`[{module:'ACADEMIC',permissions:['GET','POST']}]`, the exact shape `PermissionsGuard` already
iterates. `JsonColumn`'s snake/camel transformer is a no-op on the single-word keys `module`/`action`.

### `PermissionsGuard` seam (the only behavioural edit)

```ts
const machine = request[API_TOKEN_PRINCIPAL] as ApiTokenPrincipal | undefined;

if (!machine && isAdmin(request.user)) return true; // D4 / AC-10
// ... existing requiredPermission lookup unchanged ...
const permissions = machine ? machine.permissions : (request.user?.permissions ?? []);
// ... existing .some(...) matcher unchanged; throws ForbiddenException today.
```

For a machine principal a missing/failed match must raise `ForbiddenError` (D8, AC-4); the human
branch keeps its current `ForbiddenException` so AC-2 stays byte-identical.

### `JwtAuthGuard` seam

```ts
if (isPublic) return true;
if (context.switchToHttp().getRequest()[API_TOKEN_PRINCIPAL]) return true; // D2
return super.canActivate(context);
```

### Key material (`secure.functions.ts`)

```ts
export function compareSecret(plain: string, hash: string): Promise<boolean>; // bcrypt.compare
export function generateApiKeyMaterial(): { keyId: string; secret: string };
//   keyId  = randomBytes(12).toString('hex')        24 hex chars, fits DB_LENGTH_CODE (50)
//   secret = randomBytes(32).toString('base64url')  256-bit entropy, no '.' in the alphabet
// wire value: `${keyId}.${secret}` ; stored: hashPassword(secret) at BCRYPT_ROUNDS = 12
```

### DTOs (`api-tokens.dtos.ts`)

```ts
class ApiTokenScopeDto {
	@IsIn(Object.values(PERMISSION_MODULES)) module: string; // AC-8
	@IsIn(Object.values(PERMISSION_ACTIONS)) action: string; // AC-8
}
class CreateApiTokenDto {
	@IsString() @Length(1, 255) name: string;
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ApiTokenScopeDto)
	scopes: ApiTokenScopeDto[];
	@IsOptional() @IsDateString() expiresAt?: string;
}
class UpdateApiTokenDto {
	name?: string;
	expiresAt?: string | null;
} // no scopes, no isActive
class FilterApiTokenDto {
	name?: string;
	isActive?: boolean;
}
class IssuedApiTokenDto {
	id;
	name;
	keyId;
	scopes;
	expiresAt;
	createdAt;
	apiKey: string;
}
```

`forbidNonWhitelisted: true` is already global, so a `scopes` key in an update body 400s with no
extra code — revoke-and-reissue is enforced by the DTO surface, not by a runtime branch.
`createdByUserId` is never accepted from the body; the controller passes `@CurrentUser().userId`.

### Endpoints (`admin-api-tokens`, tag `IAM - API Tokens`)

| Route                                   | Permission        | Notes                                  |
| --------------------------------------- | ----------------- | -------------------------------------- |
| `POST /admin-api-tokens/create`         | `{ADMIN, POST}`   | Only response carrying `apiKey` (AC-6) |
| `PUT /admin-api-tokens/update/:id`      | `{ADMIN, PUT}`    | `name` / `expiresAt` only              |
| `DELETE /admin-api-tokens/delete/:id`   | `{ADMIN, DELETE}` | Soft revoke (D7)                       |
| `GET /admin-api-tokens/get-all`         | `{ADMIN, GET}`    |                                        |
| `GET /admin-api-tokens/get-by-id/:id`   | `{ADMIN, GET}`    |                                        |
| `POST /admin-api-tokens/get-by-filters` | `{ADMIN, POST}`   |                                        |

Issuance: validate → `generateApiKeyMaterial()` → `hashPassword(secret)` → persist → return the
entity **with `secretHash` deleted from the in-memory object** plus `apiKey`. Every read path relies
on `select: false` (AC-6). Revoke: `repository.update(id, { isActive: false, revokedAt: new Date(),
revokedByUserId })` (AC-7).

## Migration

`pnpm migration:create src/database/migrations/add-api-tokens` → class `AddApiTokens<timestamp>`.

```sql
-- up()
CREATE TABLE "core"."api_tokens" (
  "id" SERIAL NOT NULL,
  "extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE,
  "name" character varying(255) NOT NULL,
  "key_id" character varying(50) NOT NULL,
  "secret_hash" character varying(255) NOT NULL,
  "scopes" jsonb NOT NULL,
  "expires_at" TIMESTAMP WITH TIME ZONE,
  "created_by_user_id" integer NOT NULL,
  "revoked_by_user_id" integer,
  "revoked_at" TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "PK_api_tokens" PRIMARY KEY ("id")
);
ALTER TABLE "core"."api_tokens"
  ADD CONSTRAINT "UQ_api_tokens_key_id" UNIQUE ("key_id");
ALTER TABLE "core"."api_tokens" ADD CONSTRAINT "FK_api_tokens_created_by_user"
  FOREIGN KEY ("created_by_user_id") REFERENCES "organization"."users"("id");
ALTER TABLE "core"."api_tokens" ADD CONSTRAINT "FK_api_tokens_revoked_by_user"
  FOREIGN KEY ("revoked_by_user_id") REFERENCES "organization"."users"("id");
```

`down()` drops the two FKs, then `UQ_api_tokens_key_id`, then `DROP TABLE IF EXISTS`, each with
`IF EXISTS`, mirroring `1786244322642-add-scraper-credentials.ts`. `UQ_api_tokens_key_id` supplies
the B-tree backing the single-row lookup; no separate `IDX_` is created.

No data migration, no backfill, no feature flag: the table starts empty and no route opts in.

## Swagger

`main.ts` adds `.addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'apiKey')` after the
existing `addBearerAuth`. `.addSecurityRequirements('bearer')` stays the document-wide default, so
every existing operation's contract is unchanged; a future `@ApiTokenAuth()` route pairs it with
`@ApiSecurity('apiKey')` to declare the alternative. `pnpm openapi:export` is re-run.

## Testing Strategy

| Layer       | What                                                                                                                                                                                                     | How                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `ApiTokenAuthGuard`: absent header falls through; valid key on non-opted route rejects; malformed value; revoked; expired; wrong secret; happy path attaches `request.apiToken` and never `request.user` | Jest, mocked `Reflector` + `ApiTokenAuthService`, fake `ExecutionContext` (pattern of `permissions.guard.spec.ts`)                                                                                                                            |
| Unit        | AC-11: `findAuthCandidateByKeyId` called once, `compareSecret` called ≤ once, no `find`/`findAll`                                                                                                        | Assert mock call counts, including the unknown-`keyId` path (zero compares)                                                                                                                                                                   |
| Unit        | `PermissionsGuard`: machine principal with matching / non-matching scope; machine principal whose `request.user` carries an ADMIN role still does **not** short-circuit; existing human cases unchanged  | Extend `permissions.guard.spec.ts`                                                                                                                                                                                                            |
| Unit        | `ApiTokenValidation`: scopes outside `PERMISSION_MODULES`/`PERMISSION_ACTIONS`, empty scopes, revoke of an already-revoked token                                                                         | Mocked repository                                                                                                                                                                                                                             |
| Unit        | `ApiTokenService.create`: `secretHash` absent from the response, `apiKey` present exactly once, `createdByUserId` from the caller; `delete` performs a soft revoke and never `repository.remove`         | Mocked repository + `hashPassword`                                                                                                                                                                                                            |
| Integration | Guard order in `app.module.ts`                                                                                                                                                                           | `src/app.module.spec.ts`: read `Reflect.getMetadata('providers', AppModule)`, filter `provide === APP_GUARD`, assert `[ApiTokenAuthGuard, JwtAuthGuard, PermissionsGuard]` exactly — a reorder fails the suite, per the proposal's first risk |
| E2E         | Not added                                                                                                                                                                                                | No route opts in; there is no end-to-end machine path to exercise yet                                                                                                                                                                         |

## Threat Matrix

**Applicable — routing only.** No shell, subprocess, VCS/PR automation, executable-file
classification, or process integration is introduced.

| Row                                                  | Status                          | Expected behaviour                                                                        | RED test                                                                            |
| ---------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unauthenticated route reachability                   | Applicable                      | `@ApiTokenAuth()` on zero existing routes; a valid key on any non-opted route is rejected | Guard spec: valid key + no metadata → `UnauthorizedError`                           |
| Privilege escalation via new principal               | Applicable                      | `isAdmin` unreachable for machines; token cannot mint tokens (D6)                         | `PermissionsGuard` spec: machine principal never short-circuits                     |
| Guard-chain reorder                                  | Applicable                      | Registration order is asserted, not commented                                             | `app.module.spec.ts` order assertion                                                |
| Credential disclosure                                | Applicable                      | `select: false` + explicit deletion on the issuance response                              | Service spec: no `secretHash` on any response shape                                 |
| Enumeration / brute force                            | Applicable, partially mitigated | Unknown `keyId` costs zero bcrypt; a guess must hit a real 96-bit `keyId` first           | Guard spec asserts zero compares on unknown `keyId`; throttling explicitly deferred |
| Shell / subprocess / VCS / executable classification | N/A                             | No such boundary in this change                                                           | —                                                                                   |

## Acceptance-Criteria Traceability

| AC    | Satisfied by                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1  | D1 order + guard step 6 + `toPrincipal` grouping + `PermissionsGuard` seam                                                                 |
| AC-2  | Guard step 2 (no header → untouched), D2 (unreachable without a principal), D9, human branch of the seam left byte-identical               |
| AC-3  | Guard step 3, before any DB read; D6 keeps the admin CRUD itself machine-inaccessible                                                      |
| AC-4  | Seam falls through to the existing matcher; machine miss raises `ForbiddenError` (D8), not `UnauthorizedError`                             |
| AC-5  | Single `invalid` predicate covering absent/inactive/expired, one shared i18n key with the wrong-secret path                                |
| AC-6  | `@PasswordColumn` (`select: false`), `secretHash` deleted from the issuance response, `IssuedApiTokenDto` the only shape carrying `apiKey` |
| AC-7  | `createdByUserId` from `@CurrentUser()` at issuance; `revokedByUserId` + `revokedAt` via D7's soft revoke                                  |
| AC-8  | `ApiTokenScopeDto` `@IsIn` (global `ValidationPipe`) plus a defensive re-check in `ApiTokenValidation.validateCreate`                      |
| AC-9  | `@RequirePermission({ADMIN, ...})` per D5; the guard rejects before the service runs, so no write occurs                                   |
| AC-10 | D3 (`request.apiToken`, not `request.user`) + D4 (`isAdmin` guarded by `!machine`, principal has no `roles`)                               |
| AC-11 | `findAuthCandidateByKeyId` — one `findOne` on `UQ_api_tokens_key_id`; `compareSecret` invoked only after a row is found                    |

## Open Questions

None blocking.

Recorded hazards for `sdd-tasks`:

- `@ApiTokenAuth()` must never be combined with `@SkipPermissions()` — that pairing would authorize
  a machine principal with no scope check. Document it on the decorator; there is no route to
  enforce it on today.
- Unknown-`keyId` rejection is measurably faster than wrong-secret rejection (no bcrypt). Accepted:
  it leaks `keyId` existence, not the secret, and `keyId` is public by design. Constant-time
  equalization is deferred with rate limiting.
