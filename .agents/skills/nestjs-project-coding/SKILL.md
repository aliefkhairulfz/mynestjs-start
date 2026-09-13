---
name: nestjs-project-coding
description: Implement or review NestJS features in this mynestjs-start repository while matching its direct-Prisma, cookie-session, DTO, response, and utility conventions.
metadata:
  short-description: Match this repository's NestJS conventions
---

# NestJS Project Coding Skill

Use this skill for changes inside this repository. The existing application—not generic NestJS advice—is authoritative. Before editing, inspect the closest relevant hand-written source file and consult the evidence report when a rule involves a subsystem you are changing: [codebase convention report](references/codebase-convention-report.md).

Priority order:

```text
Existing nearby implementation
> existing project abstraction
> this skill's evidence-backed guidance
> NestJS convention
> generic best practice
```

The codebase is small. Absence is meaningful: do not manufacture repositories, base classes, serializers, pagination systems, Prisma error filters, path aliases, JWT/Passport, or a new abstraction merely because they are common elsewhere.

## 1. Core Principles

- Preserve the compact hybrid structure: feature code at `src/<feature>/`, cross-cutting HTTP concerns in `src/utils/`, global adapters in dedicated top-level modules, and Prisma schema/migrations in `prisma/`.
- Use generated Prisma output only through imports. Never hand-edit `src/generated/prisma/`.
- Prefer a small controller-to-service mapping and direct Prisma access in the service. There is no repository layer.
- Check current sources and types before changing an existing behavior. `todo.md` and `--FuturePlan` comments describe unresolved intent; do not silently treat them as shipped behavior.

References: [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts), [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/db/db.module.ts`](../../../src/db/db.module.ts).

## 2. Architecture

The implemented protected-request path is:

```text
cookie request
  -> method-level AuthGuard
  -> AuthService.getUser() and req.withUser
  -> controller DTO/request mapping
  -> feature service
  -> injected DbService / mailer
  -> controller { data, message }
  -> global response interceptor
```

Exceptions thrown as `HttpException` pass through the global `HttpExceptionFilter`; the validation pipe runs globally before controllers. For a redirect, mark the action with `@SkipResponseInterceptor()`.

References: [`src/main.ts`](../../../src/main.ts), [`src/utils/guard.ts`](../../../src/utils/guard.ts), [`src/utils/interceptors.ts`](../../../src/utils/interceptors.ts), [`src/utils/filters.ts`](../../../src/utils/filters.ts).

## 3. Folder Structure

For a conventional new HTTP feature, follow the observed auth layout:

```text
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.controller.spec.ts       # when controller behavior is added
  <feature>.service.spec.ts          # when service behavior is added
  dto/
    <feature>.dto.ts
```

Add its module to `AppModule`. Put a global adapter in its own `@Global()` module only when it really is application-wide. Put reusable HTTP concerns in the existing focused files under `src/utils/`; do not make `common/` or barrel exports.

This exact new-feature layout is an inference from `auth`, the only HTTP feature. Keep a simpler structure for a scheduled job like `cron` when no controller/DTO is involved.

## 4. Module Conventions

- Import `Module` from `@nestjs/common` and use an explicit `@Module({ ... })` literal.
- Feature modules list their `controllers`, `providers`, and export a service only when another component needs it. `AuthModule` exports `AuthService` because `AuthGuard` calls it.
- The database and mailer are global modules. Do not add them to each feature's `imports`.
- Keep relative ESM imports ending in `.js`.

Reference: [`src/auth/auth.module.ts`](../../../src/auth/auth.module.ts), [`src/db/db.module.ts`](../../../src/db/db.module.ts), [`src/mailer/mailer.module.ts`](../../../src/mailer/mailer.module.ts).

## 5. Controller Conventions

- Use a feature prefix with `@Controller('<feature>')`; existing auth endpoints use action-oriented, kebab-case suffixes such as `sign-up` and `confirm-verification`, not a demonstrated resource CRUD vocabulary.
- Use `@Post`/`@Get` and an explicit `@HttpCode(HttpStatus.*)` for each documented action.
- Tag/document actions with `@ApiTags`, `@ApiOperation`, and `@ApiResponse`. The response DTO type represents the controller return `{ data, message }`, not the final interceptor envelope.
- Keep normal actions thin: obtain input with `@Body`, `@Req`, or `@Query`, map DTO properties into the service call, await it, and return `{ data, message: '<action> success' }`.
- Use `@UseGuards(AuthGuard)` directly on protected methods. Get the resulting user from `req.withUser`; the Express augmentation is already declared.
- Use `@Res({ passthrough: true })` only for side effects such as setting/clearing a cookie. For a redirect, call `response.redirect(...)` and add `@SkipResponseInterceptor()`.
- Keep provider-specific state/cookie mechanics in the controller and domain/database mechanics in the service, as Google OAuth does.

Do not manually add `ok`, `statusCode`, or `meta` to normal controller returns. The global interceptor owns them.

Reference: [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts), [`src/utils/interceptors.ts`](../../../src/utils/interceptors.ts).

## 6. Service Conventions

- Declare an `@Injectable()` service. Use constructor parameter properties, `private readonly` dependencies, and `@Inject(token)` for global string-token providers.
- Name public async methods for the application action (`signUp`, `resendVerification`, `googleSocialCallback`) rather than impose `create/findOne/update/remove` CRUD names.
- Accept compact destructured inline object types at the service boundary when that mirrors auth. Map from request DTOs in the controller rather than pass DTO instances straight to Prisma.
- Services own business checks, domain exceptions, Prisma calls, transactions, hashing, provider calls, mail calls, and small local state such as the session cache.
- Add a private helper only when a piece is reused within the class or hides a focused concern; `AuthGuard.extractToken` is the current example. Do not split every query into a repository/helper.
- Explicit async return types are not universal: `getUser(): Promise<UserSessionData>` and `signOut(): Promise<boolean>` declare them, while action methods infer. Match the closest method.

References: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/cron/cron.service.ts`](../../../src/cron/cron.service.ts).

