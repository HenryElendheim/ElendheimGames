# Locked decisions

Decisions we've settled on. Don't relitigate without checking with the user.
Format: **decision** — short rationale.

- **2D, not 3D** — far more game per unit of effort, runs great on phone, the
  cozy hand-drawn look (Stardew / old Pokémon) suits a life sim.
- **Web (PWA), not a native engine like Unity** — the dev environment is a
  headless cloud container with no GUI; web games can be built, run, and iterated
  end-to-end here, while Unity/Godot are editor-driven and can't be tested from
  here. Web also means she just opens a link on her phone (no app store).
- **Cozy & open vibe** — no fail states, no timers, no score, no streak guilt.
  This is both the aesthetic and the pedagogy (pressure kills relaxation and
  learning alike).
- **One unified game, life-sim as hub** — car and card games live *inside* the
  life sim as diegetic activities, rather than three separate games.
- **Language woven into the core loop** — comprehension drives progress; never a
  quiz bolted on. (See `design-mechanics.md` for the "natural but fun" ladder.)
- **Likely its own repo** — the game will probably be separated from the
  Elendheim Games collection. Keep design notes in one self-contained folder
  (`docs/norwegian-game/`) so they're easy to move.
