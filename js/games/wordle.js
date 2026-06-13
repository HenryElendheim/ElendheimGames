/* ============================================================
   Word Quest (a Wordle-style game)
   Six guesses for a hidden five-letter word. Any five letters are
   accepted as a guess. Tracks wins + streak.
   ============================================================ */

const WORDS = (
  "about above actor acute admit adopt adult after again agent alarm album alert " +
  "alike alive allow alone along alter among angle angry apart apple apply arena " +
  "argue arise array aside asset audio audit avoid award aware badly baker bases " +
  "basic beach began begin being below bench billy birth black blame blank blast " +
  "blind block blood board boost booth bound brain brand brave bread break breed " +
  "brief bring broad brown build built buyer cabin cable carry catch cause chain " +
  "chair chaos charm chart chase cheap check chess chest chief child china chose " +
  "civil claim class clean clear click climb clock close cloud coach coast could " +
  "count court cover craft crash crazy cream crime cross crowd crown crude curve " +
  "cycle daily dance dealt death debut delay depth doing doubt dozen draft drama " +
  "drank dream dress drill drink drive drove dying eager early earth eight elite " +
  "empty enemy enjoy enter entry equal error event every exact exist extra faith " +
  "false fault fiber field fifth fifty fight final first fixed flash fleet floor " +
  "fluid focus force forth forty forum found frame frank fraud fresh front fruit " +
  "fully funny ghost giant given glass globe glory grace grade grand grant grass " +
  "great green gross group grown guard guess guest guide happy harsh heart heavy " +
  "hello hence horse hotel house human ideal image index inner input issue joint " +
  "judge known label large laser later laugh layer learn lease least leave legal " +
  "lemon level light limit lined links lives local logic loose lower lucky lunch " +
  "lying magic major maker march match maybe mayor meant medal media metal might " +
  "minor minus mixed model money month moral motor mount mouse mouth movie music " +
  "needs nerve never newly night noise north noted novel nurse ocean offer often " +
  "order other ought paint panel paper party peace phase phone photo piano piece " +
  "pilot pitch place plain plane plant plate point pound power press price pride " +
  "prime print prior prize proof proud prove queen quick quiet quite radio raise " +
  "range rapid ratio reach ready realm rebel refer relax reply rider ridge right " +
  "rigid risky river robot rocky roman rough round route royal rural scale scene " +
  "scope score sense serve seven shall shape share sharp sheet shelf shell shift " +
  "shine shirt shock shoot shore short shown sight since sixth sixty sized skill " +
  "sleep slide small smart smile smoke solid solve sorry sound south space spare " +
  "speak speed spend spent spice split spoke sport staff stage stake stand start " +
  "state steam steel steep steer stick still stock stone stood store storm story " +
  "strip stuck study stuff style sugar suite super sweet table taken taste taxes " +
  "teach teeth terms thank theft their theme there these thick thing think third " +
  "those three threw throw tiger tight times tired title today token tooth topic " +
  "total touch tough tower toxic trace track trade trail train treat trend trial " +
  "tribe trick tried tries truck truly trust truth twice under undue union unity " +
  "until upper upset urban usage usual valid value video virus visit vital vocal " +
  "voice waste watch water wheel where which while white whole whose woman world " +
  "worry worse worth would wound write wrong wrote yield young youth"
).split(" ");

const ROWS = 6;
const COLS = 5;

const STYLE = `
.wd-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:10px; padding:10px 8px; }
.wd-grid { display:grid; grid-template-rows:repeat(${ROWS},1fr); gap:6px; }
.wd-row { display:grid; grid-template-columns:repeat(${COLS},1fr); gap:6px; }
.wd-cell { width:13vw; max-width:58px; aspect-ratio:1; display:grid; place-items:center;
  font-size:7vw; font-weight:800; text-transform:uppercase; border-radius:8px;
  box-shadow:inset 0 0 0 2px #3a3b45; color:#fff; }
.wd-cell.fill { box-shadow:inset 0 0 0 2px #6a6b78; }
.wd-cell.correct { background:#6aaa64; box-shadow:none; }
.wd-cell.present { background:#c9b458; box-shadow:none; }
.wd-cell.absent { background:#3a3b45; box-shadow:none; }
.wd-kb { display:flex; flex-direction:column; gap:6px; width:100%; max-width:480px; }
.wd-krow { display:flex; gap:5px; justify-content:center; }
.wd-key { flex:1; max-width:38px; height:52px; border-radius:7px; background:#6a6b78; color:#fff;
  font-weight:800; font-size:15px; display:grid; place-items:center; text-transform:uppercase; }
.wd-key.wide { max-width:64px; font-size:12px; }
.wd-key.correct { background:#6aaa64; } .wd-key.present { background:#c9b458; } .wd-key.absent { background:#2a2b33; color:#888; }
`;

