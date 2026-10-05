/* Wrapper Stockfish (UCI) via Web Worker. Vanilla JS, tanpa dependensi.
   Protokol loader nmrugg: postMessage(string UCI) -> onmessage(string baris UCI). */
(function (global) {
  "use strict";

  function ChessEngine() {
    this.worker = null;
    this.ready = false;
    this._loadPromise = null;
    this._lines = [];
    this._onInfo = null;
    this._onBest = null;
    this._onError = null;
    this._depthSeen = 0;
    this._busy = false;
  }

  ChessEngine.prototype.onError = function (cb) {
    this._onError = cb;
  };

  ChessEngine.prototype.onRaw = function (cb) {
    this._onRaw = cb;
  };

  ChessEngine.prototype._fail = function (msg) {
    this._busy = false;
    this._loadPromise = null; // biar bisa coba lagi
    try { if (this.worker) this.worker.terminate(); } catch (e) {}
    this.worker = null;
    this.ready = false;
    if (this._onError) this._onError(msg);
  };

  ChessEngine.prototype.load = function () {
    var self = this;
    if (this.ready) return Promise.resolve();
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = new Promise(function (resolve, reject) {
      function startWorker(url) {
        var w;
        try {
          w = new Worker(url);
        } catch (e) {
          self._loadPromise = null;
          reject(new Error("Web Worker tidak didukung peramban ini."));
          return;
        }
        self.worker = w;

        var done = false;
        var timer = setTimeout(function () {
          if (!done) {
            done = true;
            self._fail("Engine tidak merespons (timeout 30 dtk).");
            reject(new Error("Engine tidak merespons (timeout 30 dtk)."));
          }
        }, 30000);

        w.onmessage = function (e) {
          var line = String(e.data);
          if (self._onRaw) self._onRaw("← " + line.slice(0, 200));
          if (!self.ready) {
            if (line === "uciok") {
              done = true;
              clearTimeout(timer);
              self.ready = true;
              w.postMessage("setoption name MultiPV value 3");
              resolve();
            }
            return;
          }
          self._handle(line);
        };
        w.onerror = function (e) {
          if (self._onRaw) self._onRaw("⚠ worker error: " + (e.message || e.type || "?"));
          if (!done) {
            done = true;
            clearTimeout(timer);
            var msg = "Engine error: " + (e.message || "gagal dimuat");
            self._loadPromise = null;
            self.worker = null;
            reject(new Error(msg));
          } else {
            self._fail("Engine berhenti tiba-tiba.");
          }
        };
        // PENTING: hanya string UCI — jangan kirim objek apa pun,
        // loader akan crash (TypeError) kalau menerima non-string.
        w.postMessage("uci");
      }

      // Di dalam APK (file://), WebView memblokir Worker dari URL file://.
      // Solusi: baca file worker jadi teks, jalankan via Blob URL.
      // Di web biasa (https) perilaku tidak berubah.
      if (typeof location !== "undefined" && location.protocol === "file:") {
        fetch("engine/stockfish.js").then(function (r) { return r.text(); }).then(function (code) {
          var blobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
          startWorker(blobUrl);
        }).catch(function (e) {
          self._loadPromise = null;
          reject(new Error("Engine error: gagal membaca file engine (" + (e.message || e) + ")"));
        });
      } else {
        startWorker("engine/stockfish.js");
      }
    });
    return this._loadPromise;
  };

  ChessEngine.prototype._handle = function (line) {
    if (line.indexOf("bestmove") === 0) {
      this._busy = false;
      var m = line.match(/^bestmove\s+(\S+)/);
      if (this._onBest) {
        var cb = this._onBest;
        this._onBest = null;
        cb(m ? m[1] : null);
      }
      return;
    }
    var info = line.match(
      /^info\s+.*?depth\s+(\d+).*?\bscore\s+(cp|mate)\s+(-?\d+).*?\bpv\s+(.+)$/
    );
    if (!info) return;
    var depth = +info[1],
      kind = info[2],
      val = +info[3],
      pv = info[4].trim().split(/\s+/);
    var mm = line.match(/\bmultipv\s+(\d+)/);
    var multipv = mm ? +mm[1] : 1;
    if (depth < this._depthSeen) return;
    if (depth > this._depthSeen) {
      this._depthSeen = depth;
      this._lines = [];
    }
    this._lines[multipv] = { depth: depth, kind: kind, val: val, pv: pv };
    if (this._onInfo) this._onInfo(this._lines.slice(1, 4), depth);
  };

  // cb(updateLines, depth) live; done(bestUci) saat selesai.
  ChessEngine.prototype.analyze = function (fen, depth, cb, done) {
    var self = this;
    var start = function () {
      self._lines = [];
      self._depthSeen = 0;
      self._busy = true;
      self._onInfo = cb;
      self._onBest = done;
      self.worker.postMessage("ucinewgame");
      self.worker.postMessage("position fen " + fen);
      self.worker.postMessage("go depth " + depth);
      if (self._onRaw) self._onRaw("→ go depth " + depth + " @ " + new Date().toISOString());
    };
    if (this._busy) {
      var prev = this._onBest;
      this._onBest = function () {
        self._onBest = prev;
        start();
      };
      this.worker.postMessage("stop");
      return;
    }
    start();
  };

  ChessEngine.prototype.stop = function () {
    if (this._busy && this.worker) this.worker.postMessage("stop");
  };

  // Darurat: bunuh worker & reset state (mis. stop tak direspons).
  ChessEngine.prototype.forceStop = function () {
    try { if (this.worker) this.worker.terminate(); } catch (e) {}
    this.worker = null;
    this.ready = false;
    this._busy = false;
    this._loadPromise = null;
    this._onBest = null;
    this._onInfo = null;
  };

  ChessEngine.prototype.isBusy = function () {
    return this._busy;
  };

  global.ChessEngine = ChessEngine;
})(window);
