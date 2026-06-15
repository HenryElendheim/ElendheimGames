/* ============================================================
   Connect 4
   Modes:      cpu (you = red, first) | local (pass-and-play)
   Difficulty: EASY win/block + random · MEDIUM minimax d4 · HARD minimax d6
   Tracks:     wins + streak (vs computer)
   ============================================================ */

const ROWS = 6;
const COLS = 7;

const STYLE = `
.c4-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; padding:18px; }
.c4-status { font-size:18px; font-weight:700; color:var(--text-dim); min-height:24px; }
.c4-board { display:grid; grid-template-columns:repeat(${COLS},1fr); gap:2.2vw; max-gap:12px;
  width:min(92vw,420px); padding:3vw; background:#2b3550; border-radius:18px; box-shadow:var(--shadow); }
.c4-cell { aspect-ratio:1; border-radius:50%; background:#15161a; transition:transform .08s;
  border:none; padding:0; }
.c4-cell:active { transform:scale(.94); }
.c4-cell.r { background:radial-gradient(circle at 35% 30%, #ff7b6b, #e23b2e); }
.c4-cell.y { background:radial-gradient(circle at 35% 30%, #ffd66b, #f5a623); }
.c4-cell.win { box-shadow:0 0 0 3px #fff, 0 0 12px #fff; }
.c4-board.locked .c4-cell { pointer-events:none; }
@keyframes c4-pop { from { transform:translateY(-60px); opacity:.4; } to { transform:none; opacity:1; } }
.c4-cell.drop { animation:c4-pop .18s ease; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const isCpu = api.settings.mode !== "local";
  const diff = api.settings.difficulty || "MEDIUM";
  const HUMAN = "R";
  const YELLOW = "Y";
  const session = { R: 0, Y: 0 };

  let grid, current, over;

  const status = document.createElement("div");
  status.className = "c4-status";
  const boardEl = document.createElement("div");
  boardEl.className = "c4-board";
  const wrap = document.createElement("div");
  wrap.className = "c4-wrap";
  wrap.append(status, boardEl);
  api.root.append(wrap);

  const cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    cellEls[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("button");
      cell.className = "c4-cell";
      cell.addEventListener("click", () => drop(c));
      boardEl.append(cell);
      cellEls[r][c] = cell;
    }
  }

  api.onRestart(reset);

  function pills() {
    if (isCpu) {
      const s = api.refreshStats();
      api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
    } else {
      api.setStats({ left: { label: "Red Wins", value: session.R }, right: { label: "Yellow Wins", value: session.Y } });
    }
  }

  function setStatus() {
    if (over) return;
    if (isCpu) status.textContent = current === HUMAN ? "Your move — tap a column" : "Computer thinking…";
    else status.textContent = current === "R" ? "Red's turn" : "Yellow's turn";
  }

  function render() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        cellEls[r][c].className = "c4-cell" + (v === "R" ? " r" : v === "Y" ? " y" : "");
      }
  }

  function reset() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    current = HUMAN;
    over = false;
    boardEl.classList.remove("locked");
    render();
    pills();
    setStatus();
  }

  function landingRow(g, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (!g[r][c]) return r;
    return -1;
  }

  function drop(c) {
    if (over) return;
    if (isCpu && current === YELLOW) return;
    const r = landingRow(grid, c);
    if (r < 0) return;
    place(r, c, current);
  }

  function place(r, c, who) {
    grid[r][c] = who;
    render();
    cellEls[r][c].classList.add("drop");
    const win = winningLine(grid, r, c, who);
    if (win) return finish(who, win);
    if (grid[0].every(Boolean)) return finish(null, null);
    current = current === "R" ? "Y" : "R";
    setStatus();
    if (isCpu && current === YELLOW) {
      boardEl.classList.add("locked");
      setTimeout(() => {
        boardEl.classList.remove("locked");
        const col = chooseMove(grid, diff);
        place(landingRow(grid, col), col, YELLOW);
      }, 360);
    }
  }

  function finish(winner, line) {
    over = true;
    boardEl.classList.add("locked");
    if (line) line.forEach(([r, c]) => cellEls[r][c].classList.add("win"));

    let title;
    if (winner) {
      if (isCpu) {
        if (winner === HUMAN) {
          api.reportWin();
          title = "You win!";
        } else {
          api.reportLoss();
          title = "Computer wins";
        }
      } else {
        session[winner]++;
        title = (winner === "R" ? "Red" : "Yellow") + " wins!";
      }
    } else {
      title = "It's a draw";
    }
    pills();
    status.textContent = title;

    api.showModal({
      title,
      statsRows: isCpu
        ? [
            { label: "Streak", value: api.stats.streak },
            { label: "Wins", value: api.stats.wins },
          ]
        : [
            { label: "Red", value: session.R },
            { label: "Yellow", value: session.Y },
          ],
      onPrimary: reset,
    });
  }

  reset();
  return { destroy: () => style.remove() };
}

/* ---------- rules ---------- */
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function winningLine(g, r, c, who) {
  for (const [dr, dc] of DIRS) {
    const line = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign,
        cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && g[rr][cc] === who) {
        line.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}

function validCols(g) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (!g[0][c]) out.push(c);
  return out;
}

function dropSim(g, c, who) {
  const ng = g.map((row) => row.slice());
  for (let r = ROWS - 1; r >= 0; r--)
    if (!ng[r][c]) {
      ng[r][c] = who;
      return { ng, r };
    }
  return null;
}

/* ---------- computer opponent ---------- */
function chooseMove(g, difficulty) {
  const cols = validCols(g);
  const YELLOW = "Y",
    RED = "R";

  // always grab an immediate win, always block an immediate loss
  for (const c of cols) {
    const s = dropSim(g, c, YELLOW);
    if (winningLine(s.ng, s.r, c, YELLOW)) return c;
  }
  for (const c of cols) {
    const s = dropSim(g, c, RED);
    if (winningLine(s.ng, s.r, c, RED)) return c;
  }
  if (difficulty === "EASY") return cols[(Math.random() * cols.length) | 0];

  const depth = difficulty === "HARD" ? 6 : 4;
  let best = -Infinity,
    move = cols[(Math.random() * cols.length) | 0];
  for (const c of orderCols(cols)) {
    const s = dropSim(g, c, YELLOW);
    const score = minimax(s.ng, depth - 1, -Infinity, Infinity, false);
    if (score > best) {
      best = score;
      move = c;
    }
  }
  return move;
}

function orderCols(cols) {
  // search centre-out for better pruning
  return cols.slice().sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
}

function minimax(g, depth, alpha, beta, maximizing) {
  const YELLOW = "Y",
    RED = "R";
  const cols = validCols(g);
  if (cols.length === 0) return 0;

  const who = maximizing ? YELLOW : RED;
  // terminal check: did the previous structure already win? evaluate via scan
  const term = anyWin(g);
  if (term === YELLOW) return 100000 + depth;
  if (term === RED) return -100000 - depth;
  if (depth === 0) return evaluate(g);

  if (maximizing) {
    let val = -Infinity;
    for (const c of orderCols(cols)) {
      const s = dropSim(g, c, who);
      val = Math.max(val, minimax(s.ng, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return val;
  } else {
    let val = Infinity;
    for (const c of orderCols(cols)) {
      const s = dropSim(g, c, who);
      val = Math.min(val, minimax(s.ng, depth - 1, alpha, beta, true));
      beta = Math.min(beta, val);
      if (alpha >= beta) break;
    }
    return val;
  }
}

function anyWin(g) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      if (v && winningLine(g, r, c, v)) return v;
    }
  return null;
}

function evaluate(g) {
  const YELLOW = "Y",
    RED = "R";
  let score = 0;
  // centre preference
  for (let r = 0; r < ROWS; r++) if (g[r][3] === YELLOW) score += 3;

  const windows = [];
  // collect all length-4 windows
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const w = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k,
            cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) {
            w.length = 0;
            break;
          }
          w.push(g[rr][cc]);
        }
        if (w.length === 4) windows.push(w);
      }

  for (const w of windows) {
    const me = w.filter((x) => x === YELLOW).length;
    const op = w.filter((x) => x === RED).length;
    const empty = w.filter((x) => !x).length;
    if (me && op) continue;
    if (me === 3 && empty === 1) score += 8;
    else if (me === 2 && empty === 2) score += 3;
    if (op === 3 && empty === 1) score -= 11;
    else if (op === 2 && empty === 2) score -= 3;
  }
  return score;
}
