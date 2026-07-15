# rDreamer TODO — core rDrama parity roadmap

This queue targets core TheMotte-style forum parity with rDrama. It is ordered by user value and risk, not by route count or implementation cost.

## How to work this file

1. Pick the **first unchecked task**. Earlier tasks may establish interfaces used by later work.
2. Read the listed files and the corresponding implementation in `../rDrama` before writing code.
3. Keep one task per commit, with a short commit subject beginning with its task ID.
4. Add colocated tests for authentication, authorization, validation, success, idempotency, and forbidden state transitions as applicable.
5. Run the task's focused tests, then `pnpm test --run && pnpm check`. Never check a task off while either command fails.

Current baseline: `pnpm test --run && pnpm check` passes (45 test files, 335 tests as of 2026-07-15).

### Project conventions

- TanStack Start server data lives in `src/lib/*.server.ts`; client-callable functions use `createServerFn`, normally in `*-actions.server.ts`.
- Use `requireUser` / `requireAdmin`, shared `ActionResult` helpers, zod input validation, and the rate limiter for all new server functions.
- Reuse the test helpers in `src/test/mocks.ts` and refresh loader data with `router.invalidate()` after mutations.
- Preserve rDrama database compatibility where practical. Explain any intentional deviation in the schema and migration.
- Store raw markdown and rendered HTML together through `src/lib/markdown.ts`; never render or sanitize it ad hoc.
- Expose the minimum result shape needed by the client. Public routes must not reuse unrestricted admin result types.

## Priority 0 — security and moderation correctness

- [x] **T34: Complete automatic content filtering**
  - *Why*: filtered-content queues exist, but normal creation always writes `VISIBLE`; `users.filterBehavior` and rDrama's automatic thresholds are dormant.
  - *Implementation*: generalize site-setting metadata to support booleans and bounded integers stored in Redis. Add `filter_new_posts`, `filter_comments_min_age_days`, `filter_comments_min_comments`, and `filter_comments_min_karma`. For comments, `UNFILTERED` bypasses filtering, `FILTERED` always filters, and `AUTOMATIC` evaluates the thresholds; admins bypass filtering. New non-admin posts use `filter_new_posts`. Write the derived `stateMod` in the creation transaction so existing queues pick it up immediately.
  - *Files*: `src/lib/site-settings.server.ts`, `src/lib/site-settings-actions.server.ts`, `src/routes/admin.settings.tsx`, `src/lib/submissions.server.ts`, `src/lib/comments.server.ts`.
  - *Done when*: an admin can configure the policy, per-user behavior affects new comments, and filtered creations are absent from public feeds/search but present in `/admin/filtered`.
  - *Verify*: focused settings/submission/comment tests; `pnpm test --run && pnpm check`; manually create content under each behavior.

- [x] **T35: In-account password changes**
  - *Why*: password reset exists, but a signed-in user cannot rotate a known password.
  - *Implementation*: add a security-settings action requiring the current password, a valid replacement and confirmation. Hash the replacement, invalidate outstanding password-reset tokens, and revoke every session except the current one. Rate-limit attempts by user ID.
  - *Files*: new `src/lib/account-actions.server.ts` (or a clearly separated security module), `src/lib/sessions.server.ts`, `src/lib/password-reset.server.ts`, `src/routes/me.tsx`.
  - *Done when*: a valid change preserves the current session, revokes other sessions and reset links, and the old password no longer authenticates; incorrect-current-password requests make no writes.
  - *Verify*: focused auth/session/reset tests; `pnpm test --run && pnpm check`; manual two-browser check.

