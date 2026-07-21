<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import {
		createMediaServerClient,
		MediaServerRequestError,
		playlistNameBodySchema,
		type Playlist
	} from '$lib/api';
	import LoadMoreButton from '$lib/components/media/LoadMoreButton.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import MediaGrid from '$lib/components/media/MediaGrid.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';
	import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
	import { getConnection } from '$lib/state/context';

	const connection = getConnection();

	const list = new PaginatedListController<Playlist>({
		getBaseUrl: () => connection.baseUrl,
		fetchPage: (client, query) => client.getPlaylists(query)
	});

	let createError = $state<string | null>(null);
	let createDialog: HTMLDialogElement | undefined = $state();

	const { form, errors, enhance, submitting, reset } = superForm(
		defaults({ name: '' }, zod4(playlistNameBodySchema)),
		{
			SPA: true,
			validators: zod4(playlistNameBodySchema),
			resetForm: false,
			onUpdate: async ({ form: validated, cancel }) => {
				cancel();
				if (!validated.valid || !connection.baseUrl) return;
				createError = null;
				try {
					const client = createMediaServerClient({ baseUrl: connection.baseUrl });
					const created = await client.createPlaylist(validated.data.name);
					reset();
					createDialog?.close();
					await list.load();
					await goto(resolve(`/playlists/${created.id}`));
				} catch (cause) {
					if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
						createError = 'Playlists need a media-server user database.';
					} else {
						createError = cause instanceof Error ? cause.message : 'Could not create playlist.';
					}
				}
			}
		}
	);

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

	function openCreateDialog() {
		createError = null;
		reset();
		createDialog?.showModal();
		queueMicrotask(() => {
			document.getElementById('playlist-name')?.focus();
		});
	}

	function closeCreateDialog() {
		createDialog?.close();
		createError = null;
	}
</script>

<section class="flex flex-1 flex-col gap-6 pb-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-2">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Playlists</h1>
			<p class="text-text-muted max-w-2xl text-lg">Create mixes and open them to play or edit.</p>
		</div>
		<div class="flex flex-wrap gap-3">
			{#if connection.status === 'connected' && connection.hasUserDb !== false}
				<button
					type="button"
					class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold"
					onclick={openCreateDialog}
				>
					Create playlist
				</button>
			{/if}
			<a
				href={resolve('/history')}
				class="border-border bg-surface-muted hover:border-accent min-h-touch inline-flex items-center rounded-card border px-5 text-base font-semibold"
			>
				History
			</a>
		</div>
	</div>

	{#if connection.status !== 'connected'}
		<div class="border-border bg-surface-raised rounded-card border p-6">
			<p class="text-lg">
				Waiting for the media server. Use Retry in the banner when it comes back.
			</p>
		</div>
	{:else if connection.hasUserDb === false}
		<StatusPanel
			title="Unavailable"
			message="Playlists need a media-server user database. Music browsing still works from Songs and Albums."
		/>
	{:else}
		<dialog
			bind:this={createDialog}
			class="bg-surface-raised text-text border-border fixed inset-0 m-auto max-h-[min(90dvh,32rem)] w-[min(100%-2rem,28rem)] rounded-card border p-0 shadow-xl backdrop:bg-black/60 open:flex open:flex-col"
			aria-labelledby="create-playlist-title"
		>
			<form
				method="POST"
				use:enhance
				class="flex flex-col gap-5 p-6"
				onsubmit={(event) => event.stopPropagation()}
			>
				<h2 id="create-playlist-title" class="text-2xl font-semibold tracking-tight">
					Create playlist
				</h2>
				<label class="flex flex-col gap-2 text-base font-medium" for="playlist-name">
					Name
					<input
						id="playlist-name"
						name="name"
						type="text"
						bind:value={$form.name}
						placeholder="e.g. Night drive"
						class="border-border bg-surface-muted focus:border-accent min-h-touch w-full rounded-card border px-4 text-base font-normal"
						aria-invalid={$errors.name ? true : undefined}
						aria-describedby={$errors.name || createError ? 'playlist-name-error' : undefined}
					/>
				</label>
				{#if $errors.name?.[0] || createError}
					<p id="playlist-name-error" class="text-danger text-base" role="alert">
						{$errors.name?.[0] ?? createError}
					</p>
				{/if}
				<div class="flex flex-wrap gap-3">
					<button
						type="submit"
						class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold disabled:opacity-60"
						disabled={$submitting}
					>
						{$submitting ? 'Creating…' : 'Create'}
					</button>
					<button
						type="button"
						class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold"
						disabled={$submitting}
						onclick={closeCreateDialog}
					>
						Cancel
					</button>
				</div>
			</form>
		</dialog>

		<MediaGrid
			status={list.status}
			emptyMessage="No playlists yet. Tap Create playlist to add one."
			errorMessage={list.errorMessage ?? 'Could not load playlists.'}
			onretry={() => list.load()}
		>
			{#each list.items as playlist (playlist.id)}
				<MediaCard
					layout="grid"
					title={playlist.name}
					subtitle={`${playlist.track_count} tracks`}
					baseUrl={connection.baseUrl}
					onclick={() => goto(resolve(`/playlists/${playlist.id}`))}
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
