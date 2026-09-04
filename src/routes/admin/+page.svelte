<script lang="ts">
        import { resolve } from '$app/paths';
        import type { Article } from '$lib/types';
        import type { PageData } from './$types';

        let { data }: { data: PageData } = $props();

        let activeFilter = $state('all');

        function formatDate(value: string | null): string {
                if (!value) {
                        return 'Unknown time';
                }

                return new Intl.DateTimeFormat('en-MY', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                }).format(new Date(value));
        }

        function formatLabel(value: string): string {
                return value
                        .split('-')
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' ');
        }

        function stripHtml(value: string | null): string {
                if (!value) {
                        return '';
                }

                return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function summarizeArticle(article: Article): string {
                const plainText = stripHtml(article.body_ms || article.body_en);
                return plainText.length > 180 ? `${plainText.slice(0, 177)}...` : plainText;
        }

        function countHighPriority(articles: Article[]): number {
                return articles.filter((article) => article.hype_level === 'high' || article.hype_level === 'extreme')
                        .length;
        }

        function buildCategoryCounts(articles: Article[]): Array<{ value: string; label: string; count: number }> {
                const counts = new Map<string, number>();

                for (const article of articles) {
                        counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
                }

                return Array.from(counts.entries())
                        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                        .map(([value, count]) => ({
                                value,
                                label: formatLabel(value),
                                count
                        }));
        }

        const categoryCounts = $derived(buildCategoryCounts(data.articles));
        const filterOptions = $derived([
                { value: 'all', label: 'All lanes', count: data.articles.length },
                ...categoryCounts
        ]);
        const filteredArticles = $derived(
                activeFilter === 'all'
                        ? data.articles
                        : data.articles.filter((article) => article.category === activeFilter)
        );
        const latestArrival = $derived(data.articles[0]?.created_at ?? null);
        const activeCategories = $derived(categoryCounts.length);
        const urgentCount = $derived(countHighPriority(data.articles));
</script>

<section class="desk-shell">
        <div class="header-copy">
                <p class="eyebrow">Editorial desk</p>
                <h2>Morning queue</h2>
                <p>Work the full draft batch like a newsroom board: scan the lanes, filter by category, and open the next story that needs a call.</p>
        </div>

        {#if data.reviewStatus}
                <div class="status-card success-card">
                        <p class="label">Review updated</p>
                        <p class="value">
                                {data.reviewStatus === 'approved'
                                        ? 'The story was approved and moved to the published desk.'
                                        : 'The story was rejected and cleared from the pending desk.'}
                        </p>
                        <p class="note">The workflow already delivered the batch. Editorial approval now lives fully in this desk.</p>

                        <div class="status-footer">
                                <span
                                        >{data.reviewStatus === 'approved' ? 'Published desk updated' : 'Pending desk updated'}</span
                                >
                                <span>Workflow already completed</span>
                        </div>
                </div>
        {/if}

        {#if !data.databaseReady}
                <div class="status-card">
                        <p class="label">Database setup needed</p>
                        <p class="value">Add `NEON_DATABASE_URL` to your local `.env` to load the pending review desk.</p>
                </div>
        {:else if data.databaseError}
                <div class="status-card error-card">
                        <p class="label">Database connection issue</p>
                        <p class="value">{data.databaseError}</p>
                </div>
        {:else if data.articles.length === 0}
                <div class="status-card">
                        <p class="label">Desk is clear</p>
                        <p class="value">No pending stories are waiting for review right now.</p>
                </div>
        {:else}
                <div class="board-overview">
                        <article class="overview-card lead-card">
                                <p class="label">Batch readiness</p>
                                <h3>{data.articles.length} drafts waiting</h3>
                                <p class="overview-copy">
                                        Latest arrival {formatDate(latestArrival)}. Keep the morning run moving by clearing the highest-signal stories first.
                                </p>
                        </article>

                        <article class="overview-card">
                                <p class="label">Urgent watch</p>
                                <strong>{urgentCount}</strong>
                                <span>high or extreme priority</span>
                        </article>

                        <article class="overview-card">
                                <p class="label">Live lanes</p>
                                <strong>{activeCategories}</strong>
                                <span>categories active in this batch</span>
                        </article>

                        <article class="overview-card">
                                <p class="label">Workflow mode</p>
                                <strong>Batch delivered</strong>
                                <span>review and publishing continue here</span>
                        </article>
                </div>

                <div class="filter-panel">
                        <div class="filter-copy">
                                <p class="label">Queue filters</p>
                                <p class="filter-text">Use the newsroom lanes to focus the desk. Crime now has its own lane in the morning run.</p>
                        </div>

                        <div class="filter-row">
                                {#each filterOptions as option}
                                        <button
                                                class:active={activeFilter === option.value}
                                                class="filter-pill"
                                                type="button"
                                                onclick={() => {
                                                        activeFilter = option.value;
                                                }}
                                        >
                                                <span>{option.label}</span>
                                                <strong>{option.count}</strong>
                                        </button>
                                {/each}
                        </div>
                </div>

                <div class="queue-list">
                        {#each filteredArticles as article, index (article.id)}
                                <a class="queue-card" href={resolve('/admin/[id]', { id: article.id })}>
                                        <div class="queue-index">
                                                <span class="index-label">Queue</span>
                                                <strong>{String(index + 1).padStart(2, '0')}</strong>
                                        </div>

                                        <div class="queue-main">
                                                <div class="card-topline">
                                                        <p class="category">{formatLabel(article.category)}</p>
                                                        <div class="card-chips">
                                                                <span class="chip verdict-chip">{formatLabel(article.factcheck_verdict)}</span>
                                                                <span class="chip neutral-chip">{formatLabel(article.region)}</span>
                                                        </div>
                                                </div>

                                                <div class="title-block">
                                                        <h3>{article.title_ms}</h3>
                                                        {#if article.title_en}
                                                                <p class="subtitle">{article.title_en}</p>
                                                        {/if}
                                                </div>

                                                <p class="story-summary">{summarizeArticle(article) || 'Open this draft to review the full editorial body.'}</p>

                                                <div class="meta-grid">
                                                        <div class="meta-block">
                                                                <span class="meta-label">Source</span>
                                                                <strong>{article.source_name ?? 'Unknown source'}</strong>
                                                        </div>
                                                        <div class="meta-block">
                                                                <span class="meta-label">Received</span>
                                                                <strong>{formatDate(article.created_at)}</strong>
                                                        </div>
                                                        <div class="meta-block">
                                                                <span class="meta-label">Slug</span>
                                                                <strong>{article.slug}</strong>
                                                        </div>
                                                </div>
                                        </div>

                                        <div class="queue-side">
                                                <span class="priority-badge">{formatLabel(article.hype_level)} priority</span>
                                                <span class="open-cta">Open draft</span>
                                        </div>
                                </a>
                        {/each}
                </div>
        {/if}
</section>

<style>
        .desk-shell {
                display: grid;
                gap: 1.2rem;
        }

        .header-copy,
        .filter-copy {
                display: grid;
                gap: 0.45rem;
        }

        .eyebrow,
        .category,
        .label,
        .meta-label,
        .index-label {
                font-size: 0.78rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748b;
        }

        h2,
        h3,
        p {
                margin: 0;
        }

        h2 {
                font-size: clamp(2rem, 4vw, 2.8rem);
                line-height: 1.05;
                color: #0f172a;
                text-wrap: balance;
        }

        .header-copy p:last-child {
                max-width: 52rem;
                color: #475569;
                line-height: 1.7;
        }

        .status-card,
        .overview-card,
        .filter-panel,
        .queue-card {
                border: 1px solid #dbe4f0;
                border-radius: 1.2rem;
                background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.97)),
                        #ffffff;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
        }

        .status-card,
        .filter-panel {
                padding: 1.3rem;
        }

        .error-card {
                border-color: #fecaca;
                background: #fff7f7;
        }

        .success-card {
                border-color: #bbf7d0;
                background: #f0fdf4;
        }

        .value {
                margin-top: 0.45rem;
                font-size: 1.02rem;
                font-weight: 600;
                color: #0f172a;
        }

        .note {
                margin-top: 0.6rem;
                color: #166534;
        }

        .status-footer {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem 1rem;
                margin-top: 0.9rem;
                padding-top: 0.9rem;
                border-top: 1px solid rgba(148, 163, 184, 0.22);
                color: #475569;
                font-size: 0.88rem;
                font-weight: 600;
        }

        .board-overview {
                display: grid;
                grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 1fr));
                gap: 1rem;
        }

        .overview-card {
                display: grid;
                gap: 0.45rem;
                padding: 1.2rem;
        }

        .lead-card {
                background:
                        linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.94)),
                        #0f172a;
                border-color: rgba(30, 41, 59, 0.85);
        }

        .lead-card .label,
        .lead-card .overview-copy {
                color: rgba(226, 232, 240, 0.82);
        }

        .lead-card h3 {
                color: #f8fafc;
                font-size: 1.5rem;
                line-height: 1.1;
        }

        .overview-card strong {
                font-size: 1.5rem;
                line-height: 1.1;
                color: #0f172a;
        }

        .overview-card span,
        .overview-copy,
        .filter-text {
                color: #475569;
                line-height: 1.6;
        }

        .filter-panel {
                display: grid;
                gap: 1rem;
        }

        .filter-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.65rem;
        }

        .filter-pill {
                display: inline-flex;
                align-items: center;
                gap: 0.7rem;
                border: 1px solid #dbe4f0;
                border-radius: 999px;
                background: #ffffff;
                padding: 0.7rem 0.95rem;
                color: #334155;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
                transition:
                        transform 160ms ease,
                        border-color 160ms ease,
                        box-shadow 160ms ease,
                        background 160ms ease;
        }

        .filter-pill strong {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.75rem;
                height: 1.75rem;
                border-radius: 999px;
                background: #e2e8f0;
                color: #0f172a;
                font-size: 0.8rem;
        }

        .filter-pill:hover,
        .filter-pill.active {
                transform: translateY(-2px);
                border-color: #cbd5e1;
                background: #f8fafc;
                box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        }

        .filter-pill.active {
                background: #0f172a;
                color: #f8fafc;
        }

        .filter-pill.active strong {
                background: rgba(255, 255, 255, 0.16);
                color: #f8fafc;
        }

        .queue-list {
                display: grid;
                gap: 0.95rem;
        }

        .queue-card {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                gap: 1rem;
                align-items: stretch;
                padding: 1rem;
                color: inherit;
                text-decoration: none;
                transition:
                        transform 160ms ease,
                        border-color 160ms ease,
                        box-shadow 160ms ease;
        }

        .queue-card:hover {
                transform: translateY(-3px);
                border-color: #94a3b8;
                box-shadow: 0 22px 46px rgba(15, 23, 42, 0.11);
        }

        .queue-index {
                display: grid;
                align-content: space-between;
                min-width: 4.75rem;
                padding: 0.9rem 0.85rem;
                border-radius: 0.95rem;
                background: linear-gradient(180deg, #f8fafc, #eef2f7);
                color: #0f172a;
                text-align: center;
        }

        .queue-index strong {
                font-size: 1.5rem;
                line-height: 1;
        }

        .queue-main {
                display: grid;
                gap: 0.8rem;
                min-width: 0;
        }

        .card-topline {
                display: flex;
                gap: 0.8rem;
                align-items: center;
                justify-content: space-between;
        }

        .card-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 0.45rem;
                justify-content: flex-end;
        }

        .chip,
        .priority-badge,
        .open-cta {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                padding: 0.38rem 0.75rem;
                font-size: 0.78rem;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
        }

        .verdict-chip {
                background: #dcfce7;
                color: #166534;
        }

        .neutral-chip {
                background: #e2e8f0;
                color: #334155;
        }

        .title-block {
                display: grid;
                gap: 0.3rem;
        }

        h3 {
                color: #0f172a;
                font-size: 1.18rem;
                line-height: 1.28;
                text-wrap: balance;
        }

        .subtitle,
        .story-summary {
                color: #475569;
        }

        .story-summary {
                line-height: 1.65;
        }

        .meta-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.75rem;
        }

        .meta-block {
                display: grid;
                gap: 0.18rem;
                padding-top: 0.8rem;
                border-top: 1px solid rgba(148, 163, 184, 0.18);
                min-width: 0;
        }

        .meta-block strong {
                color: #0f172a;
                font-size: 0.95rem;
                overflow-wrap: anywhere;
        }

        .queue-side {
                display: grid;
                align-content: space-between;
                justify-items: end;
                gap: 1rem;
                min-width: 10rem;
        }

        .priority-badge {
                background: #fef3c7;
                color: #92400e;
        }

        .open-cta {
                background: #0f172a;
                color: #f8fafc;
                min-width: 8.5rem;
        }

        @media (max-width: 1024px) {
                .board-overview {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                }
        }

        @media (max-width: 820px) {
                .queue-card {
                        grid-template-columns: 1fr;
                }

                .queue-index,
                .queue-side {
                        grid-auto-flow: column;
                        align-items: center;
                        justify-content: space-between;
                        min-width: 0;
                }

                .queue-side {
                        justify-items: stretch;
                }

                .open-cta {
                        min-width: 0;
                }
        }

        @media (max-width: 640px) {
                .board-overview,
                .meta-grid {
                        grid-template-columns: 1fr;
                }

                .card-topline {
                        flex-direction: column;
                        align-items: flex-start;
                }

                .card-chips {
                        justify-content: flex-start;
                }

                .status-footer {
                        flex-direction: column;
                }
        }
</style>
