# ABET Backend

Conventions for this NestJS + TypeORM backend live in `docs/`:

- **[docs/POLICIES.md](./docs/POLICIES.md)** — mandatory rules. Naming, entities, the
  repository boundary, migrations, i18n keys, validation, auth, scope headers, responses,
  Swagger, testing, git. Read this before writing code.
- **[docs/CONTEXT.md](./docs/CONTEXT.md)** — orientation. Stack, project structure, module
  layout, domain vocabulary, database schemas, environment, integrations.
- **[docs/adr/](./docs/adr/)** — architecture decision records: why particular choices were
  made, and what they cost.

Work runs through `openspec/changes/<slug>/`. See
[docs/CONTEXT.md § Spec-driven workflow](./docs/CONTEXT.md#spec-driven-workflow).
