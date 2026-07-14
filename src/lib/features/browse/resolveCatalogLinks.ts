import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Album, Artist, MediaServerClient, SearchResponse } from '$lib/api';

export type CatalogLinkTarget =
	{ kind: 'artist'; id: number } | { kind: 'album'; id: number } | { kind: 'search'; q: string };

function normalizeName(value: string): string {
	return value.trim().toLocaleLowerCase();
}

export function resolveArtistLink(artists: Artist[], artistName: string): CatalogLinkTarget {
	const needle = normalizeName(artistName);
	if (!needle) return { kind: 'search', q: artistName };
	const exact = artists.find((artist) => normalizeName(artist.name) === needle);
	if (exact) return { kind: 'artist', id: exact.id };
	return { kind: 'search', q: artistName };
}

export function resolveAlbumLink(
	albums: Album[],
	albumName: string,
	artistName: string
): CatalogLinkTarget {
	const albumNeedle = normalizeName(albumName);
	const artistNeedle = normalizeName(artistName);
	if (!albumNeedle) return { kind: 'search', q: albumName || artistName };

	const exact = albums.find((album) => {
		if (normalizeName(album.name) !== albumNeedle) return false;
		if (!artistNeedle) return true;
		return normalizeName(album.artist) === artistNeedle;
	});
	if (exact) return { kind: 'album', id: exact.id };

	const nameOnly = albums.find((album) => normalizeName(album.name) === albumNeedle);
	if (nameOnly) return { kind: 'album', id: nameOnly.id };

	return { kind: 'search', q: albumName };
}

export async function resolveArtistFromSearch(
	client: Pick<MediaServerClient, 'search'>,
	artistName: string,
	signal?: AbortSignal
): Promise<CatalogLinkTarget> {
	const q = artistName.trim();
	if (!q) return { kind: 'search', q: artistName };
	const response: SearchResponse = await client.search({ q, limit: 50, signal });
	return resolveArtistLink(response.artists.items, artistName);
}

export async function resolveAlbumFromSearch(
	client: Pick<MediaServerClient, 'search'>,
	albumName: string,
	artistName: string,
	signal?: AbortSignal
): Promise<CatalogLinkTarget> {
	const q = albumName.trim() || artistName.trim();
	if (!q) return { kind: 'search', q };
	const response: SearchResponse = await client.search({ q, limit: 50, signal });
	return resolveAlbumLink(response.albums.items, albumName, artistName);
}

const albumCoverCache = new Map<string, number | null>();

export function albumCoverCacheKey(albumName: string, artistName: string): string {
	return `${normalizeName(artistName)}|${normalizeName(albumName)}`;
}

export function clearAlbumCoverCache(): void {
	albumCoverCache.clear();
}

/**
 * Resolve an album cover_id for a track's artist+album strings via search.
 * Results are cached (including null misses) for the session.
 */
export async function resolveAlbumCoverId(
	client: Pick<MediaServerClient, 'search'>,
	albumName: string,
	artistName: string,
	signal?: AbortSignal
): Promise<number | null> {
	const key = albumCoverCacheKey(albumName, artistName);
	if (albumCoverCache.has(key)) {
		return albumCoverCache.get(key) ?? null;
	}

	const q = albumName.trim() || artistName.trim();
	if (!q) {
		albumCoverCache.set(key, null);
		return null;
	}

	const response: SearchResponse = await client.search({ q, limit: 50, signal });
	const target = resolveAlbumLink(response.albums.items, albumName, artistName);
	if (target.kind !== 'album') {
		albumCoverCache.set(key, null);
		return null;
	}

	const album = response.albums.items.find((item) => item.id === target.id);
	const coverId = album?.cover_id ?? null;
	albumCoverCache.set(key, coverId);
	return coverId;
}

export function catalogLinkHref(target: CatalogLinkTarget): string {
	switch (target.kind) {
		case 'artist':
			return `/artists/${target.id}`;
		case 'album':
			return `/albums/${target.id}`;
		case 'search':
			return `/search?q=${encodeURIComponent(target.q)}`;
	}
}

export async function gotoCatalogLink(target: CatalogLinkTarget): Promise<void> {
	if (target.kind === 'artist') {
		await goto(resolve(`/artists/${target.id}`));
		return;
	}
	if (target.kind === 'album') {
		await goto(resolve(`/albums/${target.id}`));
		return;
	}
	const searchPath = resolve('/search');
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- query appended after resolve()
	await goto(`${searchPath}?q=${encodeURIComponent(target.q)}`);
}
