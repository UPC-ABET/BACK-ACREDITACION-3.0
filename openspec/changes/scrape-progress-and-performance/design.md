# Design — Granular Scrape Progress States and Scraper Performance

**Slug**: `scrape-progress-and-performance`
**Proposal**: `./proposal.md`

## Read first

- `docs/CONTEXT.md` § Database — two datasources; `raw`/`planner-raw` are two TypeORM
  connection _names_ pointing at the **same** physical Postgres (`scrape_pg`, confirmed via
  `.claude/server-specs.md`), which is why one migration folder (`migrations-raw`) already
  holds both Banner's and Planner's raw-table migrations
- `docs/CONTEXT.md` § Business Rules — "latest-only retention" (the `finalizeRun` hook this
  change's phase-tracking writes sit next to) and the single-replica constraints
- `docs/POLICIES.md` § Migrations, § Entity Rules (raw-mirror exemption), § The API spec is a
  committed artifact
- `openspec/specs/scrape-retention-and-cached-exports/design.md` and
  `docs/adr/ADR-002-persisted-pollable-scraping-export-generation.md` — the sibling change that
  added `finalizeRun`/`triggerExportGeneration`, the hook point this change's phase updates sit
  beside, and the established sequential cross-repo pattern this change reuses
- `src/modules/admin/banner/scraper/api/scraper.service.ts` (`execute`, `scrapeHorario`,
  `scrapeMatricula`, `finalizeRun`) and its `.spec.ts` — Banner's phase structure and the
  `p-limit`/jest testing constraint documented in its own comments
- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (`execute`,
  `scrapeSecciones`, `scrapeEvaluaciones`, `scrapeNotas`) and its `.spec.ts` — Planner's phase
  structure, the same `p-limit`/jest constraint, and the existing "known gap in tasks.md, not
  an oversight" precedent for testing concurrency-gated code paths
- `src/modules/admin/banner/raw/model/scrape-run.entity.ts`,
  `src/modules/admin/banner/raw/core/scrape-run.repository.ts`, and their Planner mirrors
  (`planner-scrape-run.entity.ts` / `.repository.ts`) — raw-mirror entities, exempt from
  `BaseEntity`/custom-decorator rules per `docs/POLICIES.md`
- `src/database/migrations-raw/1781545794438-create-raw-banner-tables.ts` and
  `1781600000000-create-raw-planner-tables.ts` — the constraint-naming and hand-written
  `up()`/`down()` style to match

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No — reuses the existing raw Postgres tables (`scrape_run`, `planner_scrape_run`); no new datastore                                                                                                                                                                                                                     |
| Auth or payments provider                     | No                                                                                                                                                                                                                                                                                                                      |
| Public API contract change or breaking change | Partially — `getRun`/`listRuns` responses on both scraper controllers gain a new, optional `phase` field. Purely additive: no endpoint, route, or existing field is removed or reshaped, so nothing that already integrates against these responses breaks. `openapi.json` is regenerated in the same PR (see Backend). |
| New module boundary or cross-repo split       | No — reuses the existing `admin/banner/scraper` and `admin/planner/scraper` modules; the backend-leads-frontend pairing is the already-established pattern (see `openspec/specs/scrape-retention-and-cached-exports`), not a new split                                                                                  |
| Language, runtime or framework                | No                                                                                                                                                                                                                                                                                                                      |
| Contradicting an existing ADR                 | No — ADR-001 (credential encryption) and ADR-002 (persisted export generation) are untouched; this change writes to `scrape_run`/`planner_scrape_run` the same way `finalizeRun`/retention already do                                                                                                                   |

**Conclusion**: no ADR required. The concurrency-model changes (AC-4/5/6) are a real design
decision, but they hit none of the six trigger categories above — they are reversible (a
constant or a commit, not a schema/infra choice), scoped to one module each, and are
explicitly staging-gated by the proposal itself rather than committed upfront.

## Approach

### AC-1 / AC-2 — expose the in-flight phase

**Schema**: add a nullable `phase` column to both raw-mirror entities, mirroring how `status`
is already modeled (plain `@Column({ type: 'text' })`, not a custom decorator — these tables
are exempt from the "never raw `@Column()`" rule per `docs/POLICIES.md`):

```typescript
// scrape-run.entity.ts
export type ScraperPhase = 'horario' | 'matricula' | 'alumnosYNotas';

@Column({ type: 'text', nullable: true })
phase: ScraperPhase | null;
```

```typescript
// planner-scrape-run.entity.ts
export type PlannerScraperPhase = 'secciones' | 'evaluaciones' | 'notas';

@Column({ type: 'text', nullable: true })
phase: PlannerScraperPhase | null;
```

**`phase` is single-valued and monotonic, not a set of currently-active phases — this is a
deliberate simplification, not an oversight.** If AC-6 ends up pipelining Planner's phases
(see below), more than one phase can genuinely be "in flight" at once. Modeling `phase` as an
array would make it technically precise but would also (a) require the frontend to render a
set instead of a label, when the proposal's own non-goals rule out anything beyond "discrete
phase labels", and (b) leak an implementation detail (how many phases happen to overlap right
now) into a field whose job is just "what should the progress indicator say". Instead,
`phase` always holds **the furthest phase that has started** for the run, updated once per
phase via a repository call. This is correct and stable whether Planner ends up sequential
(AC-6b) or pipelined (AC-6a): sequential mode has exactly one phase active at a time, so
"furthest started" and "currently in flight" coincide; pipelined mode still advances forward
only, so the field always shows the most-advanced phase that has begun, which is also the
most informative single label to show a user watching a progress bar.

