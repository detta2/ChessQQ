/* ChessQQ Mentor — menjelaskan langkah terbaik + strategi posisi.
   Bahasa Indonesia SEDERHANA untuk pemula. Vanilla ES module. */
import { Chess, SQUARES } from "./chess.js";

const NAMA = { k: "Raja", q: "Menteri", r: "Benteng", b: "Gajah", n: "Kuda", p: "Pion" };
const NILAI = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PROMO = { q: "Menteri", r: "Benteng", b: "Gajah", n: "Kuda" };
const PUSAT = ["e4", "d4", "e5", "d5"];

function sideName(c) {
  return c === "w" ? "Putih" : "Hitam";
}
function lawan(c) {
  return c === "w" ? "b" : "w";
}
function applyUci(fen, uci) {
  try {
    const c = new Chess(fen);
    const mv = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return mv ? { chess: c, move: mv } : null;
  } catch (e) {
    return null;
  }
}
function fmtCpMover(cp) {
  const p = cp / 100;
  return (p > 0 ? "+" : "") + p.toFixed(1).replace(".", ",");
}

/* Alasan 1 langkah, singkat. */
export function alasanSingkat(fen, r) {
  const ap = applyUci(fen, r.uci);
  if (!ap) return "pilihan engine";
  const mv = ap.move, after = ap.chess;
  if (after.isCheckmate()) return "langsung skakmat!";
  if (r.kind === "mate" && r.score > 0) return `bisa skakmat ${Math.abs(r.score)} langkah`;
  if (after.inCheck()) return "skak raja lawan";
  if (mv.captured) return `makan ${NAMA[mv.captured]}`;
  if (mv.promotion) return `pion jadi ${PROMO[mv.promotion]}`;
  if (mv.flags.includes("k") || mv.flags.includes("q")) return "rokade, raja aman";
  if ((mv.piece === "n" || mv.piece === "b") && mv.from[1] === (mv.color === "w" ? "1" : "8"))
    return "majukan bidak";
  if (mv.piece === "p" && PUSAT.includes(mv.to)) return "kuasai tengah";
  return "bikin posisi enak";
}

/* Penjelasan lengkap langkah terbaik. r = {uci, san, kind, score, eval}. */
function jelaskanLangkah(fen, r, turn, alt2) {
  const ap = applyUci(fen, r.uci);
  const baris = [];
  const sn = sideName(turn);
  if (!ap) {
    baris.push("Engine pilih langkah ini sebagai yang terbaik.");
    return baris;
  }
  const mv = ap.move, after = ap.chess;

  if (r.kind === "mate" && r.score > 0)
    baris.push(`Kamu bisa skakmat dalam ${Math.abs(r.score)} langkah!`);
  else if (r.kind === "mate" && r.score < 0)
    baris.push(`Jangan main ini — malah kamu yang kena skakmat ${Math.abs(r.score)} langkah.`);
  if (after.isCheckmate()) baris.push("Itu skakmat langsung! Kamu menang! 🏆");
  else if (after.inCheck()) baris.push("Skak! Raja lawan harus kabur, kamu dapat giliran gratis.");

  if (mv.captured) {
    const untung = NILAI[mv.captured] >= NILAI[mv.piece];
    baris.push(
      `Makan ${NAMA[mv.captured]} lawan di ${mv.to}` +
      (untung ? " — kamu untung!" : ".")
    );
    if (after.attackers(mv.to, lawan(turn)).length > 0 && NILAI[mv.piece] > NILAI[mv.captured])
      baris.push("Hati-hati, bidakmu bisa dimakan balik.");
  }
  if (mv.promotion) baris.push(`Pionmu berubah jadi ${PROMO[mv.promotion]}! Makin kuat.`);
  if (mv.flags.includes("k") || mv.flags.includes("q"))
    baris.push("Rokade! Raja sembunyi di tempat aman, benteng ikut bantu.");
  else if ((mv.piece === "n" || mv.piece === "b") && mv.from[1] === (mv.color === "w" ? "1" : "8"))
    baris.push(`${NAMA[mv.piece]} maju — bagus, bidakmu jadi aktif.`);
  if (mv.piece === "p" && PUSAT.includes(mv.to))
    baris.push("Pion kuasai tengah — bagus buat serangan.");

  if (!baris.length) baris.push("Langkah aman yang bikin posisimu lebih enak.");

  // seberapa jauh lebih bagus dari pilihan lain?
  if (alt2 && r.kind === "cp" && alt2.kind === "cp") {
    const gap = r.score - alt2.score;
    if (gap >= 80)
      baris.push(`Jauh lebih bagus dari ${alt2.san} (${fmtCpMover(r.score)} vs ${fmtCpMover(alt2.score)}) — ini langkahnya.`);
    else if (gap <= 30)
      baris.push(`${alt2.san} juga hampir sama kuat — pilih yang sesuai gayamu.`);
  }
  if (r.kind !== "mate") baris.push(`Penilaian: ${fmtCpMover(r.score)} buat ${sn} (makin plus makin bagus).`);
  return baris;
}

