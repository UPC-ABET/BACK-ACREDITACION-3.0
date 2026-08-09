# Tasks — Planner API login with stored credentials

**Slug**: `planner-api-login` · **Proposal**: `./proposal.md` · **Design**: `./design.md`
**Runbook**: `./runbook.md` · **ADR**: `docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md`. Do not edit `docs/adr/ADR-001-*` — it is written; only
  `/abet-adr` may author that directory.
- Tests: `npx jest --no-coverage <path>` for one file, `pnpm test` for the suite.
  Typecheck: `pnpm exec tsc --noEmit -p tsconfig.build.json`. Lint: `pnpm lint`.
- **Never run `pnpm migration:run` against anything but your own local database.**
- **No test may make a real network call to u-planner.** Stub `global.fetch` in every spec.
- **Never log, echo into an error message, or write to the token store the plaintext or
  base64 password.** This is the one rule in this change that has a security consequence.

### Ordering

Milestone 1 and Task 2.1 are independent — different files, no shared edits, safe to run in
parallel. Task 2.2 depends on **both** (the service needs the credentials service and the
login client). Milestone 3 depends on Milestone 2. Milestone 4 is last.

## Goal

Replace the headless-Chromium u-planner login with the two-step HTTP API login, move the
operator credentials out of `.env` into an encrypted database row that can be set through the
API, and make every failure path say why — so a wedged session cannot recur and, if it does,
it takes one log line rather than an evening of latency archaeology to diagnose.

## Slicing

Vertical. Milestone 1 delivers credentials that can be stored and read back. Milestone 2
delivers a session obtained over HTTP with no browser. Milestone 3 delivers the endpoints an
operator uses. Milestone 4 removes the old configuration and squares the docs and the spec.

---

## Milestone 1 — Credentials can be stored encrypted and read back

### Task 1.1 — Entity and migration for `core.scraper_credentials` ✅ DONE (2026-08-08)

- [x] Task complete

> Two things the design did not anticipate.
>
> **`TS2612` on the primary key.** POLICIES says to pass `primaryKeyConstraintName` to
> `@PrimaryGeneratedColumn` on the entity, but **no entity extending `BaseEntity` in this repo
> has ever done it** — every existing use is on a RAW entity that does not extend it, so the
> override collision had never come up. `declare id: number` fixes the compile error, and since
> `declare` fields are ambient I did not assume the decorator survived: dumped
> `getMetadataArgsStorage()` at runtime and confirmed `id|pk=PK_scraper_credentials` and
> `UQ_scraper_credentials_provider_code` both register. It works, but it is a footgun for the
> next person and is worth a POLICIES note (not edited here — that is a conversation).
>
> **The local database was down** (`5432 CLOSED`), the same blocker that stalled
> `unique-chart-entity-per-period`. Resolved rather than deferred: an `abet-postgres` container
> existed, stopped 5 days ago, and starting it was enough.
>
> Verified for real, not asserted: `up()` created the table, `\d` confirmed the eight columns
> and both readable constraint names, `down()` dropped it (table count 0), and `up()` ran clean
> again (count 1). Note `pnpm migration:run` also applied a **pre-existing** pending migration
> (`AddStudyPlanCoursesPeriodCourseUniqueness1786230100453`) that was not mine — local only.

**Files**

- `src/modules/admin/scraping/credentials/model/scraper-credential.entity.ts` (create)
- `src/modules/admin/scraping/credentials/constants/scraper-provider-codes.ts` (create)
- `src/database/migrations/<generated>-add-scraper-credentials.ts` (create)

**Steps**

1. `pnpm migration:create src/database/migrations/add-scraper-credentials`. **Never hand-pick
   the timestamp.**
2. `SCRAPER_PROVIDER_CODES = { PLANNER: 'PLANNER', BANNER: 'BANNER' } as const`. No string
   literals anywhere else in this change.
3. Entity per design § AC-6: extends `BaseEntity`; `@CodeColumn({ unique: false, nullable: false })`
   for `providerCode`, `@TextShortColumn({ nullable: false })` for `username`,
   `@TextMediumColumn({ nullable: false, select: false })` for `passwordEncrypted`. Add
   `@Unique('UQ_scraper_credentials_provider_code', ['providerCode'])` and
   `@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraper_credentials' })`.
   **No raw `@Column()`.**
4. Hand-write `up()`/`down()` modelled on
   `1783311120113-ensure-core-password-reset-tokens.ts` — same idempotent `IF NOT EXISTS` /
   `DO $$` style, `PK_` and `UQ_` names spelled out. `down()` drops the table.
5. `pnpm migration:run` **against your local database only**, then `pnpm migration:revert`,
   then run it again. Both directions must work before this task is done.
6. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping): add the scraper credentials table`

### Task 1.2 — Repository and validation ✅ DONE (2026-08-08)

- [x] Task complete

> 6 cases, green on the first implementation. Honest note on the red: the first run failed on
> **module-not-found**, not on an assertion, because the validation class did not exist yet.
> That is a weaker red than a behavioural one — it proves the test runs, not that it discriminates.
> The two cases that do carry weight are the aggregate one (all three errors reported together,
> not just the first) and the one asserting the password never reaches the error payload.
>
> `validateSave` is synchronous and takes no repository, unlike the `validateCreate(repo, dto)`
> shape in POLICIES — there is nothing to look up. Kept rather than inventing a repository
> argument to match the template.

**Files**

- `src/modules/admin/scraping/credentials/core/scraper-credentials.repository.ts` (create)
- `src/modules/admin/scraping/credentials/core/scraper-credentials.validation.ts` (create)
- `src/modules/admin/scraping/credentials/config/strings/scraper-credentials.validation.ts` (create)
- `src/modules/admin/scraping/credentials/core/scraper-credentials.validation.spec.ts` (test)

**Steps (TDD)**

1. Write the failing validation cases first — save rejects a blank username, a blank password,
   and an unknown `providerCode`.
   `npx jest --no-coverage src/modules/admin/scraping/credentials/core/scraper-credentials.validation.spec.ts` → **red**.
2. Repository extends `BaseRepository<ScraperCredentialEntity>` with exactly three methods:
   `findByProvider` (no password), `findByProviderWithPassword`
   (`select` naming `passwordEncrypted` explicitly — it is `select: false`), and
   `upsertForProvider`.
3. Validation throws `BadRequestError` from `src/commons/domain-error.ts` with i18n keys from
   the strings file. **Never `HttpException`.**
4. Re-run → **green**. Typecheck.

**Commit**: `feat(scraping): add the scraper credentials repository and validation`

### Task 1.3 — Encrypted read/write service ✅ DONE (2026-08-08)

- [x] Task complete

> 9 cases, 15 green across the module. The real-`EncryptService` round-trip earned its keep:
> it is the first time this code has ever run in this repo, and it does work —
> the fixture password survives encrypt → store → decrypt intact.
>
> Node emits `DEP0182` (AES-GCM auth tags under 128 bits) during the corrupt-ciphertext case.
> That comes from **my fixture** (`deadbeef:deadbeef:deadbeef` has a 4-byte tag), not from
> `EncryptService`, which always writes a full 16-byte tag. Harmless, but it will show up in
> CI output and would otherwise look like a production warning.
>
> `save` returns `void` rather than the entity — the caller has no use for a row whose only
> interesting column is `select: false`, and returning it invites someone to serialize it.

**Files**

- `src/modules/admin/scraping/credentials/api/scraper-credentials.service.ts` (create)
- `src/modules/admin/scraping/credentials/model/scraper-credentials.dtos.ts` (create)
- `src/modules/admin/scraping/credentials/scraper-credentials.module.ts` (create)
- `src/modules/admin/scraping/credentials/api/scraper-credentials.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases: `save` then `getDecrypted` returns the original plaintext (**a real
   `EncryptService` round-trip, not a mock — this change is its first production consumer and
   nothing has ever proven it**); `getDecrypted` returns null when no row exists; a row whose
   ciphertext is corrupt throws `credentialDecryptionFailed` and **not** an invalid-credentials
   error. → **red**.
2. Implement. Inject `ScraperCredentialRepository` + `EncryptService` only — **no `DataSource`,
   no query builders** (POLICIES § Repository Boundary). `EncryptModule` is `@Global()`, so it
   needs no import; the module only needs `TypeOrmModule.forFeature([ScraperCredentialEntity])`.
3. Export the service **and** the repository from the module.
4. Re-run → **green**. Typecheck.

**Commit**: `feat(scraping): store scraper credentials encrypted at rest`

---

## Milestone 2 — A Planner session is obtained over HTTP, with no browser

### Task 2.1 — The two-step login client ✅ DONE (2026-08-08)

- [x] Task complete

> 13 cases green. The one that matters most is `200 {status:false}` → rejected: the captured
> sample was a success, so that shape was never observed, and it is the most likely way
> u-planner reports a bad password. If the guess is wrong the client fails **closed** (reports
> rejected) rather than building a session from partial data.
>
> Two points hardened beyond the design: `expFromJwt` now throws a rejection rather than
> producing `Invalid Date` when a token carries no usable `exp`, and `decodeJwt` is wrapped so a
> malformed token cannot surface as a raw `SyntaxError`.
>
> The secret-handling case asserts the plaintext **and** its base64 form are absent from the
> error message — checking only the plaintext would miss the encoded copy, which is the one
> actually placed in the request body.

**Files**

- `src/modules/admin/planner/planner-token/core/planner-login.client.ts` (create)
- `src/modules/admin/planner/planner-token/model/session-expired.error.ts` (modify)
- `src/modules/admin/planner/planner-token/core/planner-login.client.spec.ts` (test)

**Steps (TDD)**

1. Failing cases, `global.fetch` stubbed throughout:
   - success maps `data.token` / `data.refreshToken` / `data.user.id` and derives both
     expirations from the JWTs' `exp` claims;
   - **step 1 is called with the exact body** `{name, password, error:false, type:'web', authName:''}`
     and `password` is `base64(plaintext)` — assert the literal encoding;
   - **step 2 is called with the `x-access-token` header** set to step 1's `data`;
   - `401` → `PlannerLoginRejectedError`;
   - `200` with `{status:false}` → `PlannerLoginRejectedError` (**the case the sample response
     could not tell us about — this is the one that matters**);
   - `200` with a missing `data.token` → `PlannerLoginRejectedError`;
   - `500` → `PlannerLoginUnreachableError`;
   - `fetch` rejecting → `PlannerLoginUnreachableError`.
     `npx jest --no-coverage src/modules/admin/planner/planner-token/core/planner-login.client.spec.ts` → **red**.
