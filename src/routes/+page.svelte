<script lang="ts">
	import { resolve } from '$app/paths';
	import { getConnection } from '$lib/state/context';

	const connection = getConnection();
</script>

<section class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Home</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			Vehicle-friendly music browsing starts here. Connect to a media server to unlock library
			shelves in the next stages.
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
