/* ChessQQ Mentor — menjelaskan langkah terbaik + strategi posisi.
   Bahasa Indonesia, untuk pemain yang lagi belajar. Vanilla ES module. */
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
  return (p > 0 ? "+" : "") + p.toFixed(2);
}

/* Penjelasan 1 langkah (untuk alternatif): singkat, 2-5 kata. */
function alasanSingkat(fen, r) {
  const ap = applyUci(fen, r.uci);
  if (!ap) return "langkah engine";
  const mv = ap.move, after = ap.chess;
  if (after.isCheckmate()) return "skakmat langsung!";
  if (r.kind === "mate" && r.score > 0) return `paksa skakmat ${Math.abs(r.score)} langkah`;
  if (after.inCheck()) return "skak";
  if (mv.captured) return `makan ${NAMA[mv.captured]}`;
  if (mv.promotion) return `promosi ${PROMO[mv.promotion]}`;
  if (mv.flags.includes("k") || mv.flags.includes("q")) return "rokade, amankan raja";
  if ((mv.piece === "n" || mv.piece === "b") && mv.from[1] === (mv.color === "w" ? "1" : "8"))
    return "kembangkan perwira";
  if (mv.piece === "p" && PUSAT.includes(mv.to)) return "rebut pusat";
  return "perbaiki posisi";
}

/* Penjelasan lengkap langkah terbaik. r = {uci, san, kind, score, eval}. */
function jelaskanLangkah(fen, r, turn) {
  const ap = applyUci(fen, r.uci);
  const baris = [];
  const sn = sideName(turn);
  if (!ap) {
    baris.push("Engine merekomendasikan langkah ini.");
    return baris;
  }
  const mv = ap.move, after = ap.chess;

  if (r.kind === "mate" && r.score > 0)
    baris.push(`Skakmat dalam ${Math.abs(r.score)} langkah — lawan tidak bisa lolos.`);
  else if (r.kind === "mate" && r.score < 0)
    baris.push(`Awas: jalur ini kalah skakmat ${Math.abs(r.score)} langkah — jangan mainkan!`);
  if (after.isCheckmate()) baris.push("Itu skakmat langsung! 🏆");
  else if (after.inCheck()) baris.push("Memberi skak — raja lawan wajib merespons, kamu dapat tempo gratis.");

  if (mv.captured) {
    const untung = NILAI[mv.captured] >= NILAI[mv.piece];
    baris.push(
      `Memakan ${NAMA[mv.captured]} lawan di ${mv.to}` +
      (untung ? " — pertukaran menguntungkan buatmu." : ".")
    );
    // apakah bidak kita jadi sasaran empuk setelah makan?
    if (after.attackers(mv.to, lawan(turn)).length > 0 && NILAI[mv.piece] > NILAI[mv.captured])
      baris.push("Tapi bidakmu bisa dimakan balik — pastikan sudah dihitung.");
  }
  if (mv.promotion) baris.push(`Pion promosi jadi ${PROMO[mv.promotion]} — bidak baru yang kuat!`);
  if (mv.flags.includes("k") || mv.flags.includes("q"))
    baris.push("Rokade: raja pindah ke tempat aman sekaligus benteng ikut main.");
  else if ((mv.piece === "n" || mv.piece === "b") && mv.from[1] === (mv.color === "w" ? "1" : "8"))
    baris.push(`${NAMA[mv.piece]} keluar dari kandang — prinsip pembukaan: kembangkan perwira dulu.`);
  if (mv.piece === "p" && PUSAT.includes(mv.to))
    baris.push("Pion merebut petak pusat — fondasi serangan dan ruang gerak.");
  if (mv.piece === "p" && mv.flags.includes("b"))
    baris.push("Pion maju dua langkah, mengklaim ruang.");

  if (!baris.length) baris.push("Langkah posisi terbaik — memperbaiki kedudukan tanpa risiko langsung.");
  if (r.kind !== "mate") baris.push(`Evaluasi engine: ${fmtCpMover(r.score)} untuk ${sn}.`);
  return baris;
}