- [x] **T36: Verified email ownership and email changes**
  - *Why*: signup accepts an email and password reset trusts it, but `users.isActivated` is never set and users cannot safely change addresses.
  - *Implementation*: issue opaque, single-use Redis tokens with a one-hour TTL after signup and on a rate-limited resend. Existing unverified accounts remain usable. An email-change request requires the current password, verifies uniqueness, and stores the pending address only in the token payload; consuming it atomically updates `email` and `isActivated`. Do not reveal account existence from public responses.
  - *Files*: `src/lib/auth.server.ts`, `src/lib/mail.server.ts`, a new email-verification server module, `src/routes/signup.tsx`, `src/routes/me.tsx`, and a verification route.
  - *Done when*: signup/resend/change links are expiring and single-use, address collisions are rejected, and no email is changed before verification.
  - *Verify*: token, mail, expiry, replay, collision, and authorization tests; `pnpm test --run && pnpm check`.

- [x] **T37: Restore self-deleted posts and comments**
  - *Why*: rDreamer exposes author deletion but not rDrama's inverse lifecycle operation.
  - *Implementation*: add transactional restore helpers and actions. Only the author may restore, and only while `stateMod` is `VISIBLE`; moderator removal always wins. Render Restore on author-visible deleted placeholders. Do not modify counts, scores, saves, or votes because deletion currently leaves them intact.
  - *Files*: `src/lib/lifecycle.server.ts`, `src/lib/post-actions.server.ts`, `src/lib/comment-actions.server.ts`, post/comment components.
  - *Done when*: deleted content can be restored by its author, cannot be restored by anyone else or while removed/filtered, and becomes visible and searchable again.
  - *Verify*: lifecycle/action/component tests; `pnpm test --run && pnpm check`.

- [ ] **T38: Duplicate and repost protection**
  - *Why*: rDrama detects accidental duplicates and existing URLs; rDreamer currently relies only on rate limits.
  - *Implementation*: normalize post URLs consistently with banned-domain checks. Hard-reject an identical active post by the same author and an identical comment by the same author under the same parent. For an existing visible URL from any author, return the existing post summary and require an explicit `allowRepost` confirmation rather than silently redirecting.
  - *Files*: `src/lib/submissions.server.ts`, `src/lib/comments.server.ts`, submit/comment actions and forms.
  - *Done when*: exact duplicates cannot be created and repost warnings link to the existing post without blocking deliberate reposts.
  - *Verify*: normalization, hidden-content, same-parent, confirmation, and race-condition tests; `pnpm test --run && pnpm check`.

## Priority 1 — everyday forum behavior

- [ ] **T26: Finish moderator-assigned titles**
  - *Why*: moderators can already set rendered title text, but the `flairChanged` lock is not written and users can overwrite it.
  - *Implementation*: extend the existing moderation-profile action and UI with explicit set/clear lock behavior, write a dedicated mod-log entry, expose the lock state to settings, and reject self-service title changes while locked. Use the existing markdown rendering path.
  - *Files*: `src/lib/admin-actions.server.ts`, `src/routes/admin.users_.$id.tsx`, `src/lib/users.server.ts`, `src/routes/me.tsx`.
  - *Done when*: a moderator can assign and lock a title, the user receives a clear read-only explanation, and unlocking restores self-service editing.
  - *Verify*: admin/user action and settings component tests; `pnpm test --run && pnpm check`.

- [ ] **T39: Profile-post and OP-comment pinning**
  - *Why*: profile queries already sort `submissions.isPinned`, while the only working comment pin is a moderator action.
  - *Implementation*: let an author toggle their post's profile pin. Let a post author pin/unpin a comment using an `(OP)` `pinnedBy` marker and notify the comment author when it changes. OP actions must not remove moderator pins; moderator behavior and mod logging stay unchanged.
  - *Files*: `src/lib/lifecycle.server.ts`, post/comment actions, `src/routes/post.$id.tsx`, `src/components/comments/Comment.tsx`, notifications.
  - *Done when*: pinned posts lead the author's profile and OP versus moderator comment pins have distinct permissions and labels.
  - *Verify*: permission, precedence, notification, and rendering tests; `pnpm test --run && pnpm check`.

