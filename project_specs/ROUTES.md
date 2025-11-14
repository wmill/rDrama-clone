# rDrama Application Routes Documentation

This document provides a comprehensive listing of all HTTP routes and endpoints available in the rDrama application. Routes are organized by their source file within the `files/routes/` directory.

**Total Routes: 265+**

## Core Application Routes

### Authentication & User Management (`login.py`)
- `GET /login` - Login page
- `POST /login` - Process login
- `GET /me` - Current user info  
- `GET /@me` - Current user info (alternate URL)
- `GET /logout` - Logout
- `GET /signup` - Signup page
- `POST /signup` - Process signup
- `GET /forgot` - Forgot password page
- `POST /forgot` - Process forgot password
- `GET /reset` - Password reset page
- `POST /reset` - Process password reset
- `GET /lost_2fa` - Lost 2FA page
- `POST /request_2fa_disable` - Request 2FA disable
- `GET /reset_2fa` - Reset 2FA

### Homepage & Navigation (`front.py`)
- `GET /` - Homepage
- `GET /catalog` - Homepage catalog view
- `POST /clear` - Clear notifications
- `GET /unread` - Get unread notifications
- `GET /notifications` - Main notifications page
- `GET /notifications/posts` - Post notifications
- `GET /notifications/modmail` - Modmail notifications
- `GET /notifications/messages` - Message notifications
- `GET /changelog` - Site changelog
- `GET /random_post` - Random post redirect
- `GET /random_user` - Random user redirect
- `GET /comments` - All comments feed

### Posts & Content (`posts.py`)
- `GET /submit` - Submit post page
- `POST /submit` - Submit new post
- `GET /post/<pid>` - View specific post
- `GET /post/<pid>/<anything>` - View post with SEO URL
- `POST /edit_post/<pid>` - Edit post
- `POST /delete_post/<pid>` - Delete post
- `POST /undelete_post/<pid>` - Undelete post
- `POST /publish/<pid>` - Publish draft post
- `GET /viewmore/<pid>/<sort>/<offset>` - Load more comments
- `GET /morecomments/<cid>` - Load more nested comments
- `POST /is_repost` - Check if URL is repost
- `POST /toggle_post_nsfw/<pid>` - Toggle post NSFW
- `POST /save_post/<pid>` - Save post
- `POST /unsave_post/<pid>` - Unsave post
- `POST /pin/<post_id>` - Pin post to profile
- `GET /submit/title` - Get title from URL

### Comments (`comments.py`)
- `GET /comment/<cid>` - View specific comment
- `GET /post/<pid>/<anything>/<cid>` - View comment in post context
- `POST /comment` - Create new comment
- `POST /edit_comment/<cid>` - Edit existing comment
- `POST /delete/comment/<cid>` - Delete comment
- `POST /undelete/comment/<cid>` - Undelete comment
- `POST /pin_comment/<cid>` - Pin comment
- `POST /unpin_comment/<cid>` - Unpin comment
- `POST /save_comment/<cid>` - Save comment
- `POST /unsave_comment/<cid>` - Unsave comment
- `POST /toggle_comment_nsfw/<cid>` - Toggle comment NSFW

### User Profiles & Social (`users.py`)

#### Admin Voting Analysis (Admin Level 3+)
- `GET /@<username>/upvoters/<uid>/posts` - Show posts user upvoted from target user
- `GET /@<username>/upvoters/<uid>/comments` - Show comments user upvoted from target user
- `GET /@<username>/downvoters/<uid>/posts` - Show posts user downvoted from target user
- `GET /@<username>/downvoters/<uid>/comments` - Show comments user downvoted from target user
- `GET /@<username>/upvoting/<uid>/posts` - Show posts target user upvoted from another user
- `GET /@<username>/upvoting/<uid>/comments` - Show comments target user upvoted from another user
- `GET /@<username>/downvoting/<uid>/posts` - Show posts target user downvoted from another user
- `GET /@<username>/downvoting/<uid>/comments` - Show comments target user downvoted from another user
- `GET /@<username>/upvoters` - List users who most frequently upvote target user
- `GET /@<username>/downvoters` - List users who most frequently downvote target user
- `GET /@<username>/upvoting` - List users target user most frequently upvotes
- `GET /@<username>/downvoting` - List users target user most frequently downvotes

#### Profile Management
- `GET /@<username>/posts` - Main user profile page showing posts
- `GET /@<username>/` - User profile page showing comments
- `GET /@<username>/info` - Return user info as JSON
- `GET /<id>/info` - Return user info by ID as JSON
- `GET /id/<int:id>` - Redirect from user ID to username URL
- `GET /u/<username>` - Redirect Reddit-style /u/ URLs to /@username format
- `GET /@<username>/profilecss` - Return user's custom CSS for profile
- `GET /is_available/<name>` - Check if username is available

