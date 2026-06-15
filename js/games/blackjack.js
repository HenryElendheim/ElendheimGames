/* ============================================================
   Blackjack — vs dealer
   Hit / Stand. Dealer draws to 17. Beat the dealer to 21 without
   busting. Tracks wins + streak.
   ============================================================ */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

const STYLE = `
.bj-wrap { flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:14px; padding:18px; }
.bj-area { display:flex; flex-direction:column; align-items:center; gap:8px; }
.bj-area h3 { margin:0; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim); font-weight:700; }
.bj-hand { display:flex; gap:8px; min-height:96px; justify-content:center; flex-wrap:wrap; }
.bj-card { width:64px; height:92px; border-radius:10px; background:#fbfbfb; color:#1a1a1a; position:relative;
  box-shadow:0 4px 10px rgba(0,0,0,.4); display:grid; place-items:center; font-size:30px; font-weight:800;
  animation:bj-deal .2s ease; }
.bj-card.red { color:#d63a2f; }
.bj-card .rk { position:absolute; top:5px; left:7px; font-size:15px; }
.bj-card.back { background:repeating-linear-gradient(45deg,#5b6bd6,#5b6bd6 6px,#4453b0 6px,#4453b0 12px); }
.bj-total { font-size:20px; font-weight:800; }
.bj-msg { text-align:center; font-size:20px; font-weight:800; min-height:26px; }
.bj-msg.pop { animation:bj-pop .45s ease; }
.bj-card.flip { animation:bj-flip .4s ease; }
@keyframes bj-deal { from{transform:translateY(-14px);opacity:.3;} to{transform:none;opacity:1;} }
@keyframes bj-flip { from{transform:rotateY(90deg);} to{transform:rotateY(0);} }
@keyframes bj-pop { 0%{transform:scale(.6);opacity:0;} 60%{transform:scale(1.15);} 100%{transform:scale(1);opacity:1;} }
`;

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let deck, player, dealer, phase, revealed, flipReveal;

  const dealerArea = area("Dealer");
  const msg = document.createElement("div");
  msg.className = "bj-msg";
  const playerArea = area("You");
  const wrap = document.createElement("div");
  wrap.className = "bj-wrap";
  wrap.append(dealerArea.root, msg, playerArea.root);
  api.root.append(wrap);

  api.onRestart(start);
  api.setFooter([
    { icon: "", label: "Hit", onClick: hit, accent: true },
    { icon: "", label: "Stand", onClick: stand },
  ]);

  function area(label) {
    const h = document.createElement("h3");
    h.textContent = label;
    const total = document.createElement("div");
    total.className = "bj-total";
    const hand = document.createElement("div");
    hand.className = "bj-hand";
    const root = document.createElement("div");
    root.className = "bj-area";
    root.append(h, hand, total);
    return { root, hand, total };
  }

  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
  }

  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function value(cards) {
    let sum = 0,
      aces = 0;
    for (const c of cards) {
      if (c.r === "A") {
        aces++;
        sum += 11;
      } else if (["K", "Q", "J", "10"].includes(c.r)) sum += 10;
      else sum += +c.r;
    }
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }
    return sum;
  }

  function cardEl(c) {
    const el = document.createElement("div");
    el.className = "bj-card" + (c.s === "♥" || c.s === "♦" ? " red" : "");
    el.innerHTML = `<span class="rk">${c.r}</span>${c.s}`;
    return el;
  }

  function render() {
    playerArea.hand.replaceChildren(...player.map(cardEl));
    playerArea.total.textContent = value(player);
    if (revealed) {
      dealerArea.hand.replaceChildren(...dealer.map(cardEl));
      dealerArea.total.textContent = value(dealer);
      if (flipReveal) {
        const hole = dealerArea.hand.children[1];
        if (hole) hole.classList.add("flip");
        flipReveal = false;
      }
    } else {
      const back = document.createElement("div");
      back.className = "bj-card back";
      dealerArea.hand.replaceChildren(cardEl(dealer[0]), back);
      dealerArea.total.textContent = value([dealer[0]]) + " + ?";
    }
  }

  function setFooterEnabled(on) {
    api.setFooter([
      { icon: "", label: "Hit", onClick: hit, accent: true, disabled: !on },
      { icon: "", label: "Stand", onClick: stand, disabled: !on },
    ]);
  }

  function start() {
    deck = makeDeck();
    player = [deck.pop(), deck.pop()];
    dealer = [deck.pop(), deck.pop()];
    phase = "player";
    revealed = false;
    flipReveal = false;
    msg.textContent = "";
    pills();
    setFooterEnabled(true);
    render();
    if (value(player) === 21) stand(); // natural blackjack
  }

  function hit() {
    if (phase !== "player") return;
    player.push(deck.pop());
    render();
    if (value(player) > 21) settle();
  }

  function stand() {
    if (phase !== "player") return;
    phase = "dealer";
    flipReveal = true; // flip the hole card as it's revealed
    revealed = true;
    setFooterEnabled(false);
    render();
    const step = () => {
      if (value(dealer) < 17) {
        dealer.push(deck.pop());
        render();
        setTimeout(step, 450);
      } else settle();
    };
    setTimeout(step, 450);
  }

  function settle() {
    phase = "done";
    if (!revealed) flipReveal = true; // reveal-on-bust also flips the hole card
    revealed = true;
    setFooterEnabled(false);
    render();
    const p = value(player),
      d = value(dealer);
    let result, win;
    if (p > 21) {
      result = "Bust! Dealer wins";
      win = false;
    } else if (d > 21) {
      result = "Dealer busts — you win!";
      win = true;
    } else if (p > d) {
      result = "You win!";
      win = true;
    } else if (p < d) {
      result = "Dealer wins";
      win = false;
    } else {
      result = "Push — it's a tie";
      win = null;
    }
    msg.textContent = result;
    msg.classList.remove("pop");
    void msg.offsetWidth; // restart the pulse animation
    msg.classList.add("pop");
    if (win === true) api.reportWin();
    else if (win === false) api.reportLoss();
    pills();

    api.showModal({
      title: result,
      statsRows: [
        { label: "You", value: p },
        { label: "Dealer", value: d },
        { label: "Streak", value: api.refreshStats().streak },
      ],
      primaryLabel: "Deal Again",
      onPrimary: start,
    });
  }

  start();
  return { destroy: () => style.remove() };
}
