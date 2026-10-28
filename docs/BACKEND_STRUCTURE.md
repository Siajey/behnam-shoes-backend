# BACKEND_STRUCTURE.md — Folder Structure (NestJS + Fastify)

## Core idea
Package-by-feature, with one-way dependencies inside every feature:

```
Presentation  ──►  Application  ──►  Domain
(controllers,      (use cases,        (entities,
 DTOs, guards)      repository ports)  domain exceptions)
```

- Application and Domain never import NestJS APIs.
- Infrastructure (Drizzle repositories, Redis, R2, mail) implements the ports defined by the Application layer.
- `infrastructure/` and `common/` must be copyable into the next project as they are.

## Proposed tree
```
.
├─ docs/                       PROJECT.md, DECISIONS.md, BACKEND_STRUCTURE.md, LOGGING_STANDARDS.md, GIT_WORKFLOW.md
├─ drizzle/                    generated migrations (committed, never edited after applying)
├─ test/                       E2E tests (Supertest + PGlite), helpers, factories
├─ docker/                     Dockerfile, compose files, init scripts
├─ src/
│  ├─ main.ts                  Fastify adapter, Helmet, CORS, Swagger, versioning
│  ├─ app.module.ts
│  ├─ config/                  env.ts (Zod-validated env), config module
│  ├─ common/                  cross-cutting only: exception filter, interceptors, pipes, decorators, response envelope
│  ├─ infrastructure/          global / dynamic modules (forRoot / forRootAsync)
│  │  ├─ logger/               ILogger, LogMeta, Pino implementation
│  │  ├─ database/             postgres client, Drizzle provider, transaction helper
│  │  ├─ cache/                Cache Manager + Keyv Redis
│  │  ├─ storage/              R2 (S3 SDK) + presigner
│  │  ├─ mail/                 Resend + Nodemailer
│  │  ├─ resilience/           Opossum circuit breaker, retry and timeout helpers
│  │  └─ i18n/                 nestjs-i18n setup + translation files
│  └─ modules/
│     ├─ auth/
│     ├─ sessions/
│     ├─ users/
│     ├─ health/
│     ├─ posts/
│     └─ <feature>/
│        ├─ presentation/      controllers, dto (Zod schemas), guards, mappers (domain → response)
│        ├─ application/       use cases (create-user.usecase.ts), ports (user-repository.port.ts → IUserRepository)
│        ├─ domain/            entities, value objects, domain exceptions
│        ├─ infrastructure/    drizzle schema, repository implementation (user.repository.ts)
│        ├─ <feature>.module.ts
│        └─ index.ts           public contract only
└─ .env.example                no real values
```
☐ Drizzle schemas per feature (inside each module) vs one central schema folder. See D-005 and the open items in `DECISIONS.md`.

## Rules (enforce by ESLint or PR review)
1. **Layer rule:** `domain` imports nothing from `application`, `presentation`, `infrastructure` or `@nestjs/*`. `application` imports only `domain`.
2. **Use cases are plain classes.** Wire them in the feature module with factory providers and Symbol tokens (D-005, proposed).
3. **Module boundaries:** other modules import only from a feature's `index.ts` (public application contracts), never from its internals.
4. **DTOs belong to controllers.** Never share DTOs across modules; never return domain entities. Map to response DTOs in `presentation/mappers`.
5. **Zod only.** Validate at the boundary (controller pipe); schemas live beside their DTOs.
6. **Errors:** throw domain exceptions in Domain/Application; one global exception filter in Presentation maps them to HTTP.
7. **Guard order:** CSRF → Authentication → Authorization. Guards, interceptors, pipes and decorators live in Presentation (or `common/`).
8. **Repositories:** Application depends on `IXxxRepository`; Drizzle code stays in `infrastructure/`. Use transactions when several writes must succeed together.
9. **Config:** only `config/env.ts` reads `process.env`; the app fails fast on invalid env.
10. **Logging:** depend on `ILogger` only, never on Pino directly; follow `LOGGING_STANDARDS.md`.
11. **`common/` is not a dumping ground:** only truly cross-cutting code.
12. **Dead code is removed promptly; comments explain why, not what.**

## Naming
| Thing        | Convention                   | Example                                                               |
|--------------|------------------------------|-----------------------------------------------------------------------|
| Files        | kebab-case with dot suffixes | `create-user.usecase.ts`, `user.repository.ts`, `login.controller.ts` |
| Classes      | PascalCase, business names   | `AuthService`, `CreateUserUseCase`                                    |
| Interfaces   | `I` prefix                   | `IUserRepository`, `ILogger`                                          |
| Variables    | camelCase                    | `userId`, `createdAt`                                                 |
| DB objects   | snake_case, plural tables    | `blog_posts`, `created_at`                                            |
| Log events   | dot-notation                 | `auth.login`, `user.password.change`                                  |
| Log `module` | exact class name             | `SessionValidator`                                                    |

## Where things go
| Thing                                            | Location                                           |
|--------------------------------------------------|----------------------------------------------------|
| Login endpoint, request/response DTOs            | `modules/auth/presentation`                        |
| "Create user" business flow                      | `modules/users/application/create-user.usecase.ts` |
| User table definition, repository implementation | `modules/users/infrastructure`                     |
| `UserNotFoundException`                          | `modules/users/domain`                             |
| Auth guard, CSRF guard                           | `modules/auth/presentation/guards`                 |
| Env validation                                   | `config/env.ts`                                    |
| R2 presigned URL logic                           | `infrastructure/storage`                           |
| Global exception filter, response envelope       | `common/`                                          |
| Translations                                     | `infrastructure/i18n`                              |

## Docker (proposed)
- `docker/Dockerfile`: multi-stage (deps → build → runtime), non-root user, production dependencies only.
- `docker/compose.yml`: `app`, `postgres` (TimescaleDB image, see D-015), `redis`; healthchecks on all; env from `.env`.
- Migrations run as a separate step (`drizzle-kit migrate`) before the app starts, not on every app boot.

## Reuse in the next project
- Copy or extract `infrastructure/`, `common/`, `config/`, and the foundation modules (auth, sessions, users, health) into a shared package or template repo.
- Project-specific domain modules, env values, and translations stay in each project.