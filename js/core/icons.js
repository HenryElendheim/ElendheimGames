/* ============================================================
   Drawn SVG icons — no emoji anywhere.
   gameIcon(id) renders the art for each game tile / detail hero.
   uiIcon(name) renders small UI glyphs (trophy, plays, chart).
   ============================================================ */

const NS = "http://www.w3.org/2000/svg";

function make(inner, vb = "0 0 100 100") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", vb);
  svg.innerHTML = inner;
  return svg;
}

const GAME = {
  "elendheim-tcg":
    `<rect x="20" y="26" width="42" height="56" rx="6" fill="#8b5cf6" transform="rotate(-9 41 54)"/>
     <rect x="40" y="20" width="44" height="58" rx="7" fill="#2b2540" stroke="#b9a6ff" stroke-width="2"/>
     <path d="M62 32l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z" fill="#ffd75e"/>`,
  "fruit-slasher":
    `<circle cx="48" cy="57" r="29" fill="#e23b2e"/>
     <circle cx="59" cy="49" r="7" fill="#ff8174"/>
     <rect x="45" y="22" width="6" height="14" rx="3" fill="#5fae3a"/>
     <path d="M50 32q13-9 22-3-11 2-17 11z" fill="#5fae3a"/>
     <line x1="16" y1="84" x2="86" y2="24" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  spiderette:
    `<path d="M50 16C68 38 84 46 84 62a15 15 0 0 1-26 10c1 9 6 13 11 18H31c5-5 10-9 11-18a15 15 0 0 1-26-10C16 46 32 38 50 16Z" fill="#dfe4ee"/>`,
  "kings-corners":
    `<rect x="38" y="12" width="24" height="34" rx="4" fill="#fafafa"/>
     <rect x="38" y="54" width="24" height="34" rx="4" fill="#fafafa"/>
     <rect x="12" y="38" width="34" height="24" rx="4" fill="#fafafa"/>
     <rect x="54" y="38" width="34" height="24" rx="4" fill="#fafafa"/>
     <rect x="40" y="40" width="20" height="20" rx="3" fill="#d4a017"/>
     <path d="M44 50l3-5 3 4 3-4 3 5z" fill="#fff"/>`,
  solitaire:
    `<rect x="14" y="24" width="34" height="48" rx="5" fill="#cfd4dd" transform="rotate(-9 31 48)"/>
     <rect x="40" y="20" width="38" height="54" rx="6" fill="#fafafa"/>
     <text x="46" y="40" font-size="15" font-weight="800" fill="#15294f" font-family="sans-serif">K</text>
     <text x="52" y="68" font-size="24" fill="#15294f" font-family="sans-serif">&#9824;</text>`,
  "tile-tap":
    `<rect x="16" y="10" width="68" height="84" rx="8" fill="#0d0e12"/>
     <rect x="24" y="18" width="22" height="22" rx="4" fill="#26e0b8"/>
     <rect x="54" y="46" width="22" height="22" rx="4" fill="#26e0b8"/>
     <rect x="24" y="70" width="22" height="16" rx="4" fill="#26e0b8"/>`,
  wordle:
    `<rect x="14" y="20" width="20" height="20" rx="3" fill="#6aaa64"/>
     <rect x="40" y="20" width="20" height="20" rx="3" fill="#3a3b45"/>
     <rect x="66" y="20" width="20" height="20" rx="3" fill="#c9b458"/>
     <rect x="14" y="46" width="20" height="20" rx="3" fill="#3a3b45"/>
     <rect x="40" y="46" width="20" height="20" rx="3" fill="#6aaa64"/>
     <rect x="66" y="46" width="20" height="20" rx="3" fill="#3a3b45"/>`,
  connect4:
    `<rect x="8" y="12" width="84" height="76" rx="13" fill="#2b3550"/>
     <circle cx="28" cy="37" r="11" fill="#15161a"/><circle cx="50" cy="37" r="11" fill="#f5a623"/><circle cx="72" cy="37" r="11" fill="#15161a"/>
     <circle cx="28" cy="63" r="11" fill="#e23b2e"/><circle cx="50" cy="63" r="11" fill="#f5a623"/><circle cx="72" cy="63" r="11" fill="#e23b2e"/>`,
  tictactoe:
    `<g stroke="#cdd3e0" stroke-width="6" stroke-linecap="round">
       <line x1="38" y1="12" x2="38" y2="88"/><line x1="62" y1="12" x2="62" y2="88"/>
       <line x1="12" y1="38" x2="88" y2="38"/><line x1="12" y1="62" x2="88" y2="62"/></g>
     <g stroke="#4fc3f7" stroke-width="6" stroke-linecap="round">
       <line x1="18" y1="18" x2="32" y2="32"/><line x1="32" y1="18" x2="18" y2="32"/>
       <line x1="68" y1="68" x2="82" y2="82"/><line x1="82" y1="68" x2="68" y2="82"/></g>
     <circle cx="50" cy="50" r="10" fill="none" stroke="#f5a623" stroke-width="6"/>`,
  "whack-a-mole":
    `<ellipse cx="50" cy="76" rx="34" ry="13" fill="#0d0e12"/>
     <circle cx="50" cy="50" r="24" fill="#9a6a3c"/>
     <circle cx="50" cy="58" r="15" fill="#caa074"/>
     <circle cx="42" cy="46" r="4" fill="#1a1a1a"/><circle cx="58" cy="46" r="4" fill="#1a1a1a"/>
     <circle cx="50" cy="55" r="4" fill="#5a3a22"/>`,
  blackjack:
    `<rect x="18" y="34" width="38" height="50" rx="6" fill="#dadada" transform="rotate(-10 37 59)"/>
     <rect x="44" y="26" width="38" height="52" rx="6" fill="#fafafa"/>
     <text x="50" y="44" font-size="15" font-weight="800" fill="#1a1a1a" font-family="sans-serif">A</text>
     <text x="55" y="72" font-size="24" fill="#1a1a1a" font-family="sans-serif">&#9824;</text>`,
  chess:
    `<text x="30" y="70" font-size="50" fill="#e9edf4" text-anchor="middle" font-family="'Baloo 2', sans-serif">&#9818;</text>
     <text x="70" y="70" font-size="50" fill="#20242e" stroke="#c8cedb" stroke-width="1.6" paint-order="stroke" text-anchor="middle" font-family="'Baloo 2', sans-serif">&#9818;</text>`,
  tetris:
    `<g stroke="#15161a" stroke-width="2">
       <rect x="26" y="28" width="16" height="16" fill="#7c4dff"/><rect x="42" y="28" width="16" height="16" fill="#7c4dff"/>
       <rect x="58" y="28" width="16" height="16" fill="#7c4dff"/><rect x="42" y="44" width="16" height="16" fill="#7c4dff"/>
       <rect x="26" y="62" width="16" height="16" fill="#4dd0e1"/><rect x="42" y="62" width="16" height="16" fill="#4dd0e1"/></g>`,
  "block-blast":
    `<g stroke="#15161a" stroke-width="2">
       <rect x="28" y="26" width="18" height="18" rx="3" fill="#ff4081"/><rect x="28" y="46" width="18" height="18" rx="3" fill="#ff4081"/>
       <rect x="28" y="66" width="18" height="18" rx="3" fill="#ff4081"/><rect x="48" y="66" width="18" height="18" rx="3" fill="#ff4081"/>
       <rect x="66" y="26" width="14" height="14" rx="3" fill="#18c29c"/></g>`,
};

