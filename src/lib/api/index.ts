export {
	createMediaServerClient,
	MediaServerRequestError,
	type FetchLike,
	type MediaServerClient,
	type MediaServerClientOptions,
	type PaginationQuery,
	type SearchQuery
} from './client';
export {
	abortedError,
	httpError,
	isMediaServerError,
	networkError,
	schemaError,
	type MediaServerError,
	type MediaServerErrorKind
} from './errors';
export {
	albumPageSchema,
	albumSchema,
	artistPageSchema,
	artistSchema,
	connectFormSchema,
	errorBodySchema,
	historyItemSchema,
	historyPageSchema,
	libraryStatusSchema,
	pageEnvelopeSchema,
	pingResponseSchema,
	playlistPageSchema,
	playlistSchema,
	searchResponseSchema,
	trackPageSchema,
	trackSchema,
	type Album,
	type AlbumPage,
	type Artist,
	type ArtistPage,
	type ConnectForm,
	type ErrorBody,
	type HistoryItem,
	type HistoryPage,
	type LibraryStatus,
	type PageEnvelope,
	type PingResponse,
	type Playlist,
	type PlaylistPage,
	type SearchResponse,
	type Track,
	type TrackPage
} from './schemas';
export { apiUrl, BaseUrlError, coverUrl, normalizeBaseUrl, streamUrl } from './url';
