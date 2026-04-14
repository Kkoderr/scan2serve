# apps/api/prisma

Prisma schema, migrations, and seed scripts for the API.

## Conventions
- DB uses snake_case; Prisma uses `@map`/`@@map` to keep code camelCase.
- Keep migrations aligned with Prisma enum/table mappings to avoid runtime type mismatches.

## Updates 2026-04-14
- Mapped subscription/payment enums to their snake_case Postgres types (`apps/api/prisma/schema.prisma`).

