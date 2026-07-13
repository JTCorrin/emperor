<script lang="ts">
	import { resolve } from '$app/paths';
	import ConnectForm from '$lib/features/connect/ConnectForm.svelte';
	import { DEFAULT_DEV_BASE_URL } from '$lib/config';
	import { getConnection } from '$lib/state/context';

	const connection = getConnection();
	const initialBaseUrl = $derived(connection.baseUrl ?? DEFAULT_DEV_BASE_URL);

	const status = $derived(connection.libraryStatus);

	function formatScanTime(unix: number | null | undefined): string {
		if (unix == null || unix <= 0) return 'Never';
		try {
			return new Date(unix * 1000).toLocaleString();
		} catch {
			return String(unix);
		}
	}
</script>

<section class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Connect</h1>
		<p class="text-text-muted max-w-2xl text-lg">
			Enter the base URL of a trusted-LAN media-server. Development default:
			<code class="text-text">{DEFAULT_DEV_BASE_URL}</code>
		</p>
		<p class="text-text-muted max-w-2xl text-base">
			If Emperor uses HTTPS, your browser may block an HTTP media server as mixed content.
		</p>
	</div>

	{#key initialBaseUrl}
		<ConnectForm {initialBaseUrl} />
	{/key}

	{#if connection.status === 'connected'}
		<p class="text-success text-lg" role="status">
			Connected to {connection.baseUrl}. You can return to
			<a class="text-accent-strong underline" href={resolve('/')}>Home</a>.
		</p>

		<section
			class="border-border bg-surface-raised flex flex-col gap-4 rounded-card border p-6"
			aria-labelledby="library-panel-title"
		>
			<div class="flex flex-col gap-1">
				<h2 id="library-panel-title" class="text-2xl font-semibold tracking-tight">Library</h2>
				<p class="text-text-muted text-base">
					Watch scan status and start a rescan. Does not rewrite files on disk.
				</p>
			</div>

			{#if status}
				<dl class="grid gap-3 text-base sm:grid-cols-2">
					<div>
						<dt class="text-text-muted">Scanning</dt>
						<dd class="font-medium">{status.scanning ? 'Yes' : 'No'}</dd>
					</div>
					<div>
						<dt class="text-text-muted">Tracks</dt>
						<dd class="font-medium">{status.track_count}</dd>
					</div>
					<div>
						<dt class="text-text-muted">Albums</dt>
						<dd class="font-medium">{status.album_count}</dd>
					</div>
					<div>
						<dt class="text-text-muted">Artists</dt>
						<dd class="font-medium">{status.artist_count}</dd>
					</div>
					<div>
						<dt class="text-text-muted">Last scan</dt>
						<dd class="font-medium">{formatScanTime(status.last_scan_unix)}</dd>
					</div>
					<div>
						<dt class="text-text-muted">Last scan OK</dt>
						<dd class="font-medium">
							{status.last_scan_ok == null ? 'Unknown' : status.last_scan_ok ? 'Yes' : 'No'}
						</dd>
					</div>
					{#if status.last_error}
						<div class="sm:col-span-2">
							<dt class="text-text-muted">Last error</dt>
							<dd class="text-danger font-medium">{status.last_error}</dd>
						</div>
					{/if}
				</dl>
			{/if}

			{#if connection.scanError}
				<p class="text-danger text-base" role="alert">{connection.scanError}</p>
			{/if}

			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					class="bg-accent text-text hover:bg-accent-strong min-h-touch rounded-card px-5 text-base font-semibold disabled:opacity-60"
					disabled={connection.scanPending}
					onclick={() => connection.startScan(false)}
				>
					{connection.scanPending ? 'Starting…' : 'Rescan'}
				</button>
				<button
					type="button"
					class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold disabled:opacity-60"
					disabled={connection.scanPending}
					onclick={() => connection.startScan(true)}
				>
					Force rescan
				</button>
				<button
					type="button"
					class="border-border bg-surface-muted hover:border-accent min-h-touch rounded-card border px-5 text-base font-semibold"
					onclick={() => connection.refreshLibraryStatus()}
				>
					Refresh status
				</button>
			</div>
		</section>
	{/if}
</section>
