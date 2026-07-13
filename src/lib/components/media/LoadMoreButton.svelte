<script lang="ts">
	interface Props {
		hasMore: boolean;
		loading?: boolean;
		onclick: () => void;
		label?: string;
	}

	let { hasMore, loading = false, onclick, label = 'Load more' }: Props = $props();
</script>

{#if hasMore}
	<button
		type="button"
		class="border-border bg-surface-muted hover:border-accent min-h-touch w-full rounded-card border px-5 text-base font-semibold disabled:opacity-60"
		disabled={loading}
		{onclick}
	>
		{loading ? 'Loading…' : label}
	</button>
{/if}
