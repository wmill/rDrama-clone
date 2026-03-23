# rDreamer TODO

Guiding rule: preserve `rDrama` database compatibility unless a migration clearly simplifies the code or unlocks a major feature.

## P1 — Core (must-have)

### Authentication
- [x] Signup
- [x] Login / logout
- [x] Session management
- [ ] Password recovery (forgot password flow)
  - [ ] Decide whether to reuse the legacy token/reset table flow or add a small compatible migration.
  - [ ] Add request-reset route and form linked from `src/routes/login.tsx`.
  - [ ] Add reset-password route that validates token, updates `users.passhash`, and invalidates old sessions.
  - [ ] Add mail delivery plumbing or a development-only reset-link fallback.
  - [ ] Cover happy path, expired token, invalid token, and reused token cases with tests.

### Posts
- [x] Create post (link + text, NSFW toggle)
- [x] View post with metadata (score, views, author, time)
- [x] Voting (upvote/downvote/toggle)
- [x] Sorting (hot, new, top, controversial, comments)
- [x] Time filters (hour, day, week, month, year, all)
- [ ] Edit post
  - [ ] Add ownership/mod authorization checks.
  - [ ] Build edit route and form prefilled from existing submission data.
  - [ ] Update `edited_utc`, preserve legacy field behavior, and re-render derived HTML fields.
  - [ ] Add tests for link posts, text posts, and unauthorized edits.
- [ ] Delete post
  - [ ] Match legacy semantics: delete vs remove vs ghost/state changes.
  - [ ] Update counters and visibility queries so deleted content behaves like `rDrama`.
  - [ ] Add tests for author delete, moderator remove, and deleted-post display.
- [ ] Markdown parsing + HTML sanitization for post body/title
  - [ ] Replace the `TODO` placeholders in `src/lib/submissions.server.ts`.
  - [ ] Reuse the existing markdown pipeline where possible so posts and comments render consistently.
  - [ ] Sanitize stored `titleHtml`/`bodyHtml` to match legacy expectations and XSS constraints.
  - [ ] Add regression tests for markdown, mentions, spoilers, and unsafe HTML.

### Comments
- [x] Create comment (nested replies)
- [x] Edit comment
- [x] Delete comment
- [x] Comment voting
- [x] Comment thread view with ancestor context
- [x] Comment feed (all comments, paginated, sorted)

### User Profiles
- [x] Profile page (bio, post/comment feeds, stats)
- [x] Sorting + pagination on profile feeds
- [ ] Edit profile / user settings page
  - [ ] Replace the disabled button in `src/routes/me.tsx` with a real settings route.
  - [ ] Support legacy profile fields first: bio, custom title, profile/banner URLs, display preferences.
  - [ ] Re-render stored profile HTML safely and validate length/format constraints against the DB schema.
  - [ ] Add tests for authorized updates and rejected invalid values.

## P2 — Important

- [ ] Post and comment reporting (flag system — DB ready)
  - [ ] Add report actions for submissions/comments and write to `flags` / `commentflags`.
  - [ ] Prevent duplicate reports from the same user if legacy behavior expects that.
  - [ ] Expose report state in moderator-facing queries later.
- [ ] Notifications (comment replies — DB ready)
  - [ ] Create notification records on reply/mention events.
  - [ ] Add unread count and basic notifications UI before deeper preference controls.
- [ ] User following / followers (DB ready)
  - [ ] Add follow/unfollow actions and buttons on profile pages.
  - [ ] Recalculate or maintain follower/following counters in a legacy-compatible way.
- [ ] Search (posts and users)
  - [ ] Start with server-side keyword search over titles, bodies, and usernames.
  - [ ] Match legacy visibility rules so banned/removed/private content does not leak.
- [ ] User blocking (DB ready)
  - [ ] Add block/unblock actions backed by `userblocks`.
  - [ ] Filter blocked users from feeds, threads, notifications, and profile interactions.
  - [ ] Moderation panel (flags, mod actions, bans — DB ready)
  - [ ] Add moderator-only routes, layout, and authorization guards based on legacy admin levels.
  - [ ] Build queues for reported posts and comments from `flags` and `commentflags`.
  - [ ] Support core actions first: remove, unremove, ignore report, resolve report, sticky, pin, and lock-equivalent behavior if needed.
  - [ ] Add ban and unban flows with reason capture, expiry support, and audit logging to `modactions`.
  - [ ] Expose user moderation context: prior notes, recent posts/comments, report history, and linked alt/account signals where safe.
  - [ ] Record every moderation action in a way that matches or cleanly migrates legacy `modactions` behavior.
  - [ ] Add tests for permission boundaries, action logging, and queue state transitions.
- [ ] Admin panel
  - [ ] Define the split between moderator tools and true admin tools before building UI.
  - [ ] Add admin-only routes with stricter guards than the moderation panel.
  - [ ] Start with operational controls that already map to the schema: user role changes, site configuration toggles that live in DB, and maintenance tooling.
  - [ ] Add CRUD screens for DB-backed resources already present in the legacy app such as badges, marseys, banned domains, and OAuth apps.
  - [ ] Add safe background-task management views for repeatable tasks and task runs if those systems are kept in the rewrite.
  - [ ] Add search/filtering and audit visibility so admin changes are attributable and reversible where possible.
  - [ ] Add tests for admin-only access, destructive-action confirmation, and persistence of configuration changes.

## P3 — Someday

- [ ] Awards on posts and comments (DB ready)
- [ ] User badges (DB ready)

## P4 - Probably skip

- [ ] Chat / messaging (DB ready)
- [ ] OAuth apps (DB ready)

