# DECISIONS.md — Decision Log (Backend)

## How to use this file
- Every important decision (architecture, tool, API contract, design) gets a new entry.
- Old entries are never deleted. If a decision changes, write a new entry and mark the old one "Superseded by D-0XX".
- Statuses: `Proposed` (not confirmed) | `Accepted` | `Superseded` | `Open` (question, no proposal yet)
- Record each new entry in a PR (or a commit prefixed with `docs:`).

### Template
```
## D-0XX — Short title
- Date:
- Status:
- Decision:
- Reason:
- Alternatives considered:
- Consequences / risks:
```

---

## D-001 — Separate repos for frontend and backend
- Date: 2026-10-28
- Status: Accepted (mirrors frontend D-001)
- Decision: Next.js frontend and NestJS backend live in separate repos, coordinated through an OpenAPI contract.
- Reason: Independent work and separate deployments.
- Consequences: The API contract must stay accurate or integration becomes painful.

## D-002 — Core stack: NestJS 11 + Fastify + TypeScript
- Date: 2026-10-28
- Status: Accepted
- Reason: Team's chosen stack; full list in `PROJECT.md` section 3, all technologies mandatory.

## D-003 — PostgreSQL + Drizzle ORM (ADR-001, ADR-002)
- Date: 2026-10-28
- Status: Accepted
- Decision: PostgreSQL for relational data, Drizzle ORM and Drizzle Kit for schema and migrations.
- Alternatives: MongoDB + Mongoose (rejected in ADR-001/002).

## D-004 — Clean Architecture, package-by-feature
- Date: 2026-10-28
- Status: Accepted (from Backend Standards)
- Decision: Presentation → Application → Domain. Application and Domain must not depend on NestJS APIs.

## D-005 — Use cases are plain classes wired by provider factories
- Date: 2026-10-28
- Status: Proposed
- Decision: Use cases and domain code carry no `@Injectable()` or other Nest decorators. Each feature module wires them with factory providers and Symbol tokens for repository interfaces.
- Reason: Enforces the "no NestJS in Application/Domain" rule literally.
- Alternative: Allow `@Injectable()` in the Application layer (simpler, but breaks the rule).
- Risk: A bit more wiring boilerplate per feature.

## D-006 — Validation with Zod only, and how OpenAPI is generated
- Date: 2026-10-28
- Status: Open
- Decision: Zod is the only validation library (Accepted). Open: how to generate Swagger from Zod schemas.
- Options: `nestjs-zod` (+ `@nestjs/swagger` patch), `zod-to-openapi` by hand, or a small in-house converter.
- Risk: Standards say to avoid dependencies for trivial functionality, but hand-written OpenAPI drifts easily.

## D-007 — Authentication transport (httpOnly cookie)
- Date: 2026-10-28
- Status: Proposed (needs agreement with the frontend developer; mirrors frontend D-008)
- Decision: Tokens stored in `httpOnly` + `Secure` + `SameSite` cookies, never `localStorage`. CSRF validation runs first in the guard chain.
- Open sub-questions: access-token lifetime, refresh-token rotation, session store (Secure Session cookie vs Redis), cookie domain between frontend and backend.

## D-008 — Identifiers
- Date: 2026-10-28
- Status: Accepted (UUID vs serial per checklist); Open (UUID version)
- Decision: UUID for User, Profile, BlogPost and other security-sensitive entities; serial/bigserial for high-volume tables (telemetry). Never natural keys.
- Open: UUIDv4 vs UUIDv7 (v7 is time-ordered, better for index locality).

## D-009 — Timestamps, soft delete, auditing
- Date: 2026-10-28
- Status: Accepted (from Database Checklist)
- Decision: `timestamptz`, `created_at` and `updated_at` on every table, `deleted_at` on important records and filtered in all reads.
- Open: dedicated audit-log table now or later (listed as a future consideration).

## D-010 — Relationship types per entity pair
- Date: 2026-10-28
- Status: Open (decided case by case)
- Decision: Composition (`CASCADE`) vs aggregation (`SET NULL`) must be chosen deliberately for each pair when its table is designed, and recorded here.

