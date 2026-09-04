-- Agenticnews initial schema for Neon Postgres
-- Apply this once to a fresh database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status') THEN
		CREATE TYPE article_status AS ENUM ('pending', 'published', 'rejected', 'archived');
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_category') THEN
		CREATE TYPE article_category AS ENUM (
			'breaking',
			'tech',
			'weird',
			'popculture',
			'viral',
			'business',
			'science',
                        'offbeat',
                        'crime'
		);
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_region') THEN
		CREATE TYPE article_region AS ENUM (
			'malaysia',
			'indonesia',
			'thailand',
			'philippines',
			'singapore',
			'vietnam',
			'japan',
			'south-korea',
			'china',
			'india',
			'other-asia',
			'global'
		);
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hype_level') THEN
		CREATE TYPE hype_level AS ENUM ('low', 'medium', 'high', 'extreme');
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factcheck_verdict') THEN
		CREATE TYPE factcheck_verdict AS ENUM (
			'verified',
			'mostly-true',
			'disputed',
			'unverifiable',
			'false',
			'pending'
		);
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS articles (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	slug TEXT NOT NULL UNIQUE,
	status article_status NOT NULL DEFAULT 'pending',
	category article_category NOT NULL,
	region article_region NOT NULL,
	hype_level hype_level NOT NULL DEFAULT 'medium',
	ai_generated BOOLEAN NOT NULL DEFAULT true,
	agent_run_id TEXT,
	tags TEXT[],
	source_url TEXT,
	source_name TEXT,
	source_date DATE,
	factcheck_verdict factcheck_verdict NOT NULL DEFAULT 'pending',
	factcheck_confidence INTEGER NOT NULL DEFAULT 0,
	factcheck_summary TEXT,
	title_ms TEXT NOT NULL,
	body_ms TEXT NOT NULL,
	reality_check_ms TEXT,
	takeaway_ms TEXT,
	prompt_question_ms TEXT,
	title_en TEXT,
	body_en TEXT,
	reality_check_en TEXT,
	takeaway_en TEXT,
	prompt_question_en TEXT,
	image_url TEXT,
	image_alt TEXT,
	image_caption TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_agent_run ON articles(agent_run_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_updated_at ON articles;

CREATE TRIGGER articles_updated_at
	BEFORE UPDATE ON articles
	FOR EACH ROW
	EXECUTE FUNCTION update_updated_at();
