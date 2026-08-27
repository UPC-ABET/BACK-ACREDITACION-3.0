# API Tokens — Integration & Testing Guide

> Companion to [`POLICIES.md § Auth & Guards`](./POLICIES.md) and
> [`openspec/specs/api-tokens-auth/`](../openspec/specs/api-tokens-auth/). This document is
> written for two audiences: (1) an **external team** that wants to consume this backend's API
> machine-to-machine, and (2) **whoever needs to test the flow** end-to-end before handing it off.

## 0. Current status — read this first

- **Merged.** The mechanism is on `production` (PR #133, commit `f236763`).
- **One endpoint is opted in today**: `POST /api/study-plan-courses/get-by-filters` — see §3.
  Every other endpoint in the API is still JWT-only; `@ApiTokenAuth()` is opt-in per route (see
  §6) and nothing else carries it yet.

Everything below describes the mechanism as implemented; §6 is what to do to expose another
endpoint to a consumer.

## 1. How it works, in one paragraph

An **API token** is a credential for a system, not a person. It is presented on a request header
instead of a login session. A dedicated guard (`ApiTokenAuthGuard`) runs before the human JWT
guard, reads the token, and — if the route opted in — attaches a **machine principal** to the
request. The existing `PermissionsGuard` then checks that principal's scopes exactly like it
checks a human's permissions. A token can only ever do what its scopes explicitly grant; it never
inherits admin rights and is invisible to any code that looks at `request.user`.

## 2. Requesting a token (for the consuming team)

Tokens are issued by an ABET backend administrator — a consuming team cannot self-serve one.
What to send the admin:

- A **name** identifying your integration (e.g. `"Banner Nightly Sync"`).
- The list of **scopes** you need, as `{ module, action }` pairs. `module` is one of the values in
  `PERMISSION_MODULES` (e.g. `ACADEMIC`, `EVIDENCE`, `ACCREDITATION`...), `action` one of
  `GET | POST | PUT | DELETE | PATCH`. Ask for the minimum you need — scopes cannot be widened
  later without reissuing the token (see §5).
- Optionally, an **expiration date** (ISO 8601). If you don't need one, omit it — the token is
  valid indefinitely until revoked.

The admin calls this as an authenticated ADMIN user. There is no username/password login on this
backend — the only sign-in is Microsoft Entra ID (`GET /auth/microsoft`, browser OAuth redirect),
and it lands the JWT in an `httpOnly` cookie named `accessToken`, not in a JSON response. To get a
bearer token for `curl`/Postman: log into the app normally in a browser as an ADMIN, open devtools
→ Application/Storage → Cookies, and copy the `accessToken` value.

```
POST /api/admin-api-tokens/create
Authorization: Bearer <admin JWT>
Content-Type: application/json

{
  "name": "Banner Nightly Sync",
  "scopes": [
    { "module": "ACADEMIC", "action": "POST" }
  ],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

Response (`201`):

```json
{
	"code": 201,
	"message": "success.created",
	"data": {
		"id": 1,
		"name": "Banner Nightly Sync",
		"keyId": "a1b2c3d4e5f60718293a4b5c",
		"scopes": [{ "module": "ACADEMIC", "action": "POST" }],
		"expiresAt": "2027-01-01T00:00:00.000Z",
		"createdAt": "2026-08-27T10:00:00.000Z",
		"apiKey": "a1b2c3d4e5f60718293a4b5c.q8sT1z...-256-bit-secret...xQ"
	}
}
```

**`apiKey` is shown exactly once, in this response.** It is not recoverable afterwards — only a
bcrypt hash is stored server-side. If it's lost, the only fix is revoking the token and issuing a
new one. Hand this off to the consuming team through a secure channel (secrets manager, encrypted
message) — never over plain email/Slack, and never commit it to a repo.

## 3. What's exposed today: course status, outcome and career per academic period

`POST /api/study-plan-courses/get-by-filters`, scope `{ module: "ACADEMIC", action: "POST" }`.
Course is the anchor entity: each row is a course linked into a study plan for an academic
period, and carries its status, its learning outcome, and the career (program) it belongs to
for that period.

Request (all filters optional — combine freely):

```
POST /api/study-plan-courses/get-by-filters
X-Api-Key: <keyId>.<secret>
Content-Type: application/json
X-Academic-Period-Id: 12   (optional — same effect as the academicPeriodId filter below)

{
  "academicPeriodId": 12,
  "programId": 3,
  "isActive": true
}
```

Response — one entry per `study_plan_courses` row matching the filters:

```json
{
	"code": 200,
	"message": "success.ok",
	"data": [
		{
			"id": 501,
			"isActive": true,
			"isElective": false,
			"levelTypeId": 4,
			"studyPlanAcademicPeriodId": 88,
			"courseId": 77,
			"course": {
				"id": 77,
				"code": "CS301",
				"name": { "es": "Estructuras de Datos", "en": "Data Structures" },
				"learningOutcome": { "es": "...", "en": "..." },
				"isActive": true
			},
			"program": {
				"id": 3,
				"code": "ISW",
				"name": { "es": "Ingeniería de Software", "en": "Software Engineering" },
				"degree": { "es": "Bachiller", "en": "Bachelor" },
				"isActive": true
			}
		}
	]
}
```

Field mapping to what was asked for:

- **Course status** → `isActive` at the top level (the `study_plan_courses` row for that period)
  and `course.isActive` (the course record itself — usually the same, but check both: a course
  can be globally inactive while a specific period link is still flagged active, or vice versa).
- **Outcome** → `course.learningOutcome` (bilingual `{ es, en }`).
- **Career for that academic period** → `program` (`id`, `code`, `name`, `degree`). It is always
  present — there is no case where a `study_plan_courses` row exists without a program, so this
  field is never `null`.

`programId` and `academicPeriodId` remain optional filters — omit them to get every career/period
combination back in one call, or set them to scope the query to one career and/or one period.

Note on scope: `{ ACADEMIC, POST }` is also what `create` and `maintenanceCreate` on this same
controller require, but a token still cannot call those — `@ApiTokenAuth()` is checked per route
before the scope ever matters, and only `get-by-filters` carries it (see §6).

## 4. Calling a protected endpoint (the consumer's side, generally)

Once your token exists **and** the target endpoint has `@ApiTokenAuth()` applied, send it on a
header — not `Authorization`, which is reserved for human JWTs:

```
POST /api/<some-endpoint-with-token-auth>
X-Api-Key: a1b2c3d4e5f60718293a4b5c.q8sT1z...-256-bit-secret...xQ
```

The header value is the full `apiKey` string you got at issuance, `<keyId>.<secret>` — do not
split it, do not send only the secret.

### Error responses you may see

| HTTP status | `message` (i18n key)               | Meaning                                                                                                                                                                         |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`       | `error.apiToken.invalidApiKey`     | Unknown `keyId`, wrong secret, revoked, or expired token. Unknown-key and wrong-secret are **deliberately indistinguishable** — don't try to tell them apart from the response. |
| `401`       | `error.apiToken.unauthorizedRoute` | You sent a valid-looking `X-Api-Key`, but this route doesn't accept tokens at all (no `@ApiTokenAuth()`).                                                                       |
| `403`       | `error.apiToken.insufficientScope` | Your token is valid but doesn't have the `{module, action}` scope this endpoint requires.                                                                                       |
| `404`       | `error.notFound` / route-specific  | Endpoint exists and your token passed auth, but the resource itself wasn't found — same as any other client.                                                                    |

All error bodies follow the standard response envelope:

```json
{ "code": 401, "message": "error.apiToken.invalidApiKey", "data": null }
```

There is no automatic retry/backoff guidance beyond normal HTTP semantics — there is currently
**no rate limiting** on this backend (accepted, documented risk; see `docs/CONTEXT.md`). Don't
hammer the API in a tight loop.

## 5. Rotating or revoking a token

There is no "update scopes" operation — scopes are set once at issuance. To change what a token
can do:

1. Admin calls `DELETE /api/admin-api-tokens/delete/:id` to revoke the old token
   (`isActive = false`; the row is kept for audit, never hard-deleted).
2. Admin calls `POST /api/admin-api-tokens/create` again with the new scope set.
3. The consuming team updates its stored secret to the new `apiKey`.

`PUT /api/admin-api-tokens/update/:id` only accepts `name` and `expiresAt` — sending `scopes` or
`isActive` in that body is rejected (400) by design.

Admin CRUD reference:

| Method   | Path                                   | Purpose                             |
| -------- | -------------------------------------- | ----------------------------------- |
| `POST`   | `/api/admin-api-tokens/create`         | Issue a token (returns secret once) |
| `PUT`    | `/api/admin-api-tokens/update/:id`     | Rename / change expiry              |
| `DELETE` | `/api/admin-api-tokens/delete/:id`     | Revoke                              |
| `GET`    | `/api/admin-api-tokens/get-all`        | List all tokens (no secrets)        |
| `GET`    | `/api/admin-api-tokens/get-by-id/:id`  | Get one token (no secret)           |
| `POST`   | `/api/admin-api-tokens/get-by-filters` | Filter by `name` / `isActive`       |

All of these require a human ADMIN JWT (`Authorization: Bearer ...`) — none of them accept an
`X-Api-Key`, on purpose (a token must never be able to mint tokens for itself).

## 6. Exposing another endpoint to token auth (for backend devs on this repo)

To let a consumer call an existing endpoint with a token, add the decorator — nothing else
changes about the handler:

```ts
import { ApiTokenAuth } from 'src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator';
import { ApiSecurity } from '@nestjs/swagger';

@ApiSecurity('apiKey')
@ApiTokenAuth()
@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
async getSomething() { ... }
```

Rules:

- **Never combine `@ApiTokenAuth()` with `@SkipPermissions()`** — that would authorize a machine
  principal with zero scope check.
- `@RequirePermission` stays mandatory and is what actually enforces the scope; `@ApiTokenAuth()`
  only says "a token is allowed to attempt this route at all."
- If the endpoint should be reachable by both a human and a machine, keep it exactly as-is (JWT
  path is untouched) and just add the two decorators — both principals get scope-checked the same
  way by the same `PermissionsGuard`.
- Add `@ApiSecurity('apiKey')` alongside `@ApiTokenAuth()` so Swagger shows the token option for
  that specific operation (it's documentation only — `@ApiTokenAuth()` is what the guard actually
  checks at runtime).
- Update `openapi.json` (`pnpm openapi:export`) after adding the decorators.
- Before opting in a mutating (`POST`/`PUT`/`DELETE`/`PATCH`) endpoint, double check every other
  endpoint sharing that same `{module, action}` permission pair — a token granted that scope can
  reach any route carrying `@ApiTokenAuth()` with the matching pair, not just the one you meant to
  expose.

## 7. Testing the whole flow yourself (before handing off to another team)

You don't need a second system to verify this works — you can play both roles locally.

**Prerequisites**: checkout `production`, run the app (`pnpm start:dev`), have an ADMIN user's
credentials.

1. **Log in as admin** in a browser (Microsoft Entra ID — there is no password login), then copy
   the `accessToken` cookie value from devtools (Application/Storage → Cookies). Use it as
   `<admin JWT>` below.

2. **Issue a token** scoped to `{ "module": "ACADEMIC", "action": "POST" }` (§3's endpoint):

   ```bash
   curl -s -X POST http://localhost:3000/api/admin-api-tokens/create \
     -H "Authorization: Bearer <admin JWT>" \
     -H "Content-Type: application/json" \
     -d '{"name":"local-test","scopes":[{"module":"ACADEMIC","action":"POST"}]}'
   ```

   Save the `data.apiKey` from the response — you will not see it again.

3. **Call it as the "external system"**, using the header instead of a JWT:

   ```bash
   curl -s -X POST http://localhost:3000/api/study-plan-courses/get-by-filters \
     -H "X-Api-Key: <the apiKey from step 2>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   Expect `200` and a list of courses, each with `program` populated.

4. **Verify the negative cases** — each should fail the way §4's table says:
   - Same call with the header removed → falls through to the JWT guard → `401` (no session
     either), proving the route still behaves normally for callers with no token at all.
   - Same call against `POST /api/study-plan-courses/create` (no `@ApiTokenAuth()`) →
     `401 error.apiToken.unauthorizedRoute`, even though it shares the token's exact scope.
   - Same call with the last character of the secret changed → `401 error.apiToken.invalidApiKey`.
   - Issue a second token with a scope you don't test against (e.g. `EVIDENCE`/`GET`), call
     `get-by-filters` with it → `403 error.apiToken.insufficientScope`.
   - Revoke the token (`DELETE /api/admin-api-tokens/delete/:id`), retry the original call →
     `401 error.apiToken.invalidApiKey`.

5. **Postman / Insomnia**: import `openapi.json` from the repo root — `get-by-filters` on
   `study-plan-courses` shows an `apiKey` auth option in the generated collection (separate from
   the `bearer` one used for JWT), so you can switch between "call as human" and "call as machine"
   per request without hand-editing headers.

## 8. Security notes for whoever operates this

- The stored secret is a bcrypt hash (`select: false` — never returned by any query). There is no
  "forgot my key" recovery; losing it means revoke-and-reissue.
- A revoked token's row is kept (`isActive = false`, `revokedByUserId`, `revokedAt`) for audit —
  it is never deleted.
- A token is not tied to a school/period/tenant — its only boundary is its scope list. Don't issue
  broader scopes than the integration actually needs.
- There is no bulk/emergency revoke-all — if a secret leaks, revoke that one token by id.
- Scopes are `{module, action}`, not per-route — see the callout in §6 before opting in a second
  endpoint that shares a permission pair with something more sensitive.
