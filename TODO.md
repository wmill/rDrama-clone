# rDreamer TODO — agent work queue

## How to work this file

1. Pick the **first unchecked task** (they are ordered; earlier tasks are cheaper and unblock later ones).
2. Read the task's *Files* before writing anything — follow the existing patterns in the referenced files rather than inventing new ones.
3. Implement it. Keep the change scoped to the one task.
4. Run the *Verify* commands. **Never check a box unless they pass.**
5. Check the box, then commit with a message starting with the task ID, e.g. `T03: add votes.server tests`. One task per commit.

Baseline before any task: `pnpm check && pnpm test --run` passes (34 test files, 195 tests as of 2026-07-09, after T03–T08).

### Project orientation (read once)

- TanStack Start app. Server data layer lives in `src/lib/*.server.ts`; client-callable wrappers using `createServerFn` live in `src/lib/*-actions.server.ts`. Routes are file-based in `src/routes/`.
- Tests are colocated (`foo.server.test.ts` next to `foo.server.ts`). Server-fn tests mock `@tanstack/react-start`'s `createServerFn` and the underlying `*.server` modules — copy the mock setup from `src/lib/comment-actions.server.test.ts`. Component tests mock `@tanstack/react-router` and server-fn modules — copy `src/components/comments/Comment.test.tsx`.
- Auth: `getCurrentUser` from `src/lib/sessions.server.ts`. Admin gating pattern: see `src/routes/admin.tsx` (guard) and `src/routes/admin.reported-posts.tsx` (a full admin page).
- DB schema: `src/db/schema.ts` (Drizzle, ~30 rDrama-compatible tables). Guiding rule: preserve rDrama database compatibility unless a migration clearly simplifies things. Schema changes: edit schema, `pnpm db:generate`, `pnpm db:migrate`.
- Markdown: always store both raw (`body`) and rendered (`bodyHtml`) via `src/lib/markdown.ts` render functions; never render markdown ad hoc.

Out of scope for v1 (do not start): 2FA, messaging/chat, OAuth app flows, volunteer janitor, static pages (rules/about/RSS).

---

## Docs reconciliation

- [x] **T01: Fix stale CLAUDE.md** *(done 2026-07-09: full rewrite — real schema, Redis/Elasticsearch/Playwright, env vars, data-layer + testing patterns)*
  - *Why*: CLAUDE.md claims the schema is "a basic todos table" and says `demo.*` files exist — both false, and they mislead every future agent session.
  - *Files*: `CLAUDE.md`; ground truth in `src/db/schema.ts` and `src/routes/`.
  - *Done when*: the "Database Schema" section describes the real schema (full rDrama-compatible model: users, submissions, comments, votes, notifications, mod actions, etc.); the "Demo Files" section is removed (no demo files remain in the repo).
  - *Verify*: `grep -i "todos table\|demo\." CLAUDE.md` returns nothing; `pnpm check` passes.

- [ ] **T02: Update README.md feature claims**
  - *Why*: README says admin/moderation is "still missing," but reporting queues, remove/unremove, ban/shadowban, sticky, distinguish, and audit logging all exist (`src/lib/admin-actions.server.ts`, `src/routes/admin.*.tsx`).
  - *Files*: `README.md`.
  - *Done when*: README accurately reflects current feature state (core features done; remaining gaps are the unchecked tasks in this file).
  - *Verify*: proofread; `pnpm check` passes.

## Test coverage gaps

- [x] **T03: Tests for `src/lib/votes.server.ts`** *(done 2026-07-09: 11 tests — new/toggle/switch/remove vote, counter effects, missing-row and error fallbacks)*
  - *Why*: Core voting logic has zero direct tests.
  - *Files*: create `src/lib/votes.server.test.ts`; mock the `db` import the same way `src/lib/social.server.test.ts` does; exercise `voteOnSubmission` / `voteOnComment` (new vote, change vote, remove vote, score/upvote/downvote counter effects, not-logged-in / invalid input).
  - *Done when*: each exported function has happy-path + at least one boundary test.
  - *Verify*: `pnpm test --run src/lib/votes.server.test.ts && pnpm check`

- [x] **T04: Tests for `src/lib/comments.server.ts`** *(done 2026-07-09: 13 tests — createComment ltree/level/self-vote, updateComment re-render + non-author rejection, deleteComment delegation, getCommentById visibility for removed/filtered/deleted/shadowbanned/mod/author viewers)*
  - *Why*: The largest server module (create/update/delete, visibility mapping, ltree threading) is only tested indirectly via helpers.
  - *Files*: create `src/lib/comments.server.test.ts`. Priority functions: `createComment` (renders `bodyHtml`, sets ltree path/level), `updateComment` (re-renders `bodyHtml`, rejects non-author), `deleteComment` (rejects non-author), `getCommentById` visibility mapping (deleted/removed/filtered/shadowbanned viewers see placeholders, mods see content).
  - *Done when*: those functions are covered including permission-denial cases.
  - *Verify*: `pnpm test --run src/lib/comments.server.test.ts && pnpm check`

