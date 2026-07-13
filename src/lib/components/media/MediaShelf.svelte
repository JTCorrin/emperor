<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import ShelfSkeleton from '$lib/components/media/ShelfSkeleton.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';

	export type ShelfStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

	interface Props {
		title: string;
		status: ShelfStatus;
		emptyMessage?: string;
		errorMessage?: string;
		unavailableMessage?: string;
		headerHref?: '/history';
		headerLinkLabel?: string;
		onretry?: () => void;
		children?: Snippet;
	}

	let {
		title,
		status,
		emptyMessage = 'Nothing here yet.',
		errorMessage = 'Could not load this shelf.',
		unavailableMessage = 'Unavailable on this server.',
		headerHref,
		headerLinkLabel,
		onretry,
		children
	}: Props = $props();

	let scroller: HTMLDivElement | undefined = $state();
	let canScrollPrev = $state(false);
	let canScrollNext = $state(false);

	function updateOverflow() {
		const el = scroller;
		if (!el) {
			canScrollPrev = false;
			canScrollNext = false;
			return;
		}
		canScrollPrev = el.scrollLeft > 4;
		canScrollNext = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
	}

	function scrollByCards(direction: -1 | 1) {
		const el = scroller;
		if (!el) return;
		el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 160), behavior: 'smooth' });
	}

	$effect(() => {
		if (status !== 'ready') return;
		const el = scroller;
		if (!el) return;
		updateOverflow();
		el.addEventListener('scroll', updateOverflow, { passive: true });
		const observer = new ResizeObserver(() => updateOverflow());
		observer.observe(el);
		return () => {
			el.removeEventListener('scroll', updateOverflow);
			observer.disconnect();
		};
	});
</script>

<section class="flex flex-col gap-3" aria-labelledby="{title.replaceAll(' ', '-')}-shelf-heading">
	<div class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-wrap items-baseline gap-3">
			<h2
				id="{title.replaceAll(' ', '-')}-shelf-heading"
				class="text-2xl font-semibold tracking-tight"
			>
				{title}
			</h2>
			{#if headerHref && headerLinkLabel}
				<a
					href={resolve(headerHref)}
					class="text-text-muted hover:text-accent min-h-touch inline-flex items-center text-base font-medium"
				>
					{headerLinkLabel}
				</a>
			{/if}
		</div>
		{#if status === 'ready'}
			<div class="flex gap-2">
				<button
					type="button"
					class="border-border bg-surface-muted min-h-touch min-w-touch rounded-card border text-sm font-medium disabled:opacity-40"
					aria-label="Scroll {title} left"
					disabled={!canScrollPrev}
					onclick={() => scrollByCards(-1)}
				>
					Prev
				</button>
				<button
					type="button"
					class="border-border bg-surface-muted min-h-touch min-w-touch rounded-card border text-sm font-medium disabled:opacity-40"
					aria-label="Scroll {title} right"
					disabled={!canScrollNext}
					onclick={() => scrollByCards(1)}
				>
					Next
				</button>
			</div>
		{/if}
	</div>

	{#if status === 'loading' || status === 'idle'}
		<ShelfSkeleton />
	{:else if status === 'empty'}
		<StatusPanel message={emptyMessage} />
	{:else if status === 'unavailable'}
		<StatusPanel title="Unavailable" message={unavailableMessage} />
	{:else if status === 'error'}
		<StatusPanel title="Error" message={errorMessage} tone="danger" {onretry} />
	{:else if status === 'ready'}
		<div
			bind:this={scroller}
			class="flex gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
		>
			{#if children}
				{@render children()}
			{/if}
		</div>
	{/if}
</section>
