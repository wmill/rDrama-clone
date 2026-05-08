# rDreamer TODO

Guiding rule: preserve `rDrama` database compatibility unless a migration clearly simplifies the code or unlocks a major feature.

## Re-baselined status

These core features already exist and should no longer be tracked as missing:

- [x] Signup, login, logout, and session management
- [x] Password reset request + reset-token flow
- [x] Post creation, editing, deletion, voting, sorting, and post pages
- [x] Nested comments, comment editing/deletion, voting, and comment feeds
- [x] Profile pages plus user settings that write legacy-compatible fields
- [x] Reporting for posts and comments
- [x] Basic moderator/admin surface for reported posts, reported comments, and user actions

## P1 — Production-core replacement gaps

These are the main blockers to replacing `rDrama` for normal site use.

### Post lifecycle parity

- [x] Match legacy post state transitions instead of treating edit/delete as author-only CRUD.
- [x] Add moderator remove/unremove flows for submissions and comments.
- [x] Add sticky/pin behavior and remaining distinguish/staff-state parity.
- [x] Add save/unsave behavior and saved-content surfaces.
- [x] Tighten deleted/removed visibility and counters so content matches `rDrama` semantics instead of disappearing outright.
- [ ] Add tests for author delete, moderator remove/unremove, deleted-post visibility, and permission boundaries.

### Notifications

- [ ] Create notifications for replies, mentions, and subscriptions.
- [ ] Add unread count in shared navigation/header UI.
- [ ] Add a notifications listing route.
- [ ] Add mark-read / clear actions.
- [ ] Add server tests for notification creation and unread-count behavior.

### Search

- [ ] Add public search routes for posts, comments, and users.
- [ ] Implement legacy-aware visibility filtering so removed/private/shadowbanned content does not leak.
- [ ] Add tests for search visibility boundaries.

### Social actions

- [ ] Add follow/unfollow actions and follower/following pages.
- [ ] Add block/unblock actions backed by `userblocks`.
- [ ] Apply block filtering consistently across feeds, threads, profiles, and notifications.
- [ ] Add tests covering follow/block effects on visibility and counts.

### Account security parity

- [ ] Add log-out-other-sessions / session management controls.
- [ ] Add 2FA and remaining security settings parity if still required for replacement.
- [ ] Add banned-user login and password-reset/session-invalidation coverage.

## P2 — Moderation/admin expansion

Current admin/moderation support exists, but it is still a narrow subset of `rDrama`.

### Moderation actions

- [ ] Expand beyond reported-content triage to include unremove flows, filter-state transitions, sticky/unsticky, title/flair/verification actions, and richer audit logging parity.
- [ ] Add moderation actions for comments where legacy behavior supports the same lifecycle controls.

### Moderation views

- [ ] Add filtered/removed/shadowbanned queues.
- [ ] Add mod log visibility.
- [ ] Add richer user investigation context: notes, recent activity, report history, and related-account signals where appropriate.

### Admin tools

- [ ] Add banned-domain management.
- [ ] Add badges/awards management.
- [ ] Add site settings / config toggles that still belong in the rewrite.
- [ ] Add OAuth app review and operational/task views only if those systems remain in scope.

## P3 — Lower-priority parity gaps

- [ ] Notifications subpages and subscriptions
- [ ] Static/community pages: rules, support, API, badges, banned, formatting, admins, patrons, contact, sidebar, mod log, charts/stats
- [ ] RSS/feed endpoints
- [ ] Volunteer flows
- [ ] OAuth app flows
- [ ] Awards/badges UI and actions
- [ ] Messaging/chat
- [ ] Misc profile utilities: saved pages, vote-analysis pages, views page, profile CSS/image endpoints, availability checks

## Test plan

Current baseline: `pnpm test --run` passes with 14 test files and 58 tests, but coverage is still concentrated in utilities and component behavior.

Priority additions:

- [ ] Auth/account integration coverage: signup, login, logout, password-reset request/consume, banned-user login behavior, session invalidation after reset
- [ ] Post lifecycle coverage: edit/delete/remove/unremove, sticky/distinguish permissions, save/unsave
- [ ] Comment lifecycle coverage: create/edit/delete/remove/unremove, blocked/shadowbanned visibility cases
- [ ] Notifications/search/social coverage: reply notifications, unread count, search filtering, follow/unfollow/block behavior
- [ ] Admin/mod coverage: permission boundaries, queue transitions, mod action logging, audit correctness
