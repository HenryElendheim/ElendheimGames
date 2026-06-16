/* ============================================================
   Card animation helper — FLIP move + entrance.
   Wrap a game's DOM-building "paint" with flipRender(container, paint):
   it measures every [data-cid] card before the repaint, then animates
   each card sliding from its old position to its new one, and fades in
   cards that are newly dealt / drawn. Give each card element a stable
   data-cid (e.g. suit-rank) so it can be tracked across repaints.
   ============================================================ */

let injected = false;
function ensureStyle() {
  if (injected) return;
  injected = true;
  const s = document.createElement("style");
  s.textContent =
    `@keyframes eg-card-enter{from{opacity:0;transform:translateY(-16px) scale(.92);}to{opacity:1;transform:none;}}
     .eg-enter{animation:eg-card-enter .22s ease both;}`;
  document.head.append(s);
}

export function flipRender(container, paint, opts = {}) {
  ensureStyle();
  const dur = opts.dur || 260;
  const first = new Map();
  if (container) container.querySelectorAll("[data-cid]").forEach((el) => first.set(el.dataset.cid, el.getBoundingClientRect()));

  // measure the deck/stock position BEFORE repaint so drawn cards fly from it
  let origin = null;
  if (opts.origin) {
    const oe = typeof opts.origin === "function" ? opts.origin() : opts.origin;
    if (oe) { const r = oe.getBoundingClientRect(); if (r.width) origin = r; }
  }

  paint();

  if (!container) return;
  // Drive the animation with the Web Animations API rather than inline
  // transform + setTimeout cleanup. Animations finish on their own and leave
  // the element at its natural position, so nothing can get "stuck" no matter
  // how fast repaints happen (rapid taps just start fresh animations).
  container.querySelectorAll("[data-cid]").forEach((el) => {
    const f = first.get(el.dataset.cid);
    const l = el.getBoundingClientRect();
    let fromX, fromY, scale = 1, z = "60";
    if (f) {
      fromX = f.left - l.left; fromY = f.top - l.top;
      if (Math.abs(fromX) < 0.5 && Math.abs(fromY) < 0.5) return; // didn't move
    } else if (origin) {
      fromX = origin.left + origin.width / 2 - (l.left + l.width / 2);
      fromY = origin.top + origin.height / 2 - (l.top + l.height / 2);
      scale = 0.96; z = "70";
    } else {
      if (!opts.noEnter) el.classList.add("eg-enter");
      return;
    }
    if (!el.animate) return; // no WAAPI → layout is already correct, just no slide
    const prevZ = el.style.zIndex;
    el.style.zIndex = z;
    const anim = el.animate(
      [{ transform: `translate(${fromX}px, ${fromY}px) scale(${scale})` }, { transform: "none" }],
      { duration: dur, easing: "cubic-bezier(.2,.8,.3,1)" }
    );
    const clear = () => { el.style.zIndex = prevZ; };
    anim.onfinish = clear;
    anim.oncancel = clear;
  });
}
