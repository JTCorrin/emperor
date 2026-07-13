<script lang="ts">
	import type { Snippet } from 'svelte';
	import ShelfSkeleton from '$lib/components/media/ShelfSkeleton.svelte';
	import StatusPanel from '$lib/components/ui/StatusPanel.svelte';

	export type GridStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

	interface Props {
		status: GridStatus;
		emptyMessage?: string;
		errorMessage?: string;
		onretry?: () => void;
		children?: Snippet;
	}

	let {
		status,
		emptyMessage = 'Nothing here yet.',
		errorMessage = 'Could not load this list.',
		onretry,
		children
	}: Props = $props();
</script>

{#if status === 'loading' || status === 'idle'}
	<ShelfSkeleton count={8} />
{:else if status === 'empty'}
	<StatusPanel message={emptyMessage} />
{:else if status === 'error'}
	<StatusPanel title="Error" message={errorMessage} tone="danger" {onretry} />
{:else if status === 'ready'}
	<div
		class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
	>
		{#if children}
			{@render children()}
		{/if}
	</div>
{/if}