#### Social Features
- `GET /@<username>/followers` - Show list of users following target user
- `GET /@<username>/following` - Show list of users target user is following
- `POST /follow/<username>` - Follow a user
- `POST /unfollow/<username>` - Unfollow a user
- `POST /remove_follow/<username>` - Remove a follower
- `GET /views` - Show who has viewed current user's profile (patron feature)

#### Messaging System
- `GET /report_bugs` - Redirect to bug report thread
- `POST /@<username>/message` - Send direct message to user
- `POST /reply` - Reply to message thread

#### Profile Pictures & Assets
- `GET /pp/<int:id>` - Serve profile picture by user ID
- `GET /uid/<int:id>/pic` - Serve profile picture by user ID (alternate)
- `GET /uid/<int:id>/pic/profile` - Serve profile picture by user ID (alternate)
- `GET /@<username>/pic` - Serve profile picture by username

#### Content Management
- `GET /@<username>/saved/posts` - Show user's saved posts
- `GET /@<username>/saved/comments` - Show user's saved comments
- `POST /subscribe/<post_id>` - Subscribe to notifications for specific post
- `POST /unsubscribe/<post_id>` - Unsubscribe from notifications for specific post

#### System Features
- `GET /leaderboard` - Show user leaderboards (coins, followers, posts) - Admin Level 2+
- `GET /2faqr/<secret>` - Generate QR code for 2FA setup
- `POST /fp/<fp>` - Record user fingerprint for alt detection

#### Currency Transfer (Currently Disabled)
- `POST /@<username>/transfer_coins` - Transfer coins between users (returns 404)
- `POST /@<username>/transfer_bux` - Transfer marseybux between users (returns 404)

### Voting System (`votes.py`)
- `GET /votes` - Admin vote information
- `POST /vote/post/<post_id>/<new>` - Vote on post
- `POST /vote/comment/<comment_id>/<new>` - Vote on comment

## Search & Discovery

### Search (`search.py`)
- `GET /search/posts` - Search posts
- `GET /search/comments` - Search comments  
- `GET /search/users` - Search users

### RSS Feeds (`feeds.py`)
- `GET /rss` - RSS feed
- `GET /feed` - RSS feed (alternate URL)
- `GET /rss/<sort>/<t>` - RSS feed with sorting/time parameters

## Moderation & Reporting

### Reporting (`reporting.py`)
- `POST /report/post/<pid>` - Report post
- `POST /report/comment/<cid>` - Report comment

### Volunteer System (`volunteer.py`)
- `GET /volunteer` - Volunteer dashboard
- `POST /volunteer/submit` - Submit volunteer work

## Features & Customization

### Awards System (`awards.py`)
- `GET /shop` - Display award shop
- `GET /settings/shop` - Display award shop in settings
- `POST /buy/<award>` - Purchase an award
- `POST /award_post/<pid>` - Award a post
- `POST /award_comment/<cid>` - Award a comment
- `GET /admin/awards` - Admin awards management
- `POST /admin/awards` - Admin award giving

### User Settings (`settings.py`)
- `GET /settings` - Settings redirect
- `GET /settings/profile` - Profile settings page
- `POST /settings/profile` - Update profile settings
- `POST /settings/filters` - Update content filters
- `POST /changelogsub` - Subscribe/unsubscribe to changelog
- `POST /settings/namecolor` - Set name color
- `POST /settings/themecolor` - Set theme color
- `POST /settings/titlecolor` - Set title color
- `POST /settings/verifiedcolor` - Set verified color
- `GET /settings/security` - Security settings page
- `POST /settings/security` - Update security settings
- `POST /settings/log_out_all_others` - Log out all other sessions
- `POST /settings/images/profile` - Upload profile image
- `POST /settings/images/banner` - Upload banner image
- `GET /settings/blocks` - View blocked users
- `GET /settings/css` - CSS settings page
- `POST /settings/css` - Update custom CSS
- `GET /settings/profilecss` - Profile CSS page
- `POST /settings/profilecss` - Update profile CSS
- `POST /settings/block` - Block user
- `POST /settings/unblock` - Unblock user
- `GET /settings/apps` - OAuth apps settings
- `GET /settings/content` - Content settings
- `POST /settings/name_change` - Change username
- `POST /settings/title_change` - Change custom title
- `POST /id/<int:id>/private/<int:enabled>` - Set profile privacy

