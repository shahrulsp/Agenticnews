<script lang="ts">
        import { resolve } from '$app/paths';
        import type { Article } from '$lib/types';
        import { onMount } from 'svelte';
        import type { PageData } from './$types';

        const LAST_OPENED_DRAFT_KEY = 'agenticnews:last-opened-draft';

        let { data }: { data: PageData } = $props();

        let activeSection = $state<'overview' | 'drafts' | 'published'>('overview');
        let draftFilter = $state<'all' | string>('all');
        let publishedFilter = $state<'all' | string>('all');
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

        function formatCompactDate(value: string | null): string {
                if (!value) {
                        return 'Not set';
                }

                return new Intl.DateTimeFormat('en-MY', {
                        dateStyle: 'medium'
                }).format(new Date(value));
        }

        function stripHtml(value: string | null): string {
                if (!value) {
                        return '';
                }

                return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function summarizeArticle(article: Article): string {
                const plainText = stripHtml(article.body_ms || article.body_en);
                return plainText.length > 150 ? `${plainText.slice(0, 147)}...` : plainText;
        }

        function summarizeStudioText(
                value: string | null | undefined,
                fallback: string,
                maxLength = 100
        ): string {
                const plainText = stripHtml(value ?? null);

                if (!plainText) {
                        return fallback;
                }

                return plainText.length > maxLength ? `${plainText.slice(0, maxLength - 3)}...` : plainText;
        }

        function getStudioFlags(article: Article): Array<{ label: string; tone: 'warn-tag' | 'neutral-tag' }> {
                const flags: Array<{ label: string; tone: 'warn-tag' | 'neutral-tag' }> = [];

                if (article.is_sensitive) {
                        flags.push({ label: 'Sensitive', tone: 'warn-tag' });
                }

                if (article.sensitivity_notes) {
                        flags.push({ label: 'Notes', tone: 'neutral-tag' });
                }

                return flags;
        }

        function getSourceQualityFlags(article: Article): string[] {
                const flags: string[] = [];

                if (!article.source_url) {
                        flags.push('Missing URL');
                }

                if (!article.source_name) {
                        flags.push('Missing source');
                }

                if (!article.source_date) {
                        flags.push('Missing date');
                }

                return flags;
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

        function buildDeskBreakdown(articles: Article[]): Array<{ label: string; value: number; tone: string }> {
                const sourceWatch = articles.filter((article) => getSourceQualityFlags(article).length > 0).length;
                const verificationWatch = articles.filter(
                        (article) => getVerificationFlags(article).length > 0
                ).length;
                const crimeLane = articles.filter((article) => article.category === 'crime').length;

                return [
                        { label: 'Urgent watch', value: countHighPriority(articles), tone: 'warm' },
                        { label: 'Crime lane', value: crimeLane, tone: 'rose' },
                        { label: 'Source watch', value: sourceWatch, tone: 'amber' },
                        { label: 'Verification watch', value: verificationWatch, tone: 'blue' }
                ];
        }

        const draftCategoryCounts = $derived(buildCategoryCounts(data.articles));
        const publishedCategoryCounts = $derived(buildCategoryCounts(data.publishedArticles));
        const latestArrival = $derived(data.articles[0]?.created_at ?? null);
        const reviewedCount = $derived((data.batchProgress?.published ?? 0) + (data.batchProgress?.rejected ?? 0));
        const progressPercent = $derived(
                data.batchProgress?.total ? Math.round((reviewedCount / data.batchProgress.total) * 100) : 0
        );
        const draftOverviewCards = $derived([
                {
                        label: 'Pending drafts',
                        value: String(data.articles.length),
                        note: latestArrival ? `Latest arrival ${formatDate(latestArrival)}` : 'Desk is clear',
                        tone: 'neutral'
                },
                {
                        label: 'Published today',
                        value: String(data.batchProgress?.published ?? 0),
                        note: data.batchProgress
                                ? `${progressPercent}% of this morning run reviewed`
                                : 'No tracked morning run yet',
                        tone: 'green'
                },
                {
                        label: 'Live categories',
                        value: String(draftCategoryCounts.length),
                        note: draftCategoryCounts.length > 0 ? 'Category mix across the active desk' : 'No active lanes',
                        tone: 'blue'
                },
                {
                        label: 'Published archive',
                        value: String(data.publishedArticles.length),
                        note: 'Latest published stories ready for quick review',
                        tone: 'violet'
                }
        ]);
        const draftDeskSignals = $derived(buildDeskBreakdown(data.articles));
        const draftFilterOptions = $derived([
                { value: 'all', label: 'All drafts', count: data.articles.length },
                ...draftCategoryCounts
        ]);
        const publishedFilterOptions = $derived([
                { value: 'all', label: 'All published', count: data.publishedArticles.length },
                ...publishedCategoryCounts
        ]);
        const filteredDrafts = $derived(
                draftFilter === 'all' ? data.articles : data.articles.filter((article) => article.category === draftFilter)
        );
        const filteredPublished = $derived(
                publishedFilter === 'all'
                        ? data.publishedArticles
                        : data.publishedArticles.filter((article) => article.category === publishedFilter)
        );
        const resumeArticle = $derived.by(() => {
                const storedDraft = lastOpenedDraft;

                if (!storedDraft) {
                        return null;
                }

                return data.articles.find((article) => article.id === storedDraft.id) ?? null;
        });
        const sidebarMenu = $derived([
                {
                        key: 'overview',
                        label: 'Operations overview',
                        count: data.articles.length + data.publishedArticles.length,
                        helper: 'Pulse, desk stats, and batch view'
                },
                {
                        key: 'drafts',
                        label: 'Draft queue',
                        count: data.articles.length,
                        helper: 'Pending stories waiting for editorial review'
                },
                {
                        key: 'published',
                        label: 'Published desk',
                        count: data.publishedArticles.length,
                        helper: 'Recently published stories and output overview'
                }
        ]);

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

<section class="dashboard-shell">
        <aside class="dashboard-sidebar">
                <div class="sidebar-brand">
                        <p class="eyebrow">Agenticnews</p>
                        <h1>Editorial Ops</h1>
                        <p class="sidebar-copy">
                                A full-width newsroom dashboard for tracking the draft queue, publish flow, and operational signals in one place.
                        </p>
                </div>

                <nav class="sidebar-menu" aria-label="Admin sections">
                        {#each sidebarMenu as item}
                                <button
                                        class:active={activeSection === item.key}
                                        class="menu-item"
                                        type="button"
                                        onclick={() => {
                                                activeSection = item.key as 'overview' | 'drafts' | 'published';
                                        }}
                                >
                                        <div class="menu-copy">
                                                <span class="menu-label">{item.label}</span>
                                                <span class="menu-helper">{item.helper}</span>
                                        </div>
                                        <strong>{item.count}</strong>
                                </button>
                        {/each}
                </nav>

                {#if resumeArticle}
                        <div class="sidebar-panel">
                                <p class="panel-label">Resume review</p>
                                <h2>{resumeArticle.title_ms}</h2>
                                <p>Back in the {formatLabel(resumeArticle.category)} lane. Last touched {formatDate(resumeArticle.updated_at)}.</p>
                                <a class="sidebar-link" href={resolve('/admin/[id]', { id: resumeArticle.id })}>
                                        Continue draft
                                </a>
                        </div>
                {/if}

                {#if data.batchProgress}
                        <div class="sidebar-panel">
                                <p class="panel-label">Morning run</p>
                                <h2>{data.batchProgress.scheduledDate}</h2>
                                <div class="batch-metrics">
                                        <span>Pending {data.batchProgress.pending}</span>
                                        <span>Published {data.batchProgress.published}</span>
                                        <span>Rejected {data.batchProgress.rejected}</span>
                                </div>
                        </div>
                {/if}
        </aside>

        <div class="dashboard-content">
                <header class="content-header">
                        <div class="header-copy">
                                <p class="eyebrow">Admin dashboard</p>
                                <h2>Newsroom operations at a glance</h2>
                                <p>
                                        Track the morning desk, review incoming drafts faster, and keep published output visible without leaving `/admin`.
                                </p>
                        </div>

                        {#if data.reviewStatus}
                                <div class="status-banner success-banner">
                                        <p class="panel-label">Review updated</p>
                                        <strong>
                                                {data.reviewStatus === 'approved'
                                                        ? 'Article approved and moved to published.'
                                                        : 'Article rejected and cleared from the pending desk.'}
                                        </strong>
                                </div>
                        {/if}
                </header>

                {#if !data.databaseReady}
                        <section class="state-card">
                                <p class="panel-label">Database setup needed</p>
                                <h3>Add `NEON_DATABASE_URL` to your local `.env` to load the admin dashboard.</h3>
                        </section>
                {:else if data.databaseError}
                        <section class="state-card error-card">
                                <p class="panel-label">Database connection issue</p>
                                <h3>{data.databaseError}</h3>
                        </section>
                {:else}
                        <section class="stats-grid">
                                {#each draftOverviewCards as card}
                                        <article class={`stats-card tone-${card.tone}`}>
                                                <p class="panel-label">{card.label}</p>
                                                <strong>{card.value}</strong>
                                                <span>{card.note}</span>
                                        </article>
                                {/each}
                        </section>

                        <section class="section-tabs" aria-label="Dashboard sections">
                                {#each sidebarMenu as item}
                                        <button
                                                class:active={activeSection === item.key}
                                                class="section-tab"
                                                type="button"
                                                onclick={() => {
                                                        activeSection = item.key as 'overview' | 'drafts' | 'published';
                                                }}
                                        >
                                                {item.label}
                                        </button>
                                {/each}
                        </section>

                        {#if activeSection === 'overview'}
                                <div class="overview-layout">
                                        <section class="panel-card">
                                                <div class="panel-header">
                                                        <div>
                                                                <p class="panel-label">Desk signals</p>
                                                                <h3>Operational watchlist</h3>
                                                        </div>
                                                        <span class="panel-badge">{data.articles.length} active drafts</span>
                                                </div>

                                                <div class="signal-grid">
                                                        {#each draftDeskSignals as signal}
                                                                <article class={`signal-card tone-${signal.tone}`}>
                                                                        <span>{signal.label}</span>
                                                                        <strong>{signal.value}</strong>
                                                                </article>
                                                        {/each}
                                                </div>
                                        </section>

                                        <section class="panel-card">
                                                <div class="panel-header">
                                                        <div>
                                                                <p class="panel-label">Batch pulse</p>
                                                                <h3>Morning run progress</h3>
                                                        </div>
                                                        <span class="panel-badge">{progressPercent}% reviewed</span>
                                                </div>

                                                {#if data.batchProgress}
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

                                                        <div class="summary-grid">
                                                                <article>
                                                                        <span class="panel-label">Scheduled date</span>
                                                                        <strong>{data.batchProgress.scheduledDate}</strong>
                                                                </article>
                                                                <article>
                                                                        <span class="panel-label">Pending</span>
                                                                        <strong>{data.batchProgress.pending}</strong>
                                                                </article>
                                                                <article>
                                                                        <span class="panel-label">Published</span>
                                                                        <strong>{data.batchProgress.published}</strong>
                                                                </article>
                                                                <article>
                                                                        <span class="panel-label">Rejected</span>
                                                                        <strong>{data.batchProgress.rejected}</strong>
                                                                </article>
                                                        </div>
                                                {:else}
                                                        <p class="empty-copy">No morning batch progress is available yet.</p>
                                                {/if}
                                        </section>
                                </div>

                                <section class="panel-card">
                                        <div class="panel-header">
                                                <div>
                                                        <p class="panel-label">Draft queue snapshot</p>
                                                        <h3>Top pending stories</h3>
                                                </div>
                                                <button
                                                        class="text-link"
                                                        type="button"
                                                        onclick={() => {
                                                                activeSection = 'drafts';
                                                        }}
                                                >
                                                        Open draft queue
                                                </button>
                                        </div>

                                        {#if data.articles.length === 0}
                                                <p class="empty-copy">No pending stories are waiting for review right now.</p>
                                        {:else}
                                                <div class="table-shell">
                                                        <table class="article-table">
                                                                <thead>
                                                                        <tr>
                                                                                <th>Story</th>
                                                                                <th>Category</th>
                                                                                <th>Region</th>
                                                                                <th>Studio</th>
                                                                                <th>Risk</th>
                                                                                <th>Updated</th>
                                                                                <th>Action</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {#each data.articles.slice(0, 6) as article (article.id)}
                                                                                {@const sourceFlags = getSourceQualityFlags(article)}
                                                                                {@const verificationFlags = getVerificationFlags(article)}
                                                                                {@const studioFlags = getStudioFlags(article)}
                                                                                <tr>
                                                                                        <td>
                                                                                                <div class="story-cell">
                                                                                                        <strong>{article.title_ms}</strong>
                                                                                                        <span>{summarizeArticle(article) || 'Open this draft to review the full editorial body.'}</span>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>{formatLabel(article.category)}</td>
                                                                                        <td>{formatLabel(article.region)}</td>
                                                                                        <td>
                                                                                                <div class="stacked-cell">
                                                                                                        <strong>{article.form ? formatLabel(article.form) : 'Studio form pending'}</strong>
                                                                                                        <span>{summarizeStudioText(article.why_viral, 'No viral rationale stored yet.')}</span>
                                                                                                        {#if article.sensitivity_notes}
                                                                                                                <small class="studio-note">
                                                                                                                        {summarizeStudioText(article.sensitivity_notes, '', 72)}
                                                                                                                </small>
                                                                                                        {/if}
                                                                                                        {#if studioFlags.length > 0}
                                                                                                                <div class="tag-row">
                                                                                                                        {#each studioFlags as flag}
                                                                                                                                <span class={`table-tag ${flag.tone}`}>{flag.label}</span>
                                                                                                                        {/each}
                                                                                                                </div>
                                                                                                        {/if}
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>
                                                                                                <div class="tag-row">
                                                                                                        {#if sourceFlags.length > 0}
                                                                                                                <span class="table-tag warn-tag">{sourceFlags.length} source</span>
                                                                                                        {/if}
                                                                                                        {#if verificationFlags.length > 0}
                                                                                                                <span class="table-tag info-tag">{verificationFlags.length} verify</span>
                                                                                                        {/if}
                                                                                                        {#if sourceFlags.length === 0 && verificationFlags.length === 0}
                                                                                                                <span class="table-tag neutral-tag">Clean</span>
                                                                                                        {/if}
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>{formatDate(article.updated_at)}</td>
                                                                                        <td>
                                                                                                <a class="row-link" href={resolve('/admin/[id]', { id: article.id })}>
                                                                                                        Open
                                                                                                </a>
                                                                                        </td>
                                                                                </tr>
                                                                        {/each}
                                                                </tbody>
                                                        </table>
                                                </div>
                                        {/if}
                                </section>
                        {/if}

                        {#if activeSection === 'drafts'}
                                <section class="panel-card">
                                        <div class="panel-header stacked-mobile">
                                                <div>
                                                        <p class="panel-label">Draft queue</p>
                                                        <h3>Pending newsroom rows</h3>
                                                </div>

                                                <div class="filter-group">
                                                        {#each draftFilterOptions as option}
                                                                <button
                                                                        class:active={draftFilter === option.value}
                                                                        class="filter-pill"
                                                                        type="button"
                                                                        onclick={() => {
                                                                                draftFilter = option.value;
                                                                        }}
                                                                >
                                                                        <span>{option.label}</span>
                                                                        <strong>{option.count}</strong>
                                                                </button>
                                                        {/each}
                                                </div>
                                        </div>

                                        {#if filteredDrafts.length === 0}
                                                <p class="empty-copy">No drafts match this filter right now.</p>
                                        {:else}
                                                <div class="table-shell">
                                                        <table class="article-table">
                                                                <thead>
                                                                        <tr>
                                                                                <th>Story</th>
                                                                                <th>Category</th>
                                                                                <th>Source</th>
                                                                                <th>Fact check</th>
                                                                                <th>Studio</th>
                                                                                <th>Priority</th>
                                                                                <th>Updated</th>
                                                                                <th>Action</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {#each filteredDrafts as article (article.id)}
                                                                                {@const sourceFlags = getSourceQualityFlags(article)}
                                                                                {@const verificationFlags = getVerificationFlags(article)}
                                                                                {@const studioFlags = getStudioFlags(article)}
                                                                                <tr>
                                                                                        <td>
                                                                                                <div class="story-cell">
                                                                                                        <strong>{article.title_ms}</strong>
                                                                                                        {#if article.title_en}
                                                                                                                <small>{article.title_en}</small>
                                                                                                        {/if}
                                                                                                        <span>{summarizeArticle(article) || 'Open this draft to review the full editorial body.'}</span>
                                                                                                        <div class="story-meta-row">
                                                                                                                <span>{article.slug}</span>
                                                                                                                <span>{formatLabel(article.region)}</span>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>{formatLabel(article.category)}</td>
                                                                                        <td>
                                                                                                <div class="stacked-cell">
                                                                                                        <strong>{article.source_name ?? 'Source unavailable'}</strong>
                                                                                                        <span>{formatSourceHost(article.source_url)}</span>
                                                                                                        <div class="tag-row">
                                                                                                                {#each sourceFlags as flag}
                                                                                                                        <span class="table-tag warn-tag">{flag}</span>
                                                                                                                {/each}
                                                                                                        </div>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>
                                                                                                <div class="stacked-cell">
                                                                                                        <strong>{formatLabel(article.factcheck_verdict)}</strong>
                                                                                                        <span>{article.factcheck_confidence}% confidence</span>
                                                                                                        <div class="tag-row">
                                                                                                                {#each verificationFlags as flag}
                                                                                                                        <span class="table-tag info-tag">{flag}</span>
                                                                                                                {/each}
                                                                                                        </div>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>
                                                                                                <div class="stacked-cell">
                                                                                                        <strong>{article.form ? formatLabel(article.form) : 'Studio form pending'}</strong>
                                                                                                        <span>{summarizeStudioText(article.why_viral, 'No viral rationale stored yet.')}</span>
                                                                                                        {#if article.sensitivity_notes}
                                                                                                                <small class="studio-note">
                                                                                                                        {summarizeStudioText(article.sensitivity_notes, '', 72)}
                                                                                                                </small>
                                                                                                        {/if}
                                                                                                        {#if studioFlags.length > 0}
                                                                                                                <div class="tag-row">
                                                                                                                        {#each studioFlags as flag}
                                                                                                                                <span class={`table-tag ${flag.tone}`}>{flag.label}</span>
                                                                                                                        {/each}
                                                                                                                </div>
                                                                                                        {/if}
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>{formatLabel(article.hype_level)}</td>
                                                                                        <td>{formatDate(article.updated_at)}</td>
                                                                                        <td>
                                                                                                <a class="row-link" href={resolve('/admin/[id]', { id: article.id })}>
                                                                                                        Review
                                                                                                </a>
                                                                                        </td>
                                                                                </tr>
                                                                        {/each}
                                                                </tbody>
                                                        </table>
                                                </div>
                                        {/if}
                                </section>
                        {/if}

                        {#if activeSection === 'published'}
                                <section class="panel-card">
                                        <div class="panel-header stacked-mobile">
                                                <div>
                                                        <p class="panel-label">Published desk</p>
                                                        <h3>Recently published articles</h3>
                                                </div>

                                                <div class="filter-group">
                                                        {#each publishedFilterOptions as option}
                                                                <button
                                                                        class:active={publishedFilter === option.value}
                                                                        class="filter-pill"
                                                                        type="button"
                                                                        onclick={() => {
                                                                                publishedFilter = option.value;
                                                                        }}
                                                                >
                                                                        <span>{option.label}</span>
                                                                        <strong>{option.count}</strong>
                                                                </button>
                                                        {/each}
                                                </div>
                                        </div>

                                        {#if filteredPublished.length === 0}
                                                <p class="empty-copy">No published articles match this filter right now.</p>
                                        {:else}
                                                <div class="table-shell">
                                                        <table class="article-table">
                                                                <thead>
                                                                        <tr>
                                                                                <th>Story</th>
                                                                                <th>Category</th>
                                                                                <th>Published</th>
                                                                                <th>Source</th>
                                                                                <th>Verdict</th>
                                                                                <th>Article</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {#each filteredPublished as article (article.id)}
                                                                                <tr>
                                                                                        <td>
                                                                                                <div class="story-cell">
                                                                                                        <strong>{article.title_ms}</strong>
                                                                                                        {#if article.title_en}
                                                                                                                <small>{article.title_en}</small>
                                                                                                        {/if}
                                                                                                        <span>{summarizeArticle(article) || 'Published article overview unavailable.'}</span>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>{formatLabel(article.category)}</td>
                                                                                        <td>{formatCompactDate(article.published_at ?? article.created_at)}</td>
                                                                                        <td>
                                                                                                <div class="stacked-cell">
                                                                                                        <strong>{article.source_name ?? 'Source unavailable'}</strong>
                                                                                                        <span>{formatSourceHost(article.source_url)}</span>
                                                                                                </div>
                                                                                        </td>
                                                                                        <td>
                                                                                                <span class="table-tag neutral-tag">{formatLabel(article.factcheck_verdict)}</span>
                                                                                        </td>
                                                                                        <td>
                                                                                                <a class="row-link" href={resolve(`/article/${article.slug}`)}>
                                                                                                        Open
                                                                                                </a>
                                                                                        </td>
                                                                                </tr>
                                                                        {/each}
                                                                </tbody>
                                                        </table>
                                                </div>
                                        {/if}
                                </section>
                        {/if}
                {/if}
        </div>
</section>

<style>
        :global(body) {
                background:
                        radial-gradient(circle at top left, rgba(167, 243, 208, 0.18), transparent 28%),
                        radial-gradient(circle at top right, rgba(125, 211, 252, 0.14), transparent 24%),
                        linear-gradient(180deg, #f4f7fb 0%, #edf2f7 100%);
        }

        .dashboard-shell {
                display: grid;
                grid-template-columns: minmax(250px, 290px) minmax(0, 1fr);
                min-height: calc(100vh - 7rem);
                width: 100%;
                min-width: 0;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 1.75rem;
                overflow: hidden;
                background: rgba(255, 255, 255, 0.76);
                box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
                backdrop-filter: blur(18px);
        }

        .dashboard-sidebar {
                display: grid;
                align-content: start;
                gap: 1.25rem;
                padding: 1.5rem;
                background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
                color: #e2e8f0;
        }

        .sidebar-brand,
        .sidebar-panel,
        .menu-item,
        .panel-card,
        .state-card,
        .stats-card,
        .status-banner,
        .signal-card {
                border-radius: 1.25rem;
        }

        .sidebar-brand,
        .sidebar-panel {
                display: grid;
                gap: 0.55rem;
                padding: 1.15rem;
                background: rgba(15, 23, 42, 0.52);
                border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .sidebar-copy,
        .sidebar-panel p,
        .menu-helper {
                color: rgba(226, 232, 240, 0.78);
                line-height: 1.6;
        }

        .sidebar-menu {
                display: grid;
                gap: 0.7rem;
        }

        .menu-item {
                display: flex;
                justify-content: space-between;
                gap: 0.8rem;
                align-items: flex-start;
                width: 100%;
                padding: 0.95rem 1rem;
                border: 1px solid rgba(148, 163, 184, 0.16);
                background: rgba(15, 23, 42, 0.28);
                color: #f8fafc;
                text-align: left;
                cursor: pointer;
                transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
        }

        .menu-item:hover,
        .menu-item.active {
                transform: translateX(4px);
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.94), rgba(15, 23, 42, 0.98));
                border-color: rgba(125, 211, 252, 0.38);
        }

        .menu-copy {
                display: grid;
                gap: 0.28rem;
        }

        .menu-label {
                font-weight: 700;
                letter-spacing: 0.01em;
        }

        .sidebar-link,
        .row-link,
        .text-link {
                color: #0f766e;
                font-weight: 700;
                text-decoration: none;
        }

        .sidebar-link {
                color: #7dd3fc;
        }

        .batch-metrics {
                display: flex;
                flex-wrap: wrap;
                gap: 0.6rem;
                font-size: 0.92rem;
                color: #cbd5e1;
        }

        .dashboard-content {
                display: grid;
                gap: 1.15rem;
                padding: 1.4rem;
                min-width: 0;
        }

        .content-header {
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                align-items: flex-start;
        }

        .header-copy {
                display: grid;
                gap: 0.45rem;
        }

        .eyebrow,
        .panel-label {
                margin: 0;
                font-size: 0.76rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #64748b;
        }

        h1,
        h2,
        h3,
        p,
        strong,
        span,
        small {
                margin: 0;
        }

        h1,
        h2,
        h3 {
                color: #0f172a;
                line-height: 1.05;
        }

        .dashboard-sidebar h1,
        .dashboard-sidebar h2 {
                color: #f8fafc;
        }

        .content-header h2 {
                font-size: clamp(2rem, 3.4vw, 3rem);
                text-wrap: balance;
        }

        .content-header p:last-child {
                color: #475569;
                max-width: 56rem;
                line-height: 1.7;
        }

        .status-banner,
        .state-card,
        .panel-card,
        .stats-card {
                border: 1px solid rgba(148, 163, 184, 0.2);
                background: rgba(255, 255, 255, 0.88);
                box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
        }

        .status-banner,
        .state-card,
        .panel-card {
                padding: 1.2rem;
        }

        .success-banner {
                min-width: 18rem;
                background: linear-gradient(180deg, rgba(240, 253, 244, 0.94), rgba(255, 255, 255, 0.94));
                border-color: rgba(74, 222, 128, 0.35);
        }

        .error-card {
                border-color: rgba(248, 113, 113, 0.35);
                background: linear-gradient(180deg, rgba(254, 242, 242, 0.96), rgba(255, 255, 255, 0.94));
        }

        .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 1rem;
        }

        .stats-card {
                display: grid;
                gap: 0.45rem;
                padding: 1.15rem;
        }

        .stats-card strong,
        .signal-card strong {
                font-size: clamp(1.8rem, 2.4vw, 2.3rem);
                line-height: 1;
                color: #0f172a;
        }

        .stats-card span,
        .signal-card span,
        .empty-copy {
                color: #475569;
                line-height: 1.6;
        }

        .tone-green {
                background: linear-gradient(180deg, rgba(236, 253, 245, 0.98), rgba(255, 255, 255, 0.95));
        }

        .tone-blue {
                background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(255, 255, 255, 0.95));
        }

        .tone-violet {
                background: linear-gradient(180deg, rgba(245, 243, 255, 0.98), rgba(255, 255, 255, 0.95));
        }

        .tone-warm {
                background: linear-gradient(180deg, rgba(255, 247, 237, 0.98), rgba(255, 255, 255, 0.95));
        }

        .tone-rose {
                background: linear-gradient(180deg, rgba(255, 241, 242, 0.98), rgba(255, 255, 255, 0.95));
        }

        .tone-amber {
                background: linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(255, 255, 255, 0.95));
        }

        .section-tabs {
                display: none;
                gap: 0.7rem;
                flex-wrap: wrap;
        }

        .section-tab,
        .filter-pill,
        .text-link {
                border: 1px solid rgba(148, 163, 184, 0.24);
                background: rgba(255, 255, 255, 0.78);
                cursor: pointer;
        }

        .section-tab,
        .filter-pill {
                padding: 0.75rem 0.95rem;
                border-radius: 999px;
                color: #334155;
                font-weight: 700;
                transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
        }

        .section-tab.active,
        .filter-pill.active {
                background: #0f172a;
                border-color: #0f172a;
                color: #f8fafc;
        }

        .overview-layout {
                display: grid;
                grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
                gap: 1rem;
        }

        .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 1rem;
                margin-bottom: 1rem;
        }

        .panel-card {
                min-width: 0;
        }

        .panel-badge {
                padding: 0.45rem 0.75rem;
                border-radius: 999px;
                background: rgba(15, 23, 42, 0.06);
                color: #334155;
                font-size: 0.88rem;
                font-weight: 700;
        }

        .signal-grid,
        .summary-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.8rem;
        }

        .signal-card {
                display: grid;
                gap: 0.35rem;
                padding: 1rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .progress-track {
                display: flex;
                gap: 0.35rem;
                width: 100%;
                height: 0.95rem;
                margin-bottom: 1rem;
        }

        .progress-segment {
                border-radius: 999px;
        }

        .published-segment {
                background: linear-gradient(90deg, #14b8a6, #34d399);
        }

        .rejected-segment {
                background: linear-gradient(90deg, #f97316, #fb7185);
        }

        .pending-segment {
                background: linear-gradient(90deg, #cbd5e1, #94a3b8);
        }

        .summary-grid article {
                display: grid;
                gap: 0.25rem;
                padding: 0.9rem;
                border-radius: 1rem;
                background: rgba(248, 250, 252, 0.88);
                border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .summary-grid strong {
                font-size: 1.25rem;
        }

        .filter-group,
        .tag-row,
        .story-meta-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
        }

        .table-shell {
                overflow-x: auto;
                max-width: 100%;
        }

        .article-table {
                width: 100%;
                border-collapse: collapse;
                min-width: 1120px;
        }

        .article-table th,
        .article-table td {
                padding: 0.95rem 0.9rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.9);
                vertical-align: top;
                text-align: left;
        }

        .article-table th {
                font-size: 0.76rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748b;
        }

        .story-cell,
        .stacked-cell {
                display: grid;
                gap: 0.32rem;
        }

        .story-cell strong,
        .stacked-cell strong {
                color: #0f172a;
                font-size: 0.98rem;
        }

        .story-cell span,
        .stacked-cell span,
        .story-cell small,
        .story-meta-row {
                color: #475569;
                line-height: 1.55;
        }

        .story-cell small {
                font-size: 0.88rem;
        }

        .studio-note {
                font-size: 0.82rem;
        }

        .story-meta-row {
                font-size: 0.82rem;
        }

        .table-tag {
                display: inline-flex;
                align-items: center;
                padding: 0.28rem 0.55rem;
                border-radius: 999px;
                font-size: 0.75rem;
                font-weight: 700;
        }

        .warn-tag {
                background: rgba(255, 237, 213, 0.95);
                color: #9a3412;
        }

        .info-tag {
                background: rgba(224, 242, 254, 0.95);
                color: #075985;
        }

        .neutral-tag {
                background: rgba(226, 232, 240, 0.95);
                color: #334155;
        }

        @media (max-width: 1180px) {
                .dashboard-shell {
                        grid-template-columns: 1fr;
                }

                .dashboard-sidebar {
                        display: none;
                }

                .section-tabs {
                        display: flex;
                }

                .stats-grid,
                .overview-layout {
                        grid-template-columns: 1fr 1fr;
                }
        }

        @media (max-width: 800px) {
                .dashboard-content {
                        padding: 1rem;
                }

                .content-header,
                .panel-header.stacked-mobile,
                .panel-header {
                        grid-template-columns: 1fr;
                        display: grid;
                }

                .stats-grid,
                .overview-layout,
                .signal-grid,
                .summary-grid {
                        grid-template-columns: 1fr;
                }

                .article-table {
                        min-width: 760px;
                }
        }
</style>
