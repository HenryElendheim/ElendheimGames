/* ============================================================
   App entry — hash router.
     #/            → home (game grid)
     #/game/:id    → game detail / start screen
     #/play/:id    → live game
   ============================================================ */

import { mount } from "./core/dom.js";
import { renderHome, renderDetail } from "./core/screens.js";
import { createGameShell } from "./core/shell.js";
import { getGame } from "./core/registry.js";
import { gameIcon } from "./core/icons.js";
import * as Sync from "./core/sync.js";

const app = document.getElementById("app");
let activeGame = null; // { destroy } for the currently-running game

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function teardown() {
  if (activeGame && typeof activeGame.destroy === "function") {
    try {
      activeGame.destroy();
    } catch {}
  }
  activeGame = null;
}

async function render() {
  teardown();
  const [, route, id] = location.hash.split("/"); // "#" , route , id

  if (route === "game" && id) {
    mount(app, renderDetail(id, go));
    window.scrollTo(0, 0);
    return;
  }

  if (route === "play" && id) {
    await renderPlay(id);
    return;
  }

  mount(app, renderHome(go));
  window.scrollTo(0, 0);
}

async function renderPlay(id) {
  const game = getGame(id);
  if (!game) return go("#/");

  const settings = {
    difficulty: game.difficulty ? game.difficulty[+localStoragePref(id, "difficulty", 1)] : null,
    difficultyIndex: game.difficulty ? +localStoragePref(id, "difficulty", 1) : null,
    mode: game.modes ? localStoragePref(id, "mode", game.modes[0]) : null,
  };

  const { screen, api } = createGameShell(game, settings, { onExit: () => go(`#/game/${id}`) });
  mount(app, screen);
  window.scrollTo(0, 0);

  if (!game.loader) {
    renderComingSoon(api, game);
    return;
  }

  try {
    const mod = await game.loader();
    activeGame = (await mod.default(api)) || null;
  } catch (err) {
    console.error(err);
    renderComingSoon(api, game, true);
  }
}

function renderComingSoon(api, game, errored = false) {
  api.setStats({
    left: { label: "Status", value: errored ? "Error" : "Soon" },
    right: { label: game.scoreType === "wins" ? "Wins" : "Best", value: "—" },
  });
  const ph = document.createElement("div");
  ph.className = "placeholder";
  const inner = document.createElement("div");
  const iconWrap = document.createElement("div");
  iconWrap.className = "ph-emoji";
  iconWrap.append(gameIcon(game.id));
  inner.append(iconWrap);
  inner.insertAdjacentHTML(
    "beforeend",
    `<b>${game.title}</b><br/>${
      errored ? "Something went wrong loading this game." : "Coming soon — this one's still in the workshop!"
    }`
  );
  ph.append(inner);
  api.root.append(ph);
}

/* read a pref synchronously without importing Storage twice */
function localStoragePref(id, key, fallback) {
  try {
    const raw = localStorage.getItem(`eg:pref:${id}:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

window.addEventListener("hashchange", render);
render();

// kick off cloud sign-in + sync in the background (never blocks the UI)
Sync.init();

/* ---- PWA: register service worker (installable + offline) ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
