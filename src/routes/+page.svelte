<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeArticle } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const localeLinks = {
		ms: resolve('/?lang=ms'),
		en: resolve('/?lang=en')
	};

	function getFeaturedArticle() {
		return data.articles[0] ?? null;
	}

        function formatDate(value: string | null, locale: 'ms' | 'en'): string {
		if (!value) {
                        return locale === 'ms' ? 'Masa tidak diketahui' : 'Unknown time';
		}

                return new Intl.DateTimeFormat(locale === 'ms' ? 'ms-MY' : 'en-MY', {
                        dateStyle: 'medium'
                }).format(new Date(value));
	}

	function formatLabel(value: string): string {
		return value
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function getImageAlt(
		imageAlt: string | null | undefined,
		fallbackTitle: string | null | undefined
	): string {
		return imageAlt?.trim() || fallbackTitle?.trim() || 'Article image';
	}

        function getUnknownSource(locale: 'ms' | 'en'): string {
                return locale === 'ms' ? 'Sumber tidak dinyatakan' : 'Unknown source';
        }
</script>

<svelte:head>
	<title>Agenticnews</title>
</svelte:head>

<section class="hero">
	<div class="hero-copy">
                <p class="eyebrow">{data.locale === 'ms' ? 'Meja editorial langsung' : 'Live editorial desk'}</p>
		<h1>
			{data.locale === 'ms'
                                ? 'Liputan AI yang disemak manusia, diterbitkan terus dari meja editorial.'
                                : 'AI reporting reviewed by humans, published straight from the editorial desk.'}
		</h1>
		<p>
			{#if data.articles.length > 0 && getFeaturedArticle()}
				{data.locale === 'ms'
                                        ? `${data.articles.length} artikel telah diterbitkan setakat ini. Liputan terbaharu: ${localizeArticle(getFeaturedArticle(), data.locale).title}.`
                                        : `${data.articles.length} vetted stor${data.articles.length === 1 ? 'y' : 'ies'} published so far. Latest on the desk: ${localizeArticle(getFeaturedArticle(), data.locale).title}.`}
			{:else if data.locale === 'ms'}
                                Halaman ini menghimpunkan laporan yang telah melepasi semakan editorial dan diterbitkan
                                secara langsung
                                dari aliran kerja newsroom.
			{:else}
                                This page brings together stories that have cleared editorial review and gone live from
                                the newsroom workflow.
			{/if}
		</p>
	</div>

	<div class="actions">
		<div class="locale-switch">
			<a class:active={data.locale === 'ms'} href={localeLinks.ms}>BM</a>
			<a class:active={data.locale === 'en'} href={localeLinks.en}>EN</a>
		</div>
	</div>

	{#if data.articles.length > 0 && getFeaturedArticle()}
		{@const featuredArticle = getFeaturedArticle()}
		<div class="hero-spotlight">
			{#if featuredArticle?.image_url}
				<a
					class="spotlight-image-link"
					href={resolve(`/article/${featuredArticle.slug}?lang=${data.locale}`)}
				>
					<img
						class="spotlight-image"
						src={featuredArticle.image_url}
						alt={getImageAlt(
							featuredArticle.image_alt,
							localizeArticle(featuredArticle, data.locale).title
						)}
						loading="eager"
					/>
				</a>
			{/if}

			<div class="spotlight-content">
				<div class="spotlight-copy">
					<p class="spotlight-label">
                                                {data.locale === 'ms' ? 'Pilihan editor' : "Editor's pick"}
					</p>
					<h2>{localizeArticle(featuredArticle, data.locale).title}</h2>
					<p class="spotlight-summary">
						{localizeArticle(featuredArticle, data.locale).takeaway ??
							(data.locale === 'ms'
                                                                ? `Diringkaskan daripada laporan ${featuredArticle.source_name ?? 'sumber yang disahkan'}.`
                                                                : `Distilled from reporting by ${featuredArticle.source_name ?? 'a verified source'}.`)}
					</p>
					<div class="spotlight-meta">
                                                <span class="spotlight-meta-pill spotlight-meta-pill-primary">
                                                        {formatLabel(featuredArticle.category)}
                                                </span>
                                                <span class="spotlight-meta-pill">
                                                        {formatDate(
                                                                featuredArticle.published_at ?? featuredArticle.created_at,
                                                                data.locale
                                                        )}
                                                </span>
                                                <span class="spotlight-meta-pill spotlight-meta-pill-muted">
                                                        {featuredArticle.source_name ?? getUnknownSource(data.locale)}
                                                </span>
					</div>
					<a
						class="spotlight-cta"
						href={resolve(`/article/${featuredArticle.slug}?lang=${data.locale}`)}
					>
                                                {data.locale === 'ms' ? 'Baca liputan penuh' : 'Read full report'}
					</a>
				</div>

				<div class="hero-stats">
					<article class="stat-card">
                                                <span>{data.locale === 'ms' ? 'Jumlah diterbitkan' : 'Published so far'}</span>
						<strong>{data.articles.length}</strong>
					</article>
					<article class="stat-card">
                                                <span>{data.locale === 'ms' ? 'Topik semasa' : 'Current desk'}</span>
						<strong>{formatLabel(featuredArticle?.category ?? 'unknown')}</strong>
					</article>
					<article class="stat-card">
                                                <span>{data.locale === 'ms' ? 'Sumber utama' : 'Reporting source'}</span>
                                                <strong>{featuredArticle?.source_name ?? getUnknownSource(data.locale)}</strong>
					</article>
				</div>
			</div>
		</div>
	{/if}
</section>

{#if !data.databaseReady}
	<section class="message-card">
                <p class="card-label">{data.locale === 'ms' ? 'Tetapan pangkalan data diperlukan' : 'Database setup needed'}</p>
		<p class="card-value">
                        {data.locale === 'ms'
                                ? 'Tambahkan `NEON_DATABASE_URL` ke fail `.env` tempatan untuk memuatkan artikel yang telah diterbitkan.'
                                : 'Add `NEON_DATABASE_URL` to your local `.env` to load published articles.'}
		</p>
	</section>
{:else if data.databaseError}
	<section class="message-card error-card">
                <p class="card-label">{data.locale === 'ms' ? 'Masalah sambungan pangkalan data' : 'Database connection issue'}</p>
		<p class="card-value">{data.databaseError}</p>
	</section>
{:else if data.articles.length === 0}
	<section class="message-card">
                <p class="card-label">{data.locale === 'ms' ? 'Belum ada artikel diterbitkan' : 'Nothing published yet'}</p>
		<p class="card-value">
			{data.locale === 'ms'
				? 'Luluskan artikel pertama anda dalam admin untuk melihatnya di sini.'
				: 'Approve your first article in the admin to see it here.'}
		</p>
	</section>
{:else}
	<section class="article-grid">
		{#each data.articles as article (article.id)}
			{@const view = localizeArticle(article, data.locale)}
			<a class="article-card" href={resolve(`/article/${article.slug}?lang=${data.locale}`)}>
				{#if article.image_url}
					<div class="article-image-frame">
						<img
							class="article-image"
							src={article.image_url}
							alt={getImageAlt(article.image_alt, view.title)}
							loading="lazy"
						/>
					</div>
				{/if}
				<div class="article-card-topline">
					<p class="article-meta">
						<span class="meta-chip">{formatLabel(article.category)}</span>
                                                <span class="article-date">
                                                        {formatDate(article.published_at ?? article.created_at, data.locale)}
                                                </span>
					</p>
					<span class="verdict-pill">{formatLabel(article.factcheck_verdict)}</span>
				</div>
                                <h2 class="article-title">{view.title}</h2>
				{#if view.takeaway}
					<p class="summary">{view.takeaway}</p>
				{:else if article.source_name}
					<p class="summary">
						{data.locale === 'ms'
                                                        ? `Diringkaskan daripada laporan ${article.source_name}.`
                                                        : `Distilled from reporting by ${article.source_name}.`}
					</p>
				{/if}
				<div class="article-footer">
					<div class="footer-block">
						<span class="footer-label">{data.locale === 'ms' ? 'Sumber' : 'Source'}</span>
                                                <strong>{article.source_name ?? getUnknownSource(data.locale)}</strong>
					</div>
					<div class="footer-block footer-block-end">
						<span class="footer-label">{data.locale === 'ms' ? 'Tahap gembar' : 'Hype level'}</span>
						<strong>{formatLabel(article.hype_level)}</strong>
					</div>
				</div>
			</a>
		{/each}
	</section>
{/if}

<style>
	.hero,
	.message-card,
	.article-grid {
		max-width: 72rem;
		margin: 0 auto;
		padding: 2rem;
	}

	.hero {
		display: grid;
		gap: 1.5rem;
		padding-top: 4rem;
                padding-bottom: 0.75rem;
	}

	.hero-copy {
		display: grid;
		gap: 1rem;
		max-width: 44rem;
	}

	p,
	h1,
	h2 {
		margin: 0;
	}

	.eyebrow,
	.card-label {
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
	}

	h1 {
		font-size: clamp(2.5rem, 5vw, 4rem);
		line-height: 1.05;
		color: #0f172a;
	}

	.hero-copy > p:not(.eyebrow) {
		font-size: 1.05rem;
		line-height: 1.7;
		color: #334155;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
                justify-content: flex-start;
	}

	.hero-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 1rem;
	}

	.hero-spotlight {
		display: grid;
                grid-template-columns: minmax(0, 0.82fr) minmax(24rem, 1.18fr);
		gap: 1.25rem;
                align-items: start;
	}

	.spotlight-image-link {
		display: block;
		overflow: hidden;
                align-self: start;
		border-radius: 1.4rem;
                border: 1px solid #e2e8f0;
                box-shadow:
                        0 10px 24px rgba(15, 23, 42, 0.06),
                        0 1px 0 rgba(255, 255, 255, 0.7) inset;
                background: #f1f5f9;
                transition:
                        transform 180ms ease,
                        box-shadow 180ms ease,
                        border-color 180ms ease;
	}

	.spotlight-image {
		display: block;
		width: 100%;
                height: clamp(220px, 23vw, 280px);
		object-fit: cover;
                transition: transform 260ms ease;
	}

	.spotlight-content {
		display: grid;
		gap: 1rem;
	}

	.spotlight-copy {
		display: grid;
                gap: 0.72rem;
                padding: 1.4rem;
		border: 1px solid #dbe4f0;
		border-radius: 1.25rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98)), #ffffff;
		box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
                transition:
                        transform 180ms ease,
                        box-shadow 180ms ease,
                        border-color 180ms ease;
        }

        .hero-spotlight:hover .spotlight-image-link,
        .hero-spotlight:focus-within .spotlight-image-link {
                transform: translateY(-1px);
                border-color: #cbd5e1;
                box-shadow:
                        0 16px 30px rgba(15, 23, 42, 0.08),
                        0 1px 0 rgba(255, 255, 255, 0.72) inset;
        }

        .hero-spotlight:hover .spotlight-copy,
        .hero-spotlight:focus-within .spotlight-copy {
                transform: translateY(-1px);
                border-color: #cbd5e1;
                box-shadow: 0 18px 42px rgba(15, 23, 42, 0.09);
        }

        .hero-spotlight:hover .spotlight-image,
        .hero-spotlight:focus-within .spotlight-image {
                transform: scale(1.02);
	}

	.spotlight-label {
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
                margin-bottom: -0.1rem;
	}

	.spotlight-copy h2 {
		font-size: clamp(1.6rem, 2vw, 2rem);
		line-height: 1.15;
		color: #0f172a;
		text-wrap: balance;
	}

	.spotlight-summary {
		color: #334155;
		line-height: 1.7;
                max-width: 62ch;
                margin-top: 0.05rem;
	}

	.spotlight-meta {
		display: flex;
		flex-wrap: wrap;
                gap: 0.55rem;
                align-items: center;
                color: #64748b;
                font-size: 0.84rem;
                margin-top: 0.15rem;
	}

        .spotlight-meta-pill {
		display: inline-flex;
		align-items: center;
                padding: 0.28rem 0.58rem;
		border-radius: 999px;
                background: rgba(248, 250, 252, 0.82);
                border: 1px solid #e2e8f0;
                line-height: 1.3;
        }

        .spotlight-meta-pill-primary {
                background: #eef2ff;
                border-color: #dbe4ff;
                color: #334155;
                font-weight: 700;
        }

        .spotlight-meta-pill-muted {
                background: rgba(248, 250, 252, 0.56);
                color: #475569;
	}

	.spotlight-cta {
		width: fit-content;
		display: inline-flex;
		align-items: center;
		justify-content: center;
                margin-top: 0.35rem;
                padding: 0.78rem 1.1rem;
		border-radius: 999px;
                border: 1px solid rgba(15, 23, 42, 0.08);
                background:
                        linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
		color: #ffffff;
		text-decoration: none;
		font-weight: 700;
                letter-spacing: 0.01em;
                box-shadow:
                        0 10px 24px rgba(15, 23, 42, 0.12),
                        0 1px 0 rgba(255, 255, 255, 0.1) inset;
                transition:
                        transform 160ms ease,
                        box-shadow 160ms ease,
                        background 160ms ease;
        }

        .spotlight-cta:hover,
        .spotlight-cta:focus-visible {
                transform: translateY(-1px);
                box-shadow:
                        0 14px 30px rgba(15, 23, 42, 0.15),
                        0 1px 0 rgba(255, 255, 255, 0.14) inset;
                background:
                        linear-gradient(180deg, #273449 0%, #111c2f 100%);
	}

	.stat-card {
		display: grid;
                gap: 0.28rem;
                padding: 0.95rem 1rem;
                border: 1px solid #e2e8f0;
		border-radius: 1rem;
		background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88)), #ffffff;
                box-shadow:
                        0 8px 22px rgba(15, 23, 42, 0.05),
                        0 1px 0 rgba(255, 255, 255, 0.75) inset;
	}

	.stat-card span {
                font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #94a3b8;
	}

	.stat-card strong {
                font-size: 1rem;
                line-height: 1.4;
                font-weight: 700;
		color: #0f172a;
	}

	.locale-switch {
		display: inline-flex;
                width: fit-content;
                padding: 0.22rem;
                border: 1px solid #dbe4f0;
		border-radius: 999px;
                background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96)), #ffffff;
                box-shadow:
                        0 8px 20px rgba(15, 23, 42, 0.05),
                        0 1px 0 rgba(255, 255, 255, 0.75) inset;
	}

        .locale-switch a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
                min-width: 3.2rem;
                padding: 0.72rem 0.95rem;
		font-weight: 700;
		text-decoration: none;
		color: #334155;
                transition:
                        background 160ms ease,
                        color 160ms ease,
                        transform 160ms ease;
	}

	.locale-switch a.active {
		background: #0f172a;
		color: #ffffff;
	}

        .locale-switch a:hover,
        .locale-switch a:focus-visible {
                transform: translateY(-1px);
	}

	.message-card {
                border: 1px solid #e2e8f0;
                border-radius: 1.15rem;
                background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.96)), #ffffff;
                box-shadow:
                        0 10px 26px rgba(15, 23, 42, 0.05),
                        0 1px 0 rgba(255, 255, 255, 0.72) inset;
	}

	.error-card {
                border-color: #fecaca;
                background:
                        linear-gradient(180deg, rgba(255, 247, 247, 0.98), rgba(254, 242, 242, 0.96)),
                        #fff7f7;
        }

        .message-card .card-label {
                color: #64748b;
	}

	.card-value {
                margin-top: 0.5rem;
                max-width: 42rem;
                font-size: 0.98rem;
		font-weight: 600;
                line-height: 1.65;
		color: #0f172a;
	}

	.article-grid {
		display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
                padding-top: 1.35rem;
                margin-top: 0.35rem;
                border-top: 1px solid #e2e8f0;
	}

	.article-card {
		display: grid;
		gap: 1.15rem;
		border: 1px solid #dbe4f0;
		border-radius: 1.25rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98)), #ffffff;
		padding: 1.35rem;
		color: inherit;
		text-decoration: none;
		box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
		transition:
			transform 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

        .article-card:hover,
        .article-card:focus-visible {
                transform: translateY(-1px);
                border-color: #cbd5e1;
                box-shadow: 0 18px 36px rgba(15, 23, 42, 0.09);
	}

	.article-image-frame {
		overflow: hidden;
		margin: -1.35rem -1.35rem 0;
		border-radius: 1.25rem 1.25rem 0 0;
		background: #e2e8f0;
		border-bottom: 1px solid #dbe4f0;
                transition: border-color 160ms ease;
	}

	.article-image {
		display: block;
		width: 100%;
		height: clamp(180px, 20vw, 240px);
		object-fit: cover;
                transition: transform 260ms ease;
        }

        .article-card:hover .article-image,
        .article-card:focus-visible .article-image {
                transform: scale(1.02);
        }

        .article-card:hover .article-image-frame,
        .article-card:focus-visible .article-image-frame {
                border-bottom-color: #cbd5e1;
	}

	.article-card-topline,
	.article-footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		align-items: center;
		justify-content: space-between;
	}

	.article-meta {
		display: flex;
		flex-wrap: wrap;
                gap: 0.55rem;
		align-items: center;
                color: #64748b;
                font-size: 0.84rem;
	}

	.meta-chip,
	.verdict-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
                padding: 0.34rem 0.68rem;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.meta-chip {
                background: rgba(226, 232, 240, 0.72);
                border: 1px solid #e2e8f0;
		color: #334155;
	}

	.verdict-pill {
                background: rgba(220, 252, 231, 0.7);
                border: 1px solid #bbf7d0;
		color: #166534;
	}

        .article-date {
                color: #94a3b8;
                font-size: 0.82rem;
                letter-spacing: 0.01em;
        }

        .article-title {
		font-size: 1.32rem;
                line-height: 1.24;
                letter-spacing: -0.015em;
		color: #0f172a;
		text-wrap: balance;
	}

	.summary {
                color: #475569;
                font-size: 0.96rem;
                line-height: 1.68;
		min-height: 3.4rem;
                max-width: 34ch;
	}

	.footer-block {
		display: grid;
                gap: 0.12rem;
	}

	.footer-block-end {
		text-align: right;
	}

	.footer-label {
                font-size: 0.7rem;
		font-weight: 700;
                letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.article-footer strong {
                font-size: 0.92rem;
                font-weight: 700;
                line-height: 1.4;
		color: #0f172a;
	}

        @media (min-width: 961px) {
                .article-card {
                        gap: 1rem;
                        padding: 1.2rem;
                }

                .article-image-frame {
                        margin: -1.2rem -1.2rem 0;
                }

                .article-image {
                        height: clamp(168px, 16vw, 210px);
                }

                .article-title {
                        font-size: 1.24rem;
                }

                .summary {
                        font-size: 0.93rem;
                        min-height: 3.1rem;
                }
        }

        @media (max-width: 960px) {
                .article-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                }
        }

	@media (max-width: 640px) {
                .hero {
                        gap: 1.1rem;
                        padding-top: 2rem;
                        padding-bottom: 0.5rem;
                }

                .hero-copy {
                        gap: 0.85rem;
                }

                h1 {
                        font-size: clamp(2.15rem, 10vw, 3rem);
                        line-height: 1.04;
                }

                .hero-copy > p:not(.eyebrow) {
                        font-size: 1rem;
                }

                .actions {
                        gap: 0.75rem;
                }

                .locale-switch a {
                        min-width: 2.9rem;
                        padding: 0.65rem 0.85rem;
                }

		.hero-spotlight {
			grid-template-columns: 1fr;
                        gap: 1rem;
		}

		.spotlight-image {
                        height: 220px;
                }

                .spotlight-copy {
                        padding: 1.1rem;
                }

                .spotlight-copy h2 {
                        font-size: 1.45rem;
                }

                .spotlight-summary {
                        font-size: 0.95rem;
                        line-height: 1.65;
                }

                .spotlight-cta {
                        width: 100%;
                }

                .hero-stats {
                        grid-template-columns: 1fr;
                        gap: 0.75rem;
		}

                .article-grid {
                        grid-template-columns: 1fr;
                        padding-top: 1rem;
                }

		.article-card-topline,
		.article-footer {
			align-items: flex-start;
		}

		.footer-block-end {
			text-align: left;
		}

		.hero,
		.message-card,
		.article-grid {
			padding: 1rem;
		}
	}
</style>