- [ ] **T40: Blocked-users and follower management**
  - *Why*: users can block from a profile but cannot review their block list or remove an unwanted follower.
  - *Implementation*: add a paginated blocked-users query and settings surface with unblock controls. Add an owner-only remove-follower action. Reuse the existing block/follow transactions and visibility rules; do not expose private profiles through list results.
  - *Files*: `src/lib/social.server.ts`, `src/lib/social-actions.server.ts`, a settings route/component, relationship pages.
  - *Done when*: users can list/unblock everyone they block and remove a follower, with stored counters remaining correct and actions idempotent.
  - *Verify*: privacy, pagination, counter, and action tests; `pnpm test --run && pnpm check`.

- [ ] **T41: Username changes and canonical profile redirects**
  - *Why*: `originalUsername` exists and rDrama supports renames, but rDreamer does not.
  - *Implementation*: require the current password; apply signup's username rules; enforce case-insensitive uniqueness against both `username` and `originalUsername`; preserve the first original name. Canonical profile lookup should redirect matches on the original name to the current URL. Relationships and sessions remain ID-based.
  - *Files*: account actions, `src/lib/users.server.ts`, profile loaders, `src/routes/me.tsx`.
  - *Done when*: renames cannot steal current or original names, old profile links redirect, and existing content/relationships show the new canonical name.
  - *Verify*: collision, case-only, password, canonicalization, and relationship tests; `pnpm test --run && pnpm check`.

- [ ] **T42: Complete NSFW behavior**
  - *Why*: post create/edit and preference gating exist, but comments cannot be marked NSFW and comment-level visibility is incomplete.
  - *Implementation*: add author/moderator comment toggles; retain existing post editing; hide NSFW comment bodies/media from guests and users without `over18` while retaining thread structure. Log moderator-initiated changes and avoid indexing hidden bodies for ineligible viewers.
  - *Files*: comment/admin actions, comment visibility and search filtering, `src/components/comments/Comment.tsx`.
  - *Done when*: authors and moderators can toggle the flag with correct permissions and every feed/permalink/search surface applies the same gate.
  - *Verify*: viewer matrix, moderation log, search, and component tests; `pnpm test --run && pnpm check`.

- [ ] **T43: Make exposed preferences functional**
  - *Why*: settings persist `defaultSorting`, `defaultTime`, `defaultSortingComments`, `hideVotedOn`, `cardView`, `highlightComments`, link-target choices, and colors, but most do not affect the UI.
  - *Implementation*: apply saved defaults only when URL parameters are absent; exclude already-voted posts server-side when requested; add list/card (catalog) feed presentation; honor new-comment highlighting and internal/external new-tab choices; render username/title colors and a safe root theme-color variable. Remove a control rather than leaving it dead if its behavior cannot be made observable.
  - *Files*: root/index/post routes, feed/comment/profile components, submission query, settings tests.
  - *Done when*: every exposed control has a visible, tested effect and explicit URLs continue to override defaults.
  - *Verify*: loader/query/component matrix tests; `pnpm test --run && pnpm check`; manual settings walkthrough.

- [ ] **T44: Draft posts and publishing**
  - *Why*: `submissions.private` is read in visibility paths but no user flow creates or publishes drafts.
  - *Implementation*: allow draft creation, owner/admin-only viewing and editing, and explicit publish. Exclude drafts from public feeds, other users' profiles, search, notifications, and public counters. Publishing is a transaction that assigns the public timestamp and performs normal author vote, subscription, counter, and indexing work exactly once.
  - *Files*: `src/lib/submissions.server.ts`, post actions, submit/post/profile routes, search/notification tests.
  - *Done when*: a draft remains private across all surfaces and a concurrent/repeated publish cannot double-count it.
  - *Verify*: privacy matrix and publish idempotency tests; `pnpm test --run && pnpm check`.

## Priority 2 — community discovery and transparency

