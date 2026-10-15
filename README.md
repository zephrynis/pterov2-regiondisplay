# Region Display 1.0.1

Current release targets **Panel 2.0.0-beta.2 / SDK 2.0.0-beta.6**. See `SDK_PROVENANCE.md` for the pinned revision and documentation discrepancy. Compatibility and validation notes mentioning older builds below are historical. Install `release/regiondisplay-1.0.1.pteroext`.

Assign a country and optional region name to a Pterodactyl v2 location. Servers inherit the region from their current node’s location, displaying a local SVG flag and name on the Servers list and beside the server name on the console.

## Usage

Open **Admin → Locations → a location**. The **Region Display** card appears below the native location details. Search for a country by name or two-letter code, optionally enter a display name such as **US East**, and choose **Save region**. Region changes save separately from the location’s native details. **Clear region** removes the assignment; unassigned locations show no server badge. Countries default to their bundled English names when the display name is blank. The selector contains 249 ISO countries and territories.

Only root administrators can read or change location assignments. Server owners and subusers with current server access can see the inherited region. There is no per-server override or extra subuser permission. A completed server transfer or node location change follows the current location on the next lookup. Server views refresh region data every minute while visible, on stale window focus/reconnect, or after reloading. Saving locally invalidates region queries in that browser; other sessions pick up changes on their next lookup.

Failed lookups show a small unavailable indicator without blocking native server controls. The console offers retry; on the server list, reload or wait for the next refresh. Unassigned and inaccessible servers both return no region. A failed refresh hides stale region data. Flags are packaged with the extension; no third-party image requests or platform emoji support are needed.

## Compatibility and integration

Targets the native v2 extension system, Panel `>=2.0.0-dev <2.0.0-beta.3`, SDK `>=2.0.0-beta.6 <2.0.0-beta.7`, and PHP `>=8.3 <9`. Baseline revision: `ea742d332f5861a81e502857446b8df9cb9f0254`. The Panel's compatibility API still reports `2.0.0-dev`. DOM-based console-heading placement requires browser retesting on new themes/builds.

The extension contributes to `panel.locations.detail.after`, `dashboard.serverRow.name.after`, `dashboard.serverRow.after`, and `server.console.before`. On desktop (1024px and wider), the server-list badge appears inline beside the server identity, with long labels truncated and the full name available on hover. On smaller screens it occupies its own line inside each card, keeping server names and tags readable. CSS shows only the matching placement; both mounts share the same user/server query cache and do not add a duplicate lookup. It declares no component replacements and coexists with Server Tags. Third-party card replacements need to retain the native identity slot for the desktop badge; the smaller-screen row slot is outside the replacement. Core Panel files, server list queries, pagination, and navigation remain owned by the Panel.

The console badge uses an extension-owned portal host beside the native heading because this SDK has no console-title slot. It does not move native nodes or change Panel source. Scoped CSS aligns the heading and badge at the left and retains the description below. Mobile uses a compact name-and-region row because the native title is hidden there. Late headings and replaced ancestor wrappers are detected during navigation. A missing native heading falls back to the slot; subscriptions and the host are removed when unmounting. This placement depends on the inspected console heading structure and requires verification after Panel updates.

`vendor/sdk` is a development-only snapshot of `/app/packages/sdk` in the current Panel container. Preserve its provenance and the lockfile unless intentionally upgrading. The SDK Vite preset supplies native-mode builds and externalizes the shared React, SDK, and TanStack Query runtimes. `.npmrc` skips automatic peer installation because runtime peers are supplied by the Panel; the types and test dependencies used here are explicit development dependencies.

