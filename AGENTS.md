# Repository Guidelines

## Project Structure & Module Organization
All TypeScript source lives in `src/`. TanStack Router maps folders in `src/routes` to URL segments and uses `__root.tsx` for shared layout. Shared UI resides in `src/components`, helpers in `src/lib`, hooks in `src/hooks`, integrations in `src/integrations`, and Drizzle schemas or queries in `src/db`. Static assets belong to `public/`, prototype JSON fixtures to `prototyping-data/`. Leave generated files such as `src/routeTree.gen.ts` alone unless the routing contract changes.

## Build, Test & Development Commands
Install dependencies with `pnpm install`. Use `pnpm dev` for the hot-reloading TanStack Start server on port 3000. `pnpm build` emits the production bundle, `pnpm serve` previews it, and `pnpm start` runs the Nitro output. Run the Biome scripts (`pnpm lint`, `pnpm format`, `pnpm check`) plus `pnpm test` before opening a PR; tack on `--watch` locally when iterating. Drizzle helpers (`pnpm db:generate`, `db:migrate`, `db:push`, `db:pull`, `db:studio`) keep migrations in sync with the definitions stored in `src/db`.

## Coding Style & Naming Conventions
Biome rules the style guide: tabs for indentation, double quotes, auto-organized imports. Export React components as named functions, keep loaders and server handlers next to the route TSX file that consumes them, and use lowercase hyphenated filenames (`comment-list.tsx`, `feed.server.ts`). Follow Tailwind’s utility-first approach, touching `src/styles.css` only for global primitives.

## Testing Guidelines
Vitest with Testing Library runs through `pnpm test`. Co-locate `*.test.ts` or `*.test.tsx` beside their modules, mirroring folder names. Assert loading, error, and success paths for hooks, loaders, and server functions, and mock Sentry or router clients to avoid real network calls. Use `pnpm test --watch` during development.

## Commit & Pull Request Guidelines
History currently uses short lowercase lines (`wip`, `initial repo`), so keep commits to a single imperative line under ~50 characters, optionally prefixed with a scope (`feed: seed data`). Pull requests must explain intent, link issues, include `pnpm` commands for verification, and attach screenshots or clips for UI changes. Explicitly call out migrations, new environment variables, or fixture edits so reviewers can sync their databases and sample data.

## Database & Configuration Tips
Prefer the JSON fixtures in `prototyping-data/` for local work unless a task requires PostgreSQL. When targeting the real database, configure `DATABASE_URL` in a local `.env`, rerun `pnpm db:generate && pnpm db:migrate`, and never commit credentials or generated SQL artifacts. Document any new env vars in your PR.
