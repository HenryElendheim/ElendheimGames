/* ============================================================
   Elendheim TCG — full game.
   Menu hub · infinite vs-CPU duels · Heimers economy · packs with
   one-at-a-time reveals · collection · 8-card deck-builder · duplicate
   card levelling · Commander Level + unlockable battlefields.
   Everything persists in localStorage (key eg:tcg:save). Wins/streak
   also flow through the shared stats so the home tile updates.

   Card art: each card shows a placeholder glyph until a real picture is
   added (cards carry an id, so art can be slotted in later).
   ============================================================ */

const LABEL = { common: "Troop", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY = {
  common: { color: "#9aa3b2", a1: "#6b7280", a2: "#3a3f4a", rank: 0 },
  rare: { color: "#4f91ff", a1: "#3a6fd8", a2: "#16306e", rank: 1 },
  epic: { color: "#b06bff", a1: "#7b3fd0", a2: "#3a1873", rank: 2 },
  legendary: { color: "#ffb83d", a1: "#f5a623", a2: "#7a4d00", rank: 3 },
};
const KW_LABEL = { taunt: "Taunt", charge: "Charge", shield: "Shield", rush: "Rush", death: "Deathrattle" };
const KW_DESC = {
  taunt: "Taunt — enemies must attack this minion first.",
  charge: "Charge — can attack the turn it's played.",
  shield: "Divine Shield — ignores the first damage it takes.",
  rush: "Rush — can attack minions immediately.",
  death: "Deathrattle — triggers an effect when it dies.",
};
function effectText(e) {
  if (!e) return "";
  switch (e.kind) {
    case "damage": return `Deal ${e.amount} damage.`;
    case "damageFace": return `Deal ${e.amount} damage to the enemy hero.`;
    case "aoe": return `Deal ${e.amount} damage to all enemy minions.`;
    case "buff": return `Give a friendly minion +${e.atk}/+${e.hp}.`;
    case "buffRandom": return `Give a random friendly minion +${e.atk}/+${e.hp}.`;
    case "heal": return `Restore ${e.amount} health to your hero.`;
    case "draw": return `Draw ${e.count} card${e.count > 1 ? "s" : ""}.`;
    case "summon": return `Summon ${e.count} ${e.atk}/${e.hp} Warden${e.count > 1 ? "s" : ""}.`;
    default: return "";
  }
}
const GLYPHS = [
  `<path d="M50 18l10 22 24 2-18 16 6 24-22-13-22 13 6-24-18-16 24-2z"/>`,
  `<path d="M50 16l30 10v22c0 18-14 28-30 36-16-8-30-18-30-36V26z"/>`,
  `<circle cx="50" cy="50" r="30"/>`,
  `<path d="M50 18l32 56H18z"/>`,
  `<path d="M50 16l34 34-34 34-34-34z"/>`,
];

const FIELDS = {
  grass: { name: "Grass", css: "linear-gradient(180deg,#5fa23a,#3c6f24)", unlock: 1 },
  sand: { name: "Sand", css: "linear-gradient(180deg,#d9c486,#c2a45c)", unlock: 1 },
  snow: { name: "Snowfield", css: "linear-gradient(180deg,#e9f1f7,#b9cad8)", unlock: 2 },
  lava: { name: "Emberwaste", css: "linear-gradient(180deg,#7a1c14,#2a0a08)", unlock: 3 },
  stone: { name: "Stonehall", css: "linear-gradient(180deg,#6b7180,#3a3f4a)", unlock: 4 },
  marsh: { name: "Mire", css: "linear-gradient(180deg,#4a6b4a,#243a2c)", unlock: 5 },
};
const FIELD_ORDER = ["grass", "sand", "snow", "lava", "stone", "marsh"];

const PACK_COST = 100;
const PACK_SIZE = 8;
const XP_PER_LEVEL = 300;

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
  for (let i = 0; i < 21; i++) {
    const cost = 1 + (i % 6), budget = cost * 2 + 1, atk = Math.max(1, Math.round(budget * 0.55));
    const kw = [];
    if (i % 7 === 5) kw.push("taunt");
    if (cost <= 3 && i % 8 === 2) kw.push("charge");
    minion("common", cost, atk, Math.max(1, budget - atk), kw);
  }
  spell("common", 1, { kind: "damage", amount: 2 });
  spell("common", 2, { kind: "buff", atk: 1, hp: 2 });
  spell("common", 3, { kind: "aoe", amount: 1 });
  for (let i = 0; i < 12; i++) {
    const cost = 1 + (i % 6), budget = cost * 2 + 2, atk = Math.max(1, Math.round(budget * 0.55));
    const kw = [];
    if (i % 4 === 1) kw.push("taunt");
    if (i % 5 === 3 && cost <= 4) kw.push("charge");
    if (i % 6 === 0) kw.push("shield");
    minion("rare", cost, atk, Math.max(1, budget - atk), kw);
  }
  spell("rare", 2, { kind: "damage", amount: 3 });
  spell("rare", 3, { kind: "draw", count: 2 });
  spell("rare", 4, { kind: "aoe", amount: 2 });
  const epicBC = [
    { kind: "summon", atk: 2, hp: 2, count: 1 }, { kind: "aoe", amount: 2 },
    { kind: "buffRandom", atk: 2, hp: 2 }, { kind: "draw", count: 1 },
    { kind: "damageFace", amount: 3 }, { kind: "summon", atk: 1, hp: 1, count: 2 },
  ];
  for (let i = 0; i < 6; i++) {
    const cost = 3 + (i % 4), budget = cost * 2 + 3, atk = Math.max(1, Math.round(budget * 0.5));
    minion("epic", cost, atk, Math.max(1, budget - atk), i % 2 === 0 ? ["taunt"] : [], epicBC[i]);
  }
  spell("epic", 5, { kind: "damage", amount: 6 });
  spell("epic", 4, { kind: "aoe", amount: 3 });
  minion("legendary", 7, 6, 6, [], { kind: "summon", atk: 2, hp: 2, count: 2 });
  minion("legendary", 6, 5, 5, ["taunt"], { kind: "aoe", amount: 3 });
  minion("legendary", 8, 8, 8, ["charge"], null);
  return cards;
}
const SET = buildSet();
// sprinkle Deathrattle onto a few minions (stable ids)
(function addDeathrattles() {
  const give = (card, dr) => { if (card) { card.deathrattle = dr; if (!card.keywords.includes("death")) card.keywords = [...card.keywords, "death"]; } };
  const rares = SET.filter((c) => c.rarity === "rare" && c.type === "minion");
  give(rares[0], { kind: "aoe", amount: 1 });
  give(rares[1], { kind: "summon", atk: 1, hp: 1, count: 1 });
  give(SET.filter((c) => c.rarity === "epic" && c.type === "minion")[2], { kind: "summon", atk: 2, hp: 2, count: 1 });
  give(SET.filter((c) => c.rarity === "legendary" && c.type === "minion")[2], { kind: "damageFace", amount: 4 });
})();
// a couple of healer minions (drag onto a friendly minion to heal it; never themselves)
(function addHealers() {
  const make = (card, amt) => { if (card) { card.heal = amt; card.atk = Math.max(1, card.atk - 2); } };
  make(SET.filter((c) => c.rarity === "rare" && c.type === "minion" && !c.deathrattle)[0], 3);
  make(SET.filter((c) => c.rarity === "epic" && c.type === "minion")[3], 4);
})();

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const rollRarity = () => {
  let r = Math.random();
  if (r < 0.02) return "legendary";
  if (r < 0.1) return "epic";
  if (r < 0.4) return "rare";
  return "common";
};
const rollCard = () => {
  const list = SET.filter((c) => c.rarity === rollRarity());
  return list[(Math.random() * list.length) | 0];
};
function openPackCards() {
  const cards = [];
  for (let i = 0; i < PACK_SIZE; i++) cards.push(rollCard());
  if (!cards.some((c) => c.rarity !== "common")) {
    const rares = SET.filter((c) => c.rarity === "rare");
    cards[PACK_SIZE - 1] = rares[(Math.random() * rares.length) | 0];
  }
  return cards;
}
function randomDeck() {
  const deck = [], used = {};
  while (deck.length < 8) {
    const c = rollCard();
    if ((used[c.id] || 0) >= 1) continue;
    used[c.id] = 1;
    deck.push(c);
  }
  return deck.sort((a, b) => a.cost - b.cost - (Math.random() * 4 - 2));
}

const SAVE_KEY = "eg:tcg:save";
const DEFAULT_SAVE = { heimers: 200, collection: {}, deck: [], xp: 0, fields: ["grass", "sand"], equipped: "grass" };

