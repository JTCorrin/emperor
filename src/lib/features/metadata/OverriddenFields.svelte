<script lang="ts">
	interface Props {
		fields: string[];
		label?: string;
	}

	let { fields, label = 'Overridden' }: Props = $props();

	const visible = $derived(fields.filter((field) => field.trim().length > 0));
</script>

{#if visible.length > 0}
	<p class="text-text-muted text-sm" role="status">
		<span class="font-medium">{label}:</span>
		{#each visible as field, index (field)}
			<span
				class="border-border bg-surface-muted ml-1 inline-flex rounded-card border px-2 py-0.5 text-xs font-medium"
			>
				{field}
			</span>{#if index < visible.length - 1}<span class="sr-only">,</span>{/if}
		{/each}
	</p>
{/if}
