export type MediaServerErrorKind = 'network' | 'http' | 'schema' | 'no_user_db' | 'aborted';

export type MediaServerError = {
	kind: MediaServerErrorKind;
	message: string;
	status?: number;
	code?: string;
	cause?: unknown;
};

export function isMediaServerError(value: unknown): value is MediaServerError {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		'message' in value &&
		typeof (value as MediaServerError).kind === 'string' &&
		typeof (value as MediaServerError).message === 'string'
	);
}

export function networkError(cause?: unknown): MediaServerError {
	return {
		kind: 'network',
		message: 'Could not reach the media server',
		cause
	};
}

export function abortedError(cause?: unknown): MediaServerError {
	return {
		kind: 'aborted',
		message: 'Request was aborted',
		cause
	};
}

export function httpError(status: number, code?: string): MediaServerError {
	if (code === 'no_user_db') {
		return {
			kind: 'no_user_db',
			message: 'This server was started without a user database',
			status,
			code
		};
	}

	return {
		kind: 'http',
		message: code ? `Request failed: ${code}` : `Request failed with status ${status}`,
		status,
		code
	};
}

export function schemaError(cause?: unknown): MediaServerError {
	return {
		kind: 'schema',
		message: 'Server response did not match the expected shape',
		cause
	};
}
