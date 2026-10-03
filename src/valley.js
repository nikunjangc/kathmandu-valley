/*
 * valley.js - plans and caches the endless Kathmandu Valley scroll
 *
 * The scroll is cut into chunks CWID units wide. Every chunk reseeds the
 * PRNG with (seed, chunk index), so a stretch of the scroll looks the
 * same whichever direction you reach it from, in the browser or in Node.
 * Drawn items are kept sorted by depth and painted back to front:
 *
 *   sky & birds . Himalaya . haze . rim hills . valley sites . foreground
 *
 * Depends on shanshui.js (engine) and kathmandu.js (motifs).
 */
var Valley = new function() {
  var V = this;
  V.CWID = 512; // chunk width
  V.HEIGHT = 700; // painting height in drawing units
  V.SLOT = 620; // spacing of valley-floor sites
  V.HIMAL = 640; // spacing of Himalayan massifs
  V.RIM = 240; // spacing of rim hills

  V.seed = "";
  V.items = []; // {z, x, x0, x1, canv} sorted by z then x
  V.done = {}; // generated chunk indices

  V.init = function(seed) {
    V.seed = "" + seed;
    V.items = [];
    V.done = {};
    blocks = {};
    Math.seed(V.seed);
    Noise.noiseSeed(Math.floor(Math.random() * 4294967296));
  };

  // order-independent random number in [0,1) for a key
  function hrand() {
    var key = V.seed + "|" + Array.prototype.join.call(arguments, "|");
    return (Prng.hash(key) % 1000003) / 1000003;
  }
  V.hrand = hrand;

  // valley-floor sites are dealt from a shuffled deck, one deck per block
  // of 12 slots: every motif turns up once or more per block, neighbours
  // never repeat, and each block depends only on itself and its neighbour
  var DECK = [
    "town", "town", "town", "durbar", "durbar", "fields",
    "fields", "chautara", "bahal", "village", "swayambhu", "boudha",
  ];
  var LANDMARKS = ["boudha", "swayambhu", "durbar"];
  var blocks = {};

  // arrange the deck so that no two neighbours match
  function arrange(b, first) {
    var bag = {};
    DECK.forEach(function(t) {
      bag[t] = (bag[t] || 0) + 1;
    });
    var out = [];
    var prev = null;
    if (first) {
      out.push(first);
      bag[first]--;
      prev = first;
    }
    for (var i = out.length; i < DECK.length; i++) {
      var rem = DECK.length - i;
      var cand = Object.keys(bag).filter(function(t) {
        return bag[t] > 0 && t != prev;
      });
      if (!cand.length) cand = Object.keys(bag).filter(function(t) {
        return bag[t] > 0;
      });
      cand.sort();
      var most = cand.reduce(function(m, t) {
        return bag[t] > bag[m] ? t : m;
      }, cand[0]);
      var t;
      if (bag[most] * 2 >= rem + 1) {
        t = most;
      } else {
        var tot = 0;
        cand.forEach(function(c) {
          tot += bag[c];
        });
        var r = hrand("deck", b, i) * tot;
        for (var j = 0; j < cand.length; j++) {
          r -= bag[cand[j]];
          if (r < 0) break;
        }
        t = cand[Math.min(j, cand.length - 1)];
      }
      out.push(t);
      bag[t]--;
      prev = t;
    }
    return out;
  }

  function block(b) {
    if (blocks[b]) return blocks[b];
    var p;
    if (b == 0) {
      p = arrange(0, LANDMARKS[Math.floor(hrand("landmark") * LANDMARKS.length)]);
    } else {
      p = arrange(b, null);
      // don't repeat the last site of the block before (its last entry
      // never changes, so this looks only one block back)
      var last = (b - 1 == 0 ? arrange(0, LANDMARKS[Math.floor(hrand("landmark") * LANDMARKS.length)]) : arrange(b - 1, null))[DECK.length - 1];
      if (p[0] == last) {
        for (var j = 2; j < p.length - 1; j++) {
          if (p[j] != last && p[j] != p[1] && p[0] != p[j - 1] && p[0] != p[j + 1]) {
            var t = p[0];
            p[0] = p[j];
            p[j] = t;
            break;
          }
        }
      }
    }
    blocks[b] = p;
    return p;
  }

  V.siteType = function(s) {
    var n = DECK.length;
    var b = Math.floor(s / n);
    return block(b)[s - b * n];
  };

  // scale of valley-floor motifs by depth
  function sca(y) {
    return mapval(y, 560, 680, 1.0, 1.28);
  }

  // what goes into chunk k
  function plan(k) {
    var x0 = k * V.CWID;
    var x1 = x0 + V.CWID;
    var reg = [];

    // snow massifs along the northern horizon
    for (var g = Math.ceil(x0 / V.HIMAL); g * V.HIMAL < x1; g++) {
      var len = normRand(950, 1500);
      reg.push({
        tag: "himal",
        x: g * V.HIMAL + normRand(-140, 140),
        z: normRand(232, 262),
        len: len,
        hei: normRand(140, 215),
        hw: len / 2,
      });
    }
    // low foothills dissolving in the haze
    for (var g = Math.ceil(x0 / 900); g * 900 < x1; g++) {
      if (hrand("haze", g) < 0.7) {
        // distMount needs a length that is a multiple of 50
        var len = Math.round(normRand(700, 1300) / 50) * 50;
        reg.push({ tag: "haze", x: g * 900 + normRand(-200, 200), z: normRand(300, 318), len: len, hei: normRand(40, 75), hw: len / 2 });
      }
    }
    // forested rim of the valley: a far, paler ridge line and nearer hills
    for (var g = Math.ceil(x0 / 420); g * 420 < x1; g++) {
      if (hrand("rim0", g) < 0.85) {
        var wid = normRand(450, 800);
        reg.push({
          tag: "rim",
          far: true,
          x: g * 420 + normRand(-120, 120),
          z: normRand(332, 362),
          wid: wid,
          hei: normRand(110, 210),
          hw: wid / 2 + 40,
        });
      }
    }
    for (var g = Math.ceil(x0 / V.RIM); g * V.RIM < x1; g++) {
      if (hrand("rim", g) < 0.62) {
        var wid = normRand(300, 580);
        reg.push({
          tag: "rim",
          x: g * V.RIM + normRand(-90, 90),
          z: normRand(378, 445),
          wid: wid,
          hei: normRand(80, 165),
          hw: wid / 2 + 40,
        });
      }
    }
    // the city spread across the middle of the valley
    for (var g = Math.ceil(x0 / 270); g * 270 < x1; g++) {
      var r = hrand("mid", g);
      var z = normRand(452, 530);
      if (r < 0.6) {
        reg.push({ tag: "quarter", x: g * 270 + normRand(-60, 60), z: z, hw: 200 });
      } else if (r < 0.85) {
        reg.push({ tag: "grove", x: g * 270 + normRand(-60, 60), z: z, hw: 120 });
      }
    }
    // brushed lines of the valley floor
    for (var g = Math.ceil(x0 / 380); g * 380 < x1; g++) {
      reg.push({ tag: "plain", x: g * 380 + normRand(-100, 100), z: normRand(440, 610), hw: 320 });
    }
    // valley-floor sites on a fixed grid of slots
    for (var s = Math.ceil((x0 - V.SLOT / 2) / V.SLOT); s * V.SLOT + V.SLOT / 2 < x1; s++) {
      var c = s * V.SLOT + V.SLOT / 2;
      if (c < x0) continue;
      var type = V.siteType(s);
      var hilly = type == "swayambhu" || type == "village";
      reg.push({
        tag: type,
        x: c + normRand(-50, 50),
        z: hilly ? normRand(560, 595) : normRand(618, 668),
        hw: 360,
      });
    }
    // foreground trees and river between the sites
    for (var s = Math.ceil(x0 / V.SLOT); s * V.SLOT < x1; s++) {
      var r = hrand("fg", s);
      if (r < 0.32) {
        reg.push({ tag: "trees", x: s * V.SLOT + normRand(-50, 50), z: normRand(692, 715), hw: 180 });
      } else if (r < 0.5) {
        reg.push({ tag: "river", x: s * V.SLOT + normRand(-80, 80), z: normRand(680, 698), hw: 420 });
      }
    }
    // kites wheeling overhead (painted last, high in the sky)
    if (hrand("birds", k) < 0.45) {
      reg.push({ tag: "birds", x: x0 + Math.random() * V.CWID, y: normRand(50, 160), z: 9999, hw: 260 });
    }
    return reg;
  }

  function draw(it) {
    var sd = Math.random() * 100;
    var x = it.x;
    var y = it.z;
    switch (it.tag) {
      case "himal":
        return Kath.himalaya(x, y, sd, { len: it.len, hei: it.hei, str: mapval(y, 232, 262, 0.75, 1) });
      case "haze":
        return Mount.distMount(x - it.len / 2, y, sd, { hei: it.hei, len: it.len, seg: 5 });
      case "rim":
        if (it.far) {
          return Kath.hill(x, y, sd, {
            wid: it.wid,
            hei: it.hei,
            forest: normRand(0.6, 1),
            terr: 0,
            hamlet: 0,
            str: 0.7,
            tex: 60,
          });
        }
        return Kath.hill(x, y, sd, {
          wid: it.wid,
          hei: it.hei,
          forest: normRand(0.4, 0.95),
          terr: Math.random() < 0.55 ? normRand(0.25, 0.8) : 0,
          hamlet: 0.5,
          top: Math.random() < 0.12 ? "temple" : "",
          str: mapval(y, 378, 445, 0.85, 1),
          tex: 90,
        });
      case "quarter":
        return Kath.quarter(x, y, sd, { wid: normRand(200, 320), sca: mapval(y, 452, 530, 0.5, 0.68) });
      case "grove":
        return Kath.grove(x, y, sd, { wid: normRand(100, 200), sca: mapval(y, 452, 530, 0.6, 0.8) });
      case "plain":
        return Kath.plain(x, y, sd, { wid: normRand(380, 600) });
      case "town":
        return Kath.town(x, y, sd, { wid: normRand(340, 440), sca: sca(y) });
      case "durbar":
        return Kath.durbar(x, y, sd, { wid: normRand(380, 460), sca: sca(y) });
      case "boudha":
        return Kath.boudha(x, y, sd, { wid: normRand(100, 112), sca: sca(y) });
      case "swayambhu":
        return Kath.hill(x, y, sd, {
          wid: normRand(380, 460),
          hei: normRand(150, 190),
          forest: 0.9,
          terr: 0.25,
          hamlet: 0.6,
          top: "stupa",
        });
      case "village":
        return Kath.hill(x, y, sd, {
          wid: normRand(420, 520),
          hei: normRand(110, 150),
          forest: 0.4,
          terr: 0.9,
          hamlet: 1,
          top: "village",
        });
      case "chautara":
        return Kath.chautara(x, y, sd, { sca: sca(y) });
      case "bahal":
        return Kath.bahal(x, y, sd, { sca: sca(y) });
      case "fields":
        return Kath.fields(x, y, sd, { wid: normRand(320, 420), sca: sca(y) });
      case "trees":
        var c = "";
        var n = randChoice([1, 1, 2]);
        for (var i = 0; i < n; i++) {
          var tx = x + normRand(-60, 60);
          var kind = randChoice([0, 0, 1, 2]);
          if (kind == 0) c += Tree.tree04(tx, y + normRand(-4, 4), { hei: normRand(160, 240) });
          else if (kind == 1) c += Tree.tree05(tx, y + normRand(-4, 4), { hei: normRand(170, 260) });
          else c += Kath.pipal(tx, y + normRand(-4, 4), sd, { hei: normRand(150, 190) });
        }
        if (Math.random() < 0.6) {
          c += Mount.rock(x + normRand(-80, 80), y + 6, sd, { wid: normRand(40, 70), hei: normRand(30, 50), sha: 4 });
        }
        return c;
      case "river":
        return water(x, y, sd, { len: normRand(600, 900), clu: 8 + Math.floor(Math.random() * 6), hei: 2 });
      case "birds":
        return Kath.birds(x, it.y, sd, {});
    }
    return "";
  }

  function insert(it) {
    var a = 0;
    var b = V.items.length;
    while (a < b) {
      var m = (a + b) >> 1;
      var o = V.items[m];
      if (o.z < it.z || (o.z == it.z && o.x <= it.x)) a = m + 1;
      else b = m;
    }
    V.items.splice(a, 0, it);
  }

  // draw chunk k: a list of {id, tag, z, x, x0, x1, canv}; pure, so it
  // can run in a worker
  V.make = function(k) {
    Math.seed(V.seed + "#" + k);
    var reg = plan(k);
    var items = [];
    for (var i = 0; i < reg.length; i++) {
      var canv = draw(reg[i]);
      if (canv.indexOf("NaN") >= 0) canv = canv.replace(/NaN/g, -1000);
      items.push({
        id: k + ":" + i,
        tag: reg[i].tag,
        z: reg[i].z,
        x: reg[i].x,
        x0: reg[i].x - reg[i].hw,
        x1: reg[i].x + reg[i].hw,
        canv: canv,
      });
    }
    return items;
  };

  // store a drawn chunk
  V.add = function(k, items) {
    if (V.done[k]) return false;
    for (var i = 0; i < items.length; i++) insert(items[i]);
    V.done[k] = true;
    return true;
  };

  // draw and store chunk k (no-op if it already exists)
  V.gen = function(k) {
    if (V.done[k]) return false;
    return V.add(k, V.make(k));
  };

  // forget chunk k (it is repainted identically if needed again)
  V.drop = function(k) {
    if (!V.done[k]) return;
    var pre = k + ":";
    V.items = V.items.filter(function(it) {
      return it.id.indexOf(pre) != 0;
    });
    delete V.done[k];
  };

  // chunks whose items may reach into [xmin, xmax]; the widest items (a
  // Himalayan massif) reach about 890 units beyond their own chunk
  V.REACH = 1000;
  V.chunksFor = function(xmin, xmax) {
    var ks = [];
    var k0 = Math.floor((xmin - V.REACH) / V.CWID);
    var k1 = Math.floor((xmax + V.REACH) / V.CWID);
    for (var k = k0; k <= k1; k++) ks.push(k);
    return ks;
  };
  V.ensure = function(xmin, xmax) {
    var ks = V.chunksFor(xmin, xmax);
    var n = 0;
    for (var i = 0; i < ks.length; i++) if (V.gen(ks[i])) n++;
    return n;
  };

  // SVG markup of everything overlapping [xmin, xmax], back to front
  V.render = function(xmin, xmax) {
    var out = [];
    for (var i = 0; i < V.items.length; i++) {
      var it = V.items[i];
      if (it.x1 > xmin && it.x0 < xmax) out.push(it.canv);
    }
    return out.join("");
  };

  // a standalone SVG of the stretch [x, x + w]
  V.svg = function(x, w, opts) {
    opts = opts || {};
    var h = V.HEIGHT;
    var scale = opts.scale || 1;
    V.ensure(x, x + w);
    var bg = opts.paper
      ? "<defs><pattern id='kv-paper' patternUnits='userSpaceOnUse' width='512' height='512'>" +
        "<image xlink:href='" + opts.paper + "' width='512' height='512'/></pattern></defs>" +
        "<rect x='" + x + "' y='0' width='" + w + "' height='" + h + "' fill='url(#kv-paper)'/>"
      : "<rect x='" + x + "' y='0' width='" + w + "' height='" + h + "' fill='rgb(240,228,204)'/>";
    return (
      "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'" +
      " width='" + Math.round(w * scale) + "' height='" + Math.round(h * scale) + "'" +
      " viewBox='" + x + " 0 " + w + " " + h + "'>" +
      bg +
      "<g style='mix-blend-mode:multiply'>" + V.render(x - 10, x + w + 10) + "</g></svg>"
    );
  };

  // warm paper texture (RGBA, tiles seamlessly), after the original's canvas
  V.paper = function(reso) {
    reso = reso || 512;
    var st = 2463534242;
    var rnd = function() {
      st ^= st << 13;
      st ^= st >>> 17;
      st ^= st << 5;
      return (st >>> 0) / 4294967296;
    };
    var G = 64;
    var lat = [];
    for (var i = 0; i < G * G; i++) lat.push(rnd());
    var sm = function(t) {
      return t * t * (3 - 2 * t);
    };
    var vn = function(x, y) {
      var xi = Math.floor(x);
      var yi = Math.floor(y);
      var u = sm(x - xi);
      var v = sm(y - yi);
      var at = function(a, b) {
        return lat[(((b % G) + G) % G) * G + (((a % G) + G) % G)];
      };
      var t0 = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
      var t1 = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
      return t0 + (t1 - t0) * v;
    };
    var data = new Uint8ClampedArray(reso * reso * 4);
    var put = function(i, j, r, g, b) {
      if (i >= reso || j >= reso) return;
      var o = (j * reso + i) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    };
    for (var i = 0; i < reso / 2 + 1; i++) {
      for (var j = 0; j < reso / 2 + 1; j++) {
        var n = 0.65 * vn(i * 0.1, j * 0.1) + 0.35 * vn(i * 0.025, j * 0.025);
        var c = 245 + n * 10 - rnd() * 20;
        var r = Math.round(c);
        var g = Math.round(c * 0.95);
        var b = Math.round(c * 0.85);
        put(i, j, r, g, b);
        put(reso - i, j, r, g, b);
        put(i, reso - j, r, g, b);
        put(reso - i, reso - j, r, g, b);
      }
    }
    return { width: reso, height: reso, data: data };
  };
}();
