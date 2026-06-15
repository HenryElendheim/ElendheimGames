/* ============================================================
   Game registry — the single source of truth for the catalog.
   To add a game: drop a module in js/games/ and add an entry here.

   scoreType:  "highscore" | "wins" | "besttime"
   difficulty: array of labels (slider stops) or null for none
   modes:      ["cpu","local"] for strategy games, or null
   loader:     () => dynamic import of the game module (null = coming soon)
   image:      OPTIONAL path to artwork (PNG/JPG/SVG/WebP). When set, the tile
               and hero show this picture instead of the drawn glyph — drop the
               file in (e.g. assets/games/<id>.png) and add this one line.
   ============================================================ */

export const GAMES = [
  {
    id: "elendheim-tcg",
    title: "Elendheim TCG",
    accent: "#ffb83d",
    desc: "Collect cards, build an 8-card deck, and duel the computer. Open packs with Heimers and level up your cards.",
    scoreType: "wins",
    difficulty: null,
    modes: null,
    since: "2026-06-15",
    loader: () => import("../games/elendheim-tcg.js"),
  },
  {
    id: "fruit-slasher",
    title: "Fruit vs Sword",
    accent: "#ef5350",
    desc: "Swipe to slice the fruit — but don't let three slip past you, and never hit a bomb!",
    scoreType: "highscore",
    difficulty: null,
    modes: null,
    since: "2026-06-15",
    loader: () => import("../games/fruit-slasher.js"),
  },
  {
    id: "spiderette",
    title: "Spiderette",
    accent: "#8b5cf6",
    desc: "Like Spider Solitaire, but with just one deck for quicker games!",
    scoreType: "wins",
    difficulty: ["EASY", "MEDIUM", "HARD", "ULTRA HARD", "INSANITY"],
    modes: null,
    loader: () => import("../games/spiderette.js"),
  },
  {
    id: "kings-corners",
    title: "King's Corners",
    accent: "#d4a017",
    desc: "Build down in alternating colours on the cross, start the corners with Kings, and empty your hand before the computer.",
    scoreType: "wins",
    difficulty: null,
    modes: null,
    since: "2026-06-15",
    loader: () => import("../games/kings-corners.js"),
  },
  {
    id: "solitaire",
    title: "Solitaire",
    accent: "#2c8c5a",
    desc: "Classic Klondike. Build the foundations up by suit to clear the board.",
    scoreType: "wins",
    difficulty: null,
    modes: null,
    loader: () => import("../games/solitaire.js"),
  },
  {
    id: "tile-tap",
    title: "Tile Tap",
    accent: "#18c29c",
    desc: "Tap only the dark tiles as they fall. One wrong tap and it's over!",
    scoreType: "highscore",
    difficulty: ["EASY", "MEDIUM", "HARD"],
    modes: null,
    loader: () => import("../games/tile-tap.js"),
  },
  {
    id: "wordle",
    title: "Word Guess",
    accent: "#6aaa64",
    desc: "Six guesses to find the hidden five-letter word. Keep your streak alive!",
    scoreType: "wins",
    difficulty: null,
    modes: null,
    loader: () => import("../games/wordle.js"),
  },
  {
    id: "connect4",
    title: "Connect 4",
    accent: "#ffb400",
    desc: "Drop your discs and line up four in a row before your opponent does.",
    scoreType: "wins",
    difficulty: ["EASY", "MEDIUM", "HARD"],
    modes: ["cpu", "local"],
    loader: () => import("../games/connect4.js"),
  },
  {
    id: "tictactoe",
    title: "Tic-Tac-Toe",
    accent: "#4fc3f7",
    desc: "The classic. Get three in a row against the computer or a friend.",
    scoreType: "wins",
    difficulty: ["EASY", "MEDIUM", "HARD"],
    modes: ["cpu", "local"],
    loader: () => import("../games/tictactoe.js"),
  },
  {
    id: "whack-a-mole",
    title: "Whack-a-Mole",
    accent: "#e8821e",
    desc: "Bop as many moles as you can before the timer runs out!",
    scoreType: "highscore",
    difficulty: ["EASY", "MEDIUM", "HARD"],
    modes: null,
    loader: () => import("../games/whack-a-mole.js"),
  },
  {
    id: "blackjack",
    title: "Blackjack",
    accent: "#2e9e57",
    desc: "Beat the dealer to 21 without going bust. Build your chip streak!",
    scoreType: "wins",
    difficulty: null,
    modes: null,
    loader: () => import("../games/blackjack.js"),
  },
  {
    id: "chess",
    title: "Chess",
    accent: "#c0c4cc",
    desc: "Full rules, full board. Outplay the engine or challenge a friend.",
    scoreType: "wins",
    difficulty: ["EASY", "MEDIUM", "HARD"],
    modes: ["cpu", "local"],
    loader: () => import("../games/chess.js"),
  },
  {
    id: "tetris",
    title: "Blockfall",
    accent: "#7c4dff",
    desc: "Stack the falling blocks, clear full lines, and chase the high score.",
    scoreType: "highscore",
    difficulty: null,
    modes: null,
    loader: () => import("../games/tetris.js"),
  },
  {
    id: "block-blast",
    title: "Block Rows",
    accent: "#ff4081",
    desc: "Drag blocks onto the grid and clear rows and columns to score big.",
    scoreType: "highscore",
    difficulty: null,
    modes: null,
    loader: () => import("../games/block-blast.js"),
  },
];

/* A game shows its NEW badge for 30 days after its `since` date. */
const NEW_DAYS = 30;
export const isNew = (g) => g.since != null && Date.now() - Date.parse(g.since) < NEW_DAYS * 86400000;

/* Home ordering: NEW games first (freshest first), then the rest A–Z. */
export const homeOrder = (games) =>
  [...games].sort((a, b) => {
    const na = isNew(a),
      nb = isNew(b);
    if (na !== nb) return na ? -1 : 1;
    if (na && nb) return Date.parse(b.since) - Date.parse(a.since) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });

export const getGame = (id) => GAMES.find((g) => g.id === id);
export const GAME_IDS = GAMES.map((g) => g.id);
