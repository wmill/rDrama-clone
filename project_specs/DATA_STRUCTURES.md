# rDrama Database Schema & Data Structures

This document provides a comprehensive overview of the data structures used in the rDrama application, based on the PostgreSQL database schema.

## Overview

rDrama uses PostgreSQL as its primary database with custom enum types for data consistency and extensive foreign key relationships to maintain referential integrity. The schema supports a Reddit-like discussion forum with real-time chat, comprehensive moderation tools, and social features.

## Custom PostgreSQL Types

The application defines several custom enum types to ensure data consistency:

### Enum Types
- **`filterbehavior`**: `'AUTOMATIC'`, `'UNFILTERED'`, `'FILTERED'`
  - Controls how content filtering is applied to users
- **`statemod`**: `'VISIBLE'`, `'FILTERED'`, `'REMOVED'`
  - Tracks moderation state for posts and comments
- **`statereport`**: `'UNREPORTED'`, `'RESOLVED'`, `'REPORTED'`, `'IGNORED'`
  - Manages report status workflow
- **`usertag`**: `'Quality'`, `'Good'`, `'Comment'`, `'Warning'`, `'Tempban'`, `'Permban'`, `'Spam'`, `'Bot'`
  - Categorizes administrative notes about users
- **`volunteerjanitorresult`**: `'Pending'`, `'TopQuality'`, `'Good'`, `'Neutral'`, `'Bad'`, `'Warning'`, `'Ban'`
  - Results from community-driven moderation

## Core Data Entities

### Users (`users`)
Central entity representing all user accounts and their properties.

**Identity & Authentication**
```sql
id                    INTEGER PRIMARY KEY
username              VARCHAR(255) UNIQUE NOT NULL
email                 VARCHAR(255)
passhash              VARCHAR(255)
created_utc           INTEGER NOT NULL
mfa_secret            VARCHAR(255)
```

**Authorization & Privileges**
```sql
admin_level           INTEGER DEFAULT 0     -- 0=user, 1-3=admin levels
is_banned             INTEGER DEFAULT 0     -- Ban status
ban_reason            VARCHAR(500)
unban_utc             INTEGER               -- Ban expiration
filter_behavior       filterbehavior DEFAULT 'AUTOMATIC'
```

**Profile & Customization**
```sql
bio                   VARCHAR(1500)         -- User biography
bio_html              VARCHAR(10000)        -- HTML-rendered bio
customtitle           VARCHAR(1000)         -- Custom user title
customtitleplain      VARCHAR(1000)         -- Plain-text version for search
profileurl            VARCHAR(500)          -- Profile image URL
bannerurl             VARCHAR(500)          -- Profile banner URL
namecolor             VARCHAR(6)            -- Username color (hex)
titlecolor            VARCHAR(6)            -- Title color (hex)
themecolor            VARCHAR(6)            -- Theme color (hex)
css                   VARCHAR(4000)         -- Custom site CSS
profilecss            VARCHAR(4000)         -- Custom profile CSS
theme                 VARCHAR(30)           -- UI theme preference
cardview              BOOLEAN DEFAULT TRUE  -- Feed layout
frontsize             INTEGER DEFAULT 25    -- Sidebar width
```

**Social & Engagement**
```sql
coins                INTEGER DEFAULT 0     -- Virtual currency
procoins             INTEGER DEFAULT 0     -- Premium currency
post_count           INTEGER DEFAULT 0     -- Number of posts made
comment_count        INTEGER DEFAULT 0     -- Number of comments made
stored_subscriber_count INTEGER DEFAULT 0  -- Cached follower count
custom_filter_list   VARCHAR(500)          -- Serialized user filters
friends              VARCHAR(500)          -- Friend usernames
friends_html         VARCHAR(5000)         -- Rendered friend links
enemies              VARCHAR(500)          -- Enemy usernames
enemies_html         VARCHAR(5000)         -- Rendered enemy links
is_private           BOOLEAN DEFAULT FALSE -- Private profile flag
```

