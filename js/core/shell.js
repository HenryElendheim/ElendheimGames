/* ============================================================
   In-game shell.
   Builds the generic chrome from the screenshots — circular back
   button, two stat pills, restart button, a game area, and an
   optional bottom action bar — then hands the game a small `api`
   to drive them. Games stay focused on gameplay.
   ============================================================ */

import { el, toast, glow } from "./dom.js";
import { Storage } from "./storage.js";

export function createGameShell(game, settings, { onExit }) {
  const backBtn = el("button", { class: "icon-btn", onClick: () => onExit() }, "‹");
  const restartBtn = el("button", { class: "icon-btn" }, "↻");

  const mkPill = (teal) =>
    el(
      "div",
      { class: teal ? "pill teal" : "pill" },
      el("div", { class: "pill-label" }, ""),
      el("div", { class: "pill-value" }, "0")
    );
  const leftPill = mkPill(false);
  const rightPill = mkPill(true);

  const header = el(
    "div",
    { class: "game-header" },
    backBtn,
    el("div", { class: "spacer" }),
    leftPill,
    rightPill,
    el("div", { class: "spacer" }),
    restartBtn
  );

  const root = el("div", { class: "game-root" });
  const footer = el("div", { class: "game-footer" });

  const screen = el(
    "div",
    { class: "screen game-screen", style: { "--game-bg": shadeBg(game.accent) } },
    header,
    root,
    footer
  );

  let restartHandler = null;
  restartBtn.addEventListener("click", () => restartHandler && restartHandler());

  function setPill(pillEl, label, value) {
    pillEl.querySelector(".pill-label").textContent = label;
    pillEl.querySelector(".pill-value").textContent = value;
  }

  const api = {
    root,
    settings,
    stats: Storage.getStats(game.id),

    /** Configure the two header pills at once. */
    setStats({ left, right }) {
      if (left) setPill(leftPill, left.label, left.value);
      if (right) setPill(rightPill, right.label, right.value);
    },

    /** Build the bottom action bar. buttons: {icon,label,onClick,accent,disabled} */
    setFooter(buttons = []) {
      footer.replaceChildren(
        ...buttons.map((b) => {
          const btn = el(
            "button",
            { class: "footer-btn" + (b.accent ? " accent" : ""), disabled: !!b.disabled },
            el("div", { class: "fb-ico" }, b.icon),
            el("div", { class: "fb-label" }, b.label)
          );
          btn.addEventListener("click", () => !b.disabled && b.onClick && b.onClick());
          return btn;
        })
      );
    },

    onRestart(fn) {
      restartHandler = fn;
    },

    showModal({ title, message, statsRows = [], primaryLabel = "Play Again", onPrimary }) {
      const back = el(
        "div",
        { class: "modal-back" },
        el(
          "div",
          { class: "modal" },
          el("h2", {}, title),
          message && el("p", {}, message),
          statsRows.length &&
            el(
              "div",
              { class: "modal-stats" },
              ...statsRows.map((r) =>
                el("div", { class: "ms" }, el("b", {}, String(r.value)), el("span", {}, r.label))
              )
            ),
          el(
            "button",
            {
              class: "btn-play",
              onClick: () => {
                back.remove();
                onPrimary && onPrimary();
              },
            },
            primaryLabel
          ),
          el(
            "button",
            {
              class: "btn-menu",
              onClick: () => {
                back.remove();
                location.hash = "#/"; // back to the library of all games
              },
            },
            "Main Menu"
          )
        )
      );
      screen.append(back);
      return back;
    },

    /* score reporting — thin pass-through to Storage */
    reportWin: () => Storage.reportWin(game.id),
    reportLoss: () => Storage.reportLoss(game.id),
    reportHighscore: (s) => Storage.reportHighscore(game.id, s),
    reportTime: (v) => Storage.reportTime(game.id, v),
    refreshStats() {
      api.stats = Storage.getStats(game.id);
      return api.stats;
    },

    toast,
    accent: game.accent,
    glow: (a) => glow(game.accent, a),
    exit: onExit,
  };

  return { screen, api };
}

/* Darken an accent into a comfortable full-screen game background. */
function shadeBg(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = 0.12; // keep just a hint of the accent
  r = Math.round(r * mix + 18 * (1 - mix));
  g = Math.round(g * mix + 19 * (1 - mix));
  b = Math.round(b * mix + 24 * (1 - mix));
  return `rgb(${r}, ${g}, ${b})`;
}
