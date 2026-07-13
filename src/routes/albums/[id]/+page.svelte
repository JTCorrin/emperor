<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CoverArt from '$lib/components/media/CoverArt.svelte';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import TrackRow from '$lib/components/media/TrackRow.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		type Album,
		type Track
	} from '$lib/api';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getConnection, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();

	const albumId = $derived(Number(page.params.id));

	let album = $state.raw<Album | null>(null);
	let albumStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let albumError = $state<string | null>(null);
	let albumAbort: AbortController | null = null;
	let albumToken = 0;

	const tracks = new PaginatedListController<Track>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getAlbumTracks(albumId, query)
	});

	onDestroy(() => {
		albumAbort?.abort();
		tracks.dispose();
	});

	async function loadAlbum(id: number) {
		const baseUrl = connection.baseUrl;
		if (!baseUrl || !Number.isFinite(id) || id <= 0) {
			album = null;
			albumStatus = 'error';
			albumError = 'Invalid album.';
			return;
		}

		albumAbort?.abort();
		const abort = new AbortController();
		albumAbort = abort;
		const token = ++albumToken;
		albumStatus = 'loading';
		albumError = null;

		try {
			const client = createMediaServerClient({ baseUrl });
			const next = await client.getAlbum(id, abort.signal);
			if (token !== albumToken) return;
			album = next;
			albumStatus = 'ready';
		} catch (cause) {
			if (token !== albumToken) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			album = null;
			albumStatus = 'error';
			if (cause instanceof MediaServerRequestError && cause.error.status === 404) {
				albumError = 'Album not found.';
			} else {
				albumError = cause instanceof Error ? cause.message : 'Could not load album.';
			}
		}
	}

	$effect(() => {
		const connected = connection.status === 'connected' && connection.baseUrl !== null;
		const id = albumId;
		if (!connected) return;
		untrack(() => {
			void loadAlbum(id);
			void tracks.load();
		});
	});
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<a
		href={resolve('/albums')}
		class="text-text-muted hover:text-text min-h-touch inline-flex w-fit items-center text-base font-medium"
	>
		Back to albums
	</a>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">Connect to a media server to open albums.</p>
			<a
				href={resolve('/connect')}
				class="bg-accent text-text hover:bg-accent-strong mt-4 inline-flex min-h-touch items-center rounded-card px-5 text-base font-semibold"
			>
				Connect to a server
			</a>
		</div>
	{:else if albumStatus === 'loading' || albumStatus === 'idle'}
		<p class="text-text-muted text-lg" aria-busy="true">Loading album…</p>
	{:else if albumStatus === 'error'}
		<StatusPanel
			title="Error"
			message={albumError ?? 'Could not load album.'}
			tone="danger"
			onretry={() => loadAlbum(albumId)}
		/>
	{:else if album}
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<div class="w-40 shrink-0 sm:w-48">
				<CoverArt
					title={album.name}
					artist={album.artist}
					coverId={album.cover_id}
					baseUrl={connection.baseUrl}
					size="card"
				/>
			</div>
			<div class="flex min-w-0 flex-1 flex-col gap-3">
				<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{album.name}</h1>
				<a
					href={resolve(`/artists/${album.artist_id}`)}
					class="text-text-muted hover:text-accent text-lg font-medium"
				>
					{album.artist}
				</a>
				<p class="text-text-muted text-base">
					{album.track_count} tracks{#if album.release_date}
						· {album.release_date}{/if}
				</p>
				{#if tracks.status === 'ready' && tracks.items.length > 0}
					<button
						type="button"
						class="bg-accent text-text hover:bg-accent-strong min-h-touch w-fit rounded-card px-5 text-base font-semibold"
						onclick={() => player.playTracks(tracks.items, 0)}
					>
						Play album
					</button>
				{/if}
			</div>
		</div>

		{#if tracks.status === 'loading' || tracks.status === 'idle'}
			<div class="flex flex-col gap-2" aria-busy="true">
				{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
					<div class="bg-surface-muted min-h-touch animate-pulse rounded-card"></div>
				{/each}
			</div>
		{:else if tracks.status === 'empty'}
			<StatusPanel message="No tracks on this album." />
		{:else if tracks.status === 'error'}
			<StatusPanel
				title="Error"
				message={tracks.errorMessage ?? 'Could not load tracks.'}
				tone="danger"
				onretry={() => tracks.load()}
			/>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each tracks.items as track, index (track.id)}
					<li>
						<TrackRow
							title={track.title}
							subtitle={track.artist}
							trackNumber={track.track_number}
							onclick={() => player.playTracks(tracks.items, index)}
						/>
					</li>
				{/each}
			</ul>
			<LoadMoreButton
				hasMore={tracks.hasMore}
				loading={tracks.loadingMore}
				onclick={() => tracks.loadMore()}
			/>
		{/if}
	{/if}
</section>
