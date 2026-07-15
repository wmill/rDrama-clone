# Repository Guidelines

## Project Overview

rDreamer is a full-stack TypeScript/React rewrite of rDrama built with TanStack Start and React 19. It uses PostgreSQL through Drizzle, Redis for sessions and password-reset tokens, Elasticsearch for search, Tailwind CSS v4 for styling, and Sentry for instrumentation. Read `TODO.md` before selecting backlog work; it is the prioritized, agent-ready work queue.

## Repository Layout

- `src/routes/`: TanStack Router file-based routes; `__root.tsx` is the shared layout and `admin.tsx` guards nested admin routes.
- `src/components/`: shared React UI; domain UI lives in subdirectories such as `comments/`, while `ui/` contains reusable primitives.
- `src/lib/`: domain data access, server functions, validation, and utilities. Database modules generally use `*.server.ts`; client-callable TanStack server-function wrappers use `*-actions.server.ts`.
- `src/db/`: Drizzle connection and the rDrama-compatible schema in `schema.ts`.
- `src/hooks/`, `src/stores/`, `src/middleware/`, and `src/integrations/`: hooks, Zustand client state, request middleware, and framework integrations.
- `src/test/`: shared Vitest setup and mock helpers. Unit and component tests are co-located as `*.test.ts(x)`.
- `e2e/`: Playwright smoke tests; `bruno/`: API smoke collections; `scripts/`: maintenance and seed CLIs.
- `public/`: static assets; `prototyping-data/`: JSON inputs for data generation; `drizzle/`: generated migrations.

Do not manually edit `src/routeTree.gen.ts`; TanStack Router generates it from `src/routes/`. Keep server-only code in `.server.ts` modules and use the `@/*` alias for imports from `src/*`.

## Setup and Commands

Use pnpm. Copy `.env.local.sample` to `.env.local`, then start PostgreSQL, Redis, and Elasticsearch with Docker Compose before running features that need the full stack.

```bash
pnpm install
pnpm dev              # Vite/TanStack Start on port 3000
pnpm build            # production bundle
pnpm serve            # preview the bundle
pnpm start            # run the built Nitro server
pnpm check            # Biome check plus TypeScript
pnpm test             # Vitest once
pnpm test:watch       # Vitest watch mode
pnpm test:coverage
pnpm e2e              # Playwright; requires the running stack
```

Useful focused commands include `pnpm lint`, `pnpm format`, and `pnpm typecheck`. Database workflows use `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:pull`, and `pnpm db:studio`. Operational scripts include `pnpm generate-data`, `pnpm create-user`, `pnpm recalculate-user-counts`, and `pnpm reindex-search`.

## Architecture and Implementation Conventions

- Keep database-facing domain logic in `*.server.ts`. Put authentication/validation-aware `createServerFn` wrappers in matching `*-actions.server.ts` modules and delegate to the data layer.
- After successful mutations, call `await router.invalidate()` and render refreshed loader data. Do not copy loader data into component state and patch it locally; reserve local state for forms, pending state, and UI-only behavior.
- Markdown is rendered on the server through `src/lib/markdown.ts`. Store raw input in `body` fields and display the returned `bodyHtml`; do not render raw user markdown on the client.
- Use TanStack Query for server state and Zustand for cross-component client state such as modals.
- For schema changes, update `src/db/schema.ts`, generate a migration, and apply it. Review generated SQL, but do not hand-edit migration metadata.
- Use Tailwind utilities for component styling. Limit `src/styles.css` to global primitives.

## Style and Testing

Biome is authoritative: tabs, double quotes, and organized imports. TypeScript strict mode is enabled. Preserve the naming style of the area being changed; route filenames follow TanStack’s file-routing syntax and some established component files use PascalCase.

Vitest runs in JSDOM with Testing Library. Cover success, validation/error, and authorization paths as appropriate. Use helpers from `src/test/mocks.ts`, including `createMockDb`, `createQueryChain`, `createServerFnStub`, and `createSessionsMock`, instead of rebuilding common mocks. Data-layer tests mock `@/db`; server-function tests mock `@tanstack/react-start`; component tests mock router and action dependencies to avoid real services. Playwright tests require the full local stack.

Before handing off a change, run the narrowest relevant tests while iterating, then `pnpm check` and `pnpm test`. Add `pnpm build` for framework, routing, or production-bundle changes and `pnpm e2e` for user-flow changes when the backing services are available.

## Configuration, Commits, and Pull Requests

Never commit `.env.local`, credentials, or tokens. Document new variables and update `.env.local.sample`. Important local variables include `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `AUTH_BASE_URL`, SMTP settings, and optional Sentry variables.

Keep commits focused with a short imperative subject; a task or area prefix is welcome when useful. Pull requests should explain intent, link the relevant issue/task, list verification commands, and include screenshots or clips for UI changes. Explicitly call out migrations, environment-variable additions, fixture changes, and operational follow-up such as a search reindex.
