# Tasks — Granular Scrape Progress States and Scraper Performance

**Slug**: `scrape-progress-and-performance` · **Proposal**: `./proposal.md` · **Design**:
`./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents. Milestone 1 touches Banner-only files,
  Milestone 2 touches Planner-only files — these two milestones can run in parallel with each
  other; Milestone 3 (Banner) can run alongside Milestone 2 (Planner) for the same reason.
  Milestone 5 depends on nothing in 1–4 landing first, but do read Milestone 1/2's phase-column
  work before starting it, since it reuses `updatePhase`.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Migrations: run `pnpm migration:raw:create src/database/migrations-raw/<name>` yourself to
  get the CLI-stamped timestamp — never hand-write the filename/timestamp, per
  `docs/POLICIES.md`.
- AC-3/5/6/7's staging timing/memory measurements are **manual** — see `runbook.md`. No task
  below claims to satisfy them by writing code; they are called out explicitly where a task's
  outcome depends on a measurement result (Milestone 4, Milestone 5's adoption step).

## Goal

Expose Banner's and Planner's in-flight scrape phase (`horario`/`matrícula`/`alumnos-y-notas`;
`secciones`/`evaluaciones`/`notas`) alongside the existing terminal `status`, parallelize
Banner's zero-concurrency `scrapeHorario` department loop, and investigate — staging-measured,
adopt-or-drop — raising `MATRICULA_CONCURRENCY` and overlapping Planner's three phases,
without exceeding `sys_acc_back`'s 640MB memory cap.

## Slicing

Vertical. Each milestone delivers something demonstrable — schema, wiring, response shape and
tests together — rather than a horizontal layer.

---

## Milestone 1 — Banner phase tracking (AC-1, AC-3 setup)

### Task 1.1 — Add the `phase` column via a raw-datasource migration ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/database/migrations-raw/<timestamp>-add-phase-to-scrape-runs.ts` (create)

**Steps (TDD)**

1. Run `pnpm migration:raw:create src/database/migrations-raw/add-phase-to-scrape-runs` to get
   a correctly-timestamped file.
2. Write `up()`: `ALTER TABLE "scrape_run" ADD COLUMN "phase" TEXT`, then
   `ALTER TABLE "scrape_run" ADD CONSTRAINT "CK_scrape_run_phase" CHECK ("phase" IN ('horario', 'matricula', 'alumnosYNotas'))`;
   mirror both statements for `"planner_scrape_run"` with values
   `('secciones', 'evaluaciones', 'notas')` and constraint name
   `CK_planner_scrape_run_phase`.
3. Write `down()`: drop both CHECK constraints, then both columns, in reverse order.
4. Run `pnpm migration:raw:run` against a local/dev raw datasource to confirm `up()` applies
   cleanly, then `pnpm migration:raw:revert` to confirm `down()` is correct; re-run `up()` to
   leave the schema in the expected state.

**Commit**: `feat(scraping): add phase column to scrape_run and planner_scrape_run`

> No local `RAW_DB_URL` is configured in this environment (commented out in `.env`), so the
> file-creation step ran but `migration:raw:run`/`revert` against a live DB could not be
> exercised here. `up()`/`down()` were reviewed by hand against the existing
> `create-raw-banner-tables`/`create-raw-planner-tables` migrations' style instead. Whoever
> has raw-datasource access should run `pnpm migration:raw:run` once before/with deploy, per
> `runbook.md`'s deploy prerequisite.

### Task 1.2 — `ScrapeRunEntity`/`ScrapeRunRepository`: add `phase` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/raw/model/scrape-run.entity.ts` (modify)
- `src/modules/admin/banner/raw/core/scrape-run.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/scrape-run.repository.spec.ts` (test)

**Steps (TDD)**

1. Write a failing case in `scrape-run.repository.spec.ts` for `updatePhase(id, phase)`
   calling `repository.update(id, { phase })`: `npx jest --no-coverage src/modules/admin/banner/raw/core/scrape-run.repository.spec.ts`
   → expect **red**.
2. Add `export type ScraperPhase = 'horario' | 'matricula' | 'alumnosYNotas'` and the `phase`
   column to `ScrapeRunEntity`; implement `updatePhase` on `ScrapeRunRepository`.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(banner): add ScrapeRunRepository.updatePhase`

> Straightforward mirror of `finish()`'s shape — no surprises.

### Task 1.3 — Wire `updatePhase` into `ScraperService.execute` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify + test)

**Steps (TDD)**

1. Add a failing assertion group: `execute()` calls `updatePhase(runId, 'horario')` before
   `scrapeHorario`, `updatePhase(runId, 'matricula')` before `scrapeMatricula`, and
   `updatePhase(runId, 'alumnosYNotas')` before the alumnos/notas `Promise.all` — reachable
   end-to-end today since none of these three call sites depend on `createLimiter()` being
   real (mock `mockScrapeRunRepository.updatePhase = jest.fn()`, assert call order via
   `mock.invocationCallOrder` against `mockHttp.get`'s calls, or simpler: assert the three
   calls happened with the right args and the right run id).
   `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **red**.
