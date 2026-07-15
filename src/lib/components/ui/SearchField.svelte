<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let query = $derived(page.url.searchParams.get('q') ?? '');
</script>

<form
	class="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1"
	method="GET"
	action={resolve('/search')}
	role="search"
>
	<label class="sr-only" for="app-search">Search</label>
	<input
		id="app-search"
		type="search"
		name="q"
		bind:value={query}
		placeholder="Search music"
		class="border-border bg-surface-muted text-text placeholder:text-text-muted focus:border-accent min-h-touch w-full rounded-card border px-4 text-base"
	/>
	<button
		type="submit"
		class="border-border bg-surface-muted hover:border-accent min-h-touch shrink-0 rounded-card border px-4 text-base font-medium"
	>
		Search
	</button>
</form>
