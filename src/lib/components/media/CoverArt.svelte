<script lang="ts">
	import { coverUrl } from '$lib/api';

	interface Props {
		title: string;
		artist?: string;
		coverId?: number | null;
		/** Changes only after a cover write, preserving normal browser caching otherwise. */
		coverRevision?: number;
		baseUrl?: string | null;
		size?: 'sm' | 'md' | 'lg' | 'card';
		class?: string;
	}

	let {
		title,
		artist = '',
		coverId = null,
		coverRevision = 0,
		baseUrl = null,
		size = 'md',
		class: className = ''
	}: Props = $props();

	const initials = $derived.by(() => {
		const source = title.trim() || artist.trim() || '?';
		return source.slice(0, 2).toUpperCase();
	});

	const src = $derived.by(() => {
		if (!baseUrl || coverId == null) return null;
		try {
			const url = coverUrl(baseUrl, coverId);
			return coverRevision > 0 ? `${url}?v=${coverRevision}` : url;
		} catch {
			return null;
		}
	});

	const sizeClass = $derived(
		size === 'lg'
			? 'size-56 sm:size-72'
			: size === 'sm'
				? 'size-14'
				: size === 'card'
					? 'aspect-square w-full'
					: 'size-16'
	);
</script>

{#if src}
	<img
		{src}
		alt={artist.trim() ? `Cover art for ${title} by ${artist}` : `Cover art for ${title}`}
		class="bg-surface-muted rounded-card object-cover {sizeClass} {className}"
		loading="lazy"
	/>
{:else}
	<div
		class="bg-surface-muted text-text-muted rounded-card flex items-center justify-center font-semibold {sizeClass} {className}"
		aria-hidden="true"
	>
		{initials}
	</div>
{/if}
