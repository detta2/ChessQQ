/* Kalkulator Catur — UI papan, editor, panah prediksi, hasil analisis. */
import { Chess, validateFen } from "./chess.js";

const $ = (id) => document.getElementById(id);
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
function drawArrows(moves) {
  arrowsEl.innerHTML =
    '<defs>' + ARROW_COLORS.map((c, i) =>
      `<marker id="ah${i}" markerWidth="54" markerHeight="54" refX="38" refY="27" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L54,27 L0,54 z" fill="${c}"/></marker>`
    ).join("") + "</defs>";
  moves.slice(0, 3).reverse().forEach((m, ri) => {
    const i = moves.slice(0, 3).length - 1 - ri;
    const c = ARROW_COLORS[i];
    const [x1, y1] = sqCenter(m.from), [x2, y2] = sqCenter(m.to);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const sx = x1 + (dx / len) * 14, sy = y1 + (dy / len) * 14;
    const ex = x2 - (dx / len) * 52, ey = y2 - (dy / len) * 52;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", sx); line.setAttribute("y1", sy);
    line.setAttribute("x2", ex); line.setAttribute("y2", ey);
    line.setAttribute("stroke", c); line.setAttribute("stroke-width", "30");
    line.setAttribute("stroke-linecap", "round"); line.setAttribute("opacity", ".78");
    line.setAttribute("marker-end", `url(#ah${i})`);
    arrowsEl.appendChild(line);
  });
}
function clearArrows() { arrowsEl.innerHTML = ""; }

/* ---------- FEN ---------- */
function syncFen() { fenInput.value = chess.fen(); fenInput.classList.remove("bad"); }
function loadFenString(s) {
  s = (s || "").trim();
  if (!s) return false;
  const v = validateFen(s);
  if (!v.ok) { fenInput.classList.add("bad"); setStatus("FEN tidak valid: " + v.error); return false; }
  chess.load(s);
  exitPreview(); syncFen(); renderBoard(); clearArrows();
  fenInput.classList.remove("bad");
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
  chess.reset(); exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
  setStatus("Posisi awal dimuat.");
});
$("btn-clear").addEventListener("click", () => {
  chess.clear();
  chess.put({ type: "k", color: "w" }, "e1");
  chess.put({ type: "k", color: "b" }, "e8");
  exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
  setStatus("Papan dibersihkan (raja tetap). Nyalakan ✏️ Edit untuk susun.");
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
    exitPreview(); syncFen(); renderBoard(); clearArrows(); hideResults();
    setStatus("Langkah: " + m.san + " — tekan Analisis untuk prediksi baru.");
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
  const turn = chess.turn();
  $("predict-note").textContent =
    `Giliran ${turn === "w" ? "putih" : "hitam"} — ini 3 langkah terbaik menurut Stockfish. ` +
    (turn === "b" ? "Kalau kamu putih, panah hijau ≈ musuh bakal jalan ke situ." : "Ketuk langkah untuk pratinjau di papan.");
  ol.innerHTML = "";
  lastResults.forEach((m, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="dot" style="background:${ARROW_COLORS[i]}"></span>` +
      `<span class="san">${m.san}</span>` +
      `<span class="eval">${m.eval}</span>` +
      `<span class="pv">${m.pv.join(" ")}</span>`;
    li.addEventListener("click", () => previewMove(i));
    ol.appendChild(li);
  });
}
function hideResults() { $("results-card").hidden = true; lastResults = []; }
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