## 7. DTO Conventions

- Put feature DTOs together in `dto/<feature>.dto.ts`.
- Name request classes `ActionReqDto`, Swagger-only data classes `ActionDataDto`, and Swagger response classes `ActionResDto`.
- Put `@ApiProperty(...)` immediately above validators. Use specific `class-validator` decorators and custom messages, e.g. `@IsNotEmpty`, `@IsString`, `@IsEmail`, `@MinLength`, `@IsEnum`.
- Use explicit field declarations and literal unions where the feature currently needs them; auth uses `'credentials' | 'google'` instead of importing a Prisma enum into the request DTO.
- Treat response DTOs as Swagger metadata. They do not serialize or transform runtime responses.

The global `HttpCustomValidationPipe` whitelists, rejects extra fields, transforms inputs, and creates the project validation error format. Do not add an endpoint-local generic `ValidationPipe` that changes this behavior.

References: [`src/auth/dto/auth.dto.ts`](../../../src/auth/dto/auth.dto.ts), [`src/utils/pipes.ts`](../../../src/utils/pipes.ts), [`src/main.ts`](../../../src/main.ts).

## 8. Prisma / Database Conventions

- Model the schema in `prisma/schema.prisma`; generate client output to `src/generated/prisma` and never modify it manually.
- Use PascalCase model names and camelCase Prisma fields. Map database table/column names to snake_case with `@@map`/`@map` where consistent with the existing schema.
- New standard entities should assess whether this established shape applies: string UUID primary key, `createdAt` with `@default(now())`, `updatedAt @updatedAt`, mapped timestamps, explicit relation scalar field, and cascading foreign key. Do not add `deletedAt` policy only because User has an unused one.
- Inject the existing database provider exactly as follows:

```ts
import { type DbService, dbService } from '../db/db.module.js';

constructor(@Inject(dbService) private readonly db: DbService) {}
```

