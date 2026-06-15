/* ============================================================
   Minimal Supabase client (auth + REST over fetch).
   Anonymous sign-in gives a stable user id; the access token is
   sent as a Bearer so row-level security knows who we are.
   Everything is best-effort: if the network/Supabase is unavailable
   the calls reject and the app keeps working offline.
   ============================================================ */

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const AUTH = `${SUPABASE_URL}/auth/v1`;
const REST = `${SUPABASE_URL}/rest/v1`;
const SESSION_KEY = "eg:session";

let session = null; // { access_token, refresh_token, expires_at, user_id }

function loadSession() {
  if (session) return session;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    session = null;
  }
  return session;
}

function saveSession(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user_id: data.user && data.user.id,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function authFetch(path, body) {
  const res = await fetch(`${AUTH}${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`auth ${res.status}`);
  return res.json();
}

async function signInAnonymously() {
  return saveSession(await authFetch("/signup", {}));
}

async function refresh() {
  const s = loadSession();
  if (!s || !s.refresh_token) return signInAnonymously();
  try {
    return saveSession(await authFetch("/token?grant_type=refresh_token", { refresh_token: s.refresh_token }));
  } catch {
    return signInAnonymously(); // refresh token expired/invalid — start fresh
  }
}

/** Ensure we have a valid session; returns the user id. */
export async function init() {
  const s = loadSession();
  if (!s) await signInAnonymously();
  else if (Date.now() > s.expires_at - 60000) await refresh();
  return session.user_id;
}

async function token() {
  const s = loadSession();
  if (!s || Date.now() > s.expires_at - 60000) await refresh();
  return session.access_token;
}

async function restFetch(path, { method = "GET", body, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${await token()}` };
  if (body) headers["Content-Type"] = "application/json";
  if (prefer) headers["Prefer"] = prefer;
  const res = await fetch(`${REST}${path}`, { method, headers, body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(`rest ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function userId() {
  return (loadSession() || {}).user_id || null;
}

export async function upsertProfile(profile) {
  const id = await init();
  return restFetch("/profiles", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: [{ id, name: profile.name, avatar_color: profile.color }],
  });
}

export async function upsertStats(gameId, s) {
  const id = await init();
  return restFetch("/game_stats", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: [
      {
        user_id: id,
        game_id: gameId,
        high_score: s.highscore,
        wins: s.wins,
        best_streak: s.bestStreak,
        best_time_ms: s.bestTime,
        plays: s.plays,
      },
    ],
  });
}

export async function fetchMyStats() {
  const id = await init();
  return restFetch(`/game_stats?user_id=eq.${id}&select=game_id,high_score,wins,best_streak,best_time_ms,plays`);
}

export async function fetchLeaderboard(gameId, scoreType, limit = 20) {
  await init();
  const order =
    scoreType === "wins" ? "wins.desc" : scoreType === "besttime" ? "best_time_ms.asc" : "high_score.desc";
  let path = `/leaderboard?game_id=eq.${gameId}&select=name,avatar_color,high_score,wins,best_time_ms&order=${order}&limit=${limit}`;
  if (scoreType === "besttime") path += "&best_time_ms=not.is.null";
  return restFetch(path);
}
