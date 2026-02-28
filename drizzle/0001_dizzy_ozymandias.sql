CREATE EXTENSION IF NOT EXISTS ltree;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "path" "ltree";
--> statement-breakpoint
-- Backfill existing comments with ltree paths
WITH RECURSIVE comment_paths AS (
  SELECT id, id::text::ltree AS path
  FROM comments WHERE parent_comment_id IS NULL
  UNION ALL
  SELECT c.id, (cp.path || c.id::text::ltree)
  FROM comments c
  JOIN comment_paths cp ON c.parent_comment_id = cp.id
)
UPDATE comments c
SET path = comment_paths.path
FROM comment_paths
WHERE c.id = comment_paths.id;
--> statement-breakpoint
-- GiST index for efficient ancestor queries
CREATE INDEX idx_comments_path_gist ON comments USING GIST (path);
