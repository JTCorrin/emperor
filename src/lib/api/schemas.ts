import { z } from 'zod';

export const pingResponseSchema = z.object({
	ok: z.literal(true)
});

export const libraryStatusSchema = z.object({
	scanning: z.boolean(),
	has_library: z.boolean(),
	library_dir: z.string(),
	last_scan_unix: z.number().nullable().optional(),
	last_scan_ok: z.boolean().optional(),
	last_error: z.string().optional(),
	track_count: z.number().int().nonnegative(),
	image_count: z.number().int().nonnegative(),
	artist_count: z.number().int().nonnegative(),
	album_count: z.number().int().nonnegative()
});

export const errorBodySchema = z.object({
	error: z.string()
});

export const connectFormSchema = z.object({
	baseUrl: z
		.string()
		.trim()
		.min(1, 'Base URL is required')
		.refine((value) => {
			try {
				const parsed = new URL(value);
				return parsed.protocol === 'http:' || parsed.protocol === 'https:';
			} catch {
				return false;
			}
		}, 'Enter a valid http or https URL')
});

export const trackSchema = z.object({
	id: z.number().int().positive(),
	kind: z.literal('audio'),
	path: z.string(),
	filename: z.string(),
	artist: z.string(),
	album: z.string(),
	title: z.string(),
	release_date: z.string().nullable(),
	genre: z.string().nullable(),
	track_number: z.number().int().nullable(),
	disc_number: z.number().int().nullable(),
	overridden_fields: z.array(z.string())
});

export function pageEnvelopeSchema<T extends z.ZodType>(itemSchema: T) {
	return z.object({
		items: z.array(itemSchema),
		total: z.number().int().nonnegative(),
		limit: z.number().int().positive(),
		offset: z.number().int().nonnegative()
	});
}

export const trackPageSchema = pageEnvelopeSchema(trackSchema);

export const playlistSchema = z.object({
	id: z.number().int().positive(),
	name: z.string(),
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

export type PingResponse = z.infer<typeof pingResponseSchema>;
export type LibraryStatus = z.infer<typeof libraryStatusSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ConnectForm = z.infer<typeof connectFormSchema>;
export type Track = z.infer<typeof trackSchema>;
export type TrackPage = z.infer<typeof trackPageSchema>;
export type Playlist = z.infer<typeof playlistSchema>;
export type PlaylistPage = z.infer<typeof playlistPageSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export type PageEnvelope<T> = {
	items: T[];
	total: number;
	limit: number;
	offset: number;
};
