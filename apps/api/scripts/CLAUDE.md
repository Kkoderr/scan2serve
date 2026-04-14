# apps/api/scripts

Utility scripts for the API app (seeding demo data, ClickHouse bootstrap, etc.).

## Conventions
- Prefer idempotent operations (upsert / createMany with `skipDuplicates`) so scripts can be re-run safely.
- Keep scripts usable in docker-compose as part of `db:seed:sample`.

## Updates 2026-04-14
- Seed org subscription row when creating the sample org (`apps/api/scripts/seed-sample-data.ts`).