2. Add `PlannerLoginRejectedError` and `PlannerLoginUnreachableError`, both extending
   `PlannerSessionExpiredError` so existing `catch` blocks keep working.
3. Implement the client. Move `decodeJwt` / `expFromJwt` / `numberFromJwt` here from the
   service. Success requires **all** of: 2xx, JSON-parseable, `status !== false`, and the
   expected payload present — checked in that order.
4. **Build error messages from the HTTP status and the response's `message` field only.** Never
   include the request body; that is where the base64 password lives.
5. Re-run → **green**. Typecheck.

**Commit**: `feat(planner): add the two-step u-planner API login client`

### Task 2.2 — Rewrite the token service onto the client, delete the browser and the wedge ✅ DONE (2026-08-08)

- [x] Task complete

> 7 cases, all 7 red first — the constructor signature changed, so nothing compiled against the
> old service. The wedge case is asserted directly: an access token expired **one minute ago**
> with a refresh token still valid for two hours now performs a full login. Under the old code
> that exact input took the `refreshViaApi` branch, which is what pinned production.
>
> Verified by grep, not by eye:
> `grep -rn "playwright\|chromium\|localStorage\|refreshViaApi\|PUPPETEER" src/modules/admin/planner/`
> returns **nothing** — the browser is gone from the whole Planner module, not just the service.
>
> `getStatus` is deliberately left synchronous and unchanged here; Task 3.1 owns making it
> async. Splitting it kept this task's red honest.

**Files**

- `src/modules/admin/planner/planner-token/core/planner-session.store.ts` (create)
- `src/modules/admin/planner/planner-token/api/planner-token.service.ts` (modify)
- `src/modules/admin/planner/planner-token/planner-token.module.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (test, new)

**Steps (TDD)**

1. Failing cases: a valid stored session ⇒ **`fetch` is never called**; `getValidSession(true)`
   ⇒ a login runs; an expired access token with a **still-valid refresh token** ⇒ a **full
   login**, not a validate call (this is the production wedge — assert it directly); two
   concurrent `getValidSession()` calls ⇒ one login (single-flight). → **red**.
2. Extract `readStore` / `saveStore` into `PlannerSessionStore` (modelled on Banner's
   `auth-sessions/core/auth-session.store.ts`) so the service is testable without a filesystem.
3. Rewrite `resolveSession` to the two branches in design § AC-4/AC-5. **Delete
   `refreshViaApi` entirely.** Delete `loginHeadless`, the `playwright` import, and the four
   `*_KEY` localStorage constants. Keep `refreshing` (single-flight) and `REFRESH_COOLDOWN_MS`.
4. Wire `ScraperCredentialsModule` into `PlannerTokenModule`; the service resolves credentials
   through `ScraperCredentialService.getDecrypted(SCRAPER_PROVIDER_CODES.PLANNER)`.
5. Re-run → **green**. Then:
   `grep -n "playwright\|chromium\|localStorage\|refreshViaApi" src/modules/admin/planner/planner-token/api/planner-token.service.ts`
   → **expect no output** (AC-1, AC-5). Typecheck.

**Commit**: `feat(planner): obtain the session through the u-planner API instead of a browser`

### Task 2.3 — Make every failure path say why ✅ DONE (2026-08-08)

- [x] Task complete

> Honest split: **2 of the 4** new cases were red. The other two passed before the change and
> are guards, not proof — "never writes a password into a log line" passes trivially when
> nothing logs at all, and only becomes meaningful now that two log statements exist. Worth
> knowing if someone later trims this spec: deleting those statements turns that case back into
> a false positive rather than a failure.
>
> The cooldown case also pins the behaviour that made the original diagnosis so slow: a second
> `refresh()` inside 30s returns `expired` having called the login client **zero** times.

**Files**

- `src/modules/admin/planner/planner-token/api/planner-token.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases using a logger spy: a swallowed `PlannerSessionExpiredError` in `refresh()`
   logs at **`warn`** carrying the error's message; the cooldown short-circuit logs at
   **`debug`**; **no log call receives the password or a token**. → **red**.
2. Add exactly the three statements in design § AC-3. Do not add narration elsewhere.
3. Re-run → **green**. Typecheck.

**Commit**: `fix(planner): log the reason behind every expired session result`

---

## Milestone 3 — Operators can configure Planner through the API

### Task 3.1 — `not_configured` status ✅ DONE (2026-08-08)

- [x] Task complete

> 8 new cases. The sharpest is "reports not_configured even when a stale session file is still on
> disk" — it pins the ordering, and it is the case that fails if someone later moves the
> credentials check below the store read as a perceived optimisation.
>
> `getStatus` is now `async`, the deviation from AC-12 flagged in design § AC-9. The typechecker
> confirmed the blast radius was exactly the one caller predicted: `PlannerSessionController`.
> `planner-http.client.ts` never touches it and is unmodified.
>
> One behavioural change worth noting in review, not in the design: `expiring` used to also cover
> "access token dead but refresh token alive". With the refresh path deleted, that state now reads
> `expired`. Both are one button press from recovery, so the UI meaning is unchanged, but the
> literal status string for that input differs from before.

**Files**

- `src/modules/admin/planner/planner-token/model/planner-session.types.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-session.controller.ts` (modify)
- `src/modules/admin/planner/planner-token/config/strings/planner-session.validation.ts` (create)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases: no credential row ⇒ `getStatus()` returns `not_configured` **even when a
   store file exists** (an orphaned file must not make an unconfigured system look active);
   `refresh()` in that state returns the not-configured key **without** attempting a login
   (assert `fetch` was never called). → **red**.
2. Widen `PlannerSessionStatus` with `'not_configured'`. Add the i18n keys from design §
   Backend.
3. **`getStatus()` becomes `async`** — a named, deliberate deviation from AC-12, recorded in
   design § AC-9. Add `await` in the controller. Confirm by typecheck that nothing else called it.
4. Re-run → **green**. Typecheck.

**Commit**: `feat(planner): report when Planner credentials have never been configured`

### Task 3.2 — The credentials endpoints ✅ DONE (2026-08-08)

- [x] Task complete

> 9 cases. The two AC-7 cases assert the **mocks**, not just the thrown error — `credentials.save`
> and `store.save` are both proven uncalled on a rejection. Asserting only that it throws would
> pass even if the row had been written first and the error raised afterwards, which is precisely
> the ordering bug this AC exists to prevent.
>
> `ServiceUnavailableException` for the unreachable case is the one transport-level HTTP exception
> in this change, permitted by POLICIES § Validation. It carries the i18n key, so
> `AllExceptionsFilter` passes it through rather than replacing it with a status default.
>
> `tsc` caught one thing tests could not: `PlannerSessionStatus` in a decorated DTO signature needs
> `import type` under `isolatedModules` + `emitDecoratorMetadata` (TS1272). Worth knowing for any
> future DTO that types a field with a union.

**Files**

