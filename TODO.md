# rDreamer TODO — agent work queue

## How to work this file

1. Pick the **first unchecked task** (they are ordered; earlier tasks are cheaper and unblock later ones).
2. Read the task's *Files* before writing anything — follow the existing patterns in the referenced files rather than inventing new ones.
3. Implement it. Keep the change scoped to the one task.
4. Run the *Verify* commands. **Never check a box unless they pass.**
5. Check the box, then commit with a message starting with the task ID, e.g. `T03: add votes.server tests`. One task per commit.

Baseline before any task: `pnpm check && pnpm test --run` passes (43 test files, 326 tests as of 2026-07-10, after T21–T24).

### Project orientation (read once)

- TanStack Start app. Server data layer lives in `src/lib/*.server.ts`; client-callable wrappers using `createServerFn` live in `src/lib/*-actions.server.ts`. Routes are file-based in `src/routes/`.
- Tests are colocated (`foo.server.test.ts` next to `foo.server.ts`). Shared mock helpers (`createMockDb`, `createQueryChain`, `createServerFnStub`, `createSessionsMock`, `makeSafeUser`) live in `src/test/mocks.ts` — use them for new tests; `src/lib/admin-actions.server.test.ts` shows the pattern. Component tests mock `@tanstack/react-router` and server-fn modules — copy `src/components/comments/Comment.test.tsx`.
- Auth: `getCurrentUser` from `src/lib/sessions.server.ts`. Admin gating pattern: see `src/routes/admin.tsx` (guard) and `src/routes/admin.reported-posts.tsx` (a full admin page).
- DB schema: `src/db/schema.ts` (Drizzle, ~30 rDrama-compatible tables). Guiding rule: preserve rDrama database compatibility unless a migration clearly simplifies things. Schema changes: edit schema, `pnpm db:generate`, `pnpm db:migrate`.
- Markdown: always store both raw (`body`) and rendered (`bodyHtml`) via `src/lib/markdown.ts` render functions; never render markdown ad hoc.

Out of scope for v1 (do not start): 2FA, messaging/chat, OAuth app flows, volunteer janitor, static pages (rules/about/RSS), coins economy / award shop / marseys / hats, polls, holes/sub-communities.

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

- [x] **T10: Filtered/removed/shadowbanned content queues** *(done 2026-07-09: getModQueueSubmissions/getModQueueComments in admin.server.ts (FILTERED/REMOVED by stateMod, SHADOWBANNED = visible content from shadowbanned authors), tabbed /admin/filtered page reusing setSubmission/setCommentModerationStateFn for approve/remove, data-driven admin nav, 3 new query tests)*
  - *Why*: Mods can only see *reported* content; content in FILTERED/REMOVED state or from shadowbanned users has no review surface.
  - *Files*: new `src/routes/admin.filtered.tsx` (or similar); queries in `src/lib/admin.server.ts` filtering `submissions`/`comments` by `stateMod` enum (`FILTERED`/`REMOVED`) and authors with `shadowBanned` set; reuse existing remove/unremove/approve actions from `src/lib/admin-actions.server.ts`.
  - *Done when*: each queue lists matching content with working approve/remove actions; non-admins are redirected.
  - *Verify*: `pnpm test --run && pnpm check`; manually via an admin user in `pnpm dev`.

- [x] **T11: Mod log view** *(done 2026-07-09: getModLog in admin.server.ts (actor/target-user/target-post joins, 50/page + hasMore via limit+1), paginated newest-first /admin/mod-log page with nav link; 3 query tests)*
  - *Why*: `modActions` rows are written on every mod action but there is no way to read them.
  - *Files*: new `src/routes/admin.mod-log.tsx`; query in `src/lib/admin.server.ts` joining `modActions` to `users` (actor) with pagination; render kind/target/actor/timestamp.
  - *Done when*: paginated, newest-first mod log page exists under `/admin`.
  - *Verify*: `pnpm test --run && pnpm check`; perform a mod action in dev and see it appear.

