/**
 * `app.module.ts` registers the scraping modules only when `RAW_DB_URL` is set, so exporting
 * without it silently drops every scraping endpoint from the spec. The export runs Nest in
 * `preview` mode, so this placeholder is never dialled.
 *
 * **Must be imported before `../app.module`** — imports evaluate in source order and `app.module`
 * reads `process.env` as it evaluates, so setting this anywhere later has no effect.
 */
process.env.RAW_DB_URL ??= 'postgres://openapi-export:placeholder@localhost:5432/raw';
