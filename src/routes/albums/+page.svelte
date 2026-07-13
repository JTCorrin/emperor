<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaGrid from '$lib/components/media/MediaGrid.svelte';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getConnection } from '$lib/state/context';
	import type { Album } from '$lib/api';

	const connection = getConnection();

	const list = new PaginatedListController<Album>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getAlbums(query)
	});

	let regroupNotice = $state<string | null>(null);

	onMount(() => {
		const notice = sessionStorage.getItem('emperor:album-regroup-notice');
		if (notice) {
			sessionStorage.removeItem('emperor:album-regroup-notice');
			regroupNotice = notice;
		}
	});

	onDestroy(() => list.dispose());

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		if (!connected) return;
		untrack(() => {
			void list.load();
		});
	});
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Albums</h1>
			<p class="text-text-muted max-w-2xl text-lg">Cover-led album browse.</p>
		</div>
		<a
			href={resolve('/artists')}
			class="border-border bg-surface-muted hover:border-accent min-h-touch inline-flex items-center rounded-card border px-5 text-base font-semibold"
		>
			Artists
		</a>
	</div>

	{#if regroupNotice}
		<p class="text-text-muted text-base" role="status">{regroupNotice}</p>
	{/if}

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to browse albums.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else}
		<MediaGrid
			status={list.status}
			emptyMessage="No albums in the library yet."
			errorMessage={list.errorMessage ?? 'Could not load albums.'}
			onretry={() => list.load()}
		>
			{#each list.items as album (album.id)}
				<MediaCard
					layout="grid"
					title={album.name}
					subtitle={album.artist}
					coverId={album.cover_id}
					baseUrl={connection.baseUrl}
					onclick={() => goto(resolve(`/albums/${album.id}`))}
				/>
			{/each}
		</MediaGrid>
		{#if list.status === 'ready'}
			<LoadMoreButton
				hasMore={list.hasMore}
				loading={list.loadingMore}
				onclick={() => list.loadMore()}
			/>
		{/if}
	{/if}
</section>
