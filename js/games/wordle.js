/* ============================================================
   Word Quest (a Wordle-style game)
   Six guesses for a hidden five-letter word. Guesses must be real
   words. One hint per game reveals a single letter.
   Tracks wins + streak.
   ============================================================ */

import { WORDS } from "./words.js";

const ROWS = 6;
const COLS = 5;
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

const STYLE = `
.wd-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:8px; padding:8px; }
.wd-hint { font-size:14px; font-weight:700; color:var(--accent); min-height:20px; text-align:center; }
.wd-grid { display:grid; grid-template-rows:repeat(${ROWS},1fr); gap:6px; }
.wd-row { display:grid; grid-template-columns:repeat(${COLS},1fr); gap:6px; }
.wd-cell { width:13vw; max-width:58px; aspect-ratio:1; display:grid; place-items:center;
  font-size:7vw; font-weight:800; text-transform:uppercase; border-radius:8px;
  box-shadow:inset 0 0 0 2px #3a3b45; color:#fff; }
.wd-cell.fill { box-shadow:inset 0 0 0 2px #6a6b78; }
.wd-cell.correct { background:#6aaa64; box-shadow:none; }
.wd-cell.present { background:#c9b458; box-shadow:none; }
.wd-cell.absent { background:#3a3b45; box-shadow:none; }
.wd-row.shake { animation:wd-shake .32s; }
@keyframes wd-shake { 0%,100%{transform:none} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
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

  const VALID = new Set(WORDS);
  let answer, row, col, grid, done, keyState, hintUsed, solved;

  const hintEl = document.createElement("div");
  hintEl.className = "wd-hint";

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
  wrap.append(hintEl, gridEl, kbEl);
  api.root.append(wrap);

  const onKey = (e) => {
    if (e.key === "Enter") press("↵");
    else if (e.key === "Backspace") press("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKey);

  api.onRestart(start);

  function setFooter() {
    api.setFooter([{ icon: "?", label: hintUsed ? "Hint used" : "Hint", onClick: useHint, disabled: hintUsed || done }]);
  }

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
    if (!VALID.has(guess)) {
      api.toast("Not in word list");
      const rowEl = cellEls[row][0].parentElement;
      rowEl.classList.remove("shake");
      void rowEl.offsetWidth; // restart the animation
      rowEl.classList.add("shake");
      return;
    }
    const result = score(guess, answer);
    for (let c = 0; c < COLS; c++) {
      cellEls[row][c].classList.add(result[c]);
      bumpKey(grid[row][c], result[c]);
      if (result[c] === "correct") solved.add(c);
    }
    if (guess === answer) return finish(true);
    row++;
    col = 0;
    if (row >= ROWS) return finish(false);
  }

  function useHint() {
    if (hintUsed || done) return;
    const unknown = [];
    for (let c = 0; c < COLS; c++) if (!solved.has(c)) unknown.push(c);
    const pool = unknown.length ? unknown : [...Array(COLS).keys()];
    const p = pool[(Math.random() * pool.length) | 0];
    hintEl.textContent = `Hint: ${ORDINALS[p]} letter is ${answer[p].toUpperCase()}`;
    hintUsed = true;
    setFooter();
  }

  function bumpKey(ch, state) {
    const rank = { absent: 0, present: 1, correct: 2 };
    const cur = keyState[ch] ?? -1;
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
    setFooter();
    if (won) api.reportWin();
    else api.reportLoss();
    pills();
    setTimeout(
      () =>
        api.showModal({
          title: won ? "Solved!" : "Out of guesses",
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
    hintUsed = false;
    solved = new Set();
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    keyState = {};
    hintEl.textContent = "";
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        cellEls[r][c].textContent = "";
        cellEls[r][c].className = "wd-cell";
      }
    Object.values(keyEls).forEach((k) => k.classList.remove("correct", "present", "absent"));
    setFooter();
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
