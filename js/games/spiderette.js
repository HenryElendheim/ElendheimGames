/* ============================================================
   Spiderette — one-deck Spider solitaire.
   7 columns, build descending runs (same suit) onto cards one higher.
   Complete a King-to-Ace same-suit run to clear it; clear all four
   to win. "Deal" deals one card to each column from the stock.
   Tap a card to pick up a run, tap a column to drop it.
   Difficulty: EASY 1 suit · MEDIUM 2 suits · HARD 4 suits.
   Tracks: wins + streak.
   ============================================================ */

const COLS = 7;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const STYLE = `
.sp-wrap { flex:1; display:flex; flex-direction:column; gap:8px; padding:6px 8px; min-height:0; }
.sp-status { text-align:center; font-size:13px; font-weight:700; color:var(--text-dim); }
.sp-cols { flex:1; display:grid; grid-template-columns:repeat(${COLS},1fr); gap:5px; overflow-y:auto;
  align-items:start; padding-bottom:8px; }
.sp-col { position:relative; min-height:74px; border-radius:8px; }
.sp-col.empty { box-shadow:inset 0 0 0 2px rgba(255,255,255,.08); }
.sp-card { position:relative; height:64px; border-radius:7px; background:#fafafa; color:#1a1a1a;
  box-shadow:0 1px 3px rgba(0,0,0,.4); font-weight:800; font-size:15px; padding:3px 5px; }
.sp-card:not(:first-child) { margin-top:-46px; }
.sp-card.down { background:repeating-linear-gradient(45deg,#5b6bd6,#5b6bd6 5px,#4453b0 5px,#4453b0 10px);
  color:transparent; margin-top:-52px; }
.sp-card.down:first-child { margin-top:0; }
.sp-card.red { color:#d63a2f; }
.sp-card .suit { font-size:13px; }
.sp-card.sel { box-shadow:0 0 0 2px var(--accent), 0 2px 6px rgba(0,0,0,.5); }
`;