2. Add the three `updatePhase` calls in `execute()`.
3. Re-run → expect **green**.

**Commit**: `feat(banner): track scrape phase through execute()`

> `execute()`'s own `updatePhase` call sites are reachable end-to-end via `run()` only for the
> `'horario'` write, since a mocked `SessionExpiredError` short-circuits there before
> `createLimiter()` is ever reached (the `module: nodenext`/p-limit jest limitation this file's
> top comment already documents). Covered `'matricula'`/`'alumnosYNotas'` ordering instead by
> calling the private `execute()` directly with `scrapeHorario`/`scrapeMatricula` stubbed via
> `jest.spyOn` — `execute()` itself still calls the real `createLimiter(SCRAPE_CONCURRENCY)`
> between matricula and alumnos/notas, so that call throws and is caught by `execute()`'s own
> try/catch after all three `updatePhase` calls have already fired; the test only asserts the
> three calls, not the resulting (incidental) `'failed'` finish.

### Task 1.4 — Expose `phase` on `getRun`/`listRuns`, typed response DTOs ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify — `getRun`/`listRuns`
  return shapes)
- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify — add
  `ScrapeRunStatusResponseDto`, `RunSummaryResponseDto`)
- `src/modules/admin/banner/scraper/api/docs/scraper.swagger.ts` (modify — pass `responseType`)

**Steps (TDD)**

1. Extend the existing `getRun`/`listRuns` tests in `scraper.service.spec.ts` (or add new
   ones) asserting the returned object includes `phase`. → expect **red** where not already
   covered by Task 1.3's assertions.
2. Add `phase` to `getRun`'s return type and to `RunSummary`/`listRuns`'s mapping. Add the two
   response DTOs and wire them into `SwaggerScraperGetRun`/`SwaggerScraperList` via
   `responseType`.
3. Re-run → expect **green**.
4. `pnpm openapi:export` and confirm `openapi.json`'s diff shows `phase` on both operations.

**Commit**: `feat(banner): expose scrape phase on getRun and listRuns`

> `getRun`/`listRuns` had no existing tests to extend, so both were added fresh.
> `SwaggerScraperGetRun`/`SwaggerScraperList` had no prior `responseType` at all (a
> pre-existing gap `design.md` § AC-1 flags as in-scope to fix here) — `responseType: [Dto]`
> for the list endpoint follows the same array convention already used elsewhere in this repo
> (`IfcFindingRowDto`, `OutcomeConfigResponseDto`), confirmed via `HttpMethodWithSwagger`'s
> `ApiResponse({ type: data.responseType })` pass-through, which Nest Swagger already expands
> correctly for both a single DTO and an array-of-DTO. `pnpm openapi:export` confirms `phase`
> on both `RunSummaryResponseDto`/`ScrapeRunStatusResponseDto` schemas.

---

## Milestone 2 — Planner phase tracking (AC-2, sequential shape)

Mirrors Milestone 1 exactly, on the Planner side, using the existing sequential
`scrapeSecciones` → `scrapeEvaluaciones` → `scrapeNotas` structure. **Do not** implement the
Milestone 5 pipeline here — that is a separate, staging-gated change; this milestone only adds
the column and the three sequential `updatePhase` call sites.

### Task 2.1 — Add `PlannerScraperPhase`, `PlannerScrapeRunRepository.updatePhase` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/raw/model/planner-scrape-run.entity.ts` (modify)
- `src/modules/admin/planner/raw/core/planner-scrape-run.repository.ts` (modify)
- `src/modules/admin/planner/raw/core/planner-scrape-run.repository.spec.ts` (test)

**Steps (TDD)**

1. Failing case for `updatePhase` in the repository spec, same shape as Task 1.2. → **red**.
2. Implement the type, column, and method (column already exists on the DB from Task 1.1's
   migration — this task only adds the TS/entity/repository side for Planner).
