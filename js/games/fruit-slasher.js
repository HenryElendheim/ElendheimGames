/* ============================================================
   Fruit Slasher
   Swipe to slice the fruit. Miss three and you're out. Slice a bomb
   and it's game over instantly. Slicing several in one swipe = combo.
   Tracks: high score (3 lives).
   ============================================================ */

const FRUITS = [
  { body: "#e23b2e", shine: "#ff8174" },
  { body: "#f5a623", shine: "#ffce7a" },
  { body: "#f1c40f", shine: "#fce98a" },
  { body: "#2ecc71", shine: "#8ef0b6" },
  { body: "#9b59b6", shine: "#d2a8e6" },
  { body: "#e84393", shine: "#ffa6cf" },
  { body: "#1abc9c", shine: "#7ff0db" },
  { body: "#3498db", shine: "#9fd4f5" },
];
const GRAVITY = 1300;

const STYLE = `
.fs-wrap { flex:1; position:relative; overflow:hidden; }
.fs-canvas { display:block; width:100%; height:100%; touch-action:none; cursor:crosshair; }
.fs-lives { position:absolute; top:12px; right:14px; display:flex; gap:7px; pointer-events:none; }
.fs-life { width:18px; height:18px; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,.5); }
.fs-life.full { background:radial-gradient(circle at 35% 30%, #ff8a80, #e23b2e); }
.fs-life.empty { background:rgba(255,255,255,.14); box-shadow:inset 0 0 0 2px rgba(255,255,255,.25); }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const wrap = document.createElement("div");
  wrap.className = "fs-wrap";
  const canvas = document.createElement("canvas");
  canvas.className = "fs-canvas";
  const livesEl = document.createElement("div");
  livesEl.className = "fs-lives";
  wrap.append(canvas, livesEl);
  api.root.append(wrap);
  const ctx = canvas.getContext("2d");

  let W, H, dpr;
  let fruits, particles, blade, score, lives, combo, over, running;
  let spawnTimer, lastT, rafId;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = wrap.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  api.onRestart(start);

  function pills() {
    api.setStats({ left: { label: "Score", value: score }, right: { label: "Best", value: api.refreshStats().highscore } });
  }
  function drawLives() {
    livesEl.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement("div");
      pip.className = "fs-life " + (i < lives ? "full" : "empty");
      livesEl.append(pip);
    }
  }

  function spawn() {
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const isBomb = Math.random() < 0.16;
      const x = 40 + Math.random() * (W - 80);
      fruits.push({
        x,
        y: H + 40,
        vx: (Math.random() - 0.5) * 280,
        vy: -(Math.sqrt(2 * GRAVITY * (H * (0.55 + Math.random() * 0.4)))),
        r: 26,
        color: isBomb ? null : FRUITS[(Math.random() * FRUITS.length) | 0],
        bomb: isBomb,
        sliced: false,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 4,
      });
    }
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  let slicing = false;
  function down(e) {
    if (over) return;
    slicing = true;
    combo = 0;
    blade = [pointFromEvent(e)];
  }
  function move(e) {
    if (!slicing || over) return;
    const p = pointFromEvent(e);
    const prev = blade[blade.length - 1];
    blade.push(p);
    if (blade.length > 12) blade.shift();
    if (prev) checkSlice(prev, p);
  }
  function up() {
    slicing = false;
    if (combo >= 3) {
      score += combo; // combo bonus
      popup(W / 2, H * 0.3, `COMBO x${combo}! +${combo}`, "#f5a623");
      pills();
    }
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  function checkSlice(a, b) {
    for (const f of fruits) {
      if (f.sliced) continue;
      if (segCircle(a, b, f) < f.r + 6) slice(f);
    }
  }

  function slice(f) {
    f.sliced = true;
    if (f.bomb) {
      popup(f.x, f.y, "BOOM", "#ef5350");
      loseLife(true);
      return;
    }
    score++;
    combo++;
    pills();
    popup(f.x, f.y, "+1", "#fff");
    // the whole fruit is replaced by two halves flying apart, so you
    // can clearly see which fruit you cut
    for (const dir of [-1, 1])
      particles.push({
        x: f.x,
        y: f.y,
        vx: dir * 220 + f.vx * 0.3,
        vy: f.vy * 0.5 - 70,
        color: f.color,
        half: dir,
        rot: f.rot,
        spin: dir * 7,
        life: 1,
      });
  }

  function popup(x, y, text, color) {
    particles.push({ x, y, vx: 0, vy: -40, text, color, life: 1, isText: true });
  }

  function update(dt) {
    if (running && (spawnTimer -= dt) <= 0) {
      spawn();
      spawnTimer = 0.8 + Math.random() * 0.7;
    }
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      // a sliced fruit/bomb is removed at once — replaced by its halves
      // (fruit) or its boom (bomb); this also means a bomb is only ever
      // hit a single time
      if (f.sliced) {
        fruits.splice(i, 1);
        continue;
      }
      f.vy += GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.y - f.r > H + 60) {
        fruits.splice(i, 1);
        if (!f.bomb && running) loseLife();
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot != null) p.rot += (p.spin || 0) * dt;
      p.life -= dt * (p.isText ? 0.9 : 0.6);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // blade trail
    if (blade && blade.length > 1) {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      for (let i = 1; i < blade.length; i++) {
        ctx.lineWidth = (i / blade.length) * 10;
        ctx.beginPath();
        ctx.moveTo(blade[i - 1].x, blade[i - 1].y);
        ctx.lineTo(blade[i].x, blade[i].y);
        ctx.stroke();
      }
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      if (f.bomb) drawBomb(ctx, f.r);
      else drawFruit(ctx, f.r, f.color);
      ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.isText) {
        ctx.fillStyle = p.color || "#fff";
        ctx.font = "bold 22px system-ui, sans-serif";
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        drawHalf(ctx, 22, p.color, p.half);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  function loop(t) {
    const dt = Math.min(0.04, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  function loseLife(byBomb = false) {
    lives--;
    drawLives();
    if (lives <= 0) gameOver(byBomb);
  }

  function start() {
    resize();
    fruits = [];
    particles = [];
    blade = [];
    score = 0;
    lives = 3;
    combo = 0;
    over = false;
    running = true;
    spawnTimer = 0.4;
    drawLives();
    pills();
    lastT = performance.now();
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function gameOver(bomb) {
    if (over) return;
    over = true;
    running = false;
    const { isRecord } = api.reportHighscore(score);
    pills();
    api.showModal({
      title: bomb ? "Boom! Game Over" : isRecord ? "New best!" : "Game Over",
      message: bomb ? "You sliced a bomb!" : "You ran out of lives.",
      statsRows: [
        { label: "Score", value: score },
        { label: "Best", value: api.refreshStats().highscore },
      ],
      onPrimary: start,
    });
  }

  requestAnimationFrame(start);
  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("pointerup", up);
      style.remove();
    },
  };
}

/* distance from circle centre to segment a-b */
function segCircle(a, b, c) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx,
    py = a.y + t * dy;
  return Math.hypot(c.x - px, c.y - py);
}

/* ---- drawn art (no emoji) ---- */
function drawFruit(ctx, r, color) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
  g.addColorStop(0, color.shine);
  g.addColorStop(1, color.body);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5fae3a";
  ctx.beginPath();
  ctx.ellipse(r * 0.25, -r, r * 0.35, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBomb(ctx, r) {
  // outer red glow ring so a bomb is unmistakable
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,45,45,.35)";
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  // black body
  ctx.fillStyle = "#1c1c22";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // bright red outline
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ff2d2d";
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9a6a3c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.4, r * 0.7, -r * 1.05);
  ctx.stroke();
  ctx.fillStyle = "#ffb400";
  ctx.beginPath();
  ctx.arc(r * 0.7, -r * 1.05, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHalf(ctx, r, color, dir) {
  if (!color) return;
  ctx.fillStyle = color.body;
  ctx.beginPath();
  const start = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  ctx.arc(0, 0, r, start, start + Math.PI);
  ctx.closePath();
  ctx.fill();
}
