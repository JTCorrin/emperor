<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaGrid from '$lib/components/media/MediaGrid.svelte';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getConnection } from '$lib/state/context';
	import type { Artist } from '$lib/api';

	const connection = getConnection();

	const list = new PaginatedListController<Artist>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getArtists(query)
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
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Artists</h1>
		<p class="text-text-muted max-w-2xl text-lg">Browse artists, then open their albums.</p>
	</div>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to browse artists.</p>
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
			emptyMessage="No artists in the library yet."
			errorMessage={list.errorMessage ?? 'Could not load artists.'}
			onretry={() => list.load()}
		>
			{#each list.items as artist (artist.id)}
				<MediaCard
					layout="grid"
					title={artist.name}
					subtitle={`${artist.album_count} albums · ${artist.track_count} tracks`}
					baseUrl={connection.baseUrl}
					onclick={() => goto(resolve(`/artists/${artist.id}`))}
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
