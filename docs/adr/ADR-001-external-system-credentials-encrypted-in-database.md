# ADR-001 — Store external-system credentials in our database, encrypted under `APP_SECRET`

- **Status**: Accepted
- **Date**: 2026-08-08
- **Deciders**: ljferreyrac (requester), during the `planner-api-login` design
- **Tags**: security, credentials, scraping, integrations

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-NNN).
     Once Accepted, everything below is immutable. To change the decision, write a new
     ADR that supersedes this one and edit only the Status line here. -->

## Context

This platform holds accounts on two external university systems it scrapes — Banner and
u-planner. Those are real institutional accounts belonging to real staff, and using them
requires the plaintext password at request time.

Today the u-planner pair lives in `PLANNER_USER` / `PLANNER_PASSWORD` in the server's
`.env`, read through `ConfigService`. That arrangement failed in production on 2026-08-08,
and the shape of the failure is what forced this decision:

- The u-planner session wedged (a separate defect, recorded in
  `openspec/specs/planner-api-login/proposal.md`). The response was to rotate the account
  password and update the server `.env`.
- **The new value never reached the running process.** `env_file` in
  `docker-compose.prod.yml` is read at container _create_ time, so `docker compose restart`
  keeps the old environment. The `.env` looked correct, `docker exec ... env` eventually
  showed the new value, and the service still behaved as though nothing had changed. Hours
  went into a credential problem that was partly a deployment-mechanics problem.
- **The people who own the account cannot rotate it.** Changing a u-planner password
  requires someone with SSH access to the production host and knowledge of the compose
  recreate step. The accreditation staff who own the u-planner login are not those people,
  so every rotation becomes a ticket.

The status quo is therefore unacceptable on two independent grounds: rotation is not
self-service, and applying a rotation has a silent failure mode.

What constrains the alternatives: this platform has **no secrets manager**. It uses AWS for
S3 only. What it does have is `src/libs/encrypt.service.ts` — AES-256-GCM
(`iv:ciphertext:authTag`) keyed off the `APP_SECRET` env var, already registered globally
via `EncryptModule` in `app.module.ts`.

The key is **derived** from `APP_SECRET` as `sha256(APP_SECRET)`, not hex-decoded from it. That was
settled while implementing this decision: hex-decoding produced whatever length the secret happened
to be, and the deployed environments hold a 128-character value, so aes-256-gcm rejected every call
with `Invalid key length`. Nothing had ever noticed, because nothing consumed the service.
`env.config.ts` still requires `APP_SECRET` to be at least 64 hex characters; the derivation no
longer depends on that, but the environment contract is unchanged.

> Amended 2026-08-09, before this ADR had ever merged, to record the derivation above and its
> consequence in Negative 1. The immutability rule in `docs/adr/README.md` protects accepted ADRs
> that other work already depends on; nothing depended on this one yet, and shipping it describing
> an encryption scheme the same pull request replaced would have been worse.

**No alternative was built and reverted, so there is no PR to name here.** One honest fact
belongs in its place: `EncryptService` currently has **no consumer anywhere in `src/`** — the
only reference is a re-export in `src/libs/parameter.functions.ts`. It was written in
anticipation and has never run in production. This decision makes credential storage its
first real user, which means the mechanism is unproven at exactly the moment we begin
depending on it.

## Decision

We will store external systems' operator credentials in our own PostgreSQL database — the
username in plaintext and the password as `EncryptService` AES-256-GCM ciphertext keyed on
the application-wide `APP_SECRET` — and manage them through authenticated, permission-gated
API endpoints, instead of through deployment-time environment variables.

## Consequences

### Positive

- The staff who own an external account rotate its credentials themselves, through the
  application, with no shell access and no deploy.
- A rotation takes effect on the next use. The class of bug where an environment change
  looks applied but is not cannot recur for credentials.
- Credentials gain the things a database row has and a `.env` line does not: a `created_at`
  / `updated_at` trail, and an access path that runs through the permissions guard.
- One mechanism covers both providers. Banner can move onto the same table without a second
  design, even though its login flow stays browser-and-2FA based.
- Removing the pair from `.env` shortens the list of secrets that must be provisioned to
  stand up an environment.

