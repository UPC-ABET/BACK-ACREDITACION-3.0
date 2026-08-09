# Architecture Decision Records

One numbered, immutable file per hard-to-reverse decision — and, the actual point, **why**
it was made, including what was rejected and what it costs.

Code shows what the system does, never why it does that instead of the obvious alternative.
Without the record, someone finds a rule that looks wrong six months from now, "fixes" it,
and reintroduces the problem it was preventing.

## Naming

`ADR-NNN-<kebab-slug>.md` — three-digit padded, numbers never reused.

The slug names **the decision**, not the ticket or the change:
`ADR-004-immediate-cutoff-on-programme-deactivation.md`, never `ADR-004-abet-1234.md`.
Ticket references age badly; the decision does not.

## What gets one

- Datastore, message broker or cache choice
- Authentication or payments provider
- A public API contract change, or any breaking change
- A new module boundary, or splitting work across repositories
- Language, runtime or framework
- Contradicting an existing ADR

## What does not

Trivial choices, anything already settled in [POLICIES.md](../POLICIES.md), and ordinary
feature or bug work — that belongs in commits and the openspec change.

## Rules

- **Consequences must include negatives.** An ADR with no negatives is suspicious: if you
  cannot name the cost, you have not understood the trade-off.
- **Once Accepted, an ADR is immutable.** To change a decision, write a new ADR that
  supersedes it and mark the old one `Superseded by ADR-NNN`. The only edit permitted on an
  accepted ADR is its Status line.
- Status lifecycle: `Proposed → Accepted → (Deprecated | Superseded by ADR-NNN)`.
  Use `Proposed (retroactive)` when documenting something already live in production.

Write them with `/abet-adr`, which is the only tool permitted to author files in this
directory.

## Index

| ADR                                                                       | Decision                                                                        | Status   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| [ADR-001](./ADR-001-external-system-credentials-encrypted-in-database.md) | Store external-system credentials in our database, encrypted under `APP_SECRET` | Accepted |

Further candidates are already identified in
[CONTEXT.md § Security Decisions](../CONTEXT.md#security-decisions-accepted-risks) — each of
those is a decision with a real cost, waiting for someone with the context to write the why.
