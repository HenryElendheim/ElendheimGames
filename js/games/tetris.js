/* ============================================================
   Blockfall — falling-block puzzle
   Controls: footer buttons (◀ ⟳ ▶ ⤓) plus tap-to-rotate and
   swipe left/right/down on the board.
   Tracks: high score
   ============================================================ */

const COLS = 10;
const ROWS = 20;

const PIECES = {
  I: { color: "#4dd0e1", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  O: { color: "#ffd54f", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { color: "#ba68c8", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  S: { color: "#81c784", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { color: "#e57373", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: "#64b5f6", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { color: "#ffb74d", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
const KEYS = Object.keys(PIECES);

const STYLE = `
.tt-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:12px; padding:8px 12px; }
.tt-board { display:grid; grid-template-columns:repeat(${COLS},1fr); gap:2px;
  width:min(78vw,300px); aspect-ratio:${COLS}/${ROWS}; background:#0d0e12; padding:4px;
  border-radius:12px; box-shadow:var(--shadow); touch-action:none; }
.tt-c { border-radius:3px; background:#16171c; }
.tt-c.f { box-shadow:inset 0 0 0 1px rgba(255,255,255,.12); }
`;

const SPEED = (level) => Math.max(110, 800 - level * 70);

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let board, piece, px, py, score, lines, level, over, dropId, dropping;

  const boardEl = document.createElement("div");
  boardEl.className = "tt-board";
  const wrap = document.createElement("div");
  wrap.className = "tt-wrap";
  wrap.append(boardEl);
  api.root.append(wrap);

  const cells = Array.from({ length: ROWS * COLS }, () => {
    const d = document.createElement("div");
    d.className = "tt-c";
    boardEl.append(d);
    return d;
  });

  api.onRestart(start);
  api.setFooter([
    { icon: "◀", label: "Left", onClick: () => move(-1) },
    { icon: "⟳", label: "Rotate", onClick: rotate, accent: true },
    { icon: "▶", label: "Right", onClick: () => move(1) },
    { icon: "⤓", label: "Drop", onClick: fastDrop },
  ]);

  // keyboard: A/D or arrows = move, W/R/Up = rotate, S/Down = soft step,
  // Space = fast drop (piece keeps falling fast but can still be moved)
  const onKey = (e) => {
    if (over) return;
    const k = e.key.toLowerCase();
    if (k === "a" || e.key === "ArrowLeft") move(-1);
    else if (k === "d" || e.key === "ArrowRight") move(1);
    else if (k === "w" || k === "r" || e.key === "ArrowUp") rotate();
    else if (k === "s" || e.key === "ArrowDown") softStep();
    else if (e.key === " " || e.code === "Space") fastDrop();
    else return;
    e.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  // swipe / tap on the board
  let sx = 0, sy = 0, moved = false;
  boardEl.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; moved = false; });
  boardEl.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) { rotate(); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 24) fastDrop();
  });

  function pills() {
    const best = api.refreshStats().highscore;
    api.setStats({ left: { label: "Score", value: score }, right: { label: "Best", value: best } });
  }

  function shape(p, ox = 0, oy = 0) {
    return p.cells.map(([x, y]) => [x + ox, y + oy]);
  }

  function collides(cells) {
    return cells.some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]));
  }

  function spawn() {
    const key = KEYS[(Math.random() * KEYS.length) | 0];
    piece = { color: PIECES[key].color, cells: PIECES[key].cells.map((c) => c.slice()) };
    px = 3;
    py = -1;
    if (collides(shape(piece, px, py))) return gameOver();
    draw();
  }

  function lock() {
    for (const [x, y] of shape(piece, px, py)) if (y >= 0) board[y][x] = piece.color;
    dropping = false; // fast-drop only lasts for the current piece
    clearLines();
    spawn();
    restartGravity();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(""));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += [0, 40, 100, 300, 1200][cleared] * (level + 1);
      lines += cleared;
      level = Math.floor(lines / 10);
      pills();
      restartGravity();
    }
  }

  function step() {
    if (over) return;
    if (!collides(shape(piece, px, py + 1))) py++;
    else lock();
    draw();
  }

  function move(dir) {
    if (over) return;
    if (!collides(shape(piece, px + dir, py))) px += dir;
    draw();
  }

  function rotate() {
    if (over) return;
    // rotate cells clockwise around bounding box
    const xs = piece.cells.map((c) => c[0]),
      ys = piece.cells.map((c) => c[1]);
    const maxY = Math.max(...ys);
    const rotated = piece.cells.map(([x, y]) => [maxY - y, x]);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(rotated.map(([x, y]) => [x + px + kick, y + py]))) {
        piece.cells = rotated;
        px += kick;
        draw();
        return;
      }
    }
  }

  function softStep() {
    if (over) return;
    if (!collides(shape(piece, px, py + 1))) {
      py++;
      draw();
    }
  }

  function fastDrop() {
    if (over) return;
    dropping = true; // accelerate gravity but keep the piece movable
    restartGravity();
  }

  function draw() {
    for (let i = 0; i < cells.length; i++) {
      const y = (i / COLS) | 0,
        x = i % COLS;
      const c = board[y][x];
      cells[i].style.background = c || "";
      cells[i].className = "tt-c" + (c ? " f" : "");
    }
    if (piece)
      for (const [x, y] of shape(piece, px, py))
        if (y >= 0) {
          const cell = cells[y * COLS + x];
          cell.style.background = piece.color;
          cell.className = "tt-c f";
        }
  }

  function restartGravity() {
    if (dropId) clearInterval(dropId);
    if (over) return;
    dropId = setInterval(step, dropping ? 45 : SPEED(level));
  }

  function start() {
    if (dropId) clearInterval(dropId);
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    score = 0;
    lines = 0;
    level = 0;
    over = false;
    dropping = false;
    pills();
    spawn();
    restartGravity();
  }

  function gameOver() {
    over = true;
    if (dropId) clearInterval(dropId);
    const { isRecord } = api.reportHighscore(score);
    pills();
    api.showModal({
      title: isRecord ? "New high score!" : "Game Over",
      statsRows: [
        { label: "Score", value: score },
        { label: "Lines", value: lines },
        { label: "Best", value: api.refreshStats().highscore },
      ],
      onPrimary: start,
    });
  }

  start();
  return {
    destroy() {
      if (dropId) clearInterval(dropId);
      window.removeEventListener("keydown", onKey);
      style.remove();
    },
  };
}
