/* ChessQQ — UI papan, editor, panah prediksi, hasil analisis, mentor. */
import { Chess, validateFen } from "./chess.js?v=23";
import { mentorFor, alasanSingkat } from "./mentor.js?v=23";
import { detectOpening, SCENARIOS } from "./openings.js?v=23";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------- ikon SVG (pengganti emoji, satu sumber) ---------- */
const _ic = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  search: _ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  pencil: _ic('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
  trash: _ic('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
  download: _ic('<path d="M12 3v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>'),
  globe: _ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3z"/>'),
  chat: _ic('<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1-5.3A8.5 8.5 0 1 1 21 11.5z"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  x: _ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: _ic('<path d="M4 12l5 5L20 7"/>'),
  "chev-left": _ic('<path d="M15 6l-6 6 6 6"/>'),
  "chev-right": _ic('<path d="M9 6l6 6-6 6"/>'),
  "skip-back": _ic('<path d="M6 5v14"/><path d="M18 5l-9 7 9 7"/>'),
  "skip-fwd": _ic('<path d="M18 5v14"/><path d="M6 5l9 7-9 7"/>'),
  clipboard: _ic('<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h4"/>'),
  swap: _ic('<path d="M7 4L3 8l4 4"/><path d="M3 8h13"/><path d="M17 12l4 4-4 4"/><path d="M21 16H8"/>'),
  reset: _ic('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  cap: _ic('<path d="M12 4L2 9l10 5 10-5z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/><path d="M22 9v5"/>'),
  eraser: _ic('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
  back: _ic('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>'),
  warn: _ic('<path d="M12 3L2 21h20z"/><path d="M12 10v5"/><path d="M12 18.5v.5"/>'),
  target: _ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  share: _ic('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  undo: _ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: _ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
};
function paintIcons(root) {
  (root || document).querySelectorAll("[data-ic]").forEach((el) => {
    const n = el.getAttribute("data-ic");
    if (ICONS[n] && !el.dataset.done) { el.innerHTML = ICONS[n]; el.dataset.done = "1"; }
  });
}
/* ikon untuk konten dinamis: langsung kebungkus + ukurannya ikut CSS */
const ic = (n) => `<i data-ic="${n}" data-done="1">${ICONS[n]}</i>`;
paintIcons();
const squaresEl = $("squares"), arrowsEl = $("arrows"), fenInput = $("fen");
const ARROW_COLORS = ["#22c55e", "#eab308", "#ef4444"];

const chess = new Chess();
let orientation = "w";
let editMode = false;
let paletteSel = null; // {type,color} | "x" | null
let previewFen = null;
let depth = 16;
let lastResults = [];
let lastDepth = 0;
let autoSide = null; // 'w' | 'b' | null — warna yang dimainkan bot
let autoToken = 0;   // dibatalkan tiap ada aksi baru (ganti mode / stop)
const engine = new ChessEngine();

/* ---------- state v22: riwayat main bebas, pelatih, autosave ---------- */
let gameBaseFen = chess.fen(); // FEN awal urutan langkah main bebas saat ini
let redoStack = [];            // langkah (verbose) yang di-undo, untuk Redo
let coachToken = 0;            // membatalkan penilaian pelatih yang basi
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/* ---------- papan ---------- */
function boardOf(fen) {
  return new Chess(fen).board(); // [rank8..rank1][a..h]
}
function sqCenter(sq) {
  let f = sq.charCodeAt(0) - 97, r = +sq[1];
  let x = f, y = 8 - r;
  if (orientation === "b") { x = 7 - x; y = 7 - y; }
  return [x * 100 + 50, y * 100 + 50];
}
function renderBoard(fen) {
  fen = fen || chess.fen();
  squaresEl.innerHTML = "";
  const b = boardOf(fen);
  for (let ry = 0; ry < 8; ry++) {
    for (let fx = 0; fx < 8; fx++) {
      let f = fx, r = 7 - ry;
      if (orientation === "b") { f = 7 - fx; r = ry; }
      const sq = String.fromCharCode(97 + f) + (r + 1);
      const cell = b[ry][fx];
      const d = document.createElement("div");
      d.className = "sq " + ((fx + ry) % 2 === 0 ? "l" : "d");
      d.dataset.sq = sq;
      if (fx === 0) {
        const c = document.createElement("span");
        c.className = "coord rank"; c.textContent = r + 1; d.appendChild(c);
      }
      if (ry === 7) {
        const c = document.createElement("span");
        c.className = "coord file"; c.textContent = String.fromCharCode(97 + f); d.appendChild(c);
      }
      if (cell) {
        const img = document.createElement("img");
        img.src = "img/pieces/" + cell.color + cell.type.toUpperCase() + ".svg";
        img.alt = ""; img.draggable = false;
        d.appendChild(img);
      }
      d.addEventListener("pointerdown", (e) => onPointerDown(e, sq));
      squaresEl.appendChild(d);
    }
  }
  const t = new Chess(fen).turn();
  $("turn-chip").innerHTML = t === "w"
    ? '<span class="dot w"></span>Putih jalan'
    : '<span class="dot b"></span>Hitam jalan';
  paintSelection();
}

/* ---------- panah ---------- */
let lastArrowKey = "";
function drawOneArrow(from, to, color, w) {
  const [x1, y1] = sqCenter(from), [x2, y2] = sqCenter(to);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const hw = w * 1.4;
  const headLen = Math.min(66, len * 0.45);
  const sx = x1 + ux * 16, sy = y1 + uy * 16;
  const tx = x2 - ux * 26, ty = y2 - uy * 26;
  const bx = tx - ux * headLen, by = ty - uy * headLen;
  const d =
    `M${sx + nx * w / 2},${sy + ny * w / 2}` +
    `L${bx + nx * w / 2},${by + ny * w / 2}` +
    `L${bx + nx * hw},${by + ny * hw}` +
    `L${tx},${ty}` +
    `L${bx - nx * hw},${by - ny * hw}` +
    `L${bx - nx * w / 2},${by - ny * w / 2}` +
    `L${sx - nx * w / 2},${sy - ny * w / 2}Z`;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "arrow");
  const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shadow.setAttribute("d", d);
  shadow.setAttribute("fill", "rgba(5,6,9,.6)");
  shadow.setAttribute("transform", "translate(11,13)");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", color);
  p.setAttribute("stroke", "rgba(255,255,255,.35)");
  p.setAttribute("stroke-width", "3");
  p.setAttribute("stroke-linejoin", "round");
  p.setAttribute("fill-opacity", ".96");
  g.appendChild(shadow); g.appendChild(p);
  arrowsEl.appendChild(g);
}
function drawArrows(moves) {
  const top = moves.slice(0, 3);
  const key = top.map((m) => m.uci).join("|");
  if (key === lastArrowKey) return; // gambar ulang hanya kalau 3 besar berubah
  lastArrowKey = key;
  arrowsEl.innerHTML = "";
  const widths = [30, 26, 22];
  for (let i = top.length - 1; i >= 0; i--)
    drawOneArrow(top[i].from, top[i].to, ARROW_COLORS[i], widths[i] || 22);
}
/* Pasangan pelatih: hijau = saran langkah terbaik, merah = prediksi balasan musuh. */
function drawCoachPair(best, replyUci) {
  const key = "pair|" + (best ? best.uci : "") + "|" + (replyUci || "");
  if (key === lastArrowKey) return;
  lastArrowKey = key;
  arrowsEl.innerHTML = "";
  if (replyUci) drawOneArrow(replyUci.slice(0, 2), replyUci.slice(2, 4), "#ef4444", 25);
  if (best) drawOneArrow(best.from, best.to, "#22c55e", 30);
}
function clearArrows() { arrowsEl.innerHTML = ""; lastArrowKey = ""; }

/* ---------- FEN ---------- */
function syncFen() {
  fenInput.value = chess.fen(); fenInput.classList.remove("bad");
  updateOpeningLine(); saveState();
}
function loadFenString(s) {
  s = (s || "").trim();
  if (!s) return false;
  const v = validateFen(s);
  if (!v.ok) { fenInput.classList.add("bad"); setStatus("FEN tidak valid: " + v.error); return false; }
  exitPgn();
  chess.load(s);
  gameBaseFen = chess.fen(); redoStack = [];
  exitPreview(); syncFen(); renderBoard(); clearArrows(); renderHistory(); resetCoach();
  fenInput.classList.remove("bad");
  maybeAutoPlay();
  return true;
}
fenInput.addEventListener("change", () => loadFenString(fenInput.value));
fenInput.addEventListener("keydown", (e) => { if (e.key === "Enter") $("btn-analyze").click(); });
$("btn-paste").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (loadFenString(t)) setStatus("FEN ditempel dari clipboard.");
    else setStatus("Clipboard bukan FEN yang valid.");
  } catch (e) { setStatus("Clipboard tidak bisa dibaca — ketik/tempel manual."); fenInput.focus(); }
});
$("btn-start").addEventListener("click", () => {
  chess.reset(); exitPgn(); exitPreview();
  gameBaseFen = chess.fen(); redoStack = [];
  syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory(); resetCoach();
  $("scenario-note").hidden = true; $("scenario-sel").value = "";
  setStatus("Posisi awal dimuat.");
  maybeAutoPlay();
});
$("btn-clear").addEventListener("click", () => {
  chess.clear();
  chess.put({ type: "k", color: "w" }, "e1");
  chess.put({ type: "k", color: "b" }, "e8");
  exitPgn();
  gameBaseFen = chess.fen(); redoStack = [];
  exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory(); resetCoach();
  setStatus("Papan dibersihkan (raja tetap). Nyalakan ✏️ Edit untuk susun.");
  maybeAutoPlay();
});

/* ---------- PGN: buka game + navigator langkah ---------- */
let pgn = null; // {text, sans:[], idx}
function pgnHeaders() {
  try {
    const g = new Chess(); g.loadPgn(pgn.text);
    const h = g.header();
    return { w: h.White || "Putih", b: h.Black || "Hitam" };
  } catch (e) { return { w: "Putih", b: "Hitam" }; }
}
function openPgn(text) {
  text = (text || "").trim();
  if (!text) { setStatus("Tempel teks PGN dulu."); return false; }
  const g = new Chess();
  try { g.loadPgn(text); } catch (e) { setStatus("PGN tidak valid: " + e.message); return false; }
  const sans = g.history();
  if (!sans.length) { setStatus("PGN tidak berisi langkah."); return false; }
  pgn = { text, sans, idx: sans.length };
  $("pgn-panel").hidden = true;
  pgnGoto(sans.length);
  const h = pgnHeaders();
  setStatus(`Game dibuka: ${h.w} vs ${h.b}, ${sans.length} langkah.`);
  return true;
}
function pgnGoto(i) {
  if (!pgn) return;
  i = Math.max(0, Math.min(pgn.sans.length, i));
  pgn.idx = i;
  try {
    const g = new Chess();
    g.loadPgn(pgn.text);
    const n = g.history().length;
    for (let k = 0; k < n - i; k++) g.undo();
    chess.load(g.fen());
  } catch (e) { setStatus("Gagal pindah langkah."); return; }
  exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
  renderPgnNav();
}
function exitPgn() {
  if (!pgn) return;
  pgn = null;
  $("pgn-nav").hidden = true;
  $("pgn-moves").hidden = true;
}
function renderPgnNav() {
  const nav = $("pgn-nav"), mv = $("pgn-moves");
  if (!pgn) { nav.hidden = true; mv.hidden = true; return; }
  nav.hidden = false; mv.hidden = false;
  const i = pgn.idx, n = pgn.sans.length;
  const cur = i === 0 ? "posisi awal" : `${Math.ceil(i / 2)}. ${pgn.sans[i - 1]}`;
  $("pgn-label").textContent = `${i}/${n} · ${cur}`;
  let html = "";
  for (let k = 0; k < n; k += 2) {
    html += `<span class="pgn-no">${k / 2 + 1}.</span>`;
    html += `<button class="pgn-mv${k + 1 === i ? " on" : ""}" data-i="${k + 1}">${esc(pgn.sans[k])}</button>`;
    if (pgn.sans[k + 1])
      html += `<button class="pgn-mv${k + 2 === i ? " on" : ""}" data-i="${k + 2}">${esc(pgn.sans[k + 1])}</button>`;
  }
  mv.innerHTML = html;
  mv.querySelectorAll(".pgn-mv").forEach((b) =>
    b.addEventListener("click", () => pgnGoto(+b.dataset.i)));
  const on = mv.querySelector(".pgn-mv.on");
  if (on) on.scrollIntoView({ block: "nearest" });
}
$("btn-pgn").addEventListener("click", () => {
  $("pgn-panel").hidden = !$("pgn-panel").hidden;
  $("online-panel").hidden = true;
});
$("btn-pgn-close").addEventListener("click", () => { $("pgn-panel").hidden = true; });
$("btn-pgn-open").addEventListener("click", () => openPgn($("pgn-text").value));
$("pgn-first").addEventListener("click", () => pgnGoto(0));
$("pgn-prev").addEventListener("click", () => pgnGoto(pgn.idx - 1));
$("pgn-next").addEventListener("click", () => pgnGoto(pgn.idx + 1));
$("pgn-last").addEventListener("click", () => pgnGoto(pgn.sans.length));
$("pgn-exit").addEventListener("click", () => {
  exitPgn(); setStatus("PGN ditutup.");
});

/* ---------- game online: chess.com & lichess (API publik gratis) ---------- */
function chesscomResult(wr, br) {
  if (wr === "win") return "1–0";
  if (br === "win") return "0–1";
  return "½–½";
}
async function fetchChessCom(u) {
  const r = await fetch("https://api.chess.com/pub/player/" + encodeURIComponent(u) + "/games/archives");
  if (!r.ok) throw new Error("username tidak ketemu di chess.com");
  const j = await r.json();
  const arch = j.archives || [];
  if (!arch.length) return [];
  const g = await (await fetch(arch[arch.length - 1])).json();
  return (g.games || []).slice(-20).reverse().map((x) => ({
    pgn: x.pgn,
    white: x.white.username, black: x.black.username,
    res: chesscomResult(x.white.result, x.black.result),
    meta: (x.time_class || "") + (x.end_time ? " · " + new Date(x.end_time * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : ""),
  }));
}
async function fetchLichess(u) {
  const r = await fetch("https://lichess.org/api/games/user/" + encodeURIComponent(u) + "?max=20&pgnInJson=true",
    { headers: { Accept: "application/x-ndjson" } });
  if (!r.ok) throw new Error("username tidak ketemu di lichess");
  const t = await r.text();
  return t.trim().split("\n").filter(Boolean).map((line) => {
    const j = JSON.parse(line);
    return {
      pgn: j.pgn,
      white: j.players.white.user.name, black: j.players.black.user.name,
      res: j.winner === "white" ? "1–0" : j.winner === "black" ? "0–1" : "½–½",
      meta: (j.speed || "") + (j.createdAt ? " · " + new Date(j.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : ""),
    };
  });
}
function renderOnlineList(games) {
  const el = $("online-list");
  el.innerHTML = "";
  games.forEach((gm) => {
    const b = document.createElement("button");
    b.className = "online-game";
    b.innerHTML = `<b>${esc(gm.white)} <span class="vs">vs</span> ${esc(gm.black)}</b>` +
      `<span>${esc(gm.res)} · ${esc(gm.meta)}</span>`;
    b.addEventListener("click", () => {
      $("online-panel").hidden = true;
      if (openPgn(gm.pgn)) setStatus("Game dimuat — geser langkahnya, analisis posisi mana pun.");
    });
    el.appendChild(b);
  });
}
$("btn-online").addEventListener("click", () => {
  $("online-panel").hidden = !$("online-panel").hidden;
  $("pgn-panel").hidden = true;
});
$("btn-online-close").addEventListener("click", () => { $("online-panel").hidden = true; });
$("btn-online-go").addEventListener("click", async () => {
  const u = $("online-user").value.trim();
  if (!u) { setStatus("Isi username dulu."); return; }
  const src = $("online-src").value;
  setStatus("Mengambil game… (butuh internet)");
  $("online-list").innerHTML = "";
  try {
    const games = src === "chesscom" ? await fetchChessCom(u) : await fetchLichess(u);
    if (!games.length) { setStatus("Tidak ada game ketemu."); return; }
    renderOnlineList(games);
    setStatus(`${games.length} game terakhir ketemu — ketuk untuk buka.`);
  } catch (e) { setStatus("Gagal: " + e.message); }
});
$("btn-flip").addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  renderBoard(previewFen); drawArrows(lastResults);
  saveState();
});

/* ---------- editor ---------- */
const PIECES = [
  ["k", "w"], ["q", "w"], ["r", "w"], ["b", "w"], ["n", "w"], ["p", "w"],
  ["k", "b"], ["q", "b"], ["r", "b"], ["b", "b"], ["n", "b"], ["p", "b"],
];
function buildPalette() {
  const pal = $("palette");
  pal.innerHTML = "";
  PIECES.forEach(([t, c]) => {
    const b = document.createElement("button");
    b.innerHTML = `<img src="img/pieces/${c}${t.toUpperCase()}.svg" alt="">`;
    b.addEventListener("click", () => {
      paletteSel = { type: t, color: c };
      [...pal.children].forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
    });
    pal.appendChild(b);
  });
  const x = document.createElement("button");
  x.innerHTML = ic("eraser");
  x.title = "Penghapus";
  x.addEventListener("click", () => {
    paletteSel = "x";
    [...pal.children].forEach((el) => el.classList.remove("on"));
    x.classList.add("on");
  });
  pal.appendChild(x);
}
$("btn-edit").addEventListener("click", () => {
  editMode = !editMode;
  $("editor").hidden = !editMode;
  $("btn-edit").innerHTML = editMode
    ? ic("check") + "<span>Selesai edit</span>"
    : ic("pencil") + "<span>Susun manual</span>";
  paletteSel = null;
});
function fixCastling() {
  const placement = chess.fen().split(" ")[0];
  const at = (sq) => {
    const [f, r] = [sq.charCodeAt(0) - 97, 8 - +sq[1]];
    return boardOf(chess.fen())[r][f];
  };
  const is = (sq, t, c) => { const p = at(sq); return p && p.type === t && p.color === c; };
  let cs = "";
  if (is("e1", "k", "w") && is("h1", "r", "w")) cs += "K";
  if (is("e1", "k", "w") && is("a1", "r", "w")) cs += "Q";
  if (is("e8", "k", "b") && is("h8", "r", "b")) cs += "k";
  if (is("e8", "k", "b") && is("a8", "r", "b")) cs += "q";
  chess.load(`${placement} ${chess.turn()} ${cs || "-"} - 0 1`);
}
/* tap di mode edit: taruh/hapus bidak */
function editTap(sq) {
  if (!paletteSel) { setStatus("Pilih dulu bidak di palet (atau 🧽 penghapus)."); return; }
  if (paletteSel === "x") chess.remove(sq);
  else chess.put({ type: paletteSel.type, color: paletteSel.color }, sq);
  fixCastling(); syncFen(); renderBoard();
}
$("turn-w").addEventListener("click", () => setTurnUI("w"));
$("turn-b").addEventListener("click", () => setTurnUI("b"));
function setTurnUI(t) {
  chess.setTurn(t);
  $("turn-w").classList.toggle("on", t === "w");
  $("turn-b").classList.toggle("on", t === "b");
  syncFen(); renderBoard();
  maybeAutoPlay();
}

/* ---------- gerak bidak: ketuk-ketuk atau geser ---------- */
let sel = null;          // kotak yang dipilih
let hintMoves = [];      // langkah legal (verbose) dari sel
let dragGhost = null;

function paintSelection() {
  if (!sel) return;
  const sEl = squaresEl.querySelector('[data-sq="' + sel + '"]');
  if (sEl) sEl.classList.add("sel");
  hintMoves.forEach((m) => {
    const t = squaresEl.querySelector('[data-sq="' + m.to + '"]');
    if (!t) return;
    const dot = document.createElement("span");
    dot.className = "hint" + (m.captured ? " cap" : "");
    t.appendChild(dot);
  });
}
function clearSel() { sel = null; hintMoves = []; }

function tryMove(from, to) {
  try {
    const p = chess.get(from);
    if (!p) return false;
    const fenBefore = chess.fen();
    const wasPgn = !!pgn;
    const promo = (p.type === "p" && (to[1] === "8" || to[1] === "1")) ? "q" : undefined;
    const m = chess.move({ from, to, promotion: promo });
    if (!m) return false;
    if (engine.isBusy()) { engine.stop(); setAnalyzing(false); } // analisis posisi lama jangan menimpa posisi baru
    exitPgn();
    if (wasPgn) gameBaseFen = fenBefore;
    redoStack = [];
    exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory();
    setStatus("Langkah: " + m.san + " — pelatih menilai, atau tekan Analisis untuk prediksi lengkap.");
    coachClassify(fenBefore, m);
    maybeAutoPlay();
    return true;
  } catch (e) { return false; }
}

function onPointerDown(e, sq) {
  if (previewFen) exitPreview(); // ketuk papan selalu membatalkan pratinjau — jangan pernah terasa terkunci
  if (editMode) { editTap(sq); return; }
  e.preventDefault();
  if (sel && sq !== sel && tryMove(sel, sq)) { clearSel(); renderBoard(); return; }
  const pc = chess.get(sq);
  if (pc && sq !== sel) {
    sel = sq;
    try { hintMoves = chess.moves({ square: sq, verbose: true }); }
    catch (err) { hintMoves = []; }
    renderBoard();
    startGhost(e, sq);
  } else {
    clearSel(); renderBoard();
  }
}

function startGhost(e, sq) {
  const pc = chess.get(sq);
  if (!pc || !e.isPrimary) return;
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  const img = document.createElement("img");
  img.src = "img/pieces/" + pc.color + pc.type.toUpperCase() + ".svg";
  img.className = "drag-ghost";
  img.style.left = sx + "px"; img.style.top = sy + "px";
  document.body.appendChild(img);
  dragGhost = img;
  const onMove = (ev) => {
    if (!dragGhost) return;
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) moved = true;
    if (moved) { dragGhost.style.left = ev.clientX + "px"; dragGhost.style.top = ev.clientY + "px"; }
  };
  const onUp = (ev) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    if (!moved) return; // cuma tap → seleksi tetap, tunggu ketukan kedua
    let to = null;
    try {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const sqEl = el && el.closest ? el.closest("[data-sq]") : null;
      to = sqEl ? sqEl.dataset.sq : null;
    } catch (err) { /* abaikan */ }
    clearSel();
    if (to && to !== sq) tryMove(sq, to); else renderBoard();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/* ---------- engine ---------- */
function setStatus(t) { $("engine-status").textContent = t; }
function setAnalyzing(on) {
  const b = $("btn-analyze");
  b.innerHTML = on ? ic("stop") + "<span>Stop</span>" : ic("search") + "<span>Analisis</span>";
  b.classList.toggle("stop", on);
}
function cpToWhitePov(kind, val, turn) {
  let v = kind === "mate" ? (val > 0 ? 100000 : -100000) : val;
  return turn === "w" ? v : -v;
}
function fmtEval(wp, kind) {
  if (kind === "mate") return wp > 0 ? "#+" : "#−";
  const p = wp / 100;
  return (p > 0 ? "+" : "") + p.toFixed(2);
}
function uciToSan(fen, uci) {
  try {
    const m = new Chess(fen).move({
      from: uci.slice(0, 2), to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return m ? m.san : null;
  } catch (e) { return null; }
}
function pvToSans(fen, pv, n) {
  const out = [];
  try {
    const c = new Chess(fen);
    for (const u of pv.slice(0, n || 10)) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
      if (!m) break;
      out.push(m.san);
    }
  } catch (e) { /* berhenti */ }
  return out;
}
function evalTextOf(wp, kind) {
  if (kind === "mate")
    return wp > 0 ? "Evaluasi: # (Putih Menang — Skakmat Paksa)" : "Evaluasi: # (Hitam Menang — Skakmat Paksa)";
  const p = wp / 100, a = Math.abs(p);
  const side = p > 0 ? "Putih" : "Hitam";
  let cat = "Seimbang";
  if (a >= 0.25 && a < 0.75) cat = side + " Unggul Tipis";
  else if (a >= 0.75 && a < 1.75) cat = side + " Unggul";
  else if (a >= 1.75 && a < 3.5) cat = side + " Unggul Besar";
  else if (a >= 3.5) cat = side + " Menang Telak";
  return `Evaluasi: ${p > 0 ? "+" : ""}${p.toFixed(2)} (${cat})`;
}
function setEvalBar(wp, kind) {
  let pct;
  if (kind === "mate") pct = wp > 0 ? 100 : 0;
  else pct = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * wp)) - 1);
  $("evalfill").style.height = pct.toFixed(1) + "%";
  $("evallabel").textContent = kind === "mate" ? (wp > 0 ? "#+" : "#−") : (wp / 100).toFixed(1);
  $("eval-text").textContent = evalTextOf(wp, kind);
}
function onEngineUpdate(lines, d) {
  lastDepth = d;
  const fen = chess.fen(), turn = chess.turn();
  lastResults = lines.filter(Boolean).map((L) => {
    const uci = L.pv[0];
    const wp = cpToWhitePov(L.kind, L.val, turn);
    return {
      uci, from: uci.slice(0, 2), to: uci.slice(2, 4),
      san: uciToSan(fen, uci) || uci,
      eval: fmtEval(wp, L.kind), wp, kind: L.kind,
      score: L.val, // mentah, relatif ke pihak yang jalan (untuk mentor)
      pv: pvToSans(fen, L.pv, 12),
      pvUci: L.pv.slice(0, 12),
    };
  });
  renderResults();
  if (lastResults[0] && lastResults[0].pvUci && lastResults[0].pvUci[1])
    drawCoachPair(lastResults[0], lastResults[0].pvUci[1]); // hijau: terbaik · merah: balasan musuh
  else drawArrows(lastResults);
  if (lastResults[0]) setEvalBar(lastResults[0].wp, lastResults[0].kind);
  setStatus(`Mikir… depth ${d}/${depth} — panah update live.`);
}
function renderResults() {
  const card = $("results-card"), ol = $("moves");
  if (!lastResults.length) { card.hidden = true; return; }
  card.hidden = false;
  const turn = chess.turn(), fen = chess.fen();
  $("predict-note").textContent =
    `Giliran ${turn === "w" ? "putih" : "hitam"} — ini 3 langkah terbaik menurut Stockfish. ` +
    (turn === "b" ? "Kalau kamu putih, panah hijau ≈ musuh bakal jalan ke situ." : "Ketuk langkah untuk pratinjau di papan, 💬 untuk tanya mentor.");
  const th = $("threat-line"), t0 = lastResults[0];
  if (t0) {
    th.hidden = false;
    th.innerHTML = `${ic("warn")} <span>Ancaman utama: <b>${esc(t0.san)}</b> — ${esc(alasanSingkat(fen, t0))}</span>`;
  } else th.hidden = true;
  ol.innerHTML = "";
  lastResults.forEach((m, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="rank r${i + 1}">${i + 1}</span>` +
      `<div class="mv-main"><div class="san">${m.san}</div><div class="pv">${m.pv.join(" ")}</div></div>` +
      `<span class="eval ${String(m.eval).startsWith("-") ? "minus" : "plus"}">${m.eval}</span>`;
    const ask = document.createElement("button");
    ask.className = "mini ask";
    ask.innerHTML = ic("chat");
    ask.title = "Tanya mentor soal langkah ini";
    ask.addEventListener("click", (e) => { e.stopPropagation(); openMentorFor(i); });
    li.appendChild(ask);
    li.addEventListener("click", () => previewMove(i));
    ol.appendChild(li);
  });
  coachFromResults();
  renderMentor();
}
function hideResults() { $("results-card").hidden = true; closeMentor(); lastResults = []; }

/* ---------- mentor (tombol melayang + popup) ---------- */
function openMentor() {
  renderMentor();
  $("mentor-modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeMentor() {
  const md = $("mentor-modal");
  if (md) md.hidden = true;
  document.body.style.overflow = "";
}
function openMentorFor(i) {
  const chosen = lastResults[i];
  if (!chosen) return;
  const rotated = [chosen, ...lastResults.filter((_, j) => j !== i)];
  renderMentor(rotated);
  $("mentor-modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function renderMentor(results) {
  results = results || lastResults;
  const body = $("mentor-body");
  const turn = chess.turn();
  let m;
  try { m = mentorFor(chess.fen(), results, turn); }
  catch (e) { body.innerHTML = "<p class='tip'>Mentor gagal membaca posisi.</p>"; return; }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let html = `<p class="mentor-title">${esc(m.judul)}</p>`;
  if (m.selesai) {
    html += `<ul class="mentor-list">${m.baris.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
  } else {
    html += `<div class="mentor-rec"><span class="mentor-san">${esc(m.langkah)}</span>` +
      `<button id="btn-mentor-play" class="primary small">${ic("play")}<span>Mainkan</span></button></div>`;
    html += `<p class="mentor-sub">💡 Kenapa langkah ini?</p>`;
    html += `<ul class="mentor-list">${m.baris.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
    if (m.rencana && m.rencana.length)
      html += `<p class="mentor-sub">🗺️ Rencana berikutmu:</p><ul class="mentor-list plan">` +
        m.rencana.map((r) => `<li><b>${esc(r.san)}</b> — ${esc(r.alasan)}</li>`).join("") + `</ul>`;
    if (m.alternatif.length)
      html += `<p class="mentor-alt"><b>Pilihan lain:</b> ` +
        m.alternatif.map((a) => `${esc(a.san)} <span class="alt-why">(${esc(a.alasan)})</span>`).join(" · ") + `</p>`;
    if (m.strategi.length)
      html += `<p class="mentor-sub">🧭 Tips buat posisimu:</p><ul class="mentor-list strat">` +
        m.strategi.map((s) => `<li>${esc(s)}</li>`).join("") + `</ul>`;
  }
  body.innerHTML = html;
  const bp = $("btn-mentor-play");
  if (bp) bp.addEventListener("click", () => {
    try {
      const u = m.uci;
      chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
      redoStack = [];
      exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory();
      setStatus("Mentor memainkan " + m.langkah + " — tekan Analisis untuk lanjut.");
      maybeAutoPlay();
    } catch (e) { setStatus("Langkah mentor gagal dimainkan."); }
  });
}
$("mentor-fab").addEventListener("click", openMentor);
$("mentor-close").addEventListener("click", closeMentor);
$("mentor-modal").addEventListener("click", (e) => {
  if (e.target.id === "mentor-modal") closeMentor();
});
function previewMove(i) {
  const m = lastResults[i];
  if (!m) return;
  try {
    const c = new Chess(chess.fen());
    c.move({ from: m.from, to: m.to, promotion: m.uci.length > 4 ? m.uci[4] : undefined });
    previewFen = c.fen();
    renderBoard(previewFen); clearArrows();
    $("preview-chip").hidden = false;
    setStatus("Pratinjau langkah " + m.san + " — ketuk papan mana saja untuk kembali ke posisi asli dan main dari sana.");
    [...$("moves").children].forEach((li, j) => li.classList.toggle("on", j === i));
  } catch (e) { /* abaikan */ }
}
function exitPreview() {
  if (!previewFen) return;
  previewFen = null;
  $("preview-chip").hidden = true;
  renderBoard(); drawArrows(lastResults);
  [...$("moves").children].forEach((li) => li.classList.remove("on"));
}
$("preview-chip").addEventListener("click", exitPreview);

$("depth-seg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  depth = +b.dataset.d;
  [...$("depth-seg").children].forEach((x) => x.classList.toggle("on", x === b));
  saveState();
});
let stopWatchdog = null; // timer "dihentikan paksa" — harus dibatalkan tiap aksi baru
$("btn-analyze").addEventListener("click", async () => {
  if (stopWatchdog) { clearTimeout(stopWatchdog); stopWatchdog = null; }
  if (engine.isBusy()) {
    engine.stop();
    autoToken++; // batalkan juga langkah bot yang tertunda
    setStatus("Menghentikan…");
    stopWatchdog = setTimeout(() => {
      stopWatchdog = null;
      if (engine.isBusy()) {
        engine.forceStop();
        setAnalyzing(false);
        setStatus("Dihentikan paksa. Tekan Analisis untuk mulai lagi.");
      }
    }, 3000);
    return;
  }
  exitPreview();
  const raw = fenInput.value.trim();
  if (raw && !loadFenString(raw)) return;
  const fen = chess.fen();
  hideResults(); clearArrows();
  setAnalyzing(true);
  setStatus("Mengunduh & menyiapkan engine…");
  $("progress").hidden = false;
  $("progress-fill").style.width = "100%";
  try {
    await engine.load();
  } catch (e) {
    setStatus("Gagal memuat engine: " + e.message);
    $("progress").hidden = true; setAnalyzing(false); return;
  }
  $("progress").hidden = true;
  setStatus("Mikir…");
  lastDepth = depth;
  engine.analyze(fen, depth,
    (lines, d) => onEngineUpdate(lines, d),
    () => {
      setAnalyzing(false);
      setStatus(`Selesai — depth ${lastDepth}.`);
      maybeAutoPlay(); // kalau giliran bot, bot lanjut jalan (biar nggak macet)
    }
  );
});
/* ---------- bot otomatis ---------- */
function maybeAutoPlay() {
  if (!autoSide) return;
  if (chess.turn() !== autoSide) return;
  try {
    if (new Chess(chess.fen()).isGameOver()) { setStatus("Permainan selesai."); return; }
  } catch (e) { return; }
  const myToken = ++autoToken;
  const fen = chess.fen();
  const d = Math.min(depth, 16); // bot pakai maks Normal biar nggak kelamaan mikir
  const siapa = autoSide === "w" ? "Putih" : "Hitam";
  setStatus(`🤖 Bot (${siapa}) lagi mikir…`);
  setAnalyzing(true);
  engine.load().then(() => {
    if (myToken !== autoToken) { setAnalyzing(false); return; }
    engine.analyze(fen, d,
      (lines) => {
        try {
          const L = lines.filter(Boolean)[0];
          if (L) setEvalBar(cpToWhitePov(L.kind, L.val, chess.turn()), L.kind);
        } catch (e) { /* abaikan */ }
      },
      (bestUci) => {
        setAnalyzing(false);
        if (myToken !== autoToken || !autoSide) return;
        if (chess.turn() !== autoSide || chess.fen() !== fen) return; // posisi sudah berubah
        if (!bestUci || bestUci === "(none)") { setStatus("Bot tidak menemukan langkah."); return; }
        try {
          const mv = chess.move({
            from: bestUci.slice(0, 2), to: bestUci.slice(2, 4),
            promotion: bestUci.length > 4 ? bestUci[4] : undefined,
          });
          if (!mv) return;
          exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory();
          const sesudah = new Chess(chess.fen());
          let akhir = "";
          if (sesudah.isCheckmate()) akhir = " — SKAKMAT! 🏆";
          else if (sesudah.isStalemate() || sesudah.isDraw()) akhir = " — remis.";
          setStatus(`🤖 Bot (${siapa}) main: ${mv.san}${akhir} Giliranmu.`);
        } catch (e) { setStatus("Bot gagal melangkah."); }
      });
  }).catch((e) => { setAnalyzing(false); setStatus("Engine gagal dimuat: " + e.message); });
}
$("auto-sel").addEventListener("change", (e) => {
  const v = e.target.value;
  autoSide = v === "off" ? null : v;
  autoToken++; // batalkan bot yang lagi mikir
  if (engine.isBusy()) engine.stop();
  if (autoSide) {
    setStatus(`🤖 Bot pegang ${autoSide === "w" ? "Putih" : "Hitam"}. Kamu main sisanya — perhatikan gerakannya buat belajar.`);
    maybeAutoPlay();
  } else {
    setStatus("Mode Analisis Bebas — kamu main kedua warna, pelatih menilai setiap langkahmu.");
  }
  saveState();
});
engine.onError((msg) => {
  setStatus("Gagal: " + msg + " Coba tekan Analisis lagi.");
  $("progress").hidden = true; setAnalyzing(false);
});

/* ---------- v22: riwayat main bebas (undo/redo/klik) ---------- */
function renderHistory() {
  let sans = [];
  try { sans = chess.history(); } catch (e) { sans = []; }
  const card = $("history-card");
  if (!sans.length) { card.hidden = true; return; }
  card.hidden = false;
  let html = "";
  for (let k = 0; k < sans.length; k += 2) {
    html += `<span class="pgn-no">${k / 2 + 1}.</span>`;
    html += `<button class="pgn-mv${k + 1 === sans.length ? " on" : ""}" data-i="${k + 1}">${esc(sans[k])}</button>`;
    if (sans[k + 1])
      html += `<button class="pgn-mv${k + 2 === sans.length ? " on" : ""}" data-i="${k + 2}">${esc(sans[k + 1])}</button>`;
  }
  const el = $("history-moves");
  el.innerHTML = html;
  el.querySelectorAll(".pgn-mv").forEach((b) =>
    b.addEventListener("click", () => gotoHistory(+b.dataset.i)));
}
function gotoHistory(i) {
  let guard = 600;
  while (guard-- > 0) {
    let n = 0; try { n = chess.history().length; } catch (e) { break; }
    if (n <= i) break;
    let v = null;
    try { const h = chess.history({ verbose: true }); v = h[h.length - 1]; } catch (e) { /* abaikan */ }
    chess.undo();
    let n2 = 0; try { n2 = chess.history().length; } catch (e) { break; }
    if (n2 === n) break;
    if (v) redoStack.push(v);
  }
  while (guard-- > 0) {
    let n = 0; try { n = chess.history().length; } catch (e) { break; }
    if (n >= i || !redoStack.length) break;
    const v = redoStack.pop();
    try { chess.move({ from: v.from, to: v.to, promotion: v.promotion || undefined }); }
    catch (e) { break; }
  }
  coachToken++;
  exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults(); renderHistory(); resetCoach();
  setStatus("Posisi langkah ke-" + i + " — mainkan langkah baru dari sini, atau Redo untuk maju lagi.");
}
$("btn-undo").addEventListener("click", () => {
  let n = 0; try { n = chess.history().length; } catch (e) { /* abaikan */ }
  if (n > 0) gotoHistory(n - 1); else setStatus("Belum ada langkah untuk di-undo.");
});
$("btn-redo").addEventListener("click", () => {
  let n = 0; try { n = chess.history().length; } catch (e) { /* abaikan */ }
  if (redoStack.length) gotoHistory(n + 1); else setStatus("Tidak ada langkah untuk di-redo.");
});

/* ---------- v22: bagikan posisi (?fen=) ---------- */
$("btn-share").addEventListener("click", async () => {
  const url = location.origin + location.pathname + "?fen=" + encodeURIComponent(chess.fen());
  try {
    await navigator.clipboard.writeText(url);
    setStatus("🔗 Link posisi tersalin! Kirim ke temanmu — mereka langsung melihat posisi papan yang sama.");
  } catch (e) {
    window.prompt("Salin link posisi ini:", url);
  }
});

/* ---------- v22: deteksi pembukaan ---------- */
function updateOpeningLine() {
  let op = null;
  try {
    const sans = chess.history();
    if (sans.length >= 2) op = detectOpening(sans);
  } catch (e) { op = null; }
  const el = $("opening-line");
  if (op) {
    $("opening-name").textContent = op.name;
    $("opening-desc").textContent = op.desc;
    el.hidden = false;
  } else el.hidden = true;
}

/* ---------- v22: skenario belajar ---------- */
const scSel = $("scenario-sel");
SCENARIOS.forEach((sc) => {
  const o = document.createElement("option");
  o.value = sc.id; o.textContent = sc.label;
  scSel.appendChild(o);
});
scSel.addEventListener("change", () => {
  const sc = SCENARIOS.find((x) => x.id === scSel.value);
  if (!sc) return;
  const note = $("scenario-note");
  note.textContent = "🎓 " + sc.label + " — " + sc.note;
  note.hidden = false;
  resetCoach();
  if (sc.kind === "fen") {
    if (loadFenString(sc.fen)) setStatus("Skenario dimuat: " + sc.label);
  } else {
    const parts = [];
    sc.moves.forEach((s, i) => { if (i % 2 === 0) parts.push((i / 2 + 1) + "."); parts.push(s); });
    if (openPgn(parts.join(" ") + " *")) {
      gameBaseFen = START_FEN;
      setStatus("Skenario dimuat: " + sc.label + " — posisinya siap dimainkan dari langkah terakhir.");
    } else setStatus("Skenario gagal dimuat.");
  }
});

/* ---------- v22: Kotak Pelatih (klasifikasi langkah) ---------- */
const NAMA_BIDAK = { p: "Pion", n: "Kuda", b: "Gajah", r: "Benteng", q: "Menteri", k: "Raja" };
const NILAI_BIDAK = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function resetCoach() {
  coachToken++;
  $("coach-verdict").innerHTML = '<span class="coach-badge none">Menunggu langkahmu</span>';
  $("coach-explain").innerHTML = "<li>Mainkan satu langkah di papan — pelatih menilai langkahmu dan menjelaskan alasannya dalam Bahasa Indonesia.</li>";
  $("coach-enemy").textContent = "— tekan Analisis atau mainkan langkah —";
  $("coach-best").textContent = "— tekan Analisis atau mainkan langkah —";
}
function coachSetCells(best, fen) {
  if (!best) return;
  try { $("coach-best").innerHTML = `<b>${esc(best.san)}</b> — ${esc(alasanSingkat(fen, best))}`; }
  catch (e) { $("coach-best").innerHTML = `<b>${esc(best.san)}</b>`; }
  const replyUci = best.pvUci && best.pvUci[1];
  const replySan = best.pv && best.pv[1];
  if (replyUci && replySan) {
    try {
      const c = new Chess(fen);
      c.move({ from: best.from, to: best.to, promotion: best.uci.length > 4 ? best.uci[4] : undefined });
      const robj = { san: replySan, uci: replyUci, kind: "cp", score: 0, from: replyUci.slice(0, 2), to: replyUci.slice(2, 4) };
      $("coach-enemy").innerHTML = `<b>${esc(replySan)}</b> — ${esc(alasanSingkat(c.fen(), robj))}`;
    } catch (e) { $("coach-enemy").innerHTML = `<b>${esc(replySan)}</b>`; }
  } else {
    $("coach-enemy").textContent = "Tidak ada balasan berarti — lawan sangat tertekan di posisi ini.";
  }
}
function coachFromResults() {
  if (lastResults[0]) coachSetCells(lastResults[0], chess.fen());
}
/* kumpulkan analisis singkat (depth kecil) sebagai janji — untuk pelatih */
function analyzeCollect(fen, d) {
  return new Promise((resolve) => {
    let lastLines = null;
    engine.load().then(() => {
      engine.analyze(fen, d,
        (lines) => { lastLines = lines; },
        () => {
          const L = lastLines && lastLines.filter(Boolean)[0];
          if (!L || !L.pv || !L.pv[0]) { resolve(null); return; }
          const uci = L.pv[0];
          resolve({ top: {
            uci, from: uci.slice(0, 2), to: uci.slice(2, 4),
            san: uciToSan(fen, uci) || uci,
            cp: L.kind === "mate" ? (L.val > 0 ? 9000 : -9000) : L.val,
            kind: L.kind, score: L.val,
            pv: pvToSans(fen, L.pv, 12),
            pvUci: L.pv.slice(0, 12),
          } });
        });
    }).catch(() => resolve(null));
  });
}
/* peta petak yang diserang/dijaga satu warna (giliran diputar paksa di FEN) */
function attackSquares(fen, color) {
  const parts = fen.split(" ");
  parts[1] = color; parts[3] = "-";
  let c;
  try { c = new Chess(parts.join(" ")); } catch (e) { return new Set(); }
  const b = c.board(); const set = new Set();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const cell = b[r][f];
    if (!cell || cell.color !== color) continue;
    const sq = "abcdefgh"[f] + (8 - r);
    if (cell.type === "p") {
      const nr = (8 - r) + (color === "w" ? 1 : -1);
      for (const df of [-1, 1]) {
        const nf = f + df;
        if (nf >= 0 && nf < 8 && nr >= 1 && nr <= 8) set.add("abcdefgh"[nf] + nr);
      }
    } else {
      try { c.moves({ square: sq, verbose: true }).forEach((mv) => set.add(mv.to)); } catch (e) { /* abaikan */ }
    }
  }
  return set;
}
function hangingPieces(fen, color) {
  const opp = color === "w" ? "b" : "w";
  const atk = attackSquares(fen, opp), def = attackSquares(fen, color);
  let c;
  try { c = new Chess(fen); } catch (e) { return []; }
  const b = c.board(); const out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const cell = b[r][f];
    if (!cell || cell.color !== color || cell.type === "k") continue;
    const sq = "abcdefgh"[f] + (8 - r);
    if (atk.has(sq) && !def.has(sq))
      out.push({ sq, nama: NAMA_BIDAK[cell.type], val: NILAI_BIDAK[cell.type] });
  }
  return out.sort((a, z) => z.val - a.val);
}
async function coachClassify(fenBefore, m) {
  const token = ++coachToken;
  const fenAfter = chess.fen();
  const uci = m.from + m.to + (m.promotion || "");
  const verdictEl = $("coach-verdict"), explainEl = $("coach-explain");
  try {
    if (new Chess(fenAfter).isCheckmate()) {
      verdictEl.innerHTML = '<span class="coach-badge best">💎 Terbaik — SKAKMAT! 🏆</span>';
      explainEl.innerHTML = `<li><b>${esc(m.san)}</b> mengakhiri permainan dengan skakmat. Kerja bagus!</li>`;
      $("coach-enemy").textContent = "Permainan selesai — tidak ada balasan.";
      return;
    }
  } catch (e) { /* abaikan */ }
  if (engine.isBusy()) {
    explainEl.innerHTML = "<li>Engine sedang dipakai analisis utama — penilaian pelatih dilewati untuk langkah ini. Tekan Analisis untuk melihat saran terbaik.</li>";
    return;
  }
  verdictEl.innerHTML = '<span class="coach-badge none">⏳ Pelatih menilai langkah ' + esc(m.san) + "…</span>";
  let r1 = null, r2 = null;
  try {
    r1 = await analyzeCollect(fenBefore, 10);
    if (token !== coachToken) return;
    r2 = await analyzeCollect(fenAfter, 10);
    if (token !== coachToken) return;
  } catch (e) { /* ditangani di bawah */ }
  if (!r1 || !r1.top) {
    explainEl.innerHTML = "<li>Pelatih tidak sempat menilai langkah ini (engine sibuk). Tekan Analisis untuk penilaian manual.</li>";
    return;
  }
  const before = r1.top.cp;
  const afterMover = r2 && r2.top ? -r2.top.cp : 0;
  const loss = Math.max(0, before - afterMover);
  const isBest = uci === r1.top.uci;
  let cls, badge;
  if (isBest) { cls = "best"; badge = "💎 Terbaik"; }
  else if (loss <= 50) { cls = "good"; badge = "👍 Bagus"; }
  else if (loss <= 100) { cls = "inaccuracy"; badge = "⚠️ Kurang Tepat"; }
  else if (loss <= 250) { cls = "mistake"; badge = "❌ Kesalahan"; }
  else { cls = "blunder"; badge = "💀 Blunder"; }
  verdictEl.innerHTML = `<span class="coach-badge ${cls}">${badge}: ${esc(m.san)}</span>`;
  const pawn = (cp) => (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
  const lines = [];
  lines.push(`Evaluasi berubah dari ${pawn(before)} menjadi ${pawn(afterMover)} dari sudut pandang ${m.color === "w" ? "putih" : "hitam"}${isBest ? " — persis pilihan mesin." : ` — kehilangan sekitar ${(loss / 100).toFixed(2)} pion.`}`);
  if (!isBest && r1.top.san) lines.push(`Mesin lebih suka <b>${esc(r1.top.san)}</b> di posisi sebelum langkah ini.`);
  if (m.captured) lines.push(`Langkah ini menangkap ${NAMA_BIDAK[m.captured] || "bidak"} lawan di petak ${m.to}.`);
  try { if (new Chess(fenAfter).inCheck()) lines.push("Langkah ini memberi SKAK — lawan wajib merespons dan rencananya tertunda."); } catch (e) { /* abaikan */ }
  if (["d4", "e4", "d5", "e5"].includes(m.to)) lines.push(`Bidakmu kini menempati petak pusat ${m.to} — menguasai pusat memudahkan serangan dan membatasi lawan.`);
  if ((m.piece === "n" || m.piece === "b") && (m.from[1] === "1" || m.from[1] === "8")) lines.push("Perkembangan bagus: perwira ringan keluar dari baris belakang dan ikut bermain.");
  const hang = hangingPieces(fenAfter, m.color);
  if (hang.length) lines.push(`⚠️ Hati-hati: ${hang[0].nama} di ${hang[0].sq} sekarang tidak terjaga — lawan bisa memakannya secara gratis.`);
  if ((cls === "blunder" || cls === "mistake") && !hang.length) lines.push("Lain kali, sebelum melangkah cek 3 hal: bidakku ada yang menggantung? petak tujuan diserang? langkahku membuka serangan ke rajaku?");
  explainEl.innerHTML = lines.map((l) => `<li>${l}</li>`).join("");
  if (r2 && r2.top) {
    coachSetCells(r2.top, fenAfter);
    drawCoachPair(r2.top, r2.top.pvUci && r2.top.pvUci[1]);
    const turnAfter = fenAfter.split(" ")[1];
    setEvalBar(turnAfter === "w" ? r2.top.cp : -r2.top.cp, r2.top.kind);
  }
}

/* ---------- v22: auto-save localStorage ---------- */
function saveState() {
  try {
    localStorage.setItem("chessqq-v22", JSON.stringify({
      fen: chess.fen(), orientation, auto: autoSide, depth,
    }));
  } catch (e) { /* abaikan */ }
}

/* ---------- init ---------- */
buildPalette();
(function initRestore() {
  // 1) posisi dari link yang dibagikan (?fen=...) — prioritas tertinggi
  let qfen = null;
  try { qfen = new URLSearchParams(location.search).get("fen"); } catch (e) { /* abaikan */ }
  if (qfen && loadFenString(qfen)) {
    setStatus("Posisi dari link yang dibagikan dimuat — tekan Analisis untuk memprediksi langkah.");
    return;
  }
  // 2) auto-save terakhir
  try {
    const sv = JSON.parse(localStorage.getItem("chessqq-v22") || "null");
    if (sv && sv.fen && validateFen(sv.fen).ok) {
      chess.load(sv.fen);
      gameBaseFen = chess.fen();
      if (sv.orientation === "b") orientation = "b";
      if (sv.depth && [10, 16, 22].includes(+sv.depth)) {
        depth = +sv.depth;
        [...$("depth-seg").children].forEach((x) => x.classList.toggle("on", +x.dataset.d === depth));
      }
      if (sv.auto === "w" || sv.auto === "b") {
        autoSide = sv.auto;
        $("auto-sel").value = sv.auto;
      }
      setStatus("Posisi terakhirmu dipulihkan otomatis.");
    }
  } catch (e) { /* abaikan */ }
})();
syncFen();
renderBoard();
renderHistory();
setEvalBar(20, "cp");
if (autoSide) maybeAutoPlay();

/* Debug: ?debug=1 menampilkan log mentah engine */
if (location.search.includes("debug")) {
  const dbg = document.getElementById("debug");
  dbg.hidden = false;
  const logEl = document.getElementById("dbg-log");
  const dlog = (m) => {
    logEl.textContent += m + "\n";
    logEl.scrollTop = logEl.scrollHeight;
  };
  dlog("debug aktif @ " + new Date().toISOString());
  engine.onRaw(dlog);
  window.addEventListener("error", (e) => dlog("⚠ window error: " + e.message));
  setInterval(() => {
    document.getElementById("dbg-clock").textContent =
      new Date().toISOString().slice(11, 19) +
      " busy=" + engine.isBusy() + " ready=" + engine.ready;
  }, 1000);
}
