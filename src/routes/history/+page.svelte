<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { HistoryItem } from '$lib/api';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import TrackRow from '$lib/components/media/TrackRow.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getAddToPlaylist, getConnection, getFavourites, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();
	const favourites = getFavourites();
	const addToPlaylist = getAddToPlaylist();

	const list = new PaginatedListController<HistoryItem>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getHistory(query)
	});

	onDestroy(() => list.dispose());

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		const hasUserDb = connection.hasUserDb;
		if (!connected) return;
		if (hasUserDb === false) return;
		untrack(() => {
			void list.load();
		});
	});

	function formatPlayed(unix: number): string {
		try {
			return new Date(unix * 1000).toLocaleString();
		} catch {
			return String(unix);
		}
	}
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">History</h1>
			<p class="text-text-muted max-w-2xl text-lg">Recently played tracks with timestamps.</p>
		</div>
		<a
			href={resolve('/playlists')}
			class="border-border bg-surface-muted hover:border-accent min-h-touch inline-flex items-center rounded-card border px-5 text-base font-semibold"
		>
			Playlists
		</a>
	</div>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to view history.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else if connection.hasUserDb === false}
		<StatusPanel title="Unavailable" message="Play history needs a media-server user database." />
	{:else if list.status === 'loading' || list.status === 'idle'}
		<div class="flex flex-col gap-2" aria-busy="true">
			{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
				<div class="bg-surface-muted min-h-touch animate-pulse rounded-card"></div>
			{/each}
		</div>
	{:else if list.status === 'empty'}
		<StatusPanel message="Nothing played yet." />
	{:else if list.status === 'error'}
		<StatusPanel
			title="Error"
			message={list.errorMessage ?? 'Could not load history.'}
			tone="danger"
			onretry={() => list.load()}
		/>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each list.items as item, index (`${item.track.id}-${item.played_unix}-${index}`)}
				<li>
					<TrackRow
						title={item.track.title}
						subtitle={`${item.track.artist} · ${formatPlayed(item.played_unix)}`}
						coverId={item.track.cover_id}
						baseUrl={connection.baseUrl}
						favourite={connection.hasUserDb === true ? favourites.isFavourite(item.track.id) : null}
						favouritePending={favourites.isPending(item.track.id)}
						onFavouriteClick={connection.hasUserDb === true
							? () => favourites.toggle(item.track)
							: undefined}
						onAddToPlaylist={connection.hasUserDb === true
							? () => addToPlaylist.open(item.track)
							: undefined}
						onclick={() =>
							player.playTracks(
								list.items.map((entry) => entry.track),
								index
							)}
					/>
				</li>
			{/each}
		</ul>
		<LoadMoreButton
			hasMore={list.hasMore}
			loading={list.loadingMore}
			onclick={() => list.loadMore()}
		/>
	{/if}
</section>
