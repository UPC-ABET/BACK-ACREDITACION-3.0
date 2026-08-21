# Granular Scrape Progress States and Scraper Performance

**Slug**: `scrape-progress-and-performance`
**Branch**: `feat/scrape-progress-and-performance`
**Repos affected**: both (backend contract defined here; frontend consumes it in a paired change)
**Created**: 2026-08-20

## Problem

Today, Banner and Planner scrape runs only ever expose a coarse `status`
(`'running'|'completed'|'partial'|'failed'|'expired'`, on `scrape_run.status` /
`planner_scrape_run.status`). While a run is `'running'`, the frontend has no way to show
_what_ is currently happening — whether Banner is fetching horarios, matrículas, or
alumnos/notas, or whether Planner is on secciones, evaluaciones, or notas. A user watching a
scrape sees a spinner for however many minutes the run takes, with no sense of progress or
whether it's stuck.

Separately, actual wall-clock time has real, previously-unexamined room to improve. Banner's
`scrapeHorario` stage loops over departments with **zero concurrency** — a plain sequential
loop — even though departments are independent and every other stage in both scrapers already
uses some form of bounded concurrency. It's also unclear whether Banner's
`MATRICULA_CONCURRENCY = 3` (conspicuously low next to `SCRAPE_CONCURRENCY = 80` used two
stages later against the same Banner API) or Planner's fully sequential three-phase pipeline
(`secciones` → `evaluaciones` → `notas`, each phase waiting for the previous to fully finish)
are load-bearing constraints nobody documented, or just cautious defaults nobody has
revisited since they were first set.

## What already exists

**Banner** (`src/modules/admin/banner/scraper/api/scraper.service.ts`, `execute()`):

- `scrapeHorario` — plain sequential `for...of` loop over departments, one HTTP call at a
  time, **no concurrency limiter at all**.
- `scrapeMatricula` — chunks NRCs (`NRC_CHUNK_SIZE = 50`) through a `p-limit` limiter at
  `MATRICULA_CONCURRENCY = 3`.
- `scrapeAlumnos` / `scrapeNotas` — run **concurrently with each other**, sharing one
  `p-limit(SCRAPE_CONCURRENCY = 80)` limiter, each itself a `Promise.all` over all
  codes/pairs through that shared limiter.
- Inserts: `bulkInsert` per raw repository; alumnos/notas share an in-file `InsertBuffer`
  (batch size 500) across concurrent workers, flushing without blocking sibling workers —
  writes already overlap with fetching, not a bottleneck.
- Retry/backoff (`BannerHttpClient`): `MAX_5XX_RETRIES = 3`, exponential
  `500ms * 2^attempt` on 5xx only; not excessive (worst case ~3.5s on a genuinely unhealthy
  upstream).
- Auth: token cached in-memory for the whole run (`BannerTokenService`), reused across
  requests — cheap in the common case. A mid-run 401 forces a real re-auth (headless
  Chromium + full SSO redirect, up to `MAX_REFRESH_ATTEMPTS = 6` × `TOKEN_WAIT_MS = 30s`),
  which could dominate wall-clock time in the unlucky case, but this is rare (token expiry
  mid-run, not per-request).
