<script lang="ts">
	import CoverArt from '$lib/components/media/CoverArt.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		trackNumber?: number | null;
		coverId?: number | null;
		baseUrl?: string | null;
		favourite?: boolean | null;
		favouritePending?: boolean;
		onFavouriteClick?: () => void;
		status?: string;
		onEditClick?: () => void;
		onAddToPlaylist?: () => void;
		onclick?: () => void;
	}

	let {
		title,
		subtitle = '',
		trackNumber = null,
		coverId = null,
		baseUrl = null,
		favourite = null,
		favouritePending = false,
		onFavouriteClick,
		status = '',
		onEditClick,
		onAddToPlaylist,
		onclick
	}: Props = $props();
</script>

<div
	class="border-border bg-surface-raised flex min-h-touch w-full items-center gap-2 rounded-card border px-2 py-2"
>
	<button
		type="button"
		class="hover:border-accent focus-visible:border-accent flex min-h-touch min-w-0 flex-1 items-center gap-4 rounded-card border border-transparent px-2 py-1 text-left"
		{onclick}
	>
		{#if coverId != null}
			<span class="shrink-0">
				<CoverArt {title} artist={subtitle} {coverId} {baseUrl} size="sm" />
			</span>
		{:else if trackNumber != null}
			<span class="text-text-muted w-8 shrink-0 text-center text-base tabular-nums"
				>{trackNumber}</span
			>
		{/if}
		<span class="min-w-0 flex-1">
			<span class="block truncate text-lg font-semibold">{title}</span>
			{#if subtitle}
				<span class="text-text-muted block truncate text-base">{subtitle}</span>
			{/if}
			{#if status}
				<span class="text-text-muted mt-1 block truncate text-sm">{status}</span>
			{/if}
		</span>
	</button>
	{#if onAddToPlaylist}
		<button
			type="button"
			class="border-border bg-surface-muted hover:border-accent min-h-touch min-w-touch shrink-0 rounded-card border text-sm font-semibold"
			aria-label={`Add ${title} to playlist`}
			onclick={(event) => {
				event.stopPropagation();
				onAddToPlaylist();
			}}
		>
			Add
		</button>
	{/if}
	{#if onEditClick}
		<button
			type="button"
			class="border-border bg-surface-muted hover:border-accent min-h-touch min-w-touch shrink-0 rounded-card border text-sm font-semibold"
			aria-label={`Edit ${title}`}
			onclick={(event) => {
				event.stopPropagation();
				onEditClick();
			}}
		>
			Edit
		</button>
	{/if}
	{#if favourite != null && onFavouriteClick}
		<button
			type="button"
			class="border-border bg-surface-muted hover:border-accent min-h-touch min-w-touch shrink-0 rounded-card border text-sm font-semibold disabled:opacity-50"
			aria-pressed={favourite}
			aria-label={favourite ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
			disabled={favouritePending}
			onclick={(event) => {
				event.stopPropagation();
				onFavouriteClick();
			}}
		>
			{favourite ? 'Unfav' : 'Fav'}
		</button>
	{/if}
</div>