- `src/modules/admin/planner/planner-token/model/planner-credentials.dtos.ts` (create)
- `src/modules/admin/planner/planner-token/api/planner-credentials.service.ts` (create)
- `src/modules/admin/planner/planner-token/config/planner-session.routes.ts` (modify)
- `src/modules/admin/planner/planner-token/api/docs/planner-session.swagger.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-session.controller.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-credentials.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases: a **rejected** login ⇒ `400 invalidCredentials` **and the repository's
   upsert is never called** (AC-7 — assert the mock, not just the thrown error); an
   **unreachable** u-planner ⇒ `503 unreachable`, again with nothing written; a **successful**
   save ⇒ credentials upserted **and** `store.save` called with the newly returned session
   (AC-10); `GET` returns `{ username, configured, updatedAt }` with **no password field**. → **red**.
2. Implement `PlannerCredentialsService` in the order given in design § AC-7/AC-10 — login
   first, persist second, store third. That order is the acceptance criterion.
3. Add routes, Swagger decorators (typed `@ApiResponse` on both — the spec is load-bearing),
   and the two controller methods with
   `@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action })`. **No scope header
   decorators** — these credentials are system-wide.
4. `SavePlannerCredentialsDto`: `@IsString()` + `@Length()` on both fields. The response DTO
   has **no** password field of any kind.
5. Re-run → **green**. Typecheck.

**Commit**: `feat(planner): configure Planner credentials through the API`

---

## Milestone 4 — Retire the old configuration, square the docs and the spec

### Task 4.1 — Remove the environment credentials ✅ DONE (2026-08-08)

- [x] Task complete

> `grep -rn "PLANNER_USER\|PLANNER_PASSWORD" src/ .env.example` and a tracked-file `git grep`
> both return nothing. `PLANNER_LOGIN_API_URL` added as optional.
>
> The boot check turned up something the design missed and Task U.1 now records: **`PlannerModule`
> is only registered when `RAW_DB_URL` is set** (`app.module.ts:229`). The local `.env` has it
> commented out, so the first boot started cleanly while never loading any of this change's code.
> Re-run with `RAW_DB_URL` set, the graph resolves and all four `planner/session` routes map.
> "It booted" was very nearly a false positive here.

**Files**

- `src/commons/configs/env.config.ts` (modify)
- `.env.example` (modify, if it names them)

**Steps**

1. Delete `PLANNER_USER` and `PLANNER_PASSWORD` from `envSchema`. Add optional
   `PLANNER_LOGIN_API_URL`.
2. `grep -rn "PLANNER_USER\|PLANNER_PASSWORD" src/ .env.example` → **expect no output**.
3. Boot the app with neither variable set and confirm it starts (`envSchema` is
   `.passthrough()`, so a server `.env` that still carries them will not fail — removing them
   there is a runbook step, not a boot guarantee).
4. Typecheck, `pnpm lint`, `pnpm test`.

**Commit**: `refactor(planner): drop the Planner credentials environment variables`

### Task 4.2 — Prove no secret reaches the API surface, and regenerate the spec ✅ DONE (2026-08-08)

- [x] Task complete

> Unblocked by the decision recorded in Task U.1 (option 1). Spec now **558 paths, 310 schemas**,
> up from 542/305, and it regenerates completely even with `RAW_DB_URL` unset in the environment.
>
> AC-8 verified by grep, not by reading: `passwordEncrypted` appears **nowhere** in
> `openapi.json`, and the only `password` property in this change's schemas is on the inbound
> `SavePlannerCredentialsDto`. `PlannerCredentialsResponseDto` has three properties —
> `username`, `configured`, `updatedAt` — and no password field of any kind.
>
> **The grep also caught a spec defect the tests could not.** `username`, `updatedAt` and
> `tokenExp` were all emitting `"type": "object"`, because Swagger reflects the emitted design
> type and a `string | null` union emits `Object`. The spec compiled, the tests passed, and it
> described three fields to the frontend as objects. Fixed by passing `type` explicitly on every
> nullable `@ApiProperty` (plus `format: 'date-time'` on the two timestamps). Worth remembering:
> **any nullable DTO field on this codebase needs an explicit `type`** or the committed contract
> quietly lies.

**Files**

- `openapi.json` (regenerate)

**Steps**

1. `pnpm openapi:export`.
2. `grep -n "passwordEncrypted" openapi.json` → **expect no output**.
3. Inspect every schema whose name contains `Credential`: `password` may appear **only** on the
   inbound save DTO, never on a response. AC-8 is a grep, not an impression.
4. Confirm the new endpoints and the widened `PlannerSessionStatus` are present, then commit
   the regenerated spec **in this PR** (POLICIES § The API spec is a committed artifact).

**Commit**: `chore(api): regenerate openapi.json for the Planner credentials endpoints`

### Task 4.3 — Docs ✅ DONE (2026-08-08)

- [x] Task complete

> All three `docs/CONTEXT.md` edits made: the uPlanner integration row now says the session comes
> from u-planner's HTTP API rather than a browser (and that Banner still needs one, because of
> 2FA); § Security Decisions points at ADR-001 with its `APP_SECRET` consequence stated inline;
> § Environment Variables says scraper credentials are not environment configuration and names
> the Planner variables that remain.
>
> `docs/adr/README.md` § Index already lists ADR-001. The ADR body was not touched.
>
> Full suite: **109 suites, 889 tests, all green.** `pnpm lint` clean after fixing three
> `'fail' is not defined` errors — `fail()` is a jasmine global that jest-circus does not provide
> and eslint rejects. Replaced with an explicit `captureError` helper and the
> `.catch((e) => e)` pattern, which also produce a real failure when the call _doesn't_ throw,
> rather than silently passing as the `try`/`catch` form would have.

**Files**

- `docs/CONTEXT.md` (modify)
- `docs/adr/README.md` (verify only — already updated)

**Steps**

1. § External Integrations — uPlanner is reached through its HTTP API using stored
   credentials, not by driving a browser.
2. § Security Decisions — point at
   `docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md`, so the ADR is
   reachable from where someone would be reading.
3. § Environment Variables — drop `PLANNER_USER` / `PLANNER_PASSWORD`; note that Planner
   credentials live in `core.scraper_credentials`.
4. Confirm `docs/adr/README.md` § Index lists ADR-001 and is staged. **Do not edit the ADR body.**
5. `pnpm test` and `pnpm lint` clean.

**Commit**: `docs(planner): record the API login and stored credentials`

---

<!--
Append-only sections below. These record what actually happened, not what was planned.

## Unplanned — <what and why>

### Task U.1 — <title>
  - [ ] Task complete   <- indented on purpose: the completeness gate is
                            `grep -c '^- \[ \]'`, so a template checkbox at column 0
                            inside this comment counts as a real open task forever.

## Post-QA fixes

## Audit fixes (/abet-audit-pr)
-->

## Audit fixes (/abet-audit-pr)

### Review round 1 — 2026-08-08

Six auditors over the working tree. **Verdict: NOT READY** — 1 blocker, 12 majors. The cooldown
defect was found independently by three auditors, which is signal.

**All blockers and majors fixed the same day (A.1–A.8). A.9 (minors) remains open.** Suite after
the round: **109 suites, 908 tests**, lint and typecheck clean, spec regenerated.

What the round actually taught, beyond the individual fixes:

> **Three of the majors were new wedges introduced by a change written to delete a wedge** — an
> unbounded `fetch` (undici defaults to 300s, inside the single-flight promise), a `force` flag a
> concurrent caller could silently void, and a Refresh button that made no outbound call when the
> token was unexpired but rejected. The deleted Playwright path had a 20s timeout; replacing it
> with `fetch` quietly removed the only bound. Worth remembering: _removing_ a failure mode is
> not the same as _not adding one back_.
>
> **The audit's most valuable finding was one no test could produce.** Auditor E caught the live
> institutional credentials sitting in four fixtures, `proposal.md` and `openapi.json` — including
> the real operator's full name in a login-response fixture, which nobody had noticed. It also
> reasoned partly wrongly (it claimed to have matched the password against `.env`, where only the
> username appears); the conclusion held for a different reason, which is why the synthesiser
> re-verified rather than taking the report at face value.
>
> **Auditor C's vacuous-test findings were all real.** The "no secrets in logs" test ran a
> _rejected_ login, so no session with real tokens ever existed and two of its three assertions
> could not fail. That is the fixture trap the backend rules warn about, and it survived being
> written by someone who had just read that warning.

### Task A.1 — Purge the real u-planner credentials from the change ✅ DONE (2026-08-08)

- [x] Task complete

**BLOCKER. Do this before anything else is committed — nothing is in git history yet, so it is
still cheap.**

The **live institutional username and password** were used as test fixtures in four spec files and
published as a worked base64 example in `proposal.md` (plaintext _and_ its encoded form) and in a
task retro here. The real operator's **full name** was also in a login-response fixture. The
username additionally reached `openapi.json` twice via `@ApiProperty` examples — and that artifact
is read remotely by the frontend repo, so it is actively distributed.

Committing this would put a third-party university credential permanently into git history on a
branch bound for production, in the same repository whose ADR-001 argues that encrypting these
credentials at rest was worth a widened exposure surface.

**Files**

- `src/modules/admin/planner/planner-token/api/planner-credentials.service.spec.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (modify)
- `src/modules/admin/planner/planner-token/core/planner-login.client.spec.ts` (modify)
- `src/modules/admin/scraping/credentials/api/scraper-credentials.service.spec.ts` (modify)
- `src/modules/admin/planner/planner-token/model/planner-credentials.dtos.ts` (modify)
- `openspec/changes/planner-api-login/proposal.md`, `tasks.md` (modify)
- `openapi.json` (regenerate)

**Steps**

1. Replace the password everywhere with a synthetic constant, and recompute the base64 fixture in
   `planner-login.client.spec.ts` to match the synthetic value (the AC-1 assertion depends on it).
2. Replace the username in both `@ApiProperty` examples with `planner-operator`, and in the specs.
3. In `proposal.md`, keep the point that base64 is obfuscation, using a synthetic pair.
4. `pnpm openapi:export`.
5. Gate: grep the tree for the real username, password and operator name — all must return
   nothing outside the gitignored `.env`. Re-run the suite.
6. **Recommend to the account owner: rotate the u-planner password**, since it has been handled
   outside a secret store during this work.

**Commit**: `test(planner): use synthetic credentials in fixtures and examples`

### Task A.2 — POST handlers return 201 while the spec says 200 ✅ DONE (2026-08-08)

- [x] Task complete

**Major, and a regression.** `HttpMethodWithSwagger`'s `status` option only sets the `ApiResponse`
documentation (`base.decorator.ts:70-77`) — it never applies `@HttpCode`. Both new POST routes
document `200` and will return **201** on the wire. Before this change `/refresh` passed no
`status`, so the spec said 201 and matched. 15 controllers in this repo get this right with an
explicit `@HttpCode(HttpStatus.OK)`; these two are the only `status: 200` in any `.swagger.ts`.

A frontend generated from this spec, or any client branching on `res.status === 200`, reads a
successful credential save as a failure.

**Files**

- `src/modules/admin/planner/planner-token/api/planner-session.controller.ts` (modify)
- `openapi.json` (regenerate)

**Steps**

1. Add `@HttpCode(HttpStatus.OK)` to `refresh()` and `saveCredentials()`.
2. `pnpm openapi:export`; confirm both POSTs document 200 and the handlers return 200.

**Commit**: `fix(planner): return 200 from the session POST endpoints as documented`

### Task A.3 — The cooldown reports a healthy session as expired, and never releases early ✅ DONE (2026-08-08)

- [x] Task complete

**Major. Found independently by auditors A, D and F.** Two defects in
`planner-token.service.ts:74-81`:

1. The cooldown branch returns a hardcoded `{ status: 'expired', tokenExp: null }` **without
   consulting the store**, so a live, working session is reported dead for up to 30s.
2. `lastFailMs` is set in `refresh()`'s catch and cleared **only** in `refresh()`'s success path.
   A successful login through any other route leaves it armed.

Concrete sequence, which is the primary operator recovery path: refresh fails → operator POSTs
correct credentials → `save()` verifies, stores the row, writes a valid session, returns `active`
→ operator presses Refresh → `expired`. The UI alternates between `active` and `expired` for 30s
immediately after a successful fix.

**Files**

