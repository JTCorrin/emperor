import { describe, expect, it } from 'vitest';
import { MediaServerRequestError } from '$lib/api/client';
import { httpError } from '$lib/api/errors';
import { albumFixture } from '$lib/test/fixtures';
import { refetchAlbumAfterPatch } from './albumRegroup';

describe('refetchAlbumAfterPatch', () => {
	it('returns the album when refetch succeeds', async () => {
		const album = albumFixture({ id: 9, name: 'Still here' });
		await expect(refetchAlbumAfterPatch(async () => album, 9)).resolves.toEqual({
			kind: 'ok',
			album
		});
	});

	it('maps 404 to regrouped', async () => {
		await expect(
			refetchAlbumAfterPatch(async () => {
				throw new MediaServerRequestError(httpError(404, 'not_found'));
			}, 9)
		).resolves.toEqual({ kind: 'regrouped' });
	});

	it('maps other failures to an actionable error result', async () => {
		await expect(
			refetchAlbumAfterPatch(async () => {
				throw new TypeError('network unavailable');
			}, 9)
		).resolves.toEqual({ kind: 'error', message: 'network unavailable' });
	});
});
