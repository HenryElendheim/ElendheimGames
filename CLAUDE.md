# CLAUDE.md — project memory entry point

This file is loaded automatically at the start of a session. Read it first.

## About this repo
**Elendheim Games** — a free, ad-free PWA collection of small games (solitaire,
chess, word puzzles, arcade). Plain HTML/CSS/JS, no build step. See `README.md`
for architecture and how to add a game. There is also a Supabase backend
(`docs/supabase-schema.sql`).

## ⚠️ Active side-project: Norwegian learning game
A separate, in-design project: a **2D cozy life-sim web game to help my fiancée
learn Norwegian**, built in a fun/natural way. It will likely become **its own
repo** later, but design notes live here for now.

**Before doing any work on the Norwegian game, read `docs/norwegian-game/`:**
- `vision.md` — the concept, premise, and the "feel" we're going for
- `decisions.md` — what is LOCKED in (don't relitigate without asking)
- `open-questions.md` — what's still undecided (good to revisit with the user)
- `design-mechanics.md` — how the learning is woven into play

## How to keep this memory current
- This is the durable memory: the cloud container is ephemeral, so **only
  committed-and-pushed files survive** between sessions. Update these notes as
  decisions are made, then commit.
- When a decision moves from "open question" to "locked", move it from
  `open-questions.md` into `decisions.md` with a one-line rationale.

## Working agreement
- Develop on branch `claude/norwegian-learning-game-ideas-22dxn0`.
- Don't create a PR unless explicitly asked.
