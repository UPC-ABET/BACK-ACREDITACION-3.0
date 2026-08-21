# Runbook — Granular Scrape Progress States and Scraper Performance

**Slug**: `scrape-progress-and-performance`

This change's acceptance criteria are unusually manual-heavy: AC-3, AC-5, AC-6 and AC-7 are
explicitly staging-measured, not unit-testable — they are claims about real wall-clock time
and real container memory against real upstream APIs. This runbook is where those
measurements are performed and recorded.

## ⚠️ Deploy prerequisite

```bash
pnpm migration:raw:run
```

Runs the `phase`-column migration against the raw datasource (`scrape_pg`, per
`.claude/server-specs.md`). No main-datasource migration is involved. No seed changes.

## Manual validation

Use a **closed/historical academic period** for every comparison run below, not the current
open period — its Banner/Planner data will not shift between the "before" and "after" run,
which a currently-open period's data could, muddying the comparison. Pick one with a
realistic department/course count so the timing numbers are representative.

| #   | Step                                                                                                                                                                                                                                  | Expected                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | On staging, run a Banner scrape on the pre-change build (before Milestone 1) for the chosen closed period; record wall-clock time and `stats.counts`.                                                                                 | Baseline established.                                                                                                                                                   |
| 2   | Run the same period on this branch after Milestone 1/2 (phase-tracking only, no concurrency change yet).                                                                                                                              | **AC-3**: wall-clock time within normal run-to-run variance of step 1 — phase-tracking's 3 writes/run add no measurable overhead.                                       |
| 3   | Run the same period after Milestone 3 (`scrapeHorario` parallelized).                                                                                                                                                                 | **AC-4**: horario stage wall-clock improves over step 1/2's horario stage. `raw_horario` row counts and `payload_hash` sets per department match step 1/2 exactly.      |
| 4   | Watch `sys_acc_back` container memory (`docker stats sys_acc_back`, or the cgroup memory counter directly) throughout steps 2 and 3, not just at the end.                                                                             | **AC-7 (partial)**: stays comfortably under 640MB for the whole run, not just at rest.                                                                                  |
| 5   | Run the same period at `MATRICULA_CONCURRENCY = 3` (baseline, already covered by step 1/2/3), then re-run at one or two higher values (e.g. 6, 10), same period, watching memory throughout each.                                     | **AC-5**: the highest value that stays under the 640MB cap with no new entries in `stats.errors` is the adoption candidate; if none clears the bar, keep 3.             |
| 6   | Run the same period on the pre-Milestone-5 Planner build (sequential three phases); record wall-clock and per-phase timing if available.                                                                                              | Baseline established.                                                                                                                                                   |
| 7   | Run the same period on the Milestone 5 branch (pipelined). Compare `raw_planner_seccion`/`raw_planner_evaluacion`/`raw_planner_nota` row counts and `payload_hash` sets against step 6 — must match exactly.                          | **AC-6**: correctness holds; if it doesn't, stop and treat as a design-assumption bug, not a tuning miss.                                                               |
| 8   | Watch `sys_acc_back` memory throughout step 7, comparing peak against step 6's peak.                                                                                                                                                  | **AC-7 (Planner)**: stays under 640MB. If not, try the outer-limiter fallback (`design.md` § AC-6) and repeat step 7/8 once before falling back to AC-6(b).             |
| 9   | Confirm `GET banner/scrape/:runId` and `GET planner/scrape/:runId` return `phase` while a run is `'running'`, advancing through the expected label sequence as a real scrape progresses (poll every few seconds during step 2's run). | Response includes `phase`, matching `docs/adr` naming (`horario`/`matricula`/`alumnosYNotas`; `secciones`/`evaluaciones`/`notas`), never regresses to an earlier phase. |

## Data validation

```sql
-- Run against the raw datasource (scrape_pg). Confirms the phase constraint is live and
-- no in-flight run is stuck showing a stale phase after completion — expected: 0 rows for
-- any run whose status is terminal but phase is still 'running'-shaped (phase itself has no
-- terminal concept, this just checks the column exists and constraint holds on real data).
SELECT id, status, phase FROM scrape_run ORDER BY started_at DESC LIMIT 5;
SELECT id, status, phase FROM planner_scrape_run ORDER BY started_at DESC LIMIT 5;

-- expected: 0 rows — the CHECK constraint should make this impossible, this just confirms it
SELECT id, phase FROM scrape_run WHERE phase IS NOT NULL AND phase NOT IN ('horario', 'matricula', 'alumnosYNotas');
SELECT id, phase FROM planner_scrape_run WHERE phase IS NOT NULL AND phase NOT IN ('secciones', 'evaluaciones', 'notas');
```

## Symptom → diagnosis

| Symptom                                                                                  | Likely cause                                                                                                                                                          | Check                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sys_acc_back` container OOM-kills mid-scrape after this change ships                    | An adopted concurrency value (Milestone 3/4/5) is too high for real production load, even though staging looked fine                                                  | `docker logs sys_acc_back` for an OOM message; compare production department/course counts against the staging run's — production may simply be larger                        |
| `phase` never advances past `'horario'`/`'secciones'` on a run that eventually completes | The `updatePhase` call site was missed on a code path, or the run took an error branch before the second phase started                                                | Check `stats.errors`/`departments.failed` on the finished run — a fully-failed first phase never reaches the second `updatePhase` call, which is correct, not a bug           |
| Planner scrape wall-clock got _worse_ after Milestone 5, not better                      | Pipelining increased contention against Planner's own upstream (three limiters hitting it concurrently instead of one at a time) rather than saturating idle capacity | Re-run step 7 in isolation (no other concurrent load) before concluding; if still worse, this is exactly what AC-6(b)'s "confirmed necessary, left unchanged" fallback is for |

## How to revert

```bash
pnpm migration:raw:revert   # drops the phase columns/constraints
```

Code-level: revert the relevant milestone's commit(s). Milestones are independent enough that
Milestone 3 (horario concurrency) or Milestone 5 (Planner pipelining) can each be reverted on
their own without touching Milestone 1/2's phase-tracking columns, since `phase` stays valid
and simply advances less finely if a concurrency change is rolled back.

## Do NOT

- Don't run the AC-4/AC-5/AC-6 staging comparisons against the **currently open** academic
  period — its Banner/Planner data can change between the "before" and "after" run, and a
  correctness mismatch caused by real data drift will look identical to a correctness bug in
  the code.
- Don't adopt a higher `MATRICULA_CONCURRENCY` or the Planner pipeline based on a single
  staging run — re-run at least once; a single run's memory headroom can be misleading if
  something else on the box happened to be idle at that moment.
- Don't skip watching memory _throughout_ a run in favor of checking it once at the end — a
  mid-run spike that recovers before the run finishes is still real evidence against the
  640MB cap.
