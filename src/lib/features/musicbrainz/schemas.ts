import { z } from 'zod';

const artistCreditSchema = z
	.object({
		name: z.string().optional(),
		artist: z.object({ name: z.string().optional() }).partial().optional()
	})
	.partial();

const releaseRefSchema = z
	.object({
		id: z.string(),
		title: z.string().optional(),
		date: z.string().optional(),
		media: z
			.array(
				z
					.object({
						position: z.number().optional(),
						track: z
							.array(
								z
									.object({
										number: z.string().optional(),
										position: z.number().optional()
									})
									.partial()
							)
							.optional()
					})
					.partial()
			)
			.optional()
	})
	.partial()
	.extend({ id: z.string() });

export const mbRecordingSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	'artist-credit': z.array(artistCreditSchema).optional(),
	releases: z.array(releaseRefSchema).optional(),
	tags: z.array(z.object({ name: z.string(), count: z.number().optional() }).partial()).optional()
});

export const mbRecordingSearchSchema = z.object({
	recordings: z.array(mbRecordingSchema).default([])
});

export const mbReleaseSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	date: z.string().optional(),
	'artist-credit': z.array(artistCreditSchema).optional(),
	'tag-list': z.array(z.object({ name: z.string() }).partial()).optional(),
	tags: z.array(z.object({ name: z.string(), count: z.number().optional() }).partial()).optional(),
	'release-group': z
		.object({
			tags: z
				.array(z.object({ name: z.string(), count: z.number().optional() }).partial())
				.optional()
		})
		.partial()
		.optional()
});

export const mbReleaseSearchSchema = z.object({
	releases: z.array(mbReleaseSchema).default([])
});

export type MbRecording = z.infer<typeof mbRecordingSchema>;
export type MbRelease = z.infer<typeof mbReleaseSchema>;
