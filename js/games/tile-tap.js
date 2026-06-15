/* ============================================================
   Tile Tap
   Tiles fall down four lanes. Tap the dark tiles in order (lowest
   first). Tap the wrong one — or let one slip off the bottom — and
   it's over. Speeds up as you go.
   Difficulty: EASY / MEDIUM / HARD set the starting speed.
   Tracks: high score (tiles tapped)
   ============================================================ */

const LANES = 4;
const VIS = 4; // visible rows

const STYLE = `
.tap-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:10px; }
.tap-hint { font-size:15px; font-weight:700; color:var(--text-dim); min-height:20px; }
.tap-board { position:relative; overflow:hidden; width:min(94vw,400px); height:min(70vh,560px);
  background:#101116; border-radius:16px; box-shadow:var(--shadow); touch-action:manipulation; }
.tap-line { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,.05); }
.tap-tile { position:absolute; border-radius:9px; background:linear-gradient(180deg,#2c3550,#1c2336);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); will-change:transform; }
.tap-tile.hit { background:linear-gradient(180deg,#26e0b8,#13a98b); box-shadow:0 0 14px rgba(24,194,156,.6); }
`;

const START = { EASY: 0.8, MEDIUM: 1.15, HARD: 1.6 };

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const start0 = START[api.settings.difficulty] || START.MEDIUM;

  const hint = document.createElement("div");
  hint.className = "tap-hint";
  hint.textContent = "Tap the dark tiles!";
  const board = document.createElement("div");
  board.className = "tap-board";
  for (let i = 1; i < LANES; i++) {
    const line = document.createElement("div");
    line.className = "tap-line";
    line.style.left = (i / LANES) * 100 + "%";
    board.append(line);
  }
  const wrap = document.createElement("div");
  wrap.className = "tap-wrap";
  wrap.append(hint, board);
  api.root.append(wrap);

  let boardW, boardH, colW, tileH;
  let scroll, speed, tiles, nextRow, over, score, rafId, lastT, started;

  api.onRestart(start);
  board.addEventListener("pointerdown", onTap);

  function pills() {
    api.setStats({ left: { label: "Score", value: score }, right: { label: "Best", value: api.refreshStats().highscore } });
  }

  function measure() {
    const r = board.getBoundingClientRect();
    boardW = r.width;
    boardH = r.height;
    colW = boardW / LANES;
    tileH = boardH / VIS;
  }

  function spawn(row) {
    const col = (Math.random() * LANES) | 0;
    const el = document.createElement("div");
    el.className = "tap-tile";
    el.style.width = colW - 8 + "px";
    el.style.height = tileH - 8 + "px";
    el.style.left = col * colW + 4 + "px";
    el.style.top = "0px";
    board.append(el);
    const tile = { row, col, el, hit: false };
    el.__tile = tile;
    tiles.push(tile);
  }

  function fill() {
    while (nextRow <= Math.floor(scroll) + VIS + 1) spawn(nextRow++);
  }

  function lowestUnhit() {
    let best = null;
    for (const t of tiles) if (!t.hit && (best === null || t.row < best.row)) best = t;
    return best;
  }

  function onTap(e) {
    if (over) return;
    const tile = e.target.__tile;
    if (!tile) return; // tapped empty space — ignored (forgiving)
    if (tile.hit) return;
    if (tile !== lowestUnhit()) return gameOver("Wrong tile!");
    tile.hit = true;
    tile.el.classList.add("hit");
    score++;
    speed += 0.05;
    pills();
  }

  function frame(t) {
    if (over) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    scroll += speed * dt;

    for (let i = tiles.length - 1; i >= 0; i--) {
      const tile = tiles[i];
      const rel = scroll - tile.row; // 0=top … VIS-1=bottom slot
      tile.el.style.transform = `translateY(${rel * tileH}px)`;
      if (rel > VIS) {
        if (!tile.hit) return gameOver("Missed one!");
        tile.el.remove();
        tiles.splice(i, 1);
      }
    }
    fill();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    cancel();
    measure();
    scroll = VIS - 2; // first tile starts a row above the bottom, leaving room to react
    speed = start0;
    score = 0;
    over = false;
    tiles = [];
    nextRow = 0;
    board.querySelectorAll(".tap-tile").forEach((n) => n.remove());
    fill();
    pills();
    hint.textContent = "Tap the lowest dark tile";
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function cancel() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function gameOver(reason) {
    over = true;
    cancel();
    const { isRecord } = api.reportHighscore(score);
    pills();
    hint.textContent = reason;
    api.showModal({
      title: isRecord ? "New best!" : "Game Over",
      message: reason,
      statsRows: [
        { label: "Score", value: score },
        { label: "Best", value: api.refreshStats().highscore },
      ],
      onPrimary: start,
    });
  }

  // measure can be 0 if root not laid out yet — defer one frame
  requestAnimationFrame(start);
  return {
    destroy() {
      cancel();
      style.remove();
    },
  };
}