- `src/modules/admin/planner/planner-token/api/planner-token.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-credentials.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases: after a cooldown is armed, a `refresh()` with a valid stored session reports
   that session's real status, not `expired`; and a successful login clears the cooldown.
2. Return `await this.getStatus()` from the cooldown branch — the short-circuit should suppress
   the _login attempt_, not the truth about the store.
3. Move `this.lastFailMs = null` into `login()` after `store.save(session)`.
4. Have `PlannerCredentialsService.save()` route its store write through the token service (see
   Task A.5) so the same reset applies.

**Commit**: `fix(planner): report the real session status during the refresh cooldown`

### Task A.4 — No timeout on the u-planner login, so a hung host wedges every caller ✅ DONE (2026-08-08)

- [x] Task complete

**Major, and a regression.** Neither `fetch` in `planner-login.client.ts:93,104` carries an
`AbortSignal`. Undici's default is 300s. Both run inside the single-flight promise, so a stalled
u-planner pins `this.refreshing` for ~5 minutes and **every** concurrent `getValidSession()` caller
joins that hung promise — during a scrape that is all 20 workers plus the operator's status page.

The deleted `loginHeadless` was bounded by Playwright's `waitForFunction({ timeout: 20_000 })`.
A change whose entire purpose is deleting a wedge must not reintroduce one.

**Files**

- `src/modules/admin/planner/planner-token/core/planner-login.client.ts` (modify)
- `src/modules/admin/planner/planner-token/core/planner-login.client.spec.ts` (test)

**Steps (TDD)**

1. Failing case: a `fetch` that never settles rejects with `PlannerLoginUnreachableError` rather
   than hanging (use fake timers).
2. Add `signal: AbortSignal.timeout(15_000)` to both calls; map `AbortError` to
   `PlannerLoginUnreachableError`, which already carries the correct "credentials may be fine"
   semantics.
3. While here, add `redirect: 'error'` (see Task A.7) — same `init` object.

**Commit**: `fix(planner): bound the u-planner login with a timeout`

### Task A.5 — `forceRefresh` is silently ignored, and `refresh()` can never force ✅ DONE (2026-08-08)

- [x] Task complete

**Major. Two related defects in the same mechanism** (auditors A and F).

1. `ensureSession` (`:95`) joins any in-flight promise without comparing intent, so
   `getValidSession(true)` can receive the result of a non-forced call — including the cached
   session it is trying to replace. The only caller is the scraper's one-shot 401 retry
   (`planner-http.client.ts:51`); when it collides with another in-flight call it re-sends the
   same dead token, 401s again, and aborts the whole scrape run.
2. `refresh()` calls `ensureSession(false)` (`:80`), so when the access token is unexpired but
   **rejected server-side** the operator's Refresh button makes no outbound call and reports
   `active`. That is the same "looks healthy, is not, button does nothing" class of failure this
   change exists to eliminate.

**Files**

- `src/modules/admin/planner/planner-token/api/planner-token.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-credentials.service.ts` (modify)
- `src/modules/admin/planner/planner-token/api/planner-token.service.spec.ts` (test)

**Steps (TDD)**

1. Failing cases: a forced call issued while a non-forced login is in flight performs its own
   login; `refresh()` with a valid-but-stale token attempts a login.
2. Track the in-flight call's intent — a forced caller joins only a forced flight.
3. Change `refresh()` to `ensureSession(true)`; the cooldown already guards against hammering and
   a redundant login is cheap now that Chromium is gone.
4. Add `PlannerTokenService.adoptSession(session)` owning `store.save` + `lastFailMs = null`, and
   call it from `PlannerCredentialsService.save()` — removes the duplicated write path and the
   race where an in-flight old-credential login clobbers the newly saved session.

**Commit**: `fix(planner): honour forced refresh and let the operator force a re-login`

### Task A.6 — Close the three vacuous tests and the untested recovery paths ✅ DONE (2026-08-08)

- [x] Task complete

**Major (auditor C).** Three tests cannot fail, and two important paths have no coverage:

- `planner-token.service.spec.ts:221` — the AC-3 "never writes a password or a token into a log
  line" case runs a **rejected** login, so no session is ever created and the `'access-token'` /
  `'refresh-token'` assertions are unfalsifiable. It also spies only `warn`/`debug`, so a leak via
  `log`/`error`/`verbose` is invisible.
- `scraper-credentials.service.spec.ts:130` — the fixture has no `passwordEncrypted` key, so the
  AC-8 assertion passes even if `getSummary` spread the whole row.
- `planner-credentials.service.spec.ts:125` — asserts its own mock's return value; no
  implementation can fail it.
- Untested: the cooldown ever **releasing**, `refresh()`'s success path, `getValidSession()`
  failing (the scraper's path), and `getDecrypted` → `null`.

**Steps (TDD)**

1. Rewrite the log test to spy all five `Logger` methods and assert over a **successful** login
   holding real tokens, comparing against the session fixture rather than string literals.
2. Make the AC-8 fixture hostile (include `passwordEncrypted: 'aa:bb:cc'`) so a spread fails it.
3. Add cooldown-expiry (fake timers), `refresh()`-success, and `getValidSession` failure cases.
4. Confirm each new case is red before its fix.

**Commit**: `test(planner): close the vacuous secret and status assertions`

### Task A.7 — Security hardening on the credential path ✅ DONE (2026-08-08)

- [x] Task complete

**Major (auditor E), three items:**

1. **Unthrottled credential oracle.** `POST /credentials` performs a live u-planner login with
   caller-supplied values and cleanly distinguishes accepted / rejected / unreachable, with no
   cooldown. Anyone holding `SCRAPPING`/`POST` can password-spray the university's u-planner from
   our server's IP, and can trip lockout on unrelated institutional accounts. Apply the same
   cooldown pattern `PlannerTokenService` already uses, keyed on failure.
2. **`redirect: 'error'`** on both login `fetch` calls. Default is `follow`; on a 307/308 the body
   (containing `base64(password)`) and the custom `x-access-token` header are **not** stripped
   cross-origin, so a hijacked or misconfigured redirect forwards the credential off-host.
3. **https-only** on `PLANNER_LOGIN_API_URL` / `PLANNER_VALIDATE_URL` in `env.config.ts` — Zod's
   `.url()` accepts `http://`, and these two variables are now the only thing deciding where the
   institutional password is sent.

**Commit**: `fix(planner): harden the credential verification path`

### Task A.8 — Contract and documentation corrections ✅ DONE (2026-08-08)

- [x] Task complete

**Major x2 plus minors.**

1. **503 is missing from the spec** (major). `saveCredentials` throws `ServiceUnavailableException`
   for `error.planner.unreachable`, but `HttpMethodWithSwagger` only emits the success status, 400
   and 500. The 400-vs-503 split is the _entire_ mitigation for the "don't tell an operator a
   correct password is wrong" risk — a frontend coding against the spec sees only 400 and
   reintroduces exactly that misdiagnosis. Add an explicit `@ApiResponse({ status: 503 })` and
   regenerate.
2. **The runbook names an i18n key the code never emits** (major). `runbook.md:94` and
   `design.md:198/298/357` say `error.planner.credentialDecryptionFailed`; the code throws
   `error.scraperCredential.decryptionFailed`. That is the single row covering the `APP_SECRET`
   failure mode — ADR-001's "most likely way this hurts someone later". Correct the docs, not the
   key (the throw site is genuinely provider-agnostic).
3. `proposal.md` traceability table is still all `TBD`; fill it in and mark AC-11 and AC-12 as
   deviated-with-reason.
4. `proposal.md` risk row claims the `not_configured` widening is safe because "existing sessions
   keep returning the existing three" — **inverted**: after deploy, production has no credential
   row, so `not_configured` is the _only_ state the deployed frontend sees, and `/refresh` changes
   from `200 {expired}` to a `400`. Add a dated correction and a runbook note on frontend sequencing.
5. `proposal.md` § Dependencies still requires a `contract.md`; `design.md` chose sequential mode.
   Add a dated supersede note.
6. `docs/CONTEXT.md:137` § Module Layout lists only `auth` and `mail` as no-controller exceptions —
   add `admin/scraping/credentials`. `docs/CONTEXT.md:186` § Database `core` row should mention
   `scraper_credentials`.
7. Flip ADR-001 to `Accepted` on merge (status line only — the body is immutable).

**Commit**: `docs(planner): correct the contract and runbook for the credential endpoints`

### Review round 2 — 2026-08-09

Six auditors again, over the post-round-1 tree. **Verdict: NOT READY — 1 blocker, 9 majors.**

The headline is uncomfortable and worth stating plainly: **four of the ten came from round 1's own
fixes.** Round 1 was executed quickly under audit pressure, and it traded one class of defect for
another. Auditor C ran 28 source mutations and killed 25 — the three survivors are findings B.3,
B.4 and the timeout-test minor, none of which inspection alone would have caught.

**Blocker and all nine majors fixed 2026-08-09 (B.1–B.10). B.11 minors and A.9 remain open.**
Suite: **109 suites, 919 tests**; lint, typecheck and Prettier clean; spec regenerated.

Round 2's fixes were mutation-tested before being called done, rather than trusted:

> - **B.1** — reverting the catch branch to `getStatus()` fails
>   _"reports expired when the forced login is refused, even with a healthy session on disk"_.
> - **B.3** — leaking the password into `login()`'s `warn` (the mutant that **survived** round 2)
>   now fails four cases via the shared `afterEach`.
> - **B.5** — arming the throttle on failure instead of on entry fails
>   _"refuses concurrent attempts, not just sequential ones"_.
>
> One round-1 test had to be **deleted rather than adapted**: _"reports the real stored session
> while the cooldown is armed"_ asserted `active` after a failed login. It encoded the bug, and it
> is why the blocker survived a full audit round — the test was written to match the code instead
> of the requirement.

### Task B.1 — `refresh()` reports `active` after a failed login ✅ DONE (2026-08-09)

- [x] Task complete

**BLOCKER. A round-1 regression, found independently by auditors A, D and F.**

`planner-token.service.ts:90` — round-1 Task A.3 replaced the hardcoded `expired` with
`return await this.getStatus()` on **both** the cooldown branch and the **catch** branch. On the
catch branch a forced login was attempted and _rejected_; `login()` throws before `adoptSession`,
so the store is untouched, and `getStatus()` reads the old file and answers **`active`**.

The operator presses Refresh precisely because the token is being rejected server-side — the
scenario the code's own comment at `:83-85` cites as the reason for forcing — the login fails, and
the UI goes green. For the next 30s the cooldown branch repeats it. The response DTO carries no
error channel, so a rejected login and a successful one are byte-identical `200`s.

This is worse than the behaviour round 1 set out to improve, and it is the same shape as the
original production bug: looks healthy, is not, button does nothing.

Not caught because `planner-token.service.spec.ts:239` sets `mockStore.read → null` first — a
fixture trap.

**Fix**: keep `getStatus()` on the cooldown branch (no attempt was made, so the stored session is
still the best answer); on the catch branch report the _attempt's_ outcome —
`{ status: 'expired', tokenExp: this.store.read()?.accessTokenExpiresAt ?? null }` — or add a
field the UI can read. Then rewrite the `refresh()` doc comment at `:69-70`, which round 1 made
false in both clauses ("no-op if valid" — it now always forces; "returns expired" — it does not).
Add the missing test: failed refresh **with a valid session on disk**.

**Commit**: `fix(planner): report a failed refresh as expired rather than active`

### Task B.2 — A body-read timeout is reported as rejected credentials ✅ DONE (2026-08-09)

