# Client agent brief — media-server

Copy this file into a frontend/client repo (or paste it into an agent chat) as
the starting contract for talking to a running **media-server** instance.

The client only needs a **base URL** (host + port), e.g.
`http://192.168.5.111:8080` or `http://127.0.0.1:8080`. All paths below are
relative to that base. There is no auth and no API key.

For fuller server-side documentation, see the media-server `README.md`
(HTTP API section). Keep this brief in sync when endpoints change.

---

## What the server is

A lightweight C11 media library HTTP server. It scans a music directory,
exposes JSON browse/search APIs, and streams audio / serves cover art by
numeric ID.

- Default listen: `http://127.0.0.1:8080`
- CORS: `Access-Control-Allow-Origin: *` (browser clients from other origins OK)
- JSON `Content-Type: application/json`
- No TLS / no authentication — treat as a trusted LAN service
- Playlists, favourites, and history require the server to be started with
  `--user-db`; otherwise those routes return `400 {"error":"no_user_db"}`

### Development instance

- A live development server is normally available at
  `http://192.168.5.111:8080`.
- Use it for manual exploration, contract checks, and end-to-end development
  when reachable from the local network.
- Treat it as developer infrastructure, not a production default or a CI
  dependency. Automated tests must continue to use deterministic fixtures.
- Do not mutate playlists, favourites, history, metadata, or scan state on the
  shared server unless the current task requires it and the user has approved
  the mutation.

---

## Client bootstrap

1. Let the user enter a base URL (trim trailing `/`).
2. Probe `GET /api/ping` → `{"ok":true}`.
3. Optionally `GET /api/library/status` for counts / scan state.
4. Build media URLs as:
   - stream: `{base}/stream/{trackId}` (HTML5 `<audio>`, Range seeks work)
   - cover: `{base}/cover/{coverId}` (from album `cover_id`; may be `null`)

---

## Conventions

### Pagination

List endpoints accept `limit` (default **50**, clamped **1–200**) and `offset`.
Response envelope:

```json
{"items":[...],"total":123,"limit":50,"offset":0}
```

`total` is the unpaginated count.

### Errors

JSON body shape: `{"error":"<code>"}`. Common cases:

| Status | Meaning                                                |
| ------ | ------------------------------------------------------ |
| 400    | Bad query/body, or feature needs `--user-db` / library |
| 404    | Unknown id or wrong item kind                          |
| 409    | Conflict (e.g. scan already running, library busy)     |
| 500    | Server encode/update failure                           |

### IDs

- **Track / image** ids are catalog ids (stable across restarts when the server
  uses `--catalog-db`).
- **Artist / album** ids are synthetic (discovery order). Refetch after album
  metadata PATCH — regrouping can change album ids.
- Never send filesystem paths; only numeric ids.

---

## Core JSON shapes

**Track** (catalog audio item):

```json
{
	"id": 1,
	"kind": "audio",
	"path": "Artist/Album/track01.mp3",
	"filename": "track01.mp3",
	"artist": "Artist",
	"album": "Album",
	"title": "track01",
	"release_date": null,
	"genre": null,
	"track_number": null,
	"disc_number": null,
	"overridden_fields": []
}
```

**Artist:**

```json
{ "id": 1, "name": "Artist", "album_count": 2, "track_count": 10 }
```

**Album:**

```json
{
	"id": 1,
	"name": "Album",
	"artist": "Artist",
	"artist_id": 1,
	"track_count": 10,
	"release_date": null,
	"genre": null,
	"cover_id": 3
}
```

**Playlist:**

```json
{
	"id": 1,
	"name": "Mix",
	"track_count": 12,
	"created_unix": 1710000000,
	"updated_unix": 1710000000
}
```

**History item:** `{"track":{...Track...},"played_unix":1710000000}`

---

## Endpoints

### Health / library

| Method | Path                  | Notes                                                  |
| ------ | --------------------- | ------------------------------------------------------ |
| GET    | `/api/ping`           | `{"ok":true}`                                          |
| GET    | `/api/library/status` | `scanning`, counts, `last_error`, etc.                 |
| POST   | `/api/library/scan`   | Starts background rescan → `202`. `?force=1` restarts. |

### Catalog browse