const STYLE = `
.game-screen .game-header, .game-screen .game-footer { display:none !important; }
.tcg { position:absolute; inset:0; overflow:hidden; color:#fff; font-family:inherit; -webkit-tap-highlight-color:transparent; }
.tcg-scroll { position:absolute; inset:0; overflow-y:auto; }

.tcg-top { display:flex; align-items:center; gap:12px; padding:14px 14px 6px; }
.tcg-back { width:40px; height:40px; flex:0 0 auto; border:none; border-radius:50%; background:#1c1d24; display:grid; place-items:center; }
.tcg-back svg { width:23px; height:23px; }
.tcg-title { font-size:19px; font-weight:800; margin-right:auto; }
.tcg-title b { color:#ffb83d; }
.tcg-coin { display:flex; align-items:center; gap:7px; background:#1c1d24; border:1px solid #3a3f4a; padding:6px 12px; border-radius:20px; font-weight:800; font-size:14px; }
.tcg-coin .c { width:22px; height:22px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#ffe08a,#c9981a); display:grid; place-items:center; font-size:12px; color:#5a3a00; border:1px solid #ffe9b0; }

.tcg-menu { padding:0 16px 24px; }
.tcg-lvl { margin-top:10px; background:#1a1b22; border:1px solid #2c2f3a; border-radius:14px; padding:10px 14px; }
.tcg-lvl .r { display:flex; justify-content:space-between; font-size:12px; margin-bottom:7px; }
.tcg-lvl .r b { font-size:13px; } .tcg-lvl .r span { color:#9aa3b2; }
.tcg-bar { height:8px; border-radius:5px; background:#2a2f3a; overflow:hidden; }
.tcg-bar i { display:block; height:100%; background:linear-gradient(90deg,#ffcf5a,#e8821e); }
.tcg-battle { width:100%; margin-top:14px; border:none; border-radius:20px; padding:18px; color:#3a2400; text-align:left; background:linear-gradient(135deg,#ffd75e,#e8821e); box-shadow:0 8px 22px rgba(232,130,30,.35); display:flex; align-items:center; gap:14px; }
.tcg-battle:disabled { filter:grayscale(.7) brightness(.8); }
.tcg-battle .ic { width:50px; height:50px; flex:0 0 auto; }
.tcg-battle .t b { font-size:21px; font-weight:800; display:block; } .tcg-battle .t span { font-size:12px; font-weight:700; opacity:.8; }
.tcg-battle .go { margin-left:auto; font-size:26px; font-weight:800; }
.tcg-grid { margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.tcg-tile { background:#1a1b22; border:1px solid #2c2f3a; border-radius:18px; padding:15px; display:flex; flex-direction:column; gap:7px; min-height:104px; text-align:left; color:#fff; position:relative; }
.tcg-tile .ic { width:38px; height:38px; } .tcg-tile b { font-size:15px; font-weight:800; } .tcg-tile span { font-size:11px; color:#9aa3b2; font-weight:700; }
.tcg-tile.shop { border-color:#5a3a7a; background:linear-gradient(160deg,#241a36,#16121f); }
.tcg-tile .n { position:absolute; top:-8px; right:-6px; background:#ef5350; color:#fff; font-size:10px; font-weight:800; border-radius:10px; padding:2px 7px; }
.tcg-foot { display:flex; justify-content:space-around; padding:18px 0 6px; margin-top:16px; border-top:1px solid #20222b; }
.tcg-foot .s { text-align:center; } .tcg-foot .s b { font-size:18px; font-weight:800; display:block; } .tcg-foot .s span { font-size:10px; color:#9aa3b2; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.tcg-sword { stroke:#3a2400; stroke-width:7; stroke-linecap:round; fill:none; }

/* generic card face (collection / deck / reveal) */
.tcg-card { position:relative; border-radius:13px; padding:6px; background:linear-gradient(160deg,#30323d,#191a21); border:2px solid var(--rar,#9aa3b2); }
.tcg-card.g { box-shadow:0 0 16px var(--rar); }
.tcg-card .cc { position:absolute; top:-7px; left:-7px; width:26px; height:26px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#8fdcff,#1e6fb8); border:2px solid #d6f0ff; display:grid; place-items:center; font-weight:800; font-size:13px; z-index:2; }
.tcg-card .lv { position:absolute; top:-7px; right:6px; font-size:12px; color:#ffd75e; text-shadow:0 1px 2px #000; z-index:2; letter-spacing:-1px; }
.tcg-card .ca { border-radius:8px; background:linear-gradient(160deg,var(--a1),var(--a2)); display:grid; place-items:center; }
.tcg-card .ca svg { width:46%; height:46%; fill:rgba(255,255,255,.92); }
.tcg-card .cn { font-size:10px; font-weight:800; text-align:center; margin-top:5px; white-space:nowrap; overflow:hidden; }
.tcg-card .ck { display:flex; gap:2px; justify-content:center; margin-top:3px; flex-wrap:wrap; min-height:10px; }
.tcg-card .cs { position:absolute; bottom:-7px; width:26px; height:26px; display:grid; place-items:center; font-weight:800; font-size:13px; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); text-shadow:0 1px 2px #000; }
.tcg-card .cs.a { left:-6px; background:linear-gradient(160deg,#ffcf5a,#e8821e); } .tcg-card .cs.h { right:-6px; background:linear-gradient(160deg,#ff7a72,#d6342b); }
.tcg-card .cspl { position:absolute; bottom:-5px; left:50%; transform:translateX(-50%); font-size:8px; font-weight:800; background:#444; padding:2px 6px; border-radius:5px; }
.tcg-card.locked { opacity:.4; filter:grayscale(.8); }
.tcg-chip { display:inline-flex; align-items:center; justify-content:center; font-size:7px; font-weight:800; padding:2px 4px; border-radius:4px; line-height:1; text-transform:uppercase; white-space:nowrap; }
.tcg-chip.taunt { background:#e0c78f; color:#2a1e08; } .tcg-chip.charge { background:#ffd75e; color:#4a3600; }
.tcg-chip.shield { background:#c2dcff; color:#11315f; } .tcg-chip.rush { background:#ff9a6b; color:#3a1300; }

.tcg-collgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:8px 14px 24px; }
.tcg-collgrid .tcg-card { width:100%; }
.tcg-collgrid .ca { height:64px; }
.tcg-hint { text-align:center; color:#9aa3b2; font-size:12px; padding:4px 16px 12px; }
.tcg-deck.full .tcg-card.in { border-color:#5fe08a; box-shadow:0 0 12px rgba(95,224,138,.5); }
.tcg-card.in:after { content:"✓"; position:absolute; top:2px; right:4px; color:#5fe08a; font-weight:800; font-size:14px; z-index:3; }

/* shop / pack */
.tcg-shop { display:flex; flex-direction:column; align-items:center; justify-content:center; height:calc(100% - 70px); gap:24px; }
.tcg-pack { position:relative; width:150px; height:210px; border-radius:16px; background:linear-gradient(155deg,#8b5cf6,#3a1873); border:3px solid #c9b6ff; box-shadow:0 0 40px rgba(150,110,240,.55),inset 0 2px 0 rgba(255,255,255,.3); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
.tcg-pack .seal { width:60px; height:60px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#ffe08a,#c9981a); border:3px solid #fff2cf; display:grid; place-items:center; }
.tcg-pack .seal svg { width:34px; height:34px; fill:#5a3a00; }
.tcg-pack .pn { font-size:15px; font-weight:800; color:#f3ecff; letter-spacing:.04em; text-align:center; }
.tcg-pack .pn small { display:block; font-size:9px; color:#cbb9ff; letter-spacing:.1em; }
.tcg-buy { border:none; border-radius:16px; padding:14px 22px; font-weight:800; font-size:15px; background:linear-gradient(160deg,#ffcf5a,#e8821e); color:#3a2400; }
.tcg-buy:disabled { filter:grayscale(.7) brightness(.8); }
.tcg-shopmsg { color:#9aa3b2; font-size:12px; font-weight:700; }

.tcg-reveal { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:radial-gradient(circle at 50% 42%,var(--glow,#3a2f12),#0c0e14 72%); }
.tcg-dots { position:absolute; top:18px; display:flex; gap:8px; }
.tcg-dot { width:9px; height:9px; border-radius:50%; background:#3a3f4a; } .tcg-dot.on { background:#ffd75e; box-shadow:0 0 7px #ffd75e; }
.tcg-rib { font-size:22px; font-weight:800; letter-spacing:.12em; text-shadow:0 0 16px currentColor; animation:tcg-pop .4s ease; }
.tcg-bigcard { animation:tcg-flip .4s ease; }
.tcg-rays { position:absolute; width:340px; height:340px; border-radius:50%; opacity:.5; animation:tcg-spin 8s linear infinite; }
.tcg-tag { font-size:11px; font-weight:800; padding:3px 10px; border-radius:10px; }
.tcg-tag.new { background:#1f6b3a; color:#bfffd2; } .tcg-tag.up { background:#7a5a12; color:#ffe08a; }
.tcg-revhint { color:#cbb9a0; font-size:12px; font-weight:700; }
.tcg-sumgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:0 14px; }
.tcg-row { display:flex; gap:12px; padding:14px; }
.tcg-row button { flex:1; border:none; border-radius:14px; padding:13px; font-weight:800; font-size:14px; }
.tcg-row .again { background:#16181f; color:#ffd75e; border:1px solid #3a3f4a; }
.tcg-row .again:disabled { opacity:.5; }
.tcg-row .collect { background:linear-gradient(160deg,#ffcf5a,#e8821e); color:#3a2400; }
@keyframes tcg-flip { from{transform:rotateY(90deg) scale(.8);opacity:0;} to{transform:none;opacity:1;} }
@keyframes tcg-pop { 0%{transform:scale(.5);opacity:0;} 60%{transform:scale(1.12);} 100%{transform:scale(1);opacity:1;} }
@keyframes tcg-spin { to{transform:rotate(360deg);} }
@keyframes tcg-spark { 0%{transform:translateY(0) scale(1);opacity:1;} 100%{transform:translateY(-90px) scale(.2);opacity:0;} }
.tcg-spark { position:absolute; width:8px; height:8px; border-radius:50%; background:#ffe08a; box-shadow:0 0 8px #ffd75e; animation:tcg-spark .9s ease-out forwards; }

/* battlefields */
.tcg-fgrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:8px 14px 24px; }
.tcg-field { border-radius:14px; overflow:hidden; border:2px solid #2a2f3a; }
.tcg-field.eq { border-color:#5fe08a; box-shadow:0 0 14px rgba(95,224,138,.4); }
.tcg-field .sw { height:70px; position:relative; }
.tcg-field .nm { padding:7px 10px; font-size:12px; font-weight:800; background:#1b1c22; display:flex; justify-content:space-between; align-items:center; }
.tcg-field .lock { position:absolute; inset:0; background:rgba(10,11,14,.62); display:grid; place-items:center; font-size:11px; color:#ffd75e; font-weight:800; }
.tcg-bdg { font-size:9px; font-weight:800; padding:2px 7px; border-radius:8px; } .tcg-bdg.eq { background:#1f6b3a; color:#bfffd2; } .tcg-bdg.un { background:#2a2f3a; color:#9aa3b2; }

/* duel */
.tcg-bg .enemy, .tcg-bg .mine { position:absolute; left:0; right:0; height:50%; }
.tcg-bg .enemy { top:0; } .tcg-bg .mine { bottom:0; }
.tcg-bg .split { position:absolute; top:calc(50% - 2px); left:0; right:0; height:4px; background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.1)); box-shadow:0 0 12px rgba(0,0,0,.45); z-index:1; }
.tcg-board { position:absolute; inset:0; z-index:1; display:flex; flex-direction:column; justify-content:center; gap:42px; }
.tcg-lane { display:flex; justify-content:center; gap:6px; min-height:90px; align-items:center; flex-wrap:wrap; padding:0 4px; }
.tcg-min { position:relative; width:60px; height:88px; border-radius:10px; padding:4px; background:linear-gradient(160deg,#30323d,#191a21); border:2px solid #485066; box-shadow:0 4px 9px rgba(0,0,0,.55); transition:transform .1s; }
.tcg-min.ready { border-color:#5fe08a; box-shadow:0 0 12px rgba(95,224,138,.6); }
.tcg-min.taunt { border-color:#e0c78f; }
.tcg-min.sel { transform:translateY(-6px) scale(1.05); border-color:#fff; box-shadow:0 0 14px #fff; }
.tcg-min.tgt { border-color:#ff6a5a; box-shadow:0 0 14px #ff6a5a; }
.tcg-min.shieldon { box-shadow:0 0 0 2px #cfe6ff, 0 4px 9px rgba(0,0,0,.55); }
.tcg-min .art { height:34px; border-radius:6px; background:linear-gradient(160deg,var(--a1),var(--a2)); display:grid; place-items:center; }
.tcg-min .art svg { width:22px; height:22px; fill:rgba(255,255,255,.9); }
.tcg-min .nm { font-size:7px; text-align:center; margin-top:2px; color:#cdd2dd; font-weight:700; white-space:nowrap; overflow:hidden; }
.tcg-mk { display:flex; flex-wrap:wrap; gap:2px; justify-content:center; margin-top:3px; min-height:10px; }
.tcg-st { position:absolute; bottom:-6px; width:22px; height:22px; display:grid; place-items:center; font-weight:800; font-size:12px; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); text-shadow:0 1px 2px #000; }
.tcg-st.a { left:-5px; background:linear-gradient(160deg,#ffcf5a,#e8821e); } .tcg-st.h { right:-5px; background:linear-gradient(160deg,#ff7a72,#d6342b); }
.tcg-hero { position:absolute; left:8px; right:8px; z-index:2; display:flex; align-items:center; gap:10px; }
.tcg-hero.me { bottom:118px; }
.tcg-hero.foe { top:10px; left:0; right:0; flex-direction:column; align-items:center; gap:3px; }
.tcg-hero.foe .tcg-nm2 { text-align:center; }
.tcg-hero.foe .tcg-mana { justify-content:center; }
.tcg-fbacks { position:absolute; top:12px; right:10px; z-index:2; display:flex; }
.tcg-port { width:52px; height:52px; border-radius:50%; flex:0 0 auto; position:relative; background:radial-gradient(circle at 35% 30%,#6b7fd6,#2a2f6e); border:3px solid #cfd6ff; box-shadow:0 3px 8px rgba(0,0,0,.5); }
.tcg-port.foep { background:radial-gradient(circle at 35% 30%,#d66b8a,#6e2a3a); border-color:#ffd0dc; }
.tcg-port.tgt { border-color:#ff6a5a; box-shadow:0 0 16px #ff6a5a; }
.tcg-hp { position:absolute; bottom:-4px; right:-6px; width:26px; height:26px; border-radius:50%; background:#d6342b; border:2px solid #ff8a82; display:grid; place-items:center; font-weight:800; font-size:13px; }
.tcg-pill { background:rgba(20,22,28,.62); border-radius:12px; padding:4px 8px; }
.tcg-nm2 { font-size:11px; color:#fff; font-weight:800; text-shadow:0 1px 2px #000; }
.tcg-mana { display:flex; gap:3px; margin-top:2px; } .tcg-cry { width:13px; height:13px; border-radius:3px; transform:rotate(45deg); background:radial-gradient(circle at 35% 30%,#8fdcff,#1e6fb8); box-shadow:0 0 5px #2e9bdf; } .tcg-cry.empty { background:#2a2f3a; box-shadow:none; }
.tcg-backs { display:flex; margin-left:auto; } .tcg-bk { width:22px; height:32px; border-radius:4px; margin-left:-12px; background:repeating-linear-gradient(45deg,#caa017,#caa017 4px,#a8830f 4px,#a8830f 8px); border:1px solid #ffe9a8; box-shadow:0 2px 4px rgba(0,0,0,.4); }
.tcg-duelback { position:absolute; top:8px; left:8px; z-index:3; width:34px; height:34px; border:none; border-radius:50%; background:rgba(20,22,28,.72); display:grid; place-items:center; } .tcg-duelback svg { width:20px; height:20px; }
.tcg-hand { position:absolute; bottom:0; left:0; right:0; z-index:2; display:flex; justify-content:center; align-items:flex-end; height:110px; }
.tcg-hc { width:78px; height:106px; border-radius:11px; padding:5px; margin-left:-24px; background:linear-gradient(160deg,#30323d,#191a21); box-shadow:0 5px 12px rgba(0,0,0,.6); border:2px solid var(--rar,#9aa3b2); position:relative; transition:transform .1s; }
.tcg-hc:first-child { margin-left:0; }
.tcg-hc.playable { transform:translateY(-8px); } .tcg-hc.playable:after { content:""; position:absolute; inset:-2px; border-radius:11px; box-shadow:0 0 0 2px rgba(255,215,94,.6); }
.tcg-hc.sel { transform:translateY(-16px); border-color:#fff; } .tcg-hc.dim { opacity:.55; }
.tcg-hc .c { position:absolute; top:-7px; left:-7px; width:24px; height:24px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#8fdcff,#1e6fb8); border:2px solid #d6f0ff; display:grid; place-items:center; font-weight:800; font-size:12px; }
.tcg-hc .ha { height:42px; border-radius:7px; background:linear-gradient(160deg,var(--a1),var(--a2)); display:grid; place-items:center; } .tcg-hc .ha svg { width:24px; height:24px; fill:rgba(255,255,255,.9); }
.tcg-hc .hn { font-size:7.5px; text-align:center; margin-top:4px; font-weight:800; white-space:nowrap; overflow:hidden; }
.tcg-hc .sa, .tcg-hc .sh { position:absolute; bottom:-5px; width:22px; height:22px; display:grid; place-items:center; font-weight:800; font-size:11px; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.tcg-hc .sa { left:-5px; background:linear-gradient(160deg,#ffcf5a,#e8821e); } .tcg-hc .sh { right:-5px; background:linear-gradient(160deg,#ff7a72,#d6342b); }
.tcg-hc .spl { position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); font-size:8px; font-weight:800; background:#444; padding:2px 5px; border-radius:5px; }
.tcg-endturn { position:absolute; bottom:42px; right:14px; z-index:3; border:none; border-radius:20px; padding:10px 16px; font-weight:800; font-size:13px; background:linear-gradient(160deg,#ffcf5a,#e8821e); color:#3a2400; box-shadow:0 3px 8px rgba(0,0,0,.4); }
.tcg-endturn:disabled { opacity:.5; }
.tcg-toast { position:absolute; top:46%; left:50%; transform:translate(-50%,-50%); z-index:50; font-size:30px; font-weight:800; color:#fff; text-shadow:0 3px 12px rgba(0,0,0,.8); pointer-events:none; animation:tcg-toastk 1.1s ease forwards; }
@keyframes tcg-toastk { 0%{opacity:0;transform:translate(-50%,-30%) scale(.7);} 20%{opacity:1;transform:translate(-50%,-50%) scale(1.1);} 80%{opacity:1;} 100%{opacity:0;transform:translate(-50%,-70%);} }
.tcg-pop { position:absolute; inset:0; z-index:60; display:grid; place-items:center; background:rgba(8,9,12,.7); }
.tcg-pop .box { width:80%; max-width:300px; background:#1a1b22; border:1px solid #2c2f3a; border-radius:18px; padding:20px; text-align:center; }
.tcg-pop h2 { font-size:22px; margin:0 0 6px; } .tcg-pop p { color:#9aa3b2; font-size:13px; margin:0 0 14px; }
.tcg-pop .rew { color:#ffd75e; font-weight:800; margin-bottom:14px; }
.tcg-pop button { width:100%; border:none; border-radius:14px; padding:13px; font-weight:800; font-size:14px; margin-top:8px; }
.tcg-pop .p1 { background:linear-gradient(160deg,#ffcf5a,#e8821e); color:#3a2400; } .tcg-pop .p2 { background:#2a2f3a; color:#fff; }
.tcg-chip.death { background:#b07ad8; color:#2a1040; }
.tcg-chip.heal { background:#6fdca0; color:#0a3a22; }
.tcg-min.htgt { border-color:#5fe08a; box-shadow:0 0 14px #5fe08a; }
.tcg-min.dragging-min { opacity:.28; }

/* info popup */
.tcg-info { position:absolute; inset:0; z-index:70; display:grid; place-items:center; background:rgba(8,9,12,.72); }
.tcg-info .box { width:84%; max-width:300px; background:#1a1b22; border:2px solid var(--rar,#3a3f4a); border-radius:18px; padding:18px; }
.tcg-info h3 { margin:0; font-size:18px; } .tcg-info .meta { color:#9aa3b2; font-size:12px; font-weight:700; margin:2px 0 12px; }
.tcg-info .ab { font-size:13px; line-height:1.45; color:#dfe4ee; margin-bottom:6px; }
.tcg-info .ab b { color:#ffd75e; }
.tcg-info button { width:100%; border:none; border-radius:13px; padding:12px; font-weight:800; margin-top:12px; background:#2a2f3a; color:#fff; }

/* drag ghost */
.tcg-ghost { position:absolute; z-index:80; width:80px; pointer-events:none; filter:drop-shadow(0 10px 16px rgba(0,0,0,.6)); transform:translate(-50%,-50%) scale(1.05); }
.tcg-hc.dragging { opacity:.25; }
.tcg-cancelhint { position:absolute; bottom:118px; left:50%; transform:translateX(-50%); z-index:79; background:rgba(20,22,28,.85); color:#ff9a8a; font-weight:800; font-size:12px; padding:6px 12px; border-radius:12px; pointer-events:none; }

/* combat / card FX */
.tcg-fx { position:absolute; inset:0; z-index:55; pointer-events:none; overflow:hidden; }
.tcg-num { position:absolute; transform:translate(-50%,-50%); font-size:20px; font-weight:800; text-shadow:0 2px 5px rgba(0,0,0,.8); animation:tcg-num .8s ease-out forwards; }
.tcg-num.dmg { color:#ff6a5a; } .tcg-num.buff { color:#7be08a; } .tcg-num.heal { color:#7be08a; }
@keyframes tcg-num { 0%{opacity:0;transform:translate(-50%,-30%) scale(.6);} 20%{opacity:1;transform:translate(-50%,-60%) scale(1.1);} 100%{opacity:0;transform:translate(-50%,-150%);} }
.tcg-ring { position:absolute; transform:translate(-50%,-50%); width:60px; height:60px; margin:-30px 0 0 0; border-radius:50%; }
.tcg-ring.burst { border:4px solid #ffe08a; animation:tcg-ring .5s ease-out forwards; }
.tcg-ring.deathr { border:4px solid #b07ad8; animation:tcg-ring .6s ease-out forwards; }
.tcg-ring.shield { border:4px solid #c2dcff; animation:tcg-ring .5s ease-out forwards; }
@keyframes tcg-ring { 0%{transform:translate(-50%,-50%) scale(.3);opacity:1;} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0;} }
.tcg-puff { position:absolute; transform:translate(-50%,-50%); width:56px; height:78px; border-radius:10px; background:radial-gradient(circle,rgba(180,140,160,.6),transparent 70%); animation:tcg-puff .42s ease-out forwards; }
@keyframes tcg-puff { 0%{opacity:.9;transform:translate(-50%,-50%) scale(1);} 100%{opacity:0;transform:translate(-50%,-40%) scale(.4) rotate(12deg);} }

/* enter animations (play once per minion) */
.tcg-min.fx-summon { animation:tcg-en-summon .32s ease; }
.tcg-min.fx-charge { animation:tcg-en-charge .34s cubic-bezier(.2,1.3,.5,1); }
.tcg-min.fx-taunt { animation:tcg-en-taunt .34s ease; }
.tcg-min.fx-battlecry { animation:tcg-en-summon .32s ease; }
@keyframes tcg-en-summon { 0%{transform:scale(.55);opacity:0;} 70%{transform:scale(1.08);} 100%{transform:scale(1);opacity:1;} }
@keyframes tcg-en-charge { 0%{transform:translateY(26px) scale(.7);opacity:0;filter:brightness(2);} 100%{transform:none;opacity:1;filter:none;} }
@keyframes tcg-en-taunt { 0%{transform:scale(1.4);opacity:0;} 55%{transform:scale(.9);} 100%{transform:scale(1);opacity:1;} }
/* hit / attack */
.tcg-min.fx-hit, .tcg-port.fx-hit { animation:tcg-shake .3s ease; }
@keyframes tcg-shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-5px);} 75%{transform:translateX(5px);} }
.tcg-min.fx-attack { animation:tcg-attack .28s ease; }
@keyframes tcg-attack { 0%{transform:scale(1);} 40%{transform:translateY(-8px) scale(1.12);} 100%{transform:scale(1);} }
`;

