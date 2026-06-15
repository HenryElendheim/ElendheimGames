/* ============================================================
   Tic-Tac-Toe
   Modes:      cpu (you = X, first) | local (pass-and-play)
   Difficulty: EASY random · MEDIUM win/block heuristic · HARD minimax
   Tracks:     wins + streak (vs computer)
   ============================================================ */

const STYLE = `
.ttt-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; padding:24px; }
.ttt-status { font-size:18px; font-weight:700; color:var(--text-dim); min-height:24px; text-align:center; }
.ttt-board { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:10px; width:min(84vw,360px); aspect-ratio:1; }
.ttt-cell { background:var(--surface); border-radius:18px; display:grid; place-items:center;
  font-size:clamp(34px,14vw,72px); font-weight:800; transition:background .12s, box-shadow .12s; }
@media (hover:hover) { .ttt-cell:active { transform:scale(.95); } }
.ttt-cell.x { color:var(--blue); }
.ttt-cell.o { color:var(--accent); }
.ttt-cell.win { box-shadow:inset 0 0 0 3px currentColor; background:var(--surface-2); }
.ttt-board.locked .ttt-cell { pointer-events:none; }
`;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const isCpu = api.settings.mode !== "local";
  const diff = api.settings.difficulty || "MEDIUM";

  // session scores for local pass-and-play
  const session = { X: 0, O: 0 };

  let board, current, gameOver;

  const status = document.createElement("div");
  status.className = "ttt-status";
  const boardEl = document.createElement("div");
  boardEl.className = "ttt-board";
  const wrap = document.createElement("div");
  wrap.className = "ttt-wrap";
  wrap.append(status, boardEl);
  api.root.append(wrap);

  const cells = Array.from({ length: 9 }, (_, i) => {
    const c = document.createElement("button");
    c.className = "ttt-cell";
    c.addEventListener("click", () => play(i));
    boardEl.append(c);
    return c;
  });

  api.onRestart(reset);

  function updatePills() {
    if (isCpu) {
      const s = api.refreshStats();
      api.setStats({
        left: { label: "Streak", value: s.streak },
        right: { label: "Wins", value: s.wins },
      });
    } else {
      api.setStats({
        left: { label: "X Wins", value: session.X },
        right: { label: "O Wins", value: session.O },
      });
    }
  }

  function setStatus() {
    if (gameOver) return;
    if (isCpu) status.textContent = current === "X" ? "Your move" : "Computer thinking…";
    else status.textContent = `Player ${current}'s turn`;
  }

  function render() {
    board.forEach((v, i) => {
      cells[i].textContent = v || "";
      cells[i].className = "ttt-cell" + (v ? " " + v.toLowerCase() : "");
    });
  }

  function reset() {
    board = Array(9).fill("");
    current = "X";
    gameOver = false;
    boardEl.classList.remove("locked");
    render();
    updatePills();
    setStatus();
  }

  function play(i) {
    if (gameOver || board[i]) return;
    if (isCpu && current === "O") return; // not your turn
    move(i);
  }

  function move(i) {
    board[i] = current;
    render();
    const result = evaluate(board);
    if (result) return finish(result);
    current = current === "X" ? "O" : "X";
    setStatus();
    if (isCpu && current === "O") {
      boardEl.classList.add("locked");
      setTimeout(() => {
        boardEl.classList.remove("locked");
        move(chooseMove(board, "O", diff));
      }, 380);
    }
  }

  function finish(result) {
    gameOver = true;
    boardEl.classList.add("locked");
    if (result.line) result.line.forEach((i) => cells[i].classList.add("win"));

    let title, message;
    if (result.winner) {
      if (isCpu) {
        if (result.winner === "X") {
          api.reportWin();
          title = "You win!";
        } else {
          api.reportLoss();
          title = "Computer wins";
        }
        message = null;
      } else {
        session[result.winner]++;
        title = `Player ${result.winner} wins!`;
      }
    } else {
      title = "It's a draw";
      message = "Nobody takes this one.";
    }
    updatePills();
    setStatus();

    api.showModal({
      title,
      message,
      statsRows: isCpu
        ? [
            { label: "Streak", value: api.stats.streak },
            { label: "Wins", value: api.stats.wins },
          ]
        : [
            { label: "X Wins", value: session.X },
            { label: "O Wins", value: session.O },
          ],
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  reset();

  return {
    destroy() {
      style.remove();
    },
  };
}

/* ---------- rules ---------- */
function evaluate(b) {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a], line };
  }
  return b.every(Boolean) ? { winner: null, line: null } : null;
}

/* ---------- computer opponent ---------- */
function emptyCells(b) {
  return b.map((v, i) => (v ? null : i)).filter((i) => i != null);
}

function chooseMove(b, me, difficulty) {
  const open = emptyCells(b);
  if (difficulty === "EASY") return open[(Math.random() * open.length) | 0];

  if (difficulty === "MEDIUM") {
    const opp = me === "X" ? "O" : "X";
    // take a winning move, else block, else center/corner/random
    return (
      findWinning(b, me) ??
      findWinning(b, opp) ??
      (b[4] === "" ? 4 : pickCornerOrRandom(b, open))
    );
  }

  // HARD — unbeatable minimax
  let best = -Infinity,
    move = open[0];
  for (const i of open) {
    b[i] = me;
    const score = minimax(b, false, me, me === "X" ? "O" : "X");
    b[i] = "";
    if (score > best) {
      best = score;
      move = i;
    }
  }
  return move;
}

function findWinning(b, who) {
  for (const i of emptyCells(b)) {
    b[i] = who;
    const win = evaluate(b)?.winner === who;
    b[i] = "";
    if (win) return i;
  }
  return null;
}

function pickCornerOrRandom(b, open) {
  const corners = [0, 2, 6, 8].filter((i) => b[i] === "");
  const pool = corners.length ? corners : open;
  return pool[(Math.random() * pool.length) | 0];
}

function minimax(b, maximizing, me, opp) {
  const res = evaluate(b);
  if (res) {
    if (res.winner === me) return 10;
    if (res.winner === opp) return -10;
    return 0;
  }
  const turn = maximizing ? me : opp;
  let best = maximizing ? -Infinity : Infinity;
  for (const i of emptyCells(b)) {
    b[i] = turn;
    const score = minimax(b, !maximizing, me, opp);
    b[i] = "";
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}
