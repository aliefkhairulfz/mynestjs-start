# Codebase Convention Report

Audit scope: all hand-written TypeScript in `src/`, `prisma/`, and `test/`, plus the project configuration and migration history. Generated Prisma files under `src/generated/prisma/` were inventoried but are generated output, not a hand-authored convention source. The project currently has one HTTP feature (`auth`), one scheduled job, and two global infrastructure providers; conclusions that need multiple feature examples are marked **Inferred** or **Not Found**.

## Architecture

**Observed.** This is a compact, hybrid feature-oriented NestJS application. HTTP feature files co-locate in `src/auth/`; DTOs sit under `src/auth/dto/`. Cross-cutting HTTP code is centralized as plural utility files in `src/utils/`. Global infrastructure lives in `src/db/` and `src/mailer/`; scheduled cleanup is its own `src/cron/` module. `AppModule` explicitly imports all feature and infrastructure modules ([`src/app.module.ts`](../../../../src/app.module.ts)). There is no repository/data-access layer: application services issue Prisma calls directly.

**Observed request flow.** For protected routes, the controller applies `AuthGuard`; the guard reads the `nestsession` cookie, asks `AuthService.getUser()` to validate it, and assigns `req.withUser`. The controller maps a request DTO and request metadata into a service input. The service performs validation/business rules, talks directly to the injected database and mailer, and returns a small plain object. The controller returns `{ data, message }`; the global response interceptor adds `{ ok, statusCode, meta }`. Errors thrown as `HttpException`s flow through the global filter. See [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts), [`src/utils/guard.ts`](../../../../src/utils/guard.ts), [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/main.ts`](../../../../src/main.ts).

**Inferred.** A new HTTP feature should be a top-level `src/<feature>/` directory containing `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, and `dto/<feature>.dto.ts`, then be imported from `AppModule`. That shape is projected from the only feature rather than repeated across multiple features.

**Not Found.** No domain/entity layer, repositories, CQRS, use-case classes, barrel exports, path aliases, shared feature module, or custom providers beyond global adapters.

## Folder Structure

**Observed.**

```text
src/
  auth/                 # HTTP controller, service, module, specs, dto/
  cron/                 # scheduled service and module
  db/                   # global Prisma provider token/type/module
  mailer/                # global Resend provider token/type/module
  templates/             # default-export email HTML generator
  utils/                 # guard, filter, interceptor, pipe, types, utilities, Express augmentation
  generated/prisma/      # Prisma output; do not hand-edit
  app.module.ts
  main.ts
prisma/
  schema.prisma
  migrations/
  seed.ts
```

**Observed.** Feature modules define local controllers/providers and export only a service consumed elsewhere (`AuthService`); global modules export their injection token ([`src/auth/auth.module.ts`](../../../../src/auth/auth.module.ts), [`src/db/db.module.ts`](../../../../src/db/db.module.ts), [`src/mailer/mailer.module.ts`](../../../../src/mailer/mailer.module.ts)).

**Not Found.** `src/modules/`, `src/common/`, `index.ts` barrels, request/response mapper directories, or per-feature repository folders.

## Database Architecture and Prisma Patterns

**Observed.** Prisma 7 is generated into `src/generated/prisma` with the `prisma-client` generator; MySQL is the schema provider and runtime client uses `PrismaMariaDb` ([`prisma/schema.prisma`](../../../../prisma/schema.prisma), [`src/db/db.module.ts`](../../../../src/db/db.module.ts)). `DbModule` is `@Global()` and provides a factory-created client under the string token `dbService = 'PrismaClient'`; consumers inject it with `@Inject(dbService) private readonly db: DbService`.

**Observed.** Hand-written query styles are direct and inline: `findFirst({ where: ... })` is used even for unique `User.email`; creates/updates/deletes use minimal inline `data`/`where` objects. Deep `include` is used only when `getUser` needs the user, join table, and roles. There are no `select` clauses, reusable selection constants, query builders, raw SQL, `findUnique`, `findMany`, `count`, aggregate/grouping, upsert, search, sort, cursor or offset pagination in app code. References: [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/cron/cron.service.ts`](../../../../src/cron/cron.service.ts).

**Observed transactions.** Multi-write domain changes use interactive callbacks: `this.db.$transaction(async tx => { ... })`. The callback writes user/account/user-role during account creation and user/verification during confirmation ([`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts)). Independent side effects, such as sending email and then creating a verification, remain outside those transactions. No array-form transaction, nested transaction, isolation level, or transaction helper appears.

