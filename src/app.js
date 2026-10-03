/*
 * app.js - the scroll viewer
 *
 * Drag, swipe, mouse-wheel or arrow keys to travel along the valley;
 * space toggles auto-scroll. Chunks are painted in a Web Worker when the
 * page is served over http(s), and on the main thread otherwise (for
 * example when index.html is opened straight from disk).
 *
 * The SVG covers a window about three screens wide and is slid with a CSS
 * transform, so moving is cheap; it is re-anchored now and then, and each
 * painted item is inserted into the DOM in depth order as it arrives.
 */
(function() {
  var H = Valley.HEIGHT;
  var NS = "http://www.w3.org/2000/svg";
  var $ = function(id) {
    return document.getElementById(id);
  };
  var stage = $("stage");
  var svg = $("painting");
  var layer = $("ink");
  var loading = $("loading");
  var playBtn = $("play");
  var seedInput = $("seed");

  var view = { x: 0, w: 1000, scale: 1 };
  var win = { x0: 0, x1: -1 }; // world range covered by the svg element
  var mounted = {}; // item id -> <g>
  var pending = {}; // chunk index -> true while being painted
  var workers = []; // [{w, busy}], empty when painting on the main thread
  var paperURL = "";
  var SEED = "";
  var epoch = 0;

  /* ---------------- seed ---------------- */
  function urlSeed() {
    var m = /[?&]seed=([^&#]*)/.exec(location.search);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  }
  function freshSeed() {
    // Math.random is the engine's seeded PRNG, so use the platform's
    if (window.crypto && crypto.getRandomValues) {
      return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000);
    }
    return String(Date.now() % 1000000);
  }

  /* ---------------- paper ---------------- */
  function makePaper() {
    var p = Valley.paper(512);
    var c = document.createElement("canvas");
    c.width = p.width;
    c.height = p.height;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(p.width, p.height);
    img.data.set(p.data);
    ctx.putImageData(img, 0, 0);
    paperURL = c.toDataURL("image/png");
    document.body.style.backgroundImage = "url(" + paperURL + ")";
  }

  /* ---------------- layout & window ---------------- */
  function layout() {
    var r = stage.getBoundingClientRect();
    view.scale = Math.max(0.2, Math.min(r.height / H, r.width / 470));
    view.w = r.width / view.scale;
    svg.style.height = Math.round(H * view.scale) + "px";
    if (SEED) reanchor(true);
  }

  function reanchor(force) {
    var m = Math.max(view.w, 700);
    if (!force && view.x > win.x0 + m * 0.25 && view.x + view.w < win.x1 - m * 0.25) {
      place();
      return;
    }
    win.x0 = Math.floor(view.x - m);
    win.x1 = Math.ceil(view.x + view.w + m);
    var w = win.x1 - win.x0;
    svg.setAttribute("viewBox", win.x0 + " 0 " + w + " " + H);
    svg.style.width = Math.round(w * view.scale) + "px";
    place();
    forget();
    sync();
    request();
  }

  // drop painted chunks far behind the traveller to bound memory
  function forget() {
    var far = 12 * Valley.CWID;
    for (var k in Valley.done) {
      var x = (+k + 0.5) * Valley.CWID;
      if (x < view.x - far || x > view.x + view.w + far) {
        var pre = k + ":";
        for (var id in mounted) {
          if (id.indexOf(pre) == 0) {
            layer.removeChild(mounted[id]);
            delete mounted[id];
          }
        }
        Valley.drop(+k);
      }
    }
  }

  function place() {
    var dx = -(view.x - win.x0) * view.scale;
    svg.style.transform = "translate3d(" + dx.toFixed(1) + "px,0,0)";
  }

  function moveTo(x) {
    view.x = x;
    reanchor(false);
  }

  /* ---------------- mounting painted items ---------------- */
  function sync() {
    var items = Valley.items;
    var keep0 = win.x0 - view.w;
    var keep1 = win.x1 + view.w;
    var next = null;
    // walk back to front so each item can be inserted before the
    // nearest mounted item that is painted after it
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      var g = mounted[it.id];
      var want = it.x1 > win.x0 - 50 && it.x0 < win.x1 + 50;
      if (want && !g) {
        g = document.createElementNS(NS, "g");
        g.innerHTML = it.canv;
        layer.insertBefore(g, next);
        mounted[it.id] = g;
      } else if (g && !(it.x1 > keep0 && it.x0 < keep1)) {
        layer.removeChild(g);
        delete mounted[it.id];
        g = null;
      }
      if (g) next = g;
    }
    var ready = true;
    var ks = Valley.chunksFor(view.x, view.x + view.w);
    for (var i = 0; i < ks.length; i++) if (!Valley.done[ks[i]]) ready = false;
    if (ready) loading.style.opacity = 0;
  }

  /* ---------------- painting chunks ---------------- */
  function wanted() {
    var ks = Valley.chunksFor(win.x0, win.x1);
    var ahead = playing ? Valley.chunksFor(win.x1, win.x1 + view.w) : [];
    var c = view.x + view.w / 2;
    var all = ks.concat(ahead).filter(function(k, i, a) {
      return !Valley.done[k] && !pending[k] && a.indexOf(k) == i;
    });
    all.sort(function(a, b) {
      return Math.abs((a + 0.5) * Valley.CWID - c) - Math.abs((b + 0.5) * Valley.CWID - c);
    });
    return all;
  }

  function inFlight() {
    var n = 0;
    for (var k in pending) n++;
    return n;
  }

  function request() {
    if (!SEED) return;
    var ks = wanted();
    if (workers.length) {
      for (var i = 0; i < workers.length && ks.length; i++) {
        if (workers[i].busy) continue;
        var k = ks.shift();
        pending[k] = true;
        workers[i].busy = 1;
        workers[i].w.postMessage({ type: "gen", k: k, epoch: epoch });
      }
    } else if (ks.length && !inFlight()) {
      var k = ks[0];
      pending[k] = true;
      var e = epoch;
      setTimeout(function() {
        if (e != epoch) return;
        Valley.gen(k);
        delete pending[k];
        sync();
        request();
      }, 16);
    }
  }

  function received(m) {
    if (m.epoch != epoch) {
      request();
      return;
    }
    delete pending[m.k];
    Valley.add(m.k, m.items);
    sync();
    request();
  }

  function workerMain() {
    self.onmessage = function(e) {
      var m = e.data;
      if (m.type == "ping") {
        self.postMessage({ type: "ready" });
      } else if (m.type == "init") {
        Valley.init(m.seed);
      } else if (m.type == "gen") {
        self.postMessage({ type: "chunk", k: m.k, epoch: m.epoch, items: Valley.make(m.k) });
      }
    };
  }

  // build workers from the same scripts this page loaded
  function startWorkers(n) {
    var tags = document.querySelectorAll("script[data-kv]");
    var jobs = Array.prototype.map.call(tags, function(t) {
      if (!t.src) return Promise.resolve(t.textContent);
      return fetch(t.src).then(function(r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      });
    });
    return Promise.all(jobs).then(function(parts) {
      var src = parts.join("\n;\n") + "\n;(" + workerMain.toString() + ")();";
      var url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      var all = [];
      for (var i = 0; i < n; i++) all.push(spawn(url));
      return Promise.all(all);
    });
  }
  function spawn(url) {
    var rec = { w: new Worker(url), busy: 0 };
    return new Promise(function(resolve, reject) {
      var t = setTimeout(function() {
        reject(new Error("worker timeout"));
      }, 5000);
      rec.w.onerror = function(e) {
        clearTimeout(t);
        reject(e);
      };
      rec.w.onmessage = function(e) {
        if (e.data.type != "ready") return;
        clearTimeout(t);
        rec.w.onmessage = function(e) {
          rec.busy = 0;
          if (e.data.type == "chunk") received(e.data);
        };
        rec.w.onerror = function(e) {
          console.warn("a worker failed; painting on the main thread", e);
          workers.forEach(function(r) {
            r.w.terminate();
          });
          workers = [];
          pending = {};
          request();
        };
        resolve(rec);
      };
      rec.w.postMessage({ type: "ping" });
    });
  }

  /* ---------------- seed handling ---------------- */
  function paint(seed) {
    SEED = String(seed).trim() || freshSeed();
    seedInput.value = SEED;
    epoch++;
    Valley.init(SEED);
    pending = {};
    mounted = {};
    layer.innerHTML = "";
    loading.style.opacity = 1;
    view.x = 0;
    workers.forEach(function(r) {
      r.w.postMessage({ type: "init", seed: SEED });
    });
    var url = location.pathname + "?seed=" + encodeURIComponent(SEED);
    try {
      history.replaceState(null, "", url);
    } catch (e) {}
    document.title = "Kathmandu Valley · " + SEED;
    reanchor(true);
  }

  /* ---------------- interaction ---------------- */
  var drag = null;
  var vel = 0;
  var glide = 0;
  stage.addEventListener("pointerdown", function(e) {
    if (e.button !== undefined && e.button > 0) return;
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, t: performance.now() };
    vel = 0;
    cancelAnimationFrame(glide);
    stage.classList.add("dragging");
  });
  stage.addEventListener("pointermove", function(e) {
    if (!drag) return;
    var now = performance.now();
    var dx = (e.clientX - drag.x) / view.scale;
    var dt = Math.max(1, now - drag.t);
    vel = 0.8 * (-dx / dt) + 0.2 * vel;
    drag = { x: e.clientX, t: now };
    moveTo(view.x - dx);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    stage.classList.remove("dragging");
    var last = performance.now();
    (function step() {
      var now = performance.now();
      var dt = now - last;
      last = now;
      vel *= Math.pow(0.994, dt);
      if (Math.abs(vel) < 0.01) return;
      moveTo(view.x + vel * dt);
      glide = requestAnimationFrame(step);
    })();
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener(
    "wheel",
    function(e) {
      e.preventDefault();
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode == 1) d *= 30;
      moveTo(view.x + d / view.scale);
    },
    { passive: false },
  );

  function glideBy(dx) {
    cancelAnimationFrame(glide);
    var x0 = view.x;
    var t0 = performance.now();
    (function step() {
      var t = Math.min(1, (performance.now() - t0) / 450);
      var e = 1 - Math.pow(1 - t, 3);
      moveTo(x0 + dx * e);
      if (t < 1) glide = requestAnimationFrame(step);
    })();
  }

  var playing = false;
  var lastTick = 0;
  function tick(now) {
    if (!playing) return;
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    if (!drag) moveTo(view.x + dt * 0.05);
    requestAnimationFrame(tick);
  }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", p ? "Pause" : "Auto-scroll");
    playBtn.setAttribute("aria-pressed", p ? "true" : "false");
    lastTick = 0;
    if (p) requestAnimationFrame(tick);
  }

  $("left").onclick = function() {
    glideBy(-view.w * 0.45);
  };
  $("right").onclick = function() {
    glideBy(view.w * 0.45);
  };
  playBtn.onclick = function() {
    setPlaying(!playing);
  };
  $("seedform").onsubmit = function(e) {
    e.preventDefault();
    paint(seedInput.value);
  };
  $("dice").onclick = function() {
    paint(freshSeed());
  };
  document.addEventListener("keydown", function(e) {
    if (e.target == seedInput || e.target.tagName == "BUTTON") return;
    if (e.key == "ArrowLeft") glideBy(-view.w * 0.3);
    else if (e.key == "ArrowRight") glideBy(view.w * 0.3);
    else if (e.key == " ") {
      e.preventDefault();
      setPlaying(!playing);
    } else return;
  });
  window.addEventListener("resize", layout);

  /* ---------------- export ---------------- */
  function save(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
  function viewSVG(scale) {
    return Valley.svg(Math.round(view.x), Math.round(view.w), { paper: paperURL, scale: scale });
  }
  $("svg").onclick = function() {
    save(new Blob([viewSVG(1)], { type: "image/svg+xml" }), "kathmandu-valley-" + SEED + ".svg");
  };
  $("png").onclick = function() {
    var scale = 2;
    var text = viewSVG(scale);
    var img = new Image();
    var url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    img.onload = function() {
      var c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob(function(b) {
        save(b, "kathmandu-valley-" + SEED + ".png");
      });
    };
    img.src = url;
  };

  /* ---------------- start ---------------- */
  makePaper();
  layout();
  var first = urlSeed() || freshSeed();
  var n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  if (location.protocol != "file:" && window.Worker && window.Blob && window.fetch) {
    startWorkers(n)
      .then(function(list) {
        workers = list;
      })
      .catch(function(e) {
        console.info("painting on the main thread:", e && e.message);
      })
      .then(function() {
        paint(first);
      });
  } else {
    paint(first);
  }
})();
