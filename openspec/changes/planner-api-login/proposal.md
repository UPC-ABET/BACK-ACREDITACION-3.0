# Planner API login with stored credentials

**Slug**: `planner-api-login`
**Branch**: `feat/planner-api-login`
**Repos affected**: both (backend is the whole of this change; frontend needs a credentials form and one new status value — see Dependencies)
**Created**: 2026-08-08

## Problem

Planner scraping is **down in production right now**, and the way it broke is the reason
this change is not just a bug fix.

`PlannerTokenService` obtains its u-planner session by driving a headless Chromium through
the u-planner SPA's login form and then reading the JWTs out of the page's `localStorage`.
Three things follow from that design, and all three cost us tonight:

1. **The refresh path was never working.** `refreshViaApi()`
   (`planner-token.service.ts:117`) authenticates to `/api/user-api/validate` with
   `Authorization: Bearer <refreshToken>`. That endpoint authenticates on the
   **`x-access-token`** header, so the call 401s. `resolveSession()` prefers this branch
   whenever the stored refresh token's `exp` is still in the future, and the branch throws
   without falling back to a login — so once a refresh token is invalidated server-side but
   not yet expired, the session **wedges permanently**. Rotating the operator's password
   changed nothing, because the code never reached the login that would have used it.

2. **Every failure is silent and indistinguishable.** Three separate paths return
   HTTP `200 {status:'expired'}` with no log line at all: the `refreshViaApi` throw, the
   `loginHeadless` throw, and the 30-second `REFRESH_COOLDOWN_MS` short-circuit
   (`planner-token.service.ts:71`). Diagnosing this in production meant inferring the code
   path from **HTTP response latency** — 101ms proved the cooldown, ~20s would have proved a
   login timeout. The single most useful string in the whole failure, the
   `PlannerSessionExpiredError` message, is thrown into a void by the `catch` at line 78.

3. **The credentials are baked into the deployment.** They live in `PLANNER_USER` /
   `PLANNER_PASSWORD` in the server `.env`. Rotating them requires an ops person with shell
   access to edit the file and **recreate the container** (`env_file` is read at container
   create time, so `docker restart` silently keeps the old values). The people who actually
   own the u-planner account cannot change it themselves.

The cost lands on accreditation staff: Planner supplies the evaluation structure and student
grades, so while this is wedged, that evidence simply stops arriving — and the UI reports a
flat "expired" that looks like a token that lapsed rather than a system that cannot recover.

The requester has since supplied the HTTP API that the SPA itself calls, which removes the
browser from the picture entirely.

## What already exists

**`src/modules/admin/planner/planner-token/`** — the module this change rewrites:

- `api/planner-token.service.ts` — `getValidSession(force)`, `getValidToken(force)`,
  `getStatus()`, `refresh()`; private `resolveSession`, `refreshViaApi`, `loginHeadless`,
  `readStore`/`saveStore`, and the JWT helpers `decodeJwt` / `expFromJwt` / `numberFromJwt`.
  Single-flight is handled by the `refreshing` promise (line 88).
- `model/planner-session.types.ts` — `PlannerTokenSession { userId, accessToken,
refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }` and
  `PlannerSessionStatus = 'active' | 'expiring' | 'expired'`.
- `model/session-expired.error.ts` — `PlannerSessionExpiredError`.
- `api/planner-session.controller.ts` + `config/planner-session.routes.ts` +
  `api/docs/planner-session.swagger.ts` — `GET /api/planner/session/status` and
  `POST /api/planner/session/refresh`, both gated on `PERMISSION_MODULES.SCRAPPING`.
- The session is persisted as JSON at `PLANNER_TOKEN_STORE_PATH`
  (`/data/banner/planner_token_store.json` in production, on the `./scrapping` bind mount),
  written with mode `0600`.

**Reusable, already in place:**

- `src/libs/encrypt.service.ts` — `EncryptService.encrypt/decrypt`, AES-256-GCM keyed off
  `APP_SECRET`, producing `iv:ciphertext:authTag`. Exactly what the stored password needs.
