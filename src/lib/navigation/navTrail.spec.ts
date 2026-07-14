import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearNavTrail,
	getBackTarget,
	labelFromPath,
	NAV_TRAIL_MAX,
	NAV_TRAIL_STORAGE_KEY,
	readNavTrail,
	recordNavPath,
	setNavTrailLabel,
	writeNavTrail
} from './navTrail';

function memoryStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		dump: () => Object.fromEntries(store)
	};
}

describe('labelFromPath', () => {
	it('maps known routes to display labels', () => {
		expect(labelFromPath('/search')).toBe('Search');
		expect(labelFromPath('/search?q=browse')).toBe('Search');
		expect(labelFromPath('/artists')).toBe('Artists');
		expect(labelFromPath('/artists/3')).toBe('Artist');
		expect(labelFromPath('/albums/7')).toBe('Album');
		expect(labelFromPath('/playlists/2')).toBe('Playlist');
		expect(labelFromPath('/')).toBe('Home');
	});
});

describe('nav trail', () => {
	let storage: ReturnType<typeof memoryStorage>;

	beforeEach(() => {
		storage = memoryStorage();
	});

	it('pushes paths and skips consecutive duplicates', () => {
		recordNavPath('/search?q=a', undefined, storage);
		recordNavPath('/search?q=a', undefined, storage);
		recordNavPath('/artists/3', undefined, storage);

		expect(readNavTrail(storage)).toEqual([
			{ path: '/search?q=a', label: 'Search' },
			{ path: '/artists/3', label: 'Artist' }
		]);
	});

	it('truncates when revisiting an earlier path', () => {
		recordNavPath('/search?q=a', undefined, storage);
		recordNavPath('/artists/3', undefined, storage);
		recordNavPath('/albums/7', undefined, storage);
		recordNavPath('/artists/3', undefined, storage);

		expect(readNavTrail(storage)).toEqual([
			{ path: '/search?q=a', label: 'Search' },
			{ path: '/artists/3', label: 'Artist' }
		]);
	});

	it('caps trail length', () => {
		for (let i = 0; i < NAV_TRAIL_MAX + 5; i++) {
			recordNavPath(`/songs?page=${i}`, undefined, storage);
		}
		const trail = readNavTrail(storage);
		expect(trail).toHaveLength(NAV_TRAIL_MAX);
		expect(trail[0]?.path).toBe('/songs?page=5');
		expect(trail.at(-1)?.path).toBe(`/songs?page=${NAV_TRAIL_MAX + 4}`);
	});

	it('returns fallback when trail is empty', () => {
		expect(
			getBackTarget(
				{ fallbackHref: '/artists', fallbackLabel: 'artists', currentPath: '/artists/3' },
				storage
			)
		).toEqual({ href: '/artists', label: 'artists' });
	});

	it('returns previous entry as back target', () => {
		recordNavPath('/search?q=browse', undefined, storage);
		recordNavPath('/artists/3', undefined, storage);

		expect(
			getBackTarget(
				{ fallbackHref: '/artists', fallbackLabel: 'artists', currentPath: '/artists/3' },
				storage
			)
		).toEqual({ href: '/search?q=browse', label: 'Search' });
	});

	it('updates labels for an existing entry', () => {
		recordNavPath('/artists/3', undefined, storage);
		setNavTrailLabel('/artists/3', 'Browse Artist', storage);
		expect(readNavTrail(storage)).toEqual([{ path: '/artists/3', label: 'Browse Artist' }]);
	});

	it('ignores corrupt storage payloads', () => {
		storage.setItem(NAV_TRAIL_STORAGE_KEY, 'not-json');
		expect(readNavTrail(storage)).toEqual([]);
		writeNavTrail([{ path: '/search', label: 'Search' }], storage);
		expect(readNavTrail(storage)).toEqual([{ path: '/search', label: 'Search' }]);
		clearNavTrail(storage);
		expect(readNavTrail(storage)).toEqual([]);
	});
});