- [ ] **T45: Essential community pages**
  - *Why*: rules and formatting help are part of the normal participation flow, not optional marketing pages.
  - *Implementation*: add `/rules` from the existing TheMotte rules content and `/formatting` generated from the markdown features rDreamer actually supports. Link formatting help from post and comment create/edit forms.
  - *Files*: new public routes/content modules, markdown options, editor components, header/navigation as appropriate.
  - *Done when*: both pages are usable without login, formatting examples match the renderer, and editor links preserve new-tab preferences.
  - *Verify*: route and markdown-example tests; `pnpm test --run && pnpm check`.

- [ ] **T46: Public transparency pages**
  - *Why*: rDreamer's mod log and user oversight data are admin-only, while rDrama exposes a safe public transparency layer.
  - *Implementation*: add public admin, banned-user, basic-statistics, and moderation-log pages. Define a positive `PUBLIC_MOD_ACTION_KINDS` allowlist and a separate redacted query shape; omit notes, shadowban actions, alt information, investigation data, emails, and private/deleted targets. Keep `/admin/mod-log` unrestricted for moderators.
  - *Files*: new public query module/routes, `src/lib/admin.server.ts` only where shared private helpers are safe.
  - *Done when*: anonymous users can browse paginated public data and no sensitive action or field can be exposed by filters or direct server-function calls.
  - *Verify*: allowlist/redaction/auth/pagination tests; `pnpm test --run && pnpm check`.

- [ ] **T47: Random-user and catalog discovery**
  - *Why*: random-post exists, but rDrama's random-user and catalog discovery surfaces are missing.
  - *Implementation*: add `/random_user`, excluding private, banned, and shadowbanned profiles for normal viewers. Expose T43's card feed at `/catalog` while keeping query sort/time/page state.
  - *Files*: users server query, two route files or redirects into the canonical feed.
  - *Done when*: both routes work anonymously and obey the same visibility rules as profile and feed discovery.
  - *Verify*: visibility and redirect/query-state tests; `pnpm test --run && pnpm check`.

- [ ] **T48: Key legacy GET redirects**
  - *Why*: bookmarked public rDrama URLs should survive migration without recreating its internal action API.
  - *Implementation*: add permanent redirects for `/forgot`, `/reset`, `/settings`, `/@me`, `/log`, and `/modlog`, preserving safe query parameters. Audit rDrama's public navigation for any other high-value GET aliases. Do not implement legacy POST/AJAX endpoints.
  - *Files*: route aliases and route tests; regenerate `src/routeTree.gen.ts` through the normal router workflow.
  - *Done when*: selected legacy links reach the canonical TanStack routes without redirect loops or unsafe parameter forwarding.
  - *Verify*: parameterized route tests; `pnpm test --run && pnpm check`.

## Priority 3 — administrative depth and customization

- [ ] **T49: Finish user-investigation controls**
  - *Why*: investigation can add notes and display alts, but cannot delete notes, set filtering behavior, or actually ban known alts.
  - *Implementation*: add note deletion, `AUTOMATIC`/`UNFILTERED`/`FILTERED` controls, and a transactional ban-known-alts option. Normalize/deduplicate alt pairs, require explicit confirmation, apply the same ban parameters to each account, and log each affected account.
  - *Files*: admin queries/actions, `src/routes/admin.users_.$id.tsx`, ban UI/modal.
  - *Done when*: each control is server-authorized, idempotent, auditable, and loader-driven after mutation.
  - *Verify*: admin-level, partial-alt, transaction, and UI tests; `pnpm test --run && pnpm check`.

