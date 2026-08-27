# Tasks: Generic machine-to-machine API-token authentication

Strict TDD is active for this project (`npx jest --no-coverage`). Each implementation task is
preceded by, or paired with, the spec/test file that must go RED first. Tasks are grouped by
dependency layer; within a group, `[P]` marks tasks that can run in parallel (touch disjoint
files), and unmarked tasks are sequential.

Spec requirement references use the requirement titles from
`openspec/changes/api-tokens-auth/specs/api-tokens-auth/spec.md`.

## 1. Storage layer — entity, migration, principal types

- [x] 1.1 Create `src/database/migrations/<ts>-add-api-tokens.ts` via
      `pnpm migration:create src/database/migrations/add-api-tokens`; hand-write `up()`/`down()`
      per design's SQL (table, `UQ_api_tokens_key_id`, two FKs to `organization.users`, `IF EXISTS`
      guards mirroring `1786244322642-add-scraper-credentials.ts`).
      — Satisfies: One-Time Secret Disclosure (storage shape), Issuance and Revocation Attribution
- [x] 1.2 Create `src/modules/admin/iam/api-tokens/model/api-token.entity.ts` — `ApiTokenEntity
extends BaseEntity` with `@NameColumn` name, `@CodeColumn({unique:true, indexName:
'UQ_api_tokens_key_id'})` keyId, `@PasswordColumn` secretHash (select:false), `@JsonColumn`
      scopes, `@DateColumn` expiresAt, `@IntegerFKIDColumn` createdByUserId/revokedByUserId,
      `@DateColumn` revokedAt. Verify column names match migration 1.1 exactly.
      — Satisfies: One-Time Secret Disclosure, Issuance and Revocation Attribution
- [x] 1.3 [P] Modify `src/modules/auth/model/authorization.types.ts` — add `ApiTokenScope`,
      `MachinePermission`, `ApiTokenPrincipal` (additive only, no existing type touched).
      — Satisfies: Scope-Based Authorization for Machine Principals
- [x] 1.4 [P] Modify `src/libs/secure.functions.ts` — add `compareSecret(plain, hash):
Promise<boolean>` (bcrypt.compare) and `generateApiKeyMaterial(): {keyId, secret}` per design
      (24-hex keyId, base64url 32-byte secret). Add/extend `secure.functions.spec.ts` if one exists
      in this repo's test layout for this file; otherwise cover via consumers in group 2/3.
      — Satisfies: One-Time Secret Disclosure, Bounded-Cost Token Resolution

## 2. Repository, validation, i18n strings (RED before GREEN)

- [x] 2.1 Create `src/modules/admin/iam/api-tokens/config/strings/api-tokens.validation.ts` — i18n
      keys, including a single shared `invalidApiKey` key used by both the "unknown keyId" and
      "wrong secret" rejection paths (AC-5 indistinguishability).
      — Satisfies: Revocation and Expiry Enforcement
- [x] 2.2 Create `src/modules/admin/iam/api-tokens/core/api-tokens.repository.ts` —
      `BaseRepository` subclass plus `findAuthCandidateByKeyId(keyId)`: single `findOne({where:
{keyId}, select: {...}})` including `secretHash` explicitly (overriding column `select:
false`). No `find`/`findAll` path added here.
      — Satisfies: Bounded-Cost Token Resolution
- [x] 2.3 Write `src/modules/admin/iam/api-tokens/core/api-tokens.validation.spec.ts` FIRST (RED) —
      cases: scopes referencing a module/action outside `PERMISSION_MODULES`/`PERMISSION_ACTIONS`
      rejected; empty scopes array rejected; revoke of an already-revoked token handled without a
      partial effect.
      — Satisfies: Scope Vocabulary Validation at Issuance
- [x] 2.4 Create `src/modules/admin/iam/api-tokens/core/api-tokens.validation.ts` (GREEN for 2.3) —
      `validateCreate` defensive re-check against `PERMISSION_MODULES`/`PERMISSION_ACTIONS`
      (DTO-level `@IsIn` is the primary gate; this is belt-and-suspenders per AC-8), plus
      revoke-state validation.
      — Satisfies: Scope Vocabulary Validation at Issuance