**Account Preferences & Toggles**
```sql
highlightcomments    BOOLEAN DEFAULT TRUE  -- Highlight owned comments
hidevotedon          BOOLEAN DEFAULT FALSE -- Hide vote directions
defaultsorting       VARCHAR(20) DEFAULT 'new'
defaultsortingcomments VARCHAR(20) DEFAULT 'new'
defaulttime          VARCHAR(20) DEFAULT 'DAY'
newtab               BOOLEAN DEFAULT FALSE -- Open posts internally
newtabexternal       BOOLEAN DEFAULT TRUE  -- Open external links in new tab
slurreplacer         BOOLEAN DEFAULT TRUE  -- Enable site-wide word filter
controversial        BOOLEAN DEFAULT FALSE -- Show controversial feed
agendaposter         INTEGER DEFAULT 0     -- Special flair flag
changelogsub         BOOLEAN DEFAULT FALSE -- Subscribe to changelog posts
reddit               VARCHAR(50) DEFAULT 'old.reddit.com'
nitter               BOOLEAN               -- Use Nitter mirrors
```

**Chat Integration**
```sql
chat_authorized      BOOLEAN DEFAULT FALSE -- Can access chat
chat_lastseen        TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01'::timestamptz
```

**Security, Reputation & Status**
```sql
is_activated         BOOLEAN DEFAULT FALSE -- Email verified
shadowbanned         VARCHAR(255)          -- Shadowban marker
ban_evade            INTEGER DEFAULT 0     -- Flag for ban evasion
reserved             VARCHAR(255)          -- Reserved metadata
volunteer_janitor_correctness FLOAT DEFAULT 0 -- Accuracy rating
volunteer_last_started_utc  TIMESTAMP      -- Last volunteer session start
referred_by          INTEGER REFERENCES users(id)
patron               INTEGER DEFAULT 0     -- Patron tier
patron_utc           INTEGER DEFAULT 0     -- Patron since timestamp
winnings             INTEGER DEFAULT 0     -- Contest prize total
verified             VARCHAR(255)          -- Verified text
verifiedcolor        VARCHAR(6)            -- Verified badge color
house                VARCHAR(50)           -- Community house allegiance
original_username    VARCHAR(255)          -- Legacy username
highres              VARCHAR(255)          -- CDN path for high-res avatar
fp                   VARCHAR(21)           -- Fingerprint token for anti-alt ops
```

**Counters & Derived Stats**
```sql
received_award_count INTEGER DEFAULT 0
coins_spent          INTEGER DEFAULT 0
lootboxes_bought     INTEGER DEFAULT 0
truescore            INTEGER DEFAULT 0
login_nonce          INTEGER DEFAULT 0
is_nofollow          BOOLEAN DEFAULT FALSE
stored_subscriber_count INTEGER DEFAULT 0
volunteer_janitor_badness FLOAT DEFAULT 0 -- legacy metric
```

### Submissions (`submissions`)
Posts/submissions made by users.

**Core Content**
```sql
id                   INTEGER PRIMARY KEY
author_id            INTEGER REFERENCES users(id) NOT NULL
created_utc          INTEGER NOT NULL
title                VARCHAR(500) NOT NULL
title_html           VARCHAR(1500) NOT NULL
url                  VARCHAR(2083)         -- External link
body                 VARCHAR(20000)        -- Post content
body_html            VARCHAR(200000)       -- HTML-rendered content
```

**Metadata & Relationships**
```sql
edited_utc           INTEGER DEFAULT 0
app_id               INTEGER REFERENCES oauth_apps(id)
task_id              INTEGER REFERENCES tasks_repeatable_scheduled_submissions(id)
bump_utc             INTEGER                -- Cached for front-page bumps
thumburl             VARCHAR(500)           -- Preview image
ghost                BOOLEAN DEFAULT FALSE  -- Anonymous author flag
is_bot               BOOLEAN DEFAULT FALSE  -- Bot-authored post
```

**Engagement Metrics**
```sql
upvotes              INTEGER DEFAULT 1     -- Vote counts
downvotes            INTEGER DEFAULT 0
realupvotes          INTEGER DEFAULT 1     -- Actual vs cached votes
comment_count        INTEGER DEFAULT 0
views                INTEGER DEFAULT 0
```

