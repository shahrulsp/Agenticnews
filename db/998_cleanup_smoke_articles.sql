-- Optional local/manual cleanup for smoke-test articles created during workflow validation.
-- Review before running. This intentionally targets only known smoke slugs from our validation passes.

DELETE FROM articles
WHERE slug IN (
        'agenticnews-admin-ui-smoke-20260903-2',
        'agenticnews-admin-ui-smoke-20260903-1',
        'agenticnews-railway-smoke-20260903-1',
        'agenticnews-live-review-001',
        'live-mistral-smoke-20260903-161233'
);