const SUIT_DEFS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const suitCount = { EASY: 1, MEDIUM: 2, HARD: 4 }[api.settings.difficulty] || 1;

  let cols, stock, completed, selected, history, won;

  const status = document.createElement("div");
  status.className = "sp-status";
  const colsEl = document.createElement("div");
  colsEl.className = "sp-cols";
  const wrap = document.createElement("div");
  wrap.className = "sp-wrap";
  wrap.append(status, colsEl);
  api.root.append(wrap);

  const colEls = Array.from({ length: COLS }, (_, j) => {
    const c = document.createElement("div");
    c.className = "sp-col";
    c.addEventListener("click", () => onColumn(j));
    colsEl.append(c);
    return c;
  });

  api.onRestart(start);

  function setFooter() {
    api.setFooter([
      { icon: "↶", label: "Undo", onClick: undo, disabled: history.length === 0 || won },
      { icon: "＋", label: "Deal", onClick: deal, accent: true, disabled: stock.length === 0 || won },
    ]);
  }

  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
  }

  function buildDeck() {
    // 52 cards total: `suitCount` suits, repeated so each rank appears 4 times
    const copies = 4 / suitCount;
    const deck = [];
    for (let n = 0; n < copies; n++)
      for (let i = 0; i < suitCount; i++)
        for (let r = 1; r <= 13; r++) deck.push({ rank: r, suit: i, faceUp: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function snapshot() {
    return JSON.stringify({ cols, stock, completed });
  }
  function pushHistory() {
    history.push(snapshot());
    if (history.length > 60) history.shift();
  }

  function start() {
    const deck = buildDeck();
    cols = Array.from({ length: COLS }, () => []);
    // Spiderette deal: column j gets j+1 cards, last face up
    for (let j = 0; j < COLS; j++)
      for (let k = 0; k <= j; k++) cols[j].push(deck.pop());
    cols.forEach((c) => c.length && (c[c.length - 1].faceUp = true));
    stock = deck; // remaining 24
    completed = 0;
    selected = null;
    history = [];
    won = false;
    pills();
    setFooter();
    render();
  }

  function deal() {
    if (won || !stock.length) return;
    pushHistory();
    selected = null;
    for (let j = 0; j < COLS && stock.length; j++) {
      const card = stock.pop();
      card.faceUp = true;
      cols[j].push(card);
    }
    cols.forEach((_, j) => checkComplete(j));
    setFooter();
    render();
    checkWin();
  }

  function validRun(col, idx) {
    if (!col[idx] || !col[idx].faceUp) return false;
    for (let k = idx; k < col.length - 1; k++) {
      const a = col[k],
        b = col[k + 1];
      if (!b.faceUp || a.suit !== b.suit || a.rank !== b.rank + 1) return false;
    }
    return true;
  }

  function onCard(j, idx, ev) {
    ev.stopPropagation();
    if (won) return;
    if (selected) return onColumn(j); // tapping a card in another column = drop there
    if (validRun(cols[j], idx)) {
      selected = { j, idx };
      render();
    }
  }

  function onColumn(j) {
    if (won || !selected) return;
    if (selected.j === j) {
      selected = null;
      return render();
    }
    const run = cols[selected.j].slice(selected.idx);
    const dest = cols[j];
    const ok = dest.length === 0 || (dest[dest.length - 1].faceUp && dest[dest.length - 1].rank === run[0].rank + 1);
    if (ok) {
      pushHistory();
      cols[selected.j].splice(selected.idx);
      dest.push(...run);
      flip(selected.j);
      selected = null;
      checkComplete(j);
      setFooter();
      render();
      checkWin();
    } else {
      selected = null;
      render();
    }
  }

  function flip(j) {
    const c = cols[j];
    if (c.length && !c[c.length - 1].faceUp) c[c.length - 1].faceUp = true;
  }

  function checkComplete(j) {
    const c = cols[j];
    if (c.length < 13) return;
    const tail = c.slice(-13);
    const suit = tail[0].suit;
    for (let k = 0; k < 13; k++)
      if (!tail[k].faceUp || tail[k].suit !== suit || tail[k].rank !== 13 - k) return;
    c.splice(c.length - 13);
    completed++;
    flip(j);
  }

  function checkWin() {
    if (completed >= 4) {
      won = true;
      selected = null;
      api.reportWin();
      pills();
      setFooter();
      api.showModal({
        title: "You won! 🎉",
        message: "All four runs cleared.",
        statsRows: [
          { label: "Streak", value: api.refreshStats().streak },
          { label: "Wins", value: api.refreshStats().wins },
        ],
        primaryLabel: "New Game",
        onPrimary: start,
      });
    }
  }

  function undo() {
    if (!history.length || won) return;
    const prev = JSON.parse(history.pop());
    cols = prev.cols;
    stock = prev.stock;
    completed = prev.completed;
    selected = null;
    setFooter();
    render();
  }

  function render() {
    status.textContent = `Completed ${completed}/4   ·   Stock ${stock.length}`;
    for (let j = 0; j < COLS; j++) {
      const colEl = colEls[j];
      colEl.replaceChildren();
      colEl.classList.toggle("empty", cols[j].length === 0);
      cols[j].forEach((card, idx) => {
        const def = SUIT_DEFS[card.suit];
        const el = document.createElement("div");
        el.className = "sp-card" + (card.faceUp ? "" : " down") + (def.red ? " red" : "");
        if (selected && selected.j === j && idx >= selected.idx) el.classList.add("sel");
        if (card.faceUp)
          el.innerHTML = `${RANKS[card.rank - 1]}<span class="suit">${def.s}</span>`;
        el.addEventListener("click", (ev) => onCard(j, idx, ev));
        colEl.append(el);
      });
    }
  }

  start();
  return { destroy: () => style.remove() };
}
