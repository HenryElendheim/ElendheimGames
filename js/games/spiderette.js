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
.sp-wrap { flex:1; position:relative; display:flex; flex-direction:column; gap:8px; padding:6px 8px 0; min-height:0; }
.sp-dealing { position:absolute; inset:0; z-index:10; display:grid; place-items:center; text-align:center;
  color:var(--text-dim); font-weight:800; font-size:16px; background:rgba(14,27,43,.55); }
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

/* ---- winnable-deal solver (1-suit spades modes) ---- */
function spRunStart(c, i) {
  if (!c[i] || !c[i].faceUp) return false;
  for (let k = i; k < c.length - 1; k++) {
    const a = c[k], b = c[k + 1];
    if (!b.faceUp || a.suit !== b.suit || a.rank !== b.rank + 1) return false;
  }
  return true;
}
function spAutoComplete(cols) {
  let ch = true;
  while (ch) {
    ch = false;
    for (const c of cols) {
      if (c.length >= 13) {
        const t = c.slice(-13), s = t[0].suit;
        let ok = true;
        for (let k = 0; k < 13; k++) if (!t[k].faceUp || t[k].suit !== s || t[k].rank !== 13 - k) { ok = false; break; }
        if (ok) { c.splice(c.length - 13); if (c.length) c[c.length - 1].faceUp = true; ch = true; }
      }
    }
  }
}
function spGenMoves(cols, stock) {
  const mv = [];
  let emptyDone = false;
  for (let src = 0; src < COLS; src++) {
    const c = cols[src];
    for (let i = 0; i < c.length; i++) {
      if (!c[i].faceUp || !spRunStart(c, i)) continue;
      const top = c[i].rank, exposes = i > 0 && !c[i - 1].faceUp, emptiesCol = i === 0;
      for (let dst = 0; dst < COLS; dst++) {
        if (dst === src) continue;
        const d = cols[dst];
        if (d.length === 0) {
          if (i === 0 || emptyDone) continue;
          mv.push({ src, i, dst, score: exposes ? 900 : 20 });
          emptyDone = true;
        } else {
          const t = d[d.length - 1];
          if (t.faceUp && t.rank === top + 1) mv.push({ src, i, dst, score: (exposes ? 1000 : 120) + (emptiesCol ? 400 : 0) });
        }
      }
    }
  }
  if (stock.length > 0) mv.push({ deal: true, score: -1000 });
  mv.sort((a, b) => a.score - b.score); // ascending so highest priority is popped first
  return mv;
}
function spApply(cols, stock, m) {
  const nc = cols.map((c) => c.map((x) => ({ ...x }))), ns = stock.map((x) => ({ ...x }));
  if (m.deal) {
    for (let j = 0; j < COLS && ns.length; j++) { const card = ns.pop(); card.faceUp = true; nc[j].push(card); }
  } else {
    const run = nc[m.src].splice(m.i);
    nc[m.dst].push(...run);
    const s = nc[m.src];
    if (s.length && !s[s.length - 1].faceUp) s[s.length - 1].faceUp = true;
  }
  return { cols: nc, stock: ns };
}
function spSer(cols, stock) {
  return cols.map((c) => c.map((x) => (x.faceUp ? "" : "_") + x.rank + "." + x.suit).join("|")).join("/") + "#" + stock.length;
}
function spSolvable(cols0, stock0, cap) {
  const seen = new Set();
  let nodes = 0;
  const stack = [{ cols: cols0.map((c) => c.map((x) => ({ ...x }))), stock: stock0.map((x) => ({ ...x })) }];
  while (stack.length) {
    const { cols, stock } = stack.pop();
    if (++nodes > cap) return false;
    spAutoComplete(cols);
    if (spSolved(cols, stock)) return true;
    const k = spSer(cols, stock);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const m of spGenMoves(cols, stock)) stack.push(spApply(cols, stock, m));
  }
  return false;
}
function spSolved(cols, stock) {
  return stock.length === 0 && cols.every((c) => c.length === 0);
}

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  // spades only, except Ultra Hard (spades + hearts) and Insanity (all four suits)
  const SUITS = { EASY: 1, MEDIUM: 1, HARD: 1, "ULTRA HARD": 2, INSANITY: 4 };
  const suitCount = SUITS[api.settings.difficulty] || 1;

  let cols, stock, completed, selected, history, won;
  let pendingAnims = [];
  let generating = false;
  let genToken = 0;

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

  const dealingEl = el("div", "sp-dealing", "Dealing a winnable game…");
  dealingEl.style.display = "none";

  const wrap = el("div", "sp-wrap", topBar, colsEl, dealingEl);
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

  function randomLayout() {
    const deck = buildDeck();
    const c = Array.from({ length: COLS }, () => []);
    for (let j = 0; j < COLS; j++) for (let k = 0; k <= j; k++) c[j].push(deck.pop());
    c.forEach((col) => col.length && (col[col.length - 1].faceUp = true));
    return { cols: c, stock: deck };
  }

  function applyLayout(layout) {
    cols = layout.cols;
    stock = layout.stock;
    completed = 0;
    selected = null;
    history = [];
    won = false;
    generating = false;
    pendingAnims = cols.map((c, j) => ({ j, from: 0, cls: "sp-anim-deal" }));
    dealingEl.style.display = "none";
    pills();
    setFooter();
    render();
  }

  async function start() {
    const token = ++genToken;
    if (suitCount !== 1) {
      // Ultra Hard / Insanity: fair random deals
      applyLayout(randomLayout());
      return;
    }
    // Spades modes: serve only solver-verified winnable deals, generated
    // off the critical path (yielding between tries) so the UI never freezes.
    generating = true;
    cols = Array.from({ length: COLS }, () => []);
    stock = [];
    won = false;
    selected = null;
    history = [];
    completed = 0;
    pendingAnims = [];
    setFooter();
    render();
    dealingEl.style.display = "grid";
    let layout = null;
    for (let att = 0; att < 400 && !layout; att++) {
      const cand = randomLayout();
      if (spSolvable(cand.cols, cand.stock, 3000)) layout = cand;
      else await new Promise((r) => setTimeout(r));
      if (token !== genToken) return; // a newer game started — abandon this one
    }
    if (token !== genToken) return;
    applyLayout(layout || randomLayout());
  }

  function deal() {
    if (won || generating || !stock.length) return;
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
    if (won || generating) return;
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