const BACK_SVG = `<svg viewBox="0 0 24 24"><path d="M14 5L8 12l6 7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  api.root.style.position = "relative";

  // ---- persistent save ----
  let G = loadSave();
  function loadSave() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { s = null; }
    return Object.assign({}, DEFAULT_SAVE, s || {});
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch {}
  }

  const level = () => 1 + Math.floor(G.xp / XP_PER_LEVEL);
  const levelProg = () => G.xp % XP_PER_LEVEL;
  const owned = (id) => G.collection[id] || 0;
  const cardLevel = (id) => Math.min(3, owned(id));
  const ownedCount = () => Object.keys(G.collection).filter((id) => G.collection[id] > 0).length;

  function effective(base) {
    const lvl = Math.max(1, cardLevel(base.id));
    const bonus = lvl - 1;
    const kw = base.keywords.slice();
    if (lvl >= 3 && base.type === "minion" && !kw.includes("taunt")) kw.push("taunt");
    return { ...base, atk: base.atk + bonus, hp: base.hp + bonus, keywords: kw, level: lvl };
  }

  function addXp(n) {
    const before = level();
    G.xp += n;
    const after = level();
    for (let L = before + 1; L <= after; L++) {
      for (const f of FIELD_ORDER) if (FIELDS[f].unlock === L && !G.fields.includes(f)) G.fields.push(f);
      G.heimers += 50;
    }
  }
  function validDeck() {
    return (G.deck || []).filter((id) => owned(id) > 0).slice(0, 8);
  }
  function autoDeck() {
    const ids = Object.keys(G.collection).filter((id) => G.collection[id] > 0).map(Number);
    ids.sort((a, b) => SET[a].cost - SET[b].cost);
    return ids.slice(0, 8);
  }

  // ---- root + router ----
  let view = "menu";
  let busy = false, over = false, gen = 0, uidc = 0;
  let S = null, sel = null;          // duel state
  let pack = null, revealIdx = 0;     // pack reveal state
  let duelFields = null;              // {you, enemy}
  const seen = new Set();             // minion uids already animated in
  const nodeOf = new Map();           // uid -> current DOM node
  let heroNode = {};                  // side -> portrait node
  let pendingFx = [];                 // fx to apply after the next render

  const root = document.createElement("div");
  root.className = "tcg";
  const fxLayer = document.createElement("div");
  fxLayer.className = "tcg-fx";
  api.root.append(root, fxLayer);
  api.onRestart(() => { if (view !== "duel") go("menu"); });

  // ---- FX helpers (overlays live in fxLayer so re-renders don't wipe them) ----
  const rootRect = () => api.root.getBoundingClientRect();
  function relRect(elm) {
    const r = elm.getBoundingClientRect(), o = rootRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  }
  function fxNum(pt, text, cls) {
    const n = E("div", "tcg-num " + cls, text);
    n.style.left = pt.x + "px"; n.style.top = pt.y + "px";
    fxLayer.append(n); setTimeout(() => n.remove(), 820);
  }
  function fxRing(pt, cls) {
    const n = E("div", "tcg-ring " + cls);
    n.style.left = pt.x + "px"; n.style.top = pt.y + "px";
    fxLayer.append(n); setTimeout(() => n.remove(), 640);
  }
  function fxPuff(pt) {
    const n = E("div", "tcg-puff");
    n.style.left = pt.x + "px"; n.style.top = pt.y + "px";
    fxLayer.append(n); setTimeout(() => n.remove(), 460);
  }
  const pushFx = (fx) => pendingFx.push(fx);

  function go(v) { view = v; sel = null; render(); }

  const E = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const chips = (kw) => kw.filter((k) => KW_LABEL[k]).map((k) => `<span class="tcg-chip ${k}">${KW_LABEL[k]}</span>`).join("");
  const allChips = (o) => chips(o.keywords || []) + (o.heal ? `<span class="tcg-chip heal">Heal ${o.heal}</span>` : "");
  const glyph = (id) => `<svg viewBox="0 0 100 100">${GLYPHS[id % GLYPHS.length]}</svg>`;

  function topBar(title, onBack) {
    const bar = E("div", "tcg-top");
    const back = E("button", "tcg-back", BACK_SVG);
    back.onclick = onBack;
    bar.append(back, E("div", "tcg-title", title), E("div", "tcg-coin", `<span class="c">H</span> ${G.heimers}`));
    return bar;
  }

  /* ---------------- MENU ---------------- */
  function menuView() {
    const wrap = E("div", "tcg-scroll");
    const top = E("div", "tcg-top");
    const back = E("button", "tcg-back", BACK_SVG);
    back.onclick = () => api.exit();
    top.append(back, E("div", "tcg-title", "Elendheim <b>TCG</b>"), E("div", "tcg-coin", `<span class="c">H</span> ${G.heimers}`));
    const menu = E("div", "tcg-menu");
    menu.append(E("div", "tcg-lvl",
      `<div class="r"><b>Commander Level ${level()}</b><span>${levelProg()} / ${XP_PER_LEVEL} XP</span></div>
       <div class="tcg-bar"><i style="width:${(levelProg() / XP_PER_LEVEL) * 100}%"></i></div>`));

    const deck = validDeck();
    const battle = E("button", "tcg-battle",
      `<svg class="ic" viewBox="0 0 100 100"><path class="tcg-sword" d="M22 22l44 44M74 30l-10-2-2-10M30 74l10 2 2 10"/><path class="tcg-sword" d="M78 22L34 66M26 30l10-2 2-10M70 74l-10 2-2 10"/></svg>
       <div class="t"><b>Battle</b><span>${deck.length ? "Fight the computer · earn Heimers" : "Open a pack & build a deck first"}</span></div><div class="go">▸</div>`);
    battle.disabled = deck.length === 0;
    battle.onclick = () => startDuel();
    menu.append(battle);

    const grid = E("div", "tcg-grid");
    const tile = (cls, ic, name, sub, fn, badge) => {
      const t = E("button", "tcg-tile" + (cls ? " " + cls : ""),
        (badge ? `<span class="n">${badge}</span>` : "") + ic + `<b>${name}</b><span>${sub}</span>`);
      t.onclick = fn;
      return t;
    };
    grid.append(
      tile("", `<svg class="ic" viewBox="0 0 100 100"><rect x="20" y="26" width="42" height="56" rx="6" fill="#8fa0c8" transform="rotate(-8 41 54)"/><rect x="34" y="20" width="44" height="58" rx="6" fill="#cfd6ee"/></svg>`,
        "My Deck", `${deck.length} / 8 cards`, () => go("deck")),
      tile("shop", `<svg class="ic" viewBox="0 0 100 100"><rect x="26" y="24" width="48" height="60" rx="8" fill="#8b5cf6"/><circle cx="50" cy="50" r="13" fill="#ffe08a"/></svg>`,
        "Shop", `Packs · ${PACK_COST} ⓗ`, () => go("shop"), G.heimers >= PACK_COST ? "OPEN" : null),
      tile("", `<svg class="ic" viewBox="0 0 100 100"><g fill="#cfd6ee"><rect x="20" y="22" width="26" height="26" rx="4"/><rect x="54" y="22" width="26" height="26" rx="4"/><rect x="20" y="54" width="26" height="26" rx="4"/><rect x="54" y="54" width="26" height="26" rx="4"/></g></svg>`,
        "Collection", `${ownedCount()} / ${SET.length} cards`, () => go("collection")),
      tile("", `<svg class="ic" viewBox="0 0 100 100"><rect x="18" y="20" width="64" height="60" rx="8" fill="#5fa23a"/><path d="M18 60l18-16 14 12 16-18 16 14v28H18z" fill="#3c6f24"/><circle cx="64" cy="36" r="8" fill="#ffe08a"/></svg>`,
        "Battlefields", `${G.fields.length} unlocked`, () => go("fields")),
    );
    menu.append(grid);
    const s = api.refreshStats();
    const foot = E("div", "tcg-foot",
      `<div class="s"><b>${s.wins}</b><span>Wins</span></div><div class="s"><b>${s.streak}</b><span>Streak</span></div><div class="s"><b>${ownedCount()}</b><span>Cards</span></div>`);
    menu.append(foot);
    wrap.append(top, menu);
    return wrap;
  }

  /* ---------------- COLLECTION ---------------- */
  function cardFace(base, { showLevel = true, small = true } = {}) {
    const own = owned(base.id) > 0;
    const eff = own ? effective(base) : base;
    const r = RARITY[base.rarity];
    const c = E("div", "tcg-card" + (own ? " g" : " locked"));
    c.style.setProperty("--rar", r.color); c.style.setProperty("--a1", r.a1); c.style.setProperty("--a2", r.a2);
    const lvl = own ? cardLevel(base.id) : 0;
    const stats = base.type === "minion"
      ? `<div class="cs a">${eff.atk}</div><div class="cs h">${eff.hp}</div>`
      : `<div class="cspl">SPELL</div>`;
    c.innerHTML =
      `<div class="cc">${base.cost}</div>` +
      (showLevel && lvl > 1 ? `<div class="lv">${"★".repeat(lvl - 1)}</div>` : "") +
      `<div class="ca">${glyph(base.id)}</div><div class="cn">${base.name}</div><div class="ck">${allChips(eff)}</div>${stats}`;
    return c;
  }

  function collectionView() {
    const wrap = E("div", "tcg-scroll");
    wrap.append(topBar("Collection", () => go("menu")));
    wrap.append(E("div", "tcg-hint", `${ownedCount()} / ${SET.length} collected · duplicates level a card up (★)`));
    const grid = E("div", "tcg-collgrid");
    SET.forEach((base) => { const c = cardFace(base); const info = () => showInfo(effective(base)); bindCard(c, info, info); grid.append(c); });
    wrap.append(grid);
    return wrap;
  }

  /* ---------------- DECK BUILDER ---------------- */
  function deckView() {
    const wrap = E("div", "tcg-scroll");
    wrap.append(topBar("My Deck", () => go("menu")));
    let deck = validDeck();
    G.deck = deck; persist();
    const hint = E("div", "tcg-hint", `Tap to add/remove · ${deck.length} / 8 in deck`);
    wrap.append(hint);
    const ownedIds = Object.keys(G.collection).filter((id) => G.collection[id] > 0).map(Number).sort((a, b) => SET[a].cost - SET[b].cost);
    if (!ownedIds.length) { wrap.append(E("div", "tcg-hint", "No cards yet — open a pack in the Shop!")); return wrap; }
    const grid = E("div", "tcg-collgrid tcg-deck full");
    ownedIds.forEach((id) => {
      const c = cardFace(SET[id]);
      if (deck.includes(id)) c.classList.add("in");
      bindCard(c, () => {
        if (G.deck.includes(id)) G.deck = G.deck.filter((x) => x !== id);
        else if (G.deck.length < 8) G.deck = [...G.deck, id];
        persist();
        render();
      }, () => showInfo(effective(SET[id])));
      grid.append(c);
    });
    wrap.append(grid);
    return wrap;
  }

  /* ---------------- BATTLEFIELDS ---------------- */
  function fieldsView() {
    const wrap = E("div", "tcg-scroll");
    wrap.append(topBar("Battlefields", () => go("menu")));
    wrap.append(E("div", "tcg-hint", "Pick your side. The enemy fights on a random unlocked field — never yours."));
    const grid = E("div", "tcg-fgrid");
    FIELD_ORDER.forEach((f) => {
      const meta = FIELDS[f];
      const unlocked = G.fields.includes(f);
      const eq = G.equipped === f;
      const cell = E("div", "tcg-field" + (eq ? " eq" : ""));
      cell.innerHTML =
        `<div class="sw" style="background:${meta.css}">${unlocked ? "" : `<div class="lock">🔒 Level ${meta.unlock}</div>`}</div>` +
        `<div class="nm">${meta.name}${eq ? `<span class="tcg-bdg eq">EQUIPPED</span>` : unlocked ? `<span class="tcg-bdg un">TAP TO USE</span>` : ""}</div>`;
      if (unlocked) cell.onclick = () => { G.equipped = f; persist(); render(); };
      grid.append(cell);
    });
    wrap.append(grid);
    return wrap;
  }

  /* ---------------- SHOP ---------------- */
  function shopView() {
    const wrap = E("div", "tcg-scroll");
    wrap.append(topBar("Shop", () => go("menu")));
    const s = E("div", "tcg-shop");
    s.append(E("div", "tcg-pack",
      `<div class="seal"><svg viewBox="0 0 100 100"><path d="M50 14l10 24 26 2-20 17 6 25-22-13-22 13 6-25-20-17 26-2z"/></svg></div><div class="pn">ELENDHEIM PACK<small>${PACK_SIZE} CARDS · RARE+ GUARANTEED</small></div>`));
    const buy = E("button", "tcg-buy", `Open Pack · ${PACK_COST} ⓗ`);
    buy.disabled = G.heimers < PACK_COST;
    buy.onclick = buyPack;
    s.append(buy);
    s.append(E("div", "tcg-shopmsg", G.heimers < PACK_COST ? "Win battles to earn more Heimers." : `You have ${G.heimers} Heimers.`));
    wrap.append(s);
    return wrap;
  }

  function buyPack() {
    if (G.heimers < PACK_COST) return;
    G.heimers -= PACK_COST;
    const cards = openPackCards();
    pack = cards.map((base) => {
      const wasNew = owned(base.id) === 0;
      const oldLvl = cardLevel(base.id);
      G.collection[base.id] = (G.collection[base.id] || 0) + 1;
      const newLvl = cardLevel(base.id);
      return { base, isNew: wasNew, leveled: !wasNew && newLvl > oldLvl, newLvl };
    });
    if (!G.deck.length) G.deck = autoDeck();
    persist();
    revealIdx = 0;
    go("reveal");
  }

  /* ---------------- PACK REVEAL ---------------- */
  function revealView() {
    if (revealIdx >= pack.length) return summaryView();
    const item = pack[revealIdx];
    const r = RARITY[item.base.rarity];
    const wrap = E("div", "tcg-reveal");
    wrap.style.setProperty("--glow", item.base.rarity === "legendary" ? "#5a4410" : item.base.rarity === "epic" ? "#3a1f55" : "#1a2030");
    const dots = E("div", "tcg-dots");
    for (let i = 0; i < pack.length; i++) dots.append(E("span", "tcg-dot" + (i <= revealIdx ? " on" : "")));
    wrap.append(dots);
    if (RARITY[item.base.rarity].rank >= 2) {
      const rays = E("div", "tcg-rays");
      rays.style.background = `conic-gradient(from 0deg, ${r.color}00, ${r.color}55, ${r.color}00 25%, ${r.color}55 50%, ${r.color}00 75%, ${r.color}55)`;
      wrap.append(rays);
      for (let i = 0; i < 6; i++) {
        const sp = E("div", "tcg-spark");
        sp.style.left = 30 + Math.random() * 60 + "%"; sp.style.top = 35 + Math.random() * 30 + "%";
        sp.style.animationDelay = Math.random() * 0.4 + "s";
        wrap.append(sp);
      }
    }
    const rib = E("div", "tcg-rib", `${RARITY[item.base.rarity].rank >= 3 ? "★ " : ""}${item.base.rarity.toUpperCase()}${RARITY[item.base.rarity].rank >= 3 ? " ★" : ""}`);
    rib.style.color = r.color;
    const big = cardFace(item.base, { small: false });
    big.classList.add("tcg-bigcard");
    big.style.width = "150px"; big.querySelector(".ca").style.height = "104px";
    big.style.transform = ""; // ensure animation plays
    const tag = item.isNew ? `<span class="tcg-tag new">NEW</span>` : item.leveled ? `<span class="tcg-tag up">LEVEL UP ★</span>` : `<span class="tcg-tag up">EXTRA</span>`;
    wrap.append(rib, big, E("div", null, tag), E("div", "tcg-revhint", revealIdx < pack.length - 1 ? "Tap to reveal the next card…" : "Tap to see your pull"));
    wrap.onclick = () => { revealIdx++; render(); };
    return wrap;
  }

  function summaryView() {
    const wrap = E("div", "tcg-scroll");
    wrap.append(topBar("Your Pull", () => go("menu")));
    const grid = E("div", "tcg-sumgrid");
    pack.forEach((item) => {
      const slot = E("div", null);
      const c = cardFace(item.base);
      c.querySelector(".ca").style.height = "52px";
      slot.append(c);
      grid.append(slot);
    });
    wrap.append(grid);
    const counts = pack.reduce((o, it) => { o[it.isNew ? "new" : it.leveled ? "up" : "ex"]++; return o; }, { new: 0, up: 0, ex: 0 });
    wrap.append(E("div", "tcg-hint", `${counts.new} new · ${counts.up} levelled up`));
    const row = E("div", "tcg-row");
    const again = E("button", "again", `Open Again · ${PACK_COST} ⓗ`);
    again.disabled = G.heimers < PACK_COST;
    again.onclick = buyPack;
    const collect = E("button", "collect", "Collect");
    collect.onclick = () => { pack = null; go("menu"); };
    row.append(again, collect);
    wrap.append(row);
    return wrap;
  }

  /* ===================== DUEL ===================== */
  const other = (s) => (s === "you" ? "cpu" : "you");
  const findMin = (side, uid) => S.board[side].find((m) => m.uid === uid);
  const taunts = (side) => S.board[side].filter((m) => m.keywords.includes("taunt"));

  function makeMinion(card) {
    const enter = card.battlecry ? "battlecry" : card.keywords.includes("charge") ? "charge" : card.keywords.includes("taunt") ? "taunt" : "summon";
    return {
      uid: ++uidc, name: card.name, rarity: card.rarity, gid: card.id,
      atk: card.atk, hp: card.hp, maxHp: card.hp, keywords: card.keywords.slice(),
      deathrattle: card.deathrattle || null, heal: card.heal || 0, enter,
      shield: card.keywords.includes("shield"), canAttack: card.keywords.includes("charge"), summoned: true,
    };
  }
  const token = (atk, hp) => ({ uid: ++uidc, name: "Warden", rarity: "common", gid: 2, atk, hp, maxHp: hp, keywords: [], deathrattle: null, enter: "summon", shield: false, canAttack: false, summoned: true });

  function startDuel() {
    gen++;
    const myDeckIds = validDeck();
    if (!myDeckIds.length) { go("menu"); return; }
    // pick fields: yours = equipped; enemy = random unlocked != yours
    const pool = G.fields.filter((f) => f !== G.equipped);
    duelFields = { you: G.equipped, enemy: pool.length ? pool[(Math.random() * pool.length) | 0] : (G.equipped === "sand" ? "grass" : "sand") };
    S = {
      turn: "you", hp: { you: 25, cpu: 25 }, maxMana: { you: 0, cpu: 0 }, mana: { you: 0, cpu: 0 },
      deck: { you: shuffle(myDeckIds.map((id) => effective(SET[id]))), cpu: randomDeck() },
      hand: { you: [], cpu: [] }, board: { you: [], cpu: [] }, fatigue: { you: 0, cpu: 0 },
    };
    sel = null; busy = false; over = false;
    for (let i = 0; i < 3; i++) draw("you");
    for (let i = 0; i < 4; i++) draw("cpu");
    startTurn("you");
    view = "duel";
    render();
  }

  function draw(side) {
    if (S.deck[side].length === 0) { S.fatigue[side]++; damageHero(side, S.fatigue[side]); }
    else { const c = S.deck[side].shift(); if (S.hand[side].length < 10) S.hand[side].push(c); }
  }
  function startTurn(side) {
    S.turn = side;
    S.maxMana[side] = Math.min(8, S.maxMana[side] + 1);
    S.mana[side] = S.maxMana[side];
    draw(side);
    S.board[side].forEach((m) => { m.canAttack = true; m.summoned = false; });
  }
  function damageHero(side, amt) {
    if (amt <= 0) return;
    S.hp[side] = Math.max(0, S.hp[side] - amt);
    pushFx({ hero: side, type: "hit", num: amt });
    if (S.hp[side] <= 0) endGame(other(side));
  }
  function damageMinion(m, amt) {
    if (amt <= 0) return;
    if (m.shield) { m.shield = false; pushFx({ uid: m.uid, type: "shield" }); return; }
    m.hp -= amt;
    pushFx({ uid: m.uid, type: "hit", num: amt });
  }
  function cleanupDead() {
    let chain = true, guard = 0;
    while (chain && guard++ < 8) {
      chain = false;
      for (const s of ["you", "cpu"]) {
        const dead = S.board[s].filter((m) => m.hp <= 0);
        if (!dead.length) continue;
        chain = true;
        dead.forEach((m) => { const el = nodeOf.get(m.uid); if (el) { const pt = relRect(el); fxPuff(pt); if (m.deathrattle) fxRing(pt, "deathr"); } });
        S.board[s] = S.board[s].filter((m) => m.hp > 0);
        dead.forEach((m) => { if (m.deathrattle) resolveEffect(m.deathrattle, s, null); });
      }
    }
  }

  function resolveEffect(eff, side, targetUid) {
    const foe = other(side);
    if (eff.kind === "damage") {
      if (targetUid === "hero") damageHero(foe, eff.amount);
      else { const m = findMin(foe, targetUid) || findMin(side, targetUid); if (m) damageMinion(m, eff.amount); }
    } else if (eff.kind === "damageFace") damageHero(foe, eff.amount);
    else if (eff.kind === "aoe") S.board[foe].forEach((m) => damageMinion(m, eff.amount));
    else if (eff.kind === "buff" || eff.kind === "buffRandom") {
      let m = eff.kind === "buffRandom" ? S.board[side][(Math.random() * S.board[side].length) | 0] : findMin(side, targetUid);
      if (m) { m.atk += eff.atk; m.hp += eff.hp; m.maxHp += eff.hp; pushFx({ uid: m.uid, type: "buff", num: `+${eff.atk}/+${eff.hp}` }); }
    } else if (eff.kind === "heal") { const h = Math.min(25, S.hp[side] + eff.amount) - S.hp[side]; S.hp[side] += h; if (h) pushFx({ hero: side, type: "heal", num: "+" + h }); }
    else if (eff.kind === "draw") for (let i = 0; i < eff.count; i++) draw(side);
    else if (eff.kind === "summon") for (let i = 0; i < eff.count && S.board[side].length < 7; i++) S.board[side].push(token(eff.atk, eff.hp));
    cleanupDead();
  }
  const spellNeedsTarget = (card) => card.type === "spell" && (card.effect.kind === "damage" || card.effect.kind === "buff");

  function playCard(side, idx, targetUid) {
    const card = S.hand[side][idx];
    if (!card || card.cost > S.mana[side]) return false;
    if (card.type === "minion" && S.board[side].length >= 7) return false;
    S.mana[side] -= card.cost;
    S.hand[side].splice(idx, 1);
    if (card.type === "minion") {
      const m = makeMinion(card);
      S.board[side].push(m);
      if (card.battlecry) { pushFx({ uid: m.uid, type: "battlecry" }); resolveEffect(card.battlecry, side, null); }
    } else resolveEffect(card.effect, side, targetUid);
    cleanupDead();
    return true;
  }
  function doAttack(side, attUid, targetUid) {
    const att = findMin(side, attUid);
    if (!att || !att.canAttack) return;
    const foe = other(side), ta = taunts(foe);
    pushFx({ uid: att.uid, type: "attack" });
    if (targetUid === "hero") { if (ta.length) return; damageHero(foe, att.atk); }
    else {
      const def = findMin(foe, targetUid);
      if (!def || (ta.length && !def.keywords.includes("taunt"))) return;
      damageMinion(def, att.atk); damageMinion(att, def.atk);
    }
    att.canAttack = false;
    cleanupDead();
  }
  function doHeal(side, healerUid, targetUid) {
    const healer = findMin(side, healerUid);
    if (!healer || !healer.canAttack || !healer.heal) return;
    const tgt = findMin(side, targetUid);
    if (!tgt || tgt.uid === healer.uid || tgt.hp >= tgt.maxHp) return; // never itself; no overheal
    const healed = Math.min(tgt.maxHp, tgt.hp + healer.heal) - tgt.hp;
    tgt.hp += healed;
    if (healed > 0) pushFx({ uid: tgt.uid, type: "heal", num: "+" + healed });
    pushFx({ uid: healer.uid, type: "attack" });
    healer.canAttack = false;
  }

  function endGame(winner) {
    if (over) return;
    over = true; busy = true; sel = null;
    const reward = winner === "you" ? 100 : 25;
    G.heimers += reward;
    addXp(winner === "you" ? 100 : 30);
    persist();
    if (winner === "you") api.reportWin(); else api.reportLoss();
    render();
    toast(winner === "you" ? "Victory!" : "Defeat");
    const g = gen;
    setTimeout(() => {
      if (gen !== g) return;
      popup(
        winner === "you" ? "Victory!" : "Defeat",
        winner === "you" ? "You crushed the enemy commander." : "Your hero has fallen.",
        `+${reward} Heimers · +${winner === "you" ? 100 : 30} XP`,
        [{ label: "Battle Again", cls: "p1", fn: startDuel }, { label: "Menu", cls: "p2", fn: () => go("menu") }]
      );
    }, 950);
  }

  /* duel interactions — tapping a hand card SELECTS it (drag to play) */
  function onHand(idx) {
    if (busy || over || S.turn !== "you") return;
    const card = S.hand.you[idx];
    if (!card) return;
    if (spellNeedsTarget(card)) {
      // targeted spell: select so you can tap a target to cast it
      sel = sel && sel.t === "spell" && sel.idx === idx ? null : { t: "spell", idx };
    } else {
      sel = sel && sel.t === "sel" && sel.idx === idx ? null : { t: "sel", idx };
    }
    render();
  }
  function onMinion(side, uid) {
    if (busy || over || S.turn !== "you") return;
    if (side === "you") {
      if (sel && sel.t === "spell") {
        const card = S.hand.you[sel.idx];
        if (card && card.effect.kind === "buff") { playCard("you", sel.idx, uid); sel = null; render(); }
        return;
      }
      const m = findMin("you", uid);
      if (m && m.canAttack) { sel = sel && sel.t === "atk" && sel.uid === uid ? null : { t: "atk", uid }; render(); }
    } else {
      if (sel && sel.t === "atk") {
        const ta = taunts("cpu");
        if (!ta.length || findMin("cpu", uid).keywords.includes("taunt")) { doAttack("you", sel.uid, uid); sel = null; render(); }
      } else if (sel && sel.t === "spell" && S.hand.you[sel.idx].effect.kind === "damage") { playCard("you", sel.idx, uid); sel = null; render(); }
    }
  }
  function onHero(side) {
    if (busy || over || S.turn !== "you" || side !== "cpu") return;
    if (sel && sel.t === "atk") { if (!taunts("cpu").length) { doAttack("you", sel.uid, "hero"); sel = null; render(); } }
    else if (sel && sel.t === "spell" && S.hand.you[sel.idx].effect.kind === "damage") { playCard("you", sel.idx, "hero"); sel = null; render(); }
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function cpuTurn() {
    busy = true; startTurn("cpu"); render();
    const myGen = gen;
    await wait(550); if (gen !== myGen || over) return;
    let acted = true, guard = 0;
    while (acted && guard++ < 30) {
      acted = false;
      const hand = S.hand.cpu;
      let bi = -1, bc = -1;
      for (let i = 0; i < hand.length; i++) { const c = hand[i]; if (c.cost <= S.mana.cpu && c.type === "minion" && S.board.cpu.length < 7 && c.cost > bc) { bi = i; bc = c.cost; } }
      if (bi >= 0) { playCard("cpu", bi, null); acted = true; render(); await wait(480); if (gen !== myGen || over) return; continue; }
      for (let i = 0; i < hand.length; i++) {
        const c = hand[i]; if (c.type !== "spell" || c.cost > S.mana.cpu) continue;
        const tgt = cpuSpellTarget(c); if (tgt === undefined) continue;
        playCard("cpu", i, tgt); acted = true; render(); await wait(480); if (gen !== myGen || over) return; break;
      }
    }
    for (const m of [...S.board.cpu]) {
      if (over) break;
      if (!S.board.cpu.includes(m) || !m.canAttack) continue;
      // a healer mends its most-hurt ally instead of attacking, when one's damaged
      if (m.heal) {
        const hurt = S.board.cpu.filter((x) => x.uid !== m.uid && x.hp < x.maxHp).sort((a, b) => (a.hp - a.maxHp) - (b.hp - b.maxHp))[0];
        if (hurt) { doHeal("cpu", m.uid, hurt.uid); render(); await wait(460); if (gen !== myGen || over) return; continue; }
      }
      const tgt = cpuAttackTarget(m); if (tgt == null) continue;
      doAttack("cpu", m.uid, tgt); render(); await wait(460); if (gen !== myGen || over) return;
    }
    if (gen !== myGen || over) return;
    startTurn("you"); busy = false; render();
  }
  function cpuSpellTarget(c) {
    const e = c.effect;
    if (e.kind === "damage") { const k = S.board.you.find((m) => m.hp <= e.amount && !m.shield); if (k) return k.uid; if (S.board.you.length) return S.board.you[0].uid; return "hero"; }
    if (e.kind === "buff") { if (!S.board.cpu.length) return undefined; return S.board.cpu.slice().sort((a, b) => b.atk - a.atk)[0].uid; }
    return null;
  }
  function cpuAttackTarget(m) {
    const ta = taunts("you");
    if (ta.length) { const k = ta.find((t) => t.hp <= m.atk && !t.shield); return (k || ta.slice().sort((a, b) => a.hp - b.hp)[0]).uid; }
    const trade = S.board.you.find((d) => d.hp <= m.atk && !d.shield && d.atk < m.hp);
    return trade ? trade.uid : "hero";
  }

  /* ---- card info / ability descriptions ---- */
  function describe(card) {
    const lines = [];
    if (card.type === "spell" && card.effect) lines.push(`<b>Spell:</b> ${effectText(card.effect)}`);
    if (card.battlecry) lines.push(`<b>Battlecry:</b> ${effectText(card.battlecry)}`);
    if (card.deathrattle) lines.push(`<b>Deathrattle:</b> ${effectText(card.deathrattle)}`);
    if (card.heal) lines.push(`<b>Heal ${card.heal}:</b> Drag onto a friendly minion to restore ${card.heal} health (never itself).`);
    for (const k of card.keywords || []) if (KW_DESC[k] && k !== "death") lines.push(KW_DESC[k]);
    if ((card.keywords || []).includes("death") && !card.deathrattle) lines.push(KW_DESC.death);
    if (!lines.length) lines.push("A plain minion — no special abilities.");
    return lines;
  }
  function minionInfo(m) {
    const base = SET[m.gid] || {};
    return { name: m.name, rarity: m.rarity, cost: base.cost, type: "minion", atk: m.atk, hp: m.hp, keywords: m.keywords, battlecry: base.battlecry, deathrattle: m.deathrattle, heal: m.heal };
  }
  function showInfo(card) {
    const r = RARITY[card.rarity] || RARITY.common;
    const back = E("div", "tcg-info");
    const statline = card.type === "spell" ? "Spell" : `${card.atk} / ${card.hp}`;
    const lines = describe(card).map((l) => `<div class="ab">${l}</div>`).join("");
    const box = E("div", "box", `<h3>${card.name}</h3><div class="meta">${card.rarity[0].toUpperCase() + card.rarity.slice(1)} · Cost ${card.cost} · ${statline}</div>${lines}<button>Close</button>`);
    box.style.setProperty("--rar", r.color);
    box.querySelector("button").onclick = () => back.remove();
    back.onclick = (e) => { if (e.target === back) back.remove(); };
    back.append(box);
    api.root.append(back);
  }

  /* ---- gesture helpers (tap vs long-press; hand cards also drag) ---- */
  function bindCard(el, onTap, onInfo) {
    let t = null, sx = 0, sy = 0, moved = false, fired = false;
    el.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; moved = false; fired = false; t = setTimeout(() => { t = null; fired = true; onInfo && onInfo(); }, 450); });
    el.addEventListener("pointermove", (e) => { if (t && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(t); t = null; moved = true; } });
    el.addEventListener("pointerup", () => { if (t) { clearTimeout(t); t = null; if (!fired && !moved) onTap && onTap(); } });
    el.addEventListener("pointercancel", () => { if (t) { clearTimeout(t); t = null; } });
  }
  function dropTarget(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (el.dataset) { if (el.dataset.uid != null) return { uid: +el.dataset.uid, side: el.dataset.side }; if (el.dataset.hero != null) return { hero: el.dataset.hero }; }
      el = el.parentElement;
    }
    return null;
  }
  function bindHand(el, idx, card) {
    let t = null, sx = 0, sy = 0, fired = false, dragging = false, down = false, ghost = null, hint = null;
    const inHandZone = (y) => y - rootRect().top > api.root.clientHeight - 118;
    function startDrag() {
      clearGhosts();
      dragging = true; el.classList.add("dragging");
      ghost = E("div", "tcg-ghost"); ghost.innerHTML = el.innerHTML;
      ghost.style.cssText += `background:linear-gradient(160deg,#30323d,#191a21);border:2px solid ${RARITY[card.rarity].color};border-radius:11px;padding:5px;height:106px;`;
      ghost.style.setProperty("--rar", RARITY[card.rarity].color);
      api.root.append(ghost);
    }
    function moveGhost(x, y) {
      const o = rootRect();
      ghost.style.left = (x - o.left) + "px"; ghost.style.top = (y - o.top) + "px";
      const cancel = inHandZone(y);
      if (cancel && !hint) { hint = E("div", "tcg-cancelhint", "Release to keep in hand"); api.root.append(hint); }
      else if (!cancel && hint) { hint.remove(); hint = null; }
    }
    function endDrag(x, y) {
      if (ghost) { ghost.remove(); ghost = null; }
      if (hint) { hint.remove(); hint = null; }
      el.classList.remove("dragging");
      if (busy || over || S.turn !== "you" || inHandZone(y)) { render(); return; }
      if (card.type === "minion" || !spellNeedsTarget(card)) { playCard("you", idx, null); render(); return; }
      const tgt = dropTarget(x, y);
      if (tgt) {
        if (card.effect.kind === "damage" && (tgt.hero === "cpu" || tgt.side === "cpu")) { playCard("you", idx, tgt.hero ? "hero" : tgt.uid); render(); return; }
        if (card.effect.kind === "buff" && tgt.side === "you") { playCard("you", idx, tgt.uid); render(); return; }
      }
      render();
    }
    el.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY; fired = false; dragging = false; down = true;
      // capture the pointer so a mouse drag keeps firing on the card even
      // after the cursor leaves it (touch captures implicitly; mouse does not)
      try { el.setPointerCapture(e.pointerId); } catch {}
      t = setTimeout(() => { t = null; fired = true; showInfo(card); }, 450);
    });
    el.addEventListener("pointermove", (e) => {
      if (!down) return; // ignore hover (mouse moving with no button held)
      if (!dragging && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 10)) { if (t) { clearTimeout(t); t = null; } if (!busy && !over && S.turn === "you") startDrag(); }
      if (dragging) { e.preventDefault(); moveGhost(e.clientX, e.clientY); }
    });
    el.addEventListener("pointerup", (e) => { down = false; try { el.releasePointerCapture(e.pointerId); } catch {} if (t) { clearTimeout(t); t = null; } if (dragging) endDrag(e.clientX, e.clientY); else if (!fired) onHand(idx); });
    el.addEventListener("pointercancel", () => { down = false; if (t) { clearTimeout(t); t = null; } if (dragging) { if (ghost) ghost.remove(); if (hint) hint.remove(); el.classList.remove("dragging"); render(); } });
  }

  function applyFx() {
    for (const fx of pendingFx) {
      const el = fx.uid != null ? nodeOf.get(fx.uid) : fx.hero ? heroNode[fx.hero] : null;
      if (!el) continue;
      if (fx.type === "hit") { el.classList.add("fx-hit"); fxNum(relRect(el), "-" + fx.num, "dmg"); }
      else if (fx.type === "buff") fxNum(relRect(el), fx.num, "buff");
      else if (fx.type === "heal") fxNum(relRect(el), fx.num, "heal");
      else if (fx.type === "shield") fxRing(relRect(el), "shield");
      else if (fx.type === "attack") el.classList.add("fx-attack");
      else if (fx.type === "battlecry") fxRing(relRect(el), "burst");
    }
    pendingFx = [];
  }

  /* duel rendering */
  function minionEl(side, m) {
    let cls = "tcg-min";
    if (m.keywords.includes("taunt")) cls += " taunt";
    if (m.shield) cls += " shieldon";
    if (side === "you" && m.canAttack && S.turn === "you" && !busy && !over) cls += " ready";
    if (sel && sel.t === "atk" && sel.uid === m.uid) cls += " sel";
    if (sel && side === "cpu") {
      if (sel.t === "atk") { const ta = taunts("cpu"); if (!ta.length || m.keywords.includes("taunt")) cls += " tgt"; }
      else if (sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "damage") cls += " tgt";
    }
    if (sel && side === "you" && sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "buff") cls += " tgt";
    if (!seen.has(m.uid)) cls += " fx-" + m.enter;
    const r = RARITY[m.rarity];
    const el = E("div", cls,
      `<div class="art" style="--a1:${r.a1};--a2:${r.a2}">${glyph(m.gid)}</div><div class="nm">${m.name}</div><div class="tcg-mk">${allChips(m)}</div><div class="tcg-st a">${m.atk}</div><div class="tcg-st h">${m.hp}</div>`);
    el.dataset.uid = m.uid; el.dataset.side = side;
    seen.add(m.uid); nodeOf.set(m.uid, el);
    bindMinion(el, side, m);
    return el;
  }
  // drag a ready minion onto an enemy to attack, or onto an ally to heal
  // (healers can't heal themselves); tap selects, long-press shows info
  function bindMinion(el, side, m) {
    let t = null, sx = 0, sy = 0, fired = false, dragging = false, down = false, ghost = null;
    const canAct = () => side === "you" && m.canAttack && S.turn === "you" && !busy && !over;
    function showTargets(on) {
      const ta = taunts("cpu");
      document.querySelectorAll('.tcg-min[data-side="cpu"]').forEach((e) => {
        const mm = findMin("cpu", +e.dataset.uid);
        e.classList.toggle("tgt", on && !!mm && (!ta.length || mm.keywords.includes("taunt")));
      });
      if (heroNode.cpu) heroNode.cpu.classList.toggle("tgt", on && !ta.length);
      if (m.heal) document.querySelectorAll('.tcg-min[data-side="you"]').forEach((e) => { if (+e.dataset.uid !== m.uid) e.classList.toggle("htgt", on); });
    }
    function startDrag() {
      clearGhosts();
      dragging = true; el.classList.add("dragging-min");
      ghost = el.cloneNode(true);
      ghost.classList.remove("ready", "sel", "tgt", "htgt", "dragging-min");
      ghost.classList.add("tcg-mghost");
      ghost.style.cssText += `position:absolute;z-index:85;pointer-events:none;opacity:.96;margin:0;width:${el.getBoundingClientRect().width}px;`;
      api.root.append(ghost);
      showTargets(true);
    }
    function moveGhost(x, y) { const o = rootRect(); ghost.style.left = x - o.left + "px"; ghost.style.top = y - o.top + "px"; ghost.style.transform = "translate(-50%,-50%) scale(1.06)"; }
    function endDrag(x, y) {
      if (ghost) { ghost.remove(); ghost = null; }
      showTargets(false);
      el.classList.remove("dragging-min");
      const tgt = dropTarget(x, y);
      if (tgt && canAct()) {
        const ta = taunts("cpu");
        if (tgt.hero === "cpu") { if (!ta.length) doAttack("you", m.uid, "hero"); }
        else if (tgt.side === "cpu") { const dm = findMin("cpu", tgt.uid); if (dm && (!ta.length || dm.keywords.includes("taunt"))) doAttack("you", m.uid, tgt.uid); }
        else if (tgt.side === "you" && m.heal && tgt.uid !== m.uid) doHeal("you", m.uid, tgt.uid);
      }
      render();
    }
    el.addEventListener("pointerdown", (e) => { down = true; sx = e.clientX; sy = e.clientY; fired = false; dragging = false; try { el.setPointerCapture(e.pointerId); } catch {} t = setTimeout(() => { t = null; fired = true; showInfo(minionInfo(m)); }, 450); });
    el.addEventListener("pointermove", (e) => { if (!down) return; if (!dragging && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { if (t) { clearTimeout(t); t = null; } if (canAct()) startDrag(); } if (dragging) { e.preventDefault(); moveGhost(e.clientX, e.clientY); } });
    el.addEventListener("pointerup", (e) => { down = false; try { el.releasePointerCapture(e.pointerId); } catch {} if (t) { clearTimeout(t); t = null; } if (dragging) endDrag(e.clientX, e.clientY); else if (!fired) onMinion(side, m.uid); });
    el.addEventListener("pointercancel", () => { down = false; if (t) { clearTimeout(t); t = null; } if (dragging) { if (ghost) ghost.remove(); showTargets(false); el.classList.remove("dragging-min"); render(); } });
  }
  function heroBar(side) {
    const me = side === "you";
    const bar = E("div", "tcg-hero " + (me ? "me" : "foe"));
    const port = E("div", "tcg-port" + (me ? "" : " foep"), `<div class="tcg-hp">${S.hp[side]}</div>`);
    port.dataset.hero = side;
    if (!me && sel && (sel.t === "atk" ? !taunts("cpu").length : sel.t === "spell" && S.hand.you[sel.idx] && S.hand.you[sel.idx].effect.kind === "damage")) port.classList.add("tgt");
    port.onclick = () => onHero(side);
    heroNode[side] = port;
    const info = E("div", null, `<div class="tcg-nm2">${me ? "You" : "Commander"}</div>`);
    const mana = E("div", "tcg-mana");
    for (let i = 0; i < Math.max(S.maxMana[side], 1); i++) mana.append(E("div", "tcg-cry" + (i < S.mana[side] ? "" : " empty")));
    info.append(mana);
    bar.append(port, info);
    return bar;
  }
  function handEl() {
    const wrap = E("div", "tcg-hand");
    S.hand.you.forEach((card, idx) => {
      const r = RARITY[card.rarity];
      const ok = card.cost <= S.mana.you && S.turn === "you" && !busy && !over && (card.type !== "minion" || S.board.you.length < 7);
      let cls = "tcg-hc " + (ok ? "playable" : "dim");
      if (sel && (sel.t === "spell" || sel.t === "sel") && sel.idx === idx) cls += " sel";
      const stats = card.type === "minion" ? `<div class="sa">${card.atk}</div><div class="sh">${card.hp}</div>` : `<div class="spl">SPELL</div>`;
      const el = E("div", cls, `<div class="c">${card.cost}</div><div class="ha" style="--a1:${r.a1};--a2:${r.a2}">${glyph(card.id)}</div><div class="hn">${card.name}</div><div class="tcg-mk">${allChips(card)}</div>${stats}`);
      el.style.setProperty("--rar", r.color); el.style.zIndex = idx; el.style.touchAction = "none";
      bindHand(el, idx, card);
      wrap.append(el);
    });
    return wrap;
  }
  function renderDuel() {
    nodeOf.clear(); heroNode = {};
    const yf = FIELDS[duelFields.you].css, ef = FIELDS[duelFields.enemy].css;
    root.innerHTML = `<div class="tcg-bg"><div class="enemy" style="background:${ef}"></div><div class="mine" style="background:${yf}"></div><div class="split"></div></div>`;
    const board = E("div", "tcg-board");
    const eLane = E("div", "tcg-lane"); S.board.cpu.forEach((m) => eLane.append(minionEl("cpu", m)));
    const mLane = E("div", "tcg-lane"); S.board.you.forEach((m) => mLane.append(minionEl("you", m)));
    board.append(eLane, mLane);
    const fbacks = E("div", "tcg-fbacks"); for (let i = 0; i < S.hand.cpu.length; i++) fbacks.append(E("div", "tcg-bk"));
    const back = E("button", "tcg-duelback", BACK_SVG);
    back.onclick = () => { gen++; busy = false; over = false; go("menu"); };
    const end = E("button", "tcg-endturn", "End Turn ▸");
    end.disabled = busy || over || S.turn !== "you";
    end.onclick = () => { if (!busy && !over && S.turn === "you") { sel = null; cpuTurn(); } };
    root.append(board, heroBar("cpu"), heroBar("you"), handEl(), fbacks, back, end);
    applyFx();
  }
  function toast(text) { const t = E("div", "tcg-toast", text); root.append(t); setTimeout(() => t.remove(), 1100); }
  function popup(title, msg, rew, buttons) {
    const back = E("div", "tcg-pop");
    const box = E("div", "box", `<h2>${title}</h2><p>${msg}</p>${rew ? `<div class="rew">${rew}</div>` : ""}`);
    buttons.forEach((b) => { const btn = E("button", b.cls, b.label); btn.onclick = () => { back.remove(); b.fn(); }; box.append(btn); });
    back.append(box); root.append(back);
  }

  /* ---------------- router ---------------- */
  // remove any drag ghost left on api.root (overlapping/interrupted drags can
  // orphan one; it survives re-renders since it's a sibling of `root`)
  function clearGhosts() { api.root.querySelectorAll(".tcg-ghost, .tcg-mghost").forEach((g) => g.remove()); }

  function render() {
    clearGhosts();
    if (view === "duel") { renderDuel(); return; }
    root.innerHTML = "";
    if (view === "menu") root.append(menuView());
    else if (view === "shop") root.append(shopView());
    else if (view === "reveal") root.append(revealView());
    else if (view === "collection") root.append(collectionView());
    else if (view === "deck") root.append(deckView());
    else if (view === "fields") root.append(fieldsView());
    else root.append(menuView());
  }

  render();
  return {
    destroy() {
      gen++;
      clearGhosts();
      api.root.style.position = "";
      fxLayer.remove();
      style.remove();
    },
  };
}