- Do not instantiate `PrismaClient` in an application service. The seed script is a standalone exception because it runs outside Nest.

References: [`prisma/schema.prisma`](../../../prisma/schema.prisma), [`src/db/db.module.ts`](../../../src/db/db.module.ts), [`prisma/seed.ts`](../../../prisma/seed.ts).

## 9. Query Conventions

- Write direct, minimal, inline Prisma calls in the service: `this.db.model.findFirst({ where: { ... } })`, then `create`, `update`, `delete`, or `deleteMany` as needed.
- Existing code uses `findFirst` for user email and other lookups, including fields that are unique in the schema. Match that nearby pattern rather than mechanically substituting `findUnique`.
- Build `where`, `data`, and `include` inline next to their query. There are no selection constants, repository query builders, `select` style, or generic query composition utilities.
- Use `include` only when the operation needs relations. `getUser` loads `user → userRoles → role` in a single nested include to construct its response/cache payload.
- Compound unique updates use generated compound selector keys when updating, e.g. `where: { userId_providerId: { userId, providerId: 'google' } }`.

There is no established app pattern for `findUnique`, `findMany`, filters/search, ordering, `skip/take`, cursor pagination, aggregates, groupBy, upsert, raw SQL, or `select`. Design them only when the feature requires them, and document the decision rather than presenting an invented repository convention.

Reference: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/cron/cron.service.ts`](../../../src/cron/cron.service.ts).

## 10. Transaction Conventions

- Use `this.db.$transaction(async tx => { ... })` when several database writes represent one atomic state change.
- Issue every atomic operation through `tx`, and perform required lookup/exception checks inside the callback when their correctness depends on the transaction.
- Follow `signUp` (user + account + user role) and `confirmVerification` (user update + verification deletion) as the templates.
- Keep one independent mutation as a regular client call. Do not introduce array-form transactions, custom transaction wrappers, nesting, isolation options, or generic retries without a concrete requirement; none are established.
- External effects are not currently transactional: mail sending happens separately from verification persistence. Preserve/handle this deliberately instead of claiming an outbox exists.

Reference: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts).

## 11. Response Conventions

Normal controller output is pre-interceptor:

```ts
return { data, message: 'action success' };
```

The global `HttpResponseInterceptor` produces the final HTTP success shape:

```ts
{
    ok: true,
    statusCode: response.statusCode,
    message,
    data: data ?? {},
    meta: meta ?? {}
}
```

For an action with no data, return `{ message: 'sign-out success' }`; it will get `data: {}`. For an HTTP response that must not be wrapped (the two OAuth redirects), add `@SkipResponseInterceptor()`.

Reference: [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts), [`src/utils/interceptors.ts`](../../../src/utils/interceptors.ts).

## 12. Error Handling

Throw Nest HTTP exceptions from the boundary that owns the business condition. Current semantic choices are:

- `BadRequestException`: request is semantically invalid for the action—invalid/expired verification token, already verified email, or global DTO validation.
- `UnauthorizedException`: credentials, session, verified-account gate, OAuth state, or provider authentication failure.
- `ConflictException`: an incompatible existing credentials account.
- `NotFoundException`: a resource required by the action does not exist, such as a user in resend verification or the seeded default role.
- `ForbiddenException`: no application use exists. Do not introduce a project-wide meaning without the authorization requirement that needs it.

Throw messages as concise strings where current auth does. The global filter catches only `HttpException` and yields:

```ts
{ ok: false, statusCode, message, errors }
```

The filter does not translate Prisma errors or log unexpected errors. Do not claim it does; add a mapping only when a request explicitly requires it and test it.

References: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/utils/pipes.ts`](../../../src/utils/pipes.ts), [`src/utils/filters.ts`](../../../src/utils/filters.ts).

## 13. Custom Decorators

Use a simple `SetMetadata` wrapper only for behavior that will be read by a guard/interceptor. Existing patterns are:

```ts
export const AuthGuardsIsOptional = () => SetMetadata('optional', true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const SkipResponseInterceptor = () => SetMetadata(SKIP_RESPONSE_INTERCEPTOR, true);
```