- Prior tuning: commit `728ca43f` ("enhance scraper service with concurrent processing and
  insert buffer for alumnos and notas") shows concurrency/buffering was already a deliberate
  optimization pass — the current numbers aren't naive defaults, at least for the stages it
  touched.

**Planner** (`src/modules/admin/planner/scraper/api/planner-scraper.service.ts`, `execute()`):

- Three phases (`scrapeSecciones`, `scrapeEvaluaciones`, `scrapeNotas`), each internally a
  `Promise.all` through its own `p-limit` limiter (`SECCION_CONCURRENCY = 20`,
  `EVALUACION_CONCURRENCY = 20`, `NOTA_CONCURRENCY = 20`) — but the three phases run
  **strictly one after the other**; evaluaciones cannot start until every section across
  every course has finished, even though many of those fetches are per-section independent.
- Auth: plain HTTP API (login POST + token exchange, no browser — commits `3af260b8`/
  `2f94d3a1` deliberately replaced an earlier browser-based login specifically to avoid that
  cost). Session single-flighted and cached (`PlannerTokenService.ensureSession`), reused for
  the whole run, not re-fetched per request — already well-optimized, no easy win found here.

**Server headroom** (`.claude/server-specs.md`, local-only, gitignored, not committed — see
Dependencies): the whole box is 2 vCPU / 1.9GB RAM, ~650MB available at idle. The binding
constraint for scraping specifically is **`sys_acc_back`'s own container memory limit,
`mem_limit: 640m`** — this is where the scraper process itself runs, so raising concurrency
increases in-flight HTTP response buffers and JSON parsing inside that 640MB ceiling. CPU
count is not the limiting factor; memory is. Per prior discussion, this server is temporary
and expected to be replaced within 1–2 months — this change should fit inside the _current_
640MB ceiling, not assume it will be raised.

No existing "phase"/"sub-status" field exists on `scrape_run` or `planner_scrape_run` — only
the terminal `status` enum.

## Goals

- Expose the scraper's actual in-flight stage (Banner: horario / matrícula / alumnos-and-notas;
  Planner: secciones / evaluaciones / notas) alongside the existing terminal `status`, so the
  frontend can show real progress instead of a generic "running" state.
- Parallelize Banner's `scrapeHorario` department loop (the one identified zero-risk win —
  departments are independent, no other stage is this naive).
- Investigate, with a staging-measured before/after, whether `MATRICULA_CONCURRENCY` can
  safely go above 3 without breaching `sys_acc_back`'s 640MB cap or increasing Banner-side
  errors/throttling.
- Investigate, after first confirming the actual data dependency between Planner's three
  phases, whether any of them can safely overlap instead of running strictly sequentially.
- Document what was tried and what happened for both investigated levers — adopt only what a
  staging measurement confirms is safe; explicitly drop (not force) anything that isn't.

## Non-goals

- Not increasing available memory/CPU on the current server — it is temporary and any speed
  win must fit inside the existing ~640MB `sys_acc_back` cap.
- Not building a progress-bar/percentage UI — only discrete phase labels for the frontend to
  render; the frontend implementation itself is a paired change, same cross-repo pattern as
  `scrape-retention-and-cached-exports`.
- Not touching Banner's browser-based 2FA/login flow or Planner's token/session handling —
  both already reasonably optimized; the mid-run-401 re-auth cost is flagged as a risk, not
  committed to a fix here.
- Not touching retry/backoff tuning — investigation found the current values are not
  excessive.
- Not touching the DB write/insert-buffer pattern — investigation found writes already batch
  and overlap with fetching.
- Not guaranteeing a specific percentage speedup. `MATRICULA_CONCURRENCY` and Planner
  phase-overlap are attempted only if a staging measurement shows they're safe; either is
  dropped, not forced, if it risks memory or correctness.

## Acceptance criteria

1. **AC-1** — Given a Banner scrape run is in progress, when a caller checks its current
   state, then the response includes which of horario / matrícula / alumnos-and-notas is
   currently in flight (not just the generic `'running'` status), updating in order as the
   run progresses.
2. **AC-2** — Given a Planner scrape run is in progress, when a caller checks its current
   state, then the response includes which of secciones / evaluaciones / notas is currently
   in flight, updating in order as the run progresses.
3. **AC-3** — Given phase-tracking is added, when a full Banner or Planner run is timed on
   staging before and after this change (same department/period, no other concurrent load),
   then the added phase-tracking writes do not measurably increase total wall-clock time
   beyond normal run-to-run variance (writes happen once per stage transition, not per row).
4. **AC-4** — Given `scrapeHorario`'s department loop currently has no concurrency, when it
   is parallelized behind an explicit bounded limiter, then a staging timing comparison shows
   a wall-clock improvement for that stage, and the fetched horario data for every department
   matches what the sequential version produced.
5. **AC-5** — Given `MATRICULA_CONCURRENCY = 3` today, when a higher value is measured on
   staging, then either (a) it's confirmed safe — no `sys_acc_back` memory-cap breach, no
   increase in Banner-side errors — and adopted, or (b) it stays at 3 with the staging finding
   documented as the reason.
