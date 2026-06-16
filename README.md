# Elendheim Games

A free, **ad-free** collection of the games I actually like to play — built to run in any phone browser and install to hopefully be able to add to your home screen like an app in the future.

## Why I made this

I love these little games — solitaire, chess, a quick word puzzle, slicing fruit on a boring bus ride. The problem is that almost every free version is buried in ads: full-screen interruptions, "watch a video to continue," timers, pop-ups. I hate that. So I built my own free web version, with **zero ads and zero nonsense**, for myself — and put it online so anyone else who feels the same can play too.

No ads. No tracking-for-profit. No paywalls. Just the games, instantly, on whatever device you've got.

## The games

**Cards & solitaire**
- **Solitaire** — classic Klondike. Drag, tap-to-auto-move, the whole thing.
- **Spiderette** — one-deck Spider solitaire, quicker than the full version.
- **King's Corners** — a cozy card game against the computer.
- **Blackjack** — beat the dealer to 21.
- **Elendheim TCG** — my own little trading-card game: collect cards from packs, level them up with duplicates, build a deck, and duel the computer for Heimers. Endless battles, no spending real money.

**Brain & board**
- **Chess** — full rules, play the engine or a friend.
- **Connect 4** — drop, line up four, win.
- **Tic-Tac-Toe** — the classic, vs computer or a friend.
- **Word Guess** — six tries to find the hidden word; keep your streak alive.

**Arcade & reflex**
- **Fruit vs Sword** — swipe to slice the fruit, dodge the bombs.
- **Whack-a-Mole** — bop the moles, avoid the bombs, beat the clock.
- **Tile Tap** — tap only the dark tiles as they fly by.
- **Blockfall** — stack the falling blocks and clear lines.
- **Block Rows** — drop blocks onto the grid and clear rows and columns.

Your wins, streaks, and high scores are saved on your own device.

## Play it

Just open it in a browser. On a phone you can tap **"Add to Home Screen"** to install it as an app — after the first visit it works fully offline.

## Run it yourself

It's plain HTML/CSS/JavaScript — no build step, no dependencies. Serve the folder over HTTP (the offline service worker needs http/https, not `file://`):

```bash
python3 -m http.server 8099
# then open http://localhost:8099
```

## Under the hood (for the curious / contributors)

```
index.html              app shell + PWA hooks
css/theme.css           the dark, chunky, rounded look
sw.js                   service worker — caches everything for offline play
js/main.js              hash router: #/ home · #/game/:id detail · #/play/:id live game
js/core/
  registry.js           the catalog — one entry per game (metadata + difficulty + modes + loader)
  storage.js            scores / wins / prefs (localStorage)
  screens.js            home grid + detail/start screen
  shell.js              in-game chrome (header, restart, footer, modals) + the game `api`
  anim.js               shared card move/draw animations (FLIP)
  icons.js              hand-drawn SVG game icons
js/games/               one self-contained module per game
```

**Adding a game:** create `js/games/<id>.js` that default-exports `init(api)` (the `api` gives you a play area, settings, stats, footer, modals, and score reporters), add an entry in `js/core/registry.js`, then list the file in `sw.js` and bump `CACHE`. The home tile, difficulty slider, mode toggle, stats, and offline caching all come from the metadata.

---

Made for fun, kept free. If you enjoy it, that's the whole point.