const KB = ["qwertyuiop", "asdfghjkl", "↵zxcvbnm⌫"];

export default function init(api) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  let answer, row, col, grid, done, keyState;

  const gridEl = document.createElement("div");
  gridEl.className = "wd-grid";
  const cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "wd-row";
    cellEls[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "wd-cell";
      rowEl.append(cell);
      cellEls[r][c] = cell;
    }
    gridEl.append(rowEl);
  }

  const kbEl = document.createElement("div");
  kbEl.className = "wd-kb";
  const keyEls = {};
  for (const line of KB) {
    const rEl = document.createElement("div");
    rEl.className = "wd-krow";
    for (const ch of line) {
      const k = document.createElement("button");
      k.className = "wd-key" + (ch === "↵" || ch === "⌫" ? " wide" : "");
      k.textContent = ch === "↵" ? "ENTER" : ch;
      k.addEventListener("click", () => press(ch));
      if (ch !== "↵" && ch !== "⌫") keyEls[ch] = k;
      rEl.append(k);
    }
    kbEl.append(rEl);
  }

  const wrap = document.createElement("div");
  wrap.className = "wd-wrap";
  wrap.append(gridEl, kbEl);
  api.root.append(wrap);

  const onKey = (e) => {
    if (e.key === "Enter") press("↵");
    else if (e.key === "Backspace") press("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKey);

  api.onRestart(start);

  function pills() {
    const s = api.refreshStats();
    api.setStats({ left: { label: "Streak", value: s.streak }, right: { label: "Wins", value: s.wins } });
  }

  function press(ch) {
    if (done) return;
    if (ch === "⌫") {
      if (col > 0) {
        col--;
        grid[row][col] = "";
        paint();
      }
    } else if (ch === "↵") {
      if (col === COLS) submit();
      else api.toast("Not enough letters");
    } else if (col < COLS) {
      grid[row][col] = ch;
      col++;
      paint();
    }
  }

  function paint() {
    for (let c = 0; c < COLS; c++) {
      const cell = cellEls[row][c];
      cell.textContent = grid[row][c] || "";
      cell.className = "wd-cell" + (grid[row][c] ? " fill" : "");
    }
  }

  function submit() {
    const guess = grid[row].join("");
    const result = score(guess, answer);
    for (let c = 0; c < COLS; c++) {
      cellEls[row][c].classList.add(result[c]);
      bumpKey(grid[row][c], result[c]);
    }
    if (guess === answer) return finish(true);
    row++;
    col = 0;
    if (row >= ROWS) return finish(false);
  }

  function bumpKey(ch, state) {
    const rank = { absent: 0, present: 1, correct: 2 };
    const cur = keyState[ch] || -1;
    if (rank[state] > cur) {
      keyState[ch] = rank[state];
      const k = keyEls[ch];
      if (k) {
        k.classList.remove("correct", "present", "absent");
        k.classList.add(state);
      }
    }
  }

  function finish(won) {
    done = true;
    if (won) api.reportWin();
    else api.reportLoss();
    pills();
    setTimeout(
      () =>
        api.showModal({
          title: won ? "Solved! 🎉" : "Out of guesses",
          message: won ? `In ${row + 1} ${row === 0 ? "guess" : "guesses"}!` : `The word was ${answer.toUpperCase()}`,
          statsRows: [
            { label: "Streak", value: api.refreshStats().streak },
            { label: "Wins", value: api.refreshStats().wins },
          ],
          primaryLabel: "New Word",
          onPrimary: start,
        }),
      400
    );
  }

  function start() {
    answer = WORDS[(Math.random() * WORDS.length) | 0];
    row = 0;
    col = 0;
    done = false;
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    keyState = {};
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        cellEls[r][c].textContent = "";
        cellEls[r][c].className = "wd-cell";
      }
    Object.values(keyEls).forEach((k) => k.classList.remove("correct", "present", "absent"));
    pills();
  }

  start();
  return {
    destroy() {
      window.removeEventListener("keydown", onKey);
      style.remove();
    },
  };
}

/* Wordle colouring with correct duplicate-letter handling. */
function score(guess, answer) {
  const res = Array(COLS).fill("absent");
  const counts = {};
  for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < COLS; i++)
    if (guess[i] === answer[i]) {
      res[i] = "correct";
      counts[guess[i]]--;
    }
  for (let i = 0; i < COLS; i++)
    if (res[i] !== "correct" && counts[guess[i]] > 0) {
      res[i] = "present";
      counts[guess[i]]--;
    }
  return res;
}