### Negative

- **`APP_SECRET` becomes load-bearing for scraping.** If it is rotated, lost, or differs
  between environments, every stored password becomes undecryptable and scraping stops until
  each credential is re-entered by hand. **There is no key-rotation mechanism in this
  codebase, and this decision does not add one.** Anyone who changes `APP_SECRET` in future
  must know that it silently invalidates stored credentials — this is the single most
  likely way for this decision to hurt someone later. **Changing the key derivation
  (`sha256(APP_SECRET)` in `EncryptService`) has exactly the same effect as rotating the secret**,
  and is easier to do by accident: it looks like an implementation detail.
- **Exposure widens from one file to every database copy.** A root-owned `.env` on one host
  is not routinely duplicated; a database is. These credentials now travel inside every
  backup, every restore into staging, and every dump a developer pulls to debug locally, and
  are readable by anyone with database read access. The encryption is what makes that
  tolerable rather than disqualifying — but the exposure surface genuinely grows, and calling
  it a pure security improvement would be wrong.
- **This is key-wrapping, not secret elimination.** `APP_SECRET` itself lives in `.env`. We
  have not removed a secret from the environment; we have reduced N credentials to one key.
  A developer holding both a production dump and a production `APP_SECRET` holds the
  plaintext passwords. The decision is only as strong as `APP_SECRET`'s own handling.
- A new failure mode has to be handled deliberately: **decryption failure must not be
  reported as "invalid credentials."** Conflating them sends an operator to re-type a
  password that was always correct, which is precisely the wasted evening this ADR exists to
  prevent a repeat of.
- More moving parts than reading an env var: a table, a migration, a repository, validation,
  DTOs and two endpoints — all of which can carry their own defects, and one of which
  (the endpoints) is newly reachable by anyone holding the scraping permission.

### Neutral

- The resulting u-planner **session tokens** are unaffected: they stay in a `0600` JSON file
  on the container's bind mount. This ADR governs credentials, not sessions.
- Banner's login flow is unchanged. Only where credentials live is unified; how they are used
  stays provider-specific.
- The username is stored in plaintext. It is not a secret, and keeping it readable makes the
  configuration screen and any support conversation straightforward.

## Alternatives considered

- **Keep the credentials in environment variables.** Rejected on the two grounds in Context:
  rotation is not self-service, and the `env_file` recreate requirement makes applying one
  silently unreliable. Both were observed in production, not hypothesised.
- **Reuse `core.parameters`.** The existing runtime-configuration table, which would have
  needed no new schema. Rejected because parameters are served by generic read endpoints, so
  the ciphertext would be reachable by any caller holding parameters read access — a wider
  audience than the scraping permission, and for no benefit beyond saving one migration.
- **A managed secrets store (AWS Secrets Manager or SSM Parameter Store).** The technically
  correct answer: real key management, real rotation, real audit, and the platform already
  authenticates to AWS for S3. Rejected on proportionality — a new external dependency,
  IAM policy, local-development story and failure mode for a single credential pair. **This
  is the documented upgrade path**, and the `APP_SECRET` negative above is the trigger that
  should prompt revisiting it.
- **Hash the password instead of encrypting it.** Not possible. Logging in to u-planner
  requires the plaintext to base64-encode into the request body, so the value must be
  recoverable by design. Noted because "why isn't this hashed" is the first question a
  reviewer will ask of a password column.
- **Write the credentials into the existing token-store JSON file.** Rejected because it puts
  them outside the database — outside backups, outside any audit trail, and with no
  permissioned API around them — while solving none of the rotation problem.

## References

- `openspec/specs/planner-api-login/proposal.md` — the change that forced this decision,
  including the production incident of 2026-08-08 and decisions 1, 3 and 6.
- `src/libs/encrypt.service.ts` — the AES-256-GCM implementation this relies on.
- `src/commons/configs/env.config.ts` — `APP_SECRET`'s validation (min 64 hex characters).
- `docs/CONTEXT.md` § Security Decisions (Accepted Risks) — the sibling list of acknowledged
  costs this ADR joins.
- `docker-compose.prod.yml` — the `env_file` mechanics behind the silent-rotation failure.