- [x] 2.5 Create `src/modules/admin/iam/api-tokens/model/api-tokens.dtos.ts` —
      `ApiTokenScopeDto` (`@IsIn` module/action), `CreateApiTokenDto`, `UpdateApiTokenDto` (no
      `scopes`, no `isActive`), `FilterApiTokenDto`, `IssuedApiTokenDto` (the only shape carrying
      `apiKey`).
      — Satisfies: Scope Vocabulary Validation at Issuance, One-Time Secret Disclosure

## 3. Auth-protocol seam — guard, decorator, resolution service (RED before GREEN)

- [x] 3.1 Create `src/modules/auth/protocols/api-key/api-key.constants.ts` — `API_KEY_HEADER =
'x-api-key'`, `API_TOKEN_PRINCIPAL = 'apiToken'`.
      — Satisfies: Opt-In Token Authentication
- [x] 3.2 [P] Create `src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator.ts` —
      `API_TOKEN_AUTH_KEY`, `ApiTokenAuth()`. Add a code comment documenting the recorded hazard:
      never combine with `@SkipPermissions()` (would authorize a machine principal with no scope
      check).
      — Satisfies: Opt-In Token Authentication
- [x] 3.3 Create `src/modules/admin/iam/api-tokens/core/api-token-auth.service.ts` — `resolve(keyId,
secret): Promise<ApiTokenPrincipal>` per design's hot path (single repository read, single
      `invalid` predicate covering absent/inactive/expired, one `compareSecret`, `toPrincipal`
      grouping). Depends on 1.2, 1.3, 1.4, 2.2, 2.1.
      — Satisfies: Revocation and Expiry Enforcement, Bounded-Cost Token Resolution
- [x] 3.4 Write `src/modules/auth/protocols/api-key/guards/api-token-auth.guard.spec.ts` FIRST
      (RED) — cases: absent header falls through (`return true`, request untouched); public route
      ignores header entirely; valid key on a route without `@ApiTokenAuth()` rejected
      (Unauthorized, before any DB read); malformed `"<keyId>.<secret>"` value rejected; revoked
      token rejected; expired token rejected; wrong secret rejected (same rejection as unknown
      keyId); happy path sets `request.apiToken` and never `request.user`; AC-11 — unknown `keyId`
      triggers zero `compareSecret` calls, known-but-wrong-secret triggers exactly one.
      — Satisfies: Opt-In Token Authentication, Revocation and Expiry Enforcement,
      Bounded-Cost Token Resolution
- [x] 3.5 Create `src/modules/auth/protocols/api-key/guards/api-token-auth.guard.ts` (GREEN for
      3.4) — `canActivate` steps: isPublic → true; no `X-Api-Key` → true; no `@ApiTokenAuth()` on
      route → `UnauthorizedError`; malformed value (split on first `.`) → `UnauthorizedError`;
      `authService.resolve(...)`; `request[API_TOKEN_PRINCIPAL] = principal; return true`.
      — Satisfies: Opt-In Token Authentication, Revocation and Expiry Enforcement

## 4. Existing guard-chain edits (RED before GREEN, on top of existing specs)

- [x] 4.1 Extend `src/modules/auth/protocols/jwt/guards/permissions.guard.spec.ts` FIRST (RED) —
      add cases: machine principal with matching scope passes; machine principal with
      non-matching scope raises `ForbiddenError` (not `UnauthorizedError`); a machine principal
      whose `request.user` independently carries an ADMIN role still does not short-circuit via
      `isAdmin`; existing human-caller cases remain unchanged (regression guard for AC-2).
      — Satisfies: Scope-Based Authorization for Machine Principals
- [x] 4.2 Modify `src/modules/auth/protocols/jwt/guards/permissions.guard.ts` (GREEN for 4.1) —
      read `request[API_TOKEN_PRINCIPAL]`; `isAdmin(request.user)` short-circuit only when no
      machine principal is present; permissions source becomes `machine.permissions` when a
      principal is present, else the existing `request.user?.permissions`; machine-miss path
      throws `ForbiddenError` from `src/commons/domain-error.ts` (human path keeps its existing
      `ForbiddenException`, left byte-identical per AC-2/D8).
      — Satisfies: Scope-Based Authorization for Machine Principals
- [x] 4.3 Modify `src/modules/auth/protocols/jwt/guards/jwt-auth.guard.ts` — add the D2 early
      return: `if (isPublic) return true; if (request[API_TOKEN_PRINCIPAL]) return true; return
super.canActivate(context);`. No dedicated spec file for this guard exists per the design's
      File Changes table; coverage comes from 3.4 (guard interaction) and 5.x (guard-order
      integration) — confirm no regression by running the existing JWT-related suites before
      committing.
      — Satisfies: Opt-In Token Authentication

