/* ============================================================
   Elendheim TCG — Hearthstone-lite duel (MVP).
   25 HP heroes, mana ramps 1→8, 8-card decks, draw 1/turn with fatigue.
   Minions + spells with keywords: Taunt, Charge, Divine Shield, Battlecry.
   Tap a hand card to play it (targeted spells then tap a target); tap a
   ready minion then an enemy to attack. Infinite battles vs a rarity-
   balanced random CPU deck. Tracks wins + streak.

   NOTE: this first build drops straight into a duel. The menu, shop,
   packs, collection, deck-builder, Heimers economy and Commander-Level
   battlefield unlocks come in following commits; the 50-card set and
   stable card IDs here are the shared foundation for all of that.
   ============================================================ */

const LABEL = { common: "Troop", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY = {
  common: { color: "#9aa3b2", a1: "#6b7280", a2: "#3a3f4a" },
  rare: { color: "#4f91ff", a1: "#3a6fd8", a2: "#16306e" },
  epic: { color: "#b06bff", a1: "#7b3fd0", a2: "#3a1873" },
  legendary: { color: "#ffb83d", a1: "#f5a623", a2: "#7a4d00" },
};
const KW_LABEL = { taunt: "Taunt", charge: "Charge", shield: "Shield", rush: "Rush" };

/* placeholder art glyphs (until real card art is added) */
const GLYPHS = [
  `<path d="M50 18l10 22 24 2-18 16 6 24-22-13-22 13 6-24-18-16 24-2z"/>`,
  `<path d="M50 16l30 10v22c0 18-14 28-30 36-16-8-30-18-30-36V26z"/>`,
  `<circle cx="50" cy="50" r="30"/>`,
  `<path d="M50 18l32 56H18z"/>`,
  `<path d="M50 16l34 34-34 34-34-34z"/>`,
];

/* ---- the 50-card set (deterministic → stable ids) ---- */
function buildSet() {
  const cards = [];
  const cnt = { common: 0, rare: 0, epic: 0, legendary: 0, spell: 0 };
  const minion = (rarity, cost, atk, hp, keywords = [], battlecry = null) => {
    cnt[rarity]++;
    cards.push({ id: cards.length, name: `${LABEL[rarity]} ${cnt[rarity]}`, rarity, type: "minion", cost, atk, hp, keywords, battlecry });
  };
  const spell = (rarity, cost, effect) => {
    cnt.spell++;
    cards.push({ id: cards.length, name: `Spell ${cnt.spell}`, rarity, type: "spell", cost, effect, keywords: [] });
  };

  // commons: 21 minions + 3 spells
  for (let i = 0; i < 21; i++) {
    const cost = 1 + (i % 6);
    const budget = cost * 2 + 1;
    let atk = Math.max(1, Math.round(budget * 0.55));
    const kw = [];
    if (i % 7 === 5) kw.push("taunt");
    if (cost <= 3 && i % 8 === 2) kw.push("charge");
    minion("common", cost, atk, Math.max(1, budget - atk), kw);
  }
  spell("common", 1, { kind: "damage", amount: 2 });
  spell("common", 2, { kind: "buff", atk: 1, hp: 2 });
  spell("common", 3, { kind: "aoe", amount: 1 });

  // rares: 12 minions + 3 spells
  for (let i = 0; i < 12; i++) {
    const cost = 1 + (i % 6);
    const budget = cost * 2 + 2;
    let atk = Math.max(1, Math.round(budget * 0.55));
    const kw = [];
    if (i % 4 === 1) kw.push("taunt");
    if (i % 5 === 3 && cost <= 4) kw.push("charge");
    if (i % 6 === 0) kw.push("shield");
    minion("rare", cost, atk, Math.max(1, budget - atk), kw);
  }
  spell("rare", 2, { kind: "damage", amount: 3 });
  spell("rare", 3, { kind: "draw", count: 2 });
  spell("rare", 4, { kind: "aoe", amount: 2 });

  // epics: 6 minions (battlecries) + 2 spells
  const epicBC = [
    { kind: "summon", atk: 2, hp: 2, count: 1 },
    { kind: "aoe", amount: 2 },
    { kind: "buffRandom", atk: 2, hp: 2 },
    { kind: "draw", count: 1 },
    { kind: "damageFace", amount: 3 },
    { kind: "summon", atk: 1, hp: 1, count: 2 },
  ];
  for (let i = 0; i < 6; i++) {
    const cost = 3 + (i % 4);
    const budget = cost * 2 + 3;
    let atk = Math.max(1, Math.round(budget * 0.5));
    const kw = i % 2 === 0 ? ["taunt"] : [];
    minion("epic", cost, atk, Math.max(1, budget - atk), kw, epicBC[i]);
  }
  spell("epic", 5, { kind: "damage", amount: 6 });
  spell("epic", 4, { kind: "aoe", amount: 3 });

  // legendaries: 3 minions
  minion("legendary", 7, 6, 6, [], { kind: "summon", atk: 2, hp: 2, count: 2 });
  minion("legendary", 6, 5, 5, ["taunt"], { kind: "aoe", amount: 3 });
  minion("legendary", 8, 8, 8, ["charge"], null);

  return cards;
}
const SET = buildSet();

/* a curated, low-curve starter deck (8 cards) */
function starterDeck() {
  const minionByCost = (c) => SET.find((x) => x.type === "minion" && x.cost === c && x.rarity === "common");
  const ids = [];
  const want = [1, 1, 2, 2, 3, 3, 4, 5];
  const used = {};
  for (const c of want) {
    // allow up to 2 copies of a card
    let card = SET.find((x) => x.type === "minion" && x.cost === c && (used[x.id] || 0) < 2);
    if (!card) card = minionByCost(c) || SET.find((x) => x.type === "minion");
    used[card.id] = (used[card.id] || 0) + 1;
    ids.push(card.id);
  }
  return ids.map((id) => SET[id]);
}

/* a rarity-weighted random deck for the CPU (never too unfair) */
function randomDeck() {
  const pool = { common: 0.6, rare: 0.3, epic: 0.08, legendary: 0.02 };
  const pick = () => {
    let r = Math.random(),
      rar = "common";
    for (const k of ["common", "rare", "epic", "legendary"]) {
      if (r < pool[k]) {
        rar = k;
        break;
      }
      r -= pool[k];
    }
    const list = SET.filter((c) => c.rarity === rar);
    return list[(Math.random() * list.length) | 0];
  };
  const deck = [];
  const used = {};
  while (deck.length < 8) {
    const c = pick();
    if ((used[c.id] || 0) >= 2) continue;
    used[c.id] = (used[c.id] || 0) + 1;
    deck.push(c);
  }
  // bias toward a playable curve: sort cheap-ish to the top of the deck
  return deck.sort((a, b) => a.cost - b.cost - (Math.random() * 4 - 2));
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const STYLE = `
.tcg { position:absolute; inset:0; overflow:hidden; color:#fff; font-family:inherit; }
.tcg-bg .enemy { position:absolute; top:0; left:0; right:0; height:50%; background:linear-gradient(180deg,#d9c486,#c2a45c); }
.tcg-bg .enemy:after { content:""; position:absolute; inset:0; background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.15),transparent 60%),repeating-linear-gradient(95deg,rgba(0,0,0,.04) 0 6px,transparent 6px 16px); }
.tcg-bg .mine { position:absolute; bottom:0; left:0; right:0; height:50%; background:linear-gradient(180deg,#5fa23a,#3c6f24); }
.tcg-bg .mine:after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(88deg,rgba(0,0,0,.05) 0 5px,transparent 5px 14px); }
.tcg-bg .split { position:absolute; top:calc(50% - 2px); left:0; right:0; height:4px; background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.1)); box-shadow:0 0 12px rgba(0,0,0,.45); }

.tcg-board { position:absolute; inset:0; z-index:1; display:flex; flex-direction:column; justify-content:center; gap:42px; }
.tcg-lane { display:flex; justify-content:center; gap:6px; min-height:92px; align-items:center; flex-wrap:wrap; padding:0 6px; }

.tcg-min { position:relative; width:62px; height:90px; border-radius:10px; padding:4px; background:linear-gradient(160deg,#30323d,#191a21); border:2px solid #485066; box-shadow:0 4px 9px rgba(0,0,0,.55); transition:transform .1s; }
.tcg-min.ready { border-color:#5fe08a; box-shadow:0 0 12px rgba(95,224,138,.6); }
.tcg-min.taunt { border-color:#e0c78f; }
.tcg-min.sel { transform:translateY(-6px) scale(1.05); border-color:#fff; box-shadow:0 0 14px #fff; }
.tcg-min.tgt { border-color:#ff6a5a; box-shadow:0 0 14px #ff6a5a; cursor:pointer; }
.tcg-min.shield { box-shadow:0 0 0 2px #cfe6ff, 0 4px 9px rgba(0,0,0,.55); }
.tcg-min .art { height:36px; border-radius:6px; background:linear-gradient(160deg,var(--a1),var(--a2)); display:grid; place-items:center; }
.tcg-min .art svg { width:24px; height:24px; fill:rgba(255,255,255,.9); }
.tcg-min .nm { font-size:7px; text-align:center; margin-top:2px; color:#cdd2dd; font-weight:700; white-space:nowrap; overflow:hidden; }
.tcg-kw { display:flex; flex-wrap:wrap; gap:2px; justify-content:center; margin-top:3px; min-height:11px; }
.tcg-chip { display:inline-flex; align-items:center; justify-content:center; font-size:7px; font-weight:800; padding:2px 4px; border-radius:4px; line-height:1; text-transform:uppercase; white-space:nowrap; }
.tcg-chip.taunt { background:#e0c78f; color:#2a1e08; } .tcg-chip.charge { background:#ffd75e; color:#4a3600; }
.tcg-chip.shield { background:#c2dcff; color:#11315f; } .tcg-chip.rush { background:#ff9a6b; color:#3a1300; }
.tcg-stat { position:absolute; bottom:-6px; width:22px; height:22px; display:grid; place-items:center; font-weight:800; font-size:12px; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); text-shadow:0 1px 2px #000; }
.tcg-stat.a { left:-5px; background:linear-gradient(160deg,#ffcf5a,#e8821e); } .tcg-stat.h { right:-5px; background:linear-gradient(160deg,#ff7a72,#d6342b); }

.tcg-hero { position:absolute; left:8px; right:8px; z-index:2; display:flex; align-items:center; gap:10px; }
.tcg-hero.foe { top:8px; } .tcg-hero.me { bottom:120px; }
.tcg-port { width:52px; height:52px; border-radius:50%; flex:0 0 auto; position:relative; background:radial-gradient(circle at 35% 30%,#6b7fd6,#2a2f6e); border:3px solid #cfd6ff; box-shadow:0 3px 8px rgba(0,0,0,.5); }
.tcg-port.foep { background:radial-gradient(circle at 35% 30%,#d66b8a,#6e2a3a); border-color:#ffd0dc; }
.tcg-port.tgt { border-color:#ff6a5a; box-shadow:0 0 16px #ff6a5a; cursor:pointer; }
.tcg-hp { position:absolute; bottom:-4px; right:-6px; width:26px; height:26px; border-radius:50%; background:#d6342b; border:2px solid #ff8a82; display:grid; place-items:center; font-weight:800; font-size:13px; }
.tcg-pill { background:rgba(20,22,28,.62); border-radius:12px; padding:4px 8px; }
.tcg-name { font-size:11px; color:#fff; font-weight:800; text-shadow:0 1px 2px #000; }
.tcg-mana { display:flex; gap:3px; margin-top:2px; }
.tcg-cry { width:13px; height:13px; border-radius:3px; transform:rotate(45deg); background:radial-gradient(circle at 35% 30%,#8fdcff,#1e6fb8); box-shadow:0 0 5px #2e9bdf; }
.tcg-cry.empty { background:#2a2f3a; box-shadow:none; }
.tcg-backs { display:flex; margin-left:auto; }
.tcg-back { width:22px; height:32px; border-radius:4px; margin-left:-12px; background:repeating-linear-gradient(45deg,#caa017,#caa017 4px,#a8830f 4px,#a8830f 8px); border:1px solid #ffe9a8; box-shadow:0 2px 4px rgba(0,0,0,.4); }

.tcg-hand { position:absolute; bottom:0; left:0; right:0; z-index:2; display:flex; justify-content:center; align-items:flex-end; height:112px; }
.tcg-hc { width:80px; height:108px; border-radius:11px; padding:5px; margin-left:-24px; background:linear-gradient(160deg,#30323d,#191a21); box-shadow:0 5px 12px rgba(0,0,0,.6); border:2px solid var(--rar,#9aa3b2); position:relative; transition:transform .1s; }
.tcg-hc:first-child { margin-left:0; }
.tcg-hc.playable { transform:translateY(-8px); }
.tcg-hc.playable:after { content:""; position:absolute; inset:-2px; border-radius:11px; box-shadow:0 0 0 2px rgba(255,215,94,.6); pointer-events:none; }
.tcg-hc.sel { transform:translateY(-16px); border-color:#fff; }
.tcg-hc.dim { opacity:.6; }
.tcg-hc .c { position:absolute; top:-7px; left:-7px; width:25px; height:25px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#8fdcff,#1e6fb8); border:2px solid #d6f0ff; display:grid; place-items:center; font-weight:800; font-size:13px; }
.tcg-hc .ca { height:44px; border-radius:7px; background:linear-gradient(160deg,var(--a1),var(--a2)); display:grid; place-items:center; }
.tcg-hc .ca svg { width:26px; height:26px; fill:rgba(255,255,255,.9); }
.tcg-hc .cn { font-size:8px; text-align:center; margin-top:4px; font-weight:800; white-space:nowrap; overflow:hidden; }
.tcg-hc .sa, .tcg-hc .sh { position:absolute; bottom:-5px; width:22px; height:22px; display:grid; place-items:center; font-weight:800; font-size:11px; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.tcg-hc .sa { left:-5px; background:linear-gradient(160deg,#ffcf5a,#e8821e); } .tcg-hc .sh { right:-5px; background:linear-gradient(160deg,#ff7a72,#d6342b); }
.tcg-hc .spl { position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); font-size:8px; font-weight:800; background:#444; padding:2px 5px; border-radius:5px; }

.tcg-toast { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:50; font-size:30px; font-weight:800; color:#fff; text-shadow:0 3px 12px rgba(0,0,0,.8); pointer-events:none; animation:tcg-toast 1.1s ease forwards; }
@keyframes tcg-toast { 0%{opacity:0;transform:translate(-50%,-30%) scale(.7);} 20%{opacity:1;transform:translate(-50%,-50%) scale(1.1);} 80%{opacity:1;} 100%{opacity:0;transform:translate(-50%,-70%);} }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  api.root.style.position = "relative";

  let S, sel, busy, over, gen = 0;
  let uidc = 0;

  const root = document.createElement("div");
  root.className = "tcg";
  api.root.append(root);
  api.onRestart(newGame);

  const other = (s) => (s === "you" ? "cpu" : "you");
  const findMin = (side, uid) => S.board[side].find((m) => m.uid === uid);
  const taunts = (side) => S.board[side].filter((m) => m.keywords.includes("taunt"));

  function makeMinion(card) {
    return {
      uid: ++uidc, name: card.name, rarity: card.rarity, glyph: card.id % GLYPHS.length,
      atk: card.atk, hp: card.hp, maxHp: card.hp,
      keywords: card.keywords.slice(), shield: card.keywords.includes("shield"),
      canAttack: card.keywords.includes("charge"), summoned: true,
    };
  }
  function token(atk, hp) {
    return { uid: ++uidc, name: "Warden", rarity: "common", glyph: 2, atk, hp, maxHp: hp, keywords: [], shield: false, canAttack: false, summoned: true };
  }

  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Wins", value: s.wins }, right: { label: "Streak", value: s.streak } });
  }
  function setFooter() {
    api.setFooter([{ icon: "▸", label: "End Turn", accent: true, disabled: busy || over || S.turn !== "you", onClick: endTurnByPlayer }]);
  }

  function newGame() {
    gen++;
    S = {
      turn: "you", over: false,
      hp: { you: 25, cpu: 25 },
      maxMana: { you: 0, cpu: 0 }, mana: { you: 0, cpu: 0 },
      deck: { you: shuffle(starterDeck()), cpu: randomDeck() },
      hand: { you: [], cpu: [] },
      board: { you: [], cpu: [] },
      fatigue: { you: 0, cpu: 0 },
    };
    sel = null; busy = false; over = false;
    for (let i = 0; i < 3; i++) draw("you");
    for (let i = 0; i < 4; i++) draw("cpu");
    startTurn("you");
    pills();
    setFooter();
    render();
  }

  function draw(side) {
    if (S.deck[side].length === 0) {
      S.fatigue[side]++;
      damageHero(side, S.fatigue[side]);
    } else {
      const c = S.deck[side].shift();
      if (S.hand[side].length < 10) S.hand[side].push(c);
    }
  }

  function startTurn(side) {
    S.turn = side;
    S.maxMana[side] = Math.min(8, S.maxMana[side] + 1);
    S.mana[side] = S.maxMana[side];
    draw(side);
    S.board[side].forEach((m) => { m.canAttack = true; m.summoned = false; });
  }

  function damageHero(side, amt) {
    S.hp[side] = Math.max(0, S.hp[side] - amt);
    if (S.hp[side] <= 0) endGame(side === "you" ? "cpu" : "you");
  }
  function damageMinion(m, amt) {
    if (amt <= 0) return;
    if (m.shield) { m.shield = false; return; }
    m.hp -= amt;
  }
  function cleanupDead() {
    for (const side of ["you", "cpu"]) S.board[side] = S.board[side].filter((m) => m.hp > 0);
  }

  function resolveEffect(eff, side, targetUid) {
    const foe = other(side);
    if (eff.kind === "damage") {
      if (targetUid === "hero") damageHero(foe, eff.amount);
      else { const m = findMin(foe, targetUid) || findMin(side, targetUid); if (m) damageMinion(m, eff.amount); }
    } else if (eff.kind === "damageFace") {
      damageHero(foe, eff.amount);
    } else if (eff.kind === "aoe") {
      S.board[foe].forEach((m) => damageMinion(m, eff.amount));
    } else if (eff.kind === "buff" || eff.kind === "buffRandom") {
      let m;
      if (eff.kind === "buffRandom") m = S.board[side][(Math.random() * S.board[side].length) | 0];
      else m = findMin(side, targetUid);
      if (m) { m.atk += eff.atk; m.hp += eff.hp; m.maxHp += eff.hp; }
    } else if (eff.kind === "heal") {
      S.hp[side] = Math.min(25, S.hp[side] + eff.amount);
    } else if (eff.kind === "draw") {
      for (let i = 0; i < eff.count; i++) draw(side);
    } else if (eff.kind === "summon") {
      for (let i = 0; i < eff.count && S.board[side].length < 7; i++) S.board[side].push(token(eff.atk, eff.hp));
    }
    cleanupDead();
  }

  function spellNeedsTarget(card) {
    return card.type === "spell" && (card.effect.kind === "damage" || card.effect.kind === "buff");
  }

  function playCard(side, idx, targetUid) {
    const card = S.hand[side][idx];
    if (!card || card.cost > S.mana[side]) return false;
    if (card.type === "minion" && S.board[side].length >= 7) return false;
    S.mana[side] -= card.cost;
    S.hand[side].splice(idx, 1);
    if (card.type === "minion") {
      S.board[side].push(makeMinion(card));
      if (card.battlecry) resolveEffect(card.battlecry, side, null);
    } else {
      resolveEffect(card.effect, side, targetUid);
    }
    cleanupDead();
    return true;
  }

  function doAttack(side, attUid, targetUid) {
    const att = findMin(side, attUid);
    if (!att || !att.canAttack) return;
    const foe = other(side);
    const ta = taunts(foe);
    if (targetUid === "hero") {
      if (ta.length) return;
      damageHero(foe, att.atk);
    } else {
      const def = findMin(foe, targetUid);
      if (!def) return;
      if (ta.length && !def.keywords.includes("taunt")) return;
      const ad = att.atk, dd = def.atk;
      damageMinion(def, ad);
      damageMinion(att, dd);
    }
    att.canAttack = false;
    cleanupDead();
  }

  function endGame(winner) {
    if (over) return;
    over = true; S.over = true; busy = true;
    sel = null;
    setFooter();
    if (winner === "you") api.reportWin(); else api.reportLoss();
    pills();
    render();
    toast(winner === "you" ? "Victory!" : "Defeat");
    const g = gen;
    setTimeout(() => {
      if (gen !== g) return;
      api.showModal({
        title: winner === "you" ? "Victory!" : "Defeat",
        message: winner === "you" ? "You crushed the enemy commander." : "Your hero has fallen.",
        statsRows: [
          { label: "Wins", value: api.refreshStats().wins },
          { label: "Streak", value: api.refreshStats().streak },
        ],
        primaryLabel: "Battle Again",
        onPrimary: newGame,
      });
    }, 900);
  }

  /* ---------- player interaction ---------- */
  function onHand(idx) {
    if (busy || over || S.turn !== "you") return;
    const card = S.hand.you[idx];
    if (!card || card.cost > S.mana.you) return;
    if (card.type === "minion" && S.board.you.length >= 7) return;
    if (spellNeedsTarget(card)) {
      if (card.effect.kind === "buff" && S.board.you.length === 0) return;
      sel = sel && sel.t === "spell" && sel.idx === idx ? null : { t: "spell", idx };
      render();
    } else {
      playCard("you", idx, null);
      sel = null;
      afterPlayerAction();
    }
  }

  function onMinion(side, uid) {
    if (busy || over || S.turn !== "you") return;
    if (side === "you") {
      if (sel && sel.t === "spell") {
        const card = S.hand.you[sel.idx];
        if (card && card.effect.kind === "buff") { playCard("you", sel.idx, uid); sel = null; afterPlayerAction(); }
        return;
      }
      const m = findMin("you", uid);
      if (m && m.canAttack) { sel = sel && sel.t === "atk" && sel.uid === uid ? null : { t: "atk", uid }; render(); }
    } else {
      if (sel && sel.t === "atk") {
        const ta = taunts("cpu");
        const okT = !ta.length || findMin("cpu", uid).keywords.includes("taunt");
        if (okT) { doAttack("you", sel.uid, uid); sel = null; afterPlayerAction(); }
      } else if (sel && sel.t === "spell" && S.hand.you[sel.idx].effect.kind === "damage") {
        playCard("you", sel.idx, uid); sel = null; afterPlayerAction();
      }
    }
  }

  function onHero(side) {
    if (busy || over || S.turn !== "you") return;
    if (side !== "cpu") return;
    if (sel && sel.t === "atk") {
      if (!taunts("cpu").length) { doAttack("you", sel.uid, "hero"); sel = null; afterPlayerAction(); }
    } else if (sel && sel.t === "spell" && S.hand.you[sel.idx].effect.kind === "damage") {
      playCard("you", sel.idx, "hero"); sel = null; afterPlayerAction();
    }
  }

  function afterPlayerAction() {
    setFooter();
    render();
  }

  function endTurnByPlayer() {
    if (busy || over || S.turn !== "you") return;
    sel = null;
    cpuTurn();
  }

  /* ---------- CPU ---------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function cpuTurn() {
    busy = true; setFooter();
    startTurn("cpu");
    render();
    const myGen = gen;
    await wait(550);
    if (gen !== myGen || over) return;

    // play phase
    let acted = true, guard = 0;
    while (acted && guard++ < 30) {
      acted = false;
      const hand = S.hand.cpu;
      // play the most expensive affordable minion first
      let bestI = -1, bestCost = -1;
      for (let i = 0; i < hand.length; i++) {
        const c = hand[i];
        if (c.cost > S.mana.cpu) continue;
        if (c.type === "minion" && S.board.cpu.length < 7 && c.cost > bestCost) { bestI = i; bestCost = c.cost; }
      }
      if (bestI >= 0) { playCard("cpu", bestI, null); acted = true; render(); await wait(500); if (gen !== myGen || over) return; continue; }
      // otherwise try a spell
      for (let i = 0; i < hand.length; i++) {
        const c = hand[i];
        if (c.type !== "spell" || c.cost > S.mana.cpu) continue;
        const tgt = cpuSpellTarget(c);
        if (tgt === undefined) continue;
        playCard("cpu", i, tgt); acted = true; render(); await wait(500); if (gen !== myGen || over) return; break;
      }
    }

    // attack phase
    for (const m of [...S.board.cpu]) {
      if (over) break;
      if (!S.board.cpu.includes(m) || !m.canAttack) continue;
      const tgt = cpuAttackTarget(m);
      if (tgt == null) continue;
      doAttack("cpu", m.uid, tgt);
      render();
      await wait(480);
      if (gen !== myGen || over) return;
    }

    if (gen !== myGen || over) return;
    startTurn("you");
    busy = false;
    setFooter();
    render();
  }

  function cpuSpellTarget(c) {
    const e = c.effect;
    if (e.kind === "damage") {
      const kill = S.board.you.find((m) => m.hp <= e.amount && !m.shield);
      if (kill) return kill.uid;
      if (S.board.you.length) return S.board.you[0].uid;
      return "hero";
    }
    if (e.kind === "buff") {
      if (!S.board.cpu.length) return undefined;
      return S.board.cpu.slice().sort((a, b) => b.atk - a.atk)[0].uid;
    }
    return null; // aoe / heal / draw — no target
  }

  function cpuAttackTarget(m) {
    const ta = taunts("you");
    if (ta.length) {
      const kill = ta.find((t) => t.hp <= m.atk && !t.shield);
      return (kill || ta.slice().sort((a, b) => a.hp - b.hp)[0]).uid;
    }
    // favourable trade: kill a minion it survives
    const trade = S.board.you.find((d) => d.hp <= m.atk && !d.shield && d.atk < m.hp);
    if (trade) return trade.uid;
    return "hero";
  }

  /* ---------- rendering ---------- */
  function svgGlyph(side, glyph) {
    return `<svg viewBox="0 0 100 100">${GLYPHS[glyph]}</svg>`;
  }
  function chips(keywords) {
    return keywords
      .filter((k) => KW_LABEL[k])
      .map((k) => `<span class="tcg-chip ${k}">${KW_LABEL[k]}</span>`)
      .join("");
  }

  function minionEl(side, m) {
    const el = document.createElement("div");
    let cls = "tcg-min";
    if (m.keywords.includes("taunt")) cls += " taunt";
    if (m.shield) cls += " shield";
    if (side === "you" && m.canAttack && S.turn === "you" && !busy) cls += " ready";
    if (sel && sel.t === "atk" && sel.uid === m.uid) cls += " sel";
    // target highlight
    if (sel && side === "cpu") {
      if (sel.t === "atk") {
        const ta = taunts("cpu");
        if (!ta.length || m.keywords.includes("taunt")) cls += " tgt";
      } else if (sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "damage") cls += " tgt";
    }
    if (sel && side === "you" && sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "buff") cls += " tgt";
    el.className = cls;
    el.innerHTML =
      `<div class="art" style="--a1:${RARITY[m.rarity].a1};--a2:${RARITY[m.rarity].a2}">${svgGlyph(side, m.glyph)}</div>` +
      `<div class="nm">${m.name}</div><div class="tcg-kw">${chips(m.keywords)}</div>` +
      `<div class="tcg-stat a">${m.atk}</div><div class="tcg-stat h">${m.hp}</div>`;
    el.addEventListener("click", () => onMinion(side, m.uid));
    return el;
  }

  function heroBar(side) {
    const me = side === "you";
    const bar = document.createElement("div");
    bar.className = "tcg-hero " + (me ? "me" : "foe");
    const port = document.createElement("div");
    port.className = "tcg-port" + (me ? "" : " foep");
    if (!me && sel && (sel.t === "atk" ? !taunts("cpu").length : sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "damage")) port.classList.add("tgt");
    port.innerHTML = `<div class="tcg-hp">${S.hp[side]}</div>`;
    port.addEventListener("click", () => onHero(side));
    const info = document.createElement("div");
    info.innerHTML = `<div class="tcg-name">${me ? "You" : "Commander"}</div>`;
    const mana = document.createElement("div");
    mana.className = "tcg-mana";
    for (let i = 0; i < Math.max(S.maxMana[side], 1); i++) {
      const c = document.createElement("div");
      c.className = "tcg-cry" + (i < S.mana[side] ? "" : " empty");
      mana.append(c);
    }
    info.append(mana);
    bar.append(port, info);
    if (!me) {
      const backs = document.createElement("div");
      backs.className = "tcg-backs";
      for (let i = 0; i < S.hand.cpu.length; i++) { const b = document.createElement("div"); b.className = "tcg-back"; backs.append(b); }
      bar.append(backs);
    }
    return bar;
  }

  function handEl() {
    const wrap = document.createElement("div");
    wrap.className = "tcg-hand";
    S.hand.you.forEach((card, idx) => {
      const el = document.createElement("div");
      const affordable = card.cost <= S.mana.you && S.turn === "you" && !busy && (card.type !== "minion" || S.board.you.length < 7);
      let cls = "tcg-hc";
      if (affordable) cls += " playable"; else cls += " dim";
      if (sel && sel.t === "spell" && sel.idx === idx) cls += " sel";
      el.className = cls;
      el.style.setProperty("--rar", RARITY[card.rarity].color);
      const stats = card.type === "minion"
        ? `<div class="sa">${card.atk}</div><div class="sh">${card.hp}</div>`
        : `<div class="spl">SPELL</div>`;
      el.innerHTML =
        `<div class="c">${card.cost}</div>` +
        `<div class="ca" style="--a1:${RARITY[card.rarity].a1};--a2:${RARITY[card.rarity].a2}">${svgGlyph("you", card.id % GLYPHS.length)}</div>` +
        `<div class="cn">${card.name}</div><div class="tcg-kw">${chips(card.keywords)}</div>${stats}`;
      el.style.zIndex = idx;
      el.addEventListener("click", () => onHand(idx));
      wrap.append(el);
    });
    return wrap;
  }

  function render() {
    const bg = `<div class="tcg-bg"><div class="enemy"></div><div class="mine"></div><div class="split"></div></div>`;
    root.innerHTML = bg;
    const board = document.createElement("div");
    board.className = "tcg-board";
    const eLane = document.createElement("div"); eLane.className = "tcg-lane";
    S.board.cpu.forEach((m) => eLane.append(minionEl("cpu", m)));
    const mLane = document.createElement("div"); mLane.className = "tcg-lane";
    S.board.you.forEach((m) => mLane.append(minionEl("you", m)));
    board.append(eLane, mLane);
    root.append(board, heroBar("cpu"), heroBar("you"), handEl());
  }

  function toast(text) {
    const t = document.createElement("div");
    t.className = "tcg-toast";
    t.textContent = text;
    root.append(t);
    setTimeout(() => t.remove(), 1100);
  }

  newGame();
  return {
    destroy() {
      gen++;
      api.root.style.position = "";
      style.remove();
    },
  };
}
