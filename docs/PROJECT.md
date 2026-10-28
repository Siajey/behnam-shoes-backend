# PROJECT.md — Backend (NestJS)

> This file is the project's memory. Start every new AI chat by pasting this file (plus the relevant parts of `DECISIONS.md`).
> Items marked ☐ are not decided yet. Once decided, record them in `DECISIONS.md` and update this file.

## 1. Summary
- A reusable, Dockerized backend built with NestJS + Fastify.
- Serves the online shoe shop frontend (separate repo) through an OpenAPI contract. ☐ confirm scope (see section 4).
- Second goal: infrastructure (config, DB, cache, storage, mail, logging, i18n) that can be reused in future projects.
- Project name: ☐   Domain / hosting: ☐

## 2. Team and responsibilities
| Role                         | Responsibility                                                                                 |
|------------------------------|------------------------------------------------------------------------------------------------|
| Frontend developer (Siavash) | Frontend repo (Next.js), consumes the API                                                      |
| Backend developer            | This repo, owns and maintains the API contract                                                 |
| AI                           | Proposes design and architecture, generates code, reviews (final decisions belong to the team) |

Frontend and backend are separate repos. The coordination point is the **OpenAPI/Swagger contract**.

## 3. Stack (all mandatory)
| Area       | Technology                                                                                            |
|------------|-------------------------------------------------------------------------------------------------------|
| Framework  | NestJS v11.x, Fastify, TypeScript                                                                     |
| Validation | Zod (only)                                                                                            |
| Auth       | JWT (jsonwebtoken), Passport, Google OAuth2, Fastify Secure Session, bcryptjs                         |
| Database   | PostgreSQL (`postgres` driver), Drizzle ORM + Drizzle Kit, TimescaleDB extension (telemetry, planned) |
| Test DB    | PGlite (embedded Postgres)                                                                            |
| Cache      | Redis, Cache Manager, Keyv Redis                                                                      |
| Storage    | Cloudflare R2 via AWS SDK S3, pre-signed upload URLs                                                  |
| Email      | Resend (sending), ImprovMX (receiving/forwarding), Nodemailer (SMTP)                                  |
| Security   | Helmet, CORS, NestJS Throttler, Fastify Multipart/Static                                              |
| Logging    | NestJS Pino (structured JSON), Pino Pretty (dev only), `ILogger` abstraction                          |
| Resilience | Opossum circuit breaker, retries, timeouts, fallbacks                                                 |
| i18n       | nestjs-i18n                                                                                           |
| Testing    | Jest, ts-jest, Supertest (E2E-first)                                                                  |
| Tooling    | ESLint, Prettier, Docker                                                                              |
| Planned    | Sentry, OpenTelemetry, Prometheus, Grafana, Loki                                                      |

Known exception: `@fastify/static` latest fix needs v10.x, but NestJS Platform Fastify supports only v8.x/v9.x. Waiting for upstream.

## 4. Modules
- Foundation: Authentication, Session Management, User Management, Health, Blog/Posts (reference modules).
- ☐ Shop domain (needed by the frontend; confirm): Products (variants: color/size/stock), Categories, Brands, Cart (server-side or client-only?), Orders and status, Addresses, Favorites, Discounts, Admin endpoints, Site settings, Image upload.
- ☐ Planned later: Energy Storage / telemetry (TimescaleDB).

## 5. Architecture principles (details: `BACKEND_STRUCTURE.md`)
1. Clean Architecture, package-by-feature: Presentation → Application → Domain. Application and Domain never import NestJS APIs.
2. Features talk only through public application contracts, never through internals.
3. Controllers own DTOs; domain entities are never returned from APIs.
4. Zod validates all external input at the boundary.
5. Domain exceptions for business rules, mapped to HTTP in the Presentation layer.
6. Repositories are abstractions (`IUserRepository`); Drizzle lives in infrastructure.
7. Infrastructure (DB, cache, storage, mail, logger, i18n) lives in global/dynamic modules.
8. Guard order: CSRF → Authentication → Authorization.
9. Secrets only in environment variables, validated at startup with Zod.
10. Logging follows `LOGGING_STANDARDS.md`; never log secrets or tokens.

## 6. Database rules (checklist summary)
- snake_case, plural table names, explicit VARCHAR lengths, phone numbers as VARCHAR.
- UUID for security-sensitive entities; serial/bigserial for high-volume tables; never natural keys.
- `timestamptz` everywhere; `created_at` and `updated_at` on every table; `deleted_at` on important records and checked in every read.
- No persisted derived data. Review nullable columns deliberately.
- Composition → `ON DELETE CASCADE`; aggregation → `ON DELETE SET NULL` (decided per entity pair).
- Cursor-based pagination, transactions for multi-step writes, UTF8 encoding.

## 7. Contract with the frontend
- Swagger/OpenAPI served at `/api-json`; the frontend generates types from it.
- ☐ To agree with the frontend developer: error shape, pagination shape, auth (cookie vs token), image upload flow, currency unit (see `DECISIONS.md`).
- Until endpoints exist, the OpenAPI file is the source of truth, so the frontend can mock against it.

## 8. Roadmap
| Phase | Work                                                           | Verifiable output                   |
|-------|----------------------------------------------------------------|-------------------------------------|
| 0     | Repo, Docker, config, lint, CI, git rules                      | App boots in Docker, CI green       |
| 1     | Infrastructure modules: logger, DB, cache, health              | Health endpoint, structured logs    |
| 2     | Users, Authentication, Sessions, Google OAuth                  | E2E auth flows                      |
| 3     | Storage (R2 presign), Email (Resend), i18n                     | Upload + email flows                |
| 4     | Shop domain modules ☐                                          | OpenAPI covers frontend needs       |
| 5     | Security hardening, resilience, rate limits                    | Throttling, circuit breakers tested |
| 6     | Observability (Sentry, OpenTelemetry, Prometheus/Grafana/Loki) | Dashboards and alerts               |
| 7     | Telemetry (TimescaleDB) ☐                                      | Ingestion architecture ADR          |

## 9. Definition of done (per feature)
- Matches the standards (layers, DTOs, Zod, naming).
- Migration generated and reviewed; schema follows the checklist.
- E2E test for the critical flow; deterministic and isolated.
- Logs follow the standards; no sensitive data logged.
- OpenAPI updated; frontend informed of changes.
- Lint and type-check clean; PR reviewed and merged.

## 10. Working with AI in this project
1. Each session: PROJECT.md + relevant `DECISIONS.md` section + the goal of that session.
2. Keep chats short and focused on one feature.
3. The AI must ask for an opinion on every decision, however small, before implementing it.
4. End of session: ask the AI to summarize new decisions for `DECISIONS.md`.
5. Run and review all generated code, especially auth, sessions, permissions, and payments.