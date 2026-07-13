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

export type PingResponse = z.infer<typeof pingResponseSchema>;
export type LibraryStatus = z.infer<typeof libraryStatusSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ConnectForm = z.infer<typeof connectFormSchema>;
