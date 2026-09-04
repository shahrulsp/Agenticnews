<script lang="ts">
        import { resolve } from '$app/paths';
        import type { Article } from '$lib/types';
        import { onMount } from 'svelte';
        import type { PageData } from './$types';

        const LAST_OPENED_DRAFT_KEY = 'agenticnews:last-opened-draft';

        let { data }: { data: PageData } = $props();

        let activeFilter = $state('all');
        let lastOpenedDraft = $state<{
                id: string;
                title: string;
                category: string;
                updatedAt: string;
        } | null>(null);

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

        function formatSourceHost(value: string | null): string {
                if (!value) {
                        return 'Source unavailable';
                }

                try {
                        return new URL(value).hostname.replace(/^www\./, '');
                } catch {
                        return value;
                }
        }

        function formatSourceFreshness(value: string | null): string | null {
                if (!value) {
                        return null;
                }

                const parsedValue = new Date(value);

                if (Number.isNaN(parsedValue.getTime())) {
                        return null;
                }

                return new Intl.DateTimeFormat('en-MY', {
                        dateStyle: 'medium'
                }).format(parsedValue);
        }

        function getSourceQualityFlags(article: Article): string[] {
                const flags: string[] = [];

                if (!article.source_url) {
                        flags.push('Missing source URL');
                }

                if (!article.source_name) {
                        flags.push('Missing source name');
                }

                if (!formatSourceFreshness(article.source_date)) {
                        flags.push('Missing source date');
                }

                return flags;
        }

        function getSourceWatchLabel(flagCount: number): string {
                return flagCount > 1 ? `${flagCount} source gaps` : 'Source watch';
        }

        function getVerificationFlags(article: Article): string[] {
                const flags: string[] = [];

                if (article.factcheck_verdict === 'pending') {
                        flags.push('Fact check pending');
                }

                if (article.factcheck_verdict === 'disputed' || article.factcheck_verdict === 'unverifiable') {
                        flags.push(formatLabel(article.factcheck_verdict));
                }

                if (article.factcheck_verdict === 'false') {
                        flags.push('Marked false');
                }

                if (article.factcheck_confidence < 60) {
                        flags.push(`Low confidence ${article.factcheck_confidence}%`);
                }

                return flags;
        }

        function getVerificationWatchLabel(flagCount: number): string {
                return flagCount > 1 ? `${flagCount} verification gaps` : 'Verification watch';
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

        function isUrgent(article: Article): boolean {
                return article.hype_level === 'high' || article.hype_level === 'extreme';
        }

        function getEditorialPriority(article: Article): number {
                let score = 0;

                if (article.hype_level === 'extreme') {
                        score += 5;
                } else if (article.hype_level === 'high') {
                        score += 4;
                } else if (article.hype_level === 'medium') {
                        score += 2;
                }

                if (article.category === 'crime') {
                        score += 3;
                }

                if (article.factcheck_verdict === 'pending') {
                        score += 2;
                } else if (article.factcheck_confidence < 60) {
                        score += 1;
                }

                if (!article.source_name) {
                        score += 1;
                }

                return score;
        }

        function buildPriorityReason(article: Article): string {
                if (article.hype_level === 'extreme' || article.hype_level === 'high') {
                        return 'High-signal story. Make the framing call early while the desk is fresh.';
                }

                if (article.category === 'crime') {
                        return 'Crime lane story. Give tone, sourcing, and verification a careful first pass.';
                }

                if (article.factcheck_verdict === 'pending' || article.factcheck_confidence < 60) {
                        return 'Verification still needs a sharper editorial eye before this moves further.';
                }

                return 'Strong candidate for the next pass based on the current morning queue balance.';
        }

        function buildTriageGroups(articles: Article[]): Array<{
                key: string;
                title: string;
                description: string;
                count: number;
                articles: Article[];
        }> {
                const urgentArticles = articles.filter((article) => isUrgent(article));
                const crimeArticles = articles.filter((article) => article.category === 'crime' && !isUrgent(article));
                const deskArticles = articles.filter(
                        (article) => !isUrgent(article) && article.category !== 'crime'
                );

                return [
                        {
                                key: 'urgent',
                                title: 'Urgent first',
                                description: 'Higher-signal stories that deserve the first editorial call.',
                                count: urgentArticles.length,
                                articles: urgentArticles
                        },
                        {
                                key: 'crime',
                                title: 'Crime lane',
                                description: 'Crime and public-safety stories grouped for careful tone and verification review.',
                                count: crimeArticles.length,
                                articles: crimeArticles
                        },
                        {
                                key: 'desk',
                                title: 'Everything else',
                                description: 'The remaining morning desk once urgent and crime calls are handled.',
                                count: deskArticles.length,
                                articles: deskArticles
                        }
                ].filter((group) => group.count > 0);
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
        const sourceWatchCount = $derived(
                data.articles.filter((article) => getSourceQualityFlags(article).length > 0).length
        );
        const verificationWatchCount = $derived(
                data.articles.filter((article) => getVerificationFlags(article).length > 0).length
        );
        const dualWatchCount = $derived(
                data.articles.filter(
                        (article) =>
                                getSourceQualityFlags(article).length > 0 &&
                                getVerificationFlags(article).length > 0
                ).length
        );
        const reviewedCount = $derived((data.batchProgress?.published ?? 0) + (data.batchProgress?.rejected ?? 0));
        const progressPercent = $derived(
                data.batchProgress?.total ? Math.round((reviewedCount / data.batchProgress.total) * 100) : 0
        );
        const triageGroups = $derived(buildTriageGroups(filteredArticles));
        const resumeArticle = $derived.by(() => {
                const storedDraft = lastOpenedDraft;

                if (!storedDraft) {
                        return null;
                }

                return data.articles.find((article) => article.id === storedDraft.id) ?? null;
        });
        const recommendedArticle = $derived.by(() => {
                const [firstArticle, ...remainingArticles] = data.articles;

                if (!firstArticle) {
                        return null;
                }

                return remainingArticles.reduce((bestArticle, article) => {
                        const bestScore = getEditorialPriority(bestArticle);
                        const articleScore = getEditorialPriority(article);

                        if (articleScore !== bestScore) {
                                return articleScore > bestScore ? article : bestArticle;
                        }

                        return new Date(article.created_at).getTime() < new Date(bestArticle.created_at).getTime()
                                ? article
                                : bestArticle;
                }, firstArticle);
        });
        const showRecommendedArticle = $derived(
                recommendedArticle && recommendedArticle.id !== resumeArticle?.id ? recommendedArticle : null
        );

        onMount(() => {
                const stored = window.localStorage.getItem(LAST_OPENED_DRAFT_KEY);

                if (!stored) {
                        return;
                }

                try {
                        lastOpenedDraft = JSON.parse(stored) as {
                                id: string;
                                title: string;
                                category: string;
                                updatedAt: string;
                        };
                } catch {
                        window.localStorage.removeItem(LAST_OPENED_DRAFT_KEY);
                }
        });

        $effect(() => {
                if (typeof window === 'undefined' || !lastOpenedDraft) {
                        return;
                }

                const storedDraft = lastOpenedDraft;
                const stillPending = data.articles.some((article) => article.id === storedDraft.id);

                if (!stillPending) {
                        lastOpenedDraft = null;
                        window.localStorage.removeItem(LAST_OPENED_DRAFT_KEY);
                }
        });
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
                                <p class="label">Batch progress</p>
                                <strong>{reviewedCount}/{data.batchProgress?.total ?? data.articles.length}</strong>
                                <span>{progressPercent}% reviewed for {data.batchProgress?.scheduledDate ?? 'this run'}</span>
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

                <div class="risk-summary-panel">
                        <div class="risk-summary-copy">
                                <p class="label">Editorial risk summary</p>
                                <h3>{sourceWatchCount + verificationWatchCount} active review signals</h3>
                                <p class="overview-copy">
                                        Use this board to spot drafts that need extra sourcing or verification care before the publish call.
                                </p>
                        </div>

                        <div class="risk-summary-grid">
                                <article class="risk-summary-card source-risk-card">
                                        <p class="label">Source watch</p>
                                        <strong>{sourceWatchCount}</strong>
                                        <span>drafts with missing source details</span>
                                </article>

                                <article class="risk-summary-card verification-risk-card">
                                        <p class="label">Verification watch</p>
                                        <strong>{verificationWatchCount}</strong>
                                        <span>drafts with unresolved fact-check posture</span>
                                </article>

                                <article class="risk-summary-card overlap-risk-card">
                                        <p class="label">Dual watch</p>
                                        <strong>{dualWatchCount}</strong>
                                        <span>drafts carrying both source and verification risk</span>
                                </article>
                        </div>
                </div>

                {#if data.batchProgress}
                        <div class="progress-panel">
                                <div class="progress-copy">
                                        <p class="label">Morning run pulse</p>
                                        <h3>{data.batchProgress.scheduledDate}</h3>
                                        <p class="overview-copy">
                                                {data.batchProgress.pending} still waiting, {data.batchProgress.published} published, {data.batchProgress.rejected} rejected.
                                        </p>
                                </div>

                                <div class="progress-track" aria-hidden="true">
                                        <span
                                                class="progress-segment published-segment"
                                                style={`width: ${(data.batchProgress.published / data.batchProgress.total) * 100}%`}
                                        ></span>
                                        <span
                                                class="progress-segment rejected-segment"
                                                style={`width: ${(data.batchProgress.rejected / data.batchProgress.total) * 100}%`}
                                        ></span>
                                        <span
                                                class="progress-segment pending-segment"
                                                style={`width: ${(data.batchProgress.pending / data.batchProgress.total) * 100}%`}
                                        ></span>
                                </div>

                                <div class="progress-legend">
                                        <span><i class="legend-dot published-dot"></i> Published {data.batchProgress.published}</span>
                                        <span><i class="legend-dot rejected-dot"></i> Rejected {data.batchProgress.rejected}</span>
                                        <span><i class="legend-dot pending-dot"></i> Remaining {data.batchProgress.pending}</span>
                                </div>
                        </div>
                {/if}

                {#if resumeArticle}
                        <div class="resume-panel">
                                <div class="resume-copy">
                                        <p class="label">Resume where you left off</p>
                                        <h3>{resumeArticle.title_ms}</h3>
                                        <p class="overview-copy">
                                                Back in the {formatLabel(resumeArticle.category)} lane. Last touched {formatDate(resumeArticle.updated_at)}.
                                        </p>
                                </div>

                                <a class="resume-link" href={resolve('/admin/[id]', { id: resumeArticle.id })}>
                                        Continue review
                                </a>
                        </div>
                {/if}

                {#if showRecommendedArticle}
                        {@const recommendedSourceFlags = getSourceQualityFlags(showRecommendedArticle)}
                        <div class="priority-panel">
                                <div class="priority-copy">
                                        <p class="label">Start here</p>
                                        <h3>{showRecommendedArticle.title_ms}</h3>
                                        <p class="priority-reason">{buildPriorityReason(showRecommendedArticle)}</p>
                                        <div class="priority-meta">
                                                <span>{formatLabel(showRecommendedArticle.category)} lane</span>
                                                <span>{formatLabel(showRecommendedArticle.hype_level)} priority</span>
                                                <span>{formatDate(showRecommendedArticle.created_at)}</span>
                                                {#if showRecommendedArticle.source_url}
                                                        <span>{formatSourceHost(showRecommendedArticle.source_url)}</span>
                                                {/if}
                                                {#if formatSourceFreshness(showRecommendedArticle.source_date)}
                                                        <span>
                                                                Source dated
                                                                {formatSourceFreshness(showRecommendedArticle.source_date)}
                                                        </span>
                                                {/if}
                                        </div>
                                        {#if recommendedSourceFlags.length > 0}
                                                <div class="source-flag-row">
                                                        {#each recommendedSourceFlags as flag}
                                                                <span class="source-flag">{flag}</span>
                                                        {/each}
                                                </div>
                                        {/if}
                                </div>

                                <div class="priority-actions">
                                        <a
                                                class="priority-link"
                                                href={resolve('/admin/[id]', { id: showRecommendedArticle.id })}
                                        >
                                                Open recommended draft
                                        </a>
                                        {#if showRecommendedArticle.source_url}
                                                <a
                                                        class="priority-source-link"
                                                        href={showRecommendedArticle.source_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                >
                                                        Review source
                                                </a>
                                        {/if}
                                </div>
                        </div>
                {/if}

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

                {#if activeFilter === 'all'}
                        <div class="triage-board">
                                {#each triageGroups as group}
                                        <section class="triage-section">
                                                <div class="triage-header">
                                                        <div class="triage-copy">
                                                                <p class="label">{group.title}</p>
                                                                <h3>{group.count} story{group.count === 1 ? '' : 'ies'}</h3>
                                                                <p class="overview-copy">{group.description}</p>
                                                        </div>
                                                        <span class="triage-count">{String(group.count).padStart(2, '0')}</span>
                                                </div>

                                                <div class="queue-list">
                                                        {#each group.articles as article, index (article.id)}
                                                                {@const sourceFlags = getSourceQualityFlags(article)}
                                                                {@const verificationFlags = getVerificationFlags(article)}
                                                                <div
                                                                        class:source-watch-entry={sourceFlags.length > 0}
                                                                        class:verification-watch-entry={verificationFlags.length > 0}
                                                                        class="queue-entry"
                                                                >
                                                                        <a
                                                                                class:source-watch-card={sourceFlags.length > 0}
                                                                                class:verification-watch-card={verificationFlags.length > 0}
                                                                                class="queue-card"
                                                                                href={resolve('/admin/[id]', { id: article.id })}
                                                                        >
                                                                                <div class="queue-index">
                                                                                        <span class="index-label">{group.title}</span>
                                                                                        <strong>{String(index + 1).padStart(2, '0')}</strong>
                                                                                </div>

                                                                                <div class="queue-main">
                                                                                        <div class="card-topline">
                                                                                                <p class="category">{formatLabel(article.category)}</p>
                                                                                                <div class="card-chips">
                                                                                                        {#if sourceFlags.length > 0}
                                                                                                                <span class="chip source-watch-chip">
                                                                                                                        {getSourceWatchLabel(sourceFlags.length)}
                                                                                                                </span>
                                                                                                        {/if}
                                                                                                        {#if verificationFlags.length > 0}
                                                                                                                <span class="chip verification-watch-chip">
                                                                                                                        {getVerificationWatchLabel(verificationFlags.length)}
                                                                                                                </span>
                                                                                                        {/if}
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

                                                                                        <p class="story-summary">
                                                                                                {summarizeArticle(article) || 'Open this draft to review the full editorial body.'}
                                                                                        </p>

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

                                                                        {#if article.source_url || sourceFlags.length > 0}
                                                                                <div class="queue-context-row">
                                                                                        <div class="source-context-copy">
                                                                                                {#if article.source_url}
                                                                                                        <span class="source-context">
                                                                                                                Source context: {formatSourceHost(article.source_url)}
                                                                                                        </span>
                                                                                                {:else}
                                                                                                        <span class="source-context">Source context unavailable</span>
                                                                                                {/if}
                                                                                                {#if formatSourceFreshness(article.source_date)}
                                                                                                        <span class="source-freshness">
                                                                                                                Dated {formatSourceFreshness(article.source_date)}
                                                                                                        </span>
                                                                                                {/if}
                                                                                                {#if sourceFlags.length > 0}
                                                                                                        <div class="source-flag-row">
                                                                                                                {#each sourceFlags as flag}
                                                                                                                        <span class="source-flag">{flag}</span>
                                                                                                                {/each}
                                                                                                        </div>
                                                                                                {/if}
                                                                                                {#if verificationFlags.length > 0}
                                                                                                        <div class="verification-flag-row">
                                                                                                                {#each verificationFlags as flag}
                                                                                                                        <span class="verification-flag">{flag}</span>
                                                                                                                {/each}
                                                                                                        </div>
                                                                                                {/if}
                                                                                        </div>
                                                                                        {#if article.source_url}
                                                                                                <a
                                                                                                        class="source-context-link"
                                                                                                        href={article.source_url}
                                                                                                        target="_blank"
                                                                                                        rel="noreferrer"
                                                                                                >
                                                                                                        Open original source
                                                                                                </a>
                                                                                        {/if}
                                                                                </div>
                                                                        {/if}
                                                                </div>
                                                        {/each}
                                                </div>
                                        </section>
                                {/each}
                        </div>
                {:else}
                        <div class="queue-list">
                                {#each filteredArticles as article, index (article.id)}
                                        {@const sourceFlags = getSourceQualityFlags(article)}
                                        {@const verificationFlags = getVerificationFlags(article)}
                                        <div
                                                class:source-watch-entry={sourceFlags.length > 0}
                                                class:verification-watch-entry={verificationFlags.length > 0}
                                                class="queue-entry"
                                        >
                                                <a
                                                        class:source-watch-card={sourceFlags.length > 0}
                                                        class:verification-watch-card={verificationFlags.length > 0}
                                                        class="queue-card"
                                                        href={resolve('/admin/[id]', { id: article.id })}
                                                >
                                                        <div class="queue-index">
                                                                <span class="index-label">Queue</span>
                                                                <strong>{String(index + 1).padStart(2, '0')}</strong>
                                                        </div>

                                                        <div class="queue-main">
                                                                <div class="card-topline">
                                                                        <p class="category">{formatLabel(article.category)}</p>
                                                                        <div class="card-chips">
                                                                                {#if sourceFlags.length > 0}
                                                                                        <span class="chip source-watch-chip">
                                                                                                {getSourceWatchLabel(sourceFlags.length)}
                                                                                        </span>
                                                                                {/if}
                                                                                {#if verificationFlags.length > 0}
                                                                                        <span class="chip verification-watch-chip">
                                                                                                {getVerificationWatchLabel(verificationFlags.length)}
                                                                                        </span>
                                                                                {/if}
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

                                                {#if article.source_url || sourceFlags.length > 0}
                                                        <div class="queue-context-row">
                                                                <div class="source-context-copy">
                                                                        {#if article.source_url}
                                                                                <span class="source-context">
                                                                                        Source context: {formatSourceHost(article.source_url)}
                                                                                </span>
                                                                        {:else}
                                                                                <span class="source-context">Source context unavailable</span>
                                                                        {/if}
                                                                        {#if formatSourceFreshness(article.source_date)}
                                                                                <span class="source-freshness">
                                                                                        Dated {formatSourceFreshness(article.source_date)}
                                                                                </span>
                                                                        {/if}
                                                                        {#if sourceFlags.length > 0}
                                                                                <div class="source-flag-row">
                                                                                        {#each sourceFlags as flag}
                                                                                                <span class="source-flag">{flag}</span>
                                                                                        {/each}
                                                                                </div>
                                                                        {/if}
                                                                        {#if verificationFlags.length > 0}
                                                                                <div class="verification-flag-row">
                                                                                        {#each verificationFlags as flag}
                                                                                                <span class="verification-flag">{flag}</span>
                                                                                        {/each}
                                                                                </div>
                                                                        {/if}
                                                                </div>
                                                                {#if article.source_url}
                                                                        <a
                                                                                class="source-context-link"
                                                                                href={article.source_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                        >
                                                                                Open original source
                                                                        </a>
                                                                {/if}
                                                        </div>
                                                {/if}
                                        </div>
                                {/each}
                        </div>
                {/if}
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
        .progress-panel,
        .resume-panel,
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
        .progress-panel,
        .resume-panel,
        .priority-panel,
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

        .progress-panel,
        .progress-copy,
        .progress-legend {
                display: grid;
                gap: 0.8rem;
        }

        .risk-summary-panel,
        .risk-summary-grid {
                display: grid;
                gap: 0.9rem;
        }

        .risk-summary-panel {
                padding: 1.2rem 1.3rem;
                border: 1px solid #dbe4f0;
                border-radius: 1.2rem;
                background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.97)),
                        #ffffff;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
        }

        .risk-summary-copy {
                display: grid;
                gap: 0.38rem;
        }

        .risk-summary-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .risk-summary-card {
                display: grid;
                gap: 0.35rem;
                padding: 1rem;
                border-radius: 1rem;
                border: 1px solid #dbe4f0;
                background: rgba(255, 255, 255, 0.92);
        }

        .risk-summary-card strong {
                font-size: 1.45rem;
                line-height: 1.05;
                color: #0f172a;
        }

        .risk-summary-card span {
                color: #475569;
                line-height: 1.55;
        }

        .source-risk-card {
                border-color: #fdba74;
                background: linear-gradient(180deg, rgba(255, 247, 237, 0.92), rgba(255, 255, 255, 0.98));
        }

        .verification-risk-card {
                border-color: #93c5fd;
                background: linear-gradient(180deg, rgba(239, 246, 255, 0.92), rgba(255, 255, 255, 0.98));
        }

        .overlap-risk-card {
                border-color: #c4b5fd;
                background: linear-gradient(180deg, rgba(245, 243, 255, 0.92), rgba(255, 255, 255, 0.98));
        }

        .resume-panel {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                border-color: #cbd5e1;
                background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.99), rgba(239, 246, 255, 0.95)),
                        #ffffff;
        }

        .priority-panel {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                border-color: rgba(99, 102, 241, 0.24);
                background:
                        linear-gradient(135deg, rgba(238, 242, 255, 0.98), rgba(255, 255, 255, 0.98)),
                        #ffffff;
        }

        .resume-copy {
                display: grid;
                gap: 0.4rem;
        }

        .priority-copy {
                display: grid;
                gap: 0.45rem;
        }

        .priority-actions {
                display: grid;
                gap: 0.6rem;
                justify-items: end;
        }

        .priority-reason {
                color: #334155;
                line-height: 1.6;
        }

        .priority-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 0.55rem 0.85rem;
                color: #475569;
                font-size: 0.88rem;
                font-weight: 700;
        }

        .priority-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 13rem;
                border-radius: 999px;
                background: #312e81;
                color: #eef2ff;
                padding: 0.85rem 1.15rem;
                font-weight: 800;
                text-decoration: none;
                transition:
                        transform 160ms ease,
                        box-shadow 160ms ease,
                        background 160ms ease;
                box-shadow: 0 16px 32px rgba(49, 46, 129, 0.18);
        }

        .priority-link:hover {
                transform: translateY(-1px);
                background: #3730a3;
                box-shadow: 0 18px 36px rgba(49, 46, 129, 0.22);
        }

        .priority-source-link {
                color: #3730a3;
                font-size: 0.9rem;
                font-weight: 700;
                text-decoration: none;
        }

        .priority-source-link:hover {
                text-decoration: underline;
        }

        .resume-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 10rem;
                border-radius: 999px;
                background: #0f172a;
                color: #f8fafc;
                padding: 0.85rem 1.15rem;
                font-weight: 800;
                text-decoration: none;
                transition:
                        transform 160ms ease,
                        box-shadow 160ms ease;
                box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
        }

        .resume-link:hover {
                transform: translateY(-1px);
                box-shadow: 0 18px 34px rgba(15, 23, 42, 0.18);
        }

        .progress-track {
                display: flex;
                overflow: hidden;
                min-height: 0.8rem;
                border-radius: 999px;
                background: #e2e8f0;
        }

        .progress-segment {
                display: block;
                height: 0.8rem;
        }

        .published-segment,
        .published-dot {
                background: #0f766e;
        }

        .rejected-segment,
        .rejected-dot {
                background: #b45309;
        }

        .pending-segment,
        .pending-dot {
                background: #6366f1;
        }

        .progress-legend {
                grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
                color: #475569;
                font-size: 0.9rem;
                font-weight: 600;
        }

        .progress-legend span {
                display: inline-flex;
                align-items: center;
                gap: 0.55rem;
        }

        .legend-dot {
                display: inline-flex;
                width: 0.7rem;
                height: 0.7rem;
                border-radius: 999px;
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
                gap: 0.72rem;
        }

        .queue-entry {
                display: grid;
                gap: 0.35rem;
        }

        .source-watch-entry {
                position: relative;
        }

        .verification-watch-entry {
                position: relative;
        }

        .triage-board,
        .triage-copy {
                display: grid;
                gap: 1rem;
        }

        .triage-section {
                display: grid;
                gap: 0.9rem;
        }

        .triage-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 0 0.15rem;
        }

        .triage-count {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 3.1rem;
                height: 3.1rem;
                border-radius: 999px;
                background: #0f172a;
                color: #f8fafc;
                font-size: 1rem;
                font-weight: 800;
                letter-spacing: 0.04em;
        }

        .queue-card {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                gap: 0.8rem;
                align-items: stretch;
                padding: 0.88rem 0.92rem;
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

        .queue-card.source-watch-card {
                border-color: #fdba74;
                background:
                        linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(255, 255, 255, 0.97)),
                        #ffffff;
                box-shadow: 0 18px 42px rgba(154, 52, 18, 0.08);
        }

        .queue-card.source-watch-card:hover {
                border-color: #fb923c;
                box-shadow: 0 22px 48px rgba(154, 52, 18, 0.12);
        }

        .queue-card.verification-watch-card {
                border-color: #93c5fd;
                background:
                        linear-gradient(180deg, rgba(239, 246, 255, 0.94), rgba(255, 255, 255, 0.97)),
                        #ffffff;
                box-shadow: 0 18px 42px rgba(37, 99, 235, 0.08);
        }

        .queue-card.verification-watch-card:hover {
                border-color: #60a5fa;
                box-shadow: 0 22px 48px rgba(37, 99, 235, 0.12);
        }

        .queue-index {
                display: grid;
                align-content: space-between;
                min-width: 4.15rem;
                padding: 0.72rem 0.68rem;
                border-radius: 0.95rem;
                background: linear-gradient(180deg, #f8fafc, #eef2f7);
                color: #0f172a;
                text-align: center;
        }

        .queue-index strong {
                font-size: 1.28rem;
                line-height: 1;
        }

        .queue-main {
                display: grid;
                gap: 0.58rem;
                min-width: 0;
        }

        .card-topline {
                display: flex;
                gap: 0.6rem;
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
                padding: 0.32rem 0.64rem;
                font-size: 0.72rem;
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

        .source-watch-chip {
                background: #fff7ed;
                color: #9a3412;
        }

        .verification-watch-chip {
                background: #eff6ff;
                color: #1d4ed8;
        }

        .title-block {
                display: grid;
                gap: 0.18rem;
        }

        h3 {
                color: #0f172a;
                font-size: 1.04rem;
                line-height: 1.24;
                line-clamp: 2;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                overflow: hidden;
        }

        .subtitle,
        .story-summary {
                color: #475569;
        }

        .subtitle {
                font-size: 0.9rem;
                line-height: 1.4;
                line-clamp: 1;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 1;
                overflow: hidden;
        }

        .story-summary {
                font-size: 0.93rem;
                line-height: 1.5;
                line-clamp: 2;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                overflow: hidden;
        }

        .meta-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.58rem;
        }

        .meta-block {
                display: grid;
                gap: 0.18rem;
                padding-top: 0.58rem;
                border-top: 1px solid rgba(148, 163, 184, 0.18);
                min-width: 0;
        }

        .meta-block strong {
                color: #0f172a;
                font-size: 0.88rem;
                overflow-wrap: anywhere;
        }

        .queue-side {
                display: grid;
                align-content: start;
                justify-items: end;
                gap: 0.72rem;
                min-width: 8.35rem;
        }

        .priority-badge {
                background: #fef3c7;
                color: #92400e;
        }

        .open-cta {
                background: #0f172a;
                color: #f8fafc;
                min-width: 7.2rem;
        }

        .queue-context-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.8rem;
                padding: 0 0.3rem 0 0.4rem;
                color: #64748b;
                font-size: 0.85rem;
        }

        .source-context {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
        }

        .source-context-copy {
                display: grid;
                gap: 0.2rem;
                min-width: 0;
        }

        .source-freshness {
                color: #94a3b8;
                font-size: 0.78rem;
                font-weight: 700;
        }

        .source-flag-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
        }

        .source-flag {
                display: inline-flex;
                align-items: center;
                border-radius: 999px;
                padding: 0.22rem 0.55rem;
                background: #fff7ed;
                color: #9a3412;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 0.03em;
                text-transform: uppercase;
        }

        .verification-flag-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
        }

        .verification-flag {
                display: inline-flex;
                align-items: center;
                border-radius: 999px;
                padding: 0.22rem 0.55rem;
                background: #eff6ff;
                color: #1d4ed8;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 0.03em;
                text-transform: uppercase;
        }

        .source-context-link {
                flex-shrink: 0;
                color: #334155;
                font-weight: 700;
                text-decoration: none;
        }

        .source-context-link:hover {
                text-decoration: underline;
        }

        @media (max-width: 1024px) {
                .board-overview,
                .risk-summary-grid {
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

                .queue-context-row,
                .priority-actions {
                        align-items: flex-start;
                        justify-items: stretch;
                }

                .open-cta {
                        min-width: 0;
                }
        }

        @media (max-width: 640px) {
                .board-overview,
                .risk-summary-grid,
                .meta-grid {
                        grid-template-columns: 1fr;
                }

                .resume-panel {
                        flex-direction: column;
                        align-items: stretch;
                }

                .priority-panel {
                        flex-direction: column;
                        align-items: stretch;
                }

                .queue-context-row {
                        flex-direction: column;
                        align-items: flex-start;
                        padding-inline: 0;
                }

                .triage-header {
                        align-items: flex-start;
                        flex-direction: column;
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