Keep key and reader co-located: guard metadata in `utils/guard.ts`, response bypass metadata in `utils/interceptors.ts`. Do not create a parameter decorator such as `@CurrentUser()` merely to shorten `@Req()`—none exists yet.

References: [`src/utils/guard.ts`](../../../src/utils/guard.ts), [`src/utils/interceptors.ts`](../../../src/utils/interceptors.ts).

## 14. Guards

- Protect an action with `@UseGuards(AuthGuard)`.
- `AuthGuard` extracts the session from `req.cookies['nestsession']`, calls `AuthService.getUser`, and assigns `req.withUser`.
- Optional auth currently works only when `AuthGuardsIsOptional()` metadata is on the handler; the guard checks `get` on `context.getHandler()`, not class metadata.
- `RolesGuard` requires `AuthGuard` first because it reads `req.withUser`; it returns false on absent user and checks `currentUser.roles.includes(role)`. It exists but is not applied anywhere.

Do not say a route has RBAC enforcement until it actually applies both necessary guard behavior.

References: [`src/utils/guard.ts`](../../../src/utils/guard.ts), [`src/utils/express.d.ts`](../../../src/utils/express.d.ts), [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts).

## 15. Interceptors

The sole interceptor is a global `HttpResponseInterceptor`. It obtains skip metadata with `Reflector.getAllAndOverride`, calls `next.handle()`, and transforms results with RxJS `map`. Add another interceptor only for a real cross-cutting requirement. Preserve the response envelope behavior and exclude endpoints such as redirects explicitly with `@SkipResponseInterceptor()`.

Reference: [`src/utils/interceptors.ts`](../../../src/utils/interceptors.ts), [`src/main.ts`](../../../src/main.ts).

## 16. Filters

`HttpExceptionFilter` is registered globally and only catches `HttpException`. Expected client/domain failures should therefore use Nest HTTP exceptions. Its validation error convention relies on an `error` object in the exception response. Keep the wrapper consistent if changing validation behavior. There is no observed catch-all or Prisma-specific filter.

Reference: [`src/utils/filters.ts`](../../../src/utils/filters.ts), [`src/main.ts`](../../../src/main.ts).

## 17. Pipes

Do not duplicate the existing global pipe. `HttpCustomValidationPipe` uses `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`, flattening nested validation errors to dot paths. Use class-validator decorators in DTOs to participate in it. No endpoint demonstrates parser pipes or custom transforms.

Reference: [`src/utils/pipes.ts`](../../../src/utils/pipes.ts).

## 18. Authentication

- The application uses HMAC-hashed opaque sessions in the database, not JWTs. Generate raw/hashed token pairs with `generateTokenWithHash()` and hash a presented token with `hashToken()`.
- Store the raw session token only in an HTTP-only configurable cookie with `setSessionCookie`; persist only its hash in `Session.token`.
- Create a seven-day session with `addDays(new Date(), 7)` and retain IP/user-agent when available.
- Use `AuthService.getUser()` for validation; it loads user roles and maintains a 15-minute `Map` cache. Invalidate that cache during sign-out.
- Cookie domain/security options live in `setSessionCookie`/`clearSessionCookie`; do not reproduce them ad hoc in another controller.

Google OAuth is direct URL + `fetch` code, with a temporary cookie/state hash before redirect. Use its existing flow for extensions rather than adding Passport.

References: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts), [`src/utils/utils.ts`](../../../src/utils/utils.ts).

## 19. Authorization / RBAC

The schema has `Role` and `UserRole`; the seed creates `user`, `admin`, and `superadmin`. The implementation supplies `Role`, `Roles`, and `RolesGuard`, but none of the current endpoints use `RolesGuard`. When a new requirement truly needs role enforcement, follow that guard’s metadata shape and test guard order with `AuthGuard`. Do not invent permissions or policies.