## 5. Admin CRUD service + controller (RED before GREEN)

- [x] 5.1 Write `src/modules/admin/iam/api-tokens/api/api-tokens.service.spec.ts` FIRST (RED) —
      cases: `create` response never carries `secretHash`, carries `apiKey` exactly once,
      `createdByUserId` taken from the caller argument, not the body; `delete` performs a soft
      revoke (`isActive: false`, `revokedAt`, `revokedByUserId` set) and never calls
      `repository.remove`; update rejects a `scopes`/`isActive` key at the DTO layer (or asserts
      the DTO shape excludes them, per design).
      — Satisfies: One-Time Secret Disclosure, Issuance and Revocation Attribution
- [x] 5.2 Create `src/modules/admin/iam/api-tokens/api/api-tokens.service.ts` (GREEN for 5.1) —
      `create`: `validateCreate` → `generateApiKeyMaterial()` → `hashPassword(secret)` → persist →
      delete `secretHash` from the in-memory entity → return `IssuedApiTokenDto` with `apiKey`.
      `delete` overrides `BaseService.delete` to call `repository.update(id, {isActive: false,
revokedAt: new Date(), revokedByUserId})` instead of `repository.remove`. `update`: name /
      expiresAt only.
      — Satisfies: One-Time Secret Disclosure, Issuance and Revocation Attribution,
      Admin-Gated Token Management
- [x] 5.3 [P] Create `src/modules/admin/iam/api-tokens/config/api-tokens.routes.ts` — route
      constants and the `IAM - API Tokens` Swagger tag.
      — Satisfies: Admin-Gated Token Management
- [x] 5.4 Create `src/modules/admin/iam/api-tokens/api/api-tokens.controller.ts` — `BaseController`
      subclass; six routes (`create`, `update/:id`, `delete/:id`, `get-all`, `get-by-id/:id`,
      `get-by-filters`) each carrying `@RequirePermission({ADMIN, <verb>})` per D5, and carrying
      **no** `@ApiTokenAuth()` (D6 — deliberate omission, load-bearing for AC-3). Depends on 5.2,
      5.3.
      — Satisfies: Admin-Gated Token Management, Opt-In Token Authentication
- [x] 5.5 [P] Create `src/modules/admin/iam/api-tokens/api/docs/api-tokens.swagger.ts` — Swagger
      decorators for the six endpoints, including the issuance response documenting the one-time
      `apiKey` field.
      — Satisfies: One-Time Secret Disclosure
- [x] 5.6 Create `src/modules/admin/iam/api-tokens/api-tokens.module.ts` — wires
      entity/repository/service/controller; exports `ApiTokenAuthService` for consumption by the
      guard (group 3). Depends on 1.2, 2.2, 2.4, 3.3, 5.2, 5.4.
      — Satisfies: Admin-Gated Token Management

## 6. App wiring, guard-order regression, OpenAPI export

- [x] 6.1 Write `src/app.module.spec.ts` FIRST (RED) — read `Reflect.getMetadata('providers',
AppModule)`, filter entries where `provide === APP_GUARD`, assert the `useClass` order is
      exactly `[ApiTokenAuthGuard, JwtAuthGuard, PermissionsGuard]`. This must fail before 6.2 is
      applied (either because `ApiTokenAuthGuard` is absent, or because import wiring is
      incomplete).
      — Satisfies: Opt-In Token Authentication (guard-chain integrity)
- [x] 6.2 Modify `src/app.module.ts` (GREEN for 6.1) — import `ApiTokenModule`; register
      `ApiTokenAuthGuard` as the first `APP_GUARD` provider, ahead of the existing `JwtAuthGuard`
      and `PermissionsGuard` entries. Depends on 5.6, 3.5.
      — Satisfies: Opt-In Token Authentication