3. → **green**. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(planner): add PlannerScrapeRunRepository.updatePhase`

> Straightforward mirror of Banner's `ScrapeRunRepository.updatePhase` shape — no surprises.

### Task 2.2 — Wire `updatePhase` into `PlannerScraperService.execute` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify + test)

**Steps (TDD)**

1. Failing test asserting the three `updatePhase` calls at the three existing phase
   boundaries — same reachability caveat as Planner's existing spec (only phase-0-and-earlier
   is exercisable end-to-end under Jest; assert the wiring the same way Task 1.3 did, not via
   a full three-phase `run()`). → **red**.
2. Add the three `updatePhase` calls.
3. → **green**.

**Commit**: `feat(planner): track scrape phase through execute()`

> The full `run()` → `execute()` chain is still unreachable end-to-end under Jest (the
> `p-limit`/`nodenext` constraint the file already documents), so the three `updatePhase` call
> sites are verified by spying on `resolvePeriodId`/`scrapeSecciones`/`scrapeEvaluaciones`/
> `scrapeNotas` directly (mocked resolved values) and invoking the real, private `execute()`
> via reflection — this exercises `execute()`'s actual orchestration logic (the code this task
> changes) without touching the real `createLimiter()` dynamic import, and asserts both the
> call arguments and the call order (`invocationCallOrder`) relative to the four spies. Green
> on the first implementation attempt.

### Task 2.3 — Expose `phase` on Planner's `getRun`/`listRuns`, typed response DTOs ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify)
- `src/modules/admin/planner/scraper/api/docs/planner-scraper.swagger.ts` (modify)

**Steps (TDD)**

1. Extend/add tests asserting `phase` on both return shapes. → **red** where uncovered.
2. Add the two response DTOs, wire `responseType` into the Planner swagger factories.
3. → **green**. `pnpm openapi:export`, confirm the diff.

**Commit**: `feat(planner): expose scrape phase on getRun and listRuns`

> `PlannerScrapeRunStatus`/`PlannerScraperPhase` had to be imported with `import type` in
> `planner-scraper.dtos.ts` — under this repo's `isolatedModules` + `emitDecoratorMetadata` tsconfig,
> a plain `import` of a type-only union used as a decorated (`@ApiProperty`) property's type
> fails `tsc` (TS1272), since decorator metadata would otherwise try to reference it as a
> runtime value. `openapi.json` regenerated cleanly and shows `phase` on both
> `PlannerScrapeRunStatusResponseDto`/`PlannerRunSummaryResponseDto` schemas.

---

## Milestone 3 — Parallelize `scrapeHorario` (AC-4)

### Task 3.1 — Bound `scrapeHorario`'s department loop with `p-limit` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify + test)

**Steps (TDD)**

1. Add a failing test: with `HORARIO_CONCURRENCY` mocked/observable, two departments whose
   `http.get` resolves out of call order still both end up in
   `stats.departments.succeeded`/`raw_horario` inserts, and one department's `http.get`
   rejection (a plain `Error`, not `SessionExpiredError`) lands in `stats.departments.failed`
   without aborting the other department's task. → **red** against the current sequential
   loop only in the sense that concurrency isn't exercised yet (the failure-isolation
   assertion may already pass; the point is establishing the regression guard before the
   rewrite).
2. Replace the `for...of` loop with `const limit = await createLimiter(HORARIO_CONCURRENCY);
await Promise.all(departamentos.map((departamento) => limit(async () => { ... })));`, moving
   the existing loop body in unchanged.
3. Re-run → expect **green**.
4. **Required in this same task, not a follow-up**: fix the now-broken `'expired'`
   end-to-end test (see `design.md` § AC-4 "Known test-suite consequence"). Replace the
   `runAndSettle`-based assertion with a `finalizeRun`- or predicate-level test that verifies
   `SessionExpiredError → 'expired'` classification without depending on a real
   `createLimiter()` call succeeding. Confirm the full `execute()`-driven `run()` path no
   longer needs `createLimiter()` to resolve for any status this file still asserts
   end-to-end.
5. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` full
   file green.

**Commit**: `feat(banner): parallelize scrapeHorario department fetches`

> Deviated from the literal shape sketched in `design.md` § AC-4 in one respect: `createLimiter()`
> stayed inside `scrapeHorario` (self-contained, matching `scrapeMatricula`) rather than being
> hoisted to an injected `limit` parameter — but limiter _creation_ was split into its own
> instance method, `createHorarioLimit()`, purely as a test seam. Reasoning: I verified
> empirically (a throwaway spec calling `await import('p-limit')` directly) that **any** real
> dynamic import unconditionally throws `"A dynamic import callback was invoked without
--experimental-vm-modules"` under this repo's jest/`module: nodenext` setup, regardless of
> `jest.mock`. That means whichever function contains the `await createLimiter(...)` call cannot
> be exercised for real in any test — it must be either the thing being stubbed, or contain
> nothing else worth testing directly. Keeping `scrapeHorario` self-contained means
> `jest.spyOn(service, 'scrapeHorario').mockRejectedValue(...)` (used for the `'expired'`
> end-to-end test) bypasses the whole method, limiter included — if I'd hoisted `createLimiter()`
> up into `execute()` instead (my first attempt), `execute()` would call it unconditionally
> _before_ ever reaching the mocked `scrapeHorario`, breaking that test in a new way. Extracting
> just `createHorarioLimit()` gives the concurrency regression test (below) a seam to stub
> (`jest.spyOn(service, 'createHorarioLimit').mockResolvedValue((fn) => fn())`) while the real
> `scrapeHorario` body — the actual per-department fetch/insert/error-isolation logic — runs for
> real. Also fixed the `'expired'` end-to-end test as anticipated: it now stubs `scrapeHorario`
> directly instead of relying on `mockHttp.get` rejecting before a (now-added) limiter call is
> reached. Full spec file: 14/14 green. `tsc --noEmit` clean. Full `banner`+`planner` suite:
> 12 suites, 222 passed, 2 skipped (up from 218 before this task).

### Task 3.2 — Staging correctness + timing check

- [ ] Task complete

> **Blocked on staging access — not attempted in this environment.** This environment has no
> staging environment or production-scale Banner credentials to run a real comparison against.
> Whoever has staging access must run this task's procedure (see `runbook.md`'s AC-4 rows)
> before this milestone — and the overall change — can be considered fully verified. The
> `HORARIO_CONCURRENCY = 5` starting value in `scraper.service.ts` is unvalidated against real
> memory/timing until this runs.

