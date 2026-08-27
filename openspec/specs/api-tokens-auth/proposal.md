# Generic machine-to-machine API-token authentication

**Slug**: `api-tokens-auth`
**Branch**: `feat/api-tokens-auth`
**Repos affected**: backend
**Created**: 2026-08-27

## Problem

External systems have no way to consume this API. Every route sits behind `JwtAuthGuard`, which
only accepts a token minted by the human login flow against an `organization.users` row. Today an
integration has exactly two options, both bad: hand a machine a real person's credentials (a shared
human account whose password rotation, role changes, and offboarding silently break the
integration, and whose actions are indistinguishable from that person's), or mark the route
`@Public()` and expose it to the open internet. Nothing in the codebase models "this caller is a
system, not a person", so there is also nothing to revoke when an integration ends or a credential
leaks.

This change introduces the mechanism only: a generic, reusable, opt-in credential any module can
put in front of an endpoint later, in the same spirit as `@Public()` / `@RequirePermission()`.

## What already exists

- **Guard chain** — `src/app.module.ts:232-243` registers `JwtAuthGuard` then `PermissionsGuard` as
  `APP_GUARD`, resolved in registration order.
- **`PermissionsGuard`** (`src/modules/auth/protocols/jwt/guards/permissions.guard.ts`) matches
  `@RequirePermission({module, action})` against `request.user.permissions`, shaped
  `{ module, permissions: string[] }` (`AuthorizationPermission`), with an `isAdmin(request.user)`
  short-circuit before the check.
- **`RequestUser`** (`src/modules/auth/model/authorization.types.ts`) is `{ userId } &
AuthorizationProfile`; `@CurrentUser()` is the only sanctioned reader of `request.user`
  (`docs/POLICIES.md:332`). A machine principal has no `userId`.
- **`hashPassword` / `BCRYPT_ROUNDS=12`** — `src/libs/secure.functions.ts`, the project's existing
  one-way secret convention.
- **`ScraperCredentialEntity`** — outbound-only and reversibly encrypted (`EncryptService`); wrong
  primitive here, but its `@Unique`, `select: false` secret column and `BaseEntity` shape are
  directly reusable.
- **`PERMISSION_MODULES` / `PERMISSION_ACTIONS`** (`src/shared/constants/permission-modules.ts`) —
  hardcoded consts mirroring the `TG2001`/`TG2000` `core.types` seeds; the guard compares plain
  uppercase strings, never FKs.
- **Swagger** — `main.ts:85-101` declares a single `bearer` scheme; `DocumentBuilder.addApiKey` plus
  per-route `@ApiSecurity` is purely additive. Docs mount only outside production, so the committed
  `openapi.json` is the production-visible contract.
- **Absent**: any inbound API-key/service-account concept, any admin audit-log pattern, and
  `@nestjs/throttler`.
- **Admin module convention** — `src/modules/admin/iam/` already holds `roles/`, `user-roles/`,
  `role-module-permissions/`.

## Goals

- A new opaque API token: bcrypt-hashed secret, named, scoped, revocable, with an optional expiry.
  The plaintext is returned exactly once at issuance and is never recoverable afterwards.
- An `ApiTokenAuthGuard` registered ahead of `JwtAuthGuard` that authenticates a token-bearing
  request, attaches a **machine principal** distinct from `RequestUser`, and falls through
  untouched when the header is absent, so the human JWT flow is unchanged.
- An opt-in decorator (`@ApiTokenAuth()`) that declares "this endpoint also accepts an API token".
  Endpoints without it stay JWT-only even if a valid token is presented.
- Admin CRUD to issue, list, and revoke tokens, gated by the existing permission guard.
- Rejection with the existing `AllExceptionsFilter` semantics for: unknown key id, wrong secret,
  revoked (`isActive = false`), expired, insufficient scope, or a valid token on an endpoint that
  did not opt in.

## Design resolutions

Committed directions; mechanics belong to `design.md`.