**Moderation & State Management**
```sql
state_mod            statemod DEFAULT 'VISIBLE'
state_mod_set_by     VARCHAR(64)           -- Who set moderation state
state_report         statereport DEFAULT 'UNREPORTED'
state_user_deleted_utc INTEGER             -- Self-deletion timestamp
distinguish_level    INTEGER DEFAULT 0     -- Admin/mod distinction
is_pinned            BOOLEAN DEFAULT FALSE -- Pinned to profile
stickied             BOOLEAN DEFAULT FALSE -- Stickied to top
stickied_utc         INTEGER               -- When stickied
```

**Content Features**
```sql
over_18              BOOLEAN DEFAULT FALSE -- NSFW flag
flair                VARCHAR(350)          -- Post flair
embed_url            VARCHAR(1500)         -- Embedded media
ghost                BOOLEAN DEFAULT FALSE -- Anonymous post
private              BOOLEAN DEFAULT FALSE -- Private post
bannedfor            BOOLEAN               -- Removed for rule violation
```

### Comments (`comments`)
Threaded comments on submissions with sophisticated threading support.

**Core Content & Threading**
```sql
id                   INTEGER PRIMARY KEY
author_id            INTEGER REFERENCES users(id) NOT NULL
created_utc          INTEGER NOT NULL
body                 VARCHAR(10000)
body_html            VARCHAR(100000)
parent_submission    INTEGER REFERENCES submissions(id) NOT NULL
parent_comment_id    INTEGER REFERENCES comments(id)    -- For threading
top_comment_id       INTEGER REFERENCES comments(id)    -- Top-level comment
level                INTEGER DEFAULT 1     -- Nesting depth
descendant_count     INTEGER DEFAULT 0     -- Child comment count
```

**Metadata & Relationships**
```sql
edited_utc           INTEGER DEFAULT 0
ghost                BOOLEAN DEFAULT FALSE -- Anonymous author flag
bannedfor            BOOLEAN               -- Removed for rule violation
sentto               INTEGER REFERENCES users(id) -- Direct message target
app_id               INTEGER REFERENCES oauth_apps(id)
is_bot               BOOLEAN DEFAULT FALSE
```

**Engagement & Quality**
```sql
upvotes              INTEGER DEFAULT 1
downvotes            INTEGER DEFAULT 0
realupvotes          INTEGER DEFAULT 1
volunteer_janitor_badness REAL DEFAULT 0   -- Community quality score
```

**Moderation (Same pattern as submissions)**
```sql
state_mod            statemod DEFAULT 'VISIBLE'
state_mod_set_by     VARCHAR(64)
state_report         statereport DEFAULT 'UNREPORTED'
state_user_deleted_utc INTEGER
distinguish_level    INTEGER DEFAULT 0
is_pinned            BOOLEAN DEFAULT FALSE
is_pinned_utc        INTEGER
over_18              BOOLEAN DEFAULT FALSE -- NSFW comment flag
```

**Special Features**
```sql
top_comment_id       INTEGER               -- Top of thread reference
sentto               INTEGER               -- Direct message recipient
```

## Social Features

### Following System
```sql
-- follows: User following relationships
user_id              INTEGER REFERENCES users(id)     -- Follower
target_id            INTEGER REFERENCES users(id)     -- Followed user
created_utc          INTEGER NOT NULL
```

### Voting System
```sql
-- votes: Post voting
user_id              INTEGER REFERENCES users(id)
submission_id        INTEGER REFERENCES submissions(id)
vote_type            INTEGER NOT NULL     -- Vote direction/type
real                 BOOLEAN DEFAULT TRUE -- Whether vote counts
created_utc          INTEGER NOT NULL

-- commentvotes: Comment voting (similar structure)
user_id              INTEGER REFERENCES users(id)
comment_id           INTEGER REFERENCES comments(id)
vote_type            INTEGER NOT NULL
real                 BOOLEAN DEFAULT TRUE
created_utc          INTEGER NOT NULL
```

### User Blocking
```sql
-- userblocks: User blocking relationships
user_id              INTEGER REFERENCES users(id)     -- Blocker
target_id            INTEGER REFERENCES users(id)     -- Blocked user
created_utc          INTEGER NOT NULL
```

### Content Saving
```sql
-- save_relationship: Saved posts
user_id              INTEGER REFERENCES users(id)
submission_id        INTEGER REFERENCES submissions(id)
created_utc          INTEGER NOT NULL

-- comment_save_relationship: Saved comments
user_id              INTEGER REFERENCES users(id)
comment_id           INTEGER REFERENCES comments(id)
created_utc          INTEGER NOT NULL
```