- [x] Task complete

**Major. A round-1 regression, found by A, E and F.**

`planner-login.client.ts:116` — `JSON.parse(await response.text())` puts the body read inside the
JSON-parse `try`. Round 1's `AbortSignal.timeout(15s)` covers the body stream, so if u-planner
returns headers and then stalls, `response.text()` rejects and is rethrown as
`PlannerLoginRejectedError`.

Consequences: the operator is told `error.planner.invalidCredentials` for a correct password, and
`PlannerCredentialsService` arms the 30s throttle. That is exactly what the rejected/unreachable
split, `session-expired.error.ts:19-22` and ADR-001 negative 4 exist to prevent — reintroduced by
the timeout fix itself. Same line: `408`/`429` pass the `>= 500` guard and also land on
"rejected".

**Fix**: read the body in its own `try` and map its failure to `PlannerLoginUnreachableError`;
treat `408`/`429` as unreachable. Add the post-headers test — the existing one mocks `fetch`
itself rejecting, which is the pre-headers case only.

**Commit**: `fix(planner): classify a truncated login response as unreachable`

### Task B.3 — The secrets-in-logs test is still vacuous; the blind spot moved ✅ DONE (2026-08-09)

- [x] Task complete

**Major. Proven by mutation, not inspection.**

`planner-token.service.spec.ts:284` — round 1 rewrote this to run a _successful_ login so real
tokens would be in scope. But `PlannerTokenService` has exactly two log statements — the `warn` in
`login()`'s catch and the `debug` in the cooldown branch — and **neither fires on a fully
successful path**. `logged` is `[]`, and all four assertions run against the empty string.

Auditor C proved it: mutants that leak the password into the `warn` (`M20`) and the access token
into the `debug` (`M21`) both **survived the whole 58-test suite**.

Round 1's version was blind because no session existed; round 2's is blind because nothing logs.
This is the change's one stated security rule and AC-3's final sentence.

**Fix**: assert absence over the **failure** paths where the log statements actually live — arm
and trip the cooldown with a session present. Better: hoist the absence check into an `afterEach`
for that describe block so every failure case proves it.

**Commit**: `test(planner): assert secret absence on the paths that actually log`

### Task B.4 — The `status:false` test passes for the wrong reason ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** `planner-login.client.spec.ts:107` uses `{ data: null, status: false }` — `data: null`
alone trips the payload guard, so the assertion cannot tell the two causes apart. Auditor C deleted
the **entire** `if (body.status === false)` branch and the suite stayed green.

This is the only guard over the one genuine unknown in the change: the rejection shape was never
observed live. If u-planner signals a bad password as `200 { data: "<valid token>", status: false }`,
an unguarded client proceeds to step 2 with a junk token. AC-2 names `status:false` and a missing
payload as **two** shapes; this fixture collapses them into one.

**Fix**: change the fixture to `{ data: PRE_AUTH_TOKEN, status: false }` so only the `status`
branch can reject it, assert on the message, and keep the `data: null` case separately. Add the
step-2 equivalent — there is currently none.

**Commit**: `test(planner): discriminate the status:false rejection shape`

### Task B.5 — The verification throttle does not bound the credential oracle ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** `planner-credentials.service.ts:60` reads `lastRejectedMs` _before_ the ~15s login and
writes it only in the `catch`. Nothing marks an attempt in flight, so N concurrent requests all
pass the guard in the same tick. The comment at `:18-20` claims the endpoint is "useless for
spraying accounts from this server's address"; it bounds serial retries only, which is the case an
attacker never uses.

Round 1 raised this as an unthrottled oracle and the fix does not close it. Verified _not_
bypassable by alternating unreachable/rejected — that part is correct.

**Fix**: claim the slot synchronously before awaiting (set the timestamp up front, clear on success
and on unreachable). Record the residual per-process/per-replica limit in `proposal.md` § Risks
rather than asserting it away in a comment.

**Commit**: `fix(planner): close the concurrency window in the verification throttle`

### Task B.6 — The new throttle breaks the runbook, and its i18n key is undocumented ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** `error.planner.verificationCooldown` appears in **no** document — not `design.md`'s
i18n table, not its AC-7 sequence, not the runbook's symptom table.

Worse, it breaks the deploy procedure as written: runbook step 3 POSTs a **deliberately wrong**
password (arming the throttle), step 4 POSTs the **correct** pair immediately after and now gets
`400 error.planner.verificationCooldown`. The cooldown warning above the table names only
`REFRESH_COOLDOWN_MS` and says to wait before each _negative_ step — the throttle blocks the
_positive_ one. An operator who just typed a wrong password, then gets a 400 on the real one, with
a key documented nowhere, concludes the correct credentials are rejected.

**Fix**: document the key; reorder or add an explicit wait between runbook steps 3 and 4, naming
this as a **second, separate** cooldown.

**Commit**: `docs(planner): document the verification cooldown and fix the runbook order`

