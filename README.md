# ♞ Kalkulator Catur

Web analisis catur: tempel posisi (FEN) atau susun manual → Stockfish 18 memprediksi
3 langkah terbaik (musuh bakal jalan ke mana), ditampilkan sebagai panah di papan
+ skor evaluasi + lanjutan variasinya.

- 100% client-side: engine Stockfish 18 (NNUE, single-thread) jalan sebagai WebAssembly di browser/HP — tanpa server, tanpa API berbayar.
- Arrows: hijau = terbaik, kuning = ke-2, oranye = ke-3.
- Ketuk langkah di daftar untuk pratinjau posisi di papan.