**Observed schema conventions.** Models and Prisma fields are PascalCase/camelCase; tables and mapped columns are snake_case plural where needed. IDs are `String @id @default(uuid())`; models use `createdAt` and `updatedAt` mapped to timestamp columns. Relations specify scalar foreign keys and `onDelete: Cascade`; join models use compound unique constraints. `User.deletedAt` exists but has no soft-delete query behavior. `RoleName`, `ProviderId`, and `VerificationType` enum values are lowercase/camelCase. [`prisma/schema.prisma`](../../../../prisma/schema.prisma)

**Observed seed convention.** The standalone seed creates its own adapter/client and uses `createMany({ data, skipDuplicates: true })`, logs with `console`, assigns `process.exitCode` on failure, and disconnects in `finally` ([`prisma/seed.ts`](../../../../prisma/seed.ts)).

**Not Found.** Prisma exception mapping, a lifecycle hook that disconnects the injected client, query performance instrumentation, soft deletion policy, repository abstraction, pagination, or query composition helpers.

## Service Patterns

**Observed.** `AuthService` is an `@Injectable()` orchestration/service boundary. It constructor-injects global provider tokens plus `ConfigService`; it holds a local `Map` cache; its public async methods are domain/action named (`signUp`, `signIn`, `confirmVerification`, `googleSocialCallback`) rather than CRUD-generic. Inputs are destructured inline object types, and return types are usually inferred; `getUser` and `signOut` are explicit exceptions. It uses private helpers only for the guard’s token extraction, not in the service. [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts)

**Observed.** Services own business validation, password hashing, session lifecycle, network calls, mail calls, database calls, transaction boundaries, and domain exception selection. Controllers own HTTP extraction/cookies/redirects and thin DTO-to-service mapping. `CronService` directly injects the database and does one cleanup query ([`src/cron/cron.service.ts`](../../../../src/cron/cron.service.ts)).

**Inferred.** Call another service when a feature needs an existing domain capability, as `AuthGuard` calls `AuthService.getUser`; do not create an extra repository merely to wrap a single direct Prisma query.

**Not Found.** Standard `create/findOne/update/remove` service methods, interface-based services, separate domain models, or a shared service base class.

## Controller and Response Patterns

**Observed.** Controllers use `@Controller('auth')`, action-oriented kebab-case routes (`sign-up`, `confirm-verification`), `@Post`/`@Get`, `@HttpCode(HttpStatus.*)`, Swagger decorators, and public async methods without explicit return types. Each normal endpoint awaits one service method and returns `{ data, message: '<action> success' }`. `@Res({ passthrough: true })` is used only when setting/clearing a cookie; redirect endpoints use it with `@SkipResponseInterceptor()` and return `response.redirect(...)`. [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts)

**Observed.** The global interceptor converts normal controller output into:

```ts
{ ok: true, statusCode: response.statusCode, message, data, meta }
```

where absent `data` and `meta` become `{}` and absent `message` becomes `'success'` ([`src/utils/interceptors.ts`](../../../../src/utils/interceptors.ts)). Swagger response DTOs document the controller’s pre-interceptor `{ data, message }` payload—not the final wrapper—and have no class-transformer behavior ([`src/auth/dto/auth.dto.ts`](../../../../src/auth/dto/auth.dto.ts)).

**Not Found.** Versioned routes, `PUT`, `PATCH`, `DELETE`, a conventional resource REST route, response serializer classes, `ClassSerializerInterceptor`, pagination response metadata, or manual `res.status().json()` in normal endpoints.

## DTO, Validation, and Serialization Patterns

**Observed.** One feature DTO file contains `*ReqDto`, `*DataDto`, and `*ResDto` classes. Request properties use explicit `class-validator` decorators and custom messages, immediately preceded by `@ApiProperty`. Provider values use `@IsEnum(['credentials', 'google'])` with a literal-union property, not a generated Prisma enum. DTOs are passed into controllers, then mapped by property into smaller service input objects. [`src/auth/dto/auth.dto.ts`](../../../../src/auth/dto/auth.dto.ts), [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts)

**Observed.** `HttpCustomValidationPipe` is global with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled. It recursively converts validation failures to a dot-path map then throws `BadRequestException({ message: 'Validation Failed', error, statusCode: 400 })` ([`src/utils/pipes.ts`](../../../../src/utils/pipes.ts), registered in [`src/main.ts`](../../../../src/main.ts)).

**Not Found.** `class-transformer` decorators in source, mapped/update DTOs, nested/array DTO validation, custom validators, validation groups, request DTOs handed directly to Prisma, or response serialization transforms.

## Decorators, Guards, Interceptors, Filters, and Pipes