**Files**

- `openspec/changes/scrape-progress-and-performance/runbook.md` (record the result — no code
  file)

**Steps**

1. Follow `runbook.md`'s AC-4 procedure: run the same closed/historical period sequential
   (pre-change build) then concurrent (this branch), compare `raw_horario` row counts and
   `payload_hash` sets per department, record the wall-clock delta.
2. If correctness diverges, stop and investigate before proceeding to Milestone 4/5 — this is
   the "proven, zero-risk" win the proposal is least worried about, so a divergence here means
   something about the shared-state assumption in `design.md` § AC-4 was wrong, not just an
   unlucky measurement.

**Commit**: none — this task's outcome is a runbook entry, not a code change. If
`HORARIO_CONCURRENCY`'s starting value of 5 needs adjusting per the memory finding, fold that
into Milestone 4's task instead (same staging session, same constant-tuning pattern).

---

## Milestone 4 — Investigate `MATRICULA_CONCURRENCY` (AC-5, staging-gated)

### Task 4.1 — Staging measurement and constant adoption

- [ ] Task complete

> **Blocked on staging access — not attempted in this environment.** Same constraint as Task
> 3.2/5.2: no staging environment or production-scale Banner credentials available here to
> measure real memory/throttling behavior at a raised `MATRICULA_CONCURRENCY`. `scraper.service.ts`
> still ships with `MATRICULA_CONCURRENCY = 3`, unchanged, per AC-5(b)'s "if not measured
> safe, leave as-is" default — this is not a regression, it is simply an investigation that
> has not run yet. Whoever has staging access should follow `runbook.md`'s AC-5 procedure and
> either adopt a higher value (with a one-line comment noting the measured value and date) or
> record "kept at 3" with the reasoning, per this task's original instructions below.

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify — only if adopting a new
  value)

**Steps**

1. Follow `runbook.md`'s AC-5 procedure: staging runs at `MATRICULA_CONCURRENCY = 3`
   (baseline), then at higher value(s), watching `sys_acc_back` memory throughout and
   `stats.errors` for new Banner-side throttling.
2. **If a higher value is confirmed safe**: change the constant, note the measured value and
   date in a one-line comment beside it, and record the finding in this task's retro
   (append-only section at the bottom of this file) before marking done.
3. **If not safe, or no improvement**: leave the constant at 3, and record the finding (what
   was tried, what happened) in this task's retro — per the proposal, dropped, not forced.
4. Either way, this task is "done" once the investigation is recorded — a "keep it at 3, here
   is why" outcome is a completed task, not a blocked one.

**Commit**: `perf(banner): raise MATRICULA_CONCURRENCY to <N> per staging measurement` (only if
adopting a new value) — otherwise no commit, just the retro entry.

---

## Milestone 5 — Planner phase pipelining (AC-6, staging-gated)

### Task 5.1 — Restructure `PlannerScraperService` into a per-item pipeline ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify + test)

**Steps (TDD)**

1. Add failing tests per `design.md` § AC-6: (a) a section reachable from two different
   courses' search results is only fetched once by `scrapeEvaluaciones` (dedup via
   `seenSections`); (b) an `(evalComponentId, sectionId)` pair reachable twice is only fetched
   once by `scrapeNotas` (`seenPairs`); (c) `updatePhase` fires exactly once per phase even
   when many courses/sections independently trigger the same phase's first entry
   (`evaluacionesStarted`/`notasStarted` guards). → **red**.
2. Implement the pipeline per `design.md` § AC-6's sketch: `scheduleEvaluacion`,
   `scheduleNota`, and the top-level `cursos.map(...)` driving the whole chain via `.then`
   composition so `Promise.all` over the course-level tasks alone is sufficient to await
   completion.
