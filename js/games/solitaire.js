/* ============================================================
   Solitaire — classic Klondike (draw one).
   7 tableau columns, 4 foundations, stock + waste. Build the tableau
   down in alternating colours; build foundations up by suit from the
   Ace. Move everything to the foundations to win.
   Tap a card to pick it up, tap a column / foundation to drop it.
   Tap the stock to draw (and to recycle the waste when empty).
   Tracks: wins + streak.
   ============================================================ */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = [
  { s: "♠", red: false },
  { s: "♥", red: true },
  { s: "♦", red: true },
  { s: "♣", red: false },
];
const isRed = (suit) => SUITS[suit].red;

const STYLE = `
.game-screen { background:#0e1b2b !important; }
.so-wrap { flex:1; display:flex; flex-direction:column; gap:10px; padding:8px 8px 0; min-height:0; }
.so-top { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
.so-slot { position:relative; aspect-ratio:7/10; border-radius:7px; box-shadow:inset 0 0 0 2px rgba(255,255,255,.1); }
.so-slot.found { box-shadow:inset 0 0 0 2px rgba(255,255,255,.16); }
.so-cols { flex:1; display:grid; grid-template-columns:repeat(7,1fr); gap:5px; align-items:start; overflow-y:auto; padding-bottom:12px; }
.so-col { position:relative; min-height:78px; border-radius:8px; }
.so-col.empty { box-shadow:inset 0 0 0 2px rgba(255,255,255,.08); }

.so-card { position:relative; height:66px; border-radius:7px; background:#fbfbfb; box-shadow:0 1px 2px rgba(0,0,0,.45); overflow:hidden; }
.so-col .so-card:not(:first-child) { margin-top:-46px; }
.so-col .so-card.down:not(:first-child) { margin-top:-54px; }
.so-card.down { background:linear-gradient(160deg,#9a6cf0,#6b3fcf);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.18), 0 1px 2px rgba(0,0,0,.45); }
.so-card .so-rk { position:absolute; top:2px; left:5px; font-size:14px; font-weight:800; line-height:1; }
.so-card .so-cs { position:absolute; top:4px; left:19px; font-size:10px; }
.so-card .so-pip { position:absolute; left:0; right:0; bottom:5px; text-align:center; font-size:26px; line-height:1; }
.so-card.navy .so-rk, .so-card.navy .so-cs, .so-card.navy .so-pip { color:#15294f; }
.so-card.red .so-rk, .so-card.red .so-cs, .so-card.red .so-pip { color:#d63a2f; }
.so-card.sel { box-shadow:0 0 0 2px var(--accent), 0 3px 9px rgba(0,0,0,.55); z-index:3; }
.so-stockback { width:100%; height:100%; border-radius:7px; background:linear-gradient(160deg,#9a6cf0,#6b3fcf);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.18); }
.so-recycle { width:100%; height:100%; display:grid; place-items:center; font-size:24px; color:rgba(255,255,255,.4); }

@keyframes so-pop { from{transform:scale(.85);} to{transform:scale(1);} }
.so-anim { animation:so-pop .16s ease; }
@keyframes so-flip { from{transform:rotateY(90deg);} to{transform:rotateY(0);} }
.so-anim-flip { animation:so-flip .26s ease; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let stock, waste, foundations, tableau, sel, history, won;
  let pending = [];

  // top row: stock, waste, gap, 4 foundations
  const stockEl = mk("div", "so-slot");
  const wasteEl = mk("div", "so-slot");
  const gapEl = mk("div", "");
  const foundEls = [0, 1, 2, 3].map(() => mk("div", "so-slot found"));
  const topEl = mk("div", "so-top", stockEl, wasteEl, gapEl, ...foundEls);
  stockEl.addEventListener("click", onStock);
  wasteEl.addEventListener("click", onWaste);
  foundEls.forEach((el, i) => el.addEventListener("click", () => onFoundation(i)));

  const colsEl = mk("div", "so-cols");
  const colEls = Array.from({ length: 7 }, (_, j) => {
    const c = mk("div", "so-col");
    c.addEventListener("click", () => onColumn(j));
    colsEl.append(c);
    return c;
  });

  const wrap = mk("div", "so-wrap", topEl, colsEl);
  api.root.append(wrap);

  api.onRestart(start);

  function mk(tag, cls, ...kids) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    kids.forEach((k) => k && n.append(k));
    return n;
  }

  function setFooter() {
    api.setFooter([{ icon: "↶", label: "Undo", onClick: undo, disabled: history.length === 0 || won }]);
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
    sel = null;
    history = [];
    won = false;
    pending = [];
    setFooter();
    pills();
    render();
  }

  function snapshot() {
    history.push(JSON.stringify({ stock, waste, foundations, tableau }));
    if (history.length > 80) history.shift();
  }

  function undo() {
    if (!history.length || won) return;
    const p = JSON.parse(history.pop());
    ({ stock, waste, foundations, tableau } = p);
    sel = null;
    setFooter();
    render();
  }

  /* ---- interactions ---- */
  function onStock() {
    if (won) return;
    snapshot();
    sel = null;
    if (stock.length) {
      const c = stock.pop();
      c.faceUp = true;
      waste.push(c);
    } else {
      // recycle waste back into the stock
      while (waste.length) {
        const c = waste.pop();
        c.faceUp = false;
        stock.push(c);
      }
    }
    setFooter();
    render();
  }

  function onWaste(e) {
    if (e) e.stopPropagation();
    if (won || !waste.length) return;
    if (sel) return clearSel();
    sel = { from: "waste" };
    render();
  }

  function onFoundation(i) {
    if (won) return;
    if (sel) {
      const cards = selectedCards();
      if (cards.length === 1 && canFound(cards[0], i)) {
        applyMove(() => {
          foundations[i].push(takeSelected()[0]);
        });
      } else clearSel();
      return;
    }
    // select foundation top (to pull back to tableau)
    if (foundations[i].length) {
      sel = { from: "found", i };
      render();
    }
  }

  function onCard(col, idx, e) {
    e.stopPropagation();
    if (won) return;
    if (sel) return onColumn(col);
    if (validRun(tableau[col], idx)) {
      sel = { from: "tab", col, idx };
      render();
    }
  }

  function onColumn(j) {
    if (won || !sel) return;
    if (sel.from === "tab" && sel.col === j) return clearSel();
    const cards = selectedCards();
    if (canTab(cards[0], j)) {
      applyMove(() => {
        tableau[j].push(...takeSelected());
      });
    } else clearSel();
  }

  function clearSel() {
    sel = null;
    render();
  }

  function selectedCards() {
    if (sel.from === "waste") return [waste[waste.length - 1]];
    if (sel.from === "found") return [foundations[sel.i][foundations[sel.i].length - 1]];
    return tableau[sel.col].slice(sel.idx);
  }

  function takeSelected() {
    if (sel.from === "waste") return [waste.pop()];
    if (sel.from === "found") return [foundations[sel.i].pop()];
    const run = tableau[sel.col].splice(sel.idx);
    const c = tableau[sel.col];
    if (c.length && !c[c.length - 1].faceUp) {
      c[c.length - 1].faceUp = true;
      pending.push({ col: sel.col, flip: true });
    }
    return run;
  }

  function applyMove(fn) {
    snapshot();
    pending = [];
    fn();
    sel = null;
    setFooter();
    render();
    checkWin();
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

  function checkWin() {
    if (foundations.reduce((n, f) => n + f.length, 0) !== 52) return;
    won = true;
    sel = null;
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
    el.innerHTML = `<span class="so-rk">${RANKS[card.rank - 1]}</span><span class="so-cs">${def.s}</span><span class="so-pip">${def.s}</span>`;
    return el;
  }

  function render() {
    // stock
    stockEl.replaceChildren();
    if (stock.length) stockEl.append(mk("div", "so-stockback"));
    else stockEl.append(Object.assign(document.createElement("div"), { className: "so-recycle", textContent: "↺" }));
    // waste
    wasteEl.replaceChildren();
    if (waste.length) {
      const c = faceCard(waste[waste.length - 1]);
      c.style.position = "absolute";
      c.style.inset = "0";
      if (sel && sel.from === "waste") c.classList.add("sel");
      c.addEventListener("click", onWaste);
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
        if (sel && sel.from === "found" && sel.i === i) c.classList.add("sel");
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
        if (sel && sel.from === "tab" && sel.col === j && idx >= sel.idx) el.classList.add("sel");
        el.addEventListener("click", (e) => onCard(j, idx, e));
        colEl.append(el);
      });
    }
    // flip animation on newly exposed cards
    for (const a of pending) {
      if (a.flip) {
        const kids = colEls[a.col].children;
        const last = kids[kids.length - 1];
        if (last) last.classList.add("so-anim-flip");
      }
    }
    pending = [];
  }

  start();
  return { destroy: () => style.remove() };
}