const UI = {
  trophy:
    `<path d="M28 18h44v14a22 22 0 0 1-44 0Z" fill="#f5a623"/>
     <path d="M28 22H16v6a14 14 0 0 0 14 12M72 22h12v6a14 14 0 0 1-14 12" fill="none" stroke="#f5a623" stroke-width="5"/>
     <rect x="44" y="48" width="12" height="14" fill="#f5a623"/><rect x="32" y="62" width="36" height="9" rx="4" fill="#f5a623"/>`,
  plays:
    `<rect x="14" y="34" width="72" height="36" rx="18" fill="none" stroke="currentColor" stroke-width="7"/>
     <line x1="30" y1="44" x2="30" y2="60" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
     <line x1="22" y1="52" x2="38" y2="52" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
     <circle cx="66" cy="48" r="5" fill="currentColor"/><circle cx="74" cy="58" r="5" fill="currentColor"/>`,
  chart:
    `<rect x="18" y="50" width="15" height="30" rx="2" fill="currentColor"/>
     <rect x="42" y="32" width="15" height="48" rx="2" fill="currentColor"/>
     <rect x="66" y="42" width="15" height="38" rx="2" fill="currentColor"/>`,
  spider:
    `<g fill="none" stroke="#241046" stroke-width="5" stroke-linecap="round">
       <path d="M40 40 L18 28 M40 49 L14 44 M40 57 L14 60 M40 64 L18 74"/>
       <path d="M60 40 L82 28 M60 49 L86 44 M60 57 L86 60 M60 64 L82 74"/>
     </g>
     <ellipse cx="50" cy="54" rx="13" ry="17" fill="#241046"/>
     <circle cx="50" cy="36" r="9" fill="#241046"/>`,
  gear:
    `<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round">
       <circle cx="50" cy="50" r="19"/>
       <line x1="50" y1="13" x2="50" y2="23"/><line x1="50" y1="77" x2="50" y2="87"/>
       <line x1="13" y1="50" x2="23" y2="50"/><line x1="77" y1="50" x2="87" y2="50"/>
       <line x1="24" y1="24" x2="31" y2="31"/><line x1="69" y1="69" x2="76" y2="76"/>
       <line x1="76" y1="24" x2="69" y2="31"/><line x1="31" y1="69" x2="24" y2="76"/></g>
     <circle cx="50" cy="50" r="6" fill="currentColor"/>`,
};

/* gameIcon(id, image)
   If a game provides an `image` (a path/URL to a PNG/JPG/SVG/WebP), render it
   as an <img> so finished art can be dropped in with no other changes. With no
   image, fall back to the drawn SVG glyph for that game. */
export function gameIcon(id, image) {
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.className = "game-art-img";
    return img;
  }
  return make(GAME[id] || `<circle cx="50" cy="50" r="30" fill="currentColor"/>`);
}

export function uiIcon(name) {
  return make(UI[name] || "");
}

/* The standard back chevron — bold, centred, used by every back button. */
export function backIcon() {
  return make(
    `<path d="M14 5L8 12l6 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    "0 0 24 24"
  );
}