| Method | Path                      | Notes                                      |
| ------ | ------------------------- | ------------------------------------------ |
| GET    | `/api/tracks`             | Paginated tracks                           |
| GET    | `/api/tracks/:id`         | One track                                  |
| PATCH  | `/api/tracks/:id`         | Metadata override (JSON subset; see below) |
| GET    | `/api/images`             | Paginated images                           |
| GET    | `/api/images/:id`         | One image                                  |
| GET    | `/api/artists`            | Paginated artists                          |
| GET    | `/api/artists/:id`        | One artist                                 |
| GET    | `/api/artists/:id/albums` | Albums for artist                          |
| GET    | `/api/albums`             | Paginated albums                           |
| GET    | `/api/albums/:id`         | One album                                  |
| PATCH  | `/api/albums/:id`         | Override all tracks in album               |
| GET    | `/api/albums/:id/tracks`  | Tracks on album                            |

### Search / discover

| Method | Path                            | Notes                                                                                             |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/search?q=<text>`          | Required `q`. Optional `fuzzy=1`. Returns `{q,fuzzy,tracks,artists,albums}` each a page envelope. |
| GET    | `/api/discover/random`          | Random tracks (paginated)                                                                         |
| GET    | `/api/discover/recent`          | Newest catalog tracks                                                                             |
| GET    | `/api/discover/recently-played` | From play history (needs user DB)                                                                 |

### User data (requires `--user-db`)

| Method | Path                        | Notes                                     |
| ------ | --------------------------- | ----------------------------------------- |
| GET    | `/api/playlists`            | List playlists                            |
| POST   | `/api/playlists`            | Body `{"name":"..."}` → `201`             |
| GET    | `/api/playlists/:id`        | One playlist                              |
| PATCH  | `/api/playlists/:id`        | Rename `{"name":"..."}`                   |
| DELETE | `/api/playlists/:id`        | Delete                                    |
| GET    | `/api/playlists/:id/tracks` | Playlist tracks                           |
| PUT    | `/api/playlists/:id/tracks` | Replace `{"track_ids":[1,2,...]}`         |
| GET    | `/api/favourites`           | Favourited tracks                         |
| PUT    | `/api/favourites/:id`       | Favourite track id                        |
| DELETE | `/api/favourites/:id`       | Unfavourite                               |
| GET    | `/api/history`              | Recently played (`track` + `played_unix`) |
| POST   | `/api/history`              | Record play `{"track_id":N}`              |

### Media (binary)

| Method | Path          | Notes                              |
| ------ | ------------- | ---------------------------------- |
| GET    | `/stream/:id` | Audio bytes; supports HTTP `Range` |
| GET    | `/cover/:id`  | Image bytes (use album `cover_id`) |

---

## Metadata PATCH bodies

`PATCH /api/tracks/:id` — any subset of:

```json
{
	"title": "Correct title",
	"artist": "Correct artist",
	"album": "Correct album",
	"release_date": "2024-03-02",
	"genre": "Rock",
	"track_number": 3,
	"disc_number": 1
}
```

- Dates: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`
- Omitted fields unchanged; `null` clears an override
- Does **not** rewrite files on disk

`PATCH /api/albums/:id` — `name`, `artist`, `release_date`, `genre`. Response:
`{"updated_track_count":N}`. Refetch albums afterward.

---

## Suggested UI surface

Minimum useful client:

1. Connect (base URL + ping)
2. Browse artists → albums → tracks
3. Search
4. Play via `/stream/:id` + show `/cover/:id` when `cover_id` present
5. Optional: favourites, playlists, history, discover, library scan/status

Gracefully degrade when user-db routes return `no_user_db`.

---

## Client product contract

Build a touch-first SvelteKit client inspired by the simplified YouTube Music
vehicle experience. It should be glanceable, low-distraction, and usable on a
wide landscape display as well as ordinary desktop and mobile screens. Do not
copy YouTube branding or assets.

### Information architecture

- Keep a persistent top-level search affordance.
- Provide large tab navigation for Home, Playlists, Songs, Albums, and
  Podcasts. Add Artists as a browse surface even if it is not a primary tab.
- Home is a dashboard of horizontal shelves/carousels for random discovery,
  recently played, playlists, favourites, and recently added tracks.
- Prefer cover-led grids and shelves for albums, artists, and playlists. Songs
  may use a large, sparse list where that is easier to scan.
- Keep playback available across navigation in a persistent player overlay.
  The compact player must expose artwork, title/artist, play/pause, previous,
  next, progress, and a way to open a larger now-playing view.
- The current server has no podcast model or endpoint. Keep Podcasts clearly
  empty/disabled until the server contract supports it; do not infer podcasts
  from music metadata.

### Vehicle-oriented interaction

