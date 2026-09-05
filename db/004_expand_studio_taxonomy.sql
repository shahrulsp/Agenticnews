DO $$
BEGIN
        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'politics'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'politics';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'entertainment'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'entertainment';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'sports'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'sports';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'taiwan'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'taiwan';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'bangladesh'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'bangladesh';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'sri-lanka'
                        AND enumtypid = 'article_region'::regtype
        ) THEN
                ALTER TYPE article_region ADD VALUE 'sri-lanka';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'partially-verified'
                        AND enumtypid = 'factcheck_verdict'::regtype
        ) THEN
                ALTER TYPE factcheck_verdict ADD VALUE 'partially-verified';
        END IF;

        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'unverified'
                        AND enumtypid = 'factcheck_verdict'::regtype
        ) THEN
                ALTER TYPE factcheck_verdict ADD VALUE 'unverified';
        END IF;
END $$;

ALTER TABLE articles
        ADD COLUMN IF NOT EXISTS form TEXT,
        ADD COLUMN IF NOT EXISTS summary TEXT,
        ADD COLUMN IF NOT EXISTS why_viral TEXT,
        ADD COLUMN IF NOT EXISTS key_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS claims_made JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS secondary_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS sensitivity_notes TEXT,
        ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS scout_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS sentinel_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS lens_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS polyglot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS glossary_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS quality_notes TEXT,
        ADD COLUMN IF NOT EXISTS image_strategy TEXT,
        ADD COLUMN IF NOT EXISTS image_source_recommendation TEXT,
        ADD COLUMN IF NOT EXISTS image_notes_for_human TEXT;
