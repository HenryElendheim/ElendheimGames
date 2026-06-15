/* ============================================================
   Home + Detail screens (the library shell).
   ============================================================ */

import { el, glow } from "./dom.js";
import { Storage } from "./storage.js";
import { GAMES, GAME_IDS, getGame } from "./registry.js";
import { gameIcon, uiIcon } from "./icons.js";
import { fetchLeaderboard } from "./cloud.js";

/* Short summary line for a game's best result, shown on its tile. */
function tileStatText(game) {
  const s = Storage.getStats(game.id);
  if (game.scoreType === "highscore" && s.highscore > 0) return `Best ${s.highscore}`;
  if (game.scoreType === "wins" && s.wins > 0) return `${s.wins} wins`;
  if (game.scoreType === "besttime" && s.bestTime != null)
    return `${(s.bestTime / 1000).toFixed(0)}s`;
  return null;
}

export function renderHome(go) {
  const g = Storage.getGlobal(GAME_IDS);

  const top = el(
    "div",
    { class: "home-top" },
    el("div", { class: "wordmark" }, el("span", {}, "Elendheim "), el("span", { class: "em" }, "Games")),
    profileChip(go)
  );

  const grid = el(
    "div",
    { class: "grid" },
    ...GAMES.map((game) => {
      const stat = tileStatText(game);
      return el(
        "button",
        {
          class: "tile",
          style: { color: game.accent, "--tile-glow": glow(game.accent, 0.45) },
          onClick: () => go(`#/game/${game.id}`),
        },
        game.isNew && el("div", { class: "badge-new" }, "NEW!"),
        el("div", { class: "tile-title" }, game.title),
        el("div", { class: "tile-art" }, gameIcon(game.id)),
        stat && el("div", { class: "tile-stat" }, stat)
      );
    })
  );

  return el("div", { class: "screen" }, top, grid);
}

export function renderDetail(id, go) {
  const game = getGame(id);
  if (!game) return renderHome(go);

  let difficulty = Storage.getPref(id, "difficulty", 1); // index into game.difficulty
  let mode = Storage.getPref(id, "mode", game.modes ? game.modes[0] : null);
  let fav = Storage.getPref(id, "favorite", false);

  /* hero */
  const star = el("button", { class: "star" + (fav ? " on" : "") }, fav ? "★" : "☆");
  star.addEventListener("click", () => {
    fav = !fav;
    Storage.setPref(id, "favorite", fav);
    star.classList.toggle("on", fav);
    star.textContent = fav ? "★" : "☆";
  });

  const hero = el(
    "div",
    { class: "detail-hero", style: { "--hero-glow": glow(game.accent, 0.4) } },
    el("div", { class: "hero-emoji" }, gameIcon(game.id)),
    el(
      "div",
      { class: "detail-top" },
      el("button", { class: "icon-btn", onClick: () => go("#/") }, "‹"),
      star
    ),
    el("div", { class: "detail-title" }, game.title),
    el("div", { class: "detail-desc" }, game.desc)
  );

  /* body sections */
  const body = el("div", { class: "detail-body" });

  // mode toggle
  if (game.modes) {
    const labels = { cpu: "vs Computer", local: "vs Friend" };
    const seg = el("div", { class: "seg" });
    const btns = game.modes.map((m) => {
      const b = el("button", { class: m === mode ? "active" : "" }, labels[m] || m);
      b.addEventListener("click", () => {
        mode = m;
        Storage.setPref(id, "mode", mode);
        btns.forEach((x) => x.el.classList.toggle("active", x.m === mode));
      });
      return { el: b, m };
    });
    seg.append(...btns.map((x) => x.el));
    body.append(seg);
  }

  // difficulty (TEXT ONLY — no face icon, per request)
  if (game.difficulty) {
    const steps = game.difficulty;
    const label = el("div", { class: "diff-label" }, steps[difficulty]);
    const slider = el("input", {
      class: "diff-slider",
      type: "range",
      min: "0",
      max: String(steps.length - 1),
      step: "1",
      value: String(difficulty),
    });
    const setFill = () => {
      const pct = steps.length > 1 ? (difficulty / (steps.length - 1)) * 100 : 0;
      slider.style.setProperty("--fill", pct + "%");
    };
    slider.addEventListener("input", () => {
      difficulty = +slider.value;
      label.textContent = steps[difficulty];
      Storage.setPref(id, "difficulty", difficulty);
      setFill();
    });
    setFill();
    const ticks = el(
      "div",
      { class: "diff-ticks" },
      ...steps.map((s) => el("span", {}, s))
    );
    body.append(el("div", { class: "diff" }, label, slider, ticks));
  }

  // bottom action row
  const playBtn = el("button", { class: "btn-play", onClick: () => go(`#/play/${id}`) }, "PLAY");
  const statsBtn = el("button", { class: "btn-square stats", onClick: () => showStats(game) }, uiIcon("chart"));
  const helpBtn = el("button", { class: "btn-square help", onClick: () => showHelp(game) }, "?");
  body.append(el("div", { class: "detail-actions" }, statsBtn, playBtn, helpBtn));

  return el("div", { class: "screen" }, hero, body);
}