### Task B.7 — `PLANNER_LOGIN_URL` docs state the opposite of the code ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** Round 1 **deleted** `PLANNER_LOGIN_URL` from `env.config.ts`. Three documents say it was
kept: traceability row 11 ("retained while nothing reads it"), `design.md` § AC-11 ("left in place
rather than removed"), and proposal AC-11 ("keeps working as configuration"). Task A.9 still lists
deleting it as outstanding work that is already done.

Row 11 is the one row the table flags as a _recorded deviation_ — the place a reviewer looks
precisely because it claims honesty — and it describes a state that does not exist. The real
deviation is the opposite: an env var AC-11 promised would keep working was removed.

**Fix**: correct all three documents and strike the A.9 bullet. Functionally benign
(`.passthrough()`, nothing reads it) — this is purely a truthfulness defect.

**Commit**: `docs(planner): correct the PLANNER_LOGIN_URL deviation record`

### Task B.8 — The chained flight doubles the stall and propagates failure to non-forced callers ✅ DONE (2026-08-09)

- [x] Task complete

**Major. A round-1 regression.** Once a forced caller chains flight B onto in-flight A,
`refreshingIsForced` is `true`, so every later caller — **including non-forced ones** — is handed B.

Two consequences (`planner-token.service.ts:104-130`):

- **Latency**: one flight is two sequential 15s-bounded fetches ⇒ 30s; A+B ⇒ **60s**. The 15s
  constant's own comment justifies it as the bound that stops a stall being "indistinguishable from
  the permanent wedge". `PlannerHttpClient.get()` calls non-forced `getValidSession()` on every
  request, so under a scrape this is a herd stall.
- **Failure inheritance**: if A succeeds and writes a valid session but B's login then fails, every
  non-forced caller attached to B gets `PlannerSessionExpiredError` **despite a valid token in the
  store**, and `planner-scraper.service.ts` aborts the run. Before round 1 they would have received
  A's result.

The state machine itself is correct — auditor F verified no desync, no lost cleanup, bounded chain
depth, no unhandled rejections. The defect is behavioural.

**Fix**: after awaiting `previous` in `afterCurrentFlight`, re-read the store; if the access token
changed and is outside the skew, return it instead of logging in again. At minimum, let non-forced
joiners fall back to the cached session rather than inheriting B's error.

**Commit**: `fix(planner): stop a chained forced login stalling and failing cached-session callers`

### Task B.9 — `adoptSession` race can resurrect a session from the old credentials ✅ DONE (2026-08-09)

- [x] Task complete

**Major. Found by B, E and F.** `PlannerCredentialsService.save()` does not participate in the
token service's single flight. Interleaving: a scraper login starts under the **old** credentials
→ the operator saves new ones and `adoptSession` writes the new session → the old flight settles
and calls `adoptSession` again, **overwriting it**.

The docstring at `planner-credentials.service.ts:37-42` and AC-10 both assert as an absolute that
no session obtained under the old credentials survives. Under concurrency one can, for up to the
token's ~12h life, with the DB holding account B while the store serves account A.

**Fix**: stamp a generation counter that `credentials.save()` bumps; have `login()` capture it
before `getDecrypted()` and skip `adoptSession` on mismatch. Or weaken AC-10 and the docstring to
"sequential operations" and say so.

**Commit**: `fix(planner): discard an in-flight login superseded by a credential change`

### Task B.10 — The unused refresh token can still veto a valid login ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** The class doc says "there is deliberately **no refresh-token path**", and nothing in
`src/` reads `refreshToken` or `refreshTokenExpiresAt`. But `exchangeForSession`
(`planner-login.client.ts:73-86`) still makes both **required**: a missing/renamed `refreshToken`,
or one without a usable `exp`, rejects the whole login as `error.planner.invalidCredentials`.

A field the system deliberately stopped using can veto a correct credential pair — the
"fails closed on data it does not need" shape this change exists to remove.

**Fix**: make them optional passthrough (drop from the guard and from `expFromJwt`), or remove them
from `PlannerTokenSession` entirely. If kept as a forward hook, say so in one line — the type and
the class doc currently contradict each other.

**Commit**: `fix(planner): stop the unused refresh token failing a valid login`

### Review round 3 — 2026-08-09

**Verdict: NOT READY — 0 blockers, 11 majors.** But the _shape_ has changed and that matters more
than the count:

| Round | Blocker                                   | Character of the majors                              |
| ----- | ----------------------------------------- | ---------------------------------------------------- |
| 1     | Live credentials committed                | Real defects across every domain                     |
| 2     | `refresh()` reported `active` when broken | 4 of 9 were round-1 regressions                      |
| 3     | **none**                                  | 2 behavioural, 5 test-coverage gaps, 4 documentation |

Rounds 1 and 2 both had a defect that made a broken system **look healthy**. Round 3 has none. The
two behavioural findings both fail the _safe_ way — reporting a worse state than reality — and five
of the eleven are missing tests rather than wrong code. Auditor C ran a fresh mutation campaign:
25 killed, 10 survived, and **it independently re-verified all three of round 2's claimed fixes**.

**All five majors fixed 2026-08-09 (C.1–C.5). C.6, B.11 and A.9 minors remain open.**
Suite: **110 suites, 931 passed / 1 skipped**; lint, typecheck and Prettier clean; spec regenerated
with 503 now on **both** u-planner-reaching endpoints.

Every fix was mutation-verified before being called done — five mutants, all killed:

> deleting `!response.ok` · deleting `expFromJwt`'s finite-`exp` guard · `isConfigured` always
> `true` · the skew term replaced with `true` · the unreachable classification forced to `false`.
>
> **The tests caught a defect in my own fix while I was writing it.** `penalise()` took
> `Math.max` against the claim it had just made, so a rejection inherited the full 60s claim
> instead of the 30s penalty — two existing throttle tests went red immediately. The fix now
> replaces its own claim and only maxes against someone else's.
>
> One test is `it.skip` on Windows: the `0600` permission assertion in the new
> `planner-session.store.spec.ts` is POSIX-only. It will run in CI on Linux; it is inert here.

### Task C.1 — `refresh()` reports an unreachable u-planner as `expired` ✅ DONE (2026-08-09)

- [x] Task complete

**Major. Found by four auditors (A, B, D, F).** `PlannerLoginUnreachableError extends
PlannerSessionExpiredError`, and `refresh()` catches the base class (`planner-token.service.ts:92`).
So a timeout, a 5xx, a 408/429 or the truncated-body case round 2 just added all arm `lastFailMs`
and return `refreshFailed()` → `expired`.

The docblock justifies this with "a login that was **refused** disproves the stored session" — true
for a rejection, false for a transport failure, which disproves nothing. Concretely: a 200ms
u-planner blip makes `GET /status` answer `active` (correctly — the token is good for hours and the
scraper keeps working) while `POST /refresh` answers `expired`, and the cooldown repeats that for
30s. Two endpoints on one screen disagreeing about one session, with the operator's escalation path
being to re-enter credentials that were never wrong.

`POST /credentials` honours the distinction (503); `POST /refresh` discards it — after
`postJson` spent round 2 carefully classifying it.

**Fix**: catch `PlannerLoginUnreachableError` first and throw
`ServiceUnavailableException(error.planner.unreachable)` as `verify()` does; add
`@ApiResponse({status: 503})` to the refresh route and regenerate. Keep `refreshFailed()` for
`PlannerLoginRejectedError` only. If the cooldown should still arm on unreachable, record the
failure _kind_ so the cooldown branch replays the same answer rather than `expired`.

**Commit**: `fix(planner): distinguish an unreachable u-planner from a refused login on refresh`

### Task C.2 — The throttle claim can outlive its own call and is released without ownership ✅ DONE (2026-08-09)

- [x] Task complete

**Major (A; corroborated by E, F, D).** `VERIFY_COOLDOWN_MS` is 30s; the call it guards is two
sequential fetches each bounded at `REQUEST_TIMEOUT_MS` = 15s — **exactly** 30s worst case, before
DNS, TLS and event-loop overhead. So the claim expires while its own login is still running, and
all three release sites write `blockedUntilMs = null` unconditionally.

The damaging interleaving: A claims, is slow, and is **rejected** at t+30.2 → re-arms to t+60.2. B
entered at t+30.0 and succeeds at t+45 → writes `null`, **erasing the penalty a wrong-password
attempt just armed**.

**Fix**: own the claim — `const claim = Date.now() + VERIFY_COOLDOWN_MS; this.blockedUntilMs = claim;`
and guard every release with `if (this.blockedUntilMs === claim)`. Derive the cooldown from the
client's worst case rather than hardcoding a coincidentally-equal literal (see C.9).

**Commit**: `fix(planner): make the verification throttle claim owned and outlast its login`

### Task C.3 — Five surviving mutants: real coverage gaps ✅ DONE (2026-08-09)

- [x] Task complete

**Major.** Each was proven by a mutation that survived the whole suite:

1. **`!response.ok` can be deleted and nothing fails.** The 401 fixture is
   `jsonResponse(401, {message})` — no payload — so it trips the _payload_ guard, not the status
   guard. Exactly round 2's B.4 defect, fixed for `status:false` and left here. A `403` carrying a
   well-formed body would be accepted and the client would proceed to step 2.
   **Fix**: give the 401 fixture a valid payload; assert `/rejected the login \(401\)/`.
2. **`expFromJwt`'s `Number.isFinite(exp)` guard can be deleted.** The "no usable expiry" test uses
   `'not-a-jwt'`, which fails in `decodeJwt` instead. For the _access_ token that guard is what
   stops `new Date(NaN).toISOString()` throwing a raw `RangeError` — not a
   `PlannerSessionExpiredError`, so it escapes `login()`'s `warn` unlogged and surfaces as a 500.
   **Fix**: a decodable JWT with no `exp`, as access token and as refresh token.
3. **`ScraperCredentialService.isConfigured` has no test at all** — making it always return `true`
   survives all 121 admin tests. It is the sole predicate behind AC-9; every test that looks like
   coverage asserts a _mocked_ service.
4. **`PlannerSessionStore` has no spec** — the only new file in the change with none. Untested:
   `null` on missing file, `null` on corrupt JSON (the fail-safe against a wedged session), and the
   `0600` + `chmodSync` on a file of long-lived JWTs.
5. **The skew condition in `afterCurrentFlight` can be replaced with `true`.** The
   predecessor-replaced test uses a 12-hour session, so the term is satisfied either way. Nothing
   proves a forced caller re-logs in when the predecessor left a nearly-dead token — which is the
   original production failure shape.

**Commit**: `test(planner): close the five gaps mutation testing found`

### Task C.4 — Documentation contradicts round-2 code in four places ✅ DONE (2026-08-09)

- [x] Task complete

**Major (B, C).**

1. **The verification cooldown's semantics changed and no document says so.** `design.md:307`,
   `runbook.md:54` and `runbook.md:114` all say it is armed by a **rejected** verification. Round 2
   made it claim the slot **on entry**, for the duration of any attempt. So a double-click or a
   frontend retry returns `verificationCooldown` for a _correct_ pair that is about to succeed —
   and every document tells the operator that key means "something was rejected".
2. **`design.md` § AC-2 still requires `data.refreshToken` for success**, and § AC-1 and proposal
   AC-1 still say both expirations come from `expFromJwt`. That is the exact guard round 2 removed;
   a reviewer working from the spec would reinstate it. § AC-2's error table also predates the
   408/429/body-read reclassification.
3. **Traceability row 3 credits the vacuous design.** It still says "the secrets case runs a
   _successful_ login" — the blind spot round 2 proved and removed. Third correction needed to this
   table; this row was missed twice.
4. **The runbook has two different "step 3"s** — deploy step 3 saves correct credentials, validation
   step 3 submits a wrong password — and validation rows 1–2 require `not_configured`, a state
   deploy step 3 has already destroyed. Following the runbook literally, AC-9's only manual proof
   fails.

**Commit**: `docs(planner): resync the design, proposal and runbook with round-2 behaviour`

### Task C.5 — Comments falsified by round 2 ✅ DONE (2026-08-09)

- [x] Task complete

**Major (D).** Three comments now assert things the code contradicts — the same failure mode as
round 2's B.7, in code rather than docs:

- `planner-session.types.ts:1-4` — "an expired access token **is refreshed via the validate API**".
  `refreshViaApi` is deleted; the class docblock ten lines below says "nothing renews with it,
  deliberately", and `PlannerTokenService` says "there is deliberately **no refresh-token path**".
  Three comments in one module, two of them contradicting each other about the mechanism this
  change exists to remove. The runbook explicitly warns the next reader not to reintroduce it.
- `planner-login.client.ts:19-26` — "anything unrecognised is a rejection" was falsified by B.10
  fifty lines below, which argues the opposite for the refresh token.
- `planner-token.service.ts:73-76` — justifies both failure branches with "refused", which covers
  only one of the two error classes it catches (see C.1).

**Commit**: `docs(planner): correct comments falsified by the round-2 changes`

## Unplanned — `EncryptService` could never have worked (2026-08-09)

### Task U.2 — Derive the AES key instead of hex-decoding APP_SECRET ✅ DONE (2026-08-09)

- [x] Task complete

**Found while clearing the minors, and it would have broken this change in production.**

Tightening `APP_SECRET` to exactly 64 hex characters (a B.11 minor) made `pnpm openapi:export`
fail at boot. The local `.env` holds **128 hex characters — 64 bytes** — and
`Buffer.from(secret, 'hex')` fed that straight to `aes-256-gcm`, which accepts only 32. Verified
directly: `createCipheriv` throws `Invalid key length` on the real value.

So `EncryptService` **could not encrypt or decrypt at all** in this environment, and almost
certainly not in production either — same generator, and `.min(64)` never constrained it. It went
unnoticed for exactly the reason ADR-001 records: nothing consumed the service until this change
did. Every `POST /planner/session/credentials` would have returned a 500 on the encrypt.

Fixed by deriving the key — `sha256(APP_SECRET)` is always exactly 32 bytes, so any sufficiently
long secret works. `env.config.ts` reverted to `.min(64)`: constraining the secret would have made
this a deploy-blocking change requiring an ops action, and derivation needs none.

**Safe without a migration**, and this is the part worth checking rather than assuming:
`APP_SECRET` has exactly one consumer (`EncryptService`), which had exactly none before this
change. No ciphertext produced by the old behaviour can exist, because the old behaviour could not
produce any.

Verified with the real local secret end to end: encrypt → decrypt returns the plaintext. The
existing `encrypt.service.spec.ts` (57 tests) stays green.

**Commit**: `fix(libs): derive the encryption key so any valid APP_SECRET works`

---

### Task C.6 — Round-3 minors ✅ DONE (2026-08-09)

- [x] Task complete

- **`Number.isFinite(Number(data.user?.id))` accepts `null`/`''`/`[]` as `0`** — a `200` with
  `user: {id: null}` yields an accepted session with `userId: 0`, written to the store and reported
  `active`, while every Planner request carries `user=0` and returns nothing. Since B.10 made the
  refresh token optional, `token` + `user.id` are the only load-bearing fields and one has a
  coercion hole. Use `typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0`.
- **`JSON.parse("null")` throws a raw `TypeError`** at `body.status` — a 500 that also releases the
  throttle. Guard the parsed body is a non-array object.
- **`sessionGeneration` is captured before `getDecrypted`**, so a login that read the _new_
  credentials can be discarded while logging "superseded by a credential change" — which is false.
  Move the capture after the credential read.
- **`adoptSession` bumps the generation before the write**, so a failed `store.save` advertises a
  supersession that never happened.
- **`login()` returns the superseded session to its caller**, so a scrape can run its whole pull
  under the account the rotation was meant to retire. Bounded to one in-flight consumer; the
  comment reasons only about storage, never about use. Decide and document.
- **404/405/410 read as "invalid credentials"** — the exact failure of a drifted
  `PLANNER_LOGIN_API_URL`, sending the operator to retype a correct password 30s at a time.
- **Five bare `catch {}` in the login client discard the cause** — the one string an operator has to
  debug an outage from cannot distinguish DNS from TLS from the 15s abort from a refused redirect.
- **`getValidToken()` is dead** — no caller outside its own spec; the comment above it explains why
  Planner cannot use a bare token.
- **The 15s/30s/30s relationship is real and unexpressed** — a login's worst case _equals_ both
  cooldowns. `runbook.md:49` calls them "independent"; `planner-token.service.ts:146` hardcodes
  "15s" in prose. Derive the cooldowns from the client's worst case.
- **`mockStore.save.mockImplementation` still leaks** past `clearAllMocks` at
  `planner-token.service.spec.ts:438` — the same class round 2 fixed in the sibling spec.
- Uncovered: the rejection re-arm, the unexpected-error release, the single-flight reset guard,
  `describe()`. One case in the shared `afterEach` block still asserts against an empty array.
- `@ApiResponse({status: 503})` sits inline in the controller rather than in the `.swagger.ts`
  factory, against POLICIES § Swagger.
- `mkdirSync` uses the default mode while the file inside is forced `0600`.
- The module directory (`credentials`), file stems (`scraper-credentials.*`) and class names
  (singular, except the module) disagree three ways.
- `refreshing` + `refreshingIsForced` are one fact in two fields; collapse to
  `{ promise, forced } | null`.
- Comments narrating change history rather than code (five instances), including a pointer to
  `the change's proposal` that breaks by design when the folder is archived.

**Corrected 2026-08-09 (round 4).** This task was ticked `DONE` over three items that were never
applied, which is worse than leaving it open — a later round is told not to re-report against this
ledger, so a false tick makes the item invisible. Closed in round 4: the module naming
(`ScraperCredentialsModule` → `ScraperCredentialModule`; the plural file stems beside singular class
names are the established convention — `courses.validation.ts` holds `CourseValidation` — so only
the module class was out of step), the `catch {}` causes (`cause()` now walks the chain, which was
the point of the item and resolved one of its four named cases before), and the shared `afterEach`
that asserted against an empty array.

**Commit**: this work landed inside `3fe1f080` and `20cdf25f`, not under the message named here;
round 4's follow-ups are their own commit.

### Task B.11 — Round-2 minors ✅ DONE (2026-08-09)

- [x] Task complete

Consolidated; none blocking on its own.

- **Prettier fails on four new files** (`planner-login.client.ts` and three specs) — the husky
  hooks will trip. `npx prettier --write`.
- **The throttle returns 400, not 429**, with no `Retry-After` and no `@ApiResponse`; the frontend
  cannot tell "wait 30s" from "wrong password" except by string-matching.
- **Decrypt failure**: `BadRequestError` (a 500-class problem returned as 400), the cause is
  discarded by a bare `catch`, and because it is not a `PlannerSessionExpiredError` it **escapes
  `login()`'s logger unlogged** — a hole in AC-3 exactly where `APP_SECRET` drift lands — and marks
  a scrape run `failed` rather than `expired`.
- **`design.md` staleness**: line 47 still says ADR-001 is `Proposed`; § AC-7's sequence still shows
  `store.save` and no throttle; the "Docs to update in this PR" checklist is entirely unticked
  though all five items are done; line 362 still names `credentialDecryptionFailed`.
- **`RAW_DB_URL` gates whole modules** and is documented only inside the change folder, which will
  be archived. One line in `docs/CONTEXT.md`.
- **The timeout test asserts a signal exists, not that it fires** — a mutant swapping
  `AbortSignal.timeout()` for a never-firing controller signal survived.
- **`mockStore.save.mockImplementation` leaks** past `clearAllMocks` in
  `planner-token.service.spec.ts:368` — the same class round 1 fixed in the sibling spec.
- **`APP_SECRET` accepts >64 hex chars** and then throws `Invalid key length` at first use; tighten
  to `.length(64)`.
- **`PLANNER_API_BASE` is still bare `.url()`** while carrying the session bearer token.
- **`password` lacks `format: 'password'` / `writeOnly: true`** in the spec, so Swagger UI renders
  it in cleartext.
- **The runbook's `curl`** puts the live password in shell history and the process table.
- Migration carries an idempotency shim a brand-new table cannot need; `ScraperCredentialsModule`
  is plural where every other module class is singular; `export-openapi.env.ts` would be safer as
  a `-r` preload than an order-dependent import; `refresh()` does 3 SELECTs on one row.
- **Multi-replica asymmetry** is now real and unrecorded: credentials are shared (Postgres) while
  the session file, single-flight and both cooldowns are per-process. Record single-replica as an
  accepted constraint in `design.md`, or move the session into the database.

**Corrected 2026-08-09 (round 4).** Two items in the paragraph above were ticked without being
applied and are now done: `ScraperCredentialsModule` was renamed to `ScraperCredentialModule`, and
`refresh()` no longer issues three SELECTs — it resolves the credential check once and shares the
status shaping with `getStatus()`. The multi-replica constraint was recorded in `design.md`, which
is the location this item explicitly rejected, so round 4 also put it in `docs/CONTEXT.md`: the
change folder is archived after merge, and an operator scaling the service will not read it there.

**Commit**: this work landed inside `3fe1f080` and `20cdf25f`, not under the message named here.

### Task A.9 — Minor cleanups ✅ DONE (2026-08-09)

- [x] Task complete

Consolidated minors worth doing before the PR:

- `updatedAt` is **structurally always null** — `BaseEntity.updatedAt` is a plain `@DateColumn`
  with no `@UpdateDateColumn` and no trigger, and `upsertForProvider` never sets it. The DTO
  publishes it as `date-time`, the runbook expects it, and ADR-001 sells the rotation trail as a
  benefit. Set it explicitly on both branches.
- `upsertForProvider` — drop the dead re-read and the `!` non-null assertion; return `Promise<void>`.
  Consider `repository.upsert(..., { conflictPaths: ['providerCode'] })` so concurrent first-time
  saves return a graceful result rather than a raw 23505 → 500.
- Delete the unused `error.planner.saveCredentialsFailed` key and its `design.md` row.
- ~~Delete `PLANNER_LOGIN_URL`~~ — already done in round 1; the docs claiming otherwise were corrected in round 2 (Task B.7).
- `PlannerSessionStore.read()` swallows a corrupt-JSON failure silently; add one `warn`. AC-3 named
  three silent paths and this is a fourth, introduced by the extraction.
- `PlannerSessionStore.save()` truncates in place; write-temp-then-rename for atomicity.
- Derive `PlannerSessionStatus` from a `PLANNER_SESSION_STATUSES` const so the DTO's `enum:` array
  cannot drift from the union (this change is itself the proof — `not_configured` had to be added
  in two places).
- Move `SaveScraperCredentialInput` from `core/*.validation.ts` to `model/*.dtos.ts`.
- `Record<string, any>` → `Record<string, unknown>` in the login client so the runtime guards
  become load-bearing rather than advisory.
- Decrypt failure: `catch (error)` and log the cause; consider a 5xx status rather than
  `BadRequestError`, since a wrong `APP_SECRET` is a server fault, not a bad request.

**Commit**: `refactor(planner): audit follow-ups on the credential path`

---

## Unplanned — the committed spec cannot describe Planner without `RAW_DB_URL` (2026-08-08)

### Task U.1 — Decide how `openapi.json` is generated, then finish Task 4.2 ✅ DONE (2026-08-08)

- [x] Task complete

> **Decided by the requester on 2026-08-08: option 1**, with the placeholder baked into the export
> so the next person cannot regenerate a spec that silently drops a fifth of the API.
>
> Implemented as a side-effect module, `src/tools/export-openapi.env.ts`, imported **above** the
> `app.module` import. The obvious approach — assigning `process.env.RAW_DB_URL` at the top of
> `export-openapi.ts` — does not work: imports are evaluated before any top-level statement, so
> `app.module` reads the variable before it is set. The second attempt, a dynamic
> `await import('../app.module')`, failed differently: `tsconfig` sets `module: "nodenext"`, so
> `import()` stays a genuine ESM import and cannot resolve an extensionless `.ts` path
> (`Cannot find module ...src/app.module`). Import **order** is what solves it, and both files
> carry a comment saying so, because moving that import restores the bug silently.
>
> Verified the way that matters: `env -u RAW_DB_URL pnpm openapi:export` still produces 558 paths.
>
> Net effect on this PR's diff: +458 lines in `openapi.json`, of which the Banner, Planner-scraper
> and scraping-export paths are a pre-existing gap being corrected rather than anything this change
> introduced. Nothing is removed from the spec.

**Blocks Task 4.2 and therefore AC-14. Needs a decision, not just execution.**

`app.module.ts:229` registers `BannerModule`, `PlannerModule` and `ScrapingExportsModule` only
when `process.env.RAW_DB_URL` is set:

```ts
...(process.env.RAW_DB_URL ? [BannerModule, PlannerModule, ScrapingExportsModule] : []),
```

`src/tools/export-openapi.ts` builds the document from `AppModule`, so the generated spec inherits
that condition. Measured both ways on this branch:

| Export                                           | Paths | Schemas | This change's endpoints |
| ------------------------------------------------ | ----- | ------- | ----------------------- |
| without `RAW_DB_URL` (how it is generated today) | 542   | 305     | **absent**              |
| with `RAW_DB_URL` set                            | 558   | 310     | present                 |

`git show HEAD:openapi.json` contains **zero** `/planner` or `/banner` paths, so the committed
spec has never described any scraping endpoint — including `/planner/session/status` and
`/refresh`, which already existed before this change and which the frontend's Planner screen
already calls. The spec is currently silent about endpoints the frontend consumes.

So AC-14 ("the regenerated `openapi.json` carries the new endpoints") is unreachable without
changing how the spec is generated. Options:

1. **Export with `RAW_DB_URL` set** (and make that permanent — e.g. bake a dummy value into the
   `openapi:export` script, since `preview: true` never opens a connection). Makes the spec
   truthful and satisfies AC-14. Cost: +458 lines in this PR, ~13 of the new paths belonging to
   Banner and the scrapers rather than to this change.
2. **Export without it** and accept that these endpoints stay undocumented. Keeps the diff tight;
   fails AC-14 and leaves the frontend coding against an unspecified contract.
3. **Split**: land this change with option 2, and fix spec generation in its own PR.

Recommendation: **1**, with the dummy `RAW_DB_URL` baked into the script so the next person cannot
regenerate a spec that silently drops a fifth of the API. The unrelated paths are a one-off
correction, and they are additive — nothing is removed.

**Do not** simply run `pnpm openapi:export` without deciding: it produces a spec that looks
regenerated and quietly omits every endpoint this change added.

**Files** (once decided)

- `openapi.json` (regenerate)
- `package.json` (modify — only under option 1)

**Commit**: `chore(api): regenerate openapi.json for the Planner credentials endpoints`

## Audit fixes (/abet-audit-pr)

### Review round 4 — 2026-08-09

Six auditors over the post-round-3 tree, on HEAD `20cdf25f`. **Verdict: NOT READY — 0 blockers,
11 majors.** Round 3's five fixes had landed in `3fe1f080` / `7abe04c9` / `20cdf25f`, i.e. _after_
its mutation campaign, so nothing had ever tested them. That is what this round was for, and it
paid: three majors are round-3 fixes that do not work.

| Round | Blocker                                   | Character of the majors                                   |
| ----- | ----------------------------------------- | --------------------------------------------------------- |
| 1     | Live credentials committed                | Real defects across every domain                          |
| 2     | `refresh()` reported `active` when broken | 4 of 9 were round-1 regressions                           |
| 3     | none                                      | 2 behavioural, 5 test-coverage gaps, 4 documentation      |
| 4     | none                                      | 3 unverified round-3 fixes, 3 behavioural, 5 doc/contract |

Two findings were reached independently by four auditors each (the error-hierarchy leak and the
`getValidToken` traceability claim), and the audit ledger itself was found to be wrong: `C.6` and
`B.11` carried `DONE` over items nobody had applied, plus three commit references that resolve to
nothing. Both are corrected in place above rather than appended beside, since a false tick is
exactly what makes a finding invisible to the next round.

> **The three behavioural majors converge on one symptom**, which is why they are worth naming
> together: a u-planner outage during a scrape reported the run as `expired`. That sends the
> operator to re-enter credentials that were never wrong — the precise failure this whole change
> was written to eliminate, reintroduced by three unrelated mechanisms.

**All 11 majors and all 16 minors fixed 2026-08-09.** Every behavioural fix was mutation-verified
before being called done — 10 mutants, all killed:

> unconditional flight reset; forced caller joins any flight; the non-forced fast path removed;
> `persist()` rethrowing; generation captured before the credential read; `REFRESH_COOLDOWN_MS`
> shortened to 1ms; `cause()` not walking the chain; the `exp` range guard dropped; the key
> derivation reverted to `Buffer.from(secret, 'hex')`; the GCM length pin removed.
>
> Plus the three round-3 throttle invariants that survived round 3's own campaign: unconditional
> `release()`, `penalise()` without its `Math.max`, and `VERIFY_CLAIM_MS` shortened to the penalty.

### Task D.1 — An unreachable u-planner is reported as an expired session ✅ DONE (2026-08-09)

- [x] Task complete

**Major. Found independently by auditors A, D, E and F.** `PlannerLoginUnreachableError extends
PlannerSessionExpiredError`, and `PlannerScraperService` classifies a whole run by that type alone.
A transport outage therefore finished the run as `expired`.

**Fix**: `PlannerLoginUnreachableError` now extends `Error`. Only `PlannerLoginRejectedError` — a
refusal, which genuinely disproves the session — still extends `PlannerSessionExpiredError`. The
paths that must treat both alike use the new `isPlannerLoginError` guard. The scraper needed no
change, which is the test that the taxonomy is now right.

### Task D.2 — A non-forced caller was conscripted into a forced flight ✅ DONE (2026-08-09)

- [x] Task complete

**Major (auditor F).** `if (current && (!forceRefresh || current.forced))` reduces to `if (current)`
for a non-forced caller, so every scrape worker asking for "whatever is valid" joined whatever login
was running — including an operator's forced refresh. With u-planner down they stalled for the full
30s login ceiling and then inherited its failure, about a session they were not using and that was
good for hours.

**Fix**: the cached session is checked before any join can happen.

### Task D.3 — A failed store write discarded the session it had just obtained ✅ DONE (2026-08-09)

- [x] Task complete

**Major (auditor F).** The store file was the only cache, so an `EACCES`/`ENOSPC`/read-only mount
made `adoptSession` throw away a session u-planner had already granted — unlogged, because that
error is not a `PlannerSessionExpiredError`. The scraper continues past a per-course failure, so the
next request logged in again: roughly one institutional authentication per request, with no cooldown
on that path at all.

**Fix**: the session is held in memory before the write is attempted, and the write failure is
caught and logged at `error`. A disk fault now costs the cross-restart cache, not the session.

### Task D.4 — `POST /credentials` failed silently ✅ DONE (2026-08-09)

- [x] Task complete

**Major (auditor A).** Round 1 moved AC-3's `warn` into `PlannerTokenService.login()` on the grounds
that "all paths go through it". The credential-save path does not — it calls `PlannerLoginClient`
directly. Since every branch throws an i18n key and `AllExceptionsFilter` logs only non-i18n
messages, the endpoint answered 400/503 with no server-side record at all. That is the proposal's
problem #2, reproduced on the endpoint this change added.

**Fix**: a `Logger` in `PlannerCredentialsService` — `warn` on the failure, `debug` on the throttle.

### Task D.5 — Three round-3 fixes were never tested ✅ DONE (2026-08-09)

- [x] Task complete

**Major (auditor C), proven by a 68-mutation campaign — 50 killed, 18 survived.**

1. **The chained-flight test could not fail.** Proven with a four-cell experiment: two
   `await Promise.resolve()` ticks are not enough for the predecessor's promise to settle, so the
   `.finally` the test is named after had not run. Fixed with a real macrotask flush, and the
   fixture changed so the chained flight actually runs.
2. **All three throttle invariants the source comments call load-bearing survived mutation** —
   ownership on `release`, the `Math.max` in `penalise`, and the claim outlasting its login.
3. **The key-derivation fix had zero tests.** Reverting it left the suite green, because the spec
   only ever used the one secret length that already worked.

### Task D.6 — `getValidToken` was deleted while the ACs certified it survived ✅ DONE (2026-08-09)

- [x] Task complete

**Major (auditors B and C).** AC-12 and traceability row 12 both stated it kept its signature. It
was removed in round 3. **Fix**: dated amendment on AC-12 and a rewritten row 12.

### Task D.7 — Contract and documentation defects ✅ DONE (2026-08-09)

- [x] Task complete

**Majors (auditor B) and the minors around them.** `design.md` gave `decryptionFailed` as 400 where
the code returns 503 — round 3's C.4 class recurring in the file the round-4 docs commit had just
edited. `/banner/scrape` and `/planner/scrape` published `required: true` bodies against **empty
schemas**, and this PR is what puts the whole scraping surface into the frontend's source of truth
for the first time. Both 400-carrying endpoints documented only their 503.

**Fix**: `@ApiPropertyOptional` on both scrape DTOs; a 400 `ApiResponse` naming all three meanings
on the save route and the one on refresh; the status table corrected; `design.md`'s throttle step,
`refreshing` field name and store-writer row brought up to the code; the runbook's cooldown table
corrected to 60s/30s and its stale surviving-flight paragraph removed; ADR-001 given the key
derivation and the warning that changing it equals rotating the secret; `CONTEXT.md`'s "roughly a
fifth of the API" corrected to the real 16 paths, and the single-instance constraint recorded there
where an operator scaling the service will actually meet it.

### Task D.8 — Round-4 minors ✅ DONE (2026-08-09)

- [x] Task complete

- **Ciphertext could overflow its column** (auditors A and E): `varchar(1000)` against a
  200-character DTO, where GCM expands to `58 + 2 x utf8Bytes`. A 200-character CJK password reaches
  1258 and throws Postgres `22001` — a bare 500, _after_ u-planner had accepted the pair. Column
  widened to `varchar(5000)` in the same migration, which has not been applied anywhere.
- **The DTO accepted non-strings** (auditor E): the global pipe's `enableImplicitConversion` coerces
  before `@IsString()` runs, so `{"password": {"a": 1}}` validated as `"[object Object]"` and was
  spent on a real u-planner login. Route-scoped pipe with the option off.
- **`expFromJwt` could throw a raw `RangeError`** (auditor F) for an out-of-range `exp`, escaping
  every classifier as a 500. Bounded — and, with `decodeJwt`, reclassified as _unreachable_
  (auditor A): u-planner accepted the credentials and then returned a token it cannot have meant to
  send, so blaming the pair would arm the penalty against a fault no password can fix.
- **GCM accepted a truncated auth tag** (auditor E) — 128-bit integrity silently degrading to
  32-bit on any row an attacker could write. IV and tag lengths now pinned.
- **`APP_SECRET_HEX_LENGTH`** and its error message still described hex after the derivation change.
- **`validateSave` ran after the live login** (auditor A), so a whitespace-only username was spent
  on a real attempt and armed the throttle. Moved before `verify()`.
- Test gaps closed: the store's shape guard and its config key, the `0600` assertion (which could
  not detect removal of the `chmodSync` it existed for — it seeded the destination, which `save()`
  never writes to), `Number.isInteger`/`NaN` on the user id, the `refreshToken` type guard, the
  refresh cooldown's lower bound under fake timers, the generation-capture ordering, and the shared
  `afterEach` whose emptiness made one case's secret-absence check vacuous.

**Deferred, recorded rather than fixed:** the verification claim is released before the credential
write rather than after it (auditors A and F, both `suggestion`), leaving a window in which two
saves could land out of order. It requires the DB write to outlast a full network login.

**Commits** — four, because the specs cannot travel separately from the behaviour they pin (a
`fix` / `test` split would leave the middle commit red and the hooks would refuse it):

1. `fix(libs): pin the GCM lengths and correct the APP_SECRET requirement message`
2. `fix(planner): stop an unreachable u-planner reading as an expired session`
3. `fix(api): describe the scrape request bodies and the credential 400s in the spec`
4. `docs(planner): record audit round 4 and correct the stale task ledger`
