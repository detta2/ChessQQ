/* ChessQQ — UI papan, editor, panah prediksi, hasil analisis, mentor. */
import { Chess, validateFen } from "./chess.js?v=14";
import { mentorFor, alasanSingkat } from "./mentor.js?v=14";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  $("turn-chip").textContent = t === "w" ? "⚪ Putih jalan" : "⚫ Hitam jalan";
  paintSelection();
}

/* ---------- panah ---------- */
let lastArrowKey = "";
function drawArrows(moves) {
  const top = moves.slice(0, 3);
  const key = top.map((m) => m.uci).join("|");
  if (key === lastArrowKey) return; // gambar ulang hanya kalau 3 besar berubah
  lastArrowKey = key;
  arrowsEl.innerHTML = "";
  const widths = [30, 26, 22];
  top.reverse().forEach((m, ri) => {
    const i = top.length - 1 - ri; // i=0 (terbaik) digambar paling atas
    const c = ARROW_COLORS[i];
    const [x1, y1] = sqCenter(m.from), [x2, y2] = sqCenter(m.to);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const w = widths[i] || 22, hw = w * 1.4;
    const headLen = Math.min(66, len * 0.45);
    const sx = x1 + ux * 16, sy = y1 + uy * 16;          // pangkal
    const tx = x2 - ux * 26, ty = y2 - uy * 26;          // ujung
    const bx = tx - ux * headLen, by = ty - uy * headLen; // dasar kepala
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
    // gaya "3D Dimensi": bayangan offset di bawah-kanan + panah utama + kilau tepi
    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shadow.setAttribute("d", d);
    shadow.setAttribute("fill", "rgba(5,6,9,.6)");
    shadow.setAttribute("transform", "translate(11,13)");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", c);
    p.setAttribute("stroke", "rgba(255,255,255,.35)");
    p.setAttribute("stroke-width", "3");
    p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("fill-opacity", ".96");
    g.appendChild(shadow); g.appendChild(p);
    arrowsEl.appendChild(g);
  });
}
function clearArrows() { arrowsEl.innerHTML = ""; lastArrowKey = ""; }

/* ---------- FEN ---------- */
function syncFen() { fenInput.value = chess.fen(); fenInput.classList.remove("bad"); }
function loadFenString(s) {
  s = (s || "").trim();
  if (!s) return false;
  const v = validateFen(s);
  if (!v.ok) { fenInput.classList.add("bad"); setStatus("FEN tidak valid: " + v.error); return false; }
  exitPgn();
  chess.load(s);
  exitPreview(); syncFen(); renderBoard(); clearArrows();
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
  chess.reset(); exitPgn(); exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
  setStatus("Posisi awal dimuat.");
  maybeAutoPlay();
});
$("btn-clear").addEventListener("click", () => {
  chess.clear();
  chess.put({ type: "k", color: "w" }, "e1");
  chess.put({ type: "k", color: "b" }, "e8");
  exitPgn();
  exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
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
  x.textContent = "🧽"; x.style.fontSize = "26px";
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
  $("btn-edit").textContent = editMode ? "✔️ Selesai edit" : "✏️ Edit posisi";
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
    const promo = (p.type === "p" && (to[1] === "8" || to[1] === "1")) ? "q" : undefined;
    const m = chess.move({ from, to, promotion: promo });
    if (!m) return false;
    exitPgn();
    exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
    setStatus("Langkah: " + m.san + " — tekan Analisis untuk prediksi baru.");
    maybeAutoPlay();
    return true;
  } catch (e) { return false; }
}

function onPointerDown(e, sq) {
  if (previewFen) return;
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
  b.textContent = on ? "⏹ Stop" : "🔍 Analisis";
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
function setEvalBar(wp, kind) {
  let pct;
  if (kind === "mate") pct = wp > 0 ? 100 : 0;
  else pct = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * wp)) - 1);
  $("evalfill").style.height = pct.toFixed(1) + "%";
  $("evallabel").textContent = kind === "mate" ? (wp > 0 ? "#+" : "#−") : (wp / 100).toFixed(1);
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
    };
  });
  renderResults();
  drawArrows(lastResults);
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
    th.innerHTML = `⚠️ Ancaman utama: <b>${esc(t0.san)}</b> — ${esc(alasanSingkat(fen, t0))}`;
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
    ask.textContent = "💬";
    ask.title = "Tanya mentor soal langkah ini";
    ask.addEventListener("click", (e) => { e.stopPropagation(); openMentorFor(i); });
    li.appendChild(ask);
    li.addEventListener("click", () => previewMove(i));
    ol.appendChild(li);
  });
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
      `<button id="btn-mentor-play" class="primary small">▶️ Mainkan</button></div>`;
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
      exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
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
});
$("btn-analyze").addEventListener("click", async () => {
  if (engine.isBusy()) {
    engine.stop();
    autoToken++; // batalkan juga langkah bot yang tertunda
    setStatus("Menghentikan…");
    setTimeout(() => {
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
    () => { setAnalyzing(false); setStatus(`Selesai — depth ${lastDepth}.`); }
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
          exitPreview(); syncFen(); renderBoard(); clearArrows();
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
    setStatus("Auto mati — kamu yang main penuh.");
  }
});
engine.onError((msg) => {
  setStatus("Gagal: " + msg + " Coba tekan Analisis lagi.");
  $("progress").hidden = true; setAnalyzing(false);
});

/* ---------- init ---------- */
buildPalette();
syncFen();
renderBoard();
setEvalBar(20, "cp");

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