**Repository**: one new method per repository, mirrored:

```typescript
async updatePhase(id: string, phase: ScraperPhase): Promise<void> {
  await this.repository.update(id, { phase });
}
```

**Service wiring — Banner** (`ScraperService.execute`), three call sites, one per phase,
right before each phase starts:

```typescript
await this.scrapeRunRepository.updatePhase(runId, 'horario');
const { nrcs, courseByNrc } = await this.scrapeHorario(...);
await this.scrapeRunRepository.updatePhase(runId, 'matricula');
const { codigos, enrollments } = await this.scrapeMatricula(...);
await this.scrapeRunRepository.updatePhase(runId, 'alumnosYNotas');
const limit = await createLimiter(SCRAPE_CONCURRENCY);
await Promise.all([this.scrapeAlumnos(...), this.scrapeNotas(...)]);
```

Three writes per run — satisfies AC-3's "per-stage transition, not per row" by construction.

**Service wiring — Planner**, same shape today (sequential):

```typescript
await this.scrapeRunRepository.updatePhase(runId, 'secciones');
const sectionIds = await this.scrapeSecciones(...);
await this.scrapeRunRepository.updatePhase(runId, 'evaluaciones');
const pairs = await this.scrapeEvaluaciones(...);
await this.scrapeRunRepository.updatePhase(runId, 'notas');
await this.scrapeNotas(...);
```

If AC-6 adopts pipelining, these three calls move from three fixed call sites in `execute()`
to three **once-only** triggers inside the pipeline (see AC-6) — same three writes per run,
just fired at the moment each phase's first item is scheduled instead of after the previous
phase's `Promise.all` fully drains.

