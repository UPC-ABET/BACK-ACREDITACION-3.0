# Design — Planner API login with stored credentials

**Slug**: `planner-api-login`
**Proposal**: `./proposal.md`

## Read first

- `./proposal.md` — the ticket, and decisions 1–7 which this design must not reopen.
- `docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md` — **written for
  this change.** Storing external credentials under `APP_SECRET`, and the four costs that
  come with it. Its negatives 1 and 4 are load-bearing on this design.
- `docs/POLICIES.md` §§ Entity Rules, Custom Column Decorators, Migrations, Database Access
  (Repository Boundary), Validation Pattern, Auth & Guards, Response Format, The API spec is
  a committed artifact.
- `docs/CONTEXT.md` §§ Database (schemas), Module Layout, External Integrations.
- `src/modules/admin/planner/planner-token/` — all five files. The service is what this
  change rewrites.
- `src/modules/admin/planner/scraper/core/planner-http.client.ts` — the only non-controller
  consumer. **Line 47's `authRetried` guard** is why the retry path cannot loop.
- `src/modules/admin/banner/auth-sessions/` — `config/auth-sessions.routes.ts`,
  `api/auth-sessions.controller.ts`, `core/auth-session.store.ts`. The shape being mirrored.
- `src/libs/encrypt.service.ts` + `encrypt.module.ts` — AES-256-GCM, `@Global()`.
- `src/commons/domain-error.ts`, `src/commons/base.entity.ts`, `src/commons/base.repository.ts`,
  `src/commons/base.decorator.ts` (`HttpMethodWithSwagger` accepts `body` / `responseType`).
- `src/modules/core/parameters/` — the closest structural model for a small `core`-schema module.
- `src/database/migrations/1783311120113-ensure-core-password-reset-tokens.ts` — the
  table-creation migration to copy for style (`PK_`/`UQ_`/`IDX_` naming, idempotent guards).

Two facts found while reading that this design depends on:

1. **`EncryptModule` is `@Global()`** — `EncryptService` injects with no module import.
2. **`EncryptService` has no consumer today.** The only reference in `src/` is a re-export in
   `src/libs/parameter.functions.ts`. This change is its first production use, so its
   round-trip must be proven by test rather than assumed (see Testing strategy).

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No — Postgres, existing `core` schema                                                               |
| **Auth or payments provider**                 | **Yes → [ADR-001](../../../docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md)** |
| Public API contract change or breaking change | Partially — assessed, not an ADR                                                                    |
| New module boundary or cross-repo split       | Partially — assessed, not an ADR                                                                    |
| Language, runtime or framework                | No — Playwright stays a dependency                                                                  |
| Contradicting an existing ADR                 | No — ADR-001 is the first                                                                           |

**Conclusion**: ADR required and written — **ADR-001**, status Accepted. It records storing a
third-party system's operator credentials in our database under the application-wide
`APP_SECRET`, and names `APP_SECRET` becoming load-bearing as the primary cost.

The two "partially" rows, with reasoning, because silence is not an answer:

- **Contract change.** Widening `PlannerSessionStatus` with `not_configured` is a breaking
  change to a union the frontend renders. It is recorded in the regenerated `openapi.json`
  and in the cross-repo ordering rule below. It is a consequence of proposal decision 5, not
  an independent architectural choice, so it does not warrant its own ADR.
- **Module boundary.** A new `admin/scraping/credentials` module is routine placement already
  governed by `docs/CONTEXT.md` § Module Layout ("admin responsibilities live under
  `modules/admin/<domain>/<module>`"). No new boundary is being invented.

## Approach

### AC-1 — Two-step API login replaces the browser

The login moves out of the service into a dedicated client,
`planner-token/core/planner-login.client.ts`, exposing one method:

```ts
login(username: string, password: string): Promise<PlannerTokenSession>
```

Step 1 POSTs to `PLANNER_LOGIN_API_URL` (default
`https://upc-e2g-post-api.u-planner.com/api/user-api`) with
`{ name, password: Buffer.from(password, 'utf-8').toString('base64'), error: false, type: 'web', authName: '' }`.
Step 2 POSTs to `PLANNER_VALIDATE_URL` with header `x-access-token` set to step 1's `data`.
It maps `data.token` → `accessToken` and `data.user.id` → `userId`, with the access expiry through
the **existing** `expFromJwt` (moved to the client alongside `decodeJwt`). `refreshToken` is
recorded when present; see the AC-2 amendment.

Putting it in `core/` matches where `planner-http.client.ts` already lives and makes the whole
flow testable by stubbing `global.fetch`, with no filesystem and no database.

`playwright`, `chromium`, `PUPPETEER_EXECUTABLE_PATH` and the four `TOKEN_KEY` /
`REFRESH_KEY` / `TOKEN_EXP_KEY` / `REFRESH_EXP_KEY` constants are deleted from the service.
The AC is verified by grep, not by eye — see tasks.

### AC-2 — Both rejection shapes, including `status:false` on a 200

The captured sample is a **success** and we have never seen a rejection, so the client treats
a response as successful only when **all** of these hold, and treats anything else as a
rejection:

- HTTP status is 2xx, **and**
- the body parses as JSON, **and**
- `status !== false`, **and**
- the **load-bearing** payload is present (step 1: a non-empty string `data`; step 2: `data.token`
  and a numeric `data.user.id`).

**Amended 2026-08-09 (audit round 2, Task B.10):** `data.refreshToken` was originally in that list.
Nothing renews with it, so requiring it let a field the system never reads veto a valid login —
the "fails closed on data it does not need" defect this client was written to remove. It is now
recorded when present, ignored when absent, and its expiry resolves to `null` rather than throwing.
Only the access token's expiry is mandatory.

That ordering matters: the `status` boolean is checked _before_ the payload, so a `200` with
`status:false` reports as rejected credentials rather than as a malformed response.

The client throws two distinct login errors:

| Error                          | Raised when                                                                                                     | Service maps to                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `PlannerLoginRejectedError`    | 4xx (other than 404/405/408/410/429), `status:false`, or a missing/unparseable payload                          | `400 error.planner.invalidCredentials` |
| `PlannerLoginUnreachableError` | `fetch` throws, a refused redirect, the timeout, a truncated body, 5xx, 404/405/408/410/429, an undecodable JWT | `503 error.planner.unreachable`        |

**Both** callers must honour the split: `POST /credentials` and `POST /refresh` each answer `503`
for the unreachable case rather than blaming the credentials (round 3, Task C.1).

The split exists because of the proposal's risk row: an operator must never be told a correct
password is wrong because u-planner was down.

**Amended 2026-08-09 (round 4, Task D.1):** this originally read "both extend
`PlannerSessionExpiredError` so every existing `catch` keeps working unchanged". That inheritance
was the defect. `PlannerScraperService` classifies a whole scrape run by `instanceof
PlannerSessionExpiredError`, so an unreachable u-planner finished the run as `expired` — the
misdiagnosis the split exists to prevent, arriving through the type hierarchy after the two HTTP
paths had been fixed against it. Only `PlannerLoginRejectedError` extends it now; a refusal is the
one case that genuinely disproves the stored session. `PlannerLoginUnreachableError` extends
`Error`, and the paths that must log both without discriminating use `isPlannerLoginError`.

### AC-3 — No silent failure path, no secrets in logs

Three paths currently return `expired` with no log. Each gets exactly one statement:

| Path                              | Level   | Content                                           |
| --------------------------------- | ------- | ------------------------------------------------- |
| `login()` failing, for any caller | `warn`  | the error's `name` and `message`                  |
| cooldown short-circuit            | `debug` | remaining cooldown ms                             |
| decryption failure                | `error` | that the stored credential could not be decrypted |

**Corrected 2026-08-08 (audit round 1):** the `warn` was originally placed in `refresh()`. The
scraper reaches sessions through `getValidSession()` and never touches `refresh()`, so every
scrape-time login failure was still silent — the exact gap this AC exists to close. It now lives
in `login()`, which all paths go through.

The password is never an argument to a log call, never included in an error message, and
never written to the token store. The login client builds its error messages from the HTTP
status and the response's own `message` field only — it must not echo the request body, which
is where the base64 password lives. Enforced by review grep, listed in tasks.

### AC-4 / AC-5 — Cached fast path, forced re-login, and deleting the wedge

`resolveSession` collapses to two branches:

```
existing = store.read()
if (existing && !force && remaining(existing.accessTokenExpiresAt) > REFRESH_SKEW_MS)
    return existing            // no HTTP call at all
return login()                 // full 2-step, always
```

`refreshViaApi` is **deleted**, not repaired. The refresh token is still persisted as part of
`PlannerTokenSession` but is never sent anywhere. There is no branch that can prefer a
refresh-token call over a login, so the production wedge is unreachable by construction
rather than by correctness of a condition — which is the point, since the wedge was a correct
condition guarding a broken call.

The single-flight promise and `REFRESH_COOLDOWN_MS` are both kept. The cooldown's original
rationale (don't relaunch Chromium) is gone, but it still protects u-planner from being hammered by
repeated button presses, and it now logs (AC-3) instead of being invisible.

**Amended 2026-08-09 (round 3, C.6):** the two fields `refreshing` / `refreshingIsForced` were
collapsed into a single `flight: { promise, forced } | null`. This document called the field
`refreshing` throughout; the code has one field named `flight`.

**Amended 2026-08-09 (round 4):** a non-forced caller now checks the cached session _before_ it can
join any flight. Without that it would be conscripted into an operator's forced refresh — waiting
out the full login timeout and inheriting a failure about a session it was not using, which
`PlannerScraperService` records as an expired run.

### AC-6 / AC-13 — The credentials table and its module

New module `src/modules/admin/scraping/credentials/`, provider-agnostic:

```
admin/scraping/credentials/
├── api/scraper-credentials.service.ts
├── model/scraper-credential.entity.ts
├── model/scraper-credentials.dtos.ts
├── core/scraper-credentials.repository.ts
├── core/scraper-credentials.validation.ts
├── core/scraper-credentials.validation.spec.ts
├── config/strings/scraper-credentials.validation.ts
└── scraper-credentials.module.ts
```

**It has no controller** — a deliberate deviation from the standard layout, in the same
spirit as the `mail` module exception in `docs/CONTEXT.md` § Module Layout. It is
infrastructure consumed by provider modules, and its HTTP surface is provider-shaped
(`/api/planner/session/credentials`) so the frontend sees a Planner screen rather than a
generic credential store. Exposing a generic `/api/scraping/credentials` would create a
second way to write the same row with different validation.

Entity `ScraperCredentialEntity`, `@Entity({ name: 'scraper_credentials', schema: 'core' })`,
extending `BaseEntity`, using custom decorators only:

| Property            | Decorator                                               | Notes                                                                                         |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `providerCode`      | `@CodeColumn({ unique: false, nullable: false })`       | `'PLANNER'` \| `'BANNER'`; uniqueness via `@Unique` below so the name is readable, not a hash |
| `username`          | `@TextShortColumn({ nullable: false })`                 | VARCHAR(100), plaintext — not a secret                                                        |
| `passwordEncrypted` | `@TextMediumColumn({ nullable: false, select: false })` | VARCHAR(1000); `iv:ct:tag` hex                                                                |

Plus `@Unique('UQ_scraper_credentials_provider_code', ['providerCode'])` and
`@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraper_credentials' })`.

`select: false` on the ciphertext is defence-in-depth for AC-8: a `findOne` without an
explicit selection cannot return it even by accident, so the read endpoint is safe by default
rather than by remembering to strip a field. The repository's decrypt path selects it
explicitly.

`providerCode` values come from a new `SCRAPER_PROVIDER_CODES` constant, not string literals.

All database access is in `ScraperCredentialRepository` (`findByProvider`,
`findByProviderWithPassword`, `upsertForProvider`). `ScraperCredentialService` injects the
repository and `EncryptService` only — no `DataSource`, no query builders. Migration is
hand-written after `pnpm migration:create src/database/migrations/add-scraper-credentials`,
modelled on `1783311120113`, with `down()` dropping the table.

**Decryption failure is its own outcome** (ADR-001, negative 4). `getDecrypted` wraps
`EncryptService.decrypt` in a try/catch and throws `error.scraperCredential.decryptionFailed`,
logged at `error`. It must never surface as `invalidCredentials`.

### AC-7 / AC-10 — Verify before persisting, and discard the old session

The save path is ordered so that a rejected login cannot leave a trace:

```
0. validate the trimmed input                                      (round 4) -> nothing written
1. throttle slot claimed on ENTRY for 60s, released on success and on an unreachable
   u-planner, re-armed 30s on a rejection                          (round 3, C.2)
2. session = await loginClient.login(dto.username, dto.password)   // throws -> nothing written
3. await credentials.save('PLANNER', dto.username, encrypt(dto.password))
4. tokenService.adoptSession(session)                              // AC-10, one writer for the store
5. return tokenService.getStatus()
```

Step 1 before step 2 is the whole of AC-7. Step 3 is AC-10: the new session comes from the
credentials just verified, so no session obtained under the old credentials survives _on disk_.

**Amended 2026-08-09 (rounds 2–3):** step 3 originally called `store.save` directly, giving the
store two writers. It now goes through `PlannerTokenService.adoptSession`, which also clears the
refresh cooldown and bumps a generation counter — so a login already in flight under the previous
credentials discards its own result and returns the adopted session instead of running a caller's
whole request under the account that was just rotated away.

There is no transaction spanning steps 2 and 3 (one is Postgres, one is a file). If step 3
fails, the credentials are stored but the store file is stale; the next `resolveSession` finds
an expired/absent session and re-logs in with the new credentials, which self-heals. Recorded
here so a reviewer does not read the missing transaction as an oversight.

### AC-8 — The password never leaves the system

Three independent guards: `select: false` on the column; a response DTO
(`PlannerCredentialsResponseDto`) that has no password field at all, typed into
`@ApiResponse`; and no `passwordEncrypted` in any `@ApiProperty`. The save DTO carries
`password` inbound only. Verified by grep over the regenerated `openapi.json`, not by
inspection.

### AC-9 — `not_configured`

`PlannerSessionStatus` gains `'not_configured'`. `getStatus()` returns it when no `PLANNER`
credential row exists, **before** looking at the store file — an orphaned store file from a
previous configuration must not make an unconfigured system look active. `refresh()` in that
state fails with `error.planner.credentialsNotConfigured` rather than attempting a login.

The value keeps the snake*case spelling approved during definition. `docs/POLICIES.md`
governs JSON \_keys*, not enum values, so this is not a policy violation — but it is
inconsistent with the camelCase wire style, and it is called out here so the choice is
visible rather than accidental.

**Named deviation from AC-12**: this makes `getStatus()` **async**, because the
credentials check is a database read. `getValidSession`, `getValidToken` and `refresh` keep
their signatures exactly. `planner-http.client.ts` never calls `getStatus` — only
`getValidSession` — so AC-12's substance (the scraper is untouched) holds, and the only caller
that changes is `PlannerSessionController.getStatus`, which gains an `await`. The HTTP
contract is unchanged apart from the new enum value. Flagged rather than silently absorbed.

### AC-11 — Env vars removed

`PLANNER_USER` and `PLANNER_PASSWORD` are deleted from `src/commons/configs/env.config.ts`.
`envSchema` uses `.passthrough()`, so a server `.env` that still carries them will not fail
validation — removal from the file is a runbook step, not a boot-time guarantee, and the
runbook says so. `PLANNER_TOKEN_STORE_PATH`, `PLANNER_API_BASE` and `PLANNER_VALIDATE_URL` stay;
a new optional `PLANNER_LOGIN_API_URL` is added for step 1's endpoint.

**Corrected 2026-08-09 (audit round 2):** this section originally said `PLANNER_LOGIN_URL` would be
left in place. It was **removed** — this change deleted its only consumer (the browser login), so
keeping it would have left a variable an operator could set to no effect. `PLANNER_LOGIN_API_URL`
and `PLANNER_VALIDATE_URL` are additionally constrained to `https://`, since they decide where the
institutional password is sent.

### AC-12 — The scraper is untouched

`planner-http.client.ts` is not in any task's file list. Its `getValidSession()` /
`getValidSession(true)` calls and the `session.userId` / `session.accessToken` fields it reads
all keep their meaning, because `PlannerTokenSession` is unchanged. Verified by an end-to-end
scrape in the runbook, which is the only way to prove it.

### AC-14 / AC-15 — Spec and tests

Covered under Testing strategy and the final milestone.

## Backend

- **Modules**: `src/modules/admin/scraping/credentials/` (new),
  `src/modules/admin/planner/planner-token/` (rewritten).
- **Entity / migration**: `core.scraper_credentials`, hand-written migration via
  `pnpm migration:create`, `up()` + `down()`.
- **Endpoints** (added to the existing `planner/session` controller):

| Method | Route                              | Body                     | Response                                                 | Permission           |
| ------ | ---------------------------------- | ------------------------ | -------------------------------------------------------- | -------------------- |
| GET    | `/api/planner/session/status`      | —                        | `{ status, tokenExp }` — `status` gains `not_configured` | `SCRAPPING` / `GET`  |
| POST   | `/api/planner/session/refresh`     | —                        | `{ status, tokenExp }`                                   | `SCRAPPING` / `POST` |
| GET    | `/api/planner/session/credentials` | —                        | `{ username, configured, updatedAt }`                    | `SCRAPPING` / `GET`  |
| POST   | `/api/planner/session/credentials` | `{ username, password }` | `{ status, tokenExp }`                                   | `SCRAPPING` / `POST` |

`POST /credentials` is an upsert of a singleton row. All four responses are wrapped by
`parseSuccessResponse` into `ResponseDto`.

- **Guards / scope**: `@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action })`.
  **No scope headers** — Planner credentials are system-wide, not per school/modality/period,
  so no `@SchoolId()` / `@ModalityTypeId()` / `@AcademicPeriodId()` decorators apply. Stated
  explicitly because their absence would otherwise look like an omission in review.
- **i18n keys**, new file
  `planner-token/config/strings/planner-session.validation.ts`:

| Key                                        | Status | Meaning                                                          |
| ------------------------------------------ | ------ | ---------------------------------------------------------------- |
| `error.planner.credentialsNotConfigured`   | 400    | No credential row for `PLANNER`                                  |
| `error.planner.invalidCredentials`         | 400    | u-planner rejected the pair                                      |
| `error.planner.unreachable`                | 503    | u-planner did not answer                                         |
| `error.planner.verificationCooldown`       | 400    | A verification is in flight, or one was rejected in the last 30s |
| `error.scraperCredential.decryptionFailed` | 503    | Stored ciphertext will not decrypt                               |

`decryptionFailed` is a **503**, corrected round 4 — this table said 400 while the code has returned
503 since round 3 (a server misconfiguration, not a malformed request). It shares that status with
`error.planner.unreachable`, so the two are told apart by the key, never by the code: a frontend
that routes on status alone reports an `APP_SECRET` mismatch as "u-planner is down", which is the
misdiagnosis ADR-001 exists to prevent.

`error.planner.saveCredentialsFailed` was specified here and never used — the save path throws
`invalidCredentials` / `unreachable` directly. Removed in round 1.

Plus `error.scraperCredential.*` in the credentials module for its own validation.

- **Validation**: DTO-level (`@IsString`, `@Length`) on `SavePlannerCredentialsDto`;
  business-rule validation in `core/scraper-credentials.validation.ts` throwing domain errors
  from `src/commons/domain-error.ts`, never `HttpException`. The service is permitted its one
  transport-level `ServiceUnavailableException` for `unreachable`, per POLICIES § Validation.

## Cross-repo mode

- **Mode**: **sequential**. One person is doing the backend, and the frontend credentials
  form cannot be built against anything until the endpoints exist. There is no second person
  blocked, so a `contract.md` would be a second source of truth with nothing to gain — the
  committed `openapi.json` is the contract.
- **Contract**: the backend's `openapi.json`, regenerated and committed in this PR (AC-14).
- **Ordering**: this backend PR merges and reaches `staging` **before** the frontend PR
  merges. Until the frontend ships its form, production is configured by calling
  `POST /api/planner/session/credentials` directly — the runbook covers that.
- **Frontend side**: its own change folder under the same slug in
  `UPC-ABET/FRONT-ACREDITACION-3.0`, with `proposal.md` copied verbatim. Its scope is the
  credentials form plus handling `not_configured`. Not designed here.

## Deployment assumption: a single instance

Recorded because nothing else in the change says it and the asymmetry is new. Credentials moved
into Postgres and are therefore shared, while the session file, the single-flight promise, the
refresh cooldown and the verification throttle all remain **per process**.

With one `sys_acc_back` container (the current `docker-compose.prod.yml`, no `deploy.replicas`)
that is correct and simpler. With more than one: a credential saved on replica 1 updates the shared
row but only replica 1's session file, so `GET /status` answers differently depending on which
replica responds until the other's token lapses; each replica logs in independently; and both
cooldowns become per-replica, multiplying the allowance by the replica count.

Running more than one instance therefore requires moving the session out of the file — into
`core.scraper_credentials.extra` or its own row — before scaling, not after.

## Testing strategy

| AC  | Covered by                                                                                                                                                  | Kind        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | `planner-login.client.spec.ts` — asserts both request URLs, the exact step-1 body incl. base64, and the `x-access-token` header; asserts the mapped session | unit        |
| 2   | same spec — 401, 500, `200 {status:false}`, `200` with missing `data.token`, `fetch` throwing                                                               | unit        |
| 3   | `planner-token.service.spec.ts` — a logger spy asserts a `warn` on the swallowed error and a `debug` on the cooldown                                        | unit        |
| 4   | `planner-token.service.spec.ts` — valid session ⇒ `fetch` never called; `force` ⇒ called; two concurrent calls ⇒ one login                                  | unit        |
| 5   | grep assertion in the task + absence of any `refreshViaApi` test                                                                                            | manual/grep |
| 6   | migration run/revert against a local database                                                                                                               | manual      |
| 7   | `planner-credentials.service.spec.ts` — rejected login ⇒ repository `upsert` never called                                                                   | unit        |
| 8   | `openapi.json` grep for `passwordEncrypted` / `password` in any response schema                                                                             | manual/grep |
| 9   | `planner-token.service.spec.ts` — no credential row ⇒ `not_configured`, even with a store file present                                                      | unit        |
| 10  | `planner-credentials.service.spec.ts` — successful save ⇒ `tokenService.adoptSession` called with the new session (it, not `store.save`, is the one writer) | unit        |
| 11  | grep over `src/`; app boots with neither var set                                                                                                            | manual      |
| 12  | **end-to-end Planner scrape run**                                                                                                                           | manual      |
| 13  | `scraper-credentials.validation.spec.ts`; review of service imports                                                                                         | unit        |
| 14  | `pnpm openapi:export` + committed diff                                                                                                                      | manual      |
| 15  | the specs above, each confirmed red first                                                                                                                   | unit        |

**No test performs a real network call to u-planner.** `global.fetch` is stubbed in every
spec. The `EncryptService` round-trip gets its own case, because this change is its first
production consumer and nothing has ever proven it end to end.

Anything marked manual appears in `runbook.md`.

## Risks

| Risk                                                                      | Mitigation                                                                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The rejection shape is inferred, never observed                           | AC-2's whitelist approach: only an explicitly well-formed success is a success. A wrong guess fails closed (reports rejected), never open |
| The base64 password leaks into a log or an error message                  | Error messages are built from HTTP status + the response's `message` only, never the request body. Explicit grep step in the final task   |
| `select: false` is bypassed by a future `find` with an explicit selection | Only the repository selects it, in one named method. The response DTO has no field to put it in                                           |
| `getStatus` becoming async breaks an unseen caller                        | Search showed two callers total. Typecheck catches any other                                                                              |
| The store file write fails after credentials are saved                    | Self-healing — next `resolveSession` re-logs in. Documented under AC-7 so it is not read as an oversight                                  |
| Cooldown masks a real failure during the runbook                          | Runbook says to restart the container (in-memory state) or wait 30s before each verification step                                         |
| `APP_SECRET` differs between environments                                 | ADR-001 negative 1. Distinct `error.scraperCredential.decryptionFailed` key and an `error` log so it is diagnosable in one line           |

## Docs to update in this PR

- [x] `docs/CONTEXT.md` § External Integrations — the uPlanner row: session is obtained
      through u-planner's HTTP API with stored credentials, not by driving a browser.
- [x] `docs/CONTEXT.md` § Security Decisions — a pointer to ADR-001, so the ADR is reachable
      from where someone would actually be reading.
- [x] `docs/CONTEXT.md` § Environment Variables — drop `PLANNER_USER` / `PLANNER_PASSWORD`
      from the key groups; note that Planner credentials now live in the database.
- [x] `docs/adr/README.md` § Index — already updated by `/abet-adr`; verify it is committed.
- [x] `openapi.json` — regenerated via `pnpm openapi:export`.
- [x] **Not** `docs/POLICIES.md` — out of bounds for this change.
