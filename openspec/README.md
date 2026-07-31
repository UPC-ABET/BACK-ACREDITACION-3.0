# openspec

Spec-driven change records. A **change** is a directory; there is no CLI and no config —
tooling detects a change by testing whether its directory exists.

```
openspec/
├── changes/    in flight — one directory per change
└── specs/      archived record — moved here with `git mv` after the change merges
```

Each change directory is named by its kebab-case slug, which the branch also carries
(`feat/<slug>`), so the change can be inferred from `git branch --show-current`.

| File          | Holds                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| `proposal.md` | The ticket: problem, what already exists, goals, non-goals, acceptance criteria |
| `design.md`   | How it will be built, and the ADR gate walked as a table                        |
| `tasks.md`    | Vertical milestones, each task with its own `- [ ]` checkbox                    |
| `runbook.md`  | Manual validation and one-time operational steps, when the change needs them    |
| `contract.md` | The agreed API surface — cross-repo changes worked in parallel only             |

`specs/` is a historical record of change folders, not a set of canonical capability specs.

Multi-step work gets a change folder; a one-shot defect does not.