**API surface**: `getRun`/`listRuns` on both `ScraperService` and `PlannerScraperService`
include `phase` in their return shape (`ScrapeRunStatus`/`RunSummary` and their Planner
mirrors). Because `docs/POLICIES.md` requires the committed `openapi.json` to be the
frontend's real source of truth, and these two endpoints currently have **no typed
`@ApiResponse`** (`SwaggerScraperGetRun`/`SwaggerScraperList` pass no `responseType`, so the
generated spec is contract-silent about their shape) — this change adds a lightweight response
DTO for each (`ScrapeRunStatusResponseDto`, `RunSummaryResponseDto`, and Planner equivalents)
and wires them into the existing swagger factories via `responseType`. Without this, the whole
"backend contract defined here; frontend consumes it in a paired change" premise the proposal
states in its header would not actually be true — the frontend would have no way to discover
`phase` from the committed spec at all. This is in scope, not an unrelated cleanup: it is the
only way AC-1/AC-2 are satisfied in the sense the proposal actually means ("expose... so the
frontend can show real progress"), not just "present in the runtime JSON".

### AC-3 — phase-tracking adds no measurable overhead

Satisfied by construction (three `UPDATE ... SET phase = $1 WHERE id = $2` statements per run,
by primary key, no different in cost from the existing `finish()` call) rather than by any new
mechanism. Verified with a staging before/after timing comparison — see `runbook.md` — because
"no measurable overhead beyond normal run-to-run variance" is not something a unit test can
establish; it is a wall-clock claim about a real run against real upstream APIs.

### AC-4 — parallelize `scrapeHorario`

Today `scrapeHorario` is a plain sequential `for...of` loop over `departamentos`, one HTTP
call at a time. Convert it to the same bounded-concurrency shape `scrapeMatricula` already
uses one function below it:

```typescript
const HORARIO_CONCURRENCY = 5; // starting point; see AC-7/runbook for the staging-measured value

const limit = await createLimiter(HORARIO_CONCURRENCY);
await Promise.all(
	departamentos.map((departamento) =>
		limit(async () => {
			// identical body to today's loop iteration
		}),
	),
);
```

This is a **mechanical transform with no new concurrency shape to reason about**: the shared
mutable state inside the loop body (`nrcs: Set<string>`, `courseByNrc: Map<string, string>`,
plus `stats.departments.succeeded/failed` and `stats.counts.horario`) is exactly the same kind
of shared-`Set`/array mutation `scrapeMatricula` already does today from inside a `p-limit`
task — synchronous mutations within one task's body are safe under Node's single-threaded
event loop, and this pattern is already proven in this file. `HORARIO_CONCURRENCY = 5` is a
starting value chosen conservatively relative to `MATRICULA_CONCURRENCY = 3` (horario
responses are a department's full class schedule — plausibly larger than one matricula chunk
of 50 NRCs, so a higher-than-3 default is not assumed safe without measurement); the actual
value ships based on the same staging memory check AC-5 uses (see AC-7).

**Correctness** ("fetched horario data for every department matches what the sequential
version produced") cannot be a unit test against a live upstream API — it is verified on
staging by running the same period back-to-back sequential-then-concurrent (or vice versa)
against a **closed/historical academic period**, whose Banner data will not change between the
two runs, and comparing `raw_horario` row counts and `payload_hash` sets per department. See
`runbook.md`.

**Known test-suite consequence, not optional**: `scraper.service.spec.ts` currently keeps
exactly one end-to-end path through `execute()` reachable under Jest — the `'expired'` case,
because a `SessionExpiredError` thrown by the very first `http.get` call inside the (today
synchronous) horario loop short-circuits before `scrapeMatricula`'s `await
createLimiter(...)` — a real `await import('p-limit')` — is ever reached, and that dynamic
import is unusable under this repo's `module: nodenext` ts-jest setup (documented in the spec
file's own comment, and in `planner-scraper.service.spec.ts`'s identical constraint). Once
`scrapeHorario` also calls `createLimiter()`, that one remaining end-to-end path breaks: the
mocked `SessionExpiredError` is never reached because `createLimiter()` itself throws first,
and `finishedStatus()` would observe `'failed'` instead of `'expired'` — a silent, wrong-reason
change to a passing test if left unfixed. Fix in the same task: replace that end-to-end
`'expired'` assertion with the same style Planner's spec already uses for its own
unreachable-past-phase-0 cases — verify the `SessionExpiredError → 'expired'` classification
via a targeted test on `execute()`'s catch branch (or on `finalizeRun`, mirroring the
`'completed'`/`'partial'` pattern already in this file) rather than a full `run()` →
`execute()` chain. After this change, Banner's spec file converges on the same
"`finalizeRun`/predicate-level coverage, not end-to-end" shape Planner's spec already
documents as an accepted gap — not a regression specific to this change, just Banner catching
up to a constraint Planner already lives with.

### AC-5 — investigate `MATRICULA_CONCURRENCY`

No code changes are designed upfront here beyond making the constant easy to bump: this is a
staging measurement, not an implementation. Procedure (see `runbook.md`): run a full Banner
scrape at `MATRICULA_CONCURRENCY = 3` (baseline), then at one or two higher values (e.g. 6,
10), same period, watching `docker stats sys_acc_back` (or the equivalent) throughout each
run. Adopt the highest value that stays comfortably under the 640MB `mem_limit` with no
increase in Banner-side errors/throttling in `stats.errors`; otherwise leave it at 3 and record
the finding in this task's tasks.md retro, per AC-5(b).

### AC-6 — investigate Planner phase overlap

**The dependency, confirmed by reading `scrapeSecciones`/`scrapeEvaluaciones`/`scrapeNotas`,
is per-item, not per-phase**: `scrapeEvaluaciones` needs only a single `sectionId` to call
`/api/class-api/evaluations/structure` — not the full set of sections from every course.
`scrapeNotas` needs only a single `(evalComponentId, sectionId)` pair — not the full set of
evaluation components from every section. Nothing in either function reads or waits on
anything belonging to a _different_ course's or section's results. The current "wait for
literally every course's `scrapeSecciones` call to finish before starting any
`scrapeEvaluaciones`" barrier is stricter than the real dependency requires — it is a barrier
between _loops_, not a barrier the _data_ imposes.

**Design**: replace the three `Promise.all` barriers with one pipeline where each course's
completed `scrapeSecciones` call immediately schedules `scrapeEvaluaciones` for the section IDs
it just produced, and each section's completed `scrapeEvaluaciones` call immediately schedules
`scrapeNotas` for the pairs it just produced — all three phases' existing `p-limit` limiters
(`SECCION_CONCURRENCY`/`EVALUACION_CONCURRENCY`/`NOTA_CONCURRENCY`, unchanged at 20 each) stay
in place and simply become concurrently active instead of strictly sequenced:

```typescript
const seenSections = new Set<string>();
const seenPairs = new Set<string>();
let evaluacionesStarted = false;
let notasStarted = false;

const scheduleNota = (pair: EvalPair) => {
	const key = `${pair.sectionId}|${pair.evalComponentId}`;
	if (seenPairs.has(key)) return Promise.resolve();
	seenPairs.add(key);
	if (!notasStarted) {
		notasStarted = true;
		void this.scrapeRunRepository.updatePhase(runId, 'notas');
	}
	return notaLimit(() => fetchAndInsertNota(pair));
};

const scheduleEvaluacion = (sectionId: string) => {
	if (seenSections.has(sectionId)) return Promise.resolve();
	seenSections.add(sectionId);
	if (!evaluacionesStarted) {
		evaluacionesStarted = true;
		void this.scrapeRunRepository.updatePhase(runId, 'evaluaciones');
	}
	return evaluacionLimit(() =>
		fetchAndInsertEvaluacion(sectionId).then((pairs) => Promise.all(pairs.map(scheduleNota))),
	);
};

await this.scrapeRunRepository.updatePhase(runId, 'secciones');
await Promise.all(
	cursos.map((curso) =>
		seccionLimit(() =>
			fetchAndInsertSeccion(curso).then((sectionIds) =>
				Promise.all(sectionIds.map(scheduleEvaluacion)),
			),
		),
	),
);
```

Awaiting only the top-level `cursos.map(...)` tasks is sufficient — each task's promise chains
forward through its own spawned `scheduleEvaluacion`/`scheduleNota` calls via `.then`, so
`Promise.all` over the course-level tasks transitively waits for the whole pipeline to drain.
The `seenSections`/`seenPairs` dedup sets replace the current post-hoc `Set` dedup (today built
after all sections are known); checking-then-adding synchronously before any `await` inside
each scheduling function keeps this race-free under Node's single-threaded model, same
reasoning as AC-4.

**Risk this design introduces, to be confirmed on staging (folds into AC-7)**: today at most
one phase's limiter is active at a time, so peak concurrent in-flight Planner requests is 20.
Pipelined, all three limiters can be active simultaneously, so peak concurrent in-flight
requests can reach up to 60 (20+20+20) instead of 20 — three times the in-flight HTTP
response buffers held in memory at once. This is the actual, previously-hidden cost of
"overlapping" the phases, and it is exactly what AC-7's memory check must catch before this
is adopted. If staging shows memory pressure, the documented fallback is a fourth, outer
`p-limit` wrapping all three inner limiters as a combined ceiling (e.g. total in-flight ≤ 20
regardless of which phase each in-flight request belongs to) rather than reverting to fully
sequential — but only implement that fallback if the plain three-limiter version actually
shows pressure; don't pre-build unneeded complexity.

**AC-6(b) fallback**: if staging shows this either breaks correctness (unlikely given the
dependency analysis above, but staging is real upstream data, not this analysis) or the memory
risk above doesn't resolve within the 640MB cap even with the outer limiter, revert to today's
three sequential `Promise.all` barriers and document the staging finding in tasks.md — per the
proposal, dropped, not forced.

### AC-7 — memory stays within the 640MB cap

Not a code change; the gating check for AC-4/5/6 above. `runbook.md` specifies watching
`sys_acc_back`'s container memory (`docker stats`, or `docker inspect` cgroup counters) for
the full duration of each staging run in each configuration, not just at a snapshot — a
transient spike mid-run that recovers is still evidence of headroom being used, and matters
more than a resting figure.

## Backend

- **Module**: `src/modules/admin/banner/scraper/` and `src/modules/admin/planner/scraper/`
  (existing; extended, not replaced). No new module.
- **Entities**: `ScrapeRunEntity`/`PlannerScrapeRunEntity` gain `phase` (nullable text,
  `ScraperPhase`/`PlannerScraperPhase` union types) — raw-mirror entities, plain `@Column()`
  per the documented exemption.
- **Migration**: single new migration in `src/database/migrations-raw/`, created via
  `pnpm migration:raw:create src/database/migrations-raw/add-phase-to-scrape-runs` (the CLI
  stamps the timestamp; both tables live on the same physical `scrape_pg` database and the
  same migration folder, so one migration covers both, not two). `up()` adds `phase TEXT` plus
  a `CK_scrape_run_phase` / `CK_planner_scrape_run_phase` CHECK constraint against the fixed
  value set, matching the existing `CK_scrape_run_status` style; `down()` drops the constraints
  then the columns.
- **Repository additions**: `ScrapeRunRepository.updatePhase(id, phase)`,
  `PlannerScrapeRunRepository.updatePhase(id, phase)`.
- **Service changes**: `ScraperService.execute` (3 `updatePhase` call sites) and
  `PlannerScraperService.execute`/`scrapeSecciones`/`scrapeEvaluaciones`/`scrapeNotas` (pipeline
  restructure per AC-6, 3 once-only `updatePhase` triggers); `ScraperService.scrapeHorario`
  parallelized per AC-4; `MATRICULA_CONCURRENCY` constant possibly changed per AC-5's staging
  finding.
- **DTOs**: new `ScrapeRunStatusResponseDto`, `RunSummaryResponseDto` (Banner) and their
  Planner equivalents in each module's `model/*.dtos.ts`, wired via `responseType` into
  `SwaggerScraperGetRun`/`SwaggerScraperList` and the Planner equivalents — see AC-1/2 above
  for why this is in scope.
- **Endpoints**: no new routes. Existing `GET banner/scrape/:runId`, `GET banner/scrape`,
  `GET planner/scrape/:runId`, `GET planner/scrape` responses gain `phase`.
- **i18n keys**: none new — no new error paths are introduced by this change.
- **Validation**: none new — `phase` is server-computed, never client-supplied, so there is no
  DTO input to validate.
- **`openapi.json`**: regenerated in the same PR (`pnpm openapi:export`), mandatory per
  `docs/POLICIES.md` given the response-shape change.

## Cross-repo mode

- **Mode**: sequential — same pattern the proposal itself names
  (`scrape-retention-and-cached-exports`). This backend PR merges and reaches `staging` before
  any frontend change lands; the frontend cannot build a progress UI against a `phase` field
  that doesn't exist in the committed spec yet.
- **Contract**: this repo's committed `openapi.json`, regenerated in the same PR.
- **Ordering**: `FRONT-ACREDITACION-3.0` is not checked out in this environment. Whoever picks
  up the frontend side opens `openspec/changes/scrape-progress-and-performance/` there (same
  slug), copies this repo's `proposal.md`, and designs against the regenerated `openapi.json`
  once this PR is on `staging`.

## Testing strategy

| AC  | Covered by                                                                                                                                                                    | Kind                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | `ScrapeRunRepository.spec.ts` (`updatePhase`), `ScraperService.spec.ts` (phase call-site ordering via `finalizeRun`-style direct/predicate tests), controller/DTO shape check | unit                         |
| 2   | `PlannerScrapeRunRepository.spec.ts`, `PlannerScraperService.spec.ts` (same pattern)                                                                                          | unit                         |
| 3   | Staging timing, same period before/after                                                                                                                                      | manual — `runbook.md`        |
| 4   | `ScraperService.spec.ts` (concurrent-department task isolation: one department fails, others still process and insert), staging correctness diff on a closed period           | unit + manual — `runbook.md` |
| 5   | Staging timing + memory at 3 vs. elevated value(s)                                                                                                                            | manual — `runbook.md`        |
| 6   | `PlannerScraperService.spec.ts` (dedup: a section reachable from two courses is fetched once; phase fires once per phase even when pipelined), staging correctness + timing   | unit + manual — `runbook.md` |
| 7   | `docker stats`/cgroup memory watched through every staging run above                                                                                                          | manual — `runbook.md`        |

## Risks

| Risk                                                                                                                                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raising `MATRICULA_CONCURRENCY`, adding `HORARIO_CONCURRENCY`, or pipelining Planner's phases could exceed `sys_acc_back`'s 640MB cap and OOM-kill mid-scrape.                                                                                                                | AC-7 requires a staging measurement before adopting any of AC-4/5/6; each is dropped, not forced, if memory risk shows up. Pipelining specifically adds an outer-limiter fallback (see AC-6).                                                                                                                         |
| Pipelining triples Planner's peak concurrent in-flight requests (20 → up to 60) versus today's strictly-phased 20 — a cost the "just remove the barrier" framing doesn't surface on its own.                                                                                  | Called out explicitly in AC-6/AC-7; the outer-limiter fallback bounds total in-flight requests if the plain three-limiter version shows pressure.                                                                                                                                                                     |
| Parallelizing `scrapeHorario` breaks `scraper.service.spec.ts`'s one remaining end-to-end `execute()` path (the `'expired'` case) by making `createLimiter()` reachable — and, under this repo's ts-jest/`nodenext` setup, unusable — before the mocked error is ever thrown. | Fixed in the same task as AC-4 (see AC-4 above): the `'expired'` assertion moves to the same `finalizeRun`/predicate-level pattern Planner's spec already uses for its own unreachable-past-first-await cases. Not optional cleanup — the test would otherwise silently assert the wrong status for the wrong reason. |
| A mid-run Banner 401 already triggers an expensive re-auth (headless browser + SSO redirect) that could dominate wall-clock time in the unlucky case.                                                                                                                         | Out of scope here, per the proposal's own non-goals — documented, not fixed.                                                                                                                                                                                                                                          |
| `.claude/server-specs.md` (the source of the 640MB constraint) is local-only and gitignored, per the proposal's Dependencies section.                                                                                                                                         | This design captures the concrete number and its source (the `sys_acc_back` container's `mem_limit: 640m`) directly in `docs/CONTEXT.md` in this PR — see Docs below — so the constraint survives without that file.                                                                                                  |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Database or § Business Rules — document the `sys_acc_back` 640MB
      container memory ceiling as the binding constraint for scraper concurrency tuning, so it
      is discoverable without `.claude/server-specs.md` (local-only, not available to other
      developers or CI, per the proposal's own Dependencies section)
- [ ] `docs/CONTEXT.md` § Business Rules — short entry for "scrape runs expose an in-flight
      `phase` alongside `status`, monotonic and single-valued even when the underlying work is
      pipelined" once implemented, following the section's existing style
- [ ] `openapi.json` — regenerate via `pnpm openapi:export` (mandatory per `docs/POLICIES.md`,
      not optional documentation)
