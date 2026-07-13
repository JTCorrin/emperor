import { describe, expect, it } from 'vitest';
import {
	connectFormSchema,
	historyItemSchema,
	libraryStatusSchema,
	pingResponseSchema,
	playlistSchema,
	trackPageSchema,
	trackSchema
} from '$lib/api/schemas';
import {
	historyItemFixture,
	libraryStatusFixture,
	pingFixture,
	playlistFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

describe('API schemas', () => {
	it('accepts a ping response', () => {
		expect(pingResponseSchema.parse(pingFixture())).toEqual({ ok: true });
	});

	it('accepts library status', () => {
		expect(libraryStatusSchema.parse(libraryStatusFixture())).toMatchObject({
			has_library: true,
			track_count: 10
		});
	});

	it('accepts track and track page envelopes', () => {
		const track = trackFixture({ id: 7, title: 'Hello' });
		expect(trackSchema.parse(track)).toEqual(track);
		expect(trackPageSchema.parse(trackPageFixture([track]))).toMatchObject({
			total: 1,
			items: [track]
		});
	});

	it('accepts playlist and history items', () => {
		expect(playlistSchema.parse(playlistFixture())).toMatchObject({ name: 'Mix' });
		expect(historyItemSchema.parse(historyItemFixture())).toMatchObject({
			played_unix: 1_710_000_000,
			track: { id: 1 }
		});
	});

	it('validates connect form URLs', () => {
		expect(connectFormSchema.parse({ baseUrl: ' http://192.168.5.111:8080 ' })).toEqual({
			baseUrl: 'http://192.168.5.111:8080'
		});
		expect(connectFormSchema.safeParse({ baseUrl: 'not-a-url' }).success).toBe(false);
	});
});
