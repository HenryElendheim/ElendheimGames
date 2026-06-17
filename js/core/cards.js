/* ============================================================
   Shared helpers for the tap-to-move solitaire-family games
   (Solitaire, Spiderette). Keeps the "tap a card → send it to the best
   legal spot, otherwise shake" behaviour identical across games.
   ============================================================ */

let shakeInjected = false;
// Quick horizontal shake — the "that move isn't legal" feedback on a tap.
export function shake(el) {
  if (!el) return;
  if (!shakeInjected) {
    shakeInjected = true;
    const s = document.createElement("style");
    s.textContent =
      `@keyframes eg-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
       .eg-shake{animation:eg-shake .32s ease;}`;
    document.head.append(s);
  }
  el.classList.remove("eg-shake");
  void el.offsetWidth; // restart the animation even on repeated taps
  el.classList.add("eg-shake");
}

// Among `dests`, return the highest-scoring one that `canPlace` allows, or
// null if none is legal. Each game supplies only its own rules: `canPlace(d)`
// gates legality and the optional `score(d)` ranks the legal spots (higher is
// better; first wins on a tie).
export function bestDestination(dests, canPlace, score) {
  let best = null,
    bestScore = -Infinity;
  for (const d of dests) {
    if (!canPlace(d)) continue;
    const s = score ? score(d) : 0;
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  }
  return best;
}