- [x] **T12: User investigation view** *(done 2026-07-09: /admin/users/$id page (admin.users_.$id.tsx) with status badges, mod-note list + add form (existing createUserNoteFn), report history against the user (flags + commentFlags via new getUserReportHistory), recent posts/comments via getUserRecentActivity with state badges; "Investigate" link from user search; 2 new query tests. Only the fields the page needs are sent to the client — not the full users row.)*
  - *Why*: `src/routes/admin.users.tsx` exists but lacks context for decisions: notes, recent activity, report history.
  - *Files*: extend `src/routes/admin.users.tsx` (or add `admin.users.$id.tsx`); `userNotes` table in `src/db/schema.ts`; queries in `src/lib/admin.server.ts` for the user's recent submissions/comments, reports filed against them (`flags`/`commentFlags`), and CRUD for `userNotes`.
  - *Done when*: an admin can open a user and see notes (add/view), recent activity, and report history in one place.
  - *Verify*: `pnpm test --run && pnpm check`; manual walkthrough in dev.

- [x] **T13: Banned-domain management** *(done 2026-07-09: assertUrlDomainAllowed in submissions.server.ts throws BannedDomainError (exact host or subdomain match) from createSubmission/updateSubmission; updateSubmissionFn maps it to a friendly error (submit.tsx already surfaced thrown messages); /admin/banned-domains CRUD page + listBannedDomains query + add/removeBannedDomainFn actions with domain normalization (scheme/www/path stripping) and ban_domain/unban_domain mod-log entries; 5 enforcement + 4 action tests)*
  - *Why*: The `bannedDomains` table exists with no feature code — banned domains are currently not enforced at all.
  - *Files*: enforcement in `createSubmission`/`updateSubmission` in `src/lib/submissions.server.ts` (reject URLs whose host matches a banned domain); admin CRUD page `src/routes/admin.banned-domains.tsx` + queries/actions in `src/lib/admin.server.ts` / `admin-actions.server.ts`.
  - *Done when*: submitting a link to a banned domain is rejected with the stored reason; admins can add/remove domains; both behaviors have server tests.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T14: Badges/awards management + backing actions** *(done 2026-07-09: award-actions.server.ts with createBadgeDefFn / grantBadgeFn / revokeBadgeFn (admin, by username, mod-logged) and awardContentFn (validates AWARD_OPTIONS kind from constants.ts, inserts awardRelationships + bumps author receivedAwardCount); /admin/badges page (define + grant/revoke); AwardModal wired to a new Award button on the post page; profile header renders granted badges via getUserBadges → ProfilePageData.badges; 9 action tests + profile render test. Award note text is not persisted (awardRelationships has no note column).)*
  - *Why*: Schema (`badgeDefs`, `badges`, `awardRelationships`) and `src/components/modals/AwardModal.tsx` exist, but there are no server actions — the modal does nothing real.
  - *Files*: new `src/lib/award-actions.server.ts` (grant/revoke badge, award content) wired into `AwardModal.tsx`; admin management page for `badgeDefs`; display granted badges on `src/components/profile/user-page.tsx`.
  - *Done when*: an admin can define a badge, grant it to a user, and it renders on the profile; actions are tested.
  - *Verify*: `pnpm test --run && pnpm check`; manual grant in dev.

- [x] **T15: Site settings / config toggles** *(done 2026-07-09: two toggles — signups_enabled (default on) and read_only (default off) — metadata in constants.ts, values in Redis under site_setting:* via site-settings.server.ts (no migration needed); /admin/settings page with switches via site-settings-actions.server.ts (admin-gated updateSiteSettingFn, logs update_site_setting mod action); enforced in createUser (signup), submitAction (post create), createCommentFn, and both vote fns in VoteButtons.tsx; edits/deletes intentionally left allowed in read-only mode. 9 new tests incl. signup-disabled and read-only-comment rejections.)*
  - *Why*: There is no runtime kill-switch for signups or site-wide read-only mode.
  - *Files*: **first enumerate** which toggles are worth having (suggested minimum: `signups_enabled`, `read_only`); store in Redis (`src/lib/redis.ts`) or a small new table (migration via `pnpm db:generate`); admin page `src/routes/admin.settings.tsx`; enforce in `src/lib/auth.server.ts` (signup) and the write-path server fns.
  - *Done when*: toggling each setting changes behavior immediately and is covered by a server test.
  - *Verify*: `pnpm test --run && pnpm check`; flip each toggle in dev and confirm.

