<script lang="ts">
	import { resolve } from '$app/paths';
	import { createMediaServerClient } from '$lib/api';
	import { getConnection, getPlayer } from '$lib/state/context';

	const connection = getConnection();
	const player = getPlayer();

	let loadingRandom = $state(false);
	let randomError = $state<string | null>(null);

	async function playRandom() {
		if (!connection.baseUrl) return;
		loadingRandom = true;
		randomError = null;
		try {
			const client = createMediaServerClient({ baseUrl: connection.baseUrl });
			const page = await client.getDiscoverRandom({ limit: 25 });
			if (page.items.length === 0) {
				randomError = 'No tracks available to play';
				return;
			}
			player.playTracks(page.items, 0);
		} catch (cause) {
			randomError = cause instanceof Error ? cause.message : 'Could not load random tracks';
		} finally {
			loadingRandom = false;
		}
	}
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Home</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			Vehicle-friendly music browsing starts here. Connect to a media server, then play a random
			queue while shelves arrive in the next stage.
		</p>
	</div>

	{#if connection.status === 'connected' && connection.libraryStatus}
		<div
			class="border-border bg-surface-raised rounded-card grid gap-4 border p-5 sm:grid-cols-2 lg:grid-cols-4"
		>
			<div>
				<p class="text-text-muted text-sm uppercase">Tracks</p>
				<p class="text-3xl font-semibold">{connection.libraryStatus.track_count}</p>
			</div>
			<div>
				<p class="text-text-muted text-sm uppercase">Albums</p>
				<p class="text-3xl font-semibold">{connection.libraryStatus.album_count}</p>
			</div>
			<div>
				<p class="text-text-muted text-sm uppercase">Artists</p>
				<p class="text-3xl font-semibold">{connection.libraryStatus.artist_count}</p>
			</div>
			<div>
				<p class="text-text-muted text-sm uppercase">Covers</p>
				<p class="text-3xl font-semibold">{connection.libraryStatus.image_count}</p>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			<button
				type="button"
				class="bg-accent text-text hover:bg-accent-strong min-h-touch-lg w-full max-w-md rounded-card px-6 text-lg font-semibold disabled:opacity-60"
				disabled={loadingRandom}
				onclick={playRandom}
			>
				{loadingRandom ? 'Loading…' : 'Play random'}
			</button>
			{#if randomError}
				<p class="text-danger text-base" role="alert">{randomError}</p>
			{/if}
		</div>
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