- [x] **T05: Tests for `src/lib/users.server.ts`** *(done 2026-07-09: 10 tests — canonical username lookup, settings fetch null-mapping, bio→bioHtml + customTitle rendering on update, profile privacy/block/owner gating)*
  - *Why*: Profile/settings writes are untested.
  - *Files*: create `src/lib/users.server.test.ts`; cover profile fetch, settings updates (including that `bio` updates also write `bioHtml`), and any username/availability logic.
  - *Verify*: `pnpm test --run src/lib/users.server.test.ts && pnpm check`

- [x] **T06: Tests for `src/lib/admin.server.ts` and `src/lib/reporting-actions.server.ts`** *(done 2026-07-09: 15 tests — reported-post/comment flag grouping, user search, admin user details + notes; report fns auth rejection, delegation, not-found and error mapping)*
  - *Why*: Admin queries and the report server-fns are untested (only `admin-actions.server.ts` and `reporting.server.ts` are).
  - *Files*: create `src/lib/admin.server.test.ts` and `src/lib/reporting-actions.server.test.ts`; for the latter copy the createServerFn mock setup from `src/lib/comment-actions.server.test.ts` and cover not-logged-in rejection + delegation to `reporting.server.ts`.
  - *Verify*: `pnpm test --run src/lib/admin.server.test.ts src/lib/reporting-actions.server.test.ts && pnpm check`

- [x] **T07: Auth integration tests** *(done 2026-07-09: auth.server tests — signup validation, signup→login hash round-trip, ban rejection incl. permanent bans; sessions.server tests — create/lookup/logout/delete-all/getCurrentUser. Also FIXED a real bug: authenticateUser let permanently banned users (unbanUtc=0) log in. Reset-invalidates-sessions was already covered in password-reset.server.test.ts.)*
  - *Why*: Signup/login/logout, banned-user login rejection, and session invalidation after password reset are the highest-risk untested flows.
  - *Files*: extend/create tests next to `src/lib/auth.server.ts` and `src/lib/sessions.server.ts`; `src/lib/password-reset.server.test.ts` already exists as the pattern for reset-token mocking.
  - *Done when*: tests cover signup→login→logout, login rejected for `isBanned` users, and that consuming a password reset invalidates existing sessions.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T08: Post-lifecycle permission-boundary tests** *(done 2026-07-09: submissions — non-author edit/delete rejected, author edit re-renders HTML, deleted/removed posts map to placeholders; admin-actions — remove/sticky/pin/ban/distinguish all rejected for adminLevel 0 users with no DB writes)*
  - *Why*: Author-vs-moderator boundaries (author delete, mod remove/unremove, sticky/distinguish permission levels, deleted-post visibility) are asserted nowhere.
  - *Files*: extend `src/lib/submissions.server.test.ts` and `src/lib/admin-actions.server.test.ts`.
  - *Done when*: non-author edit/delete rejected; non-mod remove/sticky/distinguish rejected; deleted/removed posts map to placeholder visibility for normal viewers.
  - *Verify*: `pnpm test --run && pnpm check`

## Account security hardening

- [x] **T09: Session management — "log out other sessions"** *(done 2026-07-09: listUserSessions + deleteOtherUserSessions in sessions.server.ts (with stale-id pruning), session-actions.server.ts server fns (client only ever sees truncated session-id prefixes), "Active sessions" card in me.tsx with per-device list + log-out-others button; 9 new server tests. Manual two-browser check still worthwhile when the stack is up.)*
  - *Why*: Users cannot revoke other active sessions (P1 security parity item; 2FA is explicitly out of scope).
  - *Files*: `src/lib/sessions.server.ts` (read it first to learn the session store — sessions are keyed via Redis/`src/lib/redis.ts` and the schema has a `login_nonce` column on `users` for mass invalidation), a new action in an existing `*-actions.server.ts` or new `session-actions.server.ts`, and UI in `src/routes/me.tsx`.
  - *Done when*: settings page shows a "Log out other sessions" control; invoking it invalidates every session except the current one (verified by a server test).
  - *Verify*: `pnpm test --run && pnpm check`; manually: log in from two browsers, revoke from one, confirm the other is logged out on next request.

## Moderation/admin expansion

Pattern for all admin pages: route guard comes free by nesting under `src/routes/admin.tsx`; copy the structure of `src/routes/admin.reported-posts.tsx` (loader calling a `src/lib/admin.server.ts` query, actions via `src/lib/admin-actions.server.ts`, add nav link wherever the existing admin pages register theirs).