## Security hardening (priority)

- [x] **T17: Server-side auth for admin GET server-fns + `requireUser`/`requireAdmin` helpers** *(done 2026-07-10: auth-guards.server.ts with requireUser/requireAdmin (typed GuardResult) + assertAdmin (throwing, for GET/loader fns); assertAdmin applied to all 8 admin route GET fns plus getSiteSettingsFn; shared parameterized test in admin-route-guards.test.tsx covers logged-out/non-admin rejection + admin success per fn, plus guard unit tests)*
  - *Why*: the admin GET server-fns (`admin.reported-posts.tsx`, `admin.reported-comments.tsx`, `admin.mod-log.tsx`, `admin.users.tsx`, `admin.badges.tsx`, `admin.banned-domains.tsx`, `admin.filtered.tsx`) do no server-side auth — only the layout-loader guard in `admin.tsx` protects them, but they are directly callable RPC endpoints. A non-admin can fetch mod logs, reported content, and user search by hitting the endpoint directly.
  - *Files*: new `src/lib/auth-guards.server.ts` with `requireUser()` and `requireAdmin()` (wrap `getCurrentUser` from `src/lib/sessions.server.ts`; throw or return a typed result); apply to every GET fn in `src/routes/admin.*.tsx`.
  - *Done when*: each admin GET fn rejects non-admin callers (server test per fn, or one shared parameterized test); helpers are exported for T18 to reuse.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T18: Migrate all `*-actions.server.ts` to the shared guards + shared `ActionResult<T>` type** *(done 2026-07-10: all 9 actions files now use requireUser/requireAdmin (GuardResult carries a ready-to-return ActionFailure) and fail() for inline errors; ActionResult<T>/ActionFailure exported from auth-guards.server.ts; zero `success: false as const` literals remain; pure refactor — all existing action tests passed unchanged)*
  - *Why*: the `getCurrentUser()` → `"Not logged in"` / `adminLevel < 2` → `"Unauthorized"` guard block is copy-pasted ~50 times across `admin-actions`, `award-actions`, `comment-actions`, `post-actions`, `reporting-actions`, `social-actions`, `session-actions`, `site-settings-actions`, `notification-actions`; the `{ success: false as const, error }` shape is redeclared per file.
  - *Files*: all `src/lib/*-actions.server.ts`; put `ActionResult<T>` next to the T17 helpers. Pure refactor — no behavior change; existing tests must stay green.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T19: Real input validation (zod) on all server fns** *(done 2026-07-10: every identity inputValidator replaced with a zod parse — all 9 actions files, all route-local server fns (feeds, profiles, search, admin, notifications, followers/following) and VoteButtons; shared primitives + route schemas in src/lib/validation.ts (idSchema, pageSchema, voteTypeSchema, sort/time/comment-sort enums from constants); action schemas exported per file; 20 new invalid-input tests incl. validation.test.ts)*
  - *Why*: most `.inputValidator((data) => data)` calls are identity passthroughs that only type-assert — untrusted client input reaches DB writes unvalidated. Only `reporting-actions.server.ts` and `post-actions.server.ts` use zod today.
  - *Files*: every `src/lib/*-actions.server.ts` (and route-local server fns) with a passthrough validator; copy the zod pattern from `src/lib/reporting-actions.server.ts`.
  - *Done when*: `grep -rn "inputValidator((data" src/lib src/routes` finds only zod-parsing validators; at least one invalid-input test added per migrated file.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T20: Rate limiting on auth + write endpoints** *(done 2026-07-10: rate-limit.server.ts — Redis sorted-set sliding window (enforceRateLimit + getClientIp), fail-open on Redis errors; limits in RATE_LIMITS in constants.ts (login 10/5m, signup 5/1h, reset request 3/15m + consume 10/15m, post 6/10m, comment 20/10m, vote 60/1m); enforced in authenticateUser/createUser (keyed by IP with identifier fallback), requestPasswordReset/resetPasswordWithToken, submitAction, createCommentFn, and both vote fns (keyed by user id); requestPasswordReset now returns a result union surfaced by forgot-password.tsx; 9 limiter unit tests (limit-hit, window-reset, fail-open, IP parsing) + 5 enforcement tests)*
  - *Why*: no throttling anywhere — login, signup, password reset, and content creation are all unlimited. Redis is already available.
  - *Files*: new `src/lib/rate-limit.server.ts` (sliding window or token bucket on `src/lib/redis.ts`); enforce in `src/lib/auth.server.ts` (login/signup), `src/lib/password-reset.server.ts` (request + consume), and the create-post/create-comment/vote server fns. Limits as constants in `src/lib/constants.ts`.
  - *Done when*: exceeding a limit returns a friendly error; unit tests with mocked Redis cover limit-hit and window-reset.
  - *Verify*: `pnpm test --run && pnpm check`