- [x] 6.3 Modify `src/main.ts` — `.addApiKey({type: 'apiKey', in: 'header', name: 'X-Api-Key'},
'apiKey')` appended after the existing `addBearerAuth`; document-wide default security
      requirement stays `bearer` (no change to existing operations' contracts).
      — Satisfies: Opt-In Token Authentication
- [x] 6.4 Run `pnpm openapi:export` to regenerate `openapi.json`. Depends on 6.2, 6.3, 5.4, 5.5.
      — Satisfies: (documentation of all endpoint/security changes above)

## 7. Full-suite verification

- [x] 7.1 Run `npx jest --no-coverage` for the full suite (unit layers 1–5 plus the 6.1 integration
      spec) and confirm all RED specs from this plan are now GREEN, with no regression in
      `permissions.guard.spec.ts`'s pre-existing human-caller cases.
      — Satisfies: all requirements (regression gate)

**Post-verify fixes (2026-08-27):** the independent verify pass found the guard spec (3.4) only
exercises a mocked `authService.resolve`, leaving AC-11 (Bounded-Cost Token Resolution) untested
against the real `ApiTokenAuthService.resolve()` / `ApiTokenRepository.findAuthCandidateByKeyId()`.
Added `src/modules/admin/iam/api-tokens/core/api-token-auth.service.spec.ts` mocking only the
repository layer, asserting exactly one `findAuthCandidateByKeyId` call and at most one
`compareSecret` call across the valid/unknown-keyId/revoked/expired/wrong-secret cases (RED not
needed — GREEN against the existing, already-correct `resolve()` implementation; this closed a
coverage gap, not a behavior bug). Also found task 6.3/6.4 only synced `src/main.ts`'s
`DocumentBuilder`, leaving `src/tools/export-openapi.ts`'s separate `DocumentBuilder` (the one
`pnpm openapi:export` actually runs) without the `apiKey` security scheme; added the matching
`.addApiKey(...)` call there and re-ran `pnpm openapi:export`. Full suite re-run: 139 suites /
1401 passed, 0 failures.

---

## Review Workload Forecast

Estimated changed-line counts by group (new files counted in full, modified files estimated as
net diff):

| Group                                                      | Files                               | Est. changed lines                                                 |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| 1 — storage/entity/types                                   | 4 (2 create, 2 modify)              | ~120                                                               |
| 2 — repository/validation/DTOs/strings                     | 5 create                            | ~320                                                               |
| 3 — auth-protocol guard/decorator/service                  | 5 create                            | ~265                                                               |
| 4 — existing guard-chain edits                             | 1 create-spec-extend + 2 modify     | ~90                                                                |
| 5 — admin CRUD service/controller/swagger/module           | 6 create                            | ~420                                                               |
| 6 — app wiring + guard-order spec + main.ts + openapi.json | 1 create, 3 modify                  | ~90 + generated `openapi.json` diff (excluded — machine-generated) |
| **Total (excluding generated openapi.json)**               | **19 create + 7 modify = 26 files** | **~1300 lines**                                                    |

- **400-line budget: at risk.** Total estimated hand-written diff (~1300 lines) is roughly
  3–3.5x the 400-line `review_budget_lines`. Even the largest single group (5 — admin CRUD,
  ~420 lines) alone exceeds the budget.
- **Chained PRs recommended.** The design's own dependency direction (storage → auth-protocol →
  guard-chain edits → admin CRUD → app wiring) maps cleanly onto the task groups above and
  supports independent review/merge at each boundary:
  1. PR1 = Groups 1–2 (storage, repository, validation, DTOs) — no behavioral change to any
     existing route, purely additive.
  2. PR2 = Group 3 (auth-protocol guard/decorator/service) — still inert; `ApiTokenAuthGuard`
     exists but is not yet registered as `APP_GUARD`.
  3. PR3 = Group 4 (existing guard-chain edits) — the only PR touching shared/pre-existing guard
     files (`jwt-auth.guard.ts`, `permissions.guard.ts`); smallest, highest-scrutiny diff, and
     benefits from being reviewed in isolation from new-file noise.
  4. PR4 = Group 5 (admin CRUD surface) — depends on PR1–PR3 merged (module exports
     `ApiTokenAuthService`, entity from PR1).
  5. PR5 = Group 6 (app wiring, guard-order regression spec, main.ts, openapi export) — smallest,
     wires everything together and adds the regression guard; depends on all prior PRs.
- **Decision needed before `sdd-apply`:** yes — confirm with the requester whether to (a) proceed
  as a single PR accepting the budget overrun, or (b) split along the PR1–PR5 boundaries above.
  Group 4 (existing guard-chain edits) is the highest-risk slice regardless of split decision,
  since it is the only group modifying shared authentication files that every existing route
  already depends on; it should not be batched together with the bulk of new-file additions in
  Group 5 even if a full split is declined.
