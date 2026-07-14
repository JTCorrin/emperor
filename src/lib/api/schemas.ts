import { z } from 'zod';
import { normalizeBaseUrl } from './url';

const MAX_SERVER_STRING_LENGTH = 2048;
const MAX_PAGE_ITEMS = 200;
const serverString = z.string().max(MAX_SERVER_STRING_LENGTH);

export const pingResponseSchema = z.object({
	ok: z.literal(true)
});

export const libraryStatusSchema = z.object({
	scanning: z.boolean(),
	has_library: z.boolean(),
	library_dir: serverString,
	last_scan_unix: z.number().nullable().optional(),
	last_scan_ok: z.boolean().optional(),
	last_error: serverString.optional(),
	track_count: z.number().int().nonnegative(),
	image_count: z.number().int().nonnegative(),
	artist_count: z.number().int().nonnegative(),
	album_count: z.number().int().nonnegative()
});

export const errorBodySchema = z.object({
	error: serverString
});

export const connectFormSchema = z.object({
	baseUrl: z
		.string()
		.trim()
		.min(1, 'Base URL is required')
		.refine((value) => {
			try {
				normalizeBaseUrl(value);
				return true;
			} catch {
				return false;
			}
		}, 'Enter a valid http or https URL')
});

export const playlistNameBodySchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(200)
});

export const playlistTracksBodySchema = z.object({
	track_ids: z.array(z.number().int().positive())
});

export const trackSchema = z.object({
	id: z.number().int().positive(),
	kind: z.literal('audio'),
	path: serverString,
	filename: serverString,
	artist: serverString,
	album: serverString,
	title: serverString,
	release_date: serverString.nullable(),
	genre: serverString.nullable(),
	track_number: z.number().int().nullable(),
	disc_number: z.number().int().nullable(),
	overridden_fields: z.array(z.string().max(100)).max(32)
});

export function pageEnvelopeSchema<T extends z.ZodType>(itemSchema: T) {
	return z.object({
		items: z.array(itemSchema).max(MAX_PAGE_ITEMS),
		total: z.number().int().nonnegative(),
		limit: z.number().int().positive().max(MAX_PAGE_ITEMS),
		offset: z.number().int().nonnegative()
	});
}

export const trackPageSchema = pageEnvelopeSchema(trackSchema);

export const playlistSchema = z.object({
	id: z.number().int().positive(),
	name: serverString,
	track_count: z.number().int().nonnegative(),
	created_unix: z.number().int(),
	updated_unix: z.number().int()
});

export const playlistPageSchema = pageEnvelopeSchema(playlistSchema);

export const historyItemSchema = z.object({
	track: trackSchema,
	played_unix: z.number().int()
});

export const historyPageSchema = pageEnvelopeSchema(historyItemSchema);

export const artistSchema = z.object({
	id: z.number().int().positive(),
	name: serverString,
	album_count: z.number().int().nonnegative(),
	track_count: z.number().int().nonnegative()
});

export const artistPageSchema = pageEnvelopeSchema(artistSchema);

export const albumSchema = z.object({
	id: z.number().int().positive(),
	name: serverString,
	artist: serverString,
	artist_id: z.number().int().positive(),
	track_count: z.number().int().nonnegative(),
	release_date: serverString.nullable(),
	genre: serverString.nullable(),
	cover_id: z.number().int().positive().nullable()
});

export const albumPageSchema = pageEnvelopeSchema(albumSchema);

export const searchResponseSchema = z.object({
	q: serverString,
	fuzzy: z.boolean(),
	tracks: trackPageSchema,
	artists: artistPageSchema,
	albums: albumPageSchema
});

export const releaseDateSchema = z
	.string()
	.regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Use YYYY, YYYY-MM, or YYYY-MM-DD');

export const trackMetadataPatchSchema = z
	.object({
		title: z.string().trim().min(1).nullable().optional(),
		artist: z.string().trim().min(1).nullable().optional(),
		album: z.string().trim().min(1).nullable().optional(),
		release_date: releaseDateSchema.nullable().optional(),
		genre: z.string().trim().min(1).nullable().optional(),
		track_number: z.number().int().nonnegative().nullable().optional(),
		disc_number: z.number().int().nonnegative().nullable().optional()
	})
	.strict();

export const albumMetadataPatchSchema = z
	.object({
		name: z.string().trim().min(1).nullable().optional(),
		artist: z.string().trim().min(1).nullable().optional(),
		release_date: releaseDateSchema.nullable().optional(),
		genre: z.string().trim().min(1).nullable().optional()
	})
	.strict();

export const albumPatchResponseSchema = z.object({
	updated_track_count: z.number().int().nonnegative()
});

/** Response from PUT /api/albums/:id/cover (202). */
export const albumCoverUploadResponseSchema = z.object({
	ok: z.literal(true),
	path: z.string(),
	scan: z.string()
});

/** Form-facing track edit values (strings for inputs). */
export const trackMetadataFormSchema = z.object({
	title: z.string(),
	artist: z.string(),
	album: z.string(),
	release_date: z
		.string()
		.refine(
			(value) => value === '' || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value),
			'Use YYYY, YYYY-MM, or YYYY-MM-DD'
		),
	genre: z.string(),
	track_number: z
		.string()
		.refine((value) => value === '' || /^(0|[1-9]\d*)$/.test(value), 'Enter a nonnegative integer'),
	disc_number: z
		.string()
		.refine((value) => value === '' || /^(0|[1-9]\d*)$/.test(value), 'Enter a nonnegative integer')
});

export const albumMetadataFormSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	artist: z.string().min(1, 'Artist is required'),
	release_date: z
		.string()
		.refine(
			(value) => value === '' || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value),
			'Use YYYY, YYYY-MM, or YYYY-MM-DD'
		),
	genre: z.string()
});

export type PingResponse = z.infer<typeof pingResponseSchema>;
export type LibraryStatus = z.infer<typeof libraryStatusSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ConnectForm = z.infer<typeof connectFormSchema>;
export type PlaylistNameBody = z.infer<typeof playlistNameBodySchema>;
export type PlaylistTracksBody = z.infer<typeof playlistTracksBodySchema>;
export type Track = z.infer<typeof trackSchema>;
export type TrackPage = z.infer<typeof trackPageSchema>;
export type Playlist = z.infer<typeof playlistSchema>;
export type PlaylistPage = z.infer<typeof playlistPageSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export type Artist = z.infer<typeof artistSchema>;
export type ArtistPage = z.infer<typeof artistPageSchema>;
export type Album = z.infer<typeof albumSchema>;
export type AlbumPage = z.infer<typeof albumPageSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type TrackMetadataPatch = z.infer<typeof trackMetadataPatchSchema>;
export type AlbumMetadataPatch = z.infer<typeof albumMetadataPatchSchema>;
export type AlbumPatchResponse = z.infer<typeof albumPatchResponseSchema>;
export type AlbumCoverUploadResponse = z.infer<typeof albumCoverUploadResponseSchema>;
export type TrackMetadataForm = z.infer<typeof trackMetadataFormSchema>;
export type AlbumMetadataForm = z.infer<typeof albumMetadataFormSchema>;
export type PageEnvelope<T> = {
	items: T[];
	total: number;
	limit: number;
	offset: number;
};
