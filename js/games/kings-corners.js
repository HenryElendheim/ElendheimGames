/* ============================================================
   King's Corners — vs Computer.
   A cross of 4 edge piles around the stock, plus 4 corner piles.
   Draw one at the start of your turn, then play as many cards as
   you like: build DOWN in alternating colour on the edges, start
   the corners with Kings only. Move whole piles to free space.
   First to empty their hand wins. Tracks wins + streak.
   ============================================================ */

import { flipRender } from "../core/anim.js";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const STYLE = `
.kc-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:10px; padding:12px 10px 8px; }
.kc-msg { font-size:14px; font-weight:700; min-height:20px; text-align:center; color:var(--text-dim); letter-spacing:.02em; }
.kc-msg b { color:#fff; }
.kc-board { display:grid; grid-template-columns:repeat(3, 1fr); gap:9px; width:100%; max-width:280px; margin:30px 0 14px; }
.kc-cell { aspect-ratio:5/7; border-radius:9px; position:relative; display:grid; place-items:center; }
.kc-slot { width:100%; height:100%; border-radius:9px; border:2px dashed rgba(255,255,255,.18); display:grid; place-items:center; }
.kc-slot.corner { border-style:dotted; }
.kc-slot .hint { font-size:9px; color:rgba(255,255,255,.3); font-weight:700; letter-spacing:.06em; }
.kc-card { width:100%; height:100%; border-radius:9px; background:#fbfbfb; color:#1a1a1a; position:relative;
  box-shadow:0 3px 7px rgba(0,0,0,.4); display:grid; place-items:center; font-size:22px; font-weight:800;
  user-select:none; }
.kc-card.red { color:#d63a2f; }
.kc-card .rk { position:absolute; top:3px; left:5px; font-size:12px; line-height:1; }
.kc-card .rk-br { top:auto; left:auto; bottom:3px; right:5px; }
.kc-card.back { background:repeating-linear-gradient(45deg,#caa017,#caa017 5px,#a8830f 5px,#a8830f 10px); color:#fff; }
/* lead card peeking out from under the top of a pile */
.kc-cell .kc-top { position:relative; z-index:1; }
.kc-base { position:absolute; left:0; top:0; width:100%; height:100%; z-index:0;
  box-shadow:0 2px 6px rgba(0,0,0,.55); }
.kc-base.kc-peek-u  { top:-34%; }
.kc-base.kc-peek-d  { top:34%; }
.kc-base.kc-peek-l  { left:-44%; }
.kc-base.kc-peek-r  { left:44%; }
.kc-base.kc-peek-ul { top:-32%; left:-32%; }
.kc-base.kc-peek-ur { top:-32%; left:32%; }
.kc-base.kc-peek-dl { top:32%; left:-32%; }
.kc-base.kc-peek-dr { top:32%; left:32%; }
.kc-cell.target .kc-top, .kc-cell.target .kc-slot { outline:3px solid var(--kc-glow,#ffd75e); outline-offset:1px; box-shadow:0 0 14px var(--kc-glow,#ffd75e); }
.kc-cell.target .kc-slot { border-color:var(--kc-glow,#ffd75e); }
.kc-cell.sel .kc-top { outline:3px solid #fff; outline-offset:1px; }
.kc-stock { position:relative; cursor:default; }
.kc-stock .cnt { position:absolute; bottom:3px; right:5px; font-size:11px; font-weight:800; color:#fff;
  text-shadow:0 1px 2px #000; }
.kc-hand { display:flex; gap:0; padding:6px 4px 2px; min-height:74px; align-items:flex-end; overflow-x:auto;
  width:100%; justify-content:center; }
.kc-hand .kc-card { width:48px; height:68px; flex:0 0 auto; margin-left:-14px; transition:transform .12s; font-size:18px; }
.kc-hand .kc-card:first-child { margin-left:0; }
.kc-hand .kc-card.sel { transform:translateY(-12px); outline:3px solid var(--kc-glow,#ffd75e); }
.kc-hand .kc-card.playable { box-shadow:0 0 0 2px rgba(255,215,94,.55), 0 3px 7px rgba(0,0,0,.4); }
.kc-tag { font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim); }
@keyframes kc-deal { from{transform:translateY(-10px);opacity:.3;} to{transform:none;opacity:1;} }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  const glow = api.glow(0.9);

  // --- state ---
  let stock, edges, corners, hand, cpuHand, turn, busy, selHand, selPile, played, stalls;
  const cellOf = new WeakMap(); // pile -> its current rendered cell (for clear FX)
  const kcFx = []; // transient poof clones, cleared on destroy

  const msg = document.createElement("div");
  msg.className = "kc-msg";
  const board = document.createElement("div");
  board.className = "kc-board";
  const cpuHandEl = document.createElement("div");
  cpuHandEl.className = "kc-hand kc-cpuhand";
  const handEl = document.createElement("div");
  handEl.className = "kc-hand";
  const wrap = document.createElement("div");
  wrap.className = "kc-wrap";
  wrap.style.setProperty("--kc-glow", glow);
  wrap.append(cpuHandEl, msg, board, document.createElement("div"), handEl);
  api.root.append(wrap);

  api.onRestart(start);

  // --- deck helpers ---
  function makeDeck() {
    const suits = [["♠", "b"], ["♣", "b"], ["♥", "r"], ["♦", "r"]];
    const d = [];
    for (const [s, c] of suits) for (let i = 0; i < 13; i++) d.push({ r: RANKS[i], s, c, v: i + 1 });
    for (let i = d.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  // can `card` be placed on `pile`?
  function canPlace(card, pile) {
    if (pile.done) return false; // a completed pile is flipped over — slot is locked
    if (pile.cards.length === 0) return pile.type === "corner" ? card.v === 13 : true;
    const top = pile.cards[pile.cards.length - 1];
    return card.v === top.v - 1 && card.c !== top.c;
  }
  // can the whole `src` pile be moved onto `dst`? (lead = highest = src.cards[0])
  function canMovePile(src, dst) {
    if (src === dst || src.done || src.cards.length === 0) return false;
    return canPlace(src.cards[0], dst);
  }

  const allPiles = () => edges.concat(corners);

  function anyHandPlay(h) {
    return h.some((c) => allPiles().some((p) => canPlace(c, p)));
  }

  // A pile is complete once it holds a full King→Ace run (13 cards — every pile
  // is a strict descending alternating-colour run by the placement rules, so
  // length 13 means K down to A). Completed piles flip face-down and LOCK: the
  // slot can't be played on or moved again for the rest of the game.
  function lockCompletePiles() {
    const newly = [];
    for (const p of allPiles()) {
      if (p.cards.length >= 13 && !p.done) {
        const cell = cellOf.get(p);
        const face = cell && (cell.querySelector(".kc-top") || cell.querySelector(".kc-card"));
        newly.push({ p, rect: face && face.getBoundingClientRect(), faceClone: face && face.cloneNode(true) });
        p.done = true;
      }
    }
    if (!newly.length) return;
    render(); // the cell now shows a face-down back
    newly.forEach(flipOver);
  }
  // satisfying flip-over: the face spins away (0→90°) while the back spins in
  // (-90°→0°), so the completed pile visibly turns face-down in place.
  function flipOver({ p, rect, faceClone }) {
    if (!rect || !faceClone || !faceClone.animate) return;
    Object.assign(faceClone.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px",
      width: rect.width + "px", height: rect.height + "px", margin: "0", zIndex: "80", pointerEvents: "none",
      backfaceVisibility: "hidden" });
    document.body.append(faceClone);
    kcFx.push(faceClone);
    const cleanup = () => { faceClone.remove(); const i = kcFx.indexOf(faceClone); if (i >= 0) kcFx.splice(i, 1); };
    const a = faceClone.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(90deg)" }],
      { duration: 200, easing: "ease-in", fill: "forwards" });
    a.onfinish = cleanup; a.oncancel = cleanup;
    const back = cellOf.get(p)?.querySelector(".kc-card.back");
    if (back) back.animate([{ transform: "rotateY(-90deg)" }, { transform: "rotateY(0deg)" }],
      { duration: 200, delay: 200, easing: "ease-out", fill: "backwards" });
  }
  function clearFx() { while (kcFx.length) kcFx.pop().remove(); }

  // --- rendering ---
  function cardFace(c, cls = "", base = false) {
    const el = document.createElement("div");
    el.className = "kc-card" + (c.c === "r" ? " red" : "") + (cls ? " " + cls : "");
    if (c.s) el.dataset.cid = c.s + c.r;
    // base (lead) cards peek out from under the pile — a second rank in the
    // opposite corner guarantees the value is readable whichever way it pokes.
    el.innerHTML = `<span class="rk">${c.r}</span>${c.s}` + (base ? `<span class="rk rk-br">${c.r}</span>` : "");
    return el;
  }

  function backCard() {
    const back = cardFace({ r: "", s: "", c: "b" }, "back");
    back.querySelector(".rk").textContent = "";
    if (back.childNodes[1]) back.childNodes[1].textContent = "";
    return back;
  }

  function pileCell(pile, peek) {
    const cell = document.createElement("div");
    cell.className = "kc-cell";
    cellOf.set(pile, cell);
    if (pile.done) {
      // completed pile flipped face-down — slot is locked, not interactive
      cell.classList.add("kc-locked");
      cell.append(backCard());
      return cell;
    }
    if (pile.cards.length) {
      // show the bottom (lead) card peeking outward so you can read what the
      // pile was started from / what its stack would move as
      if (pile.cards.length >= 2) {
        cell.append(cardFace(pile.cards[0], "kc-base kc-peek-" + peek, true));
      }
      cell.append(cardFace(pile.cards[pile.cards.length - 1], "kc-top"));
    } else {
      const slot = document.createElement("div");
      slot.className = "kc-slot" + (pile.type === "corner" ? " corner" : "");
      if (pile.type === "corner") slot.innerHTML = '<span class="hint">K</span>';
      cell.append(slot);
    }
    if (selPile === pile) cell.classList.add("sel");
    // highlight legal targets for the current selection
    const card = selHand != null ? hand[selHand] : null;
    if (card && canPlace(card, pile)) cell.classList.add("target");
    if (selPile && canMovePile(selPile, pile)) cell.classList.add("target");
    cell.addEventListener("click", () => onPile(pile));
    return cell;
  }

  function stockCell() {
    const cell = document.createElement("div");
    cell.className = "kc-cell kc-stock";
    if (stock.length) {
      const back = cardFace({ r: "", s: "", c: "b" }, "back");
      back.querySelector(".rk").textContent = "";
      back.childNodes[1] && (back.childNodes[1].textContent = "");
      const cnt = document.createElement("div");
      cnt.className = "cnt";
      cnt.textContent = stock.length;
      back.append(cnt);
      cell.append(back);
    } else {
      const slot = document.createElement("div");
      slot.className = "kc-slot";
      slot.innerHTML = '<span class="hint">EMPTY</span>';
      cell.append(slot);
    }
    return cell;
  }

  function render() {
    flipRender(wrap, paint, { origin: () => wrap.querySelector(".kc-stock") });
  }
  function paint() {
    // grid order: TL, N, TR / W, stock, E / BL, S, BR — each pile's lead card
    // peeks toward the outside of the cross (the second value is the peek dir)
    const order = [
      [corners[0], "ul"], [edges[0], "u"], [corners[1], "ur"],
      [edges[3], "l"], "stock", [edges[1], "r"],
      [corners[2], "dl"], [edges[2], "d"], [corners[3], "dr"],
    ];
    board.replaceChildren(...order.map((p) => (p === "stock" ? stockCell() : pileCell(p[0], p[1]))));

    handEl.replaceChildren(
      ...hand.map((c, i) => {
        const playable = anyHandPlay([c]);
        const el = cardFace(c, (i === selHand ? "sel " : "") + (playable && turn === "you" ? "playable" : ""));
        el.style.zIndex = i;
        el.addEventListener("click", () => onHand(i));
        return el;
      })
    );
    cpuHandEl.replaceChildren(
      ...cpuHand.map((_, i) => {
        const el = document.createElement("div");
        el.className = "kc-card back";
        el.style.zIndex = i;
        return el;
      })
    );
    api.setStats({ left: { label: "Your cards", value: hand.length }, right: { label: "CPU cards", value: cpuHand.length } });
  }

  // --- player interaction ---
  function onHand(i) {
    if (busy || turn !== "you") return;
    selPile = null;
    selHand = selHand === i ? null : i;
    setMsg();
    render();
  }

  function onPile(pile) {
    if (busy || turn !== "you" || pile.done) return; // locked piles are inert
    if (selHand != null) {
      const card = hand[selHand];
      if (canPlace(card, pile)) {
        pile.cards.push(card);
        hand.splice(selHand, 1);
        selHand = null;
        played = true;
        stalls = 0;
        render();
        lockCompletePiles();
        if (hand.length === 0) return finish("you");
        setMsg();
      }
      return;
    }
    if (selPile) {
      if (canMovePile(selPile, pile)) {
        pile.cards.push(...selPile.cards);
        selPile.cards = [];
        selPile = null;
        played = true;
        render();
        lockCompletePiles();
        setMsg();
      } else {
        selPile = selPile === pile ? null : pile.cards.length ? pile : null;
        render();
      }
      return;
    }
    // no selection: pick up a non-empty pile to move it
    if (pile.cards.length) {
      selPile = pile;
      setMsg("Pick a pile or edge to move this stack onto.");
      render();
    }
  }

  function setMsg(text) {
    if (text) { msg.innerHTML = text; return; }
    if (turn !== "you") { msg.textContent = "Computer is thinking…"; return; }
    msg.innerHTML = anyMove("you")
      ? "<b>Your turn</b> — play cards, then end your turn."
      : "<b>Your turn</b> — no moves, tap End Turn.";
  }

  function anyMove(who) {
    const h = who === "you" ? hand : cpuHand;
    if (anyHandPlay(h)) return true;
    // a pile move that frees an edge and lets a hand card land there
    for (const src of edges) {
      if (!src.cards.length) continue;
      for (const dst of allPiles()) {
        if (canMovePile(src, dst)) {
          if (h.some((c) => c.v === 13) || true) return true; // freeing an edge always opens an "any card" slot
        }
      }
    }
    return false;
  }

  // --- turn flow ---
  function endTurn() {
    if (busy || turn !== "you") return;
    selHand = null;
    selPile = null;
    if (!played) stalls++;
    if (checkStalemate()) return;
    turn = "cpu";
    busy = true;
    setFooter();
    setMsg();
    render();
    setTimeout(cpuTurn, 550);
  }

  function checkStalemate() {
    if (stock.length === 0 && stalls >= 2) {
      finish(hand.length < cpuHand.length ? "you" : cpuHand.length < hand.length ? "cpu" : "tie");
      return true;
    }
    return false;
  }

  function startYourTurn() {
    turn = "you";
    played = false;
    if (stock.length) hand.push(stock.pop());
    busy = false;
    setFooter();
    setMsg();
    render();
  }

  // --- CPU ---
  function cpuPlayOne() {
    // 1) direct hand play — prefer Kings to empty corners, then highest card
    let best = null;
    for (let i = 0; i < cpuHand.length; i++) {
      for (const p of allPiles()) {
        if (!canPlace(cpuHand[i], p)) continue;
        const score =
          (p.type === "corner" && p.cards.length === 0 ? 100 : 0) + cpuHand[i].v;
        if (!best || score > best.score) best = { i, p, score };
      }
    }
    if (best) {
      best.p.cards.push(cpuHand[best.i]);
      cpuHand.splice(best.i, 1);
      return true;
    }
    // 2) pile move that opens an edge so a hand card can be placed there
    for (const src of edges) {
      if (!src.cards.length) continue;
      for (const dst of allPiles()) {
        if (!canMovePile(src, dst)) continue;
        if (cpuHand.length) {
          dst.cards.push(...src.cards);
          src.cards = [];
          return true; // next step will drop a card on the freed edge
        }
      }
    }
    return false;
  }

  function cpuTurn() {
    if (stock.length) cpuHand.push(stock.pop());
    let progressed = false;
    const step = () => {
      const did = cpuPlayOne();
      if (did) {
        progressed = true;
        stalls = 0;
        render();
        lockCompletePiles();
        if (cpuHand.length === 0) return finish("cpu");
        setTimeout(step, 480);
      } else {
        if (!progressed) stalls++;
        if (checkStalemate()) return;
        startYourTurn();
      }
    };
    setTimeout(step, 480);
  }

  function setFooter() {
    api.setFooter([{ icon: "✓", label: "End Turn", onClick: endTurn, accent: true, disabled: turn !== "you" || busy }]);
  }

  function finish(winner) {
    busy = true;
    turn = "done";
    setFooter();
    render();
    const won = winner === "you";
    if (winner === "you") api.reportWin();
    else if (winner === "cpu") api.reportLoss();
    const s = api.refreshStats();
    setMsg(won ? "<b>You win!</b>" : winner === "tie" ? "<b>It's a tie.</b>" : "<b>Computer wins.</b>");
    api.showModal({
      title: won ? "You win!" : winner === "tie" ? "It's a tie" : "Computer wins",
      message: won ? "You emptied your hand first." : winner === "tie" ? "Equal cards left when the stock ran out." : "The computer emptied its hand first.",
      statsRows: [
        { label: "Your cards", value: hand.length },
        { label: "Streak", value: s.streak },
        { label: "Wins", value: s.wins },
      ],
      primaryLabel: "Play Again",
      onPrimary: start,
    });
  }

  function start() {
    const deck = makeDeck();
    edges = [0, 1, 2, 3].map(() => ({ type: "edge", cards: [] }));
    corners = [0, 1, 2, 3].map(() => ({ type: "corner", cards: [] }));
    hand = deck.splice(0, 7);
    cpuHand = deck.splice(0, 7);
    for (const e of edges) e.cards.push(deck.pop());
    stock = deck;
    turn = "you";
    busy = false;
    selHand = null;
    selPile = null;
    played = false;
    stalls = 0;
    setFooter();
    setMsg();
    render();
  }

  start();
  return { destroy: () => { clearFx(); style.remove(); } };
}
