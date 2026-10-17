/* ChessQQ — database pembukaan (deteksi dari urutan SAN) + skenario belajar.
   Murni data lokal, tanpa server. SAN ditulis tanpa tanda +/# (dinormalisasi
   saat pencocokan), jadi variasi notasi tetap terdeteksi. */

export const OPENINGS = [
  { name: "Italian Game", sans: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    desc: "Gajah c4 langsung menekan f7 — petak terlemah di kubu hitam — sambil mengembangkan perwira dengan tempo." },
  { name: "Italian Game — Evans Gambit", sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"],
    desc: "Putih mengorbankan pion b demi tempo: pusat cepat terbuka dan gajah mendapat diagonal emas." },
  { name: "Ruy Lopez (Spanish Game)", sans: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    desc: "Gajah b5 menekan kuda c6 yang menjaga pion e5 — pertarungan pusat secara tidak langsung dan sabar." },
  { name: "Ruy Lopez — Pertahanan Morphy", sans: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
    desc: "Hitam mengusir gajah dengan a6 lalu berkembang normal; putih menjaga tekanan jangka panjang di pusat." },
  { name: "Sicilian Defense", sans: ["e4", "c5"],
    desc: "Jawaban tempur hitam: pion c melawan pusat dari sayap, menciptakan posisi tak seimbang penuh peluang balik." },
  { name: "Sicilian Defense — Varian Najdorf", sans: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
    desc: "Varian tertajam Sicilian: a6 mencegah serangan ke b5 sambil menyiapkan serangan balik di sayap menteri." },
  { name: "Sicilian Defense — Varian Dragon", sans: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"],
    desc: "Gajah fianchetto g7 menekan diagonal panjang; kedua pihak biasanya rokade berlawanan arah dan balapan serangan." },
  { name: "Sicilian Defense — Varian Alapin", sans: ["e4", "c5", "c3"],
    desc: "Putih menghindari teori panjang dan menyiapkan d4 untuk membangun pusat pion ideal." },
  { name: "French Defense", sans: ["e4", "e6"],
    desc: "Hitam menantang pusat dengan d5 dari balik rantai pion kokoh; permainannya strategis dan tertutup." },
  { name: "French Defense — Varian Advance", sans: ["e4", "e6", "d4", "d5", "e5"],
    desc: "Putih mengunci pusat dan meraih ruang; hitam membalas menyerang rantai pion dengan c5 dan f6." },
  { name: "Caro-Kann Defense", sans: ["e4", "c6"],
    desc: "Sepupu French yang lebih sehat: pusat ditantang dengan d5 tanpa mengurung gajah terang hitam." },
  { name: "Caro-Kann — Varian Advance", sans: ["e4", "c6", "d4", "d5", "e5"],
    desc: "Putih merebut ruang di pusat; hitam menekan balik lewat c5 dan gajah yang aktif di luar rantai." },
  { name: "Scandinavian Defense", sans: ["e4", "d5"],
    desc: "Hitam langsung menantang e4; menteri hitam keluar awal dan harus dimainkan hati-hati agar tidak dikejar tempo." },
  { name: "Pirc Defense", sans: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"],
    desc: "Hitam membiarkan putih membangun pusat besar, lalu menyerangnya dari jauh dengan fianchetto dan c5/e5." },
  { name: "Modern Defense", sans: ["e4", "g6"],
    desc: "Pendekatan hipermodern: pusat diserahkan dulu ke putih, lalu ditekan dengan gajah g7 dan dorongan pion." },
  { name: "Alekhine Defense", sans: ["e4", "Nf6"],
    desc: "Kuda memprovokasi pion putih maju berlebihan; hitam lalu menyerang pusat yang terlalu melebar itu." },
  { name: "King's Gambit", sans: ["e4", "e5", "f4"],
    desc: "Gambit klasik era romantis: pion f dikorbankan demi membuka jalur f dan serangan kilat ke raja hitam." },
  { name: "Vienna Game", sans: ["e4", "e5", "Nc3"],
    desc: "Mirip King's Gambit tapi lebih fleksibel: kuda c3 berkembang sambil menyiapkan dorongan f4." },
  { name: "Scotch Game", sans: ["e4", "e5", "Nf3", "Nc6", "d4"],
    desc: "Putih langsung membuka pusat di langkah ke-3 — permainan terbuka dan taktis sejak awal." },
  { name: "Four Knights Game", sans: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"],
    desc: "Keempat kuda berkembang simetris; posisi tenang yang sering berbelok tajam lewat d4." },
  { name: "Petrov's Defense (Russian Game)", sans: ["e4", "e5", "Nf3", "Nf6"],
    desc: "Alih-alih menjaga e5, hitam membalas menyerang e4 — pertahanan solid favorit pemain posisional." },
  { name: "Philidor Defense", sans: ["e4", "e5", "Nf3", "d6"],
    desc: "Hitam menjaga e5 dengan pion d6: kokoh tapi agak pasif, mengandalkan struktur pion yang sehat." },
  { name: "Queen's Gambit", sans: ["d4", "d5", "c4"],
    desc: "Putih menawarkan pion c untuk mengalihkan pion tengah hitam — siapa menguasai pusat, dia memegang kendali." },
  { name: "Queen's Gambit Declined", sans: ["d4", "d5", "c4", "e6"],
    desc: "Hitam menolak gambit dan mempertahankan titik d5 dengan e6; struktur kokoh, permainan strategis panjang." },
  { name: "Queen's Gambit Accepted", sans: ["d4", "d5", "c4", "dxc4"],
    desc: "Hitam menerima pion demi pengembangan cepat; putih mendapat pusat besar sebagai kompensasi." },
  { name: "Slav Defense", sans: ["d4", "d5", "c4", "c6"],
    desc: "c6 menjaga d5 sambil membiarkan gajah c8 bebas keluar — pertahanan paling solid melawan d4." },
  { name: "King's Indian Defense", sans: ["d4", "Nf6", "c4", "g6"],
    desc: "Hitam menyerahkan pusat dulu, rokade cepat, lalu menyerang balik dengan e5 — sering berakhir badai pion ke raja putih." },
  { name: "Nimzo-Indian Defense", sans: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
    desc: "Gajah b4 memaku kuda c3: hitam menekan pusat tanpa pion dan siap merusak struktur pion putih." },
  { name: "Queen's Indian Defense", sans: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"],
    desc: "Gajah fianchetto b7 mengawasi petak terang pusat dari jauh; pertahanan hipermodern yang sangat solid." },
  { name: "Grünfeld Defense", sans: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"],
    desc: "Hitam mengajak putih membangun pusat raksasa, lalu merobohkannya dengan tekanan perwira dan c5." },
  { name: "Catalan Opening", sans: ["d4", "Nf6", "c4", "e6", "g3"],
    desc: "Gajah fianchetto g2 menekan diagonal panjang seumur permainan; favorit para pemain posisional elite." },
  { name: "London System", sans: ["d4", "d5", "Bf4"],
    desc: "Skema universal: gajah keluar sebelum e3, piramida pion kokoh — mudah dipelajari, sulit ditembus." },
  { name: "English Opening", sans: ["c4"],
    desc: "Putih menguasai d5 dari sayap; sering bertransposisi ke banyak pembukaan d4 dengan tempo ekstra." },
  { name: "Réti Opening", sans: ["Nf3"],
    desc: "Pendekatan hipermodern fleksibel: kuda keluar, pusat diserang dari sayap, warna dan rencana menyusul." },
  { name: "Dutch Defense", sans: ["d4", "f5"],
    desc: "Hitam merebut e4 dan membidik serangan ke raja putih; agresif tapi melemahkan kubu rajanya sendiri." },
  { name: "Bird Opening", sans: ["f4"],
    desc: "Cermin Dutch dengan tempo ekstra: putih menguasai e5 dan menyiapkan serangan sayap raja." },
];

