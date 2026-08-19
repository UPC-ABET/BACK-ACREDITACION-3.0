# Runbook — IFC status history endpoint

**Slug**: `ifc-status-history`

No migration, no seed, no deploy-time step. This exists only for the manual check the unit
tests cannot cover: they exercise `IfcStatusHistoryService` against a **faked** `DataSource`
that returns programmed rows, so the actual recursive `chain_up` SQL never runs against a
real org chart in CI. `assertHasHigherLevel` is production-proven (already gates
`approve`/`reject`), and this endpoint now runs it exactly the same way — inside a
transaction obtained from `IfcRepository.transaction(...)` — so this is lower risk than the
first draft (which briefly used a since-removed `queryRunner()` accessor), but still worth
one real check before merge since the endpoint itself is new.

## Manual verification

Against a local backend with real seed data (`docs/CONTEXT.md` § Environment for DB setup),
pick one IFC that has at least two status changes (e.g. `SUBMITTED` then `OBSERVED` with a
comment), and its course chart's chain (course → area/subarea → programme → school).

1. **As the course's own coordinator** — call `GET /ifcs/:id/status-history` with a valid
   token for that coordinator and the right `X-School-Id`. Expect `403`
   (`error.ifc.statusHistoryFailed` / `error.ifc.higherLevelRequired`). The coordinator is
   depth 1 in the chain, not `> 1`, so they must **not** see their own IFC's history through
   this endpoint (they see the current status through the existing IFC view instead).
2. **As a staff member one level above the coordinator** (e.g. the area/programme node) —
   same call. Expect `200`, with all recorded status changes, newest first, each entry's
   `by` matching the staff who made that change and `comment` populated on the `OBSERVED`
   entry.
3. **As a staff member unrelated to this course's chain entirely** — expect `403`.
4. **As an administrator** with no chart position in this course's chain at all — expect
   `200`, confirming the bypass works independently of chain membership.
5. **With an IFC id from a different school** (or a nonexistent id) — expect `404`.

If step 1 or 3 returns `200`, or step 2 or 4 returns `403`, stop and re-check the
`chain_up` depth logic before merging — this endpoint exists specifically to keep
rejection comments and reviewer identities scoped to the people above the coordinator, so a
false `200` here is an information-disclosure bug, not a cosmetic one.

Note: as of the audit-fix commit, any requester with **no** `organization.staff` row at
all (admin or not) gets `403 error.ifc.staffRequired` before the chain check even runs —
consistent with every other IFC transition op in this module. This doesn't affect steps
1-5 above (all assume a real staff member or a real admin account), just worth knowing if
a test account turns out to have no staff record.
