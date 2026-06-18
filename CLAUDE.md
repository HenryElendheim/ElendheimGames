# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Elendheim Games is an ad-free, installable PWA — a library of small games (solitaire, chess, wordle, arcade, a custom TCG) that runs in any phone browser and works fully offline. It is **plain HTML/CSS/ES modules with no build step, no framework, and no dependencies**. There is no `package.json`, bundler, linter, or test runner.

## Running locally

The offline service worker requires http/https (not `file://`), so serve the folder over HTTP:

```bash
python3 -m http.server 8099
# then open http://localhost:8099
```

There is no build, lint, or test command. Verification is manual in a browser. When testing service-worker / caching changes, use a hard reload or DevTools "Update on reload" — `sw.js` is cache-first and otherwise serves stale files.

## Architecture

Single-page app driven by a hash router in `js/main.js` with three routes:

- `#/` → home grid (`renderHome`)
- `#/game/:id` → detail / start screen with difficulty + mode + stats (`renderDetail`)
- `#/play/:id` → live game (shell + dynamically-imported game module)

The router tears down the previous game (`activeGame.destroy()`) on every navigation, builds the in-game chrome via `createGameShell`, then dynamically imports the game module and calls its `default(api)`.

### Core layer (`js/core/`) — games depend on these, not the reverse

- **`registry.js`** — the single source of truth for the catalog. One entry per game with `id`, `title`, `accent` (hex), `desc`, `scoreType` (`"highscore" | "wins" | "besttime"`), `difficulty` (array of slider labels or `null`), `modes` (`["cpu","local"]` or `null`), optional `since` (drives the NEW badge for 30 days), optional `image`, and `loader` (`() => import(...)`, or `null` for "coming soon"). The home tile, difficulty slider, mode toggle, stats display, and offline caching all derive from this metadata.
- **`shell.js`** — builds the generic in-game UI (back button, two stat pills, restart, play area, footer/modals) and constructs the `api` object handed to each game. This is the entire contract between a game and the app.
- **`storage.js`** — the **only** place games touch persistence. localStorage-backed, keyed under `eg:` prefix (`eg:stats:<id>`, `eg:pref:<id>:<key>`, `eg:profile`, `eg:deviceId`). Tracks highscore/wins/losses/streak/bestStreak/bestTime/plays. Emits change events via `onChange` so the sync layer can push without games knowing.
- **`sync.js` + `cloud.js` + `config.js`** — offline-first cloud sync to Supabase. On boot (`Sync.init()` in `main.js`, never blocks UI): anonymous sign-in → pull cloud stats → merge (best-of-each) → push back; afterwards local changes are debounced-pushed. All best-effort — if offline, nothing breaks and it syncs next time. `config.js` holds the Supabase URL + publishable key (browser-safe; security is enforced by RLS, see `docs/supabase-schema.sql`).
- **`dom.js`** — tiny `el(tag, props, ...children)` hyperscript helper, `mount`, `toast`, `glow`. There is no virtual DOM; everything builds real DOM nodes.
- **`screens.js`** — home + detail screens, stats/leaderboard/settings modals, fullscreen + profile chips.
- **`icons.js`** — hand-drawn inline SVG for every game tile and UI glyph. **No emoji anywhere** — add a `GAME[id]` entry when adding a game (or set `image` in the registry to use artwork instead).
- **`anim.js`** — FLIP-based card move/entrance animations; wrap a paint with `flipRender(container, paint)` and give cards stable `data-cid`.
- **`cards.js`** — shared tap-to-move helpers (`bestDestination`, `shake`) for the solitaire-family games.

### The `api` contract (what `init(api)` receives)

Each game module default-exports `init(api)` and may return `{ destroy() }` for cleanup. The `api` provides: `root` (the play-area element to append into), `settings` (`{ difficulty, difficultyIndex, mode }` resolved from saved prefs), `stats`, `setStats({left,right})` (the two header pills), `setFooter(buttons)`, `onRestart(fn)`, `showModal({...})`, score reporters (`reportWin`, `reportLoss`, `reportHighscore`, `reportTime`), `refreshStats()`, `toast`, `accent`, `glow`, and `exit`.

## Adding or changing a game

1. Create `js/games/<id>.js` that default-exports `init(api)`.
2. Add an entry to `GAMES` in `js/core/registry.js`.
3. **Add the file (and any module it imports) to the `ASSETS` array in `sw.js`** and **bump the `CACHE` version string** (e.g. `elendheim-games-v61` → `v62`). Anything not listed in `ASSETS` won't be cached for offline play.
4. If not using `image`, add a drawn SVG under `GAME[<id>]` in `js/core/icons.js`.

**Bump `CACHE` in `sw.js` on every shippable change** — clients are served the cached bundle until the version string changes.

### Game module conventions (follow the existing files)

- Inject a per-game `STYLE` string into a `<style>` element in `init`, and remove it in `destroy()`.
- Build UI with raw DOM APIs (or `el` from `dom.js`); use the shared CSS variables from `css/theme.css` (`--bg`, `--surface`, `--accent`, `--text-dim`, radii `--r*`, etc.) rather than hardcoding the palette.
- Report results through the `api` score methods only — never write to localStorage or read it directly.
- For `modes: ["cpu","local"]` games, difficulty is hidden in "vs Friend" mode; vs-friend uses session-only scores and does not call the win/loss reporters.

## Conventions

- ES modules with relative paths and `import` (no bundler resolution). Keep imports relative.
- Mobile-first, portrait, dark theme; design tokens live in `css/theme.css`.
- Branching: a default branch `Main` exists. Develop on the assigned feature branch and push there; do not open PRs unless explicitly asked.