References: [`prisma/schema.prisma`](../../../prisma/schema.prisma), [`prisma/seed.ts`](../../../prisma/seed.ts), [`src/utils/guard.ts`](../../../src/utils/guard.ts).

## 20. Configuration

- Use injected `ConfigService` and `getOrThrow<string>('KEY')` in services/modules/controllers, matching database, mailer, and OAuth code.
- `ConfigModule.forRoot({ isGlobal: true })` is already in `AppModule`; do not re-register it in a feature.
- `main.ts` and `utils/utils.ts` currently read environment variables directly. Keep work next to those existing bootstrap/helper patterns consistent, but favor injected `ConfigService` in Nest-managed classes.
- There is no schema/factory/default policy. Do not present one as existing.

References: [`src/app.module.ts`](../../../src/app.module.ts), [`src/db/db.module.ts`](../../../src/db/db.module.ts), [`src/mailer/mailer.module.ts`](../../../src/mailer/mailer.module.ts).

## 21. Logging

Nest logging is explicitly disabled in bootstrap. Observe is registered with placeholder app credentials; only `prisma/seed.ts` writes console logs. Do not add `Logger` calls or claim structured logging/tracing is implemented unless the task creates that capability.

References: [`src/main.ts`](../../../src/main.ts), [`src/app.module.ts`](../../../src/app.module.ts), [`prisma/seed.ts`](../../../prisma/seed.ts).

## 22. TypeScript Conventions

- Target strict, NodeNext ESM TypeScript. Use `.js` suffixes for local runtime imports.
- Use `type` aliases for object contracts such as request payloads, cache entries, and provider aliases; no hand-written interfaces exist except Express module augmentation.
- Use `type` inline imports when appropriate (`import { type DbService, dbService } ...`).
- Public controller/service methods commonly declare `public`; injected dependencies are `private readonly` constructor parameter properties.
- Match nearby return typing: do not universally add or omit it. Infer ordinary action results; explicitly name shared/important payload results where it aids the existing code style.
- `any` exists intentionally in tests and generic HTTP utility boundaries; do not spread it into feature/domain code when a concrete type is readily available.

