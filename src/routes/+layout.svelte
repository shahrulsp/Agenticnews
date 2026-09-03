<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<header class="site-header">
		<div class="brand-block">
			<a class="brand" href={resolve('/')}>Agenticnews</a>
			<p class="tagline">
				{data.locale === 'ms' ? 'Berita AI yang disemak manusia' : 'AI news reviewed by humans'}
			</p>
		</div>

		<nav class="header-nav">
			<span class="locale-chip">{data.locale.toUpperCase()}</span>
		</nav>
	</header>

	<main class="site-main">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, sans-serif;
		background: #f8fafc;
		color: #0f172a;
	}

	.app-shell {
		min-height: 100vh;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 2rem;
		border-bottom: 1px solid #e2e8f0;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(10px);
	}

	.brand-block,
	.header-nav {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.brand {
		color: #0f172a;
		font-size: 1.2rem;
		font-weight: 800;
		text-decoration: none;
	}

	.tagline {
		margin: 0;
		color: #475569;
		font-size: 0.95rem;
	}

        .locale-chip {
		border-radius: 999px;
		padding: 0.55rem 0.85rem;
		font-size: 0.88rem;
		font-weight: 700;
		background: #e2e8f0;
		color: #334155;
	}

	.site-main {
		padding-bottom: 4rem;
	}

	@media (max-width: 720px) {
		.site-header,
		.brand-block {
			align-items: flex-start;
			flex-direction: column;
		}

                .site-header {
                        gap: 0.65rem;
                        padding: 1rem 1rem 0.9rem;
                }

                .brand-block {
                        gap: 0.35rem;
                }

                .tagline {
                        font-size: 0.9rem;
                }

		.header-nav {
                        align-self: flex-start;
                        justify-content: flex-start;
                        width: auto;
                }

                .locale-chip {
                        padding: 0.48rem 0.78rem;
                        font-size: 0.82rem;
		}
	}
</style>