- Use a dark, high-contrast visual system with a strong selected/focus state.
- Default touch targets to at least 56 by 56 CSS pixels; use at least 64 pixels
  for primary playback and navigation controls where space permits.
- Keep labels visible for primary navigation; never rely on icons alone.
- Avoid dense menus, hover-only actions, tiny controls, and interaction-heavy
  gestures. Carousels must also work with buttons, keyboard, and touch.
- Respect safe-area insets, reduced motion, keyboard navigation, semantic HTML,
  focus visibility, and WCAG contrast. Do not make safety/compliance claims.
- Loading, empty, offline, disconnected, and server-feature-unavailable states
  are first-class UI states, not afterthoughts.

## Client engineering contract

### SvelteKit and TypeScript

- Use Svelte 5 runes mode and current SvelteKit conventions. Avoid legacy
  `$:`, `export let`, `on:click`, slots, and unnecessary writable stores.
- Define component props with named TypeScript interfaces and destructure them
  from `$props()`. Keep props focused; use snippets for composable content.
- Use `$derived` for computed state and reserve `$effect` for synchronization
  with external systems such as `HTMLAudioElement`.
- Key rendered collections by stable ids, never array indexes.
- Keep route components thin. Put reusable UI in `$lib/components`, media-server
  access in `$lib/api`, and shared reactive state in focused `.svelte.ts`
  classes provided through typed context.
- Never place request-specific mutable state in a server module where it could
  leak between users.

### Data and validation

- Treat every media-server response as untrusted input. Define shared domain
  types and Zod schemas at the API boundary; infer TypeScript types from schemas
  where practical.
- Use one typed API client for URL construction, query encoding, pagination,
  status handling, abort signals, and normalized errors. Components must not
  assemble endpoint URLs directly.
- The base URL is user-supplied and can point to a browser-local LAN address.
  Prefer browser-side API calls and persist the normalized URL locally. Do not
  assume the SvelteKit server can reach it.
- Model `no_user_db`, disconnected, 404, 409, and malformed responses
  explicitly. Feature shelves may disappear or show an explanation, but the
  rest of the app must remain usable.
- Use `sveltekit-superforms` with Zod for nontrivial forms and mutations. A
  simple instant search box or media control does not need to be forced into a
  form abstraction.
- Refetch artist/album groupings after album metadata changes because their ids
  can change.

### Playback

- Own the single `HTMLAudioElement` and queue in a layout-scoped player
  controller so playback survives client-side route navigation.
- Keep media state separate from catalog-fetching state. Handle play promise
  rejection, buffering, seeking, ended/error events, and unavailable tracks.
- Record history only after meaningful playback begins; avoid duplicate history
  writes caused by rerenders or route changes.
- Build stream and cover URLs through the API client. Cover art always needs a
  useful fallback.

### Styling and components

- Use Tailwind CSS and a small token layer for color, spacing, radii, type, touch
  target sizes, shelf dimensions, and player height.
- Create reusable primitives before duplicating patterns: tab bar, media card,
  media grid, shelf/carousel, track row, icon button, status panel, skeleton,
  cover fallback, and player controls.
- Favor CSS grid with responsive `minmax()` sizing and horizontal scroll
  snapping for shelves. Avoid JavaScript layout calculations unless required.

### Test-driven development

- Work red-green-refactor: add a failing behavior-focused test, implement the
  smallest change, then clean up while tests stay green.
- Use Vitest node tests for schemas, API helpers, queue logic, and pure
  utilities; Vitest browser tests for Svelte behavior and accessibility; and
  Playwright for a small set of critical user journeys.
- Test observable behavior rather than component internals. Use role/name
  queries and realistic keyboard/pointer interaction.
- Keep deterministic API fixtures for healthy, empty, paginated, malformed,
  disconnected, and `no_user_db` responses. Never depend on a live media server
  in CI.
- Every bug fix needs a regression test. Do not weaken assertions merely to
  make a test pass.
- Before handing off substantive work, run the relevant tests plus
  `pnpm check` and `pnpm lint`; run `pnpm test` when the change warrants the
  full suite.

## Development workflow

- Use `DEVELOPMENT.md` as the implementation roadmap and update its status,
  decisions, and acceptance criteria as work progresses.
- Keep changes small and vertical: schema/client behavior, UI state, and tests
  should land together for one user-visible capability.
- Do not add a dependency when a platform or Svelte primitive is sufficient.
  When a dependency is justified, add it with pnpm and document its purpose.
- Follow the official Svelte documentation and validate edited Svelte
  components with the Svelte autofixer before handoff.