**Observed decorators.** `AuthGuardsIsOptional()` writes the literal `'optional'` metadata key; `Roles(...roles)` writes `ROLES_KEY = 'roles'`; `SkipResponseInterceptor()` writes `'skipResponseInterceptor'`. They are all simple `SetMetadata` wrappers in their owning utility files. `SkipResponseInterceptor` is used on two redirect actions; `AuthGuardsIsOptional` and `Roles` have no in-repository use site. [`src/utils/guard.ts`](../../../../src/utils/guard.ts), [`src/utils/interceptors.ts`](../../../../src/utils/interceptors.ts), [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts)

**Observed guards.** `AuthGuard` is method-applied via `@UseGuards(AuthGuard)`. It reads optional metadata from the handler only, extracts `req.cookies['nestsession']`, awaits `AuthService.getUser`, then mutates `req.withUser`. Missing/invalid sessions raise `UnauthorizedException`. `RolesGuard` reads class/handler role metadata and returns a boolean based on `request.withUser.roles`; it is implemented but not applied. The request augmentation is declared in [`src/utils/express.d.ts`](../../../../src/utils/express.d.ts).

**Observed interceptor.** A global interceptor gets `Reflector` manually in bootstrap, checks class/handler skip metadata, and uses `next.handle().pipe(map(...))`. It uses generic response types and `any` ([`src/utils/interceptors.ts`](../../../../src/utils/interceptors.ts)).

**Observed filter.** A global `@Catch(HttpException)` filter normalizes only `HttpException` to `{ ok: false, statusCode, message, errors }`, deriving `errors` only when `errorObject.error` is an object. It does not log or catch arbitrary errors ([`src/utils/filters.ts`](../../../../src/utils/filters.ts)).

**Not Found.** Parameter decorators such as `@CurrentUser`, authentication middleware, guard registration globally, filter chaining, Prisma-specific filters, exception logging, custom pipes beyond the global validation pipe, or interceptor-based logging/performance.

## Authentication and Authorization

**Observed.** Authentication is opaque, HMAC-SHA-256-hashed database sessions—not JWT or Passport. `signIn` checks credentials with bcrypt, creates a session whose stored token is hashed and expires in seven days, and the controller stores only the raw token in a configurable cookie. `getUser` checks a 15-minute in-memory cache first, then loads `Session → User → UserRole → Role`; expired DB sessions are deleted. `signOut` evicts the cache and deletes the session if present. [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/utils/utils.ts`](../../../../src/utils/utils.ts)

**Observed Google OAuth flow.** The controller creates a raw temporary cookie and hashed `state`, redirects to the configured authorization URL, validates cookie/state on callback, clears the temporary cookie, and delegates code exchange/user/account creation or update to the service. The service calls `fetch` directly and creates a normal app session. [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts), [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts)

**Observed authorization.** Roles are seeded as `user`, `admin`, `superadmin`; `UserRole` joins users to roles. `RolesGuard` and `Roles` exist, but no endpoint applies them. [`prisma/seed.ts`](../../../../prisma/seed.ts), [`src/utils/guard.ts`](../../../../src/utils/guard.ts)

**Not Found.** JWT, refresh-token rotation, Passport strategies, OAuth library, permissions, policy checks, an authorization service, or active role-protected endpoints.

## Configuration, Logging, and Observability

**Observed.** `ConfigModule.forRoot({ isGlobal: true })` makes `ConfigService` available. Injected providers/services use `config.getOrThrow<string>('KEY')`; `main.ts` and `utils/utils.ts` also read `process.env` directly. The database needs `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`; the runtime additionally references `FRONTEND_URL`, `PORT`, `AUTH_SECRET`, `APP_ENV`, `SESSION_COOKIE_NAME`, `GOOGLE_*`, `APP_MAIL_NAME`, and `RESEND_API_KEY`. [`src/app.module.ts`](../../../../src/app.module.ts), [`src/db/db.module.ts`](../../../../src/db/db.module.ts), [`src/auth/auth.controller.ts`](../../../../src/auth/auth.controller.ts), [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/utils/utils.ts`](../../../../src/utils/utils.ts)

**Observed.** Nest logging is disabled at bootstrap (`logger: false`). `@nestjs/observe` is configured with literal placeholder credentials, and the seed script uses `console.log/error`. There is no application `Logger` use. [`src/main.ts`](../../../../src/main.ts), [`src/app.module.ts`](../../../../src/app.module.ts), [`prisma/seed.ts`](../../../../prisma/seed.ts)