References: [`tsconfig.json`](../../../tsconfig.json), [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/utils/types.ts`](../../../src/utils/types.ts).

## 23. Naming Conventions

- Files: `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.module.ts`, `dto/<feature>.dto.ts`; utility files are plural lowercase nouns (`guards` is singular in the actual `guard.ts`, `filters.ts`, `pipes.ts`, `interceptors.ts`, `utils.ts`). Tests sit next to source as `*.spec.ts`.
- Classes: PascalCase with role suffixes (`AuthService`, `HttpExceptionFilter`, `SignUpReqDto`).
- Methods/variables: camelCase. Actions are verb-first (`signIn`, `getUser`, `handleCron`).
- Routes: lowercase kebab-case action names.
- Prisma: PascalCase models; camelCase model fields; snake_case mapped database names; lowercase/camelCase enum values.

References: [`src/auth/`](../../../src/auth/), [`src/utils/`](../../../src/utils/), [`prisma/schema.prisma`](../../../prisma/schema.prisma).

## 24. Import / Export Conventions

- Use only relative local imports; no alias is configured despite `vite-tsconfig-paths` being present.
- End local runtime paths in `.js`.
- Import values and types together with `type` modifiers when nearby code does, e.g. `import { type Request, type Response } from 'express';`.
- Avoid barrels; import the defining file directly.
- Import ordering is inconsistent across current files. Preserve the ordering/grouping style of the file you modify instead of adding a new sorting rule.

References: [`src/auth/auth.controller.ts`](../../../src/auth/auth.controller.ts), [`src/db/db.module.ts`](../../../src/db/db.module.ts), [`tsconfig.json`](../../../tsconfig.json).

## 25. Validation

Use request DTO decorators as the validation contract. Expected validation failures must flow through the global pipe, producing `BadRequestException` with `message: 'Validation Failed'` and an error map. Keep semantic business checks (record exists, verified state, duplicate account) in the service after validation.

References: [`src/auth/dto/auth.dto.ts`](../../../src/auth/dto/auth.dto.ts), [`src/utils/pipes.ts`](../../../src/utils/pipes.ts), [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts).

## 26. Pagination

No pagination response, query DTO, `findMany`, `skip/take`, or cursor convention exists. Do not add pagination preemptively. If a new list feature requires it, inspect the requirement and design its DTO/query/response deliberately; label it as new project behavior and test it rather than claiming it is an existing convention.

## 27. Performance

Existing specific patterns are a 15-minute in-memory session cache, a session-token index, hourly expired-session deletion, and relation `include` for a single authorization lookup. Reuse these only when the same identity/session concern applies. There is no established cache library, general N+1 strategy, `select` optimization, batching, or API pagination system.

References: [`src/auth/auth.service.ts`](../../../src/auth/auth.service.ts), [`src/cron/cron.service.ts`](../../../src/cron/cron.service.ts), [`prisma/schema.prisma`](../../../prisma/schema.prisma).

## 28. Testing

- Use Vitest with `@nestjs/testing`; write unit specs beside the feature source.
- Build a `TestingModule`, supply `vi.fn()` mocks under `dbService`/`mailerService` string tokens, and mock imported helpers when the service invokes them.
- Assert behavior through resolved values, thrown Nest exception classes/messages, and specific Prisma call objects.
- For controller specs, mock `AuthService` and use `.overrideGuard(AuthGuard).useValue({ canActivate: vi.fn(() => true) })` for protected actions.

The root e2e test is stale against current application code. Do not copy it as a working feature test pattern without repairing its target first.

References: [`src/auth/auth.service.spec.ts`](../../../src/auth/auth.service.spec.ts), [`src/auth/auth.controller.spec.ts`](../../../src/auth/auth.controller.spec.ts), [`test/app.e2e-spec.ts`](../../../test/app.e2e-spec.ts).

## 29. Common Patterns

```ts
const existing = await this.db.model.findFirst({ where: { field } });
if (!existing) throw new NotFoundException('model not found');

const result = await this.db.$transaction(async tx => {
    const record = await tx.model.create({ data: { ... } });
    await tx.otherModel.create({ data: { modelId: record.id } });
    return { id: record.id };
});
```

```ts
public async action(@Body() dto: ActionReqDto) {
    const data = await this.featureService.action({ value: dto.value });
    return { data, message: 'action success' };
}
```

```ts
@UseGuards(AuthGuard)
public async protectedAction(@Req() req: Request) {
    // req.withUser was assigned by AuthGuard
}
```

These examples show current shapes, not permissions to use a database transaction, auth guard, or arbitrary action route without a feature need.

## 30. Anti-Patterns

- Do not edit generated Prisma code or construct a `PrismaClient` in a Nest service.
- Do not add repositories, entity models, mappers, response serialization, generic error middleware, or `@CurrentUser()` just to make the code look more conventional.
- Do not return an already-final `{ ok, statusCode, data, meta }` envelope; the interceptor will wrap it again.
- Do not use direct raw passwords/tokens in persisted storage; credential passwords are bcrypt hashes and session/verification values are HMAC hashes.
- Do not assume `RolesGuard`, optional auth, soft delete, pagination, or Prisma error mapping are active app-wide—they are absent, unused, or incomplete.
- Do not put controller HTTP/cookie/redirect details in a service or core business/database logic in a controller.

## 31. New Feature Implementation Workflow

1. Inspect the nearest hand-written feature, utility, schema model, and test. Read the convention report if changing auth, responses, database, or errors.
2. Decide whether the work is a top-level HTTP feature, a scheduled task, or a cross-cutting utility. Reuse the existing structure; do not add architecture for speculative future use.
3. If persistence changes, update `prisma/schema.prisma` using existing mapping/relationship conventions, create a migration, run Prisma generation, and leave `src/generated/prisma` generated.
4. Add request and Swagger DTOs only for HTTP input/output. Decorate every accepted request property for the global validation pipe.
5. Implement a feature service that injects `DbService` using `dbService`, performs business checks before writes, throws the project’s HTTP exceptions, and uses `$transaction(async tx => ...)` only for atomic multi-write changes.
6. Implement a thin controller with Swagger metadata, an explicit status code, request mapping, `{ data, message }`, and method-level `AuthGuard` when the feature needs session identity. Use cookie helpers/response-interceptor skip only when their actual behavior is required.
7. Add the module to `AppModule`; export the service only for an actual consumer such as a guard.
8. Write focused Vitest unit tests with Nest modules and provider-token mocks. Do not assume the stale e2e test is a template.
9. Run the relevant test/lint/build command. Review generated migration/schema changes and confirm the final JSON is produced by the global interceptor/filter, not duplicated by the endpoint.

## 32. Complete Example

This is a **project-style projection**, not an existing feature: authenticated creation of a one-to-one profile. It demonstrates the minimum additions while clearly separating the current conventions from the new feature design.

Add the model and relation in `prisma/schema.prisma` using the established UUID, timestamps, mapping, and cascade relationship style:

```prisma
model User {
  // existing fields
  profile Profile?
}

model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  bio       String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}
```

Then create and apply a migration and generate the client. Do not write generated output by hand.

`src/profile/dto/profile.dto.ts` follows the observed request/Swagger naming style:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProfileReqDto {
    @ApiProperty({ example: 'NestJS developer', description: 'Profile biography' })
    @IsNotEmpty({ message: 'Bio must not be empty' })
    @IsString({ message: 'Bio must be a string' })
    @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
    bio: string;
}

export class CreateProfileDataDto {
    @ApiProperty({ example: 'clq9...', description: 'Profile ID' })
    profileId: string;
    @ApiProperty({ example: 'NestJS developer', description: 'Profile biography' })
    bio: string;
}

export class CreateProfileResDto {
    @ApiProperty({ type: CreateProfileDataDto })
    data: CreateProfileDataDto;
    @ApiProperty({ example: 'create-profile success' })
    message: string;
}
```

