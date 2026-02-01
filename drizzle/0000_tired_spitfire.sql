CREATE TYPE "public"."filterbehavior" AS ENUM('AUTOMATIC', 'UNFILTERED', 'FILTERED');--> statement-breakpoint
CREATE TYPE "public"."statemod" AS ENUM('VISIBLE', 'FILTERED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."statereport" AS ENUM('UNREPORTED', 'RESOLVED', 'REPORTED', 'IGNORED');--> statement-breakpoint
CREATE TABLE "commentvotes" (
	"comment_id" integer NOT NULL,
	"vote_type" integer NOT NULL,
	"user_id" integer NOT NULL,
	"app_id" integer,
	"real" boolean DEFAULT true NOT NULL,
	"created_datetimez" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"created_utc" integer NOT NULL,
	"parent_submission" integer,
	"distinguish_level" integer DEFAULT 0 NOT NULL,
	"edited_utc" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"parent_comment_id" integer,
	"over_18" boolean DEFAULT false NOT NULL,
	"upvotes" integer DEFAULT 1 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"app_id" integer,
	"sentto" integer,
	"bannedfor" boolean,
	"is_pinned" varchar(40),
	"body" text,
	"body_html" text NOT NULL,
	"realupvotes" integer DEFAULT 1 NOT NULL,
	"top_comment_id" integer,
	"is_pinned_utc" integer,
	"ghost" boolean DEFAULT false NOT NULL,
	"descendant_count" integer DEFAULT 0 NOT NULL,
	"volunteer_janitor_badness" double precision NOT NULL,
	"state_user_deleted_utc" timestamp with time zone,
	"state_mod" "statemod" NOT NULL,
	"state_mod_set_by" varchar,
	"state_report" "statereport" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" varchar(512),
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"created_utc" integer NOT NULL,
	"over_18" boolean DEFAULT false NOT NULL,
	"distinguish_level" integer DEFAULT 0 NOT NULL,
	"edited_utc" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"upvotes" integer DEFAULT 1 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"app_id" integer,
	"thumburl" varchar(200),
	"private" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"bannedfor" boolean,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"stickied" varchar(40),
	"title" varchar(500) NOT NULL,
	"url" varchar(2083),
	"body" text,
	"body_html" text,
	"embed_url" varchar(1500),
	"title_html" varchar(1500) NOT NULL,
	"realupvotes" integer,
	"flair" varchar(350),
	"stickied_utc" integer,
	"ghost" boolean DEFAULT false NOT NULL,
	"bump_utc" integer,
	"task_id" integer,
	"state_user_deleted_utc" timestamp with time zone,
	"state_mod" "statemod" NOT NULL,
	"state_mod_set_by" varchar,
	"state_report" "statereport" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255),
	"passhash" varchar(255) NOT NULL,
	"created_utc" integer NOT NULL,
	"admin_level" integer DEFAULT 0 NOT NULL,
	"over_18" boolean DEFAULT false NOT NULL,
	"is_activated" boolean DEFAULT false NOT NULL,
	"bio" varchar(1500),
	"bio_html" varchar(10000),
	"referred_by" integer,
	"is_banned" integer DEFAULT 0 NOT NULL,
	"ban_reason" varchar(256),
	"login_nonce" integer DEFAULT 0 NOT NULL,
	"reserved" varchar(256),
	"mfa_secret" varchar(32),
	"is_private" boolean DEFAULT false NOT NULL,
	"unban_utc" integer DEFAULT 0 NOT NULL,
	"is_nofollow" boolean DEFAULT false NOT NULL,
	"custom_filter_list" varchar(1000) DEFAULT '' NOT NULL,
	"stored_subscriber_count" integer DEFAULT 0 NOT NULL,
	"ban_evade" integer DEFAULT 0 NOT NULL,
	"original_username" varchar(255),
	"customtitle" varchar(1000),
	"defaultsorting" varchar(15) DEFAULT 'new' NOT NULL,
	"defaulttime" varchar(5) NOT NULL,
	"namecolor" varchar(6) NOT NULL,
	"titlecolor" varchar(6) NOT NULL,
	"profileurl" varchar(65),
	"bannerurl" varchar(65),
	"hidevotedon" boolean DEFAULT false NOT NULL,
	"newtab" boolean DEFAULT false NOT NULL,
	"flairchanged" integer,
	"defaultsortingcomments" varchar(15) DEFAULT 'new' NOT NULL,
	"theme" varchar(15) NOT NULL,
	"slurreplacer" boolean DEFAULT true NOT NULL,
	"shadowbanned" varchar(25),
	"newtabexternal" boolean DEFAULT true NOT NULL,
	"customtitleplain" varchar(100),
	"themecolor" varchar(6) NOT NULL,
	"changelogsub" boolean DEFAULT false NOT NULL,
	"css" varchar(4000),
	"profilecss" varchar(4000),
	"coins" integer DEFAULT 0 NOT NULL,
	"agendaposter" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"highres" varchar(60),
	"patron" integer DEFAULT 0 NOT NULL,
	"controversial" boolean DEFAULT false NOT NULL,
	"verified" varchar(20),
	"cardview" boolean NOT NULL,
	"received_award_count" integer DEFAULT 0 NOT NULL,
	"highlightcomments" boolean DEFAULT true NOT NULL,
	"nitter" boolean,
	"truescore" integer DEFAULT 0 NOT NULL,
	"frontsize" integer DEFAULT 25 NOT NULL,
	"coins_spent" integer DEFAULT 0 NOT NULL,
	"procoins" integer DEFAULT 0 NOT NULL,
	"verifiedcolor" varchar(6),
	"friends" varchar(500),
	"friends_html" varchar(2000),
	"enemies" varchar(500),
	"enemies_html" varchar(2000),
	"fp" varchar(21),
	"lootboxes_bought" integer DEFAULT 0 NOT NULL,
	"winnings" integer DEFAULT 0 NOT NULL,
	"patron_utc" integer DEFAULT 0 NOT NULL,
	"house" varchar(16),
	"reddit" varchar(15) NOT NULL,
	"volunteer_last_started_utc" timestamp,
	"volunteer_janitor_correctness" double precision NOT NULL,
	"chat_authorized" boolean NOT NULL,
	"chat_lastseen" timestamp with time zone NOT NULL,
	"filter_behavior" "filterbehavior" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"user_id" integer NOT NULL,
	"submission_id" integer NOT NULL,
	"vote_type" integer NOT NULL,
	"app_id" integer,
	"real" boolean DEFAULT true NOT NULL,
	"created_datetimez" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commentvotes" ADD CONSTRAINT "commentvotes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentvotes" ADD CONSTRAINT "commentvotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_submission_submissions_id_fk" FOREIGN KEY ("parent_submission") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;