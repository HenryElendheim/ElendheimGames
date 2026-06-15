/* ============================================================
   Whack-a-Mole
   30-second round. Moles pop up; tap to bop. Bombs cost you points.
   Difficulty: EASY slow · MEDIUM · HARD fast + more bombs
   Tracks: high score
   ============================================================ */

const HOLES = 9; // 3x3

const STYLE = `
.wm-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:16px; padding:18px; }
.wm-timebar { width:min(86vw,360px); height:10px; border-radius:6px; background:var(--surface); overflow:hidden; }
.wm-timebar > i { display:block; height:100%; background:var(--accent); width:100%; transition:width .25s linear; }
.wm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3.5vw; width:min(86vw,360px); }
.wm-hole { aspect-ratio:1; border-radius:50%; background:#0f1014; position:relative; overflow:hidden;
  box-shadow:inset 0 8px 18px rgba(0,0,0,.6); border:none; }
.wm-mole { position:absolute; inset:16% 16% -4%; border-radius:48% 48% 42% 42%;
  transform:translateY(112%); transition:transform .12s ease; }
.wm-hole.up .wm-mole { transform:translateY(0); }
.wm-hole.bonk .wm-mole { transform:translateY(10%) scale(.85); filter:brightness(1.5); }
.wm-mole.mole { background:radial-gradient(circle at 50% 30%, #b5824e, #6f4a28); }
.wm-mole.bomb { background:radial-gradient(circle at 38% 30%, #4a4a55, #14141a); }
.wm-mole i { position:absolute; display:block; }
.wm-eye { top:32%; width:15%; height:15%; border-radius:50%; background:#16100a; }
.wm-eye.l { left:26%; } .wm-eye.r { right:26%; }
.wm-snout { left:50%; top:50%; transform:translateX(-50%); width:38%; height:30%; border-radius:50%; background:#d8b189; }
.wm-nose { left:50%; top:52%; transform:translateX(-50%); width:15%; height:12%; border-radius:50%; background:#3a2416; z-index:2; }
.wm-shine { left:30%; top:22%; width:20%; height:16%; border-radius:50%; background:rgba(255,255,255,.28); }
.wm-fuse { left:48%; top:-12%; width:7%; height:24%; background:#9a6a3c; border-radius:3px; transform:rotate(14deg); }
.wm-spark { left:58%; top:-18%; width:13%; height:13%; border-radius:50%; background:#ffb400; box-shadow:0 0 9px #ffb400; }
.wm-msg { font-size:18px; font-weight:700; color:var(--text-dim); min-height:22px; }
`;

const DIFF = {
  EASY: { up: 1100, gap: 700, bombs: 0.08, dur: 30 },
  MEDIUM: { up: 850, gap: 500, bombs: 0.16, dur: 30 },
  HARD: { up: 620, gap: 330, bombs: 0.24, dur: 30 },
};

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const cfg = DIFF[api.settings.difficulty] || DIFF.MEDIUM;
  let score, timeLeft, running, holes, timers, tickId;

  const msg = document.createElement("div");
  msg.className = "wm-msg";
  const bar = document.createElement("div");
  bar.className = "wm-timebar";
  const barFill = document.createElement("i");
  bar.append(barFill);
  const grid = document.createElement("div");
  grid.className = "wm-grid";
  const wrap = document.createElement("div");
  wrap.className = "wm-wrap";
  wrap.append(msg, bar, grid);
  api.root.append(wrap);

  holes = Array.from({ length: HOLES }, () => {
    const hole = document.createElement("button");
    hole.className = "wm-hole";
    const mole = document.createElement("div");
    mole.className = "wm-mole";
    hole.append(mole);
    hole.state = { up: false, kind: null, mole };
    hole.addEventListener("click", () => whack(hole));
    grid.append(hole);
    return hole;
  });

  api.onRestart(start);

  function pills() {
    const best = api.refreshStats().highscore;
    api.setStats({ left: { label: "Score", value: score }, right: { label: "Best", value: best } });
  }

  function dressMole(mole, isBomb) {
    mole.className = "wm-mole " + (isBomb ? "bomb" : "mole");
    const parts = isBomb
      ? ["wm-fuse", "wm-spark", "wm-shine"]
      : ["wm-snout", "wm-eye l", "wm-eye r", "wm-nose", "wm-shine"];
    mole.replaceChildren(
      ...parts.map((cls) => {
        const i = document.createElement("i");
        i.className = cls;
        return i;
      })
    );
  }

  function popLoop() {
    if (!running) return;
    const free = holes.filter((h) => !h.state.up);
    if (free.length) {
      const h = free[(Math.random() * free.length) | 0];
      const isBomb = Math.random() < cfg.bombs;
      h.state.up = true;
      h.state.kind = isBomb ? "bomb" : "mole";
      dressMole(h.state.mole, isBomb);
      h.classList.add("up");
      const t = setTimeout(() => hide(h), cfg.up);
      timers.add(t);
    }
    const t2 = setTimeout(popLoop, cfg.gap * (0.6 + Math.random() * 0.8));
    timers.add(t2);
  }

  function hide(h) {
    h.state.up = false;
    h.state.kind = null;
    h.classList.remove("up", "bonk");
  }

  function whack(h) {
    if (!running || !h.state.up) return;
    if (h.state.kind === "bomb") {
      score = Math.max(0, score - 3);
      msg.textContent = "Ouch! -3";
    } else {
      score += 1;
      msg.textContent = "Bop!";
      h.classList.add("bonk");
    }
    pills();
    setTimeout(() => hide(h), 90);
  }

  function start() {
    clearAll();
    score = 0;
    timeLeft = cfg.dur;
    running = true;
    timers = new Set();
    holes.forEach(hide);
    msg.textContent = "Go!";
    pills();
    barFill.style.width = "100%";
    tickId = setInterval(() => {
      timeLeft -= 1;
      barFill.style.width = (timeLeft / cfg.dur) * 100 + "%";
      if (timeLeft <= 0) end();
    }, 1000);
    popLoop();
  }

  function clearAll() {
    running = false;
    if (tickId) clearInterval(tickId);
    if (timers) timers.forEach(clearTimeout);
  }

  function end() {
    clearAll();
    holes.forEach(hide);
    const { isRecord } = api.reportHighscore(score);
    pills();
    msg.textContent = "Time!";
    api.showModal({
      title: isRecord ? "New best!" : "Time's up!",
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
      clearAll();
      style.remove();
    },
  };
}
