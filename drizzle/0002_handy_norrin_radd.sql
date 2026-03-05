CREATE TYPE "public"."usertag" AS ENUM('Quality', 'Good', 'Comment', 'Warning', 'Tempban', 'Permban', 'Spam', 'Bot');--> statement-breakpoint
CREATE TYPE "public"."volunteerjanitorresult" AS ENUM('Pending', 'TopQuality', 'Good', 'Neutral', 'Bad', 'Warning', 'Ban');--> statement-breakpoint
CREATE TABLE "alts" (
	"user1" integer NOT NULL,
	"user2" integer NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"submission_id" integer,
	"comment_id" integer,
	"kind" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"badge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"description" varchar(256),
	"url" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "banneddomains" (
	"domain" varchar(100) PRIMARY KEY NOT NULL,
	"reason" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"quote_id" integer,
	"text" varchar NOT NULL,
	"text_html" varchar NOT NULL,
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_auths" (
	"user_id" integer NOT NULL,
	"oauth_client" integer NOT NULL,
	"access_token" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commentflags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"comment_id" integer NOT NULL,
	"reason" varchar(350),
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_save_relationship" (
	"user_id" integer NOT NULL,
	"comment_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"reason" varchar(350),
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"user_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marseys" (
	"name" varchar(30) PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"tags" varchar(200) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"target_user_id" integer,
	"target_submission_id" integer,
	"target_comment_id" integer,
	"kind" varchar(32),
	"_note" varchar(256),
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"user_id" integer NOT NULL,
	"comment_id" integer NOT NULL,
	"read" boolean NOT NULL,
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(64),
	"app_name" varchar(50) NOT NULL,
	"redirect_uri" varchar(50) NOT NULL,
	"author_id" integer NOT NULL,
	"description" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "save_relationship" (
	"submission_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" integer NOT NULL,
	"submission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_repeatable" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"type_id" smallint NOT NULL,
	"enabled" boolean NOT NULL,
	"run_state" smallint NOT NULL,
	"run_time_last" timestamp,
	"frequency_day" smallint NOT NULL,
	"time_of_day_utc" time NOT NULL,
	"created_utc" integer NOT NULL,
	"label" varchar
);
--> statement-breakpoint
CREATE TABLE "tasks_repeatable_python" (
	"id" integer PRIMARY KEY NOT NULL,
	"import_path" varchar NOT NULL,
	"callable" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_repeatable_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"manual" boolean NOT NULL,
	"traceback_str" text,
	"completed_utc" timestamp,
	"created_utc" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_repeatable_scheduled_submissions" (
	"id" integer PRIMARY KEY NOT NULL,
	"author_id_submission" integer NOT NULL,
	"ghost" boolean NOT NULL,
	"private" boolean NOT NULL,
	"over_18" boolean NOT NULL,
	"is_bot" boolean NOT NULL,
	"title" varchar(500) NOT NULL,
	"url" varchar,
	"body" text,
	"body_html" text,
	"flair" varchar,
	"embed_url" varchar
);
--> statement-breakpoint
CREATE TABLE "userblocks" (
	"user_id" integer NOT NULL,
	"target_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usernotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"reference_user" integer NOT NULL,
	"reference_comment" integer,
	"reference_post" integer,
	"note" varchar(10000) NOT NULL,
	"tag" "usertag" NOT NULL,
	"created_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewers" (
	"user_id" integer NOT NULL,
	"viewer_id" integer NOT NULL,
	"last_view_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_janitor" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"comment_id" integer NOT NULL,
	"result" "volunteerjanitorresult" NOT NULL,
	"recorded_datetimez" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stored_following_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "alts" ADD CONSTRAINT "alts_user1_users_id_fk" FOREIGN KEY ("user1") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alts" ADD CONSTRAINT "alts_user2_users_id_fk" FOREIGN KEY ("user2") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_relationships" ADD CONSTRAINT "award_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_relationships" ADD CONSTRAINT "award_relationships_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_relationships" ADD CONSTRAINT "award_relationships_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_badge_id_badge_defs_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge_defs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_auths" ADD CONSTRAINT "client_auths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentflags" ADD CONSTRAINT "commentflags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commentflags" ADD CONSTRAINT "commentflags_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_save_relationship" ADD CONSTRAINT "comment_save_relationship_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_save_relationship" ADD CONSTRAINT "comment_save_relationship_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_post_id_submissions_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marseys" ADD CONSTRAINT "marseys_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modactions" ADD CONSTRAINT "modactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modactions" ADD CONSTRAINT "modactions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modactions" ADD CONSTRAINT "modactions_target_submission_id_submissions_id_fk" FOREIGN KEY ("target_submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modactions" ADD CONSTRAINT "modactions_target_comment_id_comments_id_fk" FOREIGN KEY ("target_comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD CONSTRAINT "oauth_apps_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_relationship" ADD CONSTRAINT "save_relationship_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_relationship" ADD CONSTRAINT "save_relationship_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_repeatable" ADD CONSTRAINT "tasks_repeatable_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_repeatable_python" ADD CONSTRAINT "tasks_repeatable_python_id_tasks_repeatable_id_fk" FOREIGN KEY ("id") REFERENCES "public"."tasks_repeatable"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_repeatable_runs" ADD CONSTRAINT "tasks_repeatable_runs_task_id_tasks_repeatable_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks_repeatable"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_repeatable_scheduled_submissions" ADD CONSTRAINT "tasks_repeatable_scheduled_submissions_id_tasks_repeatable_id_fk" FOREIGN KEY ("id") REFERENCES "public"."tasks_repeatable"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userblocks" ADD CONSTRAINT "userblocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userblocks" ADD CONSTRAINT "userblocks_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usernotes" ADD CONSTRAINT "usernotes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usernotes" ADD CONSTRAINT "usernotes_reference_user_users_id_fk" FOREIGN KEY ("reference_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usernotes" ADD CONSTRAINT "usernotes_reference_comment_comments_id_fk" FOREIGN KEY ("reference_comment") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usernotes" ADD CONSTRAINT "usernotes_reference_post_submissions_id_fk" FOREIGN KEY ("reference_post") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewers" ADD CONSTRAINT "viewers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewers" ADD CONSTRAINT "viewers_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_janitor" ADD CONSTRAINT "volunteer_janitor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_janitor" ADD CONSTRAINT "volunteer_janitor_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;