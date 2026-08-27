# Exploration: Generic M2M API-key authentication

## Current State

**Auth pipeline** (`src/app.module.ts:232-243`): two global guards registered via `APP_GUARD`, in exact registration order — `JwtAuthGuard` then `PermissionsGuard`. NestJS resolves multiple `APP_GUARD` providers in registration/array order. Any new M2M guard added as a third `APP_GUARD` runs _after_ these two unless deliberately ordered earlier, and neither existing guard knows about an API-key principal — an API-key request would 401 at `JwtAuthGuard` unless marked `@Public()`, which would also skip `PermissionsGuard` (both read the same `IS_PUBLIC_KEY`).

- `JwtAuthGuard` (`src/modules/auth/protocols/jwt/guards/jwt-auth.guard.ts`) — extends `AuthGuard('jwt')`, short-circuits `true` only for `@Public()`.
- `PermissionsGuard` (`.../guards/permissions.guard.ts`) — short-circuits on `@Public()`/`@SkipPermissions()`, then `true` for `isAdmin(request.user)`, else requires `@RequirePermission({module, action})` matched against `request.user.permissions`. **Throws Nest's own `ForbiddenException`, not `src/commons/domain-error.ts#ForbiddenError`** — the domain-error convention is not universally followed in the guard layer today, so a new M2M guard using Nest exceptions directly is consistent with existing precedent (though the domain error classes remain preferable and are equally handled by `AllExceptionsFilter`).
- `RequestUser` (`src/modules/auth/model/authorization.types.ts`): `{ userId, roles, permissions }`. `@CurrentUser()` reads `request.user` typed as `RequestUser` — the only sanctioned way to read the principal outside a guard (`docs/POLICIES.md:332`). A machine principal is not `userId`-bearing, so it cannot reuse `RequestUser`/`@CurrentUser()` without either inventing a synthetic `userId` or widening the type into a union that every consumer must handle.
- `AllExceptionsFilter` (`src/shared/filters/all-exceptions.filter.ts`, wired in `main.ts:37`) maps `DomainError` (by `kind`) and any `HttpException` (by status) to `ResponseDto` — a new guard throwing either is handled with zero extra wiring.
- **Swagger**: `main.ts:85-101` currently defines exactly one scheme (`addBearerAuth(..., 'bearer')` + `addSecurityRequirements('bearer')`). `DocumentBuilder` supports adding a second named scheme (e.g. `addApiKey({type:'apiKey', in:'header', name:'X-Api-Key'}, 'apiKey')`) plus per-route `@ApiSecurity('apiKey')` — purely additive, confirmed feasible. Swagger docs mount only when `NODE_ENV !== 'production'` (`main.ts:84`), so `openapi.json` is the only production-visible contract for M2M consumers.
- **No existing inbound M2M/API-key/service-account concept** anywhere in `src/`. `ScraperCredentialEntity` (`src/modules/admin/scraping/credentials/model/scraper-credentials.entity.ts`) is outbound-only (this backend authenticating _to_ Banner/u-planner) and stores a **reversibly encrypted** password (`EncryptService`, AES-256-GCM) because the outbound flow needs the plaintext back. Wrong primitive for an inbound API key — a key secret should be **bcrypt-hashed** (`src/libs/secure.functions.ts#hashPassword`, `BCRYPT_ROUNDS=12`, the project's existing password convention), since nothing ever needs the plaintext back after issuance. The entity's `@Unique`, `select: false` on the secret column, and `BaseEntity` (`id`, `extra` JSONB, `isActive`, `createdAt`, `updatedAt`) are directly reusable.
- **No audit-log pattern exists** for admin create/revoke actions. Grep for `audit|AuditLog` across `src/` returns only `upload-logs`/`notification-logs` (unrelated) plus migration/generator noise. There is no generic "who changed this admin record" table, interceptor, or `createdBy` column convention. A token issuance/revocation audit trail has no template to imitate — it's new design surface if required.
- **Rate limiting**: `@nestjs/throttler` is not installed (confirmed); documented as an accepted risk in `docs/CONTEXT.md`. An M2M credential is a more attractive brute-force target than the human login form (no UI friction) — worth reflagging, out of scope unless requested.
- **Scope headers** (`X-School-Id`, `X-Modality-Type-Id`, `X-Academic-Period-Id`, `docs/POLICIES.md:336-361`) are read from request headers on every scoped endpoint. An M2M caller hitting a scoped route must supply these explicitly — a caller-contract concern for whichever routes are exposed to M2M, orthogonal to the auth mechanism itself.
- **Permission model**: `PERMISSION_MODULES`/`PERMISSION_ACTIONS` (`src/shared/constants/permission-modules.ts`) are hardcoded consts mirroring `TG2001`/`TG2000` seed rows; `PermissionsGuard` matches `{module, action}` against `request.user.permissions`. A generic "opaque key with scopes" needs its own scope vocabulary — reusing the same `{module, action}` shape is the path of least resistance but requires deciding: scopes looked up per-request via a join, or denormalized as JSONB on the token row (no referential integrity).
- **Migrations**: `pnpm migration:create src/database/migrations/<kebab-case-name>`; naming `PK_`/`FK_`/`UQ_`/`IDX_` — confirmed against `1786244322642-add-scraper-credentials.ts`.
- **`openapi.json`** is committed, regenerated via `pnpm openapi:export` — will need re-export once the new admin CRUD controller and Swagger scheme land.
- **Module placement**: token management is an admin action on other systems' access, so it belongs under `src/modules/admin/<domain>/<module>/` (e.g. `src/modules/admin/iam/api-tokens/`), alongside the existing `RoleModule`/`UserRoleModule`/`RoleModulePermissionModule` under `src/modules/admin/iam/`.

## Affected Areas

- `src/app.module.ts` — register the new guard as an `APP_GUARD`; ordering is load-bearing.
- `src/modules/auth/protocols/jwt/guards/jwt-auth.guard.ts`, `.../guards/permissions.guard.ts` — either guard must recognize/bypass an already-authenticated key request, or a branching guard replaces the JWT check for M2M routes.
- New module `src/modules/admin/iam/api-tokens/` (`api/`, `model/`, `core/`, `config/`) — entity, repository, validation, service, admin CRUD controller (issue/list/revoke).
- New decorator + guard pair (e.g. `@RequireApiScope(...)` / `ApiTokenAuthGuard`), placed beside `@Public()`/`@SkipPermissions()`/`@RequirePermission()` (`src/modules/auth/protocols/jwt/decorators/` or a sibling `protocols/api-key/`).
- `src/main.ts` — add a second Swagger security scheme + per-route `@ApiSecurity('apiKey')`.
- `src/libs/secure.functions.ts` — reuse `hashPassword`/`BCRYPT_ROUNDS` for the token secret.
- `src/database/migrations/` — new migration for the token table (+ scope storage).
- `openapi.json` — regenerate.
- No existing test references API keys; all new coverage is additive.

## Approaches

1. **Dedicated `ApiTokenAuthGuard` as an earlier `APP_GUARD`, header-based key detection, falls through to existing JWT flow when absent** — separate `protocols/api-key/` folder mirroring `protocols/jwt/`.
   - Pros: decouples the two protocols; JWT flow untouched; scopes checked in the same guard that authenticates.
   - Cons: guard order becomes load-bearing and silently breakable; still needs to coordinate with `PermissionsGuard` (bypass entirely, or make it recognize a machine `permissions`-shaped array).
   - Effort: Medium.

2. **Single combined multi-strategy guard replacing `JwtAuthGuard`**, trying JWT then API key, unifying into one `request.user` shape.
   - Pros: one guard, zero changes to `PermissionsGuard`/`@RequirePermission` if the machine principal satisfies `RequestUser`-like `{permissions}`.
   - Cons: conflates two auth mechanisms in one class; forcing a machine principal into `{userId, roles, permissions}` means either a fake `userId` (leaky, breaks anything assuming `userId` maps to an `organization.users` row) or widening `RequestUser` into a union touching every human-assuming consumer.
   - Effort: Medium-High.

3. **Opt-in per-route decorator only, no global `APP_GUARD`.**
   - Pros: zero risk to existing global-guard chain; fully opt-in.
   - Cons: any route wanting _both_ JWT-or-key auth still needs `@Public()` plus duplicated "try JWT, else key" logic per controller — converges back to Approach 1's guard once dual-protocol endpoints are needed.
   - Effort: Low (M2M-only endpoints), Medium (dual-protocol case).

## Recommendation

**Approach 1** — dedicated `ApiTokenAuthGuard` as an earlier `APP_GUARD`, falling through to the existing JWT guard when the key header is absent. Keeps the two protocols decoupled (matches the `protocols/jwt/` precedent and the "generic, reusable" requirement), avoids polluting `RequestUser`/`@CurrentUser()` with a synthetic human shape, and needs the least change to already-shipped `JwtAuthGuard`/`PermissionsGuard` code. Open design questions for `sdd-propose`/`sdd-design`:

- Exact header/scheme (`X-Api-Key` vs. `Authorization: ApiKey <token>` vs. a prefixed Bearer variant).
- Whether key requests bypass `PermissionsGuard` entirely (independent scope check) or fold into the same `{module, action}` check via a machine `permissions` array (keeps `@RequirePermission` as the single authorization primitive — likely the cleaner long-term design).
- Scope storage: JSONB column (fast, no referential integrity) vs. join table against `core.types` (consistent with human permissions, more moving parts).
- Whether token issuance needs an audit trail — no existing pattern to copy, must be designed fresh or explicitly deferred.

## Risks

- **Guard-order fragility**: correctness depends on `APP_GUARD` array order in `app.module.ts`; nothing enforces this at compile time.
- **No rate limiting anywhere** (`@nestjs/throttler` absent) — M2M credentials are a higher-value brute-force target than the human login form.
- **No audit-log pattern** exists for admin-issued credentials — traceability of who issued/revoked a key must be designed from scratch or explicitly deferred.
- **Scope-model choice has migration cost either way** (JSONB vs. join table) — decide deliberately rather than defaulting.
- **`RequestUser`/`@CurrentUser()` coupling**: any code written against `{userId, roles, permissions}` breaks if a machine principal is later forced through the same shape — favors a distinct machine-principal type from day one.
- **Swagger only mounted outside production** — the committed `openapi.json` is the sole production contract surface for M2M consumers, same as it is today for the frontend.

## Ready for Proposal

Yes. Mechanism, token model (opaque + scopes, bcrypt-hashed, revocable, optional expiry), and "generic/reusable" requirement are already decided by the user. Enough constraints are now confirmed (guard order, `RequestUser` shape, Swagger multi-scheme support, absence of audit-log/rate-limiting patterns, module placement convention) that `sdd-propose` can write a concrete proposal. The three open design questions above should be resolved there or explicitly deferred to `sdd-design`.
