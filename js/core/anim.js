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
  const movers = [];
  container.querySelectorAll("[data-cid]").forEach((el) => {
    const f = first.get(el.dataset.cid);
    const l = el.getBoundingClientRect();
    if (f) {
      const dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.zIndex = "60";
        movers.push(el);
      }
    } else if (origin) {
      // newly drawn/dealt: slide from the deck, on top of what was there
      const dx = origin.left + origin.width / 2 - (l.left + l.width / 2);
      const dy = origin.top + origin.height / 2 - (l.top + l.height / 2);
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(.96)`;
      el.style.zIndex = "70";
      movers.push(el);
    } else if (!opts.noEnter) {
      el.classList.add("eg-enter");
    }
  });

  if (movers.length) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const el of movers) {
          el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.3,1)`;
          el.style.transform = "none";
        }
      })
    );
    setTimeout(() => {
      for (const el of movers) { el.style.transition = ""; el.style.transform = ""; el.style.zIndex = ""; }
    }, dur + 70);
  }
}
