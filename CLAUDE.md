# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

rDreamer is a full-stack Reddit/drama community clone (an rDrama rewrite) built with:
- **TanStack Start** - React framework with file-based routing and server functions
- **React 19** - UI framework
- **Drizzle ORM + PostgreSQL** - Full ~30-table rDrama-compatible schema in `src/db/schema.ts`
- **Redis (ioredis)** - Sessions and password-reset tokens (`src/lib/redis.ts`)
- **Elasticsearch 7.17** - Post/comment search (`src/lib/search.server.ts`)
- **Tailwind CSS v4 + Shadcn/ui** - Styling and components
- **Zustand** - Client state (e.g. `src/stores/modals`)
- **Sentry** - Error tracking (`instrument.server.mjs`, configured in `src/router.tsx`)
- **Biome** - Linting and formatting (tab indentation, double quotes)
- **Vitest + Testing Library** - Unit/component tests; **Playwright** for e2e (`e2e/`)

`TODO.md` is the agent-ready work queue for remaining tasks — read its preamble before picking up a task.

## Development Commands

### Build & Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server on port 3000 (loads Sentry instrumentation)
pnpm build            # Production build
pnpm serve            # Preview production build
pnpm start            # Run production server
```

### Code Quality & Tests
```bash
pnpm check            # Biome check + tsc --noEmit (run before committing)
pnpm lint             # Biome lint only
pnpm format           # Biome format
pnpm typecheck        # tsc --noEmit only
pnpm test             # Run Vitest once (vitest run)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Coverage report
pnpm e2e              # Playwright smoke tests (needs running stack)
```

### Database & Data
```bash
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes directly
pnpm db:studio        # Open Drizzle Studio
pnpm generate-data    # Seed fake data (scripts/generate-data.ts)
pnpm create-user      # Create a user (scripts/create-user.ts)
pnpm reindex-search   # Rebuild the Elasticsearch index
pnpm recalculate-user-counts
```

### Adding UI Components
```bash
pnpx shadcn@latest add button    # Add specific components
```

## Environment Setup

Copy `.env.local.sample` to `.env.local` (see README). Backing services run via `docker-compose up` (Postgres 17, Redis 7, Elasticsearch 7.17, nginx).

Environment variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection (sessions, password reset)
- `ELASTICSEARCH_URL` - Search backend
- `AUTH_BASE_URL` - Base URL used in auth links (password-reset emails)
- `VITE_SENTRY_DSN` - Optional, error monitoring
- `VITE_RESULTS_PER_PAGE_COMMENTS` - Optional, comment pagination size

## Architecture Overview

### File Structure
- `src/routes/` - File-based routing (TanStack Router); root layout in `__root.tsx`; route tree auto-generated as `src/routeTree.gen.ts` (never edit)
- `src/components/` - React components (`ui/` = Shadcn, `comments/` = comment tree UI)
- `src/db/` - Drizzle schema (`schema.ts`) and connection
- `src/lib/` - Data layer and utilities (see pattern below)
- `src/stores/` - Zustand stores
- `src/hooks/`, `src/middleware/`, `src/integrations/`
- `scripts/` - CLI utilities run with tsx
- `bruno/` - Bruno API collection (smoke requests against a running server)
- `e2e/` - Playwright specs
- `prototyping-data/` - JSON fixtures for data generation

### Data-Layer Pattern (src/lib)
Two-file convention per domain:
- `*.server.ts` (e.g. `comments.server.ts`, `submissions.server.ts`, `admin.server.ts`) - data functions hitting the DB; unit-tested by mocking `@/db`
- `*-actions.server.ts` (e.g. `comment-actions.server.ts`) - `createServerFn` wrappers callable from the client; they authenticate via `getCurrentUser()` from `sessions.server.ts` and delegate to the data layer

**Post-mutation refresh convention**: after a successful mutation, call `await router.invalidate()` and render from loader data — do not mirror loader data into `useState` and patch it locally. Local `useState` is fine for form inputs, pending flags, and UI-only state (tabs, collapsed), just not as a copy of what the loader returns.

### Markdown Rendering
`src/lib/markdown.ts` (markdown-it with `html: false` for XSS safety, plus spoiler `||text||` and @user-mention plugins). Raw markdown is stored in `body` columns and server-rendered HTML in `bodyHtml` columns. **The server is the single source of truth for rendered HTML** — after create/edit, return the re-fetched record and display its `bodyHtml`; never display raw markdown client-side.

### Routing & State
- Admin routes nest under the guard in `src/routes/admin.tsx`
- TanStack Query for server state; Zustand for cross-component client state (modals)
- SSR with client-side navigation

### Database Changes
1. Modify `src/db/schema.ts`
2. Run `pnpm db:generate` to create a migration
3. Run `pnpm db:migrate` to apply it

## Testing Patterns
- **Shared mock helpers live in `src/test/mocks.ts`** — `createMockDb` (the `@/db` mock), `createQueryChain` (chainable/awaitable drizzle query-builder mock), `createServerFnStub` (the `@tanstack/react-start` mock), `createSessionsMock`, and `makeSafeUser`. Use them in new tests; `src/lib/admin-actions.server.test.ts` and `src/lib/users.server.test.ts` show the pattern. Older tests still hand-roll equivalents and migrate opportunistically as they're touched
- Server-fn tests mock `@tanstack/react-start` with the `createServerFn` chain stub
- Data-layer tests mock `@/db`
- Component tests mock `@tanstack/react-router` (Link as `<a>`) and any `*-actions.server` imports (see `src/components/comments/Comment.test.tsx`)
- JSDOM browser environment; Playwright e2e in `e2e/` needs the full docker-compose stack

## Code Style
- Biome handles formatting (tab indentation, double quotes) — run `pnpm check` before committing
- TypeScript strict mode enabled
- Path alias `@/*` maps to `./src/*`