### Chat System (`chat.py`)
- `GET /chat` - Chat interface
- **SocketIO Events:**
  - `speak` - Send chat message
  - `connect` - Handle user connection
  - `disconnect` - Handle user disconnection
  - `typing` - Handle typing indicators
  - `read` - Mark messages as read
  - `delete` - Delete chat message (admin only)

## OAuth & API Integration

### OAuth (`oauth.py`)
- `GET /authorize` - OAuth authorization prompt
- `POST /authorize` - Process OAuth authorization
- `POST /api_keys` - Request API keys
- `POST /delete_app/<aid>` - Delete OAuth app
- `POST /edit_app/<aid>` - Edit OAuth app
- `POST /admin/app/approve/<aid>` - Admin approve app
- `POST /admin/app/revoke/<aid>` - Admin revoke app
- `POST /admin/app/reject/<aid>` - Admin reject app
- `GET /admin/app/<aid>` - Admin view app
- `GET /admin/app/<aid>/comments` - Admin view app comments
- `GET /admin/apps` - Admin list apps
- `POST /oauth/reroll/<aid>` - Reroll OAuth tokens

## Static Content & Information

### Static Pages (`static.py`)
- `GET /logged_out/` - Handle logged out redirects
- `GET /logged_out/<path:old>` - Handle logged out redirects with path
- `GET /sidebar` - Sidebar content
- `GET /rules` - Site rules
- `GET /support` - Support page
- `GET /stats` - Site statistics
- `GET /chart` - Chart redirect
- `GET /weekly_chart` - Weekly chart
- `GET /daily_chart` - Daily chart
- `GET /patrons` - Patrons page
- `GET /admins` - Admins page
- `GET /log` - Moderation log
- `GET /modlog` - Moderation log (alternate URL)
- `GET /log/<id>` - Specific log entry
- `GET /api` - API documentation
- `GET /contact` - Contact page
- `GET /press` - Press contact page
- `GET /media` - Media contact page
- `POST /send_admin` - Submit contact form
- `GET /badges` - Badges page
- `GET /blocks` - Blocks page
- `GET /banned` - Banned users page
- `GET /formatting` - Formatting help
- `POST /dismiss_mobile_tip` - Dismiss mobile tip

### Asset Serving (`static.py`)
- `GET /e/<emoji>` - Serve emoji images
- `GET /assets/<path:path>` - Serve static assets
- `GET /static/assets/<path:path>` - Serve static assets (alternate)
- `GET /images/<path>` - Serve images
- `GET /hostedimages/<path>` - Serve hosted images
- `GET /static/images/<path>` - Serve static images
- `GET /robots.txt` - Robots.txt file
- `GET /service-worker.js` - Service worker

## Error Handling

### Error Pages (`errors.py`)
- **Error Handlers for HTTP Codes:** 400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500
- `POST /allow_nsfw` - Allow NSFW content viewing

## Development & Debug

### Development Routes (`dev.py`)
- `POST /dev/sessions/` - Debug login to other accounts

## Administrative Interface

### Core Admin (`admin/admin.py`)

#### Site Administration (Level 3)
- `GET /admin` - Main admin dashboard with site settings and attack status
- `POST /admin/site_settings/<setting>` - Update site configuration settings
- `POST /admin/purge_cache` - Clear cache and purge Cloudflare cache
- `POST /admin/under_attack` - Toggle Cloudflare "Under Attack" mode
- `POST /admin/dump_cache` - Clear internal cache only

#### Domain Management (Level 3)
- `GET /admin/banned_domains/` - List banned domains
- `POST /admin/banned_domains` - Ban or unban a domain

#### User Management - Admin Status (Level 3)
- `POST /@<username>/make_admin` - Promote user to admin level 2
- `POST /@<username>/remove_admin` - Remove admin privileges from user
- `POST /@<username>/revert_actions` - Revert all moderation actions by user (last 24h)

#### User Management - Verification (Level 3)
- `POST /admin/verify/<user_id>` - Verify a user account
- `POST /admin/unverify/<user_id>` - Remove verification from user account

#### User Management - Nuclear Options (Level 3)
- `POST /admin/nuke_user` - Remove all posts and comments from a user
- `POST /admin/unnuke_user` - Restore all posts and comments for a user

#### User Management - Banning & Shadowbanning (Level 2)
- `GET /admin/shadowbanned` - List all shadowbanned users
- `POST /shadowban/<user_id>` - Shadowban a user
- `POST /unshadowban/<user_id>` - Remove shadowban from a user
- `POST /ban_user/<user_id>` - Ban a user with optional reason and duration
- `POST /unban_user/<user_id>` - Unban a user

