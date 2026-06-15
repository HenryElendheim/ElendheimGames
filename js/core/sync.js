/* ============================================================
   Offline-first cloud sync.
   On start: sign in anonymously, pull cloud stats and merge them in,
   then push the merged result back up. Afterwards, any local change
   is pushed in the background (debounced). All best-effort — if the
   network is down nothing breaks; it simply syncs next time online.
   ============================================================ */

import { Storage } from "./storage.js";
import { GAME_IDS } from "./registry.js";
import * as Cloud from "./cloud.js";

let ready = false;
const dirtyGames = new Set();
let profileDirty = false;
let timer = null;

export async function init() {
  try {
    await Cloud.init(); // anonymous sign-in
  } catch {
    return; // offline / blocked — stay local-only this session
  }

  // pull remote → merge into local
  try {
    const rows = await Cloud.fetchMyStats();
    for (const row of rows || []) Storage.mergeStats(row.game_id, row);
  } catch {
    /* ignore pull failure */
  }

  ready = true;

  // push local (now merged) up for everything that has been played
  for (const id of GAME_IDS) {
    const s = Storage.getStats(id);
    if (s.plays > 0) dirtyGames.add(id);
  }
  profileDirty = true;
  schedule();

  // future local changes → background push
  Storage.onChange((type, id) => {
    if (type === "profile") profileDirty = true;
    else if (id) dirtyGames.add(id);
    schedule();
  });
}

function schedule() {
  if (!ready || timer) return;
  timer = setTimeout(flush, 1200);
}

async function flush() {
  timer = null;
  const games = [...dirtyGames];
  dirtyGames.clear();
  const pushProfile = profileDirty;
  profileDirty = false;
  try {
    if (pushProfile) await Cloud.upsertProfile(Storage.getProfile());
    for (const id of games) await Cloud.upsertStats(id, Storage.getStats(id));
  } catch {
    // failed — requeue and try again later
    games.forEach((g) => dirtyGames.add(g));
    if (pushProfile) profileDirty = true;
    timer = setTimeout(flush, 8000);
  }
}
