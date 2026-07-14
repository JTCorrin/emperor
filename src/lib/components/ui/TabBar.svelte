<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type TabItem = {
		href: '/' | '/playlists' | '/songs' | '/albums' | '/podcasts';
		label: string;
	};

	const tabs: TabItem[] = [
		{ href: '/', label: 'Home' },
		{ href: '/playlists', label: 'Playlists' },
		{ href: '/songs', label: 'Songs' },
		{ href: '/albums', label: 'Albums' },
		{ href: '/podcasts', label: 'Podcasts' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		return path === href || path.startsWith(`${href}/`);
	}
</script>

<nav class="border-border bg-surface/95 border-b backdrop-blur" aria-label="Primary">
	<ul class="mx-auto grid max-w-6xl grid-cols-5 gap-1 px-1 py-1 sm:px-2">
		{#each tabs as tab (tab.href)}
			<li>
				<a
					href={resolve(tab.href)}
					aria-current={isActive(tab.href) ? 'page' : undefined}
					class={[
						'min-h-touch flex items-center justify-center rounded-card px-1 text-center text-sm font-semibold sm:text-base',
						isActive(tab.href)
							? 'bg-accent text-text'
							: 'text-text-muted hover:bg-surface-muted hover:text-text'
					]}
				>
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