| #   | Question                           | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Key transport                      | `X-Api-Key: <keyId>.<secret>` — a dedicated header carrying a public, indexed, unique `keyId` and the opaque secret                                                                                                                                                                                                                                                                                                                                          | Keeps the header namespace disjoint from `Authorization: Bearer`, so Passport's JWT extractor and the new guard can never contend for the same value, and it maps 1:1 onto `addApiKey({ in: 'header', name: 'X-Api-Key' })`. The `keyId` prefix is load-bearing: it makes authentication a single indexed row read plus **one** bcrypt compare. A bare secret would force a bcrypt compare against every active token — at 12 rounds that is a self-inflicted DoS.            |
| 2   | Relationship to `PermissionsGuard` | No bypass. Token scopes are stored in the existing `{ module, permissions: string[] }` shape, and `PermissionsGuard` gains a principal-resolution seam that reads the human profile from `request.user` or the machine profile from the API-token principal. `@RequirePermission` stays the single authorization primitive. **The `isAdmin` short-circuit is never reachable by a machine principal** — a token must carry every scope it needs, explicitly. | An independent scope check would fork authorization in two, so every future endpoint author would have to remember which of two systems guards it. Folding in means the authorization rule for a route is written once and holds for both caller kinds. `RequestUser` and `@CurrentUser()` are untouched, so no consumer inherits a synthetic `userId`.                                                                                                                       |
| 3   | Scope storage                      | JSONB column on the token row, validated at issuance against `PERMISSION_MODULES` / `PERMISSION_ACTIONS`                                                                                                                                                                                                                                                                                                                                                     | A scope set is a frozen grant recorded at issuance, not a live org-model relationship: when an integration's access must change, the correct operation is revoke-and-reissue, not editing rows. The guard already compares plain uppercase strings, so a join to `core.types` would buy no enforcement the guard actually consults, while adding a per-request join to the hot auth path. Cost accepted: no referential integrity, bought back with issuance-time validation. |
| 4   | Audit trail                        | **In scope, minimal**: `createdByUserId`, `revokedByUserId`, `revokedAt` columns on the token row. **Deferred**: any generic audit-log table/interceptor, and `lastUsedAt`.                                                                                                                                                                                                                                                                                  | A long-lived credential that cannot be attributed to whoever issued it is the liability, and three columns written in the flows that already exist is near-zero new surface. The generic audit table is the real design project and should not be invented as a side effect of this one. `lastUsedAt` is excluded deliberately: it turns every authenticated read into a write on a shared hot row.                                                                           |
| 5   | Module path                        | `src/modules/admin/iam/api-tokens/` — confirmed                                                                                                                                                                                                                                                                                                                                                                                                              | Token issuance is an IAM administration action, sitting beside `roles/`, `user-roles/`, `role-module-permissions/`, and matching the plural kebab-case folder convention already used there.                                                                                                                                                                                                                                                                                  |

## Non-goals

- **No business endpoint is opted in.** `@ApiTokenAuth()` is applied to zero existing routes in this
  change; which domain an external system may query is not yet known. Exposing a route is a
  follow-up change with its own scope decision.
- **No rate limiting / `@nestjs/throttler`.** Reflagged as a risk below, not blocking.
- No OAuth2 client-credentials flow, no JWT-format machine tokens, no refresh/rotation endpoint.
- No change to `RequestUser`, `@CurrentUser()`, the login flow, or existing JWT behaviour.
- No self-service token issuance — admin-issued only.
- No change to the `X-School-Id` / `X-Modality-Type-Id` / `X-Academic-Period-Id` scope-header
  contract; a machine caller on a scoped route supplies them like any other caller.
- No frontend work.

## Acceptance criteria

1. **AC-1** — Given an active, unexpired token whose scopes satisfy the route's
   `@RequirePermission`, when it is presented as `X-Api-Key` to a route carrying `@ApiTokenAuth()`,
   then the request is authorized without any JWT.