**Not Found.** Environment schema validation, configuration factories/namespaces, a custom logger, structured application logs, tracing configuration beyond the Observe module registration, request logging, or error reporting code.

## TypeScript, Naming, Imports, and Formatting

**Observed.** The compiler is strict ES2023 NodeNext ESM; hand-written relative imports end in `.js`, including type imports where `type` is used inline. No `paths` aliases are declared. Modules/classes are PascalCase, variables/methods/Prisma fields are camelCase, enum members are PascalCase but enum values are lowercase strings, routes are kebab-case, and files use lower-case dotted roles (`auth.service.ts`, `auth.dto.ts`, plural `utils/*.ts`). [`tsconfig.json`](../../../../tsconfig.json), [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`prisma/schema.prisma`](../../../../prisma/schema.prisma)

**Observed.** Source uses four spaces, single quotes, semicolons, trailing commas only when multiline, and braces even for short conditionals. Long argument lists and object types often remain one line. Public controller/service methods use `public`; injected class fields are `private readonly`; local aliases are `type`, not `interface`. JSDoc is common for public controllers/services and infrastructure, but absent on DTO fields and cron code. Import grouping/order is not consistent, so preserve nearby-file order rather than inventing sorting rules.

**Observed.** `any` is deliberately used in the response interceptor/filter and tests; strictness remains on. Tests use `unknown as Request/Response` where needed. [`oxlint.json`](../../../../oxlint.json), [`src/utils/interceptors.ts`](../../../../src/utils/interceptors.ts), [`src/auth/auth.service.spec.ts`](../../../../src/auth/auth.service.spec.ts)

## Errors, Performance, and Repeated Patterns

**Observed error choices.** `ConflictException` signals an existing credentials account; `UnauthorizedException` covers invalid credentials/sessions, unverified account handling, and OAuth failures; `NotFoundException` covers a missing user/default role; `BadRequestException` covers malformed or expired verification and already-verified email. The global validation pipe uses `BadRequestException`. There is no `ForbiddenException` use. [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/utils/pipes.ts`](../../../../src/utils/pipes.ts)

**Observed performance behavior.** A `Map` caches valid session payloads for 15 minutes, tokens are indexed in the schema, expired sessions are deleted hourly, and the auth query loads relations in one nested `include` where necessary. There is no general caching, batching, N+1 policy, selection minimization, or API pagination. [`src/auth/auth.service.ts`](../../../../src/auth/auth.service.ts), [`src/cron/cron.service.ts`](../../../../src/cron/cron.service.ts), [`prisma/schema.prisma`](../../../../prisma/schema.prisma)

**MUST FOLLOW (repeated/centralized).** Use `DbService` via the `dbService` token; return `{ data, message }` from normal controllers; rely on the global interceptor/filter/pipe; use `.js` relative ESM imports; validate requests in DTOs; throw Nest HTTP exceptions for anticipated client/domain errors; preserve session token hashing and cookie helpers for auth work.

**PREFERRED (one feature but internally consistent).** Use direct `findFirst({ where })` query objects, inline destructured service inputs, action-oriented service and authentication route names, `@Api*` controller documentation, and `@HttpCode` on actions.

**CONTEXT-DEPENDENT.** Use an interactive Prisma transaction only for DB changes that must commit together; use `include` only where relation data is needed; bypass response wrapping for redirects; use a `Map` cache only when a bounded, invalidatable identity/session cache is appropriate.

**DO NOT.** Hand-edit `src/generated/prisma`; instantiate `PrismaClient` inside app services; return final wrapper fields from controllers; add Prisma error mapping/response serialization/repositories/pagination as if they already existed; imply active RBAC enforcement merely because `RolesGuard` exists; or treat `deletedAt` as enforced soft deletion.

## Testing

**Observed.** Unit tests live next to auth source and use Vitest plus `@nestjs/testing`. They create `TestingModule`s, provide `any`-typed `vi.fn()` mocks under the string provider tokens, mock imported helpers/modules, and assert thrown Nest exception classes and exact Prisma calls. Controller tests override `AuthGuard`. [`src/auth/auth.service.spec.ts`](../../../../src/auth/auth.service.spec.ts), [`src/auth/auth.controller.spec.ts`](../../../../src/auth/auth.controller.spec.ts)

**Observed caution.** An e2e test exists but expects a root `Hello World!` response and refers to `AppController`, which the current source tree does not contain; it is stale relative to the implementation ([`test/app.e2e-spec.ts`](../../../../test/app.e2e-spec.ts)).

**Not Found.** Factories, fixtures, a test database, test containers, integration tests against Prisma, or a reliable current e2e convention.
