ALTER TABLE "alts" ADD CONSTRAINT "alts_user1_user2_pk" PRIMARY KEY("user1","user2");--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id");--> statement-breakpoint
ALTER TABLE "client_auths" ADD CONSTRAINT "client_auths_user_id_oauth_client_pk" PRIMARY KEY("user_id","oauth_client");--> statement-breakpoint
ALTER TABLE "comment_save_relationship" ADD CONSTRAINT "comment_save_relationship_user_id_comment_id_pk" PRIMARY KEY("user_id","comment_id");--> statement-breakpoint
ALTER TABLE "commentvotes" ADD CONSTRAINT "commentvotes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id");--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_target_id_user_id_pk" PRIMARY KEY("target_id","user_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_comment_id_pk" PRIMARY KEY("user_id","comment_id");--> statement-breakpoint
ALTER TABLE "save_relationship" ADD CONSTRAINT "save_relationship_user_id_submission_id_pk" PRIMARY KEY("user_id","submission_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_submission_id_pk" PRIMARY KEY("user_id","submission_id");--> statement-breakpoint
ALTER TABLE "userblocks" ADD CONSTRAINT "userblocks_user_id_target_id_pk" PRIMARY KEY("user_id","target_id");--> statement-breakpoint
ALTER TABLE "viewers" ADD CONSTRAINT "viewers_user_id_viewer_id_pk" PRIMARY KEY("user_id","viewer_id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_submission_id_user_id_pk" PRIMARY KEY("submission_id","user_id");