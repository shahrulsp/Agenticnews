-- Local/dev reset only.
-- This removes the Agenticnews schema objects so you can re-apply 001_init.sql cleanly.

DROP TRIGGER IF EXISTS articles_updated_at ON articles;
DROP FUNCTION IF EXISTS update_updated_at();
DROP TABLE IF EXISTS articles;
DROP TYPE IF EXISTS factcheck_verdict;
DROP TYPE IF EXISTS hype_level;
DROP TYPE IF EXISTS article_region;
DROP TYPE IF EXISTS article_category;
DROP TYPE IF EXISTS article_status;

\i db/001_init.sql
\i db/003_add_crime_category.sql
\i db/004_expand_studio_taxonomy.sql