- `expFromJwt()` (`planner-token.service.ts:237`) already converts a JWT `exp` claim
  (epoch seconds) to ISO — the new flow's expirations come from the same place, so this
  helper survives unchanged while the four `localStorage` key constants die.
- `src/modules/admin/banner/auth-sessions/` — the Banner credentials flow whose endpoint
  shape this mirrors: `config/auth-sessions.routes.ts` (`banner/auth/sessions`),
  `api/auth-sessions.controller.ts` using `@RequirePermission({ module: SCRAPPING, action })`
  and `@CurrentUser() user: RequestUser`.
- `src/modules/core/parameters/` — the generic runtime-config mechanism, **deliberately not
  used here** (decision 1 below).

**Consumers — the blast radius, confirmed by search:**

`PlannerTokenService` is referenced by exactly two files:
`src/modules/admin/planner/scraper/core/planner-http.client.ts` (calls `getValidSession()`
and `getValidSession(true)` on a 401 retry, then uses `session.accessToken` as a bearer and
appends `user=<session.userId>` to every URL) and the session controller. **Keeping the
public contract stable means the scraper is not touched by this change.**

**Not in play:** Banner keeps its Chromium + noVNC streamed login — it has 2FA and cannot be
reduced to a username/password POST. Playwright therefore stays in `package.json` and in the
Dockerfile; it only leaves `planner-token.service.ts`.

## The new login flow

Two POSTs, payloads verified by the requester against the live system:

**Step 1** — `POST https://upc-e2g-post-api.u-planner.com/api/user-api`

```json
{
	"name": "<user>",
	"password": "<base64(password)>",
	"error": false,
	"type": "web",
	"authName": ""
}
```

`password` is **plain base64, not encryption** (e.g. `example-pw` → `ZXhhbXBsZS1wdw==`; verified
against the live payload with the real pair). It carries no security value and the real password
still has to be protected on our side. Returns `{ "data": "<short-lived pre-auth JWT>", "status": true }`.

**Step 2** — `POST https://upc-e2g-post-api.u-planner.com/api/user-api/validate`, header
`x-access-token: <data from step 1>`. Returns the real session:

| Response field      | → `PlannerTokenSession` |
| ------------------- | ----------------------- |
| `data.token`        | `accessToken`           |
| `data.refreshToken` | `refreshToken`          |
| `data.user.id`      | `userId`                |

Expirations come from each JWT's own `exp` claim. Observed on the sample: `iat` 02:10:35,
access `exp` **+12h**, refresh `exp` **+14.4h**.

## Decisions taken (agreed 2026-08-08)

Settled before design; each one changes what "correct" means for the ACs below.

1. **Credentials live in a new dedicated table**, not in `core.parameters`. The parameters
   table is served by generic read endpoints, so a password ciphertext stored there would be
   reachable by anyone holding parameters read access. Shape:
   `provider_code` (`'PLANNER'` | `'BANNER'`), `username`, encrypted `password`, unique on
   `provider_code`. Banner does not migrate onto it in this change — the column exists so it
   can later.
2. **`refreshViaApi` is deleted, not fixed.** When the access token is expired or expiring,
   re-run the full 2-step login. It is two cheap HTTP calls with no browser, so the
   refresh-token path buys almost nothing and it is the exact branch that wedged production.
   `refreshToken` is still persisted when u-planner returns one, but is never used to renew.
   **Amended 2026-08-09:** it is also optional — a login is not failed over a field nothing
   reads (design § AC-2).
3. **Database only — no environment fallback.** `PLANNER_USER` and `PLANNER_PASSWORD` are
   removed from `env.config.ts` and from the server `.env`.
4. **Credentials are verified before they are persisted.** The save endpoint runs the 2-step
   login first; on failure it returns `400` and writes nothing.
5. **`PlannerSessionStatus` gains a fourth value, `'not_configured'`**, so the UI can
   distinguish "nobody has set this up" from "the token lapsed". This is a breaking change to
   a union the frontend renders, and is why this change is cross-repo.
6. **Production is cut over through the new endpoint after deploy**, not by a seed migration
   reading `process.env`. No secret enters a migration file or git history. Planner scraping
   stays down between deploy and that POST — it is already down, so this is not a regression.