## Feature completion (finish half-built)

- [x] **T21: Render awards on posts, comments, and profiles** *(done 2026-07-10: awards.server.ts with batched getSubmissionAwardCounts/getCommentAwardCounts (one grouped query per list, AWARD_OPTIONS display order); optional `awards` field on SubmissionSummary/CommentSummary attached in getSubmissions/getSubmissionById and the comment thread/permalink/single-comment paths (not on mod-hidden placeholders); AWARD_OPTIONS gained emoji icons; shared AwardChips component rendered in feed items, post header, and comment header; profile header shows receivedAwardCount. 4 grouping tests + attach assertions + 2 chip render tests. Manual grant-and-see check in dev still worthwhile when the stack is up.)*
  - *Why*: `awardContentFn` inserts `awardRelationships` and bumps `receivedAwardCount`, but nothing ever displays them — award-in, no award-out.
  - *Files*: batched queries joining `awardRelationships` in `src/lib/submissions.server.ts` / `src/lib/comments.server.ts` (one query per list, not per row); display icons + counts on `src/routes/post.$id.tsx`, `src/components/comments/Comment.tsx`, `src/components/recent-submissions.tsx`; show `receivedAwardCount` on `src/components/profile/user-page.tsx`. Award kinds/icons come from `AWARD_OPTIONS` in `src/lib/constants.ts`.
  - *Done when*: an awarded post/comment shows its awards in feed, post page, and comment tree; profile shows the received-award count.
  - *Verify*: `pnpm test --run && pnpm check`; grant an award in dev and see it render.