2. **AC-2** — Given a request with no `X-Api-Key` header, when it hits any route, then behaviour is
   byte-identical to today (JWT flow, `@Public()`, `@SkipPermissions()` all unchanged).
3. **AC-3** — Given a valid token, when it is presented to a route that does **not** carry
   `@ApiTokenAuth()`, then the request is rejected — a token never widens reach beyond opted-in
   routes.
4. **AC-4** — Given a token whose scopes do not include the route's `{module, action}`, when it is
   presented to an opted-in route, then it is rejected as forbidden, not unauthorized.
5. **AC-5** — Given a revoked (`isActive = false`) or past-expiry token, when presented, then it is
   rejected, and the rejection is indistinguishable from an unknown key to the caller.
6. **AC-6** — Given issuance, when the admin endpoint responds, then the plaintext secret appears in
   that response exactly once; no later read, list, log, or error surfaces it, and the stored column
   holds only a bcrypt hash.
7. **AC-7** — Given an issued or revoked token, when the row is inspected, then it records which
   user issued it and, if revoked, which user revoked it and when.
8. **AC-8** — Given scopes referencing a module or action outside `PERMISSION_MODULES` /
   `PERMISSION_ACTIONS`, when issuance is attempted, then it is rejected at validation.
9. **AC-9** — Given a caller without the required admin permission, when they call any token
   management endpoint, then it is rejected by the existing permission guard with no partial effect.
10. **AC-10** — Given an API-token principal, when it reaches `PermissionsGuard`, then the `isAdmin`
    short-circuit does not apply to it, and `@CurrentUser()` never receives a machine principal.
11. **AC-11** — Given authentication of a presented token, when it is resolved, then exactly one
    candidate row is loaded (by `keyId`) and at most one bcrypt comparison is performed.

## Dependencies

- `hashPassword` / `BCRYPT_ROUNDS` (`src/libs/secure.functions.ts`).
- `PERMISSION_MODULES` / `PERMISSION_ACTIONS` (`src/shared/constants/permission-modules.ts`) as the
  issuance-time scope vocabulary.
- `AllExceptionsFilter` (`src/shared/filters/all-exceptions.filter.ts`) — no new wiring.
- New migration under `src/database/migrations/` (`pnpm migration:create`), `PK_`/`UQ_`/`IDX_`
  naming.
- `pnpm openapi:export` re-run once the admin controller and second Swagger scheme land.

## Risks

| Risk                                                                                        | Impact                                                                                         | Mitigation                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guard order in `app.module.ts` is load-bearing and unenforced at compile time               | A reorder silently breaks M2M auth or, worse, the JWT flow                                     | Design must pin ordering explicitly and cover it with a test that fails on reorder, not a comment                                                                                 |
| No rate limiting anywhere (`@nestjs/throttler` absent)                                      | A machine credential has no UI friction and is a better brute-force target than the login form | `keyId`-scoped lookup means a guess must hit a real `keyId` first; a high-entropy secret is required. Explicitly deferred, and this change makes the case for throttling concrete |
| Touching `PermissionsGuard` (resolution #2) modifies a guard on every authenticated request | A regression here is site-wide, not feature-local                                              | Change is additive (fall back to `request.user` when no machine principal); AC-2 and AC-10 exist to pin the human path                                                            |
| JSONB scopes have no referential integrity                                                  | A renamed module const leaves stale scopes that silently stop matching                         | Issuance-time validation against the consts; revoke-and-reissue is the documented path for scope change                                                                           |
| Long-lived tokens with no `lastUsedAt`                                                      | An abandoned integration's credential stays live and unnoticed                                 | Optional expiry is supported from day one; usage telemetry deferred deliberately (see resolution #4)                                                                              |
| Swagger mounts only outside production                                                      | External consumers depend on committed `openapi.json` for the new scheme                       | Same constraint the frontend already lives with; re-export is a listed dependency                                                                                                 |

## Open questions

None blocking. Deferred by choice and recorded above: rate limiting, generic audit logging,
`lastUsedAt` telemetry, and which business endpoints eventually opt in.