6. **AC-6** — Given Planner's three phases run strictly sequentially today, when the actual
   data dependency between secciones/evaluaciones/notas is confirmed, then either (a) phases
   are pipelined where genuinely independent and a staging comparison shows improvement with
   correct output, or (b) sequential execution is confirmed necessary and left unchanged, with
   the reasoning documented.
7. **AC-7** — Given any concurrency change from AC-4/5/6 ships, when a full scrape run
   executes on staging, then `sys_acc_back`'s memory usage stays within its existing 640MB
   container limit throughout.

### Traceability

| AC  | Criterion                                                             | Satisfied by                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Banner phase exposed alongside status                                 | `ScrapeRunEntity.phase`, `ScraperService.execute`/`getRun`/`listRuns`, `ScrapeRunStatusResponseDto`/`RunSummaryResponseDto`                                                                                                                                                                                                    |
| 2   | Planner phase exposed alongside status                                | `PlannerScrapeRunEntity.phase`, `PlannerScraperService.execute`/`getRun`/`listRuns`, `PlannerScrapeRunStatusResponseDto`/`PlannerRunSummaryResponseDto`                                                                                                                                                                        |
| 3   | Phase-tracking adds no measurable overhead                            | By construction (3 writes/run); staging timing still open — Task 3.2/`runbook.md`                                                                                                                                                                                                                                              |
| 4   | scrapeHorario parallelized, verified correct                          | `ScraperService.scrapeHorario` (`HORARIO_CONCURRENCY`), regression test in `scraper.service.spec.ts`; staging correctness diff still open — Task 3.2                                                                                                                                                                           |
| 5   | MATRICULA_CONCURRENCY raised or confirmed-kept, measured              | Not yet measured — staging-blocked, Task 4.1/`runbook.md`                                                                                                                                                                                                                                                                      |
| 6   | Planner phase dependency confirmed, pipelined or confirmed-sequential | Confirmed per-item (not per-phase) in `design.md` § AC-6; pipelined in `PlannerScraperService.execute` (`scheduleEvaluacion`/`scheduleNota`, `AbortState`); memory/timing verified against a real production run (peak 57.4% of cap, 0 errors) — Task 5.2. No sequential-build correctness diff was run (see Task 5.2's retro) |
| 7   | Memory stays within sys_acc_back's 640MB cap                          | Confirmed for Planner's pipeline via production run `8fdeb69c...` (peak 367.7MiB/640MB) — Task 5.2. Still not measured for Banner's `HORARIO_CONCURRENCY`/`MATRICULA_CONCURRENCY` — staging-blocked, Tasks 3.2/4.1/`runbook.md`                                                                                                |

## Dependencies

- `ScraperService` / `PlannerScraperService`, `BannerHttpClient` / `PlannerHttpClient`,
  their `p-limit` usage and `InsertBuffer`.
- `scrape_run` / `planner_scrape_run` entities on the `raw` / `planner-raw` datasource
  connections — a new phase column needs a **raw-datasource migration**
  (`migration:raw:*` scripts per `docs/CONTEXT.md`), distinct from the main-datasource
  migration used by `scrape-retention-and-cached-exports`.
- `.claude/server-specs.md` — local-only, gitignored, **not committed and not available to
  other developers or CI**. The 640MB memory-ceiling constraint this proposal relies on
  should be captured properly (e.g. in `docs/CONTEXT.md` or `design.md`) rather than assumed
  available from that local file going forward.
- Staging environment access for every timing/memory measurement (AC-3 through AC-7).
- Frontend (`FRONT-ACREDITACION-3.0`) — needs a paired change to render the new phase field;
  not checked out in this environment, same as the sibling change.

## Risks

| Risk                                                                                                                                                                                          | Impact                    | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raising `MATRICULA_CONCURRENCY` or pipelining Planner's phases could exceed `sys_acc_back`'s 640MB cap, causing an OOM kill mid-scrape — worse than today's slower-but-stable behavior.       | High if unmeasured        | AC-5/6/7 require a staging measurement before adopting either change; both are dropped, not forced, if memory or correctness risk shows up.           |
| Planner's phase sequencing might encode a real data dependency (e.g. evaluaciones needs the full seccion set to exist first) that isn't obvious from the concurrency code alone.              | High if assumed away      | AC-6 requires confirming the actual dependency before attempting to pipeline — not just measuring speed and hoping correctness holds.                 |
| A mid-run Banner 401 already triggers an expensive re-auth (headless browser + SSO redirect, potentially tens of seconds to minutes) that could dominate wall-clock time in the unlucky case. | Medium, out of scope here | Documented as a known risk, not committed to a fix in this change; candidate for its own future change if it turns out to happen often in production. |
| Adding phase-tracking writes to the scrape hot path, even individually cheap, could add up if implemented naively (e.g. per-row instead of per-stage-transition).                             | Low                       | AC-3 explicitly requires per-stage-transition writes only (a handful per run).                                                                        |

## Open questions

None — scope was resolved with the requester before writing this proposal: pursue both the
proven `scrapeHorario` fix and the two riskier, staging-gated levers (`MATRICULA_CONCURRENCY`,
Planner phase overlap), dropping either if staging measurement shows risk rather than forcing
them through.

---

### Scope extension — production observations from the first live Banner run (2026-08-21)

With no separate staging environment (only production actually runs — see Dependencies), the
first real Banner scrape run on the deployed change surfaced two things worth fixing, both
small and directly evidenced by that run's own data rather than speculation:

1. **`phase` never resets on completion.** A finished run (`status: 'completed'`) still showed
   `phase: 'alumnosYNotas'` indefinitely — the field was designed to mean "furthest phase
   reached," which is accurate but reads as "still fetching students and grades" to anyone not
   already reading `status` first. Confusing enough in practice to fix immediately rather than
   leave for the frontend pairing to work around.
2. **`SCRAPE_CONCURRENCY = 80`'s real headroom.** The completed run (16/16 departments, 0
   errors, 27m51s, peak memory ~367.6MiB/640MB — comfortably under the cap) showed the
   `alumnosYNotas` phase (shared by `scrapeAlumnos`/`scrapeNotas`) dominating wall-clock time
   (~25 of ~28 minutes), while the observed Banner-side 5xx rate was negligible: 18 errors
   across ~72k requests, all successfully retried, clustered in one one-second burst rather than
   sustained. That specific pattern — synchronized retries on a shared fixed backoff — is a
   known amplifier of exactly this kind of burst, and is worth fixing regardless of whether
   concurrency changes.