- [x] **T22: Home feed pagination** *(done 2026-07-10: getSubmissionsPage in submissions.server.ts (HOME_FEED_PER_PAGE=25, limit+1 hasMore per getModLog pattern, clamps bad pages); `page` search param on index.tsx (default 1) with Previous/Next controls copied from user-page.tsx; sort/time changes reset to page 1, page changes preserve sort/t; feedInputSchema gained optional page. 2 paging tests. Note: hasMore can read false at a page boundary if the 26th row's author is blocked (post-query block filtering predates this task).)*
  - *Why*: `getSubmissions` supports `limit`/`offset` but `src/routes/index.tsx` never passes them — the feed is capped at 25 with no way to see more.
  - *Files*: `src/routes/index.tsx` (page search-param or "load more"); `src/lib/submissions.server.ts` (`hasMore` via limit+1 — copy `getModLog`'s pattern in `src/lib/admin.server.ts`); keep sort/time filters intact in pagination links.
  - *Done when*: users can page through the whole feed; sort/time selections survive page changes.
  - *Verify*: `pnpm test --run && pnpm check`; seed >25 posts (`pnpm generate-data`) and page through in dev.

- [x] **T23: Generalize notifications beyond comments (follow + award notifications)** *(done 2026-07-10: notifications table restructured — serial id PK (was composite user/comment PK, now a unique index), nullable commentId, new type/actorId/body/url columns; migration 0004 applied. Deviates from rDrama, which keeps comment_id NOT NULL and models system notifications as comments from a system user — noted in a schema comment. createSimpleNotification (skips self-notify) emitted on new follow (inside setFollowState tx, only when a row was actually inserted) and on award; notifications page merges comment + simple rows newest-first, unread count includes simple rows with block/shadowban filtering; mark-read now keyed by notification id end to end. 3 new server tests + emitter assertions in social/award tests.)*
  - *Why*: the `notifications` table is keyed on `commentId` only, so non-comment notification types are structurally impossible; follows and awards are silent today.
  - *Files*: `src/db/schema.ts` (make `commentId` nullable + add a type/body column — check how rDrama models this first, per the schema-compat guiding rule; then `pnpm db:generate` + `pnpm db:migrate`); emit in `src/lib/social.server.ts` (on follow) and `src/lib/award-actions.server.ts` (on award); render the new types in `src/routes/notifications.tsx`; unread-count logic in `src/lib/notifications.server.ts` should keep working unchanged.
  - *Done when*: following a user and awarding their content each produce a notification; existing reply/mention/subscription notifications unaffected.
  - *Verify*: `pnpm test --run && pnpm check`; follow + award in dev and see both notifications.

- [x] **T24: Manual alt-linking for admins** *(done 2026-07-10: linkUserAltFn/unlinkUserAltFn in admin-actions.server.ts — link by username, pair normalized user1<user2, isManual set (upserts over auto-detected rows), link_alt/unlink_alt mod-log entries, self-link and unknown-user rejected; getUserAlts query (order-agnostic) in admin.server.ts; "Linked Alts" section on /admin/users/$id with add-by-username form, manual/auto badges, cross-links to each alt's investigation page, and unlink buttons; BanModal now accepts knownAlts via openBanModal(options) and lists them next to the "Ban known alts" checkbox. 5 new tests. Note: openBanModal still has no caller (pre-existing — the ban flows use inline forms) and banUserFn still ignores banAlts; wiring the ban-alts flow is future work.)*
  - *Why*: the `alts` table renders in `src/components/modals/BanModal.tsx` but nothing can ever write rows; `isManual` is never set.
  - *Files*: link/unlink actions in `src/lib/admin-actions.server.ts` (set `isManual`, write a mod-log entry); UI on the user investigation page `src/routes/admin.users_.$id.tsx` (list alts there too).
  - *Done when*: an admin can link/unlink two accounts as alts; the link shows in both BanModal and the investigation page; actions are tested.
  - *Verify*: `pnpm test --run && pnpm check`; link two users in dev and check both surfaces.

## Customization & settings

- [ ] **T25: Expose dormant user settings — theme, over18, slur replacer**
  - *Why*: `users.theme`, `users.over18`, `users.slurReplacer` columns exist with no UI or enforcement.
  - *Files*: `src/routes/me.tsx` + the settings update in `src/lib/users.server.ts` (follow the existing toggle patterns); theme applied in `src/routes/__root.tsx`; over18 gates NSFW-marked submissions in feed/post queries; slur replacer applied at render time. **Scope-check first**: if a piece has no backing data (e.g. no NSFW flag actually set on submissions), note it in the close-out and skip that toggle rather than shipping a dead switch.
  - *Done when*: each shipped toggle visibly changes behavior and has a server test.
  - *Verify*: `pnpm test --run && pnpm check`; flip each toggle in dev.

- [ ] **T26: Mod-assigned user flair / custom title**
  - *Why*: `customTitle` (HTML) vs `customTitlePlain` and `flairChanged` exist, but only self-service plain titles work — mods cannot assign or lock a title.
  - *Files*: admin action in `src/lib/admin-actions.server.ts` (set title, set `flairChanged` lock, mod-logged; render via `src/lib/markdown.ts` — never ad hoc); UI on `src/routes/admin.users_.$id.tsx`; `src/routes/me.tsx` blocks self-edit while `flairChanged` is set; title renders through the existing profile/comment display paths.
  - *Done when*: a mod can set + lock a user's title; the user can't override it while locked; action is tested.
  - *Verify*: `pnpm test --run && pnpm check`

- [ ] **T27: Profile CSS (`users.profileCss`)**
  - *Why*: the column exists and it's a signature rDrama feature. **Security-sensitive**: CSS must be sanitized/scoped — strip `@import`/`url()` exfiltration vectors, scope selectors under the profile container, and inject only on profile pages, never globally.
  - *Files*: editor field in `src/routes/me.tsx`, update + sanitization in `src/lib/users.server.ts`, injection in `src/components/profile/user-page.tsx`. Research a CSS sanitization approach first; if nothing is satisfyingly safe, ship behind an admin-approval flag and say so in the close-out note.
  - *Done when*: a user can set profile CSS that styles only their profile page; sanitizer unit tests include hostile-CSS cases (`@import`, `url()`, selector escape attempts).
  - *Verify*: `pnpm test --run && pnpm check`

## Codebase quality

- [x] **T28: Unify submission/comment visibility derivation** *(done 2026-07-10: shared deriveModerationVisibility in comment-visibility.server.ts — REMOVED/FILTERED/deleted classification + hidden/message derivation, with per-caller messages and hideRemovedFromModerators/hideDeletedFromModerators knobs (submissions placeholder those even for mods; comments don't); mapSubmissionRow and getCommentVisibility both delegate to it. All 326 existing tests green. One combined-state edge converged: a post that is both author-deleted and mod-removed now reads "removed by moderator" (moderation trumps self-delete, matching the comment path) instead of "deleted by author".)*
  - *Why*: the same REMOVED/FILTERED/user-deleted state machine is implemented twice — inline in `src/lib/submissions.server.ts` (~lines 104–160) and in `src/lib/comment-visibility.server.ts` (~lines 82–147) — with separately maintained message constants.
  - *Files*: extract a shared `deriveVisibility(state, viewer)` (natural home: generalize `comment-visibility.server.ts`); migrate both callers. Pure refactor; existing tests stay green.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T29: Shared test-mock helpers** *(done 2026-07-10: src/test/mocks.ts with createMockDb, createQueryChain (chainable + thenable — awaiting anywhere in the builder chain resolves the configured result, so one helper replaces every terminal-specific variant), createServerFnStub, createSessionsMock, makeSafeUser; migrated admin-actions.server.test.ts (~90 lines of boilerplate gone), admin.server.test.ts, users.server.test.ts; testing notes updated in CLAUDE.md and this file's orientation. Remaining files migrate opportunistically as touched.)*
  - *Why*: 15 test files hand-roll the same chainable `@/db` mock, 12 duplicate the `createServerFn` stub, 13 the sessions mock — the largest test files are mostly this boilerplate.
  - *Files*: new `src/test/mocks.ts` exporting the chainable-db builder, the `createServerFn` stub, and the sessions mock; migrate the 2–3 biggest test files (`src/lib/admin-actions.server.test.ts`, `src/lib/admin.server.test.ts`, `src/lib/users.server.test.ts`) as the pattern; remaining files migrate opportunistically as they're touched. Update the testing notes in `CLAUDE.md`/this file's orientation section to point at the helpers.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T30: Bound the unbounded admin queries** *(done 2026-07-10: getReportedSubmissions/getReportedComments now take a page and return {entries, page, hasMore} (REPORTED_PER_PAGE=50, limit+1 per getModLog); flags are fetched only for the page's ids; both reported routes gained a page search param + Previous/Next controls (shown only when there's more than one page); /admin index redirect updated. 1 new bounding test + shape updates.)*
  - *Why*: `getReportedSubmissions` / `getReportedComments` in `src/lib/admin.server.ts` have no `.limit()` — they load the entire reported set.
  - *Files*: add limit + pagination (copy `getModLog`'s limit+1/`hasMore` pattern in the same file); wire page controls into `src/routes/admin.reported-posts.tsx` and `admin.reported-comments.tsx`.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T31: Type the raw-SQL rows in `comments.server.ts`** *(done 2026-07-10: RawCommentSqlRow type + mapRawCommentSqlRow give the raw subtree SQL a single typed boundary (one cast at the query, replacing ~22 scattered field casts); new src/lib/enums.ts with parseEnum/parseVoteType/parseModerationState/parseSortType/parseTimeFilter/parseCommentFeedSortType — now used by comments.server.ts, submissions.server.ts, votes.server.ts, profile-route.ts (its three parse fns delegate), and VoteButtons.tsx (NO_VOTE constant replaces the `0 as VoteType` casts); enums.test.ts covers fallbacks.)*
  - *Why*: ~31 `as` casts on `Record<string, unknown>` rows in the largest lib file (1100 lines) — the main type-safety hotspot.
  - *Files*: `src/lib/comments.server.ts` — one typed row-mapper per query shape replacing the scattered casts; small enum-parse helpers (`VoteType`, `ModerationState`, `SortType`) reusable by `src/lib/votes.server.ts`, `src/lib/profile-route.ts`, and `src/components/comments/VoteButtons.tsx`.
  - *Verify*: `pnpm test --run && pnpm check`

- [x] **T32: One post-mutation refresh convention** *(done 2026-07-10: standardized on router.invalidate() + loader data; converted the loader-mirroring admin pages — reported-posts, reported-comments, filtered queues, users_.$id (notes + alts, which previously faked a note row client-side with id Date.now()), banned-domains, badges, settings; convention documented in CLAUDE.md's data-layer section. admin.users.tsx UserRow state intentionally kept: its rows come from an on-page search server-fn call, not the loader, so invalidate() would not refresh them. Manual click-through of the admin queues in dev still worthwhile.)*
  - *Why*: `router.invalidate()` (19 call sites) coexists with manual `useState` patching of loader data (the admin pages) — confusing precedent for every future feature.
  - *Files*: standardize on `router.invalidate()` + loader data (the majority pattern); convert the admin pages' local-state mirrors (`src/routes/admin.reported-posts.tsx` etc.); document the convention in CLAUDE.md's data-layer section.
  - *Verify*: `pnpm test --run && pnpm check`; click through the admin queues in dev.

- [x] **T33: Stop swallowing Elasticsearch index failures** *(done 2026-07-10: indexSubmissionBestEffort/indexCommentBestEffort now retry the upsert once; a persistent failure is reported via Sentry.captureException (tags: feature=search-index, documentType; no-op when Sentry isn't initialized) and the console.error message names `pnpm reindex-search` as the recovery path. 2 tests: retry-then-report and retry-succeeds-silently.)*
  - *Why*: `src/lib/search.server.ts` (~lines 772–786) catches index failures and only `console.error`s — silent divergence between Postgres and the search index.
  - *Files*: `src/lib/search.server.ts` — report to Sentry (`captureException`) at minimum, consider a single retry; mention `pnpm reindex-search` as the recovery path in the error log message.
  - *Verify*: `pnpm test --run && pnpm check`

---

## Recently completed (context, not tasks)

- 2026-07-10: Dropped T16 (bruno write-flow coverage) — TanStack Start server-fn endpoints are awkward to drive from bruno; revisit API smoke testing later if needed. The T16 ID stays retired.
- 2026-07-09: Fixed comment-edit markdown bug — `updateCommentFn` now returns the re-rendered comment and `Comment.tsx` displays `bodyHtml` instead of raw markdown after edit; regression test in `src/components/comments/Comment.test.tsx`.
- Search (Elasticsearch) is **fully implemented and tested** (`src/lib/search.server.ts`, `src/routes/search.tsx`) — an older TODOS.md wrongly listed it as missing.
