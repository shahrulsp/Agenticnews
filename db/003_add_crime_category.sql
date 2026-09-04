DO $$
BEGIN
        IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'crime'
                        AND enumtypid = 'article_category'::regtype
        ) THEN
                ALTER TYPE article_category ADD VALUE 'crime';
        END IF;
END $$;
