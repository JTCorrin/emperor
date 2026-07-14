export const NAV_TRAIL_STORAGE_KEY = 'emperor:nav-trail';
export const NAV_TRAIL_MAX = 20;

export type NavTrailEntry = {
	path: string;
	label: string;
};

export type NavTrailStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
};

export type BackTarget = {
	href: string;
	label: string;
};

function defaultStorage(): NavTrailStorage | null {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage;
}

/** Normalize to pathname + search (no hash). */
export function normalizeNavPath(path: string): string {
	try {
		const url = path.startsWith('http') ? new URL(path) : new URL(path, 'http://emperor.local');
		return `${url.pathname}${url.search}`;
	} catch {
		return path;
	}
}

export function labelFromPath(path: string): string {
	const pathname = normalizeNavPath(path).split('?')[0] ?? path;

	if (pathname === '/') return 'Home';
	if (pathname === '/search') return 'Search';
	if (pathname === '/artists') return 'Artists';
	if (pathname.startsWith('/artists/')) return 'Artist';
	if (pathname === '/albums') return 'Albums';
	if (pathname.startsWith('/albums/')) return 'Album';
	if (pathname === '/playlists') return 'Playlists';
	if (pathname.startsWith('/playlists/')) return 'Playlist';
	if (pathname === '/songs') return 'Songs';
	if (pathname === '/favourites') return 'Favourites';
	if (pathname === '/history') return 'History';
	if (pathname === '/connect') return 'Connect';
	if (pathname === '/podcasts') return 'Podcasts';

	const segment = pathname.split('/').filter(Boolean).at(-1);
	if (!segment) return 'Back';
	return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function readNavTrail(storage: NavTrailStorage | null = defaultStorage()): NavTrailEntry[] {
	if (!storage) return [];
	try {
		const raw = storage.getItem(NAV_TRAIL_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(entry): entry is NavTrailEntry =>
					!!entry &&
					typeof entry === 'object' &&
					typeof (entry as NavTrailEntry).path === 'string' &&
					typeof (entry as NavTrailEntry).label === 'string'
			)
			.map((entry) => ({
				path: normalizeNavPath(entry.path),
				label: entry.label
			}));
	} catch {
		return [];
	}
}

export function writeNavTrail(
	entries: NavTrailEntry[],
	storage: NavTrailStorage | null = defaultStorage()
): void {
	if (!storage) return;
	storage.setItem(NAV_TRAIL_STORAGE_KEY, JSON.stringify(entries.slice(-NAV_TRAIL_MAX)));
}

export function clearNavTrail(storage: NavTrailStorage | null = defaultStorage()): void {
	if (!storage) return;
	storage.removeItem?.(NAV_TRAIL_STORAGE_KEY);
	if (!storage.removeItem) {
		storage.setItem(NAV_TRAIL_STORAGE_KEY, '[]');
	}
}

/**
 * Record a visited path. Skips consecutive duplicates; if the path already
 * appears earlier in the trail (e.g. contextual Back), truncates to that entry.
 */
export function recordNavPath(
	path: string,
	label?: string,
	storage: NavTrailStorage | null = defaultStorage()
): void {
	if (!storage) return;
	const normalized = normalizeNavPath(path);
	if (!normalized || normalized === '') return;

	const entry: NavTrailEntry = {
		path: normalized,
		label: label?.trim() || labelFromPath(normalized)
	};

	const trail = readNavTrail(storage);
	const existing = trail.findIndex((item) => item.path === normalized);
	if (existing >= 0) {
		const next = trail.slice(0, existing + 1);
		if (label?.trim()) {
			next[existing] = entry;
		}
		writeNavTrail(next, storage);
		return;
	}

	if (trail.at(-1)?.path === normalized) {
		if (label?.trim()) {
			const next = [...trail];
			next[next.length - 1] = entry;
			writeNavTrail(next, storage);
		}
		return;
	}

	writeNavTrail([...trail, entry], storage);
}

/** Update the label for an existing trail entry (e.g. artist name after load). */
export function setNavTrailLabel(
	path: string,
	label: string,
	storage: NavTrailStorage | null = defaultStorage()
): void {
	if (!storage) return;
	const trimmed = label.trim();
	if (!trimmed) return;
	const normalized = normalizeNavPath(path);
	const trail = readNavTrail(storage);
	const index = trail.findIndex((item) => item.path === normalized);
	if (index < 0) return;
	const next = [...trail];
	next[index] = { path: normalized, label: trimmed };
	writeNavTrail(next, storage);
}

export function getBackTarget(
	options: {
		fallbackHref: string;
		fallbackLabel: string;
		currentPath?: string;
	},
	storage: NavTrailStorage | null = defaultStorage()
): BackTarget {
	const fallback: BackTarget = {
		href: options.fallbackHref,
		label: options.fallbackLabel
	};
	const current = options.currentPath
		? normalizeNavPath(options.currentPath)
		: typeof location !== 'undefined'
			? normalizeNavPath(`${location.pathname}${location.search}`)
			: '';

	const trail = readNavTrail(storage);
	for (let i = trail.length - 1; i >= 0; i--) {
		const entry = trail[i];
		if (!entry) continue;
		if (current && entry.path === current) continue;
		return { href: entry.path, label: entry.label };
	}
	return fallback;
}
