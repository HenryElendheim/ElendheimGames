/* ============================================================
   Block Blast
   Drag the tray pieces onto the 8x8 grid. Fill a full row or column
   to clear it. When none of your three pieces can fit, it's over.
   Tracks: high score
   ============================================================ */

const N = 8;

const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [0, 1], [1, 1]], // 2x2
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], // 3x3
  [[0, 0], [0, 1], [1, 1]], // L tromino
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [1, 0]],
  [[1, 0], [1, 1], [0, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]], // J
  [[1, 0], [1, 1], [1, 2], [0, 2]], // L
  [[0, 0], [1, 0], [1, 1], [2, 1]], // S
  [[1, 0], [2, 0], [0, 1], [1, 1]], // Z
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
];
const COLORS = ["#f5a623", "#8b5cf6", "#18c29c", "#ef5350", "#4fc3f7", "#ff4081", "#7c4dff", "#6aaa64"];

const dims = (cells) => ({
  w: Math.max(...cells.map((c) => c[0])) + 1,
  h: Math.max(...cells.map((c) => c[1])) + 1,
});

const STYLE = `
.bb-wrap { flex:1; position:relative; display:flex; flex-direction:column; align-items:center; gap:18px; padding:14px; }
.bb-board { display:grid; grid-template-columns:repeat(${N},1fr); width:min(94vw,400px); aspect-ratio:1;
  background:#0e0f14; border-radius:12px; overflow:hidden; box-shadow:var(--shadow); touch-action:none; }
.bb-cell { aspect-ratio:1; box-shadow:inset 0 0 0 1px rgba(255,255,255,.04); background:#181a20; }
.bb-cell.filled { box-shadow:inset 0 0 0 1px rgba(0,0,0,.25); }
.bb-cell.ok { background:rgba(255,255,255,.18) !important; }
.bb-cell.bad { background:rgba(239,83,80,.35) !important; }
.bb-cell.clear { animation:bb-clear .34s ease forwards; z-index:2; }
@keyframes bb-clear { 0%{transform:scale(1);filter:brightness(1);} 40%{transform:scale(1.2);filter:brightness(2.4);} 100%{transform:scale(0);opacity:0;filter:brightness(2.4);} }
.bb-pop { position:absolute; left:50%; top:42%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; z-index:20; animation:bb-pop-rise 1s ease forwards; }
.bb-pop .pts { font-size:36px; font-weight:800; color:var(--accent); text-shadow:0 3px 12px rgba(0,0,0,.7); }
.bb-pop .lbl { font-size:14px; font-weight:800; color:#fff; letter-spacing:.06em; text-shadow:0 2px 6px rgba(0,0,0,.7); }
@keyframes bb-pop-rise { 0%{opacity:0;transform:translate(-50%,-30%) scale(.7);} 18%{opacity:1;transform:translate(-50%,-50%) scale(1.12);} 78%{opacity:1;} 100%{opacity:0;transform:translate(-50%,-120%) scale(1);} }
.bb-tray { display:flex; justify-content:space-around; align-items:center; gap:10px; width:min(94vw,400px); min-height:90px; }
.bb-piece { display:grid; gap:3px; padding:0 20px; min-height:84px; align-content:center; touch-action:none; transition:opacity .15s, transform .1s; }
.bb-piece.used { opacity:0; pointer-events:none; }
.bb-piece.noplace { opacity:.34; filter:grayscale(1) brightness(.7); pointer-events:none; }
.bb-piece:active { transform:scale(1.05); }
.bb-blk { width:18px; height:18px; border-radius:4px; }
.bb-ghost { position:fixed; z-index:80; pointer-events:none; display:grid; gap:3px; opacity:.9; }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let grid, score, tray, over, drag, combo, clearing;

  const boardEl = document.createElement("div");
  boardEl.className = "bb-board";
  const trayEl = document.createElement("div");
  trayEl.className = "bb-tray";
  const wrap = document.createElement("div");
  wrap.className = "bb-wrap";
  wrap.append(boardEl, trayEl);
  api.root.append(wrap);

  const cellEls = Array.from({ length: N * N }, () => {
    const c = document.createElement("div");
    c.className = "bb-cell";
    boardEl.append(c);
    return c;
  });

  api.onRestart(start);

  function pills() {
    api.setStats({ left: { label: "Score", value: score }, right: { label: "Best", value: api.refreshStats().highscore } });
  }

  function render() {
    for (let i = 0; i < cellEls.length; i++) {
      const v = grid[(i / N) | 0][i % N];
      cellEls[i].className = "bb-cell" + (v ? " filled" : "");
      cellEls[i].style.background = v || "";
    }
  }

  function newTray() {
    tray = Array.from({ length: 3 }, () => {
      const cells = SHAPES[(Math.random() * SHAPES.length) | 0];
      return { cells, color: COLORS[(Math.random() * COLORS.length) | 0], used: false };
    });
    renderTray();
  }

  function renderTray() {
    trayEl.replaceChildren(
      ...tray.map((piece, idx) => {
        const d = dims(piece.cells);
        const el = document.createElement("div");
        const placeable = !piece.used && canPlaceAnywhere(piece);
        el.className = "bb-piece" + (piece.used ? " used" : placeable ? "" : " noplace");
        el.style.gridTemplateColumns = `repeat(${d.w}, 18px)`;
        el.style.gridTemplateRows = `repeat(${d.h}, 18px)`;
        const set = new Set(piece.cells.map(([x, y]) => x + "," + y));
        for (let y = 0; y < d.h; y++)
          for (let x = 0; x < d.w; x++) {
            const b = document.createElement("div");
            if (set.has(x + "," + y)) {
              b.className = "bb-blk";
              b.style.background = piece.color;
            }
            el.append(b);
          }
        el.addEventListener("pointerdown", (e) => startDrag(e, idx));
        return el;
      })
    );
  }

  /* ---- drag & drop ---- */
  function cellPx() {
    return boardEl.getBoundingClientRect().width / N;
  }

  function startDrag(e, idx) {
    if (over || clearing || tray[idx].used || !canPlaceAnywhere(tray[idx])) return;
    e.preventDefault();
    const piece = tray[idx];
    const cell = cellPx();
    const d = dims(piece.cells);
    const ghost = document.createElement("div");
    ghost.className = "bb-ghost";
    ghost.style.gridTemplateColumns = `repeat(${d.w}, ${cell}px)`;
    ghost.style.gridTemplateRows = `repeat(${d.h}, ${cell}px)`;
    const set = new Set(piece.cells.map(([x, y]) => x + "," + y));
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const b = document.createElement("div");
        if (set.has(x + "," + y)) {
          b.style.background = piece.color;
          b.style.borderRadius = "5px";
        }
        ghost.append(b);
      }
    document.body.append(ghost);
    drag = { idx, piece, d, cell, ghost };
    moveDrag(e);
    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", endDrag);
  }

  function anchorFor(e) {
    const rect = boardEl.getBoundingClientRect();
    const { d, cell } = drag;
    const lift = cell * 1.4;
    let col = Math.round((e.clientX - rect.left) / cell - d.w / 2);
    let row = Math.round((e.clientY - rect.top - lift) / cell - d.h / 2);
    col = Math.max(0, Math.min(N - d.w, col));
    row = Math.max(0, Math.min(N - d.h, row));
    return { col, row, rect };
  }

  function fits(piece, col, row) {
    return piece.cells.every(([x, y]) => {
      const c = col + x,
        r = row + y;
      return c >= 0 && c < N && r >= 0 && r < N && !grid[r][c];
    });
  }

  function moveDrag(e) {
    if (!drag) return;
    const { ghost, d, cell } = drag;
    const lift = cell * 1.4;
    ghost.style.left = e.clientX - (d.w * cell) / 2 + "px";
    ghost.style.top = e.clientY - lift - (d.h * cell) / 2 + "px";
    clearPreview();
    const { col, row } = anchorFor(e);
    const ok = fits(drag.piece, col, row);
    drag.target = { col, row, ok };
    for (const [x, y] of drag.piece.cells) {
      const c = col + x,
        r = row + y;
      if (c >= 0 && c < N && r >= 0 && r < N) cellEls[r * N + c].classList.add(ok ? "ok" : "bad");
    }
  }

  function clearPreview() {
    cellEls.forEach((c) => c.classList.remove("ok", "bad"));
  }

  function endDrag(e) {
    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    if (!drag) return;
    const { piece, idx, ghost, target } = drag;
    ghost.remove();
    clearPreview();
    drag = null;
    if (target && target.ok) placePiece(piece, idx, target.col, target.row);
  }

  function placePiece(piece, idx, col, row) {
    let placed = 0;
    for (const [x, y] of piece.cells) {
      grid[row + y][col + x] = piece.color;
      placed++;
    }
    tray[idx].used = true;
    score += placed;
    render(); // show the placed piece first

    const { cells: cleared, lines } = findClears();
    if (!cleared.length) {
      combo = 0;
      finishPlacement();
      return;
    }

    // points: 10 per line, +5 per extra simultaneous line, +5 per combo step
    combo++;
    const gained = lines * 10 + (lines > 1 ? lines * 5 : 0) + (combo > 1 ? combo * 5 : 0);
    score += gained;
    pills();
    showClearPopup(gained, lines, combo);

    clearing = true;
    cleared.forEach((i, k) => {
      cellEls[i].style.animationDelay = (k % N) * 18 + "ms";
      cellEls[i].classList.add("clear");
    });
    setTimeout(() => {
      cleared.forEach((i) => (grid[(i / N) | 0][i % N] = ""));
      render();
      clearing = false;
      finishPlacement();
    }, 340);
  }

  function finishPlacement() {
    if (tray.every((p) => p.used)) newTray();
    else renderTray();
    pills();
    if (!anyMove()) gameOver();
  }

  function findClears() {
    const fullRows = [],
      fullCols = [];
    for (let r = 0; r < N; r++) if (grid[r].every(Boolean)) fullRows.push(r);
    for (let c = 0; c < N; c++) if (grid.every((row) => row[c])) fullCols.push(c);
    const set = new Set();
    fullRows.forEach((r) => { for (let c = 0; c < N; c++) set.add(r * N + c); });
    fullCols.forEach((c) => { for (let r = 0; r < N; r++) set.add(r * N + c); });
    return { cells: [...set], lines: fullRows.length + fullCols.length };
  }

  function showClearPopup(points, lines, comboCount) {
    const pop = document.createElement("div");
    pop.className = "bb-pop";
    const label = comboCount > 1 ? `COMBO x${comboCount}` : `${lines} LINE${lines > 1 ? "S" : ""}`;
    pop.innerHTML = `<div class="pts">+${points}</div><div class="lbl">${label}</div>`;
    wrap.append(pop);
    setTimeout(() => pop.remove(), 1000);
  }

  function canPlaceAnywhere(piece) {
    const d = dims(piece.cells);
    for (let r = 0; r <= N - d.h; r++)
      for (let c = 0; c <= N - d.w; c++) if (fits(piece, c, r)) return true;
    return false;
  }

  function anyMove() {
    return tray.some((p) => !p.used && canPlaceAnywhere(p));
  }

  function start() {
    grid = Array.from({ length: N }, () => Array(N).fill(""));
    score = 0;
    over = false;
    combo = 0;
    clearing = false;
    if (drag) { drag.ghost.remove(); drag = null; }
    render();
    newTray();
    pills();
  }

  function gameOver() {
    over = true;
    const { isRecord } = api.reportHighscore(score);
    pills();
    api.showModal({
      title: isRecord ? "New high score!" : "No moves left",
      statsRows: [
        { label: "Score", value: score },
        { label: "Best", value: api.refreshStats().highscore },
      ],
      onPrimary: start,
    });
  }

  start();
  return {
    destroy() {
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", endDrag);
      if (drag) drag.ghost.remove();
      style.remove();
    },
  };
}
