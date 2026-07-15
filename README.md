# rDreamer

rDreamer is a TypeScript and React rewrite of [rDrama](https://github.com/themotte/rDrama) using TanStack Start. It aims to preserve compatibility with rDrama's PostgreSQL data model while replacing the Flask/Jinja/Bootstrap application with a modern client-rendered interface.

The comment system deliberately moves thread construction and incremental rendering into the browser. Comments also have an `ltree` path for efficient permalink ancestor/subtree queries without recursively rebuilding full threads in PostgreSQL.

## Current feature state

Implemented and covered by the current test suite:

- Signup, login/logout, password reset, Redis-backed sessions, and revocation of other sessions.
- Sortable/paginated post and comment feeds, post/comment permalinks, threaded replies, editing, deletion, voting, saves, and post subscriptions.
- User profiles, privacy, follows/followers, blocks, saved content, profile settings, themes, NSFW preferences, and slur replacement.
- Elasticsearch-backed post/comment search with visibility filtering and reindex tooling.
- Notifications for replies, mentions, subscribed threads, follows, and awards.
- Reporting and moderation queues, approve/filter/remove moderation states, sticky/pin/distinguish actions, bans and shadowbans, user investigation/notes/alts, banned domains, badges, awards, site settings, and a moderation audit log.
- Server-side authorization, zod validation, rate limiting, Sentry instrumentation, Vitest coverage, and Playwright infrastructure.

The application is still a work in progress. The prioritized gaps—account security settings, complete content lifecycle and filtering, remaining profile/preferences behavior, public community/transparency pages, and deeper administration—are tracked in [TODO.md](./TODO.md). Large subsystems such as chat, 2FA, OAuth applications, the virtual economy, volunteer moderation, and media uploads are intentionally deferred.

The original implementation and generated database/route notes can be inspected in `../rDrama` and `project_specs/` respectively. JSON fixtures for local prototyping live in `prototyping-data/`.

## Getting started

Install dependencies and create local configuration:

```bash
pnpm install
cp .env.local.sample .env.local
```

Start PostgreSQL and Redis, then run the development server on port 3000:

```bash
docker compose up -d postgres redis
pnpm dev
```

To generate a larger local dataset:

```bash
pnpm generate-data --comments 5000 --max-depth 30 --submissions 30
```

## Verification

Run the full required checks before opening a pull request:

```bash
pnpm check
pnpm test --run
```

Other useful commands:

```bash
pnpm test:watch
pnpm e2e
pnpm build
pnpm serve
pnpm start
```

## Database and search tools

Drizzle schema definitions live in `src/db/schema.ts`:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Elasticsearch can be rebuilt from PostgreSQL with:

```bash
pnpm reindex-search
```

See `AGENTS.md` and `CLAUDE.md` for repository conventions, testing patterns, environment variables, and operational details.
