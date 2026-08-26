# Runbook — Reset chart node users' password to default, scoped by entity type

**Slug**: `chart-password-reset`

No migration, no seed sync, no schema change. This runbook exists because the one thing no
automated test can confirm is that a reset user can actually log back in — everything else
is unit/repository-tested (see `design.md` § Testing strategy).

## ⚠️ Deploy prerequisite

None. No migration to run, no permission/seed sync needed —
`PERMISSION_MODULES.ADMIN` / `PERMISSION_ACTIONS.POST` is the same gate already seeded for
`chart-heads`'s `configure` endpoint (changed from `ORGANIZATION` during audit — see
`tasks.md` R1.1).

## Manual validation

| #   | Step                                                                                                                                                                                   | Expected                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | In a non-production environment, pick a School whose maintenance tree has a Program, an Area/Subarea, and a Course node, each with a different staff linked to a different login user. | Tree loads as usual via `GET /charts/maintenance/tree`.                                                                                    |
| 2   | Call `POST /charts/maintenance/reset-password` with that period/school and `entityTypeCodes: ["TG903-T003"]` (PROGRAM only).                                                           | Response's `reset` array contains only the Program node's user; `skipped` is empty (assuming that user is linked).                         |
| 3   | Log in as that Program user with `DEFAULT_USER_PASSWORD`.                                                                                                                              | Login succeeds.                                                                                                                            |
| 4   | Call the endpoint again with `entityTypeCodes: ["TG903-T001"]` (DEAN) from **two different schools** in the same academic period (both sharing one Dean).                              | Both calls return the same `userId` in `reset`; the Dean's user can log in with the default password after either call.                    |
| 5   | Pick a Course node whose staff has no linked user (`staff.user_id IS NULL`) and include `COURSE` in the selection.                                                                     | That node appears in `skipped` with its `chartId`/`staffId`/`entityTypeCode`; the call still succeeds and resets everything else selected. |
| 6   | Call the endpoint for a school/period combination with no chart configured yet.                                                                                                        | `200` with `{ reset: [], skipped: [] }`, not an error.                                                                                     |
| 7   | Call the endpoint as a user with `ORGANIZATION`/`POST` (ordinary chart maintenance) but not `ADMIN`.                                                                                   | `403` — confirms a school-scoped chart maintainer cannot reach this endpoint, closing the DEAN cross-school escalation path.               |

## Data validation

```sql
-- After step 3/4 above: the affected user's password hash actually changed.
SELECT id, email, updated_at
FROM organization.users
WHERE id = <userId>;
-- expected: updated_at reflects the reset call's timestamp
```

## Symptom → diagnosis

| Symptom                                                                    | Likely cause                                                                                                                                | Check                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A selected type's user is missing from `reset` and not in `skipped` either | The chart node's `entity_type_id` is `NULL` (untagged), so it never matched the requested type code                                         | `SELECT entity_type_id FROM organization.charts WHERE id = <chartId>`                            |
| DEAN reset from School B doesn't affect the same user as School A          | The two schools don't actually share a `root_chart_id` in that academic period (misconfigured chart-heads setup, not a bug in this feature) | `SELECT root_chart_id FROM organization.charts WHERE id IN (<schoolAChartId>, <schoolBChartId>)` |
| A reset user still can't log in with the default password                  | `DEFAULT_USER_PASSWORD` differs between the environment used to test and the one being verified                                             | Check the env var value in that environment, not the code                                        |

## How to revert

There is no way to restore a user's prior password — bcrypt hashes are one-way and this
change does not add a history/undo table (see `proposal.md` § Non-goals). Reverting the
**code** (redeploying the previous version) does nothing for a user already reset.

If a reset was triggered in error, the affected user can recover through the existing
self-service flow instead:

```
POST /users/request-password-reset   (body: { email })
```

which emails them a fresh reset link — the same mechanism they would use if they forgot
their password. There is no admin-side undo.

## Do NOT

- Do not attempt to "restore" a password from `updated_at`/logs — the previous hash is not
  retained anywhere.
- Do not run the endpoint against production School/period combinations to "test" it — the
  password change is real and immediate. Verify in a non-production environment first.
