/* ============================================================
   Storage layer.
   Games NEVER touch localStorage directly — they go through this.
   Today it's backed by localStorage; swap the read/write pair for a
   cloud backend later and nothing else in the app needs to change.
   ============================================================ */

const PREFIX = "eg:";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — fail silently */
  }
}

const DEFAULT_STATS = {
  highscore: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  bestTime: null, // ms, lower is better
  plays: 0,
};

export const Storage = {
  /* ---- per-game stats ---- */
  getStats(gameId) {
    return { ...DEFAULT_STATS, ...read(`stats:${gameId}`, {}) };
  },
  _save(gameId, stats) {
    write(`stats:${gameId}`, stats);
    return stats;
  },

  /** Record a high-score run. Returns { stats, isRecord }. */
  reportHighscore(gameId, score) {
    const stats = this.getStats(gameId);
    stats.plays++;
    const isRecord = score > stats.highscore;
    if (isRecord) stats.highscore = score;
    return { stats: this._save(gameId, stats), isRecord };
  },

  /** Record a win (for wins/streak games). */
  reportWin(gameId) {
    const stats = this.getStats(gameId);
    stats.plays++;
    stats.wins++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    return this._save(gameId, stats);
  },

  /** Record a loss — breaks the streak. */
  reportLoss(gameId) {
    const stats = this.getStats(gameId);
    stats.plays++;
    stats.losses++;
    stats.streak = 0;
    return this._save(gameId, stats);
  },

  /** Record a best-time / fewest-moves run. */
  reportTime(gameId, value) {
    const stats = this.getStats(gameId);
    stats.plays++;
    if (stats.bestTime == null || value < stats.bestTime) stats.bestTime = value;
    return this._save(gameId, stats);
  },

  /* ---- per-game preferences (difficulty, mode, favorite) ---- */
  getPref(gameId, key, fallback) {
    return read(`pref:${gameId}:${key}`, fallback);
  },
  setPref(gameId, key, value) {
    write(`pref:${gameId}:${key}`, value);
  },

  /* ---- player profile (local now; syncs to the account later) ---- */
  getProfile() {
    return { name: "Player", color: "#f5a623", ...read("profile", {}) };
  },
  setProfile(patch) {
    const next = { ...this.getProfile(), ...patch };
    write("profile", next);
    return next;
  },

  /** Stable anonymous id for this device — becomes the account link later. */
  getDeviceId() {
    let id = read("deviceId", null);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      write("deviceId", id);
    }
    return id;
  },

  /* ---- global aggregate (for the home-screen chip) ---- */
  getGlobal(gameIds) {
    let totalWins = 0,
      totalPlays = 0;
    for (const id of gameIds) {
      const s = this.getStats(id);
      totalWins += s.wins;
      totalPlays += s.plays;
    }
    return { totalWins, totalPlays };
  },
};
