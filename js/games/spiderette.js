/* ============================================================
   Spiderette — one-deck Spider solitaire.
   7 columns, build descending runs (same suit) onto cards one higher.
   Complete a King-to-Ace same-suit run to clear it; clear all four to
   win. Deal (or tap the stock) deals one card to each column.
   Tap a card to pick up a run, tap a column to drop it.
   Difficulty: EASY 1 suit · MEDIUM 2 suits · HARD 4 suits.
   Tracks: wins + streak.
   ============================================================ */

import { uiIcon } from "../core/icons.js";

const COLS = 7;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_DEFS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];

const STYLE = `
.game-screen { background:#0e1b2b !important; }
.sp-wrap { flex:1; display:flex; flex-direction:column; gap:8px; padding:6px 8px 0; min-height:0; }
.sp-top { display:flex; justify-content:flex-end; align-items:flex-start; min-height:70px; padding:2px 4px; }
.sp-stock { position:relative; height:66px; cursor:pointer; }
.sp-stock.empty { opacity:.25; cursor:default; }
.sp-stock .sp-back { position:absolute; top:0; width:46px; height:64px; }
.sp-cols { flex:1; display:grid; grid-template-columns:repeat(${COLS},1fr); gap:5px; align-items:start;
  overflow-y:auto; padding-bottom:12px; }
.sp-col { position:relative; min-height:80px; border-radius:8px; }
.sp-col.empty { box-shadow:inset 0 0 0 2px rgba(255,255,255,.08); }

.sp-card { position:relative; height:70px; border-radius:8px; background:#fbfbfb;
  box-shadow:0 1px 2px rgba(0,0,0,.45); overflow:hidden; }
.sp-card:not(:first-child) { margin-top:-50px; }
.sp-card.down { margin-top:-56px; }
.sp-card.down:first-child, .sp-card:first-child { margin-top:0; }
.sp-back, .sp-card.down { background:linear-gradient(160deg,#9a6cf0,#6b3fcf);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.18), 0 1px 2px rgba(0,0,0,.45);
  border-radius:8px; }
.sp-back svg { position:absolute; inset:14% 26%; }
.sp-card .sp-rk { position:absolute; top:3px; left:6px; font-size:16px; font-weight:800; line-height:1; }
.sp-card .sp-cs { position:absolute; top:5px; left:22px; font-size:11px; line-height:1; }
.sp-card .sp-pip { position:absolute; left:0; right:0; bottom:6px; text-align:center; font-size:30px; line-height:1; }
.sp-card.navy .sp-rk, .sp-card.navy .sp-cs, .sp-card.navy .sp-pip { color:#15294f; }
.sp-card.red .sp-rk, .sp-card.red .sp-cs, .sp-card.red .sp-pip { color:#d63a2f; }
.sp-card.sel { box-shadow:0 0 0 2px var(--accent), 0 3px 9px rgba(0,0,0,.55); z-index:3; }

@keyframes sp-drop { from { transform:translateY(-30px); opacity:.2; } to { transform:none; opacity:1; } }
.sp-anim-deal { animation:sp-drop .22s ease both; }
@keyframes sp-pop { from { transform:scale(.85); } to { transform:scale(1); } }
.sp-anim-move { animation:sp-pop .18s ease; }
@keyframes sp-flip { from { transform:rotateY(90deg); } to { transform:rotateY(0); } }
.sp-anim-flip { animation:sp-flip .26s ease; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const suitCount = { EASY: 1, MEDIUM: 2, HARD: 4 }[api.settings.difficulty] || 1;

  let cols, stock, completed, selected, history, won;
  let pendingAnims = [];

  const stockEl = document.createElement("div");
  stockEl.className = "sp-stock";
  stockEl.addEventListener("click", deal);
  const topBar = el("div", "sp-top", stockEl);

  const colsEl = document.createElement("div");
  colsEl.className = "sp-cols";
  const colEls = Array.from({ length: COLS }, (_, j) => {
    const c = document.createElement("div");
    c.className = "sp-col";
    c.addEventListener("click", () => onColumn(j));
    colsEl.append(c);
    return c;
  });

  const wrap = el("div", "sp-wrap", topBar, colsEl);
  api.root.append(wrap);

  api.onRestart(start);

  function el(tag, cls, ...kids) {
    const n = document.createElement(tag);
    n.className = cls;
    kids.forEach((k) => k && n.append(k));
    return n;
  }

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

  function pushHistory() {
    history.push(JSON.stringify({ cols, stock, completed }));
    if (history.length > 60) history.shift();
  }

  function start() {
    const deck = buildDeck();
    cols = Array.from({ length: COLS }, () => []);
    for (let j = 0; j < COLS; j++) for (let k = 0; k <= j; k++) cols[j].push(deck.pop());
    cols.forEach((c) => c.length && (c[c.length - 1].faceUp = true));
    stock = deck;
    completed = 0;
    selected = null;
    history = [];
    won = false;
    pendingAnims = cols.map((c, j) => ({ j, from: 0, cls: "sp-anim-deal" }));
    pills();
    setFooter();
    render();
  }

  function deal() {
    if (won || !stock.length) return;
    pushHistory();
    selected = null;
    pendingAnims = [];
    for (let j = 0; j < COLS && stock.length; j++) {
      const card = stock.pop();
      card.faceUp = true;
      cols[j].push(card);
      pendingAnims.push({ j, from: cols[j].length - 1, cls: "sp-anim-deal" });
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
    if (selected) return onColumn(j);
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
    if (!ok) {
      selected = null;
      return render();
    }
    pushHistory();
    const src = selected.j;
    const destStart = dest.length;
    cols[src].splice(selected.idx);
    dest.push(...run);
    pendingAnims = [{ j, from: destStart, cls: "sp-anim-move" }];
    if (flip(src)) pendingAnims.push({ j: src, from: cols[src].length - 1, only: true, cls: "sp-anim-flip" });
    selected = null;
    checkComplete(j);
    setFooter();
    render();
    checkWin();
  }

  function flip(j) {
    const c = cols[j];
    if (c.length && !c[c.length - 1].faceUp) {
      c[c.length - 1].faceUp = true;
      return true;
    }
    return false;
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
    if (completed < 4) return;
    won = true;
    selected = null;
    api.reportWin();
    pills();
    setFooter();
    api.showModal({
      title: "You won!",
      message: "All four runs cleared.",
      statsRows: [
        { label: "Streak", value: api.refreshStats().streak },
        { label: "Wins", value: api.refreshStats().wins },
      ],
      primaryLabel: "New Game",
      onPrimary: start,
    });
  }

  function undo() {
    if (!history.length || won) return;
    const prev = JSON.parse(history.pop());
    cols = prev.cols;
    stock = prev.stock;
    completed = prev.completed;
    selected = null;
    pendingAnims = [];
    setFooter();
    render();
  }

  function renderStock() {
    stockEl.replaceChildren();
    const deals = Math.ceil(stock.length / COLS);
    stockEl.classList.toggle("empty", deals === 0);
    const shown = Math.min(deals, 4);
    stockEl.style.width = 46 + (shown - 1) * 11 + "px";
    for (let i = 0; i < shown; i++) {
      const back = document.createElement("div");
      back.className = "sp-back";
      back.style.left = i * 11 + "px";
      if (i === shown - 1) back.append(uiIcon("spider"));
      stockEl.append(back);
    }
  }

  function render() {
    renderStock();
    for (let j = 0; j < COLS; j++) {
      const colEl = colEls[j];
      colEl.replaceChildren();
      colEl.classList.toggle("empty", cols[j].length === 0);
      cols[j].forEach((card, idx) => {
        const def = SUIT_DEFS[card.suit];
        const cardEl = document.createElement("div");
        cardEl.className = "sp-card" + (card.faceUp ? (def.red ? " red" : " navy") : " down");
        if (selected && selected.j === j && idx >= selected.idx) cardEl.classList.add("sel");
        if (card.faceUp)
          cardEl.innerHTML = `<span class="sp-rk">${RANKS[card.rank - 1]}</span><span class="sp-cs">${def.s}</span><span class="sp-pip">${def.s}</span>`;
        cardEl.addEventListener("click", (ev) => onCard(j, idx, ev));
        colEl.append(cardEl);
      });
    }
    // play queued animations, then forget them
    for (const a of pendingAnims) {
      const kids = colEls[a.j].children;
      if (a.only) {
        kids[a.from] && kids[a.from].classList.add(a.cls);
      } else {
        for (let i = a.from; i < kids.length; i++) kids[i].classList.add(a.cls);
      }
    }
    pendingAnims = [];
  }

  start();
  return { destroy: () => style.remove() };
}
