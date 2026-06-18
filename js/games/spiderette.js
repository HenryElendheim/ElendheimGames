/* ============================================================
   Spiderette — one-deck Spider solitaire.
   7 columns, build descending runs (same suit) onto cards one higher.
   Complete a King-to-Ace same-suit run to clear it; clear all four to
   win. Deal (or tap the stock) deals one card to each column.
   Tap a card to pick up a run, tap a column to drop it.
   Difficulty: EASY 1 suit · MEDIUM 2 suits · HARD 4 suits.
   Tracks: wins + streak.
   ============================================================ */

import { flipRender } from "../core/anim.js";
import { shake, bestDestination } from "../core/cards.js";

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
.sp-top { display:flex; justify-content:space-between; align-items:flex-start; min-height:70px; padding:2px 4px; }
/* collected completed-run "bunch" (top-left) — each finished K→A run lands
   here as its King card */
.sp-bunch { position:relative; width:62px; height:66px; }
.sp-bc { position:absolute; left:8px; top:1px; width:44px; height:62px; border-radius:8px; background:#fbfbfb;
  box-shadow:0 1px 3px rgba(0,0,0,.55), inset 0 0 0 1px rgba(0,0,0,.06); overflow:hidden;
  transform-origin:50% 95%; }
.sp-bc .r { position:absolute; top:2px; left:4px; font-size:13px; font-weight:800; line-height:1; }
.sp-bc .p { position:absolute; left:0; right:0; bottom:5px; text-align:center; font-size:26px; line-height:1; }
.sp-bc.red .r, .sp-bc.red .p { color:#d63a2f; } .sp-bc.navy .r, .sp-bc.navy .p { color:#15294f; }
.sp-bcount { position:absolute; right:-4px; bottom:-4px; min-width:18px; height:18px; padding:0 4px; border-radius:9px;
  background:var(--accent,#f0a32a); color:#1a1300; font-size:11px; font-weight:800; display:grid; place-items:center;
  box-shadow:0 1px 2px rgba(0,0,0,.5); z-index:9; }
/* fly clones: .sp-card sets position:relative LATER in this sheet, so the
   completed-run clones MUST out-specify it or they fall into body flow and
   strand off-screen. Keep the .sp-card.sp-fly compound selector. */
.sp-card.sp-fly { position:fixed; z-index:80; border-radius:8px; pointer-events:none; will-change:transform, opacity; margin:0 !important; }
/* comet-like light smear that follows the run up to the corner */
.sp-streak { position:fixed; z-index:78; pointer-events:none; will-change:transform, opacity; border-radius:50%;
  background:linear-gradient(90deg, transparent, rgba(255,225,150,.0) 8%, rgba(255,221,130,.75) 50%, rgba(255,225,150,0) 92%, transparent);
  filter:blur(3px); transform-origin:50% 50%; }
.sp-spark { position:fixed; z-index:79; pointer-events:none; will-change:transform, opacity;
  color:#ffe08a; line-height:1; text-shadow:0 0 7px rgba(255,200,80,1), 0 0 3px rgba(255,235,170,1); }
.sp-stock { position:relative; height:66px; cursor:pointer; }
.sp-stock.empty { opacity:.25; cursor:default; }
.sp-stock .sp-back { position:absolute; top:0; width:46px; height:64px; }
.sp-cols { flex:1; display:grid; grid-template-columns:repeat(${COLS},1fr); gap:5px; align-items:start;
  overflow-x:hidden; overflow-y:auto; padding-bottom:12px; }
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
/* face-up cards that can't be picked up (not the start of a movable run) are muted */
.sp-card.blocked { background:#a7a199; }
.sp-card .sp-rk { position:absolute; top:3px; left:6px; font-size:16px; font-weight:800; line-height:1; }
.sp-card .sp-cs { position:absolute; top:4px; right:6px; font-size:14px; line-height:1; }
.sp-card .sp-pip { position:absolute; left:0; right:0; bottom:7px; text-align:center; font-size:40px; line-height:1; }
.sp-card.navy .sp-rk, .sp-card.navy .sp-cs, .sp-card.navy .sp-pip { color:#15294f; }
.sp-card.red .sp-rk, .sp-card.red .sp-cs, .sp-card.red .sp-pip { color:#d63a2f; }

/* flip: the freshly-revealed card holds edge-on (hidden) briefly while the
   moved card slides off, then flips open with a quick, smooth ease-out */
@keyframes sp-flip {
  from { transform:perspective(360px) rotateY(90deg); }
  to { transform:perspective(360px) rotateY(0); }
}
.sp-anim-flip { animation:sp-flip .19s cubic-bezier(.25,.8,.4,1) .1s both; }
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

  let cols, stock, completed, completedRuns, history, won;
  let pendingAnims = [];
  let dealSet = null; // uids of cards currently being dealt (animated from the stock)
  let generating = false;
  let genToken = 0;
  let winPending = false;
  let bunchPending = 0; // completed runs currently in flight (not yet shown in the bunch)
  const flyEls = []; // transient fly clones, cleared on destroy

  const bunchEl = document.createElement("div");
  bunchEl.className = "sp-bunch";
  const stockEl = document.createElement("div");
  stockEl.className = "sp-stock";
  stockEl.addEventListener("click", deal);
  const topBar = el("div", "sp-top", bunchEl, stockEl);

  const colsEl = document.createElement("div");
  colsEl.className = "sp-cols";
  const colEls = Array.from({ length: COLS }, (_, j) => {
    const c = document.createElement("div");
    c.className = "sp-col";
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
    // Deal button removed — tap the stock pile (top-right) to deal a row.
    api.setFooter([
      { icon: "↶", label: "Undo", onClick: undo, disabled: history.length === 0 || won },
    ]);
  }

  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
  }

  function buildDeck() {
    const copies = 4 / suitCount;
    const deck = [];
    let uid = 0; // unique per physical card — single-suit decks repeat rank+suit
    for (let n = 0; n < copies; n++)
      for (let i = 0; i < suitCount; i++)
        for (let r = 1; r <= 13; r++) deck.push({ rank: r, suit: i, faceUp: false, uid: uid++ });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function pushHistory() {
    history.push(JSON.stringify({ cols, stock, completed, completedRuns }));
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
    clearFly(); // drop any in-flight completion clones from a previous game
    bunchPending = 0;
    cols = layout.cols;
    stock = layout.stock;
    completed = 0;
    completedRuns = [];
    history = [];
    won = false;
    winPending = false;
    generating = false;
    pendingAnims = [];
    dealingEl.style.display = "none";
    pills();
    setFooter();
    // cascade the whole tableau out of the stock
    dealSet = new Set();
    cols.forEach((c) => c.forEach((card) => dealSet.add(String(card.uid))));
    render();
    animateDeal(14);
    dealSet = null;
  }

  // Only 1-suit (spades) deals can be verified quickly enough to guarantee
  // winnability; multi-suit deals are infeasible to verify in reasonable
  // time, so they deal instantly as fair random deals.
  const NODE_CAP = 4000;
  const TIME_BUDGET = 2500;

  async function start() {
    const token = ++genToken;
    if (suitCount !== 1) {
      // Ultra Hard / Insanity: deal a fair random layout immediately
      applyLayout(randomLayout());
      return;
    }
    // Spades modes: serve a solver-verified winnable deal, generated off the
    // critical path (yielding between tries) so the UI never freezes.
    generating = true;
    cols = Array.from({ length: COLS }, () => []);
    stock = [];
    won = false;
    winPending = false;
    history = [];
    completed = 0;
    completedRuns = [];
    clearFly();
    pendingAnims = [];
    setFooter();
    render();
    dealingEl.style.display = "grid";

    let layout = null;
    const t0 = performance.now();
    while (!layout && performance.now() - t0 < TIME_BUDGET) {
      const cand = randomLayout();
      if (spSolvable(cand.cols, cand.stock, NODE_CAP)) layout = cand;
      else await new Promise((r) => setTimeout(r));
      if (token !== genToken) return; // a newer game started — abandon this one
    }
    if (token !== genToken) return;
    applyLayout(layout || randomLayout());
  }

  function deal() {
    if (won || generating || !stock.length) return;
    pushHistory();
    pendingAnims = [];
    dealSet = new Set();
    for (let j = 0; j < COLS && stock.length; j++) {
      const card = stock.pop();
      card.faceUp = true;
      cols[j].push(card);
      dealSet.add(String(card.uid));
    }
    setFooter();
    render();
    animateDeal(52); // staggered cascade out of the stock, left → right
    dealSet = null;
    processCompletions();
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

  // a run can drop on column j if it lands on a card one higher (any suit), or
  // onto an empty column — but auto-move only uses an empty column when doing so
  // exposes a face-down card (idx > 0), never to pointlessly relocate a whole pile
  function canDrop(run, idx, src, j) {
    if (j === src) return false;
    const d = cols[j];
    if (d.length === 0) return idx > 0;
    const t = d[d.length - 1];
    return t.faceUp && t.rank === run[0].rank + 1;
  }
  // rank ties on a matching card; prefer same-suit (builds toward a clearable
  // run) over a different suit, and either over dumping into an empty column
  function dropScore(run, j) {
    const d = cols[j];
    if (d.length === 0) return 1;
    return d[d.length - 1].suit === run[0].suit ? 30 : 10;
  }

  // tap a card → fly the run it starts to the best legal column (Solitaire-style)
  function onCard(j, idx, ev) {
    if (won || generating) return;
    const cardEl = ev.currentTarget;
    if (!validRun(cols[j], idx)) return shake(cardEl);
    const run = cols[j].slice(idx);
    const dst = bestDestination(
      Array.from({ length: COLS }, (_, k) => k),
      (k) => canDrop(run, idx, j, k),
      (k) => dropScore(run, k)
    );
    if (dst == null) return shake(cardEl);
    move(j, idx, dst);
  }

  function move(src, idx, dst) {
    pushHistory();
    const run = cols[src].slice(idx);
    cols[src].splice(idx);
    cols[dst].push(...run);
    pendingAnims = []; // the run's slide to dst is handled by flipRender
    if (flip(src)) pendingAnims.push({ j: src, from: cols[src].length - 1, only: true, cls: "sp-anim-flip" });
    setFooter();
    render();
    processCompletions();
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

  // A finished K→A same-suit run (the bottom 13 cards of a column) gets gathered
  // up and flown to the "bunch" in the top-left corner. Runs scan AFTER the
  // render that placed the final card, so the complete run is on screen to grab.
  function isComplete(c) {
    if (c.length < 13) return false;
    const tail = c.slice(-13);
    const suit = tail[0].suit;
    for (let k = 0; k < 13; k++)
      if (!tail[k].faceUp || tail[k].suit !== suit || tail[k].rank !== 13 - k) return false;
    return true;
  }
  function processCompletions() {
    let did = false;
    const flipAnims = [];
    for (let j = 0; j < COLS; j++) {
      if (!isComplete(cols[j])) continue;
      const suit = cols[j][cols[j].length - 1].suit;
      // grab the 13 rendered card elements before we splice + repaint
      const kids = Array.from(colEls[j].children);
      flyToBunch(kids.slice(kids.length - 13), suit);
      cols[j].splice(cols[j].length - 13);
      completed++;
      completedRuns.push(suit);
      if (flip(j)) flipAnims.push({ j, from: cols[j].length - 1, only: true, cls: "sp-anim-flip" });
      did = true;
    }
    if (did) { pendingAnims = flipAnims; render(); }
  }

  // fly the completed run's cards from their spots up into the corner bunch:
  // a staggered fan that arcs toward the top-left and trails gold sparkles,
  // then collapses into the bunch (cf. the reference recording).
  function flyToBunch(runEls, suit) {
    bunchPending++; // keep this run out of the bunch until its cards arrive
    const t = bunchEl.getBoundingClientRect();
    const tcx = t.left + t.width / 2, tcy = t.top + t.height / 2;
    // runEls are K(0)…A(12). Stagger by index so the King leaves first and the
    // Ace flies in last (after the 2); z-order is reversed so the King sits on
    // top and the Ace tucks in at the bottom of the pile when it lands.
    const clones = runEls.map((src, i) => {
      const r = src.getBoundingClientRect();
      const cl = src.cloneNode(true);
      cl.className = "sp-card sp-fly " + (suit === 1 || suit === 2 ? "red" : "navy");
      Object.assign(cl.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", zIndex: String(80 + (runEls.length - 1 - i)) });
      document.body.append(cl);
      flyEls.push(cl);
      return { cl, r };
    });
    // trail geometry: the run lifts off from its lower card and arcs to the corner
    const last = clones[clones.length - 1].r;
    const ox = last.left + last.width / 2, oy = last.top + last.height / 2;
    const DUR = 560, STAG = 26;
    const span = DUR + clones.length * STAG;
    requestAnimationFrame(() => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clones.forEach(({ cl }) => removeFly(cl));
        if (bunchPending > 0) bunchPending--; // cards have landed → reveal this run in the bunch
        renderBunch();
        popBunch();
      };
      clones.forEach(({ cl, r }, i) => {
        const dx = tcx - (r.left + r.width / 2), dy = tcy - (r.top + r.height / 2);
        // wide readable fan at the midpoint that sweeps up-left, then collapses
        const spread = (i - (clones.length - 1) / 2); // -6 … +6
        const midX = dx * 0.46 + spread * 9;
        const midY = dy * 0.46 - 26 - Math.abs(spread) * 2;
        const midRot = spread * 7;
        const endRot = spread * 3;
        if (!cl.animate) { removeFly(cl); return; }
        const a = cl.animate(
          [
            { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
            { transform: `translate(${midX}px,${midY}px) scale(.95) rotate(${midRot}deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px,${dy}px) scale(.46) rotate(${endRot}deg)`, opacity: 0.9, offset: 1 },
          ],
          { duration: DUR, delay: i * STAG, easing: "cubic-bezier(.4,.04,.2,1)", fill: "forwards" }
        );
        if (i === clones.length - 1) { a.onfinish = finish; a.oncancel = finish; }
      });
      spawnStreak(ox, oy, tcx, tcy, span);
      spawnSparkles(ox, oy, tcx, tcy, span);
      // safety net in case the last animation never fires onfinish
      setTimeout(finish, span + 320);
    });
  }
  // a soft comet smear that brightens along the path then fades, selling the sweep
  function spawnStreak(x0, y0, x1, y1, span) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    const s = document.createElement("div");
    s.className = "sp-streak";
    Object.assign(s.style, {
      left: (x0 + x1) / 2 - len / 2 + "px", top: (y0 + y1) / 2 - 7 + "px",
      width: len + "px", height: "14px", transform: `rotate(${ang}deg)`,
    });
    document.body.append(s);
    flyEls.push(s);
    if (!s.animate) { removeFly(s); return; }
    const a = s.animate(
      [{ opacity: 0 }, { opacity: 0.9, offset: 0.45 }, { opacity: 0 }],
      { duration: span * 0.9, delay: 60, easing: "ease-in-out", fill: "forwards" }
    );
    a.onfinish = () => removeFly(s);
    a.oncancel = () => removeFly(s);
  }
  // gold stars twinkling along the flight path, lighting up source→bunch
  function spawnSparkles(x0, y0, x1, y1, span) {
    const N = 22, glyphs = ["✦", "✧", "⋆", "✦", "·"];
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const off = (Math.random() * 2 - 1) * 34;
      const sx = x0 + (x1 - x0) * f + (nx / nl) * off + (Math.random() * 2 - 1) * 10;
      const sy = y0 + (y1 - y0) * f + (ny / nl) * off + (Math.random() * 2 - 1) * 10;
      const s = document.createElement("div");
      s.className = "sp-spark";
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = sx + "px"; s.style.top = sy + "px"; s.style.fontSize = 9 + Math.random() * 13 + "px";
      document.body.append(s);
      flyEls.push(s);
      if (!s.animate) { removeFly(s); continue; }
      const a = s.animate(
        [
          { transform: "scale(0) rotate(0deg)", opacity: 0 },
          { transform: "scale(1.25) rotate(35deg)", opacity: 1, offset: 0.4 },
          { transform: "scale(.15) rotate(80deg)", opacity: 0 },
        ],
        { duration: 480, delay: 80 + f * (span - 160) + Math.random() * 70, easing: "ease-out", fill: "forwards" }
      );
      a.onfinish = () => removeFly(s);
      a.oncancel = () => removeFly(s);
    }
  }
  function removeFly(cl) { cl.remove(); const i = flyEls.indexOf(cl); if (i >= 0) flyEls.splice(i, 1); }
  function clearFly() { while (flyEls.length) flyEls.pop().remove(); }
  function popBunch() {
    // springy landing with a tiny overshoot
    if (bunchEl.animate) bunchEl.animate(
      [{ transform: "scale(1.3)" }, { transform: "scale(.92)", offset: 0.55 }, { transform: "scale(1)" }],
      { duration: 320, easing: "cubic-bezier(.3,1.4,.5,1)" }
    );
  }

  function renderBunch() {
    bunchEl.replaceChildren();
    // runs still flying aren't shown until their cards land (see flyToBunch);
    // each completed run is shown as its King card, fanned for multiples
    const n = completedRuns.length - bunchPending;
    const show = Math.min(n, 4);
    for (let i = 0; i < show; i++) {
      const suit = completedRuns[n - show + i];
      const def = SUIT_DEFS[suit];
      const bc = el("div", "sp-bc " + (def.red ? "red" : "navy"));
      bc.style.transform = `rotate(${(i - (show - 1) / 2) * 8}deg)`;
      bc.style.zIndex = i;
      bc.innerHTML = `<span class="r">K${def.s}</span><span class="p">${def.s}</span>`;
      bunchEl.append(bc);
    }
    if (n > 1) { const c = el("div", "sp-bcount"); c.textContent = n; bunchEl.append(c); }
  }

  function checkWin() {
    if (completed < 4 || winPending) return;
    won = true;
    winPending = true;
    api.reportWin();
    pills();
    setFooter();
    // let the final run finish flying into the bunch before the modal pops
    setTimeout(() => {
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
    }, 900);
  }

  function undo() {
    if (!history.length || won) return;
    const prev = JSON.parse(history.pop());
    clearFly();
    bunchPending = 0;
    cols = prev.cols;
    stock = prev.stock;
    completed = prev.completed;
    completedRuns = prev.completedRuns || [];
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
      stockEl.append(back);
    }
  }

  function render() {
    flipRender(colsEl, paint, { origin: stockEl });
  }
  // fly freshly-dealt cards out of the stock to their slots, staggered L→R so
  // they cascade in with a small settle (cards in dealSet were marked nofly)
  function animateDeal(stagger) {
    if (!dealSet || !dealSet.size) return;
    const sr = stockEl.getBoundingClientRect();
    const scx = sr.left + sr.width / 2, scy = sr.top + sr.height / 2;
    let k = 0;
    for (let j = 0; j < COLS; j++) {
      for (const el of colEls[j].children) {
        if (!dealSet.has(el.dataset.cid) || !el.animate) continue;
        const r = el.getBoundingClientRect();
        const fromX = scx - (r.left + r.width / 2), fromY = scy - (r.top + r.height / 2);
        el.style.zIndex = String(60 + k);
        const a = el.animate(
          [
            { transform: `translate(${fromX}px,${fromY}px) scale(.9)`, opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { transform: "translate(0,0) scale(1.05)", offset: 0.82 },
            { transform: "translate(0,0) scale(1)" },
          ],
          { duration: 300, delay: k * stagger, easing: "cubic-bezier(.25,.7,.3,1)", fill: "backwards" }
        );
        const clr = () => { el.style.zIndex = ""; };
        a.onfinish = clr; a.oncancel = clr;
        k++;
      }
    }
  }
  function paint() {
    renderStock();
    renderBunch();
    for (let j = 0; j < COLS; j++) {
      const colEl = colEls[j];
      colEl.replaceChildren();
      colEl.classList.toggle("empty", cols[j].length === 0);
      cols[j].forEach((card, idx) => {
        const def = SUIT_DEFS[card.suit];
        const cardEl = document.createElement("div");
        const blocked = card.faceUp && !validRun(cols[j], idx); // can't be picked up
        cardEl.className = "sp-card" + (card.faceUp ? (def.red ? " red" : " navy") : " down") + (blocked ? " blocked" : "");
        cardEl.dataset.cid = card.uid;
        // cards being dealt are animated by animateDeal, so keep flipRender's
        // hands off them (don't fly them from the deck a second time)
        if (dealSet && dealSet.has(String(card.uid))) cardEl.dataset.nofly = "1";
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
        if (kids[a.from]) {
          kids[a.from].classList.add(a.cls);
          if (a.cls === "sp-anim-flip") kids[a.from].dataset.noslide = "1"; // stay hidden until the flip plays
        }
      } else {
        for (let i = a.from; i < kids.length; i++) kids[i].classList.add(a.cls);
      }
    }
    pendingAnims = [];
  }

  start();
  return { destroy: () => { clearFly(); style.remove(); } };
}
