/* Wrapper Stockfish (UCI) via Web Worker. Vanilla JS, tanpa dependensi. */
(function (global) {
  "use strict";

  function ChessEngine() {
    this.worker = null;
    this.ready = false;
    this._readyCbs = [];
    this._lines = [];
    this._onInfo = null;
    this._onBest = null;
    this._depthSeen = 0;
    this._busy = false;
    this._loadStarted = false;
  }

  ChessEngine.prototype.load = function (onProgress) {
    var self = this;
    if (this.worker) return Promise.resolve();
    if (this._loadStarted) return this._loadPromise;
    this._loadStarted = true;

    this._loadPromise = new Promise(function (resolve, reject) {
      var w;
      try {
        w = new Worker("engine/stockfish.js");
      } catch (e) {
        reject(new Error("Web Worker tidak didukung / gagal dibuat."));
        return;
      }
      self.worker = w;

      // Progress unduhan WASM (kalau didukung build ini)
      var gotProgress = false;
      try {
        var ch = new MessageChannel();
        ch.port1.onmessage = function (e) {
          var d = e.data || {};
          if (typeof d.percent === "number") {
            gotProgress = true;
            if (onProgress) onProgress(d.percent);
          }
        };
        w.postMessage({ progressPort: ch.port2 }, [ch.port2]);
      } catch (e) { /* abaikan */ }

      var timer = setTimeout(function () {
        if (!self.ready) reject(new Error("Engine tidak merespons (timeout)."));
      }, 30000);

      w.onmessage = function (e) {
        var line = String(e.data);
        if (!self.ready) {
          if (line === "uciok") {
            self.ready = true;
            clearTimeout(timer);
            self._send("setoption name MultiPV value 3");
            resolve();
            self._readyCbs.forEach(function (cb) { cb(); });
            self._readyCbs = [];
          }
          return;
        }
        self._handle(line);
      };
      w.onerror = function (e) {
        clearTimeout(timer);
        reject(new Error("Engine error: " + (e.message || "unknown")));
      };
      w.postMessage("uci");
      if (onProgress && !gotProgress) {
        // fallback: tampilkan progres tak tentu
        setTimeout(function () { if (!self.ready && onProgress) onProgress(-1); }, 800);
      }
    });
    return this._loadPromise;
  };

  ChessEngine.prototype._send = function (cmd) {
    if (this.worker) this.worker.postMessage(cmd);
  };

  ChessEngine.prototype._handle = function (line) {
    if (line.indexOf("bestmove") === 0) {
      this._busy = false;
      var m = line.match(/^bestmove\s+(\S+)/);
      if (this._onBest) this._onBest(m ? m[1] : null);
      return;
    }
    var info = line.match(
      /^info\s+.*?depth\s+(\d+).*?\bscore\s+(cp|mate)\s+(-?\d+).*?\bpv\s+(.+)$/
    );
    if (!info) return;
    var depth = +info[1],
      kind = info[2],
      val = +info[3],
      pv = info[5].trim().split(/\s+/);
    var mm = line.match(/\bmultipv\s+(\d+)/);
    var multipv = mm ? +mm[1] : 1;
    // hanya pakai info dari iterasi terbaru agar tidak mundur
    if (depth < this._depthSeen) return;
    if (depth > this._depthSeen) {
      this._depthSeen = depth;
      this._lines = [];
    }
    this._lines[multipv] = { depth: depth, kind: kind, val: val, pv: pv };
    if (this._onInfo) this._onInfo(this._lines.slice(1, 4), depth);
  };

  // cb(update) dipanggil live tiap ada info baru; done(bestUci) saat selesai.
  ChessEngine.prototype.analyze = function (fen, depth, cb, done) {
    var self = this;
    var start = function () {
      self._lines = [];
      self._depthSeen = 0;
      self._busy = true;
      self._onInfo = cb;
      self._onBest = done;
      self._send("ucinewgame");
      self._send("position fen " + fen);
      self._send("go depth " + depth);
    };
    if (!this.ready) {
      this._readyCbs.push(start);
      return;
    }
    if (this._busy) {
      // hentikan pencarian lama dulu, lalu mulai yang baru
      var prev = this._onBest;
      this._onBest = function () {
        self._onBest = prev;
        start();
      };
      this._send("stop");
      return;
    }
    start();
  };

  ChessEngine.prototype.stop = function () {
    if (this._busy) this._send("stop");
  };

  ChessEngine.prototype.isBusy = function () {
    return this._busy;
  };

  global.ChessEngine = ChessEngine;
})(window);
