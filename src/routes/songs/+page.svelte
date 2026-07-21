<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import TrackRow from '$lib/components/media/TrackRow.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import TrackMetadataDialog from '$lib/features/metadata/TrackMetadataDialog.svelte';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getAddToPlaylist, getConnection, getFavourites, getPlayer } from '$lib/state/context';
	import type { Track } from '$lib/api';

	const connection = getConnection();
	const player = getPlayer();
	const favourites = getFavourites();
	const addToPlaylist = getAddToPlaylist();

	let editingTrack = $state.raw<Track | null>(null);

	const list = new PaginatedListController<Track>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getTracks(query)
	});

	onDestroy(() => list.dispose());

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		if (!connected) return;
		untrack(() => {
			void list.load();
		});
	});

	function onTrackSaved(updated: Track) {
		editingTrack = null;
		list.items = list.items.map((item) => (item.id === updated.id ? updated : item));
		player.updateTrackInQueue(updated);
	}
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Songs</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			Browse the library. Tap a song to replace the queue.
		</p>
	</div>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">
				Waiting for the media server. Use Retry in the banner when it comes back.
			</p>
		</div>
	{:else if list.status === 'loading' || list.status === 'idle'}
		<div class="flex flex-col gap-2" aria-busy="true">
			{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
				<div class="bg-surface-muted min-h-touch animate-pulse rounded-card"></div>
			{/each}
		</div>
	{:else if list.status === 'empty'}
		<StatusPanel message="No songs in the library yet." />
	{:else if list.status === 'error'}
		<StatusPanel
			title="Error"
			message={list.errorMessage ?? 'Could not load songs.'}
			tone="danger"
			onretry={() => list.load()}
		/>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each list.items as track, index (track.id)}
				<li>
					<TrackRow
						title={track.title}
						subtitle={`${track.artist} · ${track.album}`}
						trackNumber={track.track_number}
						coverId={track.cover_id}
						baseUrl={connection.baseUrl}
						status={track.overridden_fields.length
							? `Overridden: ${track.overridden_fields.join(', ')}`
							: ''}
						favourite={connection.hasUserDb === true ? favourites.isFavourite(track.id) : null}
						favouritePending={favourites.isPending(track.id)}
						onFavouriteClick={connection.hasUserDb === true
							? () => favourites.toggle(track)
							: undefined}
						onAddToPlaylist={connection.hasUserDb === true
							? () => addToPlaylist.open(track)
							: undefined}
						onEditClick={() => {
							editingTrack = track;
						}}
						onclick={() => player.playTracks(list.items, index)}
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

<TrackMetadataDialog
	track={editingTrack}
	onsaved={onTrackSaved}
	onclose={() => {
		editingTrack = null;
	}}
/>
