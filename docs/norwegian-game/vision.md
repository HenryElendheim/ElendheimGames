# Vision — Norwegian learning game

## One-line
A **2D, cozy, open** life-sim web game that helps my fiancée learn Norwegian by
*living* in it — the language is the gameplay, never a quiz on top.

## Who it's for
My fiancée. Her game tastes: **life sims**, **car games**, and **simple card /
solitaire games**. The design folds all three into one world (see below).

## The premise
You've **moved to a small Norwegian town to start a new life**, and the way you
build that life is by understanding more Norwegian. This mirrors reality, so the
motivation feels real, not gamified-for-its-own-sake. The town may be named
**Elendheim** to tie into the wider project.

## The unifying idea
A cozy **life sim is the hub**. Her other two tastes live *inside* it, framed so
they make sense in the world (diegetic):
- 🚗 **Driving** — the town mechanic gives you a car; you do delivery runs / road
  trips between towns. Road signs, directions, fuel-stop ordering — all Norwegian.
- 🃏 **Cards** — the pub runs card nights; play a Norwegian card game vs NPCs who
  chat in Norwegian. (Reuses card-engine experience from Elendheim Games.)

So it's ONE cohesive game that scratches life-sim + car + card itches, and every
activity is secretly vocab practice she never experiences as a drill.

## The feel ("cozy & open")
- **No fail states, no timers, no score, no streak guilt.** The game is happy to
  see her whenever she shows up. Pressure is the enemy of both relaxation and
  language learning.
- A session has no required objective — she just lives there: wake up, make
  coffee (or not), feed the cat, wander to town, say hi to the baker, overhear a
  conversation and understand a bit more than last week, find a new word.
- The learning is the **sediment that settles from just being there.**

## Progress without pressure
- **The town warms to you.** NPCs start slow with picture-cues + short phrases;
  as you chat more they relax into longer, faster, natural Norwegian. The world
  becomes more fluent *as she does* — an invisible difficulty curve.
- **Phrasebook fills like a scrapbook**, not a progress bar (collection, not
  completion).
- **The world gently unfurls** — new areas, a festival, a shop opening — appearing
  with time, not gated behind tests.
- **Soft mistakes**: wrong answers get a chuckle + slower repeat, never a buzzer.

## Cozy production touches (aspirational)
Sense of place & weather (rain, first snow, long summer light); soft soundscape
(piano, birds, stove, waves); a home that's hers to decorate; slow warm
relationships; a pet that greets her.

## Tech direction
- **2D**, **web** (PWA), so she just opens a link on her phone — no app store.
- Likely **Phaser** for a 2D life-sim/top-down feel. (Not Unity: the dev
  environment is a headless cloud container; web is what can be built & iterated
  end-to-end here. See `decisions.md`.)
- Free `nb-NO` text-to-speech (`SpeechSynthesis`) so every word is hearable.