- [ ] **T10: Filtered/removed/shadowbanned content queues**
  - *Why*: Mods can only see *reported* content; content in FILTERED/REMOVED state or from shadowbanned users has no review surface.
  - *Files*: new `src/routes/admin.filtered.tsx` (or similar); queries in `src/lib/admin.server.ts` filtering `submissions`/`comments` by `stateMod` enum (`FILTERED`/`REMOVED`) and authors with `shadowBanned` set; reuse existing remove/unremove/approve actions from `src/lib/admin-actions.server.ts`.
  - *Done when*: each queue lists matching content with working approve/remove actions; non-admins are redirected.
  - *Verify*: `pnpm test --run && pnpm check`; manually via an admin user in `pnpm dev`.

- [ ] **T11: Mod log view**
  - *Why*: `modActions` rows are written on every mod action but there is no way to read them.
  - *Files*: new `src/routes/admin.mod-log.tsx`; query in `src/lib/admin.server.ts` joining `modActions` to `users` (actor) with pagination; render kind/target/actor/timestamp.
  - *Done when*: paginated, newest-first mod log page exists under `/admin`.
  - *Verify*: `pnpm test --run && pnpm check`; perform a mod action in dev and see it appear.

- [ ] **T12: User investigation view**
  - *Why*: `src/routes/admin.users.tsx` exists but lacks context for decisions: notes, recent activity, report history.
  - *Files*: extend `src/routes/admin.users.tsx` (or add `admin.users.$id.tsx`); `userNotes` table in `src/db/schema.ts`; queries in `src/lib/admin.server.ts` for the user's recent submissions/comments, reports filed against them (`flags`/`commentFlags`), and CRUD for `userNotes`.
  - *Done when*: an admin can open a user and see notes (add/view), recent activity, and report history in one place.
  - *Verify*: `pnpm test --run && pnpm check`; manual walkthrough in dev.

- [ ] **T13: Banned-domain management**
  - *Why*: The `bannedDomains` table exists with no feature code — banned domains are currently not enforced at all.
  - *Files*: enforcement in `createSubmission`/`updateSubmission` in `src/lib/submissions.server.ts` (reject URLs whose host matches a banned domain); admin CRUD page `src/routes/admin.banned-domains.tsx` + queries/actions in `src/lib/admin.server.ts` / `admin-actions.server.ts`.
  - *Done when*: submitting a link to a banned domain is rejected with the stored reason; admins can add/remove domains; both behaviors have server tests.
  - *Verify*: `pnpm test --run && pnpm check`

- [ ] **T14: Badges/awards management + backing actions**
  - *Why*: Schema (`badgeDefs`, `badges`, `awardRelationships`) and `src/components/modals/AwardModal.tsx` exist, but there are no server actions — the modal does nothing real.
  - *Files*: new `src/lib/award-actions.server.ts` (grant/revoke badge, award content) wired into `AwardModal.tsx`; admin management page for `badgeDefs`; display granted badges on `src/components/profile/user-page.tsx`.
  - *Done when*: an admin can define a badge, grant it to a user, and it renders on the profile; actions are tested.
  - *Verify*: `pnpm test --run && pnpm check`; manual grant in dev.

- [ ] **T15: Site settings / config toggles**
  - *Why*: There is no runtime kill-switch for signups or site-wide read-only mode.
  - *Files*: **first enumerate** which toggles are worth having (suggested minimum: `signups_enabled`, `read_only`); store in Redis (`src/lib/redis.ts`) or a small new table (migration via `pnpm db:generate`); admin page `src/routes/admin.settings.tsx`; enforce in `src/lib/auth.server.ts` (signup) and the write-path server fns.
  - *Done when*: toggling each setting changes behavior immediately and is covered by a server test.
  - *Verify*: `pnpm test --run && pnpm check`; flip each toggle in dev and confirm.

## API smoke coverage

- [ ] **T16: Extend bruno collection to write flows**
  - *Why*: `bruno/` only covers GET smoke (home feed, comments, search) — no write path is exercised.
  - *Files*: `bruno/` (existing requests + `bruno/environments/local.yml` show the conventions); add authenticated flows: signup/login, submit post, comment, vote, report, and one mod action.
  - *Done when*: the collection runs green against `pnpm dev` with a seeded admin (`scripts/create-user.ts`).
  - *Verify*: run the collection with the bruno CLI (`bru run`) against a local dev server.

---

## Recently completed (context, not tasks)

- 2026-07-09: Fixed comment-edit markdown bug — `updateCommentFn` now returns the re-rendered comment and `Comment.tsx` displays `bodyHtml` instead of raw markdown after edit; regression test in `src/components/comments/Comment.test.tsx`.
- Search (Elasticsearch) is **fully implemented and tested** (`src/lib/search.server.ts`, `src/routes/search.tsx`) — an older TODOS.md wrongly listed it as missing.