- [ ] **T50: Bulk anti-abuse moderation**
  - *Why*: moderators lack rDrama's nuke/unnuke workflow and a direct list of shadowbanned accounts.
  - *Implementation*: add transactional nuke/unnuke actions that change moderation state rather than deleting rows; log one summary action plus enough target information for audit. Add a paginated shadowbanned-user list. Require typed confirmation and level-3 authorization for bulk state changes.
  - *Files*: admin server/actions, a dedicated admin route, lifecycle helpers.
  - *Done when*: bulk changes are reversible, preserve user-deleted state, do not double-count, and cannot partially commit.
  - *Verify*: authorization, rollback, mixed-state, pagination, and confirmation tests; `pnpm test --run && pnpm check`.

- [ ] **T51: Level-3 administrator management**
  - *Why*: rDreamer reads `adminLevel` but cannot promote or demote administrators.
  - *Implementation*: add level-3-only promote/demote actions and investigation-page controls. Prevent self-demotion and removal of the final level-3 account. Log before/after levels.
  - *Files*: admin server/actions and user-investigation UI.
  - *Done when*: lower-level admins cannot call the actions directly and the last-level-3 invariant is enforced transactionally.
  - *Verify*: role matrix, concurrency/invariant, and mod-log tests; `pnpm test --run && pnpm check`.

- [ ] **T27: Safe profile CSS**
  - *Why*: `users.profileCss` is a signature rDrama feature, but unrestricted CSS can exfiltrate data or cover trusted UI.
  - *Implementation*: use a CSS AST parser, not regex. Reject malformed input, all at-rules, remote-resource functions, custom properties, nesting, global/root selectors, positioning, z-index, and other container-escape capabilities. Allowlist visual declarations, prefix every selector with a stable profile-owner container, regenerate CSS, store only the sanitized result, and inject it only on that user's profile routes. See the OWASP CSS guidance and CSSTree documentation linked below.
  - *Files*: sanitizer module/tests, `src/lib/users.server.ts`, `src/routes/me.tsx`, `src/components/profile/user-page.tsx`, `package.json`.
  - *Done when*: safe visual CSS works only inside the profile container and hostile encoded `url()`, `@import`, selector-list, nesting, custom-property, malformed, and container-escape cases are rejected.
  - *References*: https://cheatsheetseries.owasp.org/cheatsheets/Securing_Cascading_Style_Sheets_Cheat_Sheet.html and https://csstree.github.io/docs/
  - *Verify*: sanitizer unit corpus plus profile component tests; `pnpm test --run && pnpm check`.

## Intentionally deferred

Do not start these while unchecked core tasks remain unless scope is explicitly changed:

- Media uploads, remote title fetching, thumbnails, and richer embeds (needs storage, image-processing, quota, moderation, and SSRF design).
- Direct messages, modmail, real-time chat, and notification inbox tabs that depend on them.
- 2FA and lost-device recovery.
- OAuth/API applications and broad legacy action-endpoint compatibility.
- Volunteer janitor, vote-forensics/alt-vote dashboards, and automatic moderator-action rollback.
- Coins/pro-coins, award shop, marseys, hats, loot boxes, polls, and holes/sub-communities.
- RSS, support/contact, changelog, patrons, charts, scheduled tasks, and worker/performance controls.

## Completed foundation

- **T01–T15**: documentation correction, core server/auth/lifecycle tests, session revocation, moderation queues/log/investigation, banned domains, badges/awards, and runtime signup/read-only settings.
- **T16**: retired; direct Bruno coverage of TanStack server-function internals was not useful.
- **T17–T20**: shared server-side auth guards/results, zod validation, and Redis-backed rate limiting.
- **T21–T25**: award rendering, feed pagination, generalized notifications, manual alt linking, and theme/NSFW/slur preferences.
- **T28–T33**: shared visibility logic and test helpers, bounded admin queries, typed raw SQL boundaries, standardized mutation refreshes, and reported search-index failures.
- Search, voting, profiles, follows/blocks, saves, subscriptions, password reset, post/comment CRUD, reports, and the current moderation surfaces are implemented and tested.

When a completed task's details are needed, use git history (`git log --grep='^T'`) and the colocated tests as the source of truth rather than expanding this active queue again.