/* Penilaian strategi posisi. Kembalikan array string (maks 4, terurut prioritas). */
function nilaiStrategi(fen, turn) {
  const c = new Chess(fen);
  const tips = [];
  const sn = sideName(turn), op = lawan(turn);

  if (c.inCheck())
    tips.push({ p: 0, t: `${sn} sedang diskak — wajib atasi skak dulu sebelum rencana lain.` });

  // bidak tak terjaga (bukan pion/raja)
  const gantung = [];
  for (const sq of SQUARES) {
    const pc = c.get(sq);
    if (!pc || pc.color !== turn || pc.type === "p" || pc.type === "k") continue;
    if (c.attackers(sq, op).length > 0 && c.attackers(sq, turn).length === 0)
      gantung.push({ sq, pc });
  }
  if (gantung.length) {
    const g = gantung[0];
    tips.push({ p: 1, t: `⚠️ ${NAMA[g.pc.type]} di ${g.sq} tidak terjaga — lawan bisa makan gratis!` });
  }

  // materi
  let diff = 0;
  for (const sq of SQUARES) {
    const pc = c.get(sq);
    if (pc) diff += (pc.color === "w" ? 1 : -1) * NILAI[pc.type];
  }
  const diffKu = turn === "w" ? diff : -diff;
  if (diffKu >= 150)
    tips.push({ p: 2, t: `Unggul materi (+${(diffKu / 100).toFixed(1)}). Sederhanakan: tukar bidak, jangan tukar pion.` });
  else if (diffKu <= -150)
    tips.push({ p: 2, t: `Kalah materi (${(diffKu / 100).toFixed(1)}). Hindari pertukaran — cari taktik dan serangan.` });

  // keamanan raja
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
      ? { p: 3, t: "Raja masih di tengah — rokade dulu sebelum menyerang." }
      : { p: 3, t: "Raja di tengah tanpa hak rokade — jangan buka lajur pusat." });
  }

  // pengembangan (fase pembukaan)
  const langkahKe = parseInt(c.fen().split(" ")[5], 10) || 1;
  if (langkahKe <= 12) {
    const kandang = turn === "w" ? "1" : "8";
    let n = 0;
    for (const sq of SQUARES) {
      const pc = c.get(sq);
      if (pc && pc.color === turn && (pc.type === "n" || pc.type === "b") && sq[1] === kandang) n++;
    }
    if (n > 0)
      tips.push({ p: 4, t: `Masih ada ${n} perwira di kandang — kembangkan dulu, jangan gerakkan bidak yang sama dua kali.` });
  }

  // pusat
  if (langkahKe <= 20) {
    const kuasai = PUSAT.some((sq) => {
      const pc = c.get(sq);
      return pc && pc.color === turn && pc.type === "p";
    });
    if (!kuasai) tips.push({ p: 5, t: "Pusat belum direbut — dorong pion e/d ke tengah." });
  }

  tips.sort((a, b) => a.p - b.p);
  return tips.slice(0, 4).map((x) => x.t);
}

/* API utama. results = array hasil engine app.js [{uci,san,kind,score,...}]. */
export function mentorFor(fen, results, turn) {
  const c = new Chess(fen);
  if (c.isCheckmate()) {
    const menang = lawan(turn);
    return { selesai: true, judul: "Skakmat! 🏆", baris: [`${sideName(menang)} menang — permainan sudah selesai.`], strategi: [] };
  }
  if (c.isStalemate() || c.isDraw())
    return { selesai: true, judul: "Remis 🤝", baris: ["Permainan remis — tidak ada yang menang."], strategi: [] };
  if (!results || !results.length)
    return { selesai: true, judul: "Belum ada analisis", baris: ["Tekan Analisis dulu."], strategi: [] };

  const terbaik = results[0];
  const alternatif = results.slice(1, 3).map((r) => ({ san: r.san, alasan: alasanSingkat(fen, r) }));
  return {
    selesai: false,
    judul: `Rekomendasi untuk ${sideName(turn)}`,
    langkah: terbaik.san,
    uci: terbaik.uci,
    baris: jelaskanLangkah(fen, terbaik, turn),
    alternatif,
    strategi: nilaiStrategi(fen, turn),
  };
}