**AC-8** — Given a scrape run reaches a terminal status (`completed`/`partial`/`failed`/
`expired`), when `finish()` persists that status, then `phase` is cleared to `null` in the same
write — mirroring how `finishedAt` is only ever null while a run is in progress.

**AC-9** — Given `BannerHttpClient`'s retry logic, when a request receives a 429 or 5xx
response, then the retry backoff uses randomized ("full") jitter bounded by an exponential
ceiling rather than a fixed exponential delay, a 429 with a `Retry-After` header is honored
(clamped to the same backoff ceiling) in preference to the jittered guess, and
`SCRAPE_CONCURRENCY` is raised from 80 to 120 — a moderate bump, not the full doubling
originally discussed, pending a second production run's error-rate and memory measurement
before considering a further increase.

#### Traceability (scope extension)

| AC  | Criterion                                                                   | Satisfied by                                                                                                     |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 8   | `phase` clears to `null` on terminal status                                 | `ScrapeRunRepository.finish`, `PlannerScrapeRunRepository.finish`                                                |
| 9   | Jittered/429-aware Banner retry backoff; `SCRAPE_CONCURRENCY` raised to 120 | `BannerHttpClient` (`jitteredBackoff`, `retryAfterMs`, `isRetryableStatus`), `ScraperService.SCRAPE_CONCURRENCY` |

**Not yet measured**: AC-9's `SCRAPE_CONCURRENCY = 120` value itself is not staging-validated
(same constraint as AC-5/AC-7 above) — it is a reasoned, moderate bump based on the first run's
data, not a confirmed-safe value. A follow-up production run should confirm memory stays under
the 640MB cap and the Banner-side error rate does not increase before considering raising it
further.
