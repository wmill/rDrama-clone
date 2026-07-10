ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_comment_id_pk";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "comment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "type" varchar(20) DEFAULT 'comment' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "actor_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "body" varchar(500);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "url" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_comment_id_unique" UNIQUE("user_id","comment_id");