/* ---- small modals reused by the detail screen ---- */
function modal(title, contentNodes) {
  const back = el(
    "div",
    { class: "modal-back", onClick: (e) => e.target === back && back.remove() },
    el(
      "div",
      { class: "modal" },
      el("h2", {}, title),
      ...contentNodes,
      el("button", { class: "btn-play", onClick: () => back.remove() }, "OK")
    )
  );
  document.body.append(back);
}

function showStats(game) {
  const s = Storage.getStats(game.id);
  const rows = [];
  if (game.scoreType === "highscore") rows.push(["Best Score", s.highscore]);
  if (game.scoreType === "wins") {
    rows.push(["Wins", s.wins]);
    rows.push(["Best Streak", s.bestStreak]);
  }
  if (game.scoreType === "besttime")
    rows.push(["Best", s.bestTime != null ? (s.bestTime / 1000).toFixed(1) + "s" : "—"]);
  rows.push(["Games Played", s.plays]);

  const lb = el("div", { class: "lb" }, el("div", { class: "lb-msg" }, "Loading leaderboard…"));
  modal(game.title, [
    el(
      "div",
      { class: "modal-stats", style: { flexWrap: "wrap" } },
      ...rows.map(([label, value]) => el("div", { class: "ms" }, el("b", {}, String(value)), el("span", {}, label)))
    ),
    el("h3", { class: "lb-title" }, "Leaderboard"),
    lb,
  ]);
  fetchLeaderboard(game.id, game.scoreType)
    .then((data) => renderLeaderboard(lb, data, game.scoreType))
    .catch(() => lb.replaceChildren(el("div", { class: "lb-msg" }, "Leaderboard unavailable right now.")));
}

function renderLeaderboard(container, rows, scoreType) {
  if (!rows || !rows.length) {
    container.replaceChildren(el("div", { class: "lb-msg" }, "No scores yet — be the first!"));
    return;
  }
  const val = (r) =>
    scoreType === "wins" ? r.wins : scoreType === "besttime" ? (r.best_time_ms / 1000).toFixed(1) + "s" : r.high_score;
  container.replaceChildren(
    ...rows.map((r, i) =>
      el(
        "div",
        { class: "lb-row" },
        el("span", { class: "lb-rank" }, String(i + 1)),
        el("span", { class: "lb-av", style: { background: r.avatar_color || "#f5a623" } }, initials(r.name)),
        el("span", { class: "lb-name" }, r.name || "Player"),
        el("span", { class: "lb-val" }, String(val(r)))
      )
    )
  );
}

function showHelp(game) {
  modal(game.title, [el("p", {}, game.desc)]);
}

/* ---- player profile + settings ---- */
const AVATAR_COLORS = ["#f5a623", "#8b5cf6", "#18c29c", "#ef5350", "#4fc3f7", "#ff4081", "#7c4dff", "#6aaa64"];

function initials(name) {
  const parts = (name || "Player").trim().split(/\s+/).filter(Boolean);
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || "P").slice(0, 2);
  return s.toUpperCase();
}

function profileChip(go) {
  const p = Storage.getProfile();
  const avatar = el("div", { class: "avatar", style: { background: p.color } }, initials(p.name));
  return el("button", { class: "chip profile", onClick: () => openSettings(go) }, avatar, el("span", {}, p.name || "Player"));
}

function openSettings(go) {
  Storage.getDeviceId(); // ensure the anonymous id exists from the start
  const p = Storage.getProfile();
  const g = Storage.getGlobal(GAME_IDS);
  let color = p.color;

  const preview = el("div", { class: "avatar", style: { background: color } }, initials(p.name));
  const nameInput = el("input", {
    type: "text",
    maxlength: "16",
    value: p.name === "Player" ? "" : p.name,
    placeholder: "Your name",
  });
  nameInput.addEventListener("input", () => (preview.textContent = initials(nameInput.value || "Player")));

  const swatches = el(
    "div",
    { class: "swatches" },
    ...AVATAR_COLORS.map((c) => {
      const sw = el("div", { class: "swatch" + (c === color ? " on" : ""), style: { background: c } });
      sw.addEventListener("click", () => {
        color = c;
        preview.style.background = c;
        swatches.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("on", x === sw));
      });
      return sw;
    })
  );

  const ms = (v, label) => el("div", { class: "ms" }, el("b", {}, String(v)), el("span", {}, label));
  const close = () => back.remove();
  const save = () => {
    Storage.setProfile({ name: nameInput.value.trim().slice(0, 16) || "Player", color });
    close();
    go("#/");
  };

  const back = el(
    "div",
    { class: "modal-back", onClick: (e) => e.target === back && close() },
    el(
      "div",
      { class: "modal settings" },
      el("h2", {}, "Settings"),
      preview,
      el("div", { class: "field" }, el("label", {}, "Name"), nameInput),
      el("div", { class: "field" }, el("label", {}, "Avatar colour"), swatches),
      el("div", { class: "totals" }, ms(g.totalWins, "Wins"), ms(g.totalPlays, "Played")),
      el("div", { class: "soon" }, "Cloud sync & leaderboards — coming soon"),
      el("button", { class: "btn-play", onClick: save }, "Done")
    )
  );
  document.body.append(back);
  nameInput.focus();
}