#### User Management - Notes & Documentation (Level 2)
- `POST /@<username>/delete_note/<id>` - Delete a specific user note
- `POST /@<username>/create_note` - Create new note for user with post/comment references

#### User Management - Filtering Behavior (Level 2)
- `POST /filter_automatic/<user_id>` - Set user to automatic filtering behavior
- `POST /filter_unfiltered/<user_id>` - Set user to unfiltered behavior
- `POST /filter_filtered/<user_id>` - Set user to always filtered behavior

#### User Management - Titles & Flair (Level 2)
- `POST /admin/title_change/<user_id>` - Change user's custom title/flair

#### User Management - Lists & Analytics (Level 2)
- `GET /admin/users` - List recent users (non-banned)
- `GET /admin/loggedin` - Show currently logged-in users
- `GET /admin/loggedout` - Show recently logged-out users
- `GET /admin/alt_votes` - Analyze voting patterns between users to detect alts
- `POST /admin/link_accounts` - Manually link two accounts as alts

#### Badge Management (Level 2)
- `GET /admin/badge_grant` - Show badge granting form
- `POST /admin/badge_grant` - Grant a badge to a user
- `GET /admin/badge_remove` - Show badge removal form
- `POST /admin/badge_remove` - Remove a badge from a user

#### Content Moderation - Filtered Content (Level 2)
- `GET /admin/filtered/posts` - List posts that are currently filtered
- `GET /admin/filtered/comments` - List comments that are currently filtered
- `POST /admin/update_filter_status` - Update filter status (normal/removed/ignored)

#### Content Moderation - Reported Content (Level 2)
- `GET /admin/reported/posts` - List reported posts awaiting review
- `GET /admin/reported/comments` - List reported comments awaiting review

#### Content Moderation - Removed Content (Level 2)
- `GET /admin/removed/posts` - List removed posts
- `GET /admin/removed/comments` - List removed comments

#### Content Moderation - Special Views (Level 2)
- `GET /admin/image_posts` - List posts containing images

#### Content Management - Post/Comment Actions
- `POST /distinguish/<post_id>` - Distinguish or undistinguish a post (Level 1)
- `POST /sticky/<post_id>` - Pin a post to the top (Level 2)
- `POST /unsticky/<post_id>` - Unpin a post (Level 2)
- `POST /sticky_comment/<cid>` - Pin a comment (Level 2)
- `POST /unsticky_comment/<cid>` - Unpin a comment (Level 2)
- `POST /distinguish_comment/<c_id>` - Distinguish or undistinguish a comment (Level 1)

**Admin Level Requirements:**
- **Level 1:** Basic admin functions (distinguish own content)
- **Level 2:** Standard moderation functions (most routes)
- **Level 3:** High-level admin functions (make/remove admins, site settings, domain management)

### Performance Management (`admin/performance.py`)
- `GET /performance/` - Performance statistics
- `POST /performance/workers/reload` - Reload workers
- `POST /performance/workers/<int:pid>/terminate` - Terminate worker
- `POST /performance/workers/<int:pid>/kill` - Kill worker
- `POST /performance/workers/+1` - Scale up workers
- `POST /performance/workers/-1` - Scale down workers

### Task Management (`admin/tasks.py`)
- `GET /tasks/` - Task management dashboard
- `GET /tasks/<int:task_id>/` - View specific task
- `GET /tasks/<int:task_id>/runs/` - Task runs redirect
- `GET /tasks/<int:task_id>/runs/<int:run_id>` - View task run
- `POST /tasks/<int:task_id>/schedule` - Update task schedule
- `GET /tasks/scheduled_posts/` - Scheduled posts management
- `POST /tasks/scheduled_posts/` - Create scheduled post
- `GET /tasks/scheduled_posts/<int:pid>` - View scheduled post
- `POST /tasks/scheduled_posts/<int:pid>/content` - Update scheduled post content
- `POST /tasks/scheduled_posts/<int:task_id>/schedule` - Update scheduled post schedule

## Route Organization Notes

### Middleware & Global Handlers (`allroutes.py`)
Contains no routes but provides global middleware functions:
- `before_request()` - Pre-request processing
- `teardown_request()` - Request cleanup
- `after_request()` - Post-request processing

### Base Classes (`volunteer_common.py`, `volunteer_janitor.py`)
These files contain helper functions and abstract base classes but no direct routes.

---

*This documentation covers all route definitions found in the rDrama application as of the latest analysis. Routes are organized by functionality and source file for easier navigation and maintenance.*