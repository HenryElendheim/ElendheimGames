# Elendheim Games

A mobile-first library of quick games that runs in any phone browser and
installs as a PWA (home-screen icon, works offline). Pure HTML/CSS/JS — no
build step, no dependencies.

## Run it

Serve the folder over HTTP (a service worker needs http/https, not `file://`):

```bash
python3 -m http.server 8099
# then open http://localhost:8099 on your phone or browser
```

## The catalog

| Game | Tracks | Status |
|------|--------|--------|
| 🍉 Fruit Slasher | High score (3 lives) | planned |
| 🕷️ Spiderette | Wins + streak | planned |
| 🎹 Tile Tap | High score | planned |
| 🟩 Word Quest | Wins + streak | planned |
| 🔴 Connect 4 | Wins (cpu / 2-player) | planned |
| ❌ Tic-Tac-Toe | Wins (cpu / 2-player) | **playable** |
| 🔨 Whack-a-Mole | High score | planned |
| 🃏 Blackjack | Wins / chips | planned |
| ♟️ Chess | Wins (cpu / 2-player) | planned |
| 🧱 Tetris | High score | planned |
| 💥 Block Blast | High score | planned |

## How it's wired

```
index.html              app shell + PWA hooks
css/theme.css           design system (dark, chunky, rounded — from the reference shots)
js/main.js              hash router: #/ home · #/game/:id detail · #/play/:id live game
js/core/
  registry.js           THE catalog — one entry per game (metadata + difficulty + modes + loader)
  storage.js            scores/wins/prefs; localStorage today, swappable for cloud later
  screens.js            home grid + detail/start screen
  shell.js              in-game chrome (header pills, restart, footer, modals) + the game `api`
  dom.js                tiny DOM helper
js/games/
  tictactoe.js          first complete game
```

## Adding a game

1. Create `js/games/<id>.js` exporting `export default function init(api) { … }`.
   The `api` gives you `root` (your play area), `settings` (difficulty/mode),
   `setStats`, `setFooter`, `onRestart`, `showModal`, score reporters
   (`reportWin` / `reportLoss` / `reportHighscore` / `reportTime`), and `exit`.
   Return `{ destroy() }` to clean up.
2. Add an entry in `js/core/registry.js` with its metadata and
   `loader: () => import("../games/<id>.js")`.
3. Add the file to the `ASSETS` list in `sw.js` and bump `CACHE`.

That's it — the home tile, detail screen, difficulty slider, mode toggle,
stats, and PWA caching all come for free from the metadata.
