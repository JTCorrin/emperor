export const MB_CONTACT_STORAGE_KEY = 'emperor:musicbrainz-contact';
export const MB_APPLY_COVER_STORAGE_KEY = 'emperor:musicbrainz-apply-cover';

export type MusicBrainzSettings = {
	contact: string;
	applyCoverOnLookup: boolean;
};

export type MusicBrainzStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): MusicBrainzStorage | null {
	return typeof localStorage === 'undefined' ? null : localStorage;
}

export function loadMusicBrainzSettings(
	storage: MusicBrainzStorage | null = defaultStorage()
): MusicBrainzSettings {
	const contact = storage?.getItem(MB_CONTACT_STORAGE_KEY)?.trim() ?? '';
	const applyRaw = storage?.getItem(MB_APPLY_COVER_STORAGE_KEY);
	return {
		contact,
		applyCoverOnLookup: applyRaw === '1' || applyRaw === 'true'
	};
}

export function saveMusicBrainzSettings(
	settings: MusicBrainzSettings,
	storage: MusicBrainzStorage | null = defaultStorage()
): void {
	if (!storage) return;
	const contact = settings.contact.trim();
	if (contact) {
		storage.setItem(MB_CONTACT_STORAGE_KEY, contact);
	} else {
		storage.removeItem(MB_CONTACT_STORAGE_KEY);
	}
	storage.setItem(MB_APPLY_COVER_STORAGE_KEY, settings.applyCoverOnLookup ? '1' : '0');
}

export function hasMusicBrainzContact(
	storage: MusicBrainzStorage | null = defaultStorage()
): boolean {
	return loadMusicBrainzSettings(storage).contact.length > 0;
}