### Thread Subscriptions
```sql
-- subscriptions: Notification subscriptions
user_id              INTEGER REFERENCES users(id)
submission_id        INTEGER REFERENCES submissions(id)
created_utc          INTEGER NOT NULL
```

## Gamification & Rewards

### Awards System
```sql
-- award_relationships: Awards given to content
user_id              INTEGER REFERENCES users(id)     -- Award giver
submission_id        INTEGER REFERENCES submissions(id) -- Target post
comment_id           INTEGER REFERENCES comments(id)   -- OR target comment
kind                 VARCHAR(20) NOT NULL -- Award type
awarded_utc          INTEGER NOT NULL
note                 VARCHAR(200)         -- Award message
```

### Badge System
```sql
-- badge_defs: Available badge types
id                   INTEGER PRIMARY KEY
name                 VARCHAR(50) NOT NULL
description          VARCHAR(200)

-- badges: Badges assigned to users
badge_id             INTEGER REFERENCES badge_defs(id)
user_id              INTEGER REFERENCES users(id)
description          VARCHAR(500)         -- Custom badge text
url                  VARCHAR(500)         -- Badge link
created_utc          INTEGER NOT NULL
```

## Moderation Infrastructure

### Reporting System
```sql
-- flags: Post reports
user_id              INTEGER REFERENCES users(id)     -- Reporter
post_id              INTEGER REFERENCES submissions(id)
reason               VARCHAR(350) NOT NULL
created_utc          INTEGER NOT NULL

-- commentflags: Comment reports (similar structure)
user_id              INTEGER REFERENCES users(id)
comment_id           INTEGER REFERENCES comments(id)
reason               VARCHAR(350) NOT NULL
created_utc          INTEGER NOT NULL
```

### Moderation Actions Audit Log
```sql
-- modactions: Complete audit trail of moderation actions
id                   INTEGER PRIMARY KEY
user_id              INTEGER REFERENCES users(id)     -- Moderator
created_utc          INTEGER NOT NULL
kind                 VARCHAR(32) NOT NULL -- Action type
target_user_id       INTEGER REFERENCES users(id)     -- Target user
target_submission_id INTEGER REFERENCES submissions(id) -- Target post
target_comment_id    INTEGER REFERENCES comments(id)   -- Target comment
_note                VARCHAR(500)         -- Action notes/reason
```

### Administrative Notes
```sql
-- usernotes: Administrative documentation about users
id                   INTEGER PRIMARY KEY
author_id            INTEGER REFERENCES users(id) NOT NULL    -- Admin making note
reference_user       INTEGER REFERENCES users(id) NOT NULL    -- User being noted
reference_comment    INTEGER REFERENCES comments(id)          -- Related content
reference_post       INTEGER REFERENCES submissions(id)       -- Related content
created_utc          INTEGER NOT NULL
note                 VARCHAR(10000) NOT NULL -- Note content
tag                  usertag NOT NULL        -- Note category
```

### Volunteer Moderation
```sql
-- volunteer_janitor: Community-driven quality evaluation
user_id              INTEGER REFERENCES users(id)
comment_id           INTEGER REFERENCES comments(id)
created_utc          INTEGER NOT NULL
-- Links to volunteer moderation system for distributed quality control
```

## Chat System

### Real-time Messaging
```sql
-- chat_message: Chat system messages
id                   INTEGER PRIMARY KEY
author_id            INTEGER REFERENCES users(id) NOT NULL
created_utc          INTEGER NOT NULL
edited_utc           INTEGER
quote_id             INTEGER REFERENCES chat_message(id)     -- Quoted message
text                 VARCHAR(1000) NOT NULL
text_html            VARCHAR(5000) NOT NULL
```

## System & Configuration

### Alternative Account Management
```sql
-- alts: Linked alternative accounts
user1                INTEGER REFERENCES users(id)
user2                INTEGER REFERENCES users(id)
is_manual            BOOLEAN DEFAULT FALSE -- Manual vs automatic linking
created_utc          INTEGER NOT NULL
```