References: [v2 extensions](https://docs.pterodactyl.io/v2/extensions), [building extensions](https://docs.pterodactyl.io/v2/extensions/building), [API reference](https://docs.pterodactyl.io/v2/extensions/reference). Documentation snapshot: October 5, 2026, commit `e8a2455e83ee310a0a58e87857cf33b389ca9011`.

## Development

Use Node.js 22.12 or newer, npm, and Python 3:

```sh
npm ci
npm run check
npm run package
```

`check` prepares the country catalog and flag files, checks TypeScript, runs mocked frontend behavior tests, and builds the native extension. `package` creates `release/regiondisplay-1.0.1.pteroext` with the manifest at its root, PHP backend, migrations, country data, attribution, and all built assets including the frontend source map. It excludes development dependencies, the SDK snapshot, tests, and unbuilt frontend source files. `npm run assets` regenerates `resources/countries.json`, the flag license, and ignored `generated/flags` from the pinned MIT-licensed `flag-icons` package. See `resources/flag-icons.LICENSE` for attribution.

Backend validation runs in the Panel PHP runtime against isolated in-memory SQLite. Stage only `src`, `resources`, `database`, and `tests` in a temporary container directory and run `php /tmp/regiondisplay-backend/tests/backend.php`. The harness expects Panel code at `/app`; it does not use the persistent Panel database for fixtures. It covers administrator authorization, owner/subuser visibility, revoked access, bulk query bounds and efficiency, validation, label defaults, clearing, transfer/node-location changes, foreign-key cleanup, and migration rollback.

Frontend tests mock SDK controls and HTTP transport. They cover administrator visibility, country previews, custom labels, save/clear, loading/save recovery, batched and deduplicated lookups, bounded batches, empty results, stale-data removal, and console retry. These tests do not establish live SDK rendering or middleware behavior.

Validation for 0.1.0 passed: clean lockfile installation, TypeScript, all 10 frontend tests, production build, all 28 isolated backend checks, dependency audit (zero reported vulnerabilities), and the running Panel’s extension doctor. Authenticated Chromium checks exercised the native country search, flag loading, country defaults, custom labels, save/reload/clear, failed-save preservation, console lookup retry, dashboard/console inheritance, and coexistence with Server Tags. Desktop (1440×1000) and mobile (390×844) layouts fit without horizontal overflow after native terminal resizing; both light and dark theme tokens were checked. The final run had no runtime errors or failed extension asset requests; deliberately simulated HTTP 503 responses were expected. Earlier rapid console reloads hit the native websocket rate limit; validation was rerun without repeated websocket reconnects. Playwright was used because the Browser plugin was unavailable. Temporary assignments were restored. Multiple-server batching, transfer behavior, and non-admin authorization were verified in isolated/mocked tests rather than against live multi-server/non-admin fixtures. Other browsers and Panel builds remain unverified.

Version 0.1.1 fixes the desktop card spacing: region badges appear inline at 1024px and wider, while smaller screens keep a separate line. TypeScript, all 10 frontend tests, the build, and extension doctor passed. Live Chromium checks at 1440, 1260, 1024, 1023, 768, and 390 pixels verified the breakpoint switch, one shared lookup, long-label truncation, and no overflow or runtime/asset errors. Existing region assignments were not edited during these layout checks.

Version 0.1.2 places the console region directly beside the server name, with a mobile name-and-region row. TypeScript, all 12 frontend tests (including portal cleanup and fallback), production build, and extension doctor passed. Live Chromium checks at 1440, 1260, 1024, 768, 640, 639, and 390 pixels verified left alignment, vertical alignment, visible placement, shared lookups, failed-lookup retry, light/dark layout, and cleanup after navigating away. The heading and badge fit each tested width, with no console errors or failed extension assets. Existing assignments were not edited.

Version 0.1.3 closes two console-heading lifecycle gaps: detecting headings added inside an existing wrapper and reattaching after an ancestor wrapper is replaced. Both new regression tests failed before the fix; all 14 frontend tests, TypeScript, production build, and extension doctor now pass. Desktop CSS keeps the badge in the heading’s row, truncating text when space is limited. Live Chromium checks passed for server-list navigation, refresh, Files → Console, and opening Files directly before navigating to Console. Browser-only late-heading and header-replacement fixtures also passed. Responsive layouts at 1260, 1024, 768, 640, 639, and 390 pixels and light/dark rendering were checked, with no runtime errors or failed extension assets in the final run. The original reported discrepancy did not reproduce in a fresh browser before the changes; the timing gaps were reproduced with regression fixtures. Automated navigation at smaller widths stopped on the native collapsed navigation menu, so those widths were verified by resizing the active console instead. Stored assignments were not edited. The running Panel’s console source matched the inspected checkout.

## Installation

Stage and unpack the release archive into an accessible temporary directory named `regiondisplay`, then check it with the running Panel:

```sh
php artisan p:extension:doctor /tmp/regiondisplay-release/regiondisplay
php artisan p:extension:install /tmp/regiondisplay-1.0.1.pteroext --enable
```

Reload the Panel browser after installation or update. Disabling the extension removes its UI and API routes after reload. Following Panel conventions, disabling or uninstalling keeps its stored assignments for reinstalling later.

## API and data

- `GET /api/admin/extensions/regiondisplay/locations/{id}` returns `{region}` for an existing location.
- `PUT` at the same URL assigns `{country_code, display_name}`. Codes must be uppercase members of the bundled catalog; display names may be null or up to 64 characters.
- `DELETE` at the same URL clears the assignment.
- `POST /api/client/extensions/regiondisplay/regions` accepts `{uuids: [...]}` with 1–100 distinct server UUIDs and returns `{regions: {uuid: regionOrNull}}` scoped to current access.

Region objects contain `country_code`, nullable `display_name`, and the resolved `name`. Responses use private, no-store caching. The extension stores one row per location in `ext_regiondisplay_locations`, with a location foreign key, country code, nullable display name, and timestamps. Location deletion removes its assignment. Batched reads resolve current server/node/location relationships in one SQL query, without using node names or inferred geolocation.

## License

MIT. See LICENSE.
