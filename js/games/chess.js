/* ============================================================
   Chess — self-contained engine (no dependencies, fully offline).
   Full legal move generation: castling, en passant, promotion,
   check / checkmate / stalemate. The computer plays via alpha-beta negamax search with
   material + piece-square evaluation; depth set by difficulty.
   Modes: cpu (you = White) | local (pass-and-play).
   Tracks: wins + streak (vs computer).
   ============================================================ */

const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const KNIGHT = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ROYAL = [...DIAG, ...ORTH];
// piece-square tables (white perspective, rank 8 = row 0)
const PST_PAWN = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
const PST_KNIGHT = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const STYLE = `
.ch-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:10px; }
.ch-status { font-size:16px; font-weight:800; color:var(--text-dim); min-height:22px; letter-spacing:.01em; }
.ch-board { display:grid; grid-template-columns:repeat(8,1fr); grid-template-rows:repeat(8,1fr);
  width:min(94vw,440px); aspect-ratio:1; border-radius:12px; overflow:hidden; touch-action:manipulation;
  box-shadow:0 12px 30px rgba(0,0,0,.5), 0 0 0 4px #2b3350, 0 0 0 5px rgba(255,255,255,.06); }
.ch-sq { position:relative; display:grid; place-items:center; line-height:1; }
.ch-sq.light { background:#e9edf6; } .ch-sq.dark { background:#5b6796; }
/* highlights drawn as inset tints so the piece + square colour still show through */
.ch-sq.lastmv { box-shadow:inset 0 0 0 100px rgba(245,211,107,.26); }
.ch-sq.check  { box-shadow:inset 0 0 0 100px rgba(239,83,80,.55); }
.ch-sq.sel    { box-shadow:inset 0 0 0 100px rgba(245,211,107,.5); }
.ch-sq .pc { width:90%; height:90%; display:block; filter:drop-shadow(0 2px 2px rgba(0,0,0,.45)); }
.ch-sq .pc text { paint-order:stroke; stroke-linejoin:round; }
.ch-sq .pc.w text { fill:#f7f9fd; stroke:#15171e; stroke-width:3.4; }
.ch-sq .pc.b text { fill:#23262f; stroke:#b6bed0; stroke-width:1.8; }
.ch-sq .dot { position:absolute; width:30%; height:30%; border-radius:50%; background:rgba(20,30,55,.32); }
.ch-sq .ring { position:absolute; inset:5%; border-radius:50%; box-shadow:inset 0 0 0 5px rgba(20,30,55,.32); }
/* coordinate labels on the edge squares */
.ch-sq[data-file]::after { content:attr(data-file); position:absolute; right:4px; bottom:2px; font-size:10px; font-weight:800; }
.ch-sq[data-rank]::before { content:attr(data-rank); position:absolute; left:4px; top:2px; font-size:10px; font-weight:800; }
.ch-sq.light[data-file]::after, .ch-sq.light[data-rank]::before { color:rgba(91,103,150,.85); }
.ch-sq.dark[data-file]::after, .ch-sq.dark[data-rank]::before { color:rgba(233,237,246,.9); }
.ch-promo { position:absolute; inset:0; background:rgba(0,0,0,.6); display:grid; place-items:center; z-index:5; }
.ch-promo .row { display:flex; gap:8px; background:var(--surface); padding:12px; border-radius:14px; }
.ch-promo button { width:52px; height:52px; font-size:34px; background:#e9edf6; border-radius:10px; color:#1a1d24; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const isCpu = api.settings.mode !== "local";
  const depth = { EASY: 1, MEDIUM: 2, HARD: 3 }[api.settings.difficulty] || 2;
  const session = { w: 0, b: 0 };

  let state, selected, legal, over, lastMove;

  const status = document.createElement("div");
  status.className = "ch-status";
  const boardEl = document.createElement("div");
  boardEl.className = "ch-board";
  const wrap = document.createElement("div");
  wrap.className = "ch-wrap";
  wrap.append(status, boardEl);
  api.root.append(wrap);

  const sqEls = [];
  for (let r = 0; r < 8; r++) {
    sqEls[r] = [];
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement("div");
      sq.className = "ch-sq " + ((r + c) % 2 ? "dark" : "light");
      if (r === 7) sq.dataset.file = "abcdefgh"[c]; // files along the bottom rank
      if (c === 0) sq.dataset.rank = String(8 - r); // ranks down the left file
      sq.addEventListener("click", () => onSquare(r, c));
      boardEl.append(sq);
      sqEls[r][c] = sq;
    }
  }

  api.onRestart(start);

  function pills() {
    if (isCpu) {
      const s = api.refreshStats();
      api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
    } else {
      api.setStats({ left: { label: "White Wins", value: session.w }, right: { label: "Black Wins", value: session.b } });
    }
  }

  function start() {
    state = initialState();
    selected = null;
    legal = [];
    over = false;
    lastMove = null;
    pills();
    updateStatus();
    render();
  }

  function updateStatus() {
    if (over) return;
    const chk = inCheck(state, state.turn) ? " — Check!" : "";
    let text;
    if (isCpu) text = state.turn === "w" ? "Your turn" : "Computer thinking…";
    else text = state.turn === "w" ? "White's turn" : "Black's turn";
    status.textContent = text + chk;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  function pieceSvg(p) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "pc " + p.color);
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", "50");
    t.setAttribute("y", "50");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("font-size", "88");
    t.textContent = GLYPH[p.type];
    svg.append(t);
    return svg;
  }

  function render() {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const sq = sqEls[r][c];
        sq.className = "ch-sq " + ((r + c) % 2 ? "dark" : "light");
        sq.replaceChildren();
        const p = state.board[r][c];
        if (p) {
          sq.append(pieceSvg(p));
        }
      }
    // last move (from + to squares)
    if (lastMove) {
      sqEls[lastMove.from[0]][lastMove.from[1]].classList.add("lastmv");
      sqEls[lastMove.to[0]][lastMove.to[1]].classList.add("lastmv");
    }
    // king in check
    if (!over) {
      const k = findKing(state.board, state.turn);
      if (k && inCheck(state, state.turn)) sqEls[k[0]][k[1]].classList.add("check");
    }
    if (selected) {
      sqEls[selected[0]][selected[1]].classList.add("sel");
      for (const m of legal) {
        const dot = document.createElement("div");
        dot.className = state.board[m.to[0]][m.to[1]] ? "ring" : "dot";
        sqEls[m.to[0]][m.to[1]].append(dot);
      }
    }
  }

  function onSquare(r, c) {
    if (over) return;
    if (isCpu && state.turn === "b") return;
    const p = state.board[r][c];
    if (selected) {
      const move = legal.find((m) => m.to[0] === r && m.to[1] === c);
      if (move) return doMove(move);
      if (p && p.color === state.turn) return select(r, c);
      selected = null;
      legal = [];
      return render();
    }
    if (p && p.color === state.turn) select(r, c);
  }

  function select(r, c) {
    selected = [r, c];
    legal = generateMoves(state, state.turn).filter((m) => m.from[0] === r && m.from[1] === c);
    render();
  }

  function doMove(move) {
    if (move.promotion) {
      return askPromotion(move.to[1], (type) => finishMove({ ...move, promotion: type }));
    }
    finishMove(move);
  }

  function finishMove(move) {
    state = applyMove(state, move);
    lastMove = move;
    selected = null;
    legal = [];
    render();
    if (endIfOver()) return;
    updateStatus();
    if (isCpu && state.turn === "b") {
      setTimeout(() => {
        const m = chooseComputerMove(state, depth);
        if (m) {
          state = applyMove(state, m);
          lastMove = m;
          render();
          if (endIfOver()) return;
        }
        updateStatus();
      }, 250);
    }
  }

  function endIfOver() {
    const moves = generateMoves(state, state.turn);
    if (moves.length > 0) return false;
    over = true;
    let title, winner;
    if (inCheck(state, state.turn)) {
      winner = state.turn === "w" ? "b" : "w"; // side to move is checkmated
      title = (winner === "w" ? "White" : "Black") + " wins by checkmate!";
    } else {
      winner = null;
      title = "Stalemate — draw";
    }
    if (isCpu) {
      if (winner === "w") api.reportWin();
      else if (winner === "b") api.reportLoss();
    } else if (winner) session[winner]++;
    pills();
    status.textContent = title;
    api.showModal({
      title,
      statsRows: isCpu
        ? [{ label: "Streak", value: api.refreshStats().streak }, { label: "Wins", value: api.refreshStats().wins }]
        : [{ label: "White", value: session.w }, { label: "Black", value: session.b }],
      primaryLabel: "New Game",
      onPrimary: start,
    });
    return true;
  }

  function askPromotion(col, cb) {
    const overlay = document.createElement("div");
    overlay.className = "ch-promo";
    const row = document.createElement("div");
    row.className = "row";
    for (const t of ["q", "r", "b", "n"]) {
      const b = document.createElement("button");
      b.textContent = GLYPH[t];
      b.addEventListener("click", () => {
        overlay.remove();
        cb(t);
      });
      row.append(b);
    }
    overlay.append(row);
    wrap.append(overlay);
  }

  start();
  return { destroy: () => style.remove() };
}

/* ============================================================
   Engine
   ============================================================ */
function initialState() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: back[c], color: "w" };
  }
  return { board, turn: "w", castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null };
}

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const opp = (col) => (col === "w" ? "b" : "w");

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) return [r, c];
    }
  return null;
}

function isAttacked(board, r, c, by) {
  // pawns
  const dir = by === "w" ? 1 : -1; // a white pawn sits one row *below* the square it attacks
  for (const dc of [-1, 1]) {
    const pr = r + dir,
      pc = c + dc;
    if (inside(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === by && p.type === "p") return true;
    }
  }
  // knights
  for (const [dr, dc] of KNIGHT) {
    const p = inside(r + dr, c + dc) && board[r + dr][c + dc];
    if (p && p.color === by && p.type === "n") return true;
  }
  // king
  for (const [dr, dc] of ROYAL) {
    const p = inside(r + dr, c + dc) && board[r + dr][c + dc];
    if (p && p.color === by && p.type === "k") return true;
  }
  // sliding
  for (const [dr, dc] of DIAG) {
    let rr = r + dr,
      cc = c + dc;
    while (inside(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.color === by && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  for (const [dr, dc] of ORTH) {
    let rr = r + dr,
      cc = c + dc;
    while (inside(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.color === by && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  return false;
}

function inCheck(state, color) {
  const k = findKing(state.board, color);
  return k ? isAttacked(state.board, k[0], k[1], opp(color)) : false;
}

function pseudoMoves(state, color) {
  const { board } = state;
  const moves = [];
  const add = (fr, fc, tr, tc, extra) => moves.push({ from: [fr, fc], to: [tr, tc], ...extra });

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      if (p.type === "p") {
        const dir = color === "w" ? -1 : 1;
        const startRow = color === "w" ? 6 : 1;
        const promoRow = color === "w" ? 0 : 7;
        // forward
        if (inside(r + dir, c) && !board[r + dir][c]) {
          if (r + dir === promoRow) add(r, c, r + dir, c, { promotion: "q" });
          else add(r, c, r + dir, c, {});
          if (r === startRow && !board[r + 2 * dir][c]) add(r, c, r + 2 * dir, c, { double: true });
        }
        // captures
        for (const dc of [-1, 1]) {
          const tr = r + dir,
            tc = c + dc;
          if (!inside(tr, tc)) continue;
          const t = board[tr][tc];
          if (t && t.color !== color) {
            if (tr === promoRow) add(r, c, tr, tc, { promotion: "q" });
            else add(r, c, tr, tc, {});
          } else if (state.ep && state.ep[0] === tr && state.ep[1] === tc) {
            add(r, c, tr, tc, { enpassant: true });
          }
        }
      } else if (p.type === "n") {
        for (const [dr, dc] of KNIGHT) {
          const tr = r + dr,
            tc = c + dc;
          if (inside(tr, tc) && (!board[tr][tc] || board[tr][tc].color !== color)) add(r, c, tr, tc, {});
        }
      } else if (p.type === "k") {
        for (const [dr, dc] of ROYAL) {
          const tr = r + dr,
            tc = c + dc;
          if (inside(tr, tc) && (!board[tr][tc] || board[tr][tc].color !== color)) add(r, c, tr, tc, {});
        }
        // castling
        const row = color === "w" ? 7 : 0;
        const rights = state.castle;
        if (r === row && c === 4 && !isAttacked(board, row, 4, opp(color))) {
          if ((color === "w" ? rights.wK : rights.bK) && !board[row][5] && !board[row][6] &&
              board[row][7] && board[row][7].type === "r" &&
              !isAttacked(board, row, 5, opp(color)) && !isAttacked(board, row, 6, opp(color)))
            add(r, c, row, 6, { castle: "K" });
          if ((color === "w" ? rights.wQ : rights.bQ) && !board[row][3] && !board[row][2] && !board[row][1] &&
              board[row][0] && board[row][0].type === "r" &&
              !isAttacked(board, row, 3, opp(color)) && !isAttacked(board, row, 2, opp(color)))
            add(r, c, row, 2, { castle: "Q" });
        }
      } else {
        const dirs = p.type === "b" ? DIAG : p.type === "r" ? ORTH : ROYAL;
        for (const [dr, dc] of dirs) {
          let tr = r + dr,
            tc = c + dc;
          while (inside(tr, tc)) {
            const t = board[tr][tc];
            if (!t) add(r, c, tr, tc, {});
            else {
              if (t.color !== color) add(r, c, tr, tc, {});
              break;
            }
            tr += dr;
            tc += dc;
          }
        }
      }
    }
  return moves;
}

function applyMove(state, m) {
  const board = state.board.map((row) => row.slice());
  const castle = { ...state.castle };
  const piece = board[m.from[0]][m.from[1]];
  const color = piece.color;
  let ep = null;

  board[m.to[0]][m.to[1]] = m.promotion ? { type: m.promotion, color } : piece;
  board[m.from[0]][m.from[1]] = null;

  if (m.enpassant) board[m.from[0]][m.to[1]] = null; // captured pawn sits on from-row, to-col
  if (m.double) ep = [(m.from[0] + m.to[0]) / 2, m.from[1]];
  if (m.castle) {
    const row = m.from[0];
    if (m.castle === "K") {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }
  // update castling rights
  if (piece.type === "k") {
    if (color === "w") { castle.wK = castle.wQ = false; } else { castle.bK = castle.bQ = false; }
  }
  const touch = (r, c) => {
    if (r === 7 && c === 0) castle.wQ = false;
    if (r === 7 && c === 7) castle.wK = false;
    if (r === 0 && c === 0) castle.bQ = false;
    if (r === 0 && c === 7) castle.bK = false;
  };
  touch(m.from[0], m.from[1]);
  touch(m.to[0], m.to[1]);

  return { board, turn: opp(color), castle, ep };
}

function generateMoves(state, color) {
  return pseudoMoves(state, color).filter((m) => {
    const ns = applyMove(state, m);
    return !inCheck({ ...ns, turn: color }, color);
  });
}

/* ---------- computer opponent ---------- */
function evaluate(state) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      let v = VALUE[p.type];
      const pr = p.color === "w" ? r : 7 - r;
      if (p.type === "p") v += PST_PAWN[pr][c];
      else if (p.type === "n") v += PST_KNIGHT[pr][c];
      score += p.color === "w" ? v : -v;
    }
  return state.turn === "w" ? score : -score;
}

function orderMoves(state, moves) {
  return moves
    .map((m) => {
      const cap = state.board[m.to[0]][m.to[1]];
      const score = (cap ? 10 * VALUE[cap.type] - VALUE[state.board[m.from[0]][m.from[1]].type] : 0) + (m.promotion ? 800 : 0);
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

function negamax(state, depth, alpha, beta) {
  const moves = generateMoves(state, state.turn);
  if (moves.length === 0) return inCheck(state, state.turn) ? -1e6 - depth : 0;
  if (depth === 0) return evaluate(state);
  let best = -Infinity;
  for (const m of orderMoves(state, moves)) {
    const score = -negamax(applyMove(state, m), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseComputerMove(state, depth) {
  const moves = generateMoves(state, state.turn);
  if (!moves.length) return null;
  if (depth <= 1 && Math.random() < 0.35) return moves[(Math.random() * moves.length) | 0];

  let best = -Infinity,
    pick = [];
  for (const m of orderMoves(state, moves)) {
    const score = -negamax(applyMove(state, m), depth - 1, -Infinity, Infinity);
    if (score > best) {
      best = score;
      pick = [m];
    } else if (score === best) pick.push(m);
  }
  return pick[(Math.random() * pick.length) | 0];
}