## D-011 — Pagination format
- Date: 2026-10-28
- Status: Superseded by D-021
- Decision: Cursor-based. Proposed shape: `{ data: [], pageInfo: { nextCursor, hasMore } }`, query `?cursor=&limit=`.
- Open: opaque cursor encoding, max limit, filters or sorting combined with cursors, and whether the admin lists need offset pagination.

## D-012 — Error response shape
- Date: 2026-10-28
- Status: Superseded by D-022
- Question: Plain custom shape vs RFC 9457 Problem Details; error codes machine-readable and translated via nestjs-i18n. Must be agreed with the frontend.

## D-013 — API versioning
- Date: 2026-10-28
- Status: Open
- Options: URI (`/v1/...`) vs header. Version only on breaking changes (standards).

## D-014 — Currency unit
- Date: 2026-10-28
- Status: Open (shared with frontend D-011)
- Question: Prices as integer Rial or Toman, displayed in which unit. Store integers, never floats.

## D-015 — Docker setup
- Date: 2026-10-28
- Status: Proposed
- Decision: Multi-stage Dockerfile (non-root user, production deps only) plus `docker-compose` with app, PostgreSQL (TimescaleDB image), and Redis; env via `.env` (not committed) and a validated `.env.example`.
- Open: use the TimescaleDB image from day one or add it when telemetry starts; production orchestration (compose, Swarm, other).

## D-016 — Logging
- Date: 2026-10-28
- Status: Accepted
- Decision: `ILogger` abstraction over Pino via the global logger module, structured JSON, `LogMeta` fields as in `LOGGING_STANDARDS.md`.

## D-017 — Testing strategy
- Date: 2026-10-28
- Status: Accepted (E2E-first); Proposed details
- Decision: Jest + Supertest E2E for critical flows, PGlite as test database, isolated and deterministic.
- Risk: PGlite has no TimescaleDB; telemetry tests will need a real Postgres container.

## D-018 — Package manager
- Date: 2026-10-28
- Status: Open
- Options: pnpm (as in the frontend) vs npm (the dependency audit mentions `npm audit`).

## D-019 — Git workflow
- Date: 2026-10-28
- Status: Proposed
- Decision: GitHub Flow + Conventional Commits + Squash merge. Details: `GIT_WORKFLOW.md`.

## D-020 — Scope of the first version
- Date: 2026-10-28
- Status: Open
- Question: Which modules are in version one (foundation only, or shop domain too)? See `PROJECT.md` section 4.

## D-021 — Pagination response shape
- Date: 2026-11-01
- Status: Accepted
- Decision: Cursor-based. Response is `{ data, meta: { nextCursor: string | null } }`. `nextCursor: null` marks the last page; there is no `hasMore`.
- Reason: One field carries all the information; fewer fields to keep consistent.
- Open: default and max `limit`, sorting and filters with cursors, admin lists needing offset pagination.

## D-022 — Response and error envelopes
- Date: 2026-11-01
- Status: Accepted (current implementation); fixes Proposed
- Decision: Success `{ message, code, timestamp, path, data, meta }` via `ApiResponseInterceptor`; error `{ message, code, timestamp, path }` via `GlobalExceptionFilter`. Business errors use `AppError` subclasses (`ValidationError`, `NotFoundError`, `UnAuthorizedError`, `ForbiddenError`, `ConflictError`, `NonOperationalError`); rate limiting uses `TooManyRequestsException`.
- Proposed fixes (see `API_CONTRACT.md` section 3): stable uppercase `code` for every `HttpException`, pass `args` to i18n, `NonOperationalError` code to `INTERNAL_SERVER_ERROR`, confirm the throttler throws `TooManyRequestsException`.
- Open: per-field `errors` for `VALIDATION_ERROR`, registry of feature-specific error codes.

## D-023 — Language resolution
- Date: 2026-11-01
- Status: Accepted (current config); cleanup Proposed
- Decision: Order: query `lang`/`l`, headers `x-custom-lang` and `x-lang`, cookies `NEXT_LOCALE`/`i18n_lang`/`lang`/`locale`, then `Accept-Language`; fallback `en`.
- Proposed cleanup: remove duplicate resolver entries; keep a single custom header (`x-lang`). Frontend relies on the `NEXT_LOCALE` cookie by default.