7. **Saving credentials discards any cached session.** Recorded as a correctness decision
   rather than a question: keeping the old token store after a credential change would let a
   stale session outlive the account it belongs to.

## Goals

- A Planner session is obtained by two HTTP calls, with no browser process involved.
- The operator's u-planner credentials are set and rotated through the API, by the people who
  own the account, and survive restarts and redeploys without shell access.
- The stored password is encrypted at rest and is never returned by any endpoint, never
  logged, and never written to the token store file.
- No failure is silent. Every path that ends in "expired" says why, server-side.
- A single wedged or rejected token can never again prevent the system from re-authenticating.
- The scraper and its HTTP client are unaffected.

## Non-goals

- Migrating Banner onto the new credentials table, or changing anything about Banner's
  streamed 2FA login. Only the `provider_code` column anticipates it.
- Removing Playwright or Puppeteer from `package.json` or the Dockerfile — Banner needs both.
- Changing where the session is persisted. It stays a `0600` JSON file on the bind mount;
  moving it into the database is separate work.
- Using the u-planner refresh token to renew a session (decision 2).
- Multi-account or per-school Planner credentials. One `PLANNER` row, system-wide.
- Encrypting the tokens inside the store file, or rotating `APP_SECRET`.
- Any change to the Planner scraper, its endpoints, or the RAW datasource.

## Acceptance criteria

1. **AC-1** — Given a configured `PLANNER` credential row and no valid stored session, when
   the service resolves a session, then it POSTs step 1 with body exactly
   `{name, password: base64(plaintext), error: false, type: 'web', authName: ''}`, POSTs step 2
   with header `x-access-token` set to step 1's `data`, and persists `data.token` and
   `data.user.id` with the access expiry taken from that JWT's `exp` claim.
   **No browser process is launched** — `planner-token.service.ts` contains no reference to
   `playwright`, `chromium` or any `localStorage` key.
   **Amended 2026-08-09:** `data.refreshToken` was originally required here too. Nothing renews
   with it, so it is now recorded when present and ignored when absent — see design § AC-2.

2. **AC-2** — Given u-planner rejects the credentials, when a session is resolved, then a
   `PlannerSessionExpiredError` is raised and nothing is written to the token store. This
   holds for **both** rejection shapes: a non-2xx HTTP status, **and** a `200` response whose
   body carries `status: false` or a missing `data` — the sample response has a `status`
   boolean, so a falsy one must not be treated as success.

3. **AC-3** — Given any failure while resolving a session, when `POST /planner/session/refresh`
   returns `expired`, then the underlying reason has been logged server-side at `warn` with
   the `PlannerSessionExpiredError` message; and when the 30-second cooldown short-circuits a
   request, that is logged at `debug`. No path returns `expired` without a corresponding log
   line. Neither the password nor any token appears in any log output.

4. **AC-4** — Given a valid, unexpired stored session, when `getValidSession()` is called,
   then no HTTP call is made to u-planner and the stored session is returned; and when
   `getValidSession(true)` is called, then a fresh 2-step login runs regardless. Concurrent
   callers still share one in-flight login (the existing single-flight behaviour).

5. **AC-5** — `refreshViaApi` and every use of the u-planner refresh token as an
   authentication credential are gone. A stored session whose access token is expired but
   whose refresh token is still valid results in a **full re-login**, not a validate call —
   the production wedge is unreachable by construction.

6. **AC-6** — A new table holds `provider_code`, `username` and the password, with a unique
   constraint on `provider_code` and names following the `PK_` / `UQ_` / `IDX_` convention.
   The password is stored as `EncryptService` ciphertext (`iv:ct:tag`); a direct `SELECT`
   never reveals the plaintext. `up()` and `down()` both work, and `down()` drops the table.

7. **AC-7** — Given credentials are POSTed to the new save endpoint, when u-planner rejects
   them, then the response is `400` with an i18n key, **no row is written or updated**, and
   any previously stored credentials are left intact. When u-planner accepts them, then the
   row is written, the resulting session is persisted to the token store, and the response
   reports the session as active.

8. **AC-8** — The credentials read endpoint returns the configured `username` and whether
   credentials exist, and **never** the password in any form — not plaintext, not ciphertext.
   The same holds for every other response shape in the module and for `openapi.json`.

9. **AC-9** — Given no credential row exists, when `GET /planner/session/status` is called,
   then it returns `not_configured`; and when a refresh is requested in that state, then it
   fails with a distinct i18n key rather than attempting a login. Given a row exists, the
   existing `active` / `expiring` / `expired` semantics are unchanged.

10. **AC-10** — Given a stored session exists, when credentials are saved successfully, then
    the previously cached session is replaced by the one from the new login — no session
    obtained under the old credentials survives the write.

11. **AC-11** — `PLANNER_USER` and `PLANNER_PASSWORD` no longer appear in
    `src/commons/configs/env.config.ts` or anywhere in `src/`, and the application boots
    with neither set. `PLANNER_TOKEN_STORE_PATH`, `PLANNER_API_BASE` and `PLANNER_VALIDATE_URL`
    keep working as configuration.
    **Amended 2026-08-09:** `PLANNER_LOGIN_URL` was originally listed here too. It was the SPA URL
    used only by the deleted browser login, so this change removed its last consumer and it was
    dropped from the schema rather than left as a variable that silently does nothing.

12. **AC-12** — `planner-http.client.ts` is unmodified, and the Planner scraper completes a
    run end to end against the new login path. `getValidSession`, `getValidToken`, `getStatus`
    and `refresh` keep their existing signatures.
    **Amended 2026-08-09:** `getValidToken` was **removed**, not preserved. It had no caller left —
    the Planner API needs `userId` on every request, so `planner-http.client.ts` takes the whole
    session and never asked for a bare token. Keeping a public method nothing calls, on the service
    whose refresh branch had just wedged production, was worse than deleting it. The substance of
    AC-12 is unaffected: the scraper is untouched and the three methods it does use keep their
    signatures. `getStatus()` additionally became `async` (see design § AC-9); no caller passed it
    to anything expecting a synchronous return.

13. **AC-13** — All database access for the new table lives in a repository; the service
    injects no `DataSource`/`EntityManager` and issues no query. Validation lives in a
    `core/*.validation.ts` throwing domain errors from `src/commons/domain-error.ts`, with a
    co-located `.validation.spec.ts`.

14. **AC-14** — `pnpm openapi:export` is run and the regenerated `openapi.json` is committed
    in the same PR, carrying the new endpoints, the new DTOs and the widened
    `PlannerSessionStatus`. Every new endpoint has a typed `@ApiResponse`.

15. **AC-15** — Unit coverage exists for the two-step login (success, step 1 rejection,
    step 2 rejection, `status:false` on a 200), for the credential save path (verified-then-
    saved, rejected-and-not-saved), and for `getStatus` returning `not_configured`. Each new
    test is confirmed to fail before the change that makes it pass. No test performs a real
    network call to u-planner.

### Traceability

Filled in by `/abet-design-feature` and kept current through implementation.

| AC  | Criterion                                                       | Satisfied by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Two-step API login replaces the browser                         | `core/planner-login.client.ts` → `login`/`requestPreAuthToken`/`exchangeForSession`. Verified by grep: `playwright\|chromium\|localStorage\|refreshViaApi\|PUPPETEER` returns nothing under `admin/planner/`. Tests: `planner-login.client.spec.ts` § the happy path                                                                                                                                                                                                                                                                                                                                      |
| 2   | Both rejection shapes handled, incl. `status:false` on a 200    | `planner-login.client.ts` → `postJson`, whitelist ordering (transport → `status` flag → payload). Tests: § rejections (401, `status:false`, missing token, missing user id, non-JSON) and § unreachable                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | No silent failure path; no secrets in logs                      | `warn` moved into `PlannerTokenService.login()` so the **scraper path logs too**, `debug` on the cooldown, `error` on decrypt failure. Tests: `planner-token.service.spec.ts` § failure paths are never silent — the absence check is a shared `afterEach` over the whole block (five logger levels spied), so **every** failure case proves it; `emits both failure log lines without leaking a secret` is the case that guarantees there is output to inspect. Corrected round 2 (B.3) and again round 3 (C.4): the original design ran a _successful_ login, on which the service emits nothing at all |
| 4   | Cached session reused; force re-logins; single-flight preserved | `resolveSession` fast path; `ensureSession` compares flight intent. Tests: § getValidSession, incl. "does not let a forced caller share a non-forced flight"                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | `refreshViaApi` deleted; the wedge is unreachable               | `planner-token.service.ts` has no refresh-token branch at all. Test: "performs a full login when the access token is dead but the refresh token is still valid"                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | Credentials table, encrypted password, working `up()`/`down()`  | `1786244322642-add-scraper-credentials.ts`; `ScraperCredentialEntity` with `select: false`. Verified live: up → `\d` → down → up, `PK_`/`UQ_` names confirmed                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7   | Verify-then-persist; rejection writes nothing                   | `PlannerCredentialsService.save` — `verify()` precedes `credentials.save()`. Tests assert the **mocks are uncalled** on rejection, plus `invocationCallOrder` for the write-before-status ordering                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8   | Password never returned by any endpoint or in the spec          | `select: false`; one named repository method selects it; `PlannerCredentialsResponseDto` has no field for it. Test uses a **hostile row** carrying a ciphertext. Grep: `passwordEncrypted` absent from `openapi.json`                                                                                                                                                                                                                                                                                                                                                                                     |
| 9   | `not_configured` status                                         | `PlannerSessionStatus` widened; `getStatus` checks credentials **before** reading the store. Tests incl. the stale-store-file ordering case                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10  | Saving credentials discards the cached session                  | `PlannerTokenService.adoptSession` — one writer for the store, also clears the cooldown. Test: "hands the freshly obtained session to the token service"                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | Env vars removed; app boots without them                        | **Partially met — deviation recorded (corrected 2026-08-09).** `PLANNER_USER`/`PLANNER_PASSWORD` gone from `env.config.ts` and `src/`; app boots. The deviation is the opposite of what this row previously claimed: `PLANNER_LOGIN_URL` was **removed** too, though AC-11 promised it would "keep working as configuration". Harmless — this change deleted its only consumer and `envSchema` is `.passthrough()` — but AC-11 as written is not met                                                                                                                                                      |
| 12  | Scraper contract unchanged; end-to-end run passes               | **Two deviations recorded (the second corrected round 4):** `getStatus()` is now `async`, and `getValidToken()` was **deleted** — this row previously certified that it kept its signature, which stopped being true in round 3. `planner-http.client.ts` is unmodified and called neither; `getValidSession`/`getStatus`/`refresh` keep theirs. See the dated amendment on AC-12. End-to-end run is runbook step 7 — **not yet executed**                                                                                                                                                                |
| 13  | Repository boundary and validation conventions respected        | All DB access in `ScraperCredentialRepository`; no `DataSource`/`EntityManager`/query builder in any service. `scraper-credentials.validation.ts` throws `BadRequestError`, with `scraper-credentials.validation.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                 |
| 14  | `openapi.json` regenerated and committed                        | `pnpm openapi:export` → 558 paths / 310 schemas, complete even with `RAW_DB_URL` unset (`src/tools/export-openapi.env.ts`). Includes the 503 on `POST /credentials`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 15  | Tests, each confirmed red first; no live network calls          | **Partially met.** `global.fetch` stubbed everywhere — no live calls. But three tests were found vacuous in audit round 1 (they could not have been red) and were rewritten; see `tasks.md` Task A.6                                                                                                                                                                                                                                                                                                                                                                                                      |

## Dependencies

- **Frontend (`UPC-ABET/FRONT-ACREDITACION-3.0`) — required follow-up.** Decision 5 widens
  `PlannerSessionStatus` with `not_configured`, which the Planner session screen renders, and
  decision 3 means the credentials form is the **only** way to configure Planner. Until that
  form ships, production can only be configured by calling the endpoint directly.
  **Superseded 2026-08-08 by `design.md` § Cross-repo mode:** the mode is _sequential_, so no
  `contract.md` is produced — the committed `openapi.json` is the contract. Nobody is blocked
  waiting, and a second source of truth would only drift.
- **Post-deploy runbook step (decision 6).** After the migration runs, the credentials must
  be POSTed once. Until then `GET /planner/session/status` reports `not_configured` and no
  scrape can run. The runbook must also cover removing `PLANNER_USER` / `PLANNER_PASSWORD`
  from the server `.env` and recreating the container — `docker compose restart` does not
  re-read `env_file`, a gotcha that already cost this team a debugging session.
- **`APP_SECRET` becomes load-bearing for Planner.** It already keys `EncryptService`, but
  after this change a rotated or lost `APP_SECRET` makes the stored password undecryptable
  and Planner scraping stops until the credentials are re-entered. Worth a line in the
  runbook; there is no key-rotation mechanism today and this change does not add one.
- **External system: u-planner.** The entire flow depends on two undocumented endpoints whose
  contract we infer from a single captured sample. See Risks.
- **ADR gate.** Design must walk it. Storing a third-party system's credentials in our
  database, encrypted with an application-wide symmetric key, is a hard-to-reverse decision
  with a real failure mode (see `APP_SECRET` above) — a strong ADR candidate. `docs/adr/`
  currently holds only its README, so this would be the first.
- No dependency on Banner, Entra ID, S3 or the RAW datasource.

## Risks

| Risk                                                                                                  | Impact                                                                                         | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API contract is inferred from **one** captured success response; the failure shape was never seen | We guess wrong about how a rejection looks and treat a failed login as a success, storing junk | AC-2 forces both rejection shapes to be handled and requires a falsy `status` to be treated as failure. Design should capture a real rejected-login response before implementing, if the requester can get one                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| u-planner changes these endpoints or their payload without notice                                     | Planner scraping breaks again                                                                  | Unavoidable — but the failure becomes loud (AC-3) instead of silent, which is the difference that mattered this time. The scrape of `localStorage` key names being replaced by a documented payload is a net reduction in fragility                                                                                                                                                                                                                                                                                                                                                                                                                               |
| An operator's password ends up in a log line, an error message or the token store                     | Credential disclosure through logs shipped off-box                                             | AC-3 and AC-8 state it explicitly; design must name the exact log statements and the DTO/response shapes. Worth an explicit grep in the audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `APP_SECRET` is rotated or differs between environments                                               | Stored password cannot be decrypted; Planner silently stops working                            | Decryption failure must surface as a distinct, logged error — not as "invalid credentials", which would send someone hunting the wrong problem. Runbook line. Flagged for the ADR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Removing the env vars leaves production unconfigured                                                  | Planner scraping stays down until someone POSTs the credentials                                | Accepted (decision 6) — it is already down. Runbook step, plus `not_configured` (AC-9) makes the state legible in the UI rather than looking like an expired token                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Verify-before-save makes the save endpoint depend on a third-party call                               | A u-planner outage blocks credential rotation even when the credentials are correct            | Accepted for the UX win. The error must distinguish "u-planner unreachable" from "credentials rejected" so an operator is not told their correct password is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Widening `PlannerSessionStatus` breaks the deployed frontend                                          | The Planner screen renders an unknown status                                                   | **Corrected 2026-08-08 (audit round 1) — the original mitigation was inverted.** It claimed existing sessions keep returning the existing three, so `not_configured` would be rare. The opposite is true: decision 6 leaves production with no credential row, so `not_configured` is the _only_ status the deployed frontend sees between backend deploy and the frontend release, and `POST /refresh` changes from `200 {expired}` to a `400`. There is no `contract.md` (sequential mode). Real mitigation: sequence the frontend release close behind, and accept an unhandled status plus a 400 on the refresh button in the gap. Recorded as a runbook note |
| Two-step login on every expiry doubles the request count against u-planner                            | Rate limiting or account lockout                                                               | Access tokens last ~12h and AC-4 keeps the cached-session fast path, so this is roughly two calls per twelve hours. The retry path in `planner-http.client.ts` is the one to watch — design should confirm it cannot loop                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Open questions

None. Decisions 1–3 were taken by the requester before this proposal, and 4–7 were resolved
on 2026-08-08 in response to the ambiguity gate: verify-then-save, a fourth
`not_configured` status value, and cutting production over through the endpoint rather than a
seed migration. Design can proceed.