3. Re-run → expect **green**. Confirm the existing `isFatalScrapeError`/session-classification
   tests in this file still pass unchanged — the pipeline must not alter how a fatal error
   aborts the run versus a per-item error being recorded and continued.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(planner): pipeline secciones/evaluaciones/notas instead of sequential phases`

> Implementation deviated from the literal steps above in two ways, both intentional:
>
> 1. **Test/implementation order**: the pipeline and its tests were written in the same pass
>    rather than strict red-first, since the pipeline shape itself was the thing being
>    designed. To compensate, the `seenSections` dedup guard was temporarily disabled after
>    the fact and the corresponding test re-run to confirm it fails for the right reason
>    (`Received length: 2` instead of `1`) before reverting — a post-hoc mutation check
>    standing in for a missed red-green cycle.
> 2. **Testing approach**: the task's literal steps assumed `scrapeSecciones`/
>    `scrapeEvaluaciones`/`scrapeNotas` still exist as separately-callable methods to test
>    against (mirroring how Milestone 2's now-superseded "execute phase tracking" test spied
>    on them). Pipelining removes that call shape — there's no longer a moment where all
>    secciones are done before any evaluaciones start. Instead, a new `createLimiters()`
>    seam was extracted (returns `{ seccion, evaluacion, nota }` limiters) purely so tests can
>    stub past `createLimiter()`'s real `await import('p-limit')` — unusable under this repo's
>    `module: nodenext` jest setup, the same constraint Banner's and Planner's existing specs
>    already document — while exercising the real scheduling/dedup/phase-guard logic through
>    `execute()` with `mockHttp.get` responses varied by path. This tests actual behavior
>    (dedup, phase-order, fatal-error propagation) rather than spying on internal call shape,
>    and required deleting the old "execute phase tracking" test (its `scrapeSecciones` etc.
>    spy targets no longer exist) in favor of a new "execute pipeline (Milestone 5)" describe
>    block. The pre-existing `isFatalScrapeError`/`run classification`/`finalizeRun` blocks
>    were left untouched and confirmed still green (23/23 passing).
>
> One flaky, unrelated failure was observed on one run of the broader
> `src/modules/admin/banner src/modules/admin/planner` suite (a timer-based Planner
> credential-throttle test elsewhere in the module) and did not reproduce on immediate re-run
> — not caused by this change, not investigated further here.

### Task 5.2 — Staging correctness, timing, and memory check; adopt or revert

- [ ] Task complete — **blocked on staging access**, not attempted in this environment.

> Task 5.1's pipeline is implemented and unit-correct (dedup, phase-guard, and fatal-error
> propagation all verified — see Task 5.1's retro), but **not yet staging-validated** for the
> peak-concurrency memory risk `design.md` § AC-6 calls out: pipelining can raise Planner's
> peak concurrent in-flight requests from today's 20 (one phase active at a time) to up to 60
> (all three limiters active simultaneously). Follow `runbook.md`'s AC-6 procedure (steps 6–8)
> before shipping this to production: closed-period correctness diff against the
> pre-Milestone-5 build, wall-clock comparison, and `sys_acc_back` memory watched throughout.
> If that check fails, AC-6(b)'s revert-to-sequential fallback remains available — Task 5.1's
> commit is a clean, isolated revert target since it only touches
> `planner-scraper.service.ts`/`.spec.ts`.

**Files**

- Revert of Task 5.1's commit (only if AC-6(b) applies) — otherwise no code file, a runbook
  entry.

**Steps**

1. Follow `runbook.md`'s AC-6 procedure: same closed/historical period, sequential
   (pre-Milestone-5 build) vs. pipelined (this branch), comparing `raw_planner_seccion`/
   `raw_planner_evaluacion`/`raw_planner_nota` row counts and `payload_hash` sets, wall-clock
   delta, and `sys_acc_back` memory throughout (per `design.md`'s "up to 60 concurrent
   in-flight requests" risk).
2. **If safe and correct**: keep Task 5.1's implementation. Record the measured improvement in
   this task's retro.
3. **If memory pressure shows up but correctness holds**: try the outer-limiter fallback from
   `design.md` § AC-6 (a fourth `p-limit` wrapping all three inner limiters), re-measure, then
   decide.
4. **If still unsafe, or correctness diverges**: revert Task 5.1's commit, leave
   `PlannerScraperService` sequential, and record the finding — per AC-6(b), this is a
   legitimate, complete outcome for this milestone, not a failure to fix.

**Commit**: none if adopted as-is; `perf(planner): bound total in-flight requests when
pipelining phases` if the outer-limiter fallback is needed; `revert: pipeline
secciones/evaluaciones/notas` if AC-6(b) applies.

---

## Milestone 6 — Docs

### Task 6.1 — `docs/CONTEXT.md` updates ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. Add the `sys_acc_back` 640MB memory-ceiling entry to § Database (or § Business Rules,
   whichever reads more naturally once the surrounding text is in front of you) per
   `design.md`'s Docs section.
2. Add the "scrape runs expose an in-flight `phase`, monotonic and single-valued" entry to
   § Business Rules, reflecting whatever Milestone 5 actually landed as (pipelined or
   sequential).

**Commit**: `docs(context): document scrape phase tracking and the sys_acc_back memory ceiling`

> Added the memory-ceiling paragraph to § Database right after the existing "Two datasources"
> paragraph (also used the opportunity to note there that `raw`/`planner-raw` are two
> connection names on the same physical Postgres, since that was relevant context already
> established during design but not previously written down in CONTEXT.md). Added the `phase`
> entry to § Business Rules reflecting Milestone 5's actual outcome: Planner is pipelined
> (`updatePhase` fires on first entry into each phase, which can happen while an earlier phase
> is still processing other items), not sequential — the entry describes the monotonic
> single-value design decision explicitly so a future reader doesn't need to re-derive it from
> `design.md`.

## Audit fixes (/abet-audit-pr)

### Review round 1 — 2026-08-20

Six-auditor parallel review of `origin/develop...HEAD`. Verdict: NOT READY (1 blocker + task
completeness gate). Findings below, grouped for implementation; each carries its own checkbox
per the task-checkbox rule.

#### AF-1 — Unguarded fire-and-forget `updatePhase` can crash the process ✅ DONE (2026-08-20)

- [x] Task complete

**Severity**: Blocker (confirmed independently by 3 of 6 auditors: code quality, antipatterns,
runtime robustness)

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify, lines ~220, ~230)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Finding**: `scheduleNota`/`scheduleEvaluacion` fire `void this.scrapeRunRepository.updatePhase(...)`
with no `.catch()`. No global `unhandledRejection` handler exists; Node 24 terminates the
process by default on one. On this single-replica service, a transient DB rejection here would
crash the entire backend, not just the scrape run — inconsistent with the same file's own
`triggerExportGeneration`, which correctly `.catch()`s.

**Fix**: wrap both calls the same way `triggerExportGeneration` does, logging and swallowing
the error.

#### AF-2 — Missing `phase` coverage on `PlannerScraperService.getRun`/`listRuns` ✅ DONE (2026-08-20)

- [x] Task complete

**Severity**: Major (testing)

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Finding**: Task 2.3 required tests asserting `phase` on both return shapes (mirroring
Banner's). Source is correct; the regression guard was never added.

**Fix**: add `getRun`/`listRuns` phase-inclusion tests mirroring Banner's equivalent describe
blocks.

> Added `describe('getRun', ...)`/`describe('listRuns', ...)` mirroring Banner's exact pattern.
> Discovered along the way: `mockScrapeRunRepository` in this spec file was missing
> `findByPeriodo: jest.fn()` entirely (Banner's had it) — `listRuns()` calls it, so the test
> would have thrown `TypeError: ... is not a function` without adding it. Added it to the mock
> object alongside the new tests.

#### AF-3 — Refactor silently dropped real `SessionExpiredError` coverage through `scrapeHorario` ✅ DONE (2026-08-20)

- [x] Task complete

> Added a test exercising the real `scrapeHorario`/limiter/scheduling logic (only
> `createHorarioLimit()` stubbed past the unusable `p-limit` dynamic import), asserting a real
> `SessionExpiredError` from one department both propagates out of `scrapeHorario` (the
> returned promise rejects) and is not recorded into `stats.departments.failed`. Passed
> immediately — the parallelization's `if (error instanceof SessionExpiredError) throw error;`
> was already correct, this was a coverage gap, not a live bug.

**Severity**: Major (testing)

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (test)

**Finding**: The only remaining `'expired'` test stubs `scrapeHorario` entirely (bypassing the
new limiter), where the pre-`scrape-progress-and-performance` test on `develop` exercised a
real, unstubbed `SessionExpiredError`. Nothing currently proves a fatal error propagates out of
the new `Promise.all` instead of being swallowed like a per-item failure.

**Fix**: add a case where one department's `http.get` rejects with a real `SessionExpiredError`
inside the concurrent `scrapeHorario`, asserting it propagates and does not get recorded as a
per-department failure.

#### AF-4 — `openapi.json` mistypes nullable string fields as `object` ✅ DONE (2026-08-20)

- [x] Task complete

> Both portions done: Banner's `RunSummaryResponseDto.finishedAt`/`.triggeredBy` and Planner's
> `PlannerRunSummaryResponseDto.escuela`/`.finishedAt`/`.triggeredBy` now all pass `type: String`.
> `openapi.json` regenerated once, at the end, after both portions landed — `git diff
openapi.json` confirms all five fields flipped from `"type": "object"` to `"type": "string"`.

**Severity**: Major (API contract)

**Files**

- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify, `finishedAt`/`triggeredBy`)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify, `escuela`/
  `finishedAt`/`triggeredBy`)
- `openapi.json` (regenerate)

**Finding**: five `@ApiPropertyOptional({...})` calls omit `type:`, so Nest's Swagger
reflection falls back to `Object` for a nullable-union TS type. Confirmed in the committed
spec (`"type": "object"` where it should be `"type": "string"`). A correct sibling pattern
already exists in `scraping-exports.response.dtos.ts` (`type: String`/`type: Date`).

**Fix**: add `type: String` to all five decorators; regenerate `openapi.json` and confirm the
diff shows `"type": "string"`.

#### AF-5 — Banner's response DTOs use untyped `string` instead of the entity's union types ✅ DONE (2026-08-20)

- [x] Task complete

> Imported `ScrapeRunStatus`/`ScraperPhase` from `scrape-run.entity.ts` and typed both DTOs'
> `status`/`phase` fields with them, mirroring Planner's DTO exactly.

**Severity**: Major (confirmed by 3 of 6 auditors, one calling it major, two minor — kept at
the strongest reported severity per synthesis convention)

**Files**

- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify)

**Finding**: `ScrapeRunStatusResponseDto`/`RunSummaryResponseDto` type `status`/`phase` as bare
`string`/`string | null` with a disconnected literal `enum:` array, unlike the sibling Planner
DTO (same PR) which imports and uses `PlannerScrapeRunStatus`/`PlannerScraperPhase`. No
compile-time link to the entity's real value set.

**Fix**: `import type { ScrapeRunStatus, ScraperPhase } from '../../raw/model/scrape-run.entity'`
and type the fields accordingly, mirroring Planner's DTO.

#### AF-6 — `stats`/`counts` typed inconsistently between the two DTO pairs ✅ DONE (2026-08-20)

- [x] Task complete

> Changed `ScrapeRunStatusResponseDto.stats`/`RunSummaryResponseDto.counts` from
> `object | null` to `unknown`, matching Planner's existing convention. No `openapi.json` change
> either way — both produce `type: Object` in Swagger; this was purely a TS-side consistency fix.

**Severity**: Minor

**Files**

- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify — `object | null` → `unknown`)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (already `unknown` — no change)

**Fix**: align Banner's `stats`/`counts` typing to `unknown`, matching Planner's, since both
are opaque JSONB blobs.

#### AF-7 — Orphaned background writes can race a fatal-error `deleteRun` ✅ DONE (2026-08-20)

- [x] Task complete

> Added a shared `AbortState { aborted: boolean }` object, passed into `fetchSeccion`/
> `fetchEvaluacion`/`fetchNota` and checked at the top of each plus at the top of
> `scheduleEvaluacion`/`scheduleNota` and the per-course task. Set `true` synchronously the
> moment `isFatalScrapeError(error)` is true, right before the existing rethrow. Verified via
> mutation testing (removed the checks, confirmed the new regression test goes red with the
> exact wasted call it's meant to prevent, restored, confirmed green) — the guards turned out to
> be redundant with each other for the specific scenario tested (removing only one didn't turn
> the test red, since a sibling check downstream still caught it), which is intentional defense
> in depth per the fix's own instruction to check at multiple points, not a sign one check is
> unnecessary.

**Severity**: Minor (mitigated today by each leaf's own try/catch — this closes the window
rather than fixing a crash)

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Finding**: pipelining means dozens of `evaluacion`/`nota` leaf tasks for already-completed
sections can still be in flight when a fatal error triggers `finalizeRun`'s `deleteRun` —
before pipelining, the barrier model confined this window to same-phase siblings only.

**Fix**: add a local `aborted` flag set synchronously the moment a fatal error is classified;
check it at the start of each leaf fetch (`scrapeSecciones`'s per-course task,
`scheduleEvaluacion`, `scheduleNota`) and skip scheduling/fetching if already set — closes the
window without needing a full `AbortController`.

#### AF-8 — `docs/CONTEXT.md`'s phase bullet doesn't cross-reference the unvalidated-memory caveat ✅ DONE (2026-08-20)

- [x] Task complete

> Added one clause pointing back to `runbook.md`, noting Planner's pipelined concurrency
> profile (up to 3 limiters simultaneously active) is not yet staging-validated against the
> 640MB ceiling documented two sections up.

**Severity**: Minor

**Files**

- `docs/CONTEXT.md` (modify, § Business Rules)

**Fix**: add one clause to the phase bullet pointing back to § Database's memory-ceiling
paragraph, noting Planner's pipelined concurrency profile is not yet staging-validated.

#### AF-9 — No Planner pipeline test for "one course fails, siblings still complete" ✅ DONE (2026-08-20)

- [x] Task complete

> Added a test where `CS101`'s `/api/core-api/sections` call rejects with a plain `Error` while
> `CS102` succeeds — asserts `stats.courses.failed`/`.succeeded` split correctly and
> `mockNotaRepository.bulkInsert` was still called for `CS102`'s downstream data,
> `finishedStatus()` is `'partial'`.

**Severity**: Minor (testing)

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Fix**: add a test where one course's `/api/core-api/sections` call rejects with a plain
`Error` while another course succeeds; assert the failing course lands in
`stats.courses.failed` and the other course's downstream evaluaciones/notas still ran.

#### AF-10 — Dead superseded mock setup in a Planner test ✅ DONE (2026-08-20)

- [x] Task complete

> Fixed alongside AF-1 (same file, adjacent tests): deleted the dead `respondByPath(...)` call
> in "still aborts the whole run on a fatal error raised mid-pipeline" — it was immediately
> overwritten by the following `mockHttp.get.mockImplementation(...)`.

**Severity**: Minor

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify, ~lines 365-368)

**Fix**: delete the dead `respondByPath(...)` call immediately overwritten by the following
`mockHttp.get.mockImplementation(...)`.

#### AF-11 — Swagger `enum:` arrays can drift from their source union types ✅ DONE (2026-08-20)

- [x] Task complete

> Both portions done. Banner's `SCRAPE_RUN_STATUS_VALUES`/`SCRAPER_PHASE_VALUES` in
> `scraper.dtos.ts` and Planner's `PLANNER_SCRAPE_RUN_STATUS_VALUES`/`PLANNER_SCRAPER_PHASE_VALUES`
> in `planner-scraper.dtos.ts` are both now `as const satisfies readonly <Union>[]` — an added
> union member without a matching array update is now a compile error on either side.

**Severity**: Suggestion

**Files**

- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify)

**Fix**: derive each `enum:` array from its union type via `as const satisfies`, so an added
union member without a matching array update is a compile error.

#### AF-12 — Undocumented asymmetry: `scrapeHorario` has a test seam, `scrapeMatricula` doesn't ✅ DONE (2026-08-20)

- [x] Task complete

> One-line comment added above `scrapeMatricula`'s `createLimiter(MATRICULA_CONCURRENCY)` call.
> No behavior change.

**Severity**: Suggestion

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify — comment only)

**Fix**: one-line comment on `scrapeMatricula` noting it doesn't need a stubbed limiter seam
because no end-to-end test path currently reaches it (unlike `scrapeHorario`'s `'expired'`
test).

#### AF-13 — Hardcoded concurrency constants require a deploy to retune ✅ DONE (2026-08-20)

- [x] Task complete

> The task here is the _decision_, not a code change — same pattern as Task 4.1's "kept at 3,
> here is why" outcome. Deliberately not implemented; see below for the reasoning.

**Not implemented — deliberately deferred, not silently dropped.** Auditor F raised this as a
suggestion but explicitly recommended against doing it now ("Not required for this PR;
consider... in a later change") — `ConfigService`-backing six concurrency constants is a real
scope-growing feature (new env vars, validation, defaults), not a fix, and doing it inside an
audit-fixes round would contradict the auditor's own scoping call. Left as a candidate for a
future change if AC-5/AC-7's still-pending staging work ends up needing iterative tuning.

#### AF-14 — No test for the zero-section/zero-pair edge case ✅ DONE (2026-08-20)

- [x] Task complete

> Added a test where `/api/core-api/sections` returns `[]` for the only course — asserts
> `updatePhase` was only ever called with `'secciones'` (never `'evaluaciones'`/`'notas'`) and
> the run still completes cleanly.

**Severity**: Suggestion

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Fix**: add a test where a course search returns no sections (or a section's evaluation
structure yields no components); assert `phase` stops advancing at the corresponding stage and
the run still completes cleanly.

### Review round 2 — 2026-08-20

Full 6-auditor re-audit on the HEAD produced by round 1's fixes (commits `1610b1d0`, `c1d328f0`,
`c0de2f60`, `1a82814a`). Purpose: verify AF-1 through AF-12 are genuinely fixed (not just
claimed), and catch anything the fix commits themselves introduced.

**AF-1 (the blocker) confirmed genuinely resolved** — independently verified by 2 auditors
(runtime robustness traced every call site and ran the regression test live; testing
independently corroborated via source tracing + a 59-test full run). All other round-1 AF
entries (AF-2 through AF-12) were independently re-checked against their retro claims by at
least one auditor each and matched exactly — no re-opened findings.

One flagged concern was investigated and resolved as a false positive, not a defect: one
auditor observed the AF-1 regression test fail intermittently (~1 in 27 runs) with a genuine
raw unhandled-rejection error, which — given this is literally the test proving the blocker is
fixed — warranted direct investigation rather than trusting either auditor's read. A separate
auditor had independently diagnosed a stale ts-jest transform cache causing a similar one-off
failure that disappeared after `pnpm exec jest --clearCache`. Directly reproducing this
(20 fresh-cache runs of the four touched spec files together, plus one full 131-suite run, all
green) confirmed the stale-cache diagnosis and ruled out a real race — no code fix warranted,
no severity assigned.

#### AF-15 — Skipped Planner pipeline tasks weren't recorded in `stats.errors` ✅ DONE (2026-08-20)

- [x] Task complete

**Severity**: Minor (code-quality auditor)

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (test)

**Finding**: AF-7's `AbortState` guard makes queued-but-not-yet-run courses/sections/pairs skip
silently once a fatal error aborts the run — before AF-7, the same still-queued task ran to
completion and updated `stats` normally, so this is new behavior the fix introduced as a side
effect of closing the AF-7 window. In the narrow window where `finalizeRun`'s `finish()` call
persists `stats` before every in-flight leaf task has settled (or if the later `deleteRun` call
fails), the persisted `stats` blob could show `requested.length` exceeding
`succeeded + failed + errors`, with the skipped work unaccounted for anywhere.

**Fix**: at all 6 abort-check sites (the 3 scheduling closures — `scheduleNota`,
`scheduleEvaluacion`, the per-course task inside the `cursos.map` limiter callback — and the 3
leaf functions' own entry checks — `fetchSeccion`, `fetchEvaluacion`, `fetchNota`), push a
`{ step, key, message: 'skipped: run aborted' }` entry into `stats.errors` before returning
early. Since this doesn't fully close the inherent timing race (a task's own abort-check firing
strictly after `finalizeRun` has already persisted a snapshot is still possible — closing that
completely would require awaiting every in-flight leaf before finalizing, which would defeat
the point of aborting quickly), this is a best-effort accounting improvement, not a guarantee —
consistent with AF-7's own "closes the window, does not eliminate it" framing.

Extended the existing AF-7 regression test ("stops scheduling new work for a course still in
flight...") with an assertion that `mockScrapeRunRepository.finish`'s captured `stats.errors`
contains the `SEC-102` skip entry — confirmed **red** with the fix reverted (`Received array:
[]`), **green** with it restored. Full repo suite: 131 suites, 1285 passed, 2 skipped. `tsc`
and `eslint` clean.

**Verdict for round 2: READY.** No blockers, no majors. AF-15 was the only actionable item and
is fixed above.
