<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaShelf from '$lib/components/media/MediaShelf.svelte';
	import ShelfSkeleton from '$lib/components/media/ShelfSkeleton.svelte';
	import { HomeShelvesController } from '$lib/features/home/homeShelves.svelte';
	import { getConnection, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();

	const home = new HomeShelvesController({
		getBaseUrl: () => connection.baseUrl
	});

	onDestroy(() => home.dispose());

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		if (!connected) return;
		// load() reads/writes shelf $state; untrack so that does not re-trigger this effect.
		untrack(() => {
			void home.load();
		});
	});
</script>

<section class="flex flex-1 flex-col gap-8 pb-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Home</h1>
			<p class="text-text-muted max-w-2xl text-lg">
				Discover shelves for your library. Tap a track to replace the queue and start playing.
			</p>
		</div>
		{#if connection.status === 'connected'}
			<button
				type="button"
				class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold disabled:opacity-60"
				disabled={home.refreshing}
				onclick={() => home.refresh()}
			>
				{home.refreshing ? 'Refreshing…' : 'Refresh'}
			</button>
		{/if}
	</div>

	{#if connection.baseUrl}
		{#if connection.status === 'connected'}
			<MediaShelf
				title="Discover"
				status={home.shelves.discover.status}
				errorMessage={home.shelves.discover.errorMessage ?? undefined}
				emptyMessage="No discovery tracks yet."
				onretry={() => home.refresh()}
			>
				{#each home.shelves.discover.items as track, index (track.id)}
					<MediaCard
						title={track.title}
						subtitle={track.artist}
						baseUrl={connection.baseUrl}
						onclick={() => player.playTracks(home.shelves.discover.items, index)}
					/>
				{/each}
			</MediaShelf>

			<MediaShelf
				title="Recently Added"
				status={home.shelves.recent.status}
				errorMessage={home.shelves.recent.errorMessage ?? undefined}
				emptyMessage="No recent tracks yet."
				onretry={() => home.refresh()}
			>
				{#each home.shelves.recent.items as track, index (track.id)}
					<MediaCard
						title={track.title}
						subtitle={track.artist}
						baseUrl={connection.baseUrl}
						onclick={() => player.playTracks(home.shelves.recent.items, index)}
					/>
				{/each}
			</MediaShelf>

			<MediaShelf
				title="Recently Played"
				status={home.shelves.recentlyPlayed.status}
				errorMessage={home.shelves.recentlyPlayed.errorMessage ?? undefined}
				unavailableMessage="Recently played needs a media-server user database."
				emptyMessage="Nothing played yet."
				headerHref="/history"
				headerLinkLabel="History"
				onretry={() => home.refresh()}
			>
				{#each home.shelves.recentlyPlayed.items as track, index (track.id)}
					<MediaCard
						title={track.title}
						subtitle={track.artist}
						baseUrl={connection.baseUrl}
						onclick={() => player.playTracks(home.shelves.recentlyPlayed.items, index)}
					/>
				{/each}
			</MediaShelf>

			<MediaShelf
				title="Playlists"
				status={home.shelves.playlists.status}
				errorMessage={home.shelves.playlists.errorMessage ?? undefined}
				unavailableMessage="Playlists need a media-server user database."
				emptyMessage="No playlists yet."
				onretry={() => home.refresh()}
			>
				{#each home.shelves.playlists.items as playlist (playlist.id)}
					<MediaCard
						title={playlist.name}
						subtitle={`${playlist.track_count} tracks`}
						baseUrl={connection.baseUrl}
						onclick={() => goto(resolve(`/playlists/${playlist.id}`))}
					/>
				{/each}
			</MediaShelf>

			<MediaShelf
				title="Favourites"
				status={home.shelves.favourites.status}
				errorMessage={home.shelves.favourites.errorMessage ?? undefined}
				unavailableMessage="Favourites need a media-server user database."
				emptyMessage="No favourites yet."
				onretry={() => home.refresh()}
			>
				{#each home.shelves.favourites.items as track, index (track.id)}
					<MediaCard
						title={track.title}
						subtitle={track.artist}
						baseUrl={connection.baseUrl}
						onclick={() => player.playTracks(home.shelves.favourites.items, index)}
					/>
				{/each}
			</MediaShelf>
		{:else}
			<div class="flex flex-col gap-3" aria-busy="true">
				<p class="text-text-muted text-lg">Connecting to {connection.baseUrl}…</p>
				<ShelfSkeleton />
			</div>
		{/if}
	{:else}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">No media server connected yet.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{/if}
</section>
