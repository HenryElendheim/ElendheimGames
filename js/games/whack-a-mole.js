/* ============================================================
   Whack-a-Mole
   30-second round. Moles pop up; tap to bop. Bombs cost you points.
   Difficulty: EASY slow · MEDIUM · HARD fast + more bombs
   Tracks: high score
   ============================================================ */

const HOLES = 9; // 3x3

const STYLE = `
.wm-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:18px; position:relative; }
.wm-timebar { width:min(86vw,360px); height:10px; border-radius:6px; background:var(--surface); overflow:hidden; }
.wm-timebar > i { display:block; height:100%; background:var(--accent); width:100%; transition:width .25s linear; }
.wm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3.5vw; width:min(86vw,360px); }
.wm-hole { aspect-ratio:1; border-radius:50%; background:#0f1014; position:relative; overflow:hidden;
  box-shadow:inset 0 8px 18px rgba(0,0,0,.6); border:none; }
.wm-mole { position:absolute; inset:16% 16% -4%; border-radius:48% 48% 42% 42%;
  transform:translateY(150%); transition:transform .13s cubic-bezier(.34,1.45,.6,1); }
.wm-hole.up .wm-mole { transform:translateY(0); }
.wm-hole.bonk .wm-mole { animation:wm-squish .22s ease forwards; }
@keyframes wm-squish {
  0%   { transform:translateY(0) scaleX(1) scaleY(1); filter:brightness(1); }
  35%  { transform:translateY(20%) scaleX(1.34) scaleY(.55); filter:brightness(2); }
  100% { transform:translateY(150%) scaleX(1) scaleY(1); filter:brightness(1); } }
.wm-burst { position:absolute; inset:0; pointer-events:none; z-index:5; }
.wm-ring { position:absolute; left:50%; top:44%; width:42%; height:42%; margin:-21% 0 0 -21%; border-radius:50%;
  border:4px solid #ffe08a; animation:wm-ring .34s ease-out forwards; }
@keyframes wm-ring { 0%{transform:scale(.3);opacity:1;} 100%{transform:scale(2.3);opacity:0;} }
.wm-spk { position:absolute; left:50%; top:44%; width:10%; height:10%; margin:-5% 0 0 -5%; border-radius:50%;
  background:#ffd75e; animation:wm-spk .36s ease-out forwards; }
@keyframes wm-spk { 0%{transform:rotate(var(--a)) translateY(0) scale(1);opacity:1;}
  100%{transform:rotate(var(--a)) translateY(-160%) scale(.2);opacity:0;} }
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
/* floating "-3" that rises from where a bomb was tapped */
.wm-float { position:absolute; transform:translate(-50%,-50%); font-size:23px; font-weight:800; color:#ff6a5a;
  text-shadow:0 2px 6px rgba(0,0,0,.7); pointer-events:none; z-index:30; white-space:nowrap;
  animation:wm-float .95s ease-out forwards; }
@keyframes wm-float {
  0%   { opacity:0; transform:translate(-50%,-40%) scale(.7); }
  18%  { opacity:1; transform:translate(-50%,-62%) scale(1.12); }
  100% { opacity:0; transform:translate(-50%,-155%) scale(1); } }
/* full-screen Go!/Time! banners */
.wm-banner { position:absolute; inset:0; display:grid; place-items:center; z-index:40; pointer-events:none;
  background:radial-gradient(circle, rgba(13,14,18,.55), rgba(13,14,18,.32)); }
.wm-banner b { font-size:64px; font-weight:800; color:#fff; letter-spacing:.04em; text-shadow:0 4px 18px rgba(0,0,0,.85); }
.wm-banner.go { animation:wm-banner .7s ease-out forwards; }
.wm-banner.time { animation:wm-banner 1s ease-out forwards; }
@keyframes wm-banner { 0%{opacity:0;} 16%{opacity:1;} 70%{opacity:1;} 100%{opacity:0;} }
.wm-banner b { animation:wm-bpop .55s ease-out; }
@keyframes wm-bpop { 0%{transform:scale(.5);} 55%{transform:scale(1.12);} 100%{transform:scale(1);} }
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

  const bar = document.createElement("div");
  bar.className = "wm-timebar";
  const barFill = document.createElement("i");
  bar.append(barFill);
  const grid = document.createElement("div");
  grid.className = "wm-grid";
  const wrap = document.createElement("div");
  wrap.className = "wm-wrap";
  wrap.append(bar, grid);
  api.root.append(wrap);

  holes = Array.from({ length: HOLES }, () => {
    const hole = document.createElement("button");
    hole.className = "wm-hole";
    const mole = document.createElement("div");
    mole.className = "wm-mole";
    hole.append(mole);
    hole.state = { up: false, kind: null, mole };
    hole.addEventListener("click", (e) => whack(hole, e));
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

  function bonkBurst(h) {
    const b = document.createElement("div");
    b.className = "wm-burst";
    b.innerHTML =
      '<span class="wm-ring"></span>' +
      Array.from({ length: 6 }, (_, i) => `<span class="wm-spk" style="--a:${i * 60}deg"></span>`).join("");
    h.append(b);
    setTimeout(() => b.remove(), 360);
  }

  // floating "-3" that rises from where the bomb was tapped (bombs only)
  function floatText(x, y, text) {
    const el = document.createElement("div");
    el.className = "wm-float";
    el.textContent = text;
    const r = wrap.getBoundingClientRect();
    el.style.left = x - r.left + "px";
    el.style.top = y - r.top + "px";
    wrap.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  // full-screen "Go!" / "Time!" banner
  function banner(text, cls) {
    const el = document.createElement("div");
    el.className = "wm-banner " + cls;
    const b = document.createElement("b");
    b.textContent = text;
    el.append(b);
    wrap.append(el);
    setTimeout(() => el.remove(), cls === "go" ? 750 : 1050);
  }

  function whack(h, e) {
    if (!running || !h.state.up) return;
    if (h.state.kind === "bomb") {
      score = Math.max(0, score - 3);
      floatText(e.clientX, e.clientY, "Ouch! -3");
      pills();
      setTimeout(() => hide(h), 90);
    } else {
      score += 1;
      h.classList.add("bonk");
      bonkBurst(h);
      pills();
      setTimeout(() => hide(h), 200); // let the squish animation play
    }
  }

  function start() {
    clearAll();
    score = 0;
    timeLeft = cfg.dur;
    running = true;
    timers = new Set();
    holes.forEach(hide);
    banner("Go!", "go");
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
    banner("Time!", "time");
    // let "Time!" land before the results screen slides in
    setTimeout(() => {
      api.showModal({
        title: isRecord ? "New best!" : "Time's up!",
        statsRows: [
          { label: "Score", value: score },
          { label: "Best", value: api.refreshStats().highscore },
        ],
        onPrimary: start,
      });
    }, 700);
  }

  start();
  return {
    destroy() {
      clearAll();
      style.remove();
    },
  };
}
