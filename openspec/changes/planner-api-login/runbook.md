# Runbook — Planner API login with stored credentials

**Slug**: `planner-api-login`

Planner scraping cannot work after this deploy until step D3 below is done **by hand**. The
credentials deliberately do not travel with the release (proposal decision 6, ADR-001), so
deploying alone leaves Planner in `not_configured`.

## ⚠️ Deploy prerequisite

Three steps, in this order — referred to below as **D1–D3** so they cannot be confused with the
numbered rows in § Manual validation. D1 and D2 are the deploy; **D3 is the one that gets missed**,
and until it runs no Planner scrape can start.

**If you intend to run § Manual validation, do rows 1–2 before D3** — they assert the
`not_configured` state, which D3 destroys by design.

```bash
# D1. Migration — creates core.scraper_credentials
pnpm migration:run

# D2. Deploy the image, then REMOVE the retired variables from the server .env:
#      PLANNER_USER
#      PLANNER_PASSWORD
#    and RECREATE the container. `restart` does NOT re-read env_file — this is the exact
#    gotcha that cost a debugging session on 2026-08-08 and is why ADR-001 exists.
docker compose -f docker-compose.prod.yml up -d --force-recreate sys_acc_back

# D3. Configure the credentials ONCE through the API (bearer token from a user holding
#    the SCRAPPING permission). Until the frontend form ships, this is the only way.
#    Read the password rather than typing it: a literal -d '{"password":"..."}' lands in
#    ~/.bash_history and is visible in `ps` for the life of the request, on the production host.
read -rs -p 'u-planner password: ' PLANNER_PW
jq -n --arg u '<planner-user>' --arg p "$PLANNER_PW" '{username:$u,password:$p}' \
  | curl -sS -X POST https://<host>/api/planner/session/credentials \
      -H "Authorization: Bearer <token>" \
      -H 'Content-Type: application/json' \
      --data-binary @-
unset PLANNER_PW
# expected: {"code":200,"message":"success.ok","data":{"status":"active","tokenExp":"..."}}
```

**Sequence the frontend release close behind this one.** Between the backend deploy and D3,
`GET /status` returns `not_configured` — a value the currently-deployed frontend does not know —
and `POST /refresh` returns `400 error.planner.credentialsNotConfigured` where it previously
returned `200 {status:'expired'}`. Both are expected; neither is data loss. The window closes as
soon as D3 runs, and fully once the frontend ships its credentials form.

**`APP_SECRET` must be identical to the value the application will run with.** The password
is encrypted under it; if it changes afterwards, the stored credential becomes undecryptable
and D3 has to be repeated (ADR-001, negative 1).

Leaving the two variables in the server `.env` is harmless to boot — `envSchema` is
`.passthrough()` — but they are dead and misleading, so remove them.

## Manual validation

**There are two independent 30-second cooldowns, and they bite in opposite directions.**

| Cooldown              | Armed by                                               | Held for                                                                                                | Suppresses                                                                                                             |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `REFRESH_COOLDOWN_MS` | a failed `POST /refresh`                               | 30s from the failure                                                                                    | further refresh attempts; the original failure's answer is replayed (`expired`, or `503` if u-planner was unreachable) |
| verification throttle | **any** `POST /credentials`, from the moment it starts | the whole attempt; released on success and on an unreachable u-planner, re-armed 30s on a **rejection** | further credential verifications                                                                                       |

The verification throttle is the one that surprises people: it is claimed on **entry**, not on
failure, so a second `POST /credentials` while the first is still running — a double-click, a
frontend retry, a second operator — gets `400 error.planner.verificationCooldown` even for a
correct pair. That key never means "your password is wrong".

So: **let each credential step finish, and wait 30 seconds after any step that fails.** Validation
step 3 below deliberately submits a wrong password and therefore arms the 30s penalty; step 4 must
wait it out.

The single-flight promise also survives between requests. A short-circuited response looks exactly
like a genuine result — the trap that made the original diagnosis take hours.

| #   | Step                                                                                  | Expected                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | After D1, **before D3**: `GET /api/planner/session/status`                            | `{"status":"not_configured","tokenExp":null}` (AC-9)                                                                                                                            |
| 2   | Before D3: `POST /api/planner/session/refresh`                                        | Fails with `error.planner.credentialsNotConfigured`. **No login attempted** — no outbound call in the logs                                                                      |
| 3   | `POST /credentials` with a **deliberately wrong** password                            | `400 error.planner.invalidCredentials`, and `SELECT count(*) FROM core.scraper_credentials` is **unchanged** (AC-7)                                                             |
| 3b  | **Wait 30s** (step 3 armed the 30s penalty), or `POST /credentials` again immediately | Immediately: `400 error.planner.verificationCooldown` — proves the anti-spray throttle is live                                                                                  |
| 4   | `POST /credentials` with the correct pair, **after the 30s has elapsed**              | `200`, `status: "active"`; `planner_token_store.json` reappears on the bind mount with mode `0600`                                                                              |
| 5   | `GET /api/planner/session/credentials`                                                | `{ username, configured: true, updatedAt }` — `updatedAt` carries the save time, and there is **no password field in any form** (AC-8)                                          |
| 6   | `GET /api/planner/session/status`                                                     | `active`, with `tokenExp` roughly **12 hours** out                                                                                                                              |
| 7   | Run a **full Planner scrape** end to end                                              | Completes, data lands in the raw datasource. This is the only proof that AC-12 holds and the scraper was untouched                                                              |
| 8   | `docker exec sys_acc_back ps aux \| grep -i chrom` during a refresh                   | **No Chromium process.** Planner no longer launches a browser (AC-1)                                                                                                            |
| 9   | Re-`POST /credentials` with a different valid account, then `GET /status`             | The previously cached session is replaced, not reused (AC-10)                                                                                                                   |
| 10  | Review the container logs for the whole exercise                                      | Every `expired` result has a matching `warn` (or `debug` for a cooldown replay — set LOG_LEVEL to include debug); **no password, base64 string or JWT appears anywhere** (AC-3) |