`src/profile/profile.service.ts` uses the global DB token, the existing `findFirst` lookup shape, and an anticipated domain exception. A single create does not need the repository’s multi-write transaction pattern:

```ts
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { type DbService, dbService } from '../db/db.module.js';

@Injectable()
export class ProfileService {
    constructor(@Inject(dbService) private readonly db: DbService) {}

    public async createProfile({ userId, bio }: { userId: string; bio: string }) {
        const findProfile = await this.db.profile.findFirst({ where: { userId } });
        if (findProfile) throw new ConflictException('profile already exist');

        const newProfile = await this.db.profile.create({
            data: { userId, bio }
        });

        return { profileId: newProfile.id, bio: newProfile.bio };
    }
}
```

`src/profile/profile.controller.ts` keeps session access, Swagger, and output at the HTTP boundary. The non-null assertion is justified by the immediately preceding guard; alternatively retain a local defensive check only if the real route needs to handle an absent user.

```ts
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../utils/guard.js';
import { ProfileService } from './profile.service.js';
import { CreateProfileReqDto, CreateProfileResDto } from './dto/profile.dto.js';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {}

    @Post('create')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a profile for the current user' })
    @ApiResponse({ status: 201, type: CreateProfileResDto, description: 'Profile successfully created.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 409, description: 'Conflict.' })
    public async createProfile(@Body() dto: CreateProfileReqDto, @Req() req: Request) {
        const data = await this.profileService.createProfile({ userId: req.withUser!.id, bio: dto.bio });
        return { data, message: 'create-profile success' };
    }
}
```

Use the ordinary module shape:

```ts
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
    controllers: [ProfileController],
    providers: [ProfileService]
})
export class ProfileModule {}
```

Finally import `ProfileModule` from `AppModule` and write unit tests that mock `dbService` and override `AuthGuard`, as the auth specs do. The final successful body is supplied by the global interceptor; no extra response code belongs in the controller.