/* Rencana 2 langkahmu berikutnya, diambil dari variasi (PV) engine. */
function rencanaBerikut(fen, pvSans, turn) {
  const out = [];
  try {
    const c = new Chess(fen);
    const n = Math.min((pvSans || []).length, 7);
    for (let i = 0; i < n; i++) {
      const fenBefore = c.fen();
      const mover = c.turn();
      let mv = null;
      try { mv = c.move(pvSans[i]); } catch (e) { break; }
      if (!mv) break;
      if (mover === turn && i > 0 && out.length < 2) {
        const uci = mv.from + mv.to + (mv.promotion || "");
        out.push({ san: mv.san, alasan: alasanSingkat(fenBefore, { uci, kind: "cp", score: 0 }) });
      }
      if (c.isGameOver()) break;
    }
  } catch (e) { /* abaikan */ }
  return out;
}

/* Tips strategi. Kembalikan array string (maks 4, terurut prioritas). */
function nilaiStrategi(fen, turn) {
  const c = new Chess(fen);
  const tips = [];
  const op = lawan(turn);

  if (c.inCheck())
    tips.push({ p: 0, t: "Kamu lagi diskak! Selamatkan raja dulu." });

  // bidak yang bisa dimakan gratis (bukan pion/raja)
  const gantung = [];
  for (const sq of SQUARES) {
    const pc = c.get(sq);
    if (!pc || pc.color !== turn || pc.type === "p" || pc.type === "k") continue;
    if (c.attackers(sq, op).length > 0 && c.attackers(sq, turn).length === 0)
      gantung.push({ sq, pc });
  }
  if (gantung.length) {
    const g = gantung[0];
    tips.push({ p: 1, t: `⚠️ ${NAMA[g.pc.type]} di ${g.sq} nggak ada yang jaga — bisa dimakan gratis!` });
  }

  // jumlah bidak
  let diff = 0;
  for (const sq of SQUARES) {
    const pc = c.get(sq);
    if (pc) diff += (pc.color === "w" ? 1 : -1) * NILAI[pc.type];
  }
  const diffKu = turn === "w" ? diff : -diff;
  if (diffKu >= 150)
    tips.push({ p: 2, t: `Bidakmu lebih banyak (+${(diffKu / 100).toFixed(0)}). Ajak tukar-tukaran bidak biar makin menang.` });
  else if (diffKu <= -150)
    tips.push({ p: 2, t: `Bidakmu kalah (${(diffKu / 100).toFixed(0)}). Jangan tukar-tukaran — cari serangan.` });

  // raja aman?
  let kingSq = null;
  for (const sq of SQUARES) {
    const pc = c.get(sq);
    if (pc && pc.type === "k" && pc.color === turn) { kingSq = sq; break; }
  }
  const home = turn === "w" ? "e1" : "e8";
  if (kingSq === home) {
    const hak = c.fen().split(" ")[2];
    const punya = turn === "w" ? /[KQ]/.test(hak) : /[kq]/.test(hak);
    tips.push(punya
      ? { p: 3, t: "Raja masih di tengah — rokade biar aman." }
      : { p: 3, t: "Raja di tengah dan nggak bisa rokade — jangan buka jalan ke raja." });
  }

  // bidak belum gerak (awal permainan)
  const langkahKe = parseInt(c.fen().split(" ")[5], 10) || 1;
  if (langkahKe <= 12) {
    const kandang = turn === "w" ? "1" : "8";
    let n = 0;
    for (const sq of SQUARES) {
      const pc = c.get(sq);
      if (pc && pc.color === turn && (pc.type === "n" || pc.type === "b") && sq[1] === kandang) n++;
    }
    if (n > 0)
      tips.push({ p: 4, t: `Masih ada ${n} bidak belum gerak — keluarin dulu semuanya.` });
  }

  // tengah
  if (langkahKe <= 20) {
    const kuasai = PUSAT.some((sq) => {
      const pc = c.get(sq);
      return pc && pc.color === turn && pc.type === "p";
    });
    if (!kuasai) tips.push({ p: 5, t: "Tengah masih kosong — dorong pion ke tengah." });
  }

  tips.sort((a, b) => a.p - b.p);
  return tips.slice(0, 4).map((x) => x.t);
}

/* API utama. results = array hasil engine app.js [{uci,san,kind,score,...}]. */
export function mentorFor(fen, results, turn) {
  const c = new Chess(fen);
  if (c.isCheckmate()) {
    const menang = sideName(lawan(turn));
    return { selesai: true, judul: "Skakmat! 🏆", baris: [`${menang} menang — permainan sudah selesai.`], strategi: [] };
  }
  if (c.isStalemate() || c.isDraw())
    return { selesai: true, judul: "Remis 🤝", baris: ["Seri — tidak ada yang menang."], strategi: [] };
  if (!results || !results.length)
    return { selesai: true, judul: "Belum ada analisis", baris: ["Tekan tombol Analisis dulu, baru tanya Mentor."], strategi: [] };

  const terbaik = results[0];
  const alt2 = results[1] || null;
  const alternatif = results.slice(1, 3).map((r) => ({ san: r.san, alasan: alasanSingkat(fen, r) }));
  return {
    selesai: false,
    judul: `Saran untuk ${sideName(turn)}`,
    langkah: terbaik.san,
    uci: terbaik.uci,
    baris: jelaskanLangkah(fen, terbaik, turn, alt2),
    rencana: rencanaBerikut(fen, terbaik.pv, turn),
    alternatif,
    strategi: nilaiStrategi(fen, turn),
  };
}