/* normalisasi SAN: buang tanda seru/tanya, skak/mate, dan anotasi akhir */
const norm = (s) => String(s).replace(/[!?]+$/g, "").replace(/[+#]+$/g, "").trim();

/* Deteksi pembukaan dari daftar SAN yang sudah dimainkan (dari posisi awal
   atau dari awal urutan skenario). Mengembalikan entri dengan kecocokan
   awalan terpanjang, atau null. */
export function detectOpening(playedSans) {
  const played = (playedSans || []).map(norm);
  let best = null;
  for (const op of OPENINGS) {
    const seq = op.sans.map(norm);
    if (seq.length > played.length) continue;
    if (best && seq.length <= best.sans.length) continue;
    let ok = true;
    for (let i = 0; i < seq.length; i++) if (seq[i] !== played[i]) { ok = false; break; }
    if (ok) best = op;
  }
  return best;
}

/* ---------- Skenario belajar & jebakan ----------
   kind "moves": urutan SAN dari posisi awal (diverifikasi legal).
   kind "fen": posisi langsung. */
export const SCENARIOS = [
  { id: "start", label: "Posisi Awal Standar", kind: "fen",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    note: "Posisi awal standar. Kembangkan perwira, kuasai pusat (e4/d4/e5/d5), lalu rokade untuk mengamankan raja." },
  { id: "scholar", label: "Jebakan Scholar's Mate", kind: "moves",
    moves: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"],
    note: "Jebakan pemula paling terkenal: hitam baru saja blunder dengan Nf6. Putih jalan — temukan skakmat 1 langkah! Petunjuk: bidak f7 hanya dijaga raja." },
  { id: "friedliver", label: "Jebakan Fried Liver Attack", kind: "moves",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5"],
    note: "Fried Liver Attack: hitam rakus memakan pion dengan kuda. Putih jalan — korbankan kuda di f7 (Nxf7!) untuk menyeret raja hitam keluar ke tengah!" },
  { id: "rookmate", label: "Latihan Skakmat Benteng (R+B vs R)", kind: "fen",
    fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
    note: "Latihan endgame wajib: potong jalur raja hitam dengan benteng, dekati rajamu untuk membantu, dorong raja lawan ke tepi papan, lalu skakmat di baris terakhir." },
  { id: "mate2", label: "Puzzle Skakmat 2 Langkah (Jebakan Légal)", kind: "moves",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "d6", "Nc3", "Bg4", "h3", "Bh5", "Nxe5", "Bxd1"],
    note: "Puzzle: hitam baru memakan menteri putih (rakus!). Putih jalan dan skakmat dalam 2 langkah. Petunjuk: mulai dengan pengorbanan gajah di f7." },
];
