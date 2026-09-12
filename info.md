# mynestjs-start

## How to run this app

1. Install dependencies using your preferred package manager (e.g., `bun install`, `yarn install`, or `bun install`).
2. Make sure your `.env` file is set up with the required configuration variables (e.g., database connection details, Resend API key, Google OAuth credentials).
3. Start the development server using:
    ```bash
    bun run start:dev
    ```
    _(Alternatively, use `bun run start` to run without watch mode, or `bun run build` followed by `bun run start:prod` for production)._

## How to run Prisma

This project uses Prisma ORM, configured with a MariaDB adapter.

1. **Format Schema**: To format your `schema.prisma` file, run:
    ```bash
    bunx prisma format
    ```
2. **Generate Client**: Run this command to generate the Prisma Client (especially after modifying your schema):
    ```bash
    bunx prisma generate
    ```
3. **Run Migrations**: To apply schema changes to your development database:
    ```bash
    bunx prisma migrate dev
    ```
4. **Prisma Studio**: Open the visual database editor locally:
    ```bash
    bunx prisma studio
    ```
5. **Seed Database**: To seed your database with initial data (requires `bun` as configured in `package.json`):
    ```bash
    bun run db:seed
    ```

## Caveats / `--FuturePlan`

Throughout the codebase, you may notice comments flagged with `--FuturePlan`. This designates a feature or architectural enhancement that is planned for future implementation.

### Example: `--FuturePlan` in `auth.service.ts`

In `src/auth/auth.service.ts`, there is a `--FuturePlan` comment inside the `signUp` method.

**What it means:**
Currently, if a user attempts to sign up via `credentials` (email/password) and an account with that email already exists from a different provider (like Google OAuth), the system throws an error to prevent conflicts.

The future plan is to gracefully handle this by **linking** the newly provided password to the existing OAuth user account. This would allow a user who originally signed up via Google to seamlessly establish an email/password login method for the exact same account in the future.

## Caveats / `--Bugs`

You might also come across comments flagged with `--Bugs`. This designates a known issue, edge case, or unintended behavior in the codebase that currently needs to be addressed or fixed.

**What it means:**
When you see a `--Bugs` comment, it serves as a warning that the surrounding logic may produce errors under specific conditions, requires a workaround, or does not fully adhere to the intended requirements. These comments act as placeholders for developers to revisit and resolve the problem in subsequent updates.