### OAuth Integration
```sql
-- oauth_apps: Third-party application registration
id                   INTEGER PRIMARY KEY
client_id            VARCHAR(64) UNIQUE NOT NULL
app_name             VARCHAR(50) NOT NULL
redirect_uri         VARCHAR(4096) NOT NULL
author_id            INTEGER REFERENCES users(id) NOT NULL
description          VARCHAR(256) NOT NULL
```

### Custom Content
```sql
-- marseys: Custom emoji/reactions
name                 VARCHAR(30) PRIMARY KEY
author_id            INTEGER REFERENCES users(id)
tags                 VARCHAR(200)         -- Search tags
count                INTEGER DEFAULT 0    -- Usage statistics
created_utc          INTEGER NOT NULL
```

### Domain Management
```sql
-- banneddomains: Blocked domains list
domain               VARCHAR(100) PRIMARY KEY
reason               VARCHAR(500)         -- Ban reason
created_utc          INTEGER NOT NULL
```

### Automated Tasks
```sql
-- tasks_repeatable: Scheduled task definitions
id                   INTEGER PRIMARY KEY
name                 VARCHAR(256) UNIQUE NOT NULL
cron                 VARCHAR(256) NOT NULL -- Cron schedule
function             VARCHAR(256) NOT NULL -- Function to execute
enabled              BOOLEAN DEFAULT TRUE

-- tasks_repeatable_runs: Task execution history
id                   INTEGER PRIMARY KEY
task_id              INTEGER REFERENCES tasks_repeatable(id)
created_utc          INTEGER NOT NULL
finished_utc         INTEGER
result               VARCHAR(256)         -- Execution result
```

### Profile Analytics
```sql
-- viewers: Profile view tracking (patron feature)
user_id              INTEGER REFERENCES users(id)     -- Profile owner
viewer_id            INTEGER REFERENCES users(id)     -- Profile viewer
last_view_utc        INTEGER NOT NULL
```

## Data Relationships & Flow

### Content Hierarchy
1. **Users** create **Submissions** (posts)
2. **Users** create **Comments** on submissions
3. **Comments** can reply to other comments (threaded discussion)
4. **Comments** track nesting level and descendant counts

### Engagement Flow
1. **Users** vote on submissions and comments (**votes**, **commentvotes**)
2. **Users** save content for later (**save_relationship**, **comment_save_relationship**)
3. **Users** subscribe to threads for notifications (**subscriptions**)
4. **Users** award content (**award_relationships**)

### Social Graph
1. **Users** follow other users (**follows**)
2. **Users** block other users (**userblocks**)
3. **Users** have alternative accounts (**alts**)
4. **Users** can view profiles (**viewers** - patron feature)

### Moderation Pipeline
1. Content is reported (**flags**, **commentflags**)
2. Reports change **statereport** enum on content
3. Moderators take actions (**modactions**)
4. Actions change **statemod** enum on content
5. Administrative notes are created (**usernotes**)

### Notification System
1. Comments generate notifications (**notifications**)
2. Subscriptions trigger notifications
3. Users receive notification feeds

## Performance Optimizations

The schema includes extensive indexing strategies:

### User-Related Indexes
- `users_chat_authorized_idx` - Chat access queries
- User relationship lookups (follows, blocks)
- Username and email uniqueness

### Content Indexes
- `comments_parent_submission_idx` - Comment threading
- `comments_parent_comment_id_idx` - Reply hierarchies
- Vote count lookups for ranking
- Moderation state filtering

### Search Optimization
- `banneddomains_domain_gin_idx` - Fast domain blocking with trigram matching
- Text search capabilities for content discovery

### Audit & Analytics
- Moderation action target lookups
- User activity tracking
- Performance monitoring indexes

## Security Considerations

1. **Password Security**: Stored as hashes in `users.passhash`
2. **MFA Support**: Two-factor authentication via `users.mfa_secret`
3. **Admin Levels**: Granular permissions via `users.admin_level`
4. **Content Moderation**: Comprehensive state tracking and audit trails
5. **Domain Blocking**: Prevents malicious link sharing
6. **Rate Limiting**: Application-level rate limiting (not DB-enforced)
7. **Alt Detection**: Automated and manual alternative account linking

This schema demonstrates a mature, feature-rich discussion platform optimized for community engagement, content moderation, and administrative oversight.