Step 10 is not optional politeness — it is the AC-3 acceptance check, and the only one that
catches a credential leaking into an aggregated log store.

## Data validation

```sql
-- expected: exactly 1 row, provider_code = 'PLANNER'
SELECT provider_code, username, is_active, created_at, updated_at
FROM   core.scraper_credentials;

-- expected: 1 row, and the value matches 'hex:hex:hex' — never the plaintext password
SELECT provider_code,
       password_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$' AS "looksEncrypted"
FROM   core.scraper_credentials;

-- expected: the readable constraint names, not hashes
SELECT conname FROM pg_constraint
WHERE  conrelid = 'core.scraper_credentials'::regclass;
-- -> PK_scraper_credentials, UQ_scraper_credentials_provider_code
```

On the host, confirm the session file is still owned by the container user and not world
readable:

```bash
ls -l ./scrapping/planner_token_store.json   # expect -rw------- (0600)
```

## Symptom → diagnosis

| Symptom                                                             | Likely cause                                                                              | Check                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `status: not_configured` after step 3 appeared to succeed           | The POST hit a different environment, or the row was never written                        | `SELECT * FROM core.scraper_credentials`                                                                       |
| `error.scraperCredential.decryptionFailed`                          | **`APP_SECRET` changed or differs between environments** (ADR-001)                        | Compare `APP_SECRET` against the value in force when step 3 ran. Fix: re-run step 3. Never "reset" the row     |
| `error.planner.unreachable`                                         | u-planner is down or the host is unreachable — **not** a bad password                     | `curl -sS -o /dev/null -w '%{http_code}' https://upc-e2g-post-api.u-planner.com/api/user-api`                  |
| `error.planner.verificationCooldown`                                | A verification is **in flight**, or one was rejected in the last 30s                      | Wait for the first attempt to finish, or 30s after a rejection. Never a verdict on the pair you just submitted |
| `503 error.planner.unreachable` from `POST /refresh`                | u-planner did not answer. The stored session is untouched and may still be perfectly good | Check u-planner; `GET /status` still reports the real session state. Do **not** re-enter credentials           |
| `error.planner.invalidCredentials` for a password known to be right | The u-planner account is locked or was rotated upstream                                   | Sign in to `https://upc-e2g-post.u-planner.com/` manually with the same pair                                   |
| Refresh returns instantly and nothing appears in the log            | The 30s cooldown short-circuited — you are measuring nothing                              | Look for the `debug` cooldown line; wait 30s or restart the container and retry                                |
| Scrapes 401 in a loop                                               | Should be impossible — `planner-http.client.ts:47` retries auth once                      | If seen, that guard has regressed; treat as a defect, not a config problem                                     |

## How to revert

Reverting the code is **not sufficient on its own** if the migration has run — the previous
release reads `PLANNER_USER` / `PLANNER_PASSWORD`, which step 2 removed.

```bash
# 1. Restore the two variables in the server .env, then recreate (NOT restart):
docker compose -f docker-compose.prod.yml up -d --force-recreate sys_acc_back

# 2. Deploy the previous image.

# 3. Only if you are rolling the schema back too:
pnpm migration:revert          # drops core.scraper_credentials and the stored credential
```

Order matters: restore the environment **before** deploying the old image, or the old image
boots without credentials and Planner is down for the gap.

Reverting does not delete `planner_token_store.json`. That is intentional — an existing valid
session keeps working through a rollback.

## Do NOT

- **Do not `docker compose restart` after editing `.env`.** It does not re-read `env_file`.
  Always `up -d --force-recreate`. This single misunderstanding is the origin of this change.
- **Do not put the credentials in a migration, a seed, or `.env.example`** to save step 3.
  Keeping secrets out of git is the reason step 3 is manual (proposal decision 6).
- **Do not rotate `APP_SECRET` while credentials are stored** without re-running step 3
  afterwards. There is no key-rotation mechanism; the stored password simply stops decrypting.
- **Do not delete `core.scraper_credentials` rows to "reset" a decryption failure** before
  confirming what `APP_SECRET` is. Deleting the row destroys the only copy you have; the
  password may still be recoverable with the correct key.
- **Do not restore a production database dump into a shared or lower environment** without
  treating the credential row as live production secrets (ADR-001, negative 2 — the exposure
  surface widened from one file to every database copy).
- **Do not "fix" a wedged session by reintroducing a refresh-token call.** It was removed on
  purpose; see design § AC-5 and the proposal's Problem section.
