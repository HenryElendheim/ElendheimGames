/* ============================================================
   Solitaire — classic Klondike (draw one).
   7 tableau columns, 4 foundations, stock + waste. Build the tableau
   down in alternating colours; build foundations up by suit from the
   Ace. Move everything to the foundations to win.

   Controls:
     • Tap a card  → it flies to the best legal spot (foundation first).
     • Press-hold or drag a card → carry it and drop it where you like.
     • Tap the stock → draw (and recycle the waste when empty).
   Tracks: wins + streak.
   ============================================================ */

import { flipRender } from "../core/anim.js";
import { shake, bestDestination } from "../core/cards.js";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];
const isRed = (suit) => SUITS[suit].red;
const GAP = 4;

const STYLE = `
.game-screen { background:#0e1b2b !important; }
.so-wrap { flex:1; display:flex; flex-direction:column; gap:10px; padding:8px 8px 0; min-height:0; }
.so-top { display:grid; grid-template-columns:repeat(7,1fr); gap:${GAP}px; }
.so-slot { position:relative; aspect-ratio:7/10; border-radius:7px; box-shadow:inset 0 0 0 2px rgba(255,255,255,.1); }
.so-slot.found { box-shadow:inset 0 0 0 2px rgba(255,255,255,.16); }
.so-cols { flex:1; display:grid; grid-template-columns:repeat(7,1fr); gap:${GAP}px; align-items:start; overflow-x:hidden; overflow-y:auto; padding-bottom:12px; }
.so-col { position:relative; min-height:var(--so-ch,72px); border-radius:8px; }
.so-col.empty { box-shadow:inset 0 0 0 2px rgba(255,255,255,.08); }

.so-card { position:relative; width:100%; height:var(--so-ch,72px); border-radius:7px; background:#fbfbfb;
  box-shadow:0 1px 2px rgba(0,0,0,.45); overflow:hidden; touch-action:none; user-select:none;
  -webkit-user-select:none; -webkit-touch-callout:none; }
.so-col .so-card:not(:first-child) { margin-top:calc(var(--so-ch,72px) * -0.62); }
.so-col .so-card.down:not(:first-child) { margin-top:calc(var(--so-ch,72px) * -0.80); }
.so-card.down { background:linear-gradient(160deg,#9a6cf0,#6b3fcf);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.18), 0 1px 2px rgba(0,0,0,.45); }
.so-card .so-rk { position:absolute; top:3px; left:5px; font-size:calc(var(--so-ch,72px) * 0.21); font-weight:800; line-height:1; }
.so-card .so-cs { position:absolute; top:calc(var(--so-ch,72px) * 0.05); left:calc(var(--so-cw,50px) * 0.42); font-size:calc(var(--so-ch,72px) * 0.15); }
.so-card .so-pip { position:absolute; left:0; right:0; bottom:6px; text-align:center; font-size:calc(var(--so-ch,72px) * 0.36); line-height:1; }
.so-card.navy .so-rk, .so-card.navy .so-cs, .so-card.navy .so-pip { color:#15294f; }
.so-card.red .so-rk, .so-card.red .so-cs, .so-card.red .so-pip { color:#d63a2f; }
.so-card.lift { opacity:.32; }
.so-stockback { width:100%; height:100%; border-radius:7px; background:linear-gradient(160deg,#9a6cf0,#6b3fcf);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.18); }
.so-recycle { width:100%; height:100%; display:grid; place-items:center; font-size:24px; color:rgba(255,255,255,.4); }

.so-drag { position:fixed; left:0; top:0; z-index:60; width:var(--so-cw,50px); pointer-events:none;
  will-change:transform; }
.so-drag .so-card { box-shadow:0 2px 4px rgba(0,0,0,.4); }
.so-drag .so-card:not(:first-child) { margin-top:calc(var(--so-ch,72px) * -0.62); }
.so-col.drop-ok { box-shadow:inset 0 0 0 2px var(--accent,#5cc4ff); }
.so-slot.drop-ok { box-shadow:inset 0 0 0 2px var(--accent,#5cc4ff); }

@keyframes so-pop { from{transform:scale(.85);} to{transform:scale(1);} }
@keyframes so-flip { from{transform:rotateY(90deg);} to{transform:rotateY(0);} }
/* delay + 'both' fill so the freshly-revealed card stays edge-on (hidden) while
   the moved card slides off, then flips open after it has cleared */
.so-anim-flip { animation:so-flip .26s ease .22s both; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let stock, waste, foundations, tableau, history, won;
  let pending = [];
  let autoActive = false, autoGen = 0;
  let lift = null; // {type:'tab',col,idx}|{type:'waste'}|{type:'found',i} currently being dragged
  let ghost = null;

  // top row: stock, waste, gap, 4 foundations
  const stockEl = mk("div", "so-slot");
  const wasteEl = mk("div", "so-slot");
  wasteEl.dataset.waste = "1";
  const gapEl = mk("div", "");
  const foundEls = [0, 1, 2, 3].map((i) => {
    const el = mk("div", "so-slot found");
    el.dataset.found = String(i);
    return el;
  });
  const topEl = mk("div", "so-top", stockEl, wasteEl, gapEl, ...foundEls);
  stockEl.addEventListener("click", onStock);

  const colsEl = mk("div", "so-cols");
  const colEls = Array.from({ length: 7 }, (_, j) => {
    const c = mk("div", "so-col");
    c.dataset.col = String(j);
    colsEl.append(c);
    return c;
  });

  const wrap = mk("div", "so-wrap", topEl, colsEl);
  api.root.append(wrap);

  // responsive card sizing — measure the columns and expose --so-cw/--so-ch
  function measure() {
    const w = colsEl.clientWidth;
    if (!w) return;
    const cw = Math.floor((w - 6 * GAP) / 7);
    const ch = Math.round(cw * 1.42);
    const root = document.documentElement.style;
    root.setProperty("--so-cw", cw + "px");
    root.setProperty("--so-ch", ch + "px");
  }
  const ro = new ResizeObserver(measure);
  ro.observe(colsEl);

  api.onRestart(start);

  function mk(tag, cls, ...kids) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    kids.forEach((k) => k && n.append(k));
    return n;
  }

  function setFooter() {
    api.setFooter([{ icon: "↶", label: "Undo", onClick: undo, disabled: history.length === 0 || won || autoActive }]);
  }
  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
  }

  function start() {
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ rank: r, suit: s, faceUp: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    tableau = Array.from({ length: 7 }, () => []);
    for (let j = 0; j < 7; j++) for (let k = 0; k <= j; k++) tableau[j].push(deck.pop());
    tableau.forEach((c) => (c[c.length - 1].faceUp = true));
    stock = deck; // 24, face down
    waste = [];
    foundations = [[], [], [], []];
    history = [];
    won = false;
    pending = [];
    autoActive = false;
    autoGen++;
    clearGhosts();
    setFooter();
    pills();
    measure();
    render();
  }

  function snapshot() {
    history.push(JSON.stringify({ stock, waste, foundations, tableau }));
    if (history.length > 80) history.shift();
  }

  function undo() {
    if (!history.length || won || autoActive) return;
    const p = JSON.parse(history.pop());
    ({ stock, waste, foundations, tableau } = p);
    setFooter();
    render();
  }

  function onStock() {
    if (won || autoActive) return;
    snapshot();
    if (stock.length) {
      const c = stock.pop();
      c.faceUp = true;
      waste.push(c);
    } else {
      while (waste.length) {
        const c = waste.pop();
        c.faceUp = false;
        stock.push(c);
      }
    }
    setFooter();
    render();
  }

  /* ---- rules ---- */
  function validRun(col, idx) {
    if (!col[idx] || !col[idx].faceUp) return false;
    for (let k = idx; k < col.length - 1; k++) {
      const a = col[k],
        b = col[k + 1];
      if (!b.faceUp || isRed(a.suit) === isRed(b.suit) || a.rank !== b.rank + 1) return false;
    }
    return true;
  }
  function canTab(card, j) {
    const d = tableau[j];
    if (!d.length) return card.rank === 13; // empty column accepts a King
    const t = d[d.length - 1];
    return t.faceUp && isRed(t.suit) !== isRed(card.suit) && t.rank === card.rank + 1;
  }
  function canFound(card, i) {
    const f = foundations[i];
    if (!f.length) return card.rank === 1;
    const t = f[f.length - 1];
    return t.suit === card.suit && card.rank === t.rank + 1;
  }

  /* ---- grabbing / moving ---- */
  // the cards a source would pick up (empty array if not movable)
  function grabbed(source) {
    if (source.type === "waste") return waste.length ? [waste[waste.length - 1]] : [];
    if (source.type === "found") return foundations[source.i].length ? [foundations[source.i][foundations[source.i].length - 1]] : [];
    if (source.type === "tab") return validRun(tableau[source.col], source.idx) ? tableau[source.col].slice(source.idx) : [];
    return [];
  }

  function takeFrom(source) {
    if (source.type === "waste") return [waste.pop()];
    if (source.type === "found") return [foundations[source.i].pop()];
    const run = tableau[source.col].splice(source.idx);
    const col = tableau[source.col];
    if (col.length && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
      pending.push({ col: source.col, flip: true });
    }
    return run;
  }

  function doMove(source, destType, destIndex) {
    snapshot();
    pending = [];
    const taken = takeFrom(source);
    if (destType === "found") foundations[destIndex].push(taken[0]);
    else tableau[destIndex].push(...taken);
    setFooter();
    render();
    checkWin();
    if (!won && !autoActive && canAutoComplete()) autoComplete();
  }

  // when every card is face-up and the stock + waste are empty, the board is
  // trivially solvable — cascade all cards up to the foundations, one at a time
  function canAutoComplete() {
    if (won || stock.length || waste.length) return false;
    for (const col of tableau) for (const c of col) if (!c.faceUp) return false;
    return foundations.reduce((n, f) => n + f.length, 0) < 52;
  }
  function autoComplete() {
    autoActive = true;
    const token = ++autoGen;
    setFooter();
    const step = () => {
      if (token !== autoGen) return; // restarted / left
      for (let j = 0; j < 7; j++) {
        const col = tableau[j];
        if (!col.length) continue;
        const card = col[col.length - 1];
        for (let i = 0; i < 4; i++) {
          if (canFound(card, i)) {
            col.pop();
            foundations[i].push(card);
            pending = [];
            render(); // FLIP slides the card up to its foundation
            if (foundations.reduce((n, f) => n + f.length, 0) === 52) { autoActive = false; checkWin(); return; }
            setTimeout(step, 150);
            return;
          }
        }
      }
      autoActive = false; // nothing left to lift
      setFooter();
    };
    setTimeout(step, 200);
  }

  // tap: send to the best legal spot
  function autoMove(source, cards, el) {
    if (won) return;
    if (source.type === "found") return; // pulling off a foundation is drag-only
    if (cards.length === 1) {
      const fi = bestDestination([0, 1, 2, 3], (i) => canFound(cards[0], i));
      if (fi != null) return doMove(source, "found", fi);
    }
    // prefer a non-empty legal column over an empty one (score 1 vs 0)
    const cols = [0, 1, 2, 3, 4, 5, 6].filter((j) => !(source.type === "tab" && source.col === j));
    const col = bestDestination(cols, (j) => canTab(cards[0], j), (j) => (tableau[j].length ? 1 : 0));
    if (col != null) return doMove(source, "col", col);
    shake(el); // nothing legal — nudge the card
  }

  /* ---- pointer gesture: tap to auto-move, hold/drag to carry ---- */
  const HOLD = 150,
    MOVE = 8;

  function beginGesture(e, source, el) {
    if (won || autoActive || e.button > 0) return;
    const cards = grabbed(source);
    if (!cards.length) return;
    e.preventDefault();
    const sx = e.clientX,
      sy = e.clientY;
    const rect = el.getBoundingClientRect();
    const offX = sx - rect.left,
      offY = sy - rect.top;
    let dragging = false;
    const hold = setTimeout(begin, HOLD);

    function begin() {
      if (dragging || won) return;
      dragging = true;
      startDrag(source, cards);
      moveGhost(sx, offX, sy, offY);
    }
    function onMove(ev) {
      const x = ev.clientX,
        y = ev.clientY;
      if (!dragging) {
        if (Math.abs(x - sx) > MOVE || Math.abs(y - sy) > MOVE) {
          clearTimeout(hold);
          begin();
        }
      }
      if (dragging) {
        ev.preventDefault();
        moveGhost(x, offX, y, offY);
        highlightDrop(x, y, cards, source);
      }
    }
    function onUp(ev) {
      clearTimeout(hold);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (dragging) endDrag(ev.clientX, ev.clientY, source, cards);
      else autoMove(source, cards, el);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // remove every drag ghost (defensive: overlapping gestures could orphan one
  // on document.body, where it would float over everything including modals)
  function clearGhosts() {
    document.querySelectorAll(".so-drag").forEach((g) => g.remove());
    ghost = null;
  }
  function startDrag(source, cards) {
    clearGhosts();
    lift = source;
    render(); // dims the originals
    ghost = mk("div", "so-drag", ...cards.map(faceCard));
    document.body.append(ghost);
  }

  function moveGhost(x, offX, y, offY) {
    if (ghost) ghost.style.transform = `translate(${x - offX}px, ${y - offY}px)`;
  }

  function dropTarget(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.col != null) return { type: "col", j: +el.dataset.col };
      if (el.dataset && el.dataset.found != null) return { type: "found", i: +el.dataset.found };
      el = el.parentElement;
    }
    return null;
  }

  function validDrop(t, cards, source) {
    if (!t) return false;
    if (t.type === "found") return cards.length === 1 && !(source.type === "found" && source.i === t.i) && canFound(cards[0], t.i);
    return !(source.type === "tab" && source.col === t.j) && canTab(cards[0], t.j);
  }

  function highlightDrop(x, y, cards, source) {
    colsEl.querySelectorAll(".drop-ok").forEach((n) => n.classList.remove("drop-ok"));
    foundEls.forEach((n) => n.classList.remove("drop-ok"));
    const t = dropTarget(x, y);
    if (validDrop(t, cards, source)) {
      if (t.type === "col") colEls[t.j].classList.add("drop-ok");
      else foundEls[t.i].classList.add("drop-ok");
    }
  }

  function endDrag(x, y, source, cards) {
    const t = dropTarget(x, y);
    const ok = validDrop(t, cards, source);
    clearGhosts();
    lift = null;
    colsEl.querySelectorAll(".drop-ok").forEach((n) => n.classList.remove("drop-ok"));
    foundEls.forEach((n) => n.classList.remove("drop-ok"));
    if (ok) doMove(source, t.type === "found" ? "found" : "col", t.type === "found" ? t.i : t.j);
    else render();
  }

  function checkWin() {
    if (foundations.reduce((n, f) => n + f.length, 0) !== 52) return;
    clearGhosts();
    won = true;
    api.reportWin();
    pills();
    setFooter();
    api.showModal({
      title: "You won!",
      message: "Every card home.",
      statsRows: [
        { label: "Streak", value: api.refreshStats().streak },
        { label: "Wins", value: api.refreshStats().wins },
      ],
      primaryLabel: "New Game",
      onPrimary: start,
    });
  }

  /* ---- rendering ---- */
  function faceCard(card) {
    const def = SUITS[card.suit];
    const el = mk("div", "so-card " + (def.red ? "red" : "navy"));
    el.dataset.cid = card.suit + "-" + card.rank;
    el.innerHTML = `<span class="so-rk">${RANKS[card.rank - 1]}</span><span class="so-cs">${def.s}</span><span class="so-pip">${def.s}</span>`;
    return el;
  }

  function render() {
    flipRender(wrap, paint, { origin: stockEl });
  }
  function paint() {
    // stock
    stockEl.replaceChildren();
    if (stock.length) stockEl.append(mk("div", "so-stockback"));
    else stockEl.append(Object.assign(document.createElement("div"), { className: "so-recycle", textContent: "↺" }));
    // waste — also render the card beneath the top so it stays visible
    // while a freshly drawn card flies in from the deck and covers it
    wasteEl.replaceChildren();
    if (waste.length >= 2) {
      const under = faceCard(waste[waste.length - 2]);
      under.style.position = "absolute";
      under.style.inset = "0";
      under.style.pointerEvents = "none";
      under.dataset.nofly = "1"; // backdrop only — must never fly in from the deck
      wasteEl.append(under);
    }
    if (waste.length) {
      const c = faceCard(waste[waste.length - 1]);
      c.style.position = "absolute";
      c.style.inset = "0";
      if (lift && lift.type === "waste") c.classList.add("lift");
      c.addEventListener("pointerdown", (e) => beginGesture(e, { type: "waste" }, c));
      wasteEl.append(c);
    }
    // foundations
    foundEls.forEach((el, i) => {
      el.replaceChildren();
      const f = foundations[i];
      if (f.length) {
        const c = faceCard(f[f.length - 1]);
        c.style.position = "absolute";
        c.style.inset = "0";
        // a card sliding INTO a foundation is tracked by data-cid (it slides
        // from its source); nofly only stops a card *revealed from beneath*
        // (e.g. after dragging one off) from flying in from the deck.
        c.dataset.nofly = "1";
        if (lift && lift.type === "found" && lift.i === i) c.classList.add("lift");
        c.addEventListener("pointerdown", (e) => beginGesture(e, { type: "found", i }, c));
        el.append(c);
      }
    });
    // tableau
    for (let j = 0; j < 7; j++) {
      const colEl = colEls[j];
      colEl.replaceChildren();
      colEl.classList.toggle("empty", tableau[j].length === 0);
      tableau[j].forEach((card, idx) => {
        const el = card.faceUp ? faceCard(card) : mk("div", "so-card down");
        if (!card.faceUp) el.dataset.cid = card.suit + "-" + card.rank;
        if (lift && lift.type === "tab" && lift.col === j && idx >= lift.idx) el.classList.add("lift");
        if (card.faceUp) el.addEventListener("pointerdown", (e) => beginGesture(e, { type: "tab", col: j, idx }, el));
        colEl.append(el);
      });
    }
    // flip animation on newly exposed cards
    for (const a of pending) {
      if (a.flip) {
        const kids = colEls[a.col].children;
        const last = kids[kids.length - 1];
        if (last) { last.classList.add("so-anim-flip"); last.dataset.noslide = "1"; } // stay hidden until the flip plays
      }
    }
    pending = [];
  }

  start();
  return {
    destroy: () => {
      autoGen++; // stop any running auto-complete cascade
      ro.disconnect();
      clearGhosts();
      const root = document.documentElement.style;
      root.removeProperty("--so-cw");
      root.removeProperty("--so-ch");
      style.remove();
    },
  };
}
