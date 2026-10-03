/*
 * kathmandu.js - Kathmandu Valley motifs for the {Shan, Shui}* engine
 *
 * Snow peaks of the Himalaya, forested rim hills with rice terraces,
 * Newari pagodas and brick houses, stupas with the Buddha's eyes, prayer
 * flags, chautara resting trees and kites in the sky. Everything is drawn
 * with the engine's own brushes (poly, stroke, blob, texture, Tree, Man)
 * so the new motifs sit inside the same ink painting.
 *
 * Coordinates: every motif is drawn around (xoff, yoff), where yoff is the
 * ground line and negative y points up. Functions return SVG markup.
 */
var Kath = new function() {
  var K = this;

  /* ------------------------------------------------------------------ */
  /* palette: ink plus a few muted watercolour washes                     */
  /* ------------------------------------------------------------------ */
  function rgba(r, g, b, a) {
    return "rgba(" + r + "," + g + "," + b + "," + Math.max(0, a).toFixed(3) + ")";
  }
  var ink = function(a) { return rgba(100, 100, 100, a); };
  var cool = function(a) { return rgba(96, 108, 132, a); }; // shaded snow
  var brick = function(a) { return rgba(164, 98, 70, a); };
  var gold = function(a) { return rgba(198, 152, 70, a); };
  var saffron = function(a) { return rgba(224, 140, 46, a); };
  // prayer flag order: sky, wind, fire, water, earth
  var FLAGS = [[60, 96, 160], [255, 255, 255], [192, 64, 50], [68, 130, 86], [224, 178, 56]];
  K.palette = { ink: ink, cool: cool, brick: brick, gold: gold, saffron: saffron, flags: FLAGS };

  /* ------------------------------------------------------------------ */
  /* small helpers                                                        */
  /* ------------------------------------------------------------------ */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function shift(pts, x, y) {
    return pts.map(function(p) {
      return [p[0] + x, p[1] + y];
    });
  }
  // flat wash or paper-white mask
  function fill(pts, x, y, col) {
    return poly(pts, { xof: x, yof: y, fil: col, str: "none", wid: 0 });
  }
  // an ink line through pts (local coordinates), drawn at (x, y)
  function line(pts, x, y, args) {
    args = args || {};
    return stroke(shift(div(pts, args.seg || 4), x, y), {
      wid: args.wid != undefined ? args.wid : 1,
      col: args.col || ink(0.5),
      noi: args.noi != undefined ? args.noi : 0.6,
      out: args.out != undefined ? args.out : 0,
      fun:
        args.fun ||
        function() {
          return 1;
        },
    });
  }
  function rect(x0, y0, x1, y1) {
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  function ellipse(cx, cy, rx, ry, n) {
    var pts = [];
    n = n || 16;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }
  // point at arc length d along a polyline
  function along(pts, d) {
    for (var i = 1; i < pts.length; i++) {
      var l = distance(pts[i - 1], pts[i]);
      if (d <= l || i == pts.length - 1) {
        var t = l == 0 ? 0 : Math.min(1, d / l);
        return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
      }
      d -= l;
    }
    return pts[pts.length - 1];
  }
  function polyLength(pts) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += distance(pts[i - 1], pts[i]);
    return l;
  }
  K.util = { lerp: lerp, shift: shift, fill: fill, line: line, rect: rect };

  /* ------------------------------------------------------------------ */
  /* Himalaya: a snow massif with sharp peaks, shaded faces and ribs      */
  /* ------------------------------------------------------------------ */
  K.himalaya = function(xoff, yoff, seed, args) {
    args = args || {};
    var len = args.len != undefined ? args.len : 1200;
    var hei = args.hei != undefined ? args.hei : 200;
    var str = args.str != undefined ? args.str : 1; // ink strength, lower = farther
    seed = seed || 0;

    var span = 4;
    var n = Math.ceil(len / span);
    var npk = 2 + Math.floor(Math.random() * 3);
    var main = Math.floor(Math.random() * npk);
    var peaks = [];
    for (var i = 0; i < npk; i++) {
      peaks.push({
        x: len * lerp(0.14, 0.86, (i + 0.2 + Math.random() * 0.6) / npk),
        h: hei * (i == main ? 1 : normRand(0.55, 0.88)),
        sl: normRand(0.55, 1.15),
        sr: normRand(0.55, 1.15),
      });
    }

    // ridge line: the highest of a few "tents", broken up by ridged noise
    var ridge = [];
    for (var k = 0; k <= n; k++) {
      var x = k * span;
      var h = hei * 0.24;
      for (var i = 0; i < npk; i++) {
        var d = x - peaks[i].x;
        h = Math.max(h, peaks[i].h - (d < 0 ? -d * peaks[i].sl : d * peaks[i].sr));
      }
      var r1 = 1 - Math.abs(Noise.noise(x * 0.012, seed, 7) * 2 - 1);
      var r2 = Noise.noise(x * 0.05, seed, 9) - 0.5;
      var r3 = Noise.noise(x * 0.16, seed, 11) - 0.5;
      h += (r1 - 0.6) * hei * 0.2 + r2 * hei * 0.12 + r3 * hei * 0.035;
      var env = Math.min(1, Math.sin((Math.PI * k) / n) * 3);
      ridge.push([x - len / 2, -Math.max(0, h) * env]);
    }

    // apexes = local maxima high enough to carry snow faces
    var apex = [];
    var win = 10;
    for (var k = win; k <= n - win; k++) {
      var y = ridge[k][1];
      var ok = y < -hei * 0.42;
      for (var q = k - win; q <= k + win && ok; q++) {
        if (ridge[q][1] < y) ok = false;
      }
      if (ok && (apex.length == 0 || k - apex[apex.length - 1] > win)) {
        apex.push(k);
      }
    }
    function lowest(a, b) {
      var m = a;
      for (var k = a; k <= b; k++) if (ridge[k][1] > ridge[m][1]) m = k;
      return m;
    }

    var canv = "";
    // paper-white body hides what lies behind
    canv += fill(ridge.concat([[len / 2, 60], [-len / 2, 60]]), xoff, yoff, "white");

    for (var a = 0; a < apex.length; a++) {
      var ka = apex[a];
      var kl = lowest(a == 0 ? 0 : apex[a - 1], ka);
      var kr = lowest(ka, a == apex.length - 1 ? n : apex[a + 1]);
      var top = ridge[ka];
      var tall = -top[1];
      var depth = tall * normRand(0.6, 0.85);

      // the spine (front ridge) running down from the summit
      var sp = [top.slice()];
      var lean = normRand(-0.3, 0.2);
      var n0 = Math.random() * 10;
      for (var s = 1; s <= 14; s++) {
        var dy = depth / 14;
        var px = sp[s - 1][0] + (lean + (Noise.noise(s * 0.45, n0) - 0.5) * 1.8) * dy;
        sp.push([px, sp[s - 1][1] + dy]);
      }
      var bot = sp[sp.length - 1];

      // shadowed (west) face between the left slope and the spine:
      // five light washes with ragged lower edges, darker near the summit
      var kmin = Math.max(kl, ka - Math.floor((tall * 1.3) / span));
      var depths = [0.18, 0.34, 0.5, 0.68, 0.88];
      for (var L = 0; L < depths.length; L++) {
        var fd = depth * depths[L];
        var wash = [];
        for (var k = kmin; k <= ka; k++) {
          if (ridge[k][1] - top[1] <= fd) wash.push(ridge[k]);
        }
        if (wash.length < 2) continue;
        var spl = sp.filter(function(p) {
          return p[1] - top[1] <= fd;
        });
        wash = wash.concat(spl.slice(1));
        var xa = wash[wash.length - 1][0];
        var xb = wash[0][0];
        var ya = wash[wash.length - 1][1];
        var yb = wash[0][1];
        for (var j = 1; j < 12; j++) {
          var t = j / 12;
          // the lower edge sags towards the spine and wanders
          var yy = top[1] + fd * (0.75 + 0.25 * Math.sin(t * Math.PI));
          yy += (Noise.noise(t * 4, L * 1.7, n0) - 0.5) * fd * 0.6;
          var lo = Math.max(ya, yb);
          wash.push([lerp(xa, xb, t), Math.max(yy, Math.min(lo, top[1] + fd * 0.5))]);
        }
        canv += fill(wash, xoff, yoff, cool(0.034 * str));
      }

      // hatching down the shadow face, denser near the summit
      var hatch = 10 + Math.floor((ka - kmin) / 2);
      for (var h = 0; h < hatch; h++) {
        var t = Math.pow(Math.random(), 0.6);
        var st = ridge[Math.floor(lerp(kmin, ka, t))];
        var room = bot[1] - st[1];
        if (room < 8) continue;
        var l = room * normRand(0.2, 0.75) * (0.4 + 0.6 * t);
        var dx = (bot[0] - top[0]) / depth - normRand(0.05, 0.45);
        var hl = [];
        for (var j = 0; j <= 8; j++) {
          var dd = (l * j) / 8;
          hl.push([st[0] + dx * dd + (Noise.noise(j * 0.5, h, n0) - 0.5) * 3, st[1] + dd + 1.5]);
        }
        canv += stroke(shift(hl, xoff, yoff), {
          wid: normRand(0.5, 1.6),
          col: cool((0.07 + Math.random() * 0.16) * str),
          noi: 0.8,
          out: 0,
          fun: function(x) {
            return Math.pow(1 - x, 0.5);
          },
        });
      }
      // dark rock showing through the snow, just under the crest
      for (var r = 0; r < 4; r++) {
        var t = normRand(0.45, 0.95);
        var st = ridge[Math.floor(lerp(kmin, ka, t))];
        var rl = normRand(4, 12);
        var rk = [];
        for (var j = 0; j <= 4; j++) {
          rk.push([st[0] - (j / 4) * rl * 0.35, st[1] + 2 + (j / 4) * rl]);
        }
        canv += stroke(shift(rk, xoff, yoff), {
          wid: normRand(1, 2.2),
          col: ink(normRand(0.18, 0.35) * str),
          noi: 0.7,
          out: 0,
          fun: function(x) {
            return 1 - x;
          },
        });
      }

      // ribs branching off the spine
      for (var b = 0; b < 3; b++) {
        var bi = 2 + Math.floor(Math.random() * 8);
        var b0 = sp[bi];
        var side = b == 0 ? 1 : randChoice([-1, 1]);
        var bl = depth * normRand(0.15, 0.35);
        var br = [b0];
        for (var j = 1; j <= 6; j++) {
          br.push([
            b0[0] + side * (bl * j) / 6 * normRand(0.6, 0.9),
            b0[1] + (bl * j) / 6 + (Noise.noise(j * 0.4, b, n0) - 0.5) * 2,
          ]);
        }
        canv += stroke(shift(br, xoff, yoff), {
          wid: 1.1,
          col: ink((side > 0 ? 0.22 : 0.3) * str),
          noi: 0.9,
          out: 0,
          fun: function(x) {
            return Math.pow(1 - x, 0.6);
          },
        });
      }

      // the spine itself, heavy at the top and fading out
      canv += stroke(shift(sp, xoff, yoff), {
        wid: 1.6,
        col: ink(0.42 * str),
        noi: 0.8,
        out: 0,
        fun: function(x) {
          return Math.pow(1 - x, 0.8);
        },
      });

      // a few rock bands on the sunlit (east) face
      for (var r = 0; r < 3; r++) {
        var kk = Math.floor(lerp(ka + 2, kr, normRand(0.15, 0.7)));
        if (kk >= ridge.length) continue;
        var rs = ridge[kk];
        var rl = Math.min(30, (bot[1] - rs[1]) * normRand(0.2, 0.5));
        if (rl < 6) continue;
        var rb = [];
        for (var j = 0; j <= 5; j++) {
          rb.push([rs[0] + (j / 5) * rl * normRand(-0.2, 0.4), rs[1] + (j / 5) * rl + 1]);
        }
        canv += stroke(shift(rb, xoff, yoff), {
          wid: 0.9,
          col: ink(0.2 * str),
          noi: 0.9,
          out: 0,
          fun: function(x) {
            return 1 - x;
          },
        });
      }
    }

    // outline, broken where the ridge meets the haze
    var outl = ridge.filter(function(p) {
      return p[1] < -hei * 0.18;
    });
    if (outl.length > 3) {
      var segs = [[]];
      for (var i = 0; i < ridge.length; i++) {
        if (ridge[i][1] < -hei * 0.18) {
          segs[segs.length - 1].push(ridge[i]);
        } else if (segs[segs.length - 1].length) {
          segs.push([]);
        }
      }
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].length < 3) continue;
        var top = Math.min.apply(null, segs[i].map(function(p) {
          return p[1];
        }));
        if (top > -hei * 0.38) continue;
        canv += stroke(shift(segs[i], xoff, yoff), {
          wid: 1.8,
          col: ink(0.56 * str),
          noi: 0.9,
          out: 0,
          fun: function(x) {
            return Math.pow(Math.sin(x * Math.PI), 0.3);
          },
        });
      }
    }
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* platforms, stairs, guardians                                         */
  /* ------------------------------------------------------------------ */
  // one level of a stepped brick or stone platform, front face w x h
  function plinth(x, y, w, h, args) {
    args = args || {};
    var tint = "tint" in args ? args.tint : brick(0.15);
    var canv = "";
    var face = rect(-w / 2, 0, w / 2, -h);
    canv += fill(face, x, y, "white");
    if (tint) canv += fill(face, x, y, tint);
    // brick courses
    for (var c = 2.6; c < h - 1; c += 2.6) {
      canv += line([[-w / 2 + 1, -c], [w / 2 - 1, -c]], x, y, {
        wid: 0.25,
        col: ink(0.12),
        noi: 1,
        seg: 6,
      });
    }
    canv += line([[-w / 2 - 0.5, -h], [w / 2 + 0.5, -h]], x, y, { wid: 0.9, col: ink(0.55) });
    canv += line([[-w / 2, -h], [-w / 2, 0]], x, y, { wid: 0.7, col: ink(0.45) });
    canv += line([[w / 2, -h], [w / 2, 0]], x, y, { wid: 0.7, col: ink(0.45) });
    canv += line([[-w / 2, 0], [w / 2, 0]], x, y, { wid: 0.5, col: ink(0.3) });
    return canv;
  }
  K.plinth = plinth;

  // a stepped platform; returns {canv, top} where top is the height reached
  function platform(x, y, levels, args) {
    args = args || {};
    var canv = "";
    var yy = 0;
    for (var i = 0; i < levels.length; i++) {
      canv += plinth(x, y + yy, levels[i][0], levels[i][1], args);
      yy -= levels[i][1] + (i < levels.length - 1 ? levels[i][1] * 0.35 : 0);
    }
    return { canv: canv, top: yy };
  }

  // central staircase climbing a platform, with guardian figures
  function stairs(x, y, top, w, args) {
    args = args || {};
    var gua = args.gua != undefined ? args.gua : true;
    var canv = "";
    var wt = w * 0.82;
    var band = [[-w / 2, 0], [w / 2, 0], [wt / 2, top], [-wt / 2, top]];
    canv += fill(band, x, y, "white");
    canv += fill(band, x, y, ink(0.05));
    for (var s = -2.2; s > top + 0.5; s -= 2.2) {
      var ws = lerp(w, wt, s / top);
      canv += line([[-ws / 2, s], [ws / 2, s]], x, y, { wid: 0.3, col: ink(0.35), seg: 3 });
    }
    canv += line([[-w / 2, 0], [-wt / 2, top]], x, y, { wid: 0.6, col: ink(0.5) });
    canv += line([[w / 2, 0], [wt / 2, top]], x, y, { wid: 0.6, col: ink(0.5) });
    if (gua && args.levels) {
      var yy = 0;
      for (var i = 0; i < args.levels.length; i++) {
        var lv = args.levels[i];
        var gy = yy - lv[1];
        var gw = lerp(w, wt, gy / top) / 2 + w * 0.12;
        var gs = Math.max(2.2, lv[1] * 0.75);
        canv += guardian(x - gw, y + gy, gs);
        canv += guardian(x + gw, y + gy, gs);
        yy -= lv[1] + (i < args.levels.length - 1 ? lv[1] * 0.35 : 0);
      }
    }
    return canv;
  }

  // a tiny stone guardian (lion, elephant, wrestler...) on a pedestal
  function guardian(x, y, s) {
    var canv = "";
    canv += fill(rect(-s * 0.45, 0, s * 0.45, -s * 0.35), x, y, ink(0.35));
    var body = blob(x, y - s * 0.9, {
      len: s * 1.15,
      wid: s * 0.8,
      ang: Math.PI / 2,
      col: ink(0.5),
      noi: 0.3,
      ret: 1,
    });
    canv += poly(body, { fil: ink(0.48), str: ink(0.48), wid: 0.3 });
    canv += poly(ellipse(x + s * 0.08, y - s * 1.55, s * 0.28, s * 0.24, 8), { fil: ink(0.55) });
    return canv;
  }

  /* ------------------------------------------------------------------ */
  /* Newari pagoda temple                                                 */
  /* ------------------------------------------------------------------ */
  function walls(x, y, w, h, kind) {
    var canv = "";
    var face = rect(-w / 2, 0, w / 2, -h);
    canv += fill(face, x, y, "white");
    canv += fill(face, x, y, brick(0.15));
    canv += line([[-w / 2, 0.5], [-w / 2, -h]], x, y, { wid: 0.7, col: ink(0.45) });
    canv += line([[w / 2, 0.5], [w / 2, -h]], x, y, { wid: 0.7, col: ink(0.45) });
    if (kind == 1) {
      // three or five carved doorways under a timber cornice
      var nd = w > 48 ? 5 : 3;
      var dw = w / (nd * 2 + 1);
      var dh = h * 0.56;
      for (var i = 0; i < nd; i++) {
        var dx = -w / 2 + dw * (1 + i * 2);
        canv += fill(rect(dx, 0, dx + dw, -dh), x, y, ink(0.34));
        canv += line([[dx - 0.8, -dh - 0.8], [dx + dw + 0.8, -dh - 0.8]], x, y, {
          wid: 0.5,
          col: ink(0.5),
          seg: 3,
        });
        if (dw > 3.5) {
          canv += line([[dx + dw / 2, 0], [dx + dw / 2, -dh]], x, y, { wid: 0.25, col: ink(0.25), seg: 3 });
        }
      }
      // gilded torana over the middle door
      var mx = 0;
      var tw = dw * 1.2;
      var tor = [];
      for (var i = 0; i <= 8; i++) {
        var a = Math.PI * (i / 8);
        tor.push([mx - Math.cos(a) * tw, -dh - 1.2 - Math.sin(a) * tw * 0.75]);
      }
      canv += fill(tor, x, y, gold(0.55));
      canv += line(tor, x, y, { wid: 0.35, col: ink(0.45), seg: 1 });
      canv += line([[-w / 2, -h * 0.84], [w / 2, -h * 0.84]], x, y, { wid: 0.4, col: ink(0.35) });
    } else {
      // small latticed windows
      var nw = w > 26 ? 3 : 1;
      var ww = Math.min(4.5, w / (nw * 2.4));
      var wh = h * 0.42;
      for (var i = 0; i < nw; i++) {
        var wx = nw == 1 ? 0 : lerp(-w * 0.28, w * 0.28, i / (nw - 1));
        var wr = rect(wx - ww / 2, -h * 0.25, wx + ww / 2, -h * 0.25 - wh);
        canv += fill(wr, x, y, ink(0.22));
        canv += line(wr.concat([wr[0]]), x, y, { wid: 0.3, col: ink(0.5), seg: 2 });
      }
    }
    return canv;
  }

  // one tier of roof: straight hipped slope seen from the front
  function nroof(x, y, ew, tw, ye, yt, gilded) {
    var canv = "";
    var pts = [[-ew / 2, ye], [-tw / 2, yt], [tw / 2, yt], [ew / 2, ye]];
    canv += fill(pts, x, y, "white");
    canv += fill(pts, x, y, gilded ? gold(0.55) : ink(0.2));
    var nt = Math.max(3, Math.floor(ew / 3));
    for (var i = 1; i < nt; i++) {
      var t = i / nt;
      canv += line([[lerp(-tw / 2, tw / 2, t), yt + 0.5], [lerp(-ew / 2, ew / 2, t), ye]], x, y, {
        wid: 0.3,
        col: ink(gilded ? 0.16 : 0.24),
        seg: 3,
      });
    }
    canv += line([[-tw / 2, yt], [-ew / 2, ye]], x, y, { wid: 0.8, col: ink(0.55) });
    canv += line([[tw / 2, yt], [ew / 2, ye]], x, y, { wid: 0.8, col: ink(0.55) });
    canv += line([[-ew / 2 - 0.5, ye], [ew / 2 + 0.5, ye]], x, y, { wid: 1.1, col: ink(0.62) });
    canv += line([[-ew / 2 + 1.5, ye + 1.4], [ew / 2 - 1.5, ye + 1.4]], x, y, { wid: 0.4, col: ink(0.38) });
    // fringe of little bells hanging from the eave
    for (var bx = -ew / 2 + 2.5; bx < ew / 2 - 2; bx += 2.4) {
      canv += line([[bx, ye + 1.6], [bx, ye + 3.2]], x, y, { wid: 0.3, col: ink(0.35), seg: 2 });
    }
    return canv;
  }

  // carved roof struts under an eave line at y
  function struts(x, y, bw, ew, len) {
    var canv = "";
    if (len < 2) return canv;
    var n = Math.max(3, Math.round(bw / 5));
    for (var i = 0; i <= n; i++) {
      var sx = lerp(-bw / 2 + 1.2, bw / 2 - 1.2, i / n);
      canv += line([[sx, 1.5], [sx * 0.98, len]], x, y, { wid: 0.55, col: ink(0.42), seg: 3 });
    }
    canv += line([[-bw / 2, len], [-ew / 2 + 2.5, 1.5]], x, y, { wid: 0.8, col: ink(0.5) });
    canv += line([[bw / 2, len], [ew / 2 - 2.5, 1.5]], x, y, { wid: 0.8, col: ink(0.5) });
    return canv;
  }

  // gilded finial (gajur)
  function gajur(x, y, h) {
    var canv = "";
    var w = h * 0.36;
    var parts = [
      rect(-w * 0.55, 0.5, w * 0.55, -h * 0.07),
      [
        [-w * 0.5, -h * 0.07],
        [-w * 0.42, -h * 0.2],
        [-w * 0.15, -h * 0.27],
        [w * 0.15, -h * 0.27],
        [w * 0.42, -h * 0.2],
        [w * 0.5, -h * 0.07],
      ],
      rect(-w * 0.14, -h * 0.26, w * 0.14, -h * 0.34),
      [[-w * 0.38, -h * 0.34], [-w * 0.16, -h * 0.58], [w * 0.16, -h * 0.58], [w * 0.38, -h * 0.34]],
      ellipse(0, -h * 0.64, w * 0.13, h * 0.06, 10),
    ];
    for (var i = 0; i < parts.length; i++) {
      canv += fill(parts[i], x, y, gold(0.7));
      canv += poly(parts[i], { xof: x, yof: y, fil: "none", str: ink(0.45), wid: 0.35 });
    }
    canv += line([[0, -h * 0.68], [0, -h]], x, y, { wid: 0.5, col: ink(0.55), seg: 3 });
    return canv;
  }

  K.pagoda = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 40; // ground-floor width
    var tie = args.tie != undefined ? args.tie : 3; // number of roofs
    var plt = args.plt != undefined ? args.plt : 2; // plinth levels
    var gil = args.gil != undefined ? args.gil : 0; // 1: gilded top roof, 2: all gilded
    var ban = args.ban != undefined ? args.ban : Math.random() < 0.35; // hanging banner
    var canv = "";
    var y = 0;

    if (plt > 0) {
      var levels = [];
      for (var i = 0; i < plt; i++) {
        levels.push([wid * (1.3 + (plt - i) * 0.34), wid * (plt > 3 ? 0.12 : 0.15)]);
      }
      var pf = platform(xoff, yoff, levels);
      canv += pf.canv;
      canv += stairs(xoff, yoff, pf.top, wid * 0.32, { levels: levels });
      y = pf.top;
    }

    var bw = wid;
    var yb = y;
    var yt = y;
    var eaves = [];
    var pitch = 0.58;
    for (var r = 0; r < tie; r++) {
      var bh = r == 0 ? wid * 0.62 : wid * Math.max(0.24, 0.36 - r * 0.03);
      var nbw = bw * 0.74;
      canv += walls(xoff, yoff + yb, bw, bh, r == 0 ? 1 : 0);
      var yw = yb - bh;
      var ew = bw + wid * (r == 0 ? 0.86 : 0.7) * Math.pow(0.9, r);
      var ye = yw + ((ew - bw) / 2) * pitch;
      var topw = r == tie - 1 ? Math.max(3, bw * 0.16) : nbw * 0.94;
      yt = ye - ((ew - topw) / 2) * pitch;
      canv += struts(xoff, yoff + ye, bw, ew, Math.min(wid * 0.18, (yb - ye) * 0.7));
      canv += nroof(xoff, yoff, ew, topw, ye, yt, gil == 2 || (gil == 1 && r == tie - 1));
      eaves.push(ye);
      yb = yt + 0.8;
      bw = nbw;
    }
    canv += gajur(xoff, yoff + yt + 0.5, wid * 0.62);

    if (ban && tie > 2) {
      // gilded banner (pataka) hanging from the top roof down the front
      var b0 = yt + 4;
      var b1 = eaves[Math.max(0, tie - 3)] - wid * 0.04;
      var bwid = Math.max(0.7, wid * 0.022);
      var bl = [];
      var br = [];
      for (var i = 0; i <= 12; i++) {
        var t = i / 12;
        var sw = Math.sin(t * Math.PI * 1.5) * wid * 0.015;
        bl.push([sw - bwid / 2, lerp(b0, b1, t)]);
        br.push([sw + bwid / 2, lerp(b0, b1, t)]);
      }
      var bp = bl.concat(br.reverse());
      canv += fill(bp, xoff, yoff, gold(0.6));
      canv += poly(bp, { xof: xoff, yof: yoff, fil: "none", str: ink(0.35), wid: 0.3 });
    }
    return canv;
  };

  // a stone shikhara temple (like Krishna Mandir), drawn simply
  K.shikhara = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 30;
    var canv = "";
    var pf = platform(xoff, yoff, [[wid * 1.5, wid * 0.14], [wid * 1.25, wid * 0.12]], {
      tint: ink(0.06),
    });
    canv += pf.canv;
    var y = pf.top;
    // pavilion storey with columns
    var ph = wid * 0.45;
    canv += fill(rect(-wid / 2, y, wid / 2, y - ph), xoff, yoff, "white");
    canv += fill(rect(-wid / 2, y, wid / 2, y - ph), xoff, yoff, ink(0.06));
    var nc = 5;
    for (var i = 0; i <= nc; i++) {
      var cx = lerp(-wid / 2 + 1, wid / 2 - 1, i / nc);
      canv += line([[cx, y], [cx, y - ph]], xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 3 });
    }
    canv += line([[-wid / 2 - 1, y - ph], [wid / 2 + 1, y - ph]], xoff, yoff, { wid: 0.9, col: ink(0.55) });
    y -= ph;
    // corner kiosks
    for (var s = -1; s <= 1; s += 2) {
      var kx = s * wid * 0.36;
      var kh = wid * 0.42;
      var kio = [[kx - wid * 0.1, y], [kx - wid * 0.06, y - kh], [kx, y - kh * 1.25], [kx + wid * 0.06, y - kh], [kx + wid * 0.1, y]];
      canv += fill(kio, xoff, yoff, "white");
      canv += line(kio, xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 3 });
    }
    // central spire, curved like a corn cob
    var sh = wid * 1.35;
    var sp = [];
    for (var i = 0; i <= 16; i++) {
      var t = i / 16;
      sp.push([-wid * 0.24 * Math.pow(1 - t, 0.55), y - sh * t]);
    }
    var spr = sp.map(function(p) {
      return [-p[0], p[1]];
    });
    var spire = sp.concat(spr.reverse());
    canv += fill(spire, xoff, yoff, "white");
    canv += fill(spire, xoff, yoff, ink(0.07));
    for (var i = 2; i < 16; i += 2) {
      var p = sp[i];
      canv += line([[p[0], p[1]], [-p[0], p[1]]], xoff, yoff, { wid: 0.3, col: ink(0.3), seg: 3 });
    }
    canv += line(sp, xoff, yoff, { wid: 0.7, col: ink(0.5), seg: 1 });
    canv += line(spr, xoff, yoff, { wid: 0.7, col: ink(0.5), seg: 1 });
    canv += gajur(xoff, yoff + y - sh + 1, wid * 0.4);
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* stupa: dome, harmika with the Buddha's eyes, 13-ring spire, flags     */
  /* ------------------------------------------------------------------ */
  function eyes(x, y, w) {
    var canv = "";
    var ew = w * 0.3;
    var eh = ew * 0.42;
    for (var s = -1; s <= 1; s += 2) {
      var cx = s * w * 0.2;
      var brow = [];
      var up = [];
      var lo = [];
      for (var i = 0; i <= 10; i++) {
        var t = i / 10;
        brow.push([cx + (t - 0.5) * ew * 1.3, -eh * 1.05 - Math.sin(t * Math.PI) * eh * 0.5]);
        up.push([cx + (t - 0.5) * ew, -Math.sin(t * Math.PI) * eh * 0.62]);
        lo.push([cx + (t - 0.5) * ew, Math.sin(t * Math.PI) * eh * 0.32]);
      }
      canv += poly(ellipse(cx, eh * 0.02, eh * 0.33, eh * 0.33, 10), { xof: x, yof: y, fil: ink(0.82) });
      canv += line(brow, x, y, { wid: Math.max(0.3, ew * 0.06), col: ink(0.75), seg: 1, noi: 0.3 });
      canv += line(up, x, y, { wid: Math.max(0.35, ew * 0.075), col: ink(0.85), seg: 1, noi: 0.2 });
      canv += line(lo, x, y, { wid: Math.max(0.2, ew * 0.035), col: ink(0.6), seg: 1, noi: 0.2 });
    }
    // the "nose": a curl like the Nepali numeral one, then the third eye
    var r = eh * 0.42;
    var nose = [];
    for (var i = 0; i <= 10; i++) {
      var a = lerp(-Math.PI, Math.PI * 0.4, i / 10);
      nose.push([Math.cos(a) * r, -eh * 0.1 + Math.sin(a) * r]);
    }
    nose.push([r * 0.15, eh * 0.9]);
    nose.push([-r * 0.1, eh * 1.45]);
    canv += line(nose, x, y, { wid: Math.max(0.3, ew * 0.055), col: ink(0.75), seg: 1, noi: 0.3 });
    canv += poly(ellipse(0, -eh * 1.85, eh * 0.16, eh * 0.2, 8), { xof: x, yof: y, fil: ink(0.7) });
    return canv;
  }

  K.stupa = function(xoff, yoff, seed, args) {
    args = args || {};
    var W = args.wid != undefined ? args.wid : 80; // dome diameter
    var ter = args.ter != undefined ? args.ter : 0; // mandala terraces
    var sty = args.sty != undefined ? args.sty : 0; // 0 Swayambhu, 1 Boudha, 2 stone chaitya
    var fla = args.fla != undefined ? args.fla : 3; // strings of flags per side
    var eye = args.eye != undefined ? args.eye : sty != 2;
    var ground = args.ground; // optional: dx -> local ground y for flag anchors
    var canv = "";
    var y = 0;
    var levels = [];
    for (var i = 0; i < ter; i++) {
      levels.push([W * (1.8 - i * 0.22), W * 0.065]);
    }
    if (ter) {
      var pf = platform(xoff, yoff, levels, { tint: sty == 2 ? ink(0.08) : null });
      canv += pf.canv;
      canv += stairs(xoff, yoff, pf.top, W * 0.16, { gua: false });
      y = pf.top;
    }

    // drum
    var drum = rect(-W * 0.53, y, W * 0.53, y - W * 0.04);
    canv += fill(drum, xoff, yoff, "white");
    if (sty == 2) canv += fill(drum, xoff, yoff, ink(0.08));
    canv += line([[-W * 0.53, y - W * 0.04], [W * 0.53, y - W * 0.04]], xoff, yoff, { wid: 0.7, col: ink(0.45) });
    canv += line([[-W * 0.53, y], [-W * 0.53, y - W * 0.04]], xoff, yoff, { wid: 0.5, col: ink(0.4), seg: 2 });
    canv += line([[W * 0.53, y], [W * 0.53, y - W * 0.04]], xoff, yoff, { wid: 0.5, col: ink(0.4), seg: 2 });
    y -= W * 0.04;

    // dome
    var dh = W * (sty == 1 ? 0.37 : 0.47);
    var dome = [];
    for (var i = 0; i <= 48; i++) {
      var a = Math.PI * (i / 48);
      dome.push([-Math.cos(a) * W / 2, y - Math.pow(Math.sin(a), 0.8) * dh]);
    }
    canv += fill(dome, xoff, yoff, "white");
    if (sty == 2) canv += fill(dome, xoff, yoff, ink(0.07));
    // soft shadow on the west side of the dome
    var sh = [];
    for (var i = 0; i <= 24; i++) {
      var a = Math.PI * (i / 48);
      sh.push([-Math.cos(a) * W / 2, y - Math.pow(Math.sin(a), 0.8) * dh]);
    }
    for (var i = 24; i >= 0; i--) {
      var a = Math.PI * (i / 48);
      sh.push([-Math.cos(a) * W * 0.36 - W * 0.04, y - Math.pow(Math.sin(a), 0.8) * dh * 0.96]);
    }
    canv += fill(sh, xoff, yoff, cool(0.07));
    canv += line(dome, xoff, yoff, { wid: 1.1, col: ink(0.55), seg: 1, noi: 0.7 });
    var yt = y - dh;

    // saffron lotus petals painted around the crown (Boudhanath)
    if (sty == 1) {
      var np = 9;
      for (var i = 0; i < np; i++) {
        var phi = lerp(-Math.PI * 0.42, Math.PI * 0.42, i / (np - 1));
        var cx = Math.sin(phi) * W * 0.32;
        var pw = W * 0.045 * Math.cos(phi) + W * 0.012;
        var cy = y - Math.pow(1 - Math.pow((cx * 2) / W, 2), 0.4) * dh + W * 0.01;
        var pt = [];
        for (var j = 0; j <= 10; j++) {
          var t = j / 10;
          pt.push([cx + (t - 0.5) * 2 * pw, cy + Math.sin(t * Math.PI) * W * 0.11]);
        }
        canv += line(pt, xoff, yoff, { wid: Math.max(0.6, W * 0.008), col: saffron(0.6), seg: 1, noi: 0.4 });
      }
    }

    // harmika with the eyes
    var hw = W * 0.27;
    var hh = W * 0.2;
    var yh = yt + dh * 0.05;
    var harm = rect(-hw / 2, yh, hw / 2, yh - hh);
    canv += fill(harm, xoff, yoff, "white");
    canv += fill(harm, xoff, yoff, sty == 2 ? ink(0.1) : gold(0.12));
    canv += poly(harm.concat([harm[0]]), { xof: xoff, yof: yoff, fil: "none", str: ink(0.5), wid: 0.6 });
    if (eye) canv += eyes(xoff, yoff + yh - hh * 0.46, hw);

    // stepped cornice
    var c1 = rect(-hw * 0.62, yh - hh, hw * 0.62, yh - hh * 1.12);
    var c2 = rect(-hw * 0.72, yh - hh * 1.12, hw * 0.72, yh - hh * 1.24);
    var metal = sty == 2 ? ink(0.18) : gold(0.6);
    canv += fill(c1, xoff, yoff, metal) + fill(c2, xoff, yoff, metal);
    canv += poly(c2.concat([c2[0]]), { xof: xoff, yof: yoff, fil: "none", str: ink(0.45), wid: 0.4 });

    // thirteen rings
    var sb = yh - hh * 1.24;
    var sH = W * (sty == 1 ? 0.52 : 0.58);
    var w0 = hw * 0.78;
    var w1 = hw * 0.3;
    for (var i = 0; i < 13; i++) {
      var a0 = sb - (sH * i) / 13;
      var a1 = sb - (sH * (i + 1)) / 13;
      var wa = lerp(w0, w1, i / 13);
      var wb = lerp(w0, w1, (i + 1) / 13);
      var ring = [[-wa / 2, a0], [wa / 2, a0], [wb / 2, a1 + 0.5], [-wb / 2, a1 + 0.5]];
      canv += fill(ring, xoff, yoff, "white");
      canv += fill(ring, xoff, yoff, sty == 2 ? ink(0.12 + (i % 2) * 0.05) : gold(0.5 + (i % 2) * 0.12));
      canv += line([[-wa / 2, a0], [wa / 2, a0]], xoff, yoff, { wid: 0.3, col: ink(0.4), seg: 2 });
    }
    canv += line([[-w0 / 2, sb], [-w1 / 2, sb - sH]], xoff, yoff, { wid: 0.5, col: ink(0.5) });
    canv += line([[w0 / 2, sb], [w1 / 2, sb - sH]], xoff, yoff, { wid: 0.5, col: ink(0.5) });

    // gilded plaque (toran) at the foot of the spire
    if (sty == 1) {
      var tor = [];
      for (var i = 0; i <= 10; i++) {
        var t = i / 10;
        tor.push([(t - 0.5) * hw * 0.62, sb - Math.pow(Math.sin(t * Math.PI), 0.8) * sH * 0.24]);
      }
      canv += fill(tor, xoff, yoff, gold(0.6));
      canv += line(tor, xoff, yoff, { wid: 0.45, col: ink(0.5), seg: 1 });
    }

    // parasol and finial
    var su = sb - sH;
    var um = [[-hw * 0.5, su], [hw * 0.5, su], [hw * 0.2, su - hh * 0.32], [-hw * 0.2, su - hh * 0.32]];
    canv += fill(um, xoff, yoff, metal);
    canv += line(um.concat([um[0]]), xoff, yoff, { wid: 0.4, col: ink(0.5), seg: 2 });
    for (var bx = -hw * 0.45; bx <= hw * 0.45; bx += Math.max(1.6, hw * 0.12)) {
      canv += line([[bx, su], [bx, su + Math.max(1.2, hh * 0.12)]], xoff, yoff, { wid: 0.25, col: ink(0.4), seg: 2 });
    }
    var gh = Math.max(6, hh * 1.1);
    canv += gajur(xoff, yoff + su - hh * 0.32, gh);

    // prayer flags strung from the pinnacle
    if (fla > 0) {
      var tip = [0, su - hh * 0.32 - gh * 0.55];
      var siz = Math.max(2.2, W * 0.042);
      var base = ter ? levels[0][1] * 0.5 : 0;
      for (var s = -1; s <= 1; s += 2) {
        for (var i = 0; i < fla; i++) {
          var ax = s * W * lerp(0.7, 1.9, (i + Math.random() * 0.6) / fla);
          var ay = ground ? ground(ax) : -base + Math.random() * W * 0.04;
          canv += K.flags(xoff + tip[0], yoff + tip[1], xoff + ax, yoff + ay, {
            siz: siz,
            sag: 0.035,
          });
        }
      }
    }
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* prayer flags (lungta) on a sagging string                            */
  /* ------------------------------------------------------------------ */
  K.flags = function(x0, y0, x1, y1, args) {
    args = args || {};
    var siz = args.siz != undefined ? args.siz : 5;
    var sag = args.sag != undefined ? args.sag : 0.08;
    var gap = args.gap != undefined ? args.gap : 0.25;
    var len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    var n = Math.max(3, Math.floor(len / 5));
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push([lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(Math.PI * t) * len * sag]);
    }
    var canv = stroke(pts, {
      wid: 0.35,
      col: ink(0.45),
      noi: 0.3,
      out: 0,
      fun: function() {
        return 1;
      },
    });
    var L = polyLength(pts);
    var step = siz * (1 + gap);
    var ci = Math.floor(Math.random() * 5);
    var n0 = Math.random() * 10;
    for (var d = step * 0.6; d < L - step * 0.6; d += step) {
      var p = along(pts, d);
      var q = along(pts, d + siz);
      var sw = (Noise.noise(d * 0.04, n0) - 0.5) * siz * 0.9;
      var h = siz * 1.25;
      var quad = [p, q, [q[0] + sw, q[1] + h], [p[0] + sw * 0.8, p[1] + h * 0.95]];
      var c = FLAGS[ci % 5];
      ci++;
      if (c[0] == 255) {
        canv += poly(quad, { fil: "white", str: ink(0.3), wid: 0.3 });
      } else {
        canv += poly(quad, { fil: rgba(c[0], c[1], c[2], 0.5), str: "none" });
      }
    }
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* Newari brick house                                                   */
  /* ------------------------------------------------------------------ */
  K.house = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 34;
    var sto = args.sto != undefined ? args.sto : 3;
    var sh = args.sh != undefined ? args.sh : 12;
    var roo = args.roo != undefined ? args.roo : Math.random() < 0.72 ? 0 : 1;
    var tin = args.tin != undefined ? args.tin : 0.12 + Math.random() * 0.1;
    var wal = args.wal != undefined ? args.wal : 1; // 1 brick, 0 whitewashed
    var canv = "";
    var H = sto * sh;
    var body = rect(-wid / 2, 0, wid / 2, -H);
    canv += fill(body, xoff, yoff, "white");
    if (wal) canv += fill(body, xoff, yoff, brick(tin));
    canv += line([[-wid / 2, 0.5], [-wid / 2, -H]], xoff, yoff, { wid: 0.6, col: ink(0.42) });
    canv += line([[wid / 2, 0.5], [wid / 2, -H]], xoff, yoff, { wid: 0.6, col: ink(0.42) });

    for (var s = 0; s < sto; s++) {
      var y0 = -s * sh;
      if (s > 0) {
        canv += line([[-wid / 2, y0], [wid / 2, y0]], xoff, yoff, { wid: 0.3, col: ink(0.3), seg: 5 });
      }
      if (s == 0) {
        // shop fronts and doors
        var nd = Math.max(1, Math.round(wid / 12));
        var dw = wid / (nd * 1.9);
        for (var i = 0; i < nd; i++) {
          var dx = lerp(-wid / 2, wid / 2, (i + 0.5) / nd);
          var dh = sh * normRand(0.6, 0.78);
          canv += fill(rect(dx - dw / 2, 0, dx + dw / 2, -dh), xoff, yoff, ink(0.3));
          canv += line([[dx - dw / 2 - 0.6, -dh - 0.6], [dx + dw / 2 + 0.6, -dh - 0.6]], xoff, yoff, {
            wid: 0.35,
            col: ink(0.45),
            seg: 2,
          });
        }
      } else if (s == sto - 2 || (sto == 2 && s == 1)) {
        // the wide latticed window (san jhyal)
        var ww = wid * normRand(0.45, 0.65);
        var wh = sh * 0.55;
        var wy = y0 - sh * 0.24;
        var wr = rect(-ww / 2, wy, ww / 2, wy - wh);
        canv += fill(wr, xoff, yoff, ink(0.14));
        canv += line(wr.concat([wr[0]]), xoff, yoff, { wid: 0.35, col: ink(0.5), seg: 2 });
        var nl = Math.max(2, Math.floor(ww / 3));
        for (var i = 1; i < nl; i++) {
          var lx = lerp(-ww / 2, ww / 2, i / nl);
          canv += line([[lx, wy], [lx, wy - wh]], xoff, yoff, { wid: 0.2, col: ink(0.35), seg: 2 });
        }
        canv += line([[-ww / 2 - 1, wy + 0.8], [ww / 2 + 1, wy + 0.8]], xoff, yoff, { wid: 0.35, col: ink(0.45), seg: 2 });
      } else {
        // small windows
        var nw = Math.max(1, Math.round(wid / 10));
        for (var i = 0; i < nw; i++) {
          var wx = lerp(-wid / 2, wid / 2, (i + 0.5) / nw);
          var wr = rect(wx - 1.6, y0 - sh * 0.3, wx + 1.6, y0 - sh * 0.75);
          canv += fill(wr, xoff, yoff, ink(0.28));
          canv += line([[wx - 2.2, y0 - sh * 0.28], [wx + 2.2, y0 - sh * 0.28]], xoff, yoff, {
            wid: 0.25,
            col: ink(0.4),
            seg: 2,
          });
        }
      }
    }

    // roof
    var ov = 2.5 + wid * 0.07;
    var ew = wid + ov * 2;
    var ye = -H + 1.5;
    if (roo == 0) {
      var rh = 5 + wid * 0.13;
      var pts = [[-ew / 2, ye], [-wid / 2 + 1.5, ye - rh], [wid / 2 - 1.5, ye - rh], [ew / 2, ye]];
      canv += fill(pts, xoff, yoff, "white");
      canv += fill(pts, xoff, yoff, ink(0.17));
      var nt = Math.floor(ew / 2.8);
      for (var i = 1; i < nt; i++) {
        var t = i / nt;
        canv += line([[lerp(-wid / 2 + 1.5, wid / 2 - 1.5, t), ye - rh + 0.5], [lerp(-ew / 2, ew / 2, t), ye]], xoff, yoff, {
          wid: 0.25,
          col: ink(0.22),
          seg: 2,
        });
      }
      canv += line([[-wid / 2 + 1.5, ye - rh], [wid / 2 - 1.5, ye - rh]], xoff, yoff, { wid: 0.7, col: ink(0.5) });
      canv += line([[-ew / 2, ye], [-wid / 2 + 1.5, ye - rh]], xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 2 });
      canv += line([[ew / 2, ye], [wid / 2 - 1.5, ye - rh]], xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 2 });
    } else {
      // gable end facing the lane
      var rh = wid * 0.4;
      var tri = [[-ew / 2, ye], [0, ye - rh], [ew / 2, ye]];
      canv += fill(tri, xoff, yoff, "white");
      var gab = [[-wid / 2, ye], [0, ye - rh + 2.5], [wid / 2, ye]];
      if (wal) canv += fill(gab, xoff, yoff, brick(tin * 0.9));
      canv += fill(rect(-1.5, ye - rh * 0.3, 1.5, ye - rh * 0.55), xoff, yoff, ink(0.3));
      canv += line([[-ew / 2, ye], [0, ye - rh]], xoff, yoff, { wid: 0.9, col: ink(0.55) });
      canv += line([[0, ye - rh], [ew / 2, ye]], xoff, yoff, { wid: 0.9, col: ink(0.55) });
    }
    canv += line([[-ew / 2, ye], [ew / 2, ye]], xoff, yoff, { wid: 0.8, col: ink(0.55) });
    canv += line([[-wid / 2, ye + 4], [-ew / 2 + 1, ye + 0.5]], xoff, yoff, { wid: 0.4, col: ink(0.4), seg: 2 });
    canv += line([[wid / 2, ye + 4], [ew / 2 - 1, ye + 0.5]], xoff, yoff, { wid: 0.4, col: ink(0.4), seg: 2 });
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* ground under a settlement: a low bank with brushed edges             */
  /* ------------------------------------------------------------------ */
  K.ground = function(xoff, yoff, wid, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var dep = args.dep != undefined ? args.dep : (10 + Math.random() * 8) * sca;
    var canv = "";
    var n = 24;
    var n0 = Math.random() * 10;
    var top = [];
    var bot = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var e = Math.pow(Math.sin(t * Math.PI), 0.4);
      top.push([(t - 0.5) * wid, (Noise.noise(t * 4, n0) - 0.5) * 3 * sca + (1 - e) * dep * 0.5]);
      bot.push([(t - 0.5) * wid * 0.97, dep * (0.55 + 0.45 * e) + (Noise.noise(t * 6, n0 + 3) - 0.5) * 4 * sca]);
    }
    var pts = top.concat(bot.slice().reverse());
    canv += fill(pts, xoff, yoff, "white");
    canv += stroke(shift(bot, xoff, yoff), {
      wid: 1.6,
      col: ink(0.22),
      noi: 0.9,
      out: 0,
    });
    // brushed bank
    for (var i = 0; i < 6 + wid / 40; i++) {
      var t0 = Math.random();
      var t1 = Math.min(1, t0 + normRand(0.05, 0.25));
      var yy = normRand(0.35, 0.9);
      var bl = [];
      for (var j = 0; j <= 8; j++) {
        var t = lerp(t0, t1, j / 8);
        var e = Math.pow(Math.sin(t * Math.PI), 0.4);
        bl.push([(t - 0.5) * wid * 0.95, dep * (0.55 + 0.45 * e) * yy]);
      }
      canv += stroke(shift(bl, xoff, yoff), {
        wid: normRand(0.6, 1.4),
        col: ink(0.08 + Math.random() * 0.12),
        noi: 0.9,
        out: 0,
      });
    }
    // moss dots on the rim
    for (var i = 0; i < wid / 25; i++) {
      var t = Math.random();
      var p = top[Math.floor(t * n)];
      canv += Tree.tree02(xoff + p[0], yoff + p[1] + 2, {
        col: ink(0.4 + Math.random() * 0.2),
        clu: 2,
        hei: 6,
        wid: 3,
      });
    }
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* rim hill: forested crest, rice terraces, hamlets, optional shrine    */
  /* ------------------------------------------------------------------ */
  K.hill = function(xoff, yoff, seed, args) {
    args = args || {};
    var hei = args.hei != undefined ? args.hei : 150;
    var wid = args.wid != undefined ? args.wid : 420;
    var tex = args.tex != undefined ? args.tex : 110;
    var forest = args.forest != undefined ? args.forest : 0.7;
    var terr = args.terr != undefined ? args.terr : 0.5;
    var hamlet = args.hamlet != undefined ? args.hamlet : 0.4;
    var top = args.top != undefined ? args.top : "";
    var str = args.str != undefined ? args.str : 1;
    seed = seed || 0;

    var canv = "";
    var reso = [10, 50];
    var ptlist = [];
    var hoff = 0;
    for (var j = 0; j < reso[0]; j++) {
      hoff += (Math.random() * yoff) / 140;
      ptlist.push([]);
      for (var i = 0; i < reso[1]; i++) {
        var x = (i / (reso[1] - 1) - 0.5) * Math.PI;
        var y = Math.pow(Math.cos(x), 0.9);
        y *= 0.45 + 0.6 * Noise.noise(x * 0.9 + 10, j * 0.15, seed);
        var p = 1 - j / reso[0];
        ptlist[j].push([(x / Math.PI) * wid * p, -y * hei * p + hoff]);
      }
    }
    var out = ptlist[0];
    var pk = 0;
    for (var i = 0; i < out.length; i++) if (out[i][1] < out[pk][1]) pk = i;
    var h = -out[pk][1];

    function vegetate(treeFunc, growthRule) {
      for (var i = 0; i < ptlist.length; i++) {
        for (var j = 0; j < ptlist[i].length; j++) {
          if (growthRule(i, j)) canv += treeFunc(ptlist[i][j][0], ptlist[i][j][1], i, j);
        }
      }
    }
    var tcol = function(x, y, a) {
      return ink((Noise.noise(0.01 * x, 0.01 * y) * 0.15 + a) * str);
    };

    // forest fringe along the crest, half hidden behind the hill
    vegetate(
      function(x, y) {
        return Tree.tree02(x + xoff, y + yoff - 4, { col: tcol(x, y, 0.42), clu: 2 });
      },
      function(i, j) {
        var ns = Noise.noise(j * 0.12, seed);
        return i == 0 && ns * ns < 0.25 * forest + 0.05 && -ptlist[i][j][1] / h > 0.25;
      },
    );

    canv += fill(out.concat([[0, reso[0] * 4]]), xoff, yoff, "white");
    canv += stroke(shift(out, xoff, yoff), { col: ink(0.3 * str), noi: 1, wid: 2.6 });
    canv += Mount.foot(ptlist, { xof: xoff, yof: yoff });
    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      sha: randChoice([0, 0, 0, 3]),
      col: function() {
        return ink(Math.random() * 0.22 * str);
      },
    });

    // rice terraces: contour lines on the lower slopes
    function outlineX(yy, side) {
      if (side < 0) {
        for (var i = 0; i < pk; i++) {
          if (out[i][1] >= yy && out[i + 1][1] <= yy) {
            var t = (yy - out[i][1]) / (out[i + 1][1] - out[i][1] || 1);
            return lerp(out[i][0], out[i + 1][0], t);
          }
        }
      } else {
        for (var i = out.length - 1; i > pk; i--) {
          if (out[i][1] >= yy && out[i - 1][1] <= yy) {
            var t = (yy - out[i][1]) / (out[i - 1][1] - out[i][1] || 1);
            return lerp(out[i][0], out[i - 1][0], t);
          }
        }
      }
      return null;
    }
    // height of the outline above local x (0 = ground)
    function outlineY(xx) {
      for (var i = 1; i < out.length; i++) {
        if (out[i][0] >= xx) {
          var t = (xx - out[i - 1][0]) / (out[i][0] - out[i - 1][0] || 1);
          return lerp(out[i - 1][1], out[i][1], t);
        }
      }
      return 0;
    }
    var terraceLines = [];
    if (terr > 0) {
      var tc = normRand(-0.3, 0.3) * wid;
      var tw = wid * normRand(0.25, 0.45) * (0.5 + terr);
      var tn = Math.floor(4 + terr * 10);
      var n0 = Math.random() * 10;
      for (var k = 0; k < tn; k++) {
        var yy = -h * (0.05 + k * 0.045);
        if (-yy > h * (0.25 + terr * 0.35)) break;
        var xl = outlineX(yy, -1);
        var xr = outlineX(yy, 1);
        if (xl == null || xr == null) continue;
        var sag = (xr - xl) * 0.05;
        var pts = [];
        var seg = [];
        for (var i = 0; i <= 40; i++) {
          var t = i / 40;
          var px = lerp(xl + 3, xr - 3, t);
          var py = yy + Math.sin(t * Math.PI) * sag;
          var on =
            Math.abs(px - tc) < tw * (1 - k / (tn + 2)) && Noise.noise(px * 0.02, k * 0.6, n0) > 0.36;
          if (on) {
            seg.push([px, py]);
          } else if (seg.length) {
            pts.push(seg);
            seg = [];
          }
        }
        if (seg.length) pts.push(seg);
        for (var s = 0; s < pts.length; s++) {
          if (pts[s].length < 3) continue;
          terraceLines.push(pts[s]);
          canv += stroke(shift(pts[s], xoff, yoff), {
            wid: 0.9,
            col: ink((0.3 + Math.random() * 0.14) * str),
            noi: 0.5,
            out: 0,
          });
          canv += stroke(shift(pts[s], xoff, yoff + 1.8), {
            wid: 0.7,
            col: ink(0.12 * str),
            noi: 0.6,
            out: 0,
          });
        }
      }
    }

    // forest canopy on the upper slopes
    vegetate(
      function(x, y) {
        return Tree.tree02(x + xoff, y + yoff, { col: tcol(x, y, 0.4) });
      },
      function(i, j) {
        var ns = Noise.noise(i * 0.1, j * 0.1, seed + 2);
        var r = -ptlist[i][j][1] / h;
        return ns * ns * ns < 0.09 * forest + 0.01 && r > 0.4;
      },
    );
    // pines in clusters
    var pines = [];
    vegetate(
      function(x, y) {
        var ht = ((h + y) / h) * 60;
        ht = ht * 0.3 + Math.random() * ht * 0.7;
        return Tree.tree01(x + xoff, y + yoff, {
          hei: ht,
          wid: Math.random() * 3 + 1,
          col: tcol(x, y, 0.3),
        });
      },
      function(i, j) {
        var ns = Noise.noise(i * 0.2, j * 0.05, seed);
        var r = -ptlist[i][j][1] / h;
        return j % 2 && ns * ns * ns * ns < 0.012 * forest && r < 0.6 && r > 0.15;
      },
    );

    // hamlets on the terraces
    if (terraceLines.length && Math.random() < hamlet) {
      var nh = 1 + Math.floor(Math.random() * 3);
      for (var i = 0; i < nh; i++) {
        var tl = randChoice(terraceLines);
        var p = tl[Math.floor(Math.random() * tl.length)];
        canv += K.house(xoff + p[0], yoff + p[1] + 1, seed, {
          wid: normRand(14, 20),
          sto: randChoice([1, 2, 2]),
          sh: normRand(7, 8.5),
        });
      }
    }

    // shrine on the summit
    var sx = out[pk][0];
    var sy = out[pk][1] + 3;
    if (top == "stupa") {
      var sw = Math.min(72, Math.max(42, wid * 0.15));
      // stairway climbing the front of the hill
      var st0 = [sx, sy + 2];
      var st1 = [sx + normRand(-0.15, 0.15) * wid * 0.2, -2];
      var band = [[st0[0] - 2, st0[1]], [st0[0] + 2, st0[1]], [st1[0] + 5, st1[1]], [st1[0] - 5, st1[1]]];
      canv += fill(band, xoff, yoff, "white");
      var steps = Math.floor((st1[1] - st0[1]) / 2.4);
      for (var s = 1; s < steps; s++) {
        var t = s / steps;
        var cx = lerp(st0[0], st1[0], t);
        var hw = lerp(2, 5, t);
        canv += line([[cx - hw, lerp(st0[1], st1[1], t)], [cx + hw, lerp(st0[1], st1[1], t)]], xoff, yoff, {
          wid: 0.3,
          col: ink(0.4),
          seg: 2,
        });
      }
      canv += line([[st0[0] - 2, st0[1]], [st1[0] - 5, st1[1]]], xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 8 });
      canv += line([[st0[0] + 2, st0[1]], [st1[0] + 5, st1[1]]], xoff, yoff, { wid: 0.5, col: ink(0.45), seg: 8 });
      // small shrines beside the stupa
      if (Math.random() < 0.8) {
        var kx = sx - sw * 1.15;
        canv += K.shikhara(xoff + kx, yoff + outlineY(kx) + 5, seed, { wid: sw * 0.26 });
      }
      if (Math.random() < 0.8) {
        var kx = sx + sw * 1.15;
        canv += K.pagoda(xoff + kx, yoff + outlineY(kx) + 5, seed, {
          wid: sw * 0.36,
          tie: 2,
          plt: 1,
          gil: 2,
          ban: false,
        });
      }
      canv += K.stupa(xoff + sx, yoff + sy, seed, {
        wid: sw,
        ter: 1,
        sty: 0,
        fla: 3,
        ground: function(dx) {
          return outlineY(sx + dx) - sy + 6 + Math.random() * 6;
        },
      });
    } else if (top == "temple") {
      canv += K.pagoda(xoff + sx, yoff + sy + 2, seed, {
        wid: normRand(22, 30),
        tie: randChoice([2, 3]),
        plt: 1,
      });
    } else if (top == "village") {
      // a ridge-top Newari town (like Kirtipur)
      var vw = Math.min(wid * 0.5, 220);
      var xs = sx - vw / 2;
      var temp = Math.floor(Math.random() * 3);
      var k = 0;
      while (xs < sx + vw / 2) {
        var hw = normRand(16, 26);
        var yy = outlineY(xs + hw / 2) + 7;
        if (k == temp) {
          canv += K.pagoda(xoff + xs + 14, yoff + outlineY(xs + 14) + 5, seed, {
            wid: 24,
            tie: randChoice([2, 3]),
            plt: 1,
          });
          xs += 30;
        } else {
          canv += K.house(xoff + xs + hw / 2, yoff + yy, seed, {
            wid: hw,
            sto: randChoice([2, 3, 3]),
            sh: normRand(8, 10),
          });
          xs += hw + normRand(-1, 2);
        }
        k++;
      }
    }

    // rocks at the foot
    vegetate(
      function(x, y) {
        return Mount.rock(x + xoff, y + yoff, seed, {
          wid: 18 + Math.random() * 18,
          hei: 16 + Math.random() * 16,
          sha: 2,
        });
      },
      function(i, j) {
        return (j == 0 || j == ptlist[i].length - 1) && Math.random() < 0.035;
      },
    );
    return canv;
  };

  /* ------------------------------------------------------------------ */
  /* settlements                                                          */
  /* ------------------------------------------------------------------ */
  // a row of attached Newari houses from x0 to x1; returns roof tops too
  function houseRow(xoff, yoff, x0, x1, seed, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var maxSto = args.maxSto != undefined ? args.maxSto : 4;
    var skip = args.skip || [];
    var canv = "";
    var tops = [];
    var x = x0;
    while (x < x1) {
      var hw = normRand(24, 44) * sca;
      var cx = x + hw / 2;
      var blocked = false;
      for (var i = 0; i < skip.length; i++) {
        if (cx + hw / 2 > skip[i][0] && cx - hw / 2 < skip[i][1]) blocked = skip[i];
      }
      if (blocked) {
        x = blocked[1] + 1;
        continue;
      }
      if (Math.random() < 0.12) {
        // a tree between the houses
        canv += Tree.tree03(xoff + cx, yoff, {
          hei: normRand(42, 62) * sca,
          wid: 4 * sca,
          col: ink(normRand(0.35, 0.5)),
        });
        x += hw * 0.6;
        continue;
      }
      var sto = 2 + Math.floor(Math.random() * (maxSto - 1));
      var sh = normRand(11, 13) * sca;
      canv += K.house(xoff + cx, yoff, seed, { wid: hw, sto: sto, sh: sh });
      tops.push([xoff + cx, yoff - sto * sh - 8 * sca]);
      x += hw + (Math.random() < 0.25 ? normRand(2, 6) * sca : -normRand(0, 2));
    }
    return { canv: canv, tops: tops };
  }

  K.town = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 320;
    var sca = args.sca != undefined ? args.sca : 1;
    var tem = args.tem != undefined ? args.tem : 1 + Math.floor(Math.random() * 2);
    var fla = args.fla != undefined ? args.fla : Math.random() < 0.4;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, wid * 1.12, { sca: sca });

    // temples rise behind the front row
    var temples = [];
    for (var i = 0; i < tem; i++) {
      temples.push(lerp(-wid * 0.32, wid * 0.32, tem == 1 ? 0.5 + normRand(-0.3, 0.3) : i / (tem - 1)));
    }
    var back = houseRow(xoff, yoff - 16 * sca, -wid * 0.45, wid * 0.45, seed, { sca: sca * 0.9 });
    canv += back.canv;
    var gaps = [];
    for (var i = 0; i < temples.length; i++) {
      var tw = normRand(30, 42) * sca;
      canv += K.pagoda(xoff + temples[i], yoff - 6 * sca, seed, {
        wid: tw,
        tie: randChoice([2, 3, 3]),
        plt: randChoice([1, 2, 2]),
        gil: randChoice([0, 0, 1]),
      });
      if (Math.random() < 0.6) gaps.push([temples[i] - tw * 0.9, temples[i] + tw * 0.9]);
    }
    var front = houseRow(xoff, yoff, -wid / 2, wid / 2, seed, { sca: sca, maxSto: 3, skip: gaps });
    canv += front.canv;

    if (fla && front.tops.length > 2) {
      var a = Math.floor(Math.random() * (front.tops.length - 2));
      var p0 = front.tops[a];
      var p1 = front.tops[a + 2];
      canv += K.flags(p0[0], p0[1], p1[0], p1[1], { siz: 3.5 * sca, sag: 0.12 });
    }
    // a few people in the lanes
    for (var i = 0; i < 2; i++) {
      if (Math.random() < 0.5) {
        canv += K.figure(xoff + normRand(-wid / 2, wid / 2), yoff + 6 * sca, seed, { siz: 10.5 * sca });
      }
    }
    return canv;
  };

  // a distant quarter of the city, seen across the valley floor
  K.quarter = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 260;
    var sca = args.sca != undefined ? args.sca : 0.6;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, wid * 1.1, { sca: sca });
    canv += houseRow(xoff, yoff - 13 * sca, -wid * 0.42, wid * 0.42, seed, { sca: sca * 0.92 }).canv;
    var r = Math.random();
    if (r < 0.5) {
      canv += K.pagoda(xoff + normRand(-0.3, 0.3) * wid, yoff - 5 * sca, seed, {
        wid: normRand(30, 40) * sca,
        tie: randChoice([2, 3, 3, 4]),
        plt: randChoice([1, 2]),
        gil: randChoice([0, 0, 1]),
      });
    } else if (r < 0.65) {
      canv += K.stupa(xoff + normRand(-0.3, 0.3) * wid, yoff - 5 * sca, seed, {
        wid: normRand(46, 64) * sca,
        ter: 1,
        sty: 0,
        fla: 2,
      });
    } else if (r < 0.75) {
      canv += K.shikhara(xoff + normRand(-0.3, 0.3) * wid, yoff - 5 * sca, seed, { wid: 30 * sca });
    }
    canv += houseRow(xoff, yoff, -wid / 2, wid / 2, seed, { sca: sca, maxSto: 4 }).canv;
    return canv;
  };

  // the level valley floor: a few short, dry horizontal strokes
  K.plain = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 500;
    var n = args.n != undefined ? args.n : 4 + Math.floor(Math.random() * 6);
    var canv = "";
    var n0 = Math.random() * 10;
    for (var i = 0; i < n; i++) {
      var cx = normRand(-wid / 2, wid / 2);
      var cy = normRand(-14, 14);
      var l = normRand(30, 150);
      var pts = [];
      for (var j = 0; j <= 10; j++) {
        var t = j / 10;
        pts.push([cx + (t - 0.5) * l, cy + (Noise.noise(t * 2, i, n0) - 0.5) * 2.5]);
      }
      canv += stroke(shift(pts, xoff, yoff), {
        wid: normRand(0.7, 1.5),
        col: ink(normRand(0.1, 0.24)),
        noi: 0.8,
        out: 0,
      });
      if (Math.random() < 0.35) {
        var p = pts[Math.floor(Math.random() * pts.length)];
        canv += Tree.tree02(xoff + p[0], yoff + p[1] - 1, { clu: 2, hei: 7, wid: 3.5, col: ink(0.45) });
      }
    }
    return canv;
  };

  // a grove of trees on the valley floor
  K.grove = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 160;
    var sca = args.sca != undefined ? args.sca : 0.7;
    var canv = "";
    var n = 4 + Math.floor(Math.random() * 6);
    var xs = [];
    for (var i = 0; i < n; i++) xs.push(normRand(-wid / 2, wid / 2));
    xs.sort(function(a, b) {
      return a - b;
    });
    for (var i = 0; i < n; i++) {
      var ty = yoff + normRand(-6, 6) * sca;
      if (Math.random() < 0.5) {
        canv += Tree.tree03(xoff + xs[i], ty, {
          hei: normRand(50, 100) * sca,
          col: ink(normRand(0.3, 0.5)),
          ben: function(x) {
            return 0;
          },
        });
      } else {
        canv += Tree.tree01(xoff + xs[i], ty, {
          hei: normRand(50, 90) * sca,
          wid: normRand(1.5, 3),
          col: ink(normRand(0.35, 0.55)),
        });
      }
    }
    return canv;
  };

  // a royal square: palace wing, tall temples on plinths, a pillar
  K.durbar = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 400;
    var sca = args.sca != undefined ? args.sca : 1;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, wid * 1.1, { sca: sca });
    // palace wing at the back
    var pal = houseRow(xoff, yoff - 24 * sca, -wid * 0.48, wid * 0.48, seed, { sca: sca * 0.95, maxSto: 4 });
    canv += pal.canv;
    // temples, the tallest in the middle
    var n = randChoice([2, 3, 3]);
    var slots = [];
    for (var i = 0; i < n; i++) slots.push(lerp(-wid * 0.33, wid * 0.33, n == 1 ? 0.5 : i / (n - 1)));
    var big = Math.floor(Math.random() * n);
    for (var i = 0; i < n; i++) {
      var tall = i == big;
      canv += K.pagoda(xoff + slots[i] + normRand(-10, 10) * sca, yoff - 4 * sca, seed, {
        wid: (tall ? normRand(40, 48) : normRand(28, 36)) * sca,
        tie: tall ? randChoice([3, 4, 5]) : randChoice([2, 2, 3]),
        plt: tall ? randChoice([3, 4, 5]) : randChoice([1, 2, 3]),
        gil: randChoice([0, 0, 1]),
      });
    }
    if (Math.random() < 0.6) {
      canv += K.shikhara(xoff + lerp(slots[0], slots[1], 0.5), yoff, seed, { wid: 26 * sca });
    }
    // king's pillar
    if (Math.random() < 0.7) {
      canv += K.pillar(xoff + lerp(slots[n - 2] || 0, slots[n - 1], 0.5), yoff + 2 * sca, seed, { sca: sca });
    }
    // people crossing the square
    for (var i = 0; i < 3; i++) {
      if (Math.random() < 0.6) {
        canv += K.figure(xoff + normRand(-wid / 2, wid / 2), yoff + 8 * sca, seed, { siz: 10.5 * sca });
      }
    }
    return canv;
  };

  // stone pillar topped by a gilded kneeling figure under a hood
  K.pillar = function(xoff, yoff, seed, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var h = 88 * sca;
    var w = 4.2 * sca;
    var canv = "";
    var pf = platform(xoff, yoff, [[16 * sca, 4 * sca], [11 * sca, 4 * sca]], { tint: ink(0.08) });
    canv += pf.canv;
    var y = pf.top;
    var col = [[-w / 2, y], [w / 2, y], [w * 0.38, y - h], [-w * 0.38, y - h]];
    canv += fill(col, xoff, yoff, "white");
    canv += fill(col, xoff, yoff, ink(0.1));
    canv += line([[-w / 2, y], [-w * 0.38, y - h]], xoff, yoff, { wid: 0.5, col: ink(0.5) });
    canv += line([[w / 2, y], [w * 0.38, y - h]], xoff, yoff, { wid: 0.5, col: ink(0.5) });
    // lotus capital
    var cap = ellipse(0, y - h - 2 * sca, 5 * sca, 2.6 * sca, 12);
    canv += fill(cap, xoff, yoff, ink(0.2));
    // figure
    var fy = y - h - 4 * sca;
    var fig = blob(xoff, yoff + fy - 4 * sca, {
      len: 9 * sca,
      wid: 6 * sca,
      ang: Math.PI / 2,
      col: gold(0.75),
      noi: 0.2,
      ret: 1,
    });
    canv += poly(fig, { fil: gold(0.75), str: ink(0.4), wid: 0.3 });
    canv += poly(ellipse(0, fy - 9 * sca, 1.8 * sca, 2 * sca, 10), { xof: xoff, yof: yoff, fil: gold(0.8), str: ink(0.4), wid: 0.3 });
    // cobra hood / parasol behind
    var hood = [];
    for (var i = 0; i <= 10; i++) {
      var a = lerp(Math.PI * 1.05, Math.PI * 1.95, i / 10);
      hood.push([Math.cos(a) * 5.5 * sca, fy - 8 * sca + Math.sin(a) * 6 * sca]);
    }
    canv += line(hood, xoff, yoff, { wid: 0.6, col: ink(0.5), seg: 1 });
    canv += line([[0, fy - 14 * sca], [0, fy - 20 * sca]], xoff, yoff, { wid: 0.4, col: ink(0.5), seg: 2 });
    return canv;
  };

  // Boudhanath: the great stupa ringed by houses
  K.boudha = function(xoff, yoff, seed, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var W = (args.wid != undefined ? args.wid : 120) * sca;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, W * 4.2, { sca: sca });
    var ring = houseRow(xoff, yoff - 30 * sca, -W * 2, W * 2, seed, { sca: sca * 0.88, maxSto: 4 });
    canv += ring.canv;
    canv += K.stupa(xoff, yoff - 6 * sca, seed, { wid: W, ter: 3, sty: 1, fla: 5 });
    canv += houseRow(xoff, yoff, -W * 2.1, -W * 1.15, seed, { sca: sca, maxSto: 3 }).canv;
    canv += houseRow(xoff, yoff, W * 1.15, W * 2.1, seed, { sca: sca, maxSto: 3 }).canv;
    for (var i = 0; i < 4; i++) {
      canv += K.figure(xoff + normRand(-W * 0.9, W * 0.9), yoff + 6 * sca, seed, { siz: 10.5 * sca });
    }
    return canv;
  };

  // pipal / banyan tree: a stout trunk under a broad crown of ink dots
  K.pipal = function(xoff, yoff, seed, args) {
    args = args || {};
    var hei = args.hei != undefined ? args.hei : 160;
    var wid = args.wid != undefined ? args.wid : hei * 1.15;
    var canv = "";
    var th = hei * 0.36; // height of the fork
    var tw = hei * 0.055; // half width of the trunk
    var cy = -th - hei * 0.3; // centre of the crown
    var rx = wid / 2;
    var ry = hei * 0.34;
    function leaves(n, a0, a1) {
      var c = "";
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var r = Math.pow(Math.random(), 0.45);
        var px = Math.cos(a) * r * rx;
        var py = cy + Math.sin(a) * r * ry * (Math.sin(a) > 0 ? 0.55 : 1);
        var dark = 1 - (py - cy + ry) / (ry * 2);
        c += Tree.tree02(xoff + px, yoff + py, {
          clu: 3 + Math.floor(Math.random() * 3),
          hei: 10 + Math.random() * 6,
          wid: 5 + Math.random() * 3,
          col: ink(lerp(a0, a1, Math.random()) - dark * 0.08),
        });
      }
      return c;
    }
    // back of the crown
    canv += leaves(Math.floor(wid * 0.4), 0.28, 0.45);

    // branches: outlined, tapering limbs from the fork into the crown
    var nb = 4 + Math.floor(Math.random() * 3);
    for (var i = 0; i < nb; i++) {
      var ang = lerp(-Math.PI * 0.85, -Math.PI * 0.15, (i + Math.random() * 0.6) / nb);
      var bl = normRand(0.45, 0.8) * Math.min(rx, ry * 1.6);
      var p0 = [normRand(-tw * 0.5, tw * 0.5), -th];
      var mid = [p0[0] + Math.cos(ang) * bl * 0.5, p0[1] + Math.sin(ang) * bl * 0.5 - bl * 0.1];
      var p1 = [p0[0] + Math.cos(ang) * bl, p0[1] + Math.sin(ang) * bl];
      var cl = bezmh([p0, mid, p1], 1);
      var L = [];
      var R = [];
      for (var j = 0; j < cl.length; j++) {
        var t = j / (cl.length - 1);
        var w = lerp(tw * 0.62, 0.8, Math.pow(t, 0.7));
        var q = cl[Math.min(cl.length - 1, j + 1)];
        var o = cl[Math.max(0, j - 1)];
        var an = Math.atan2(q[1] - o[1], q[0] - o[0]) + Math.PI / 2;
        L.push([cl[j][0] + Math.cos(an) * w, cl[j][1] + Math.sin(an) * w]);
        R.push([cl[j][0] - Math.cos(an) * w, cl[j][1] - Math.sin(an) * w]);
      }
      canv += fill(L.concat(R.slice().reverse()), xoff, yoff, "white");
      canv += stroke(shift(L, xoff, yoff), { wid: 0.9, col: ink(0.55), noi: 0.8, out: 0 });
      canv += stroke(shift(R, xoff, yoff), { wid: 0.9, col: ink(0.5), noi: 0.8, out: 0 });
    }

    // trunk with flared roots
    var Lt = [];
    var Rt = [];
    for (var j = 0; j <= 12; j++) {
      var t = j / 12;
      var flare = Math.pow(1 - t, 4) * tw * 1.4;
      var wob = (Noise.noise(t * 3, xoff * 0.01) - 0.5) * tw * 0.5;
      Lt.push([-tw - flare + wob, -t * th]);
      Rt.push([tw + flare + wob, -t * th]);
    }
    canv += fill(Lt.concat(Rt.slice().reverse()), xoff, yoff, "white");
    canv += stroke(shift(Lt, xoff, yoff), { wid: 1.4, col: ink(0.55), noi: 0.9, out: 0 });
    canv += stroke(shift(Rt, xoff, yoff), { wid: 1.4, col: ink(0.5), noi: 0.9, out: 0 });
    // bark
    for (var i = 0; i < 10; i++) {
      var t0 = Math.random() * 0.8;
      var bx = normRand(-0.7, 0.7) * tw;
      var bk = [];
      for (var j = 0; j <= 5; j++) {
        bk.push([bx + (Noise.noise(j * 0.4, i, xoff * 0.01) - 0.5) * tw * 0.4, -(t0 + j * 0.03) * th]);
      }
      canv += stroke(shift(bk, xoff, yoff), { wid: 0.6, col: ink(0.25), noi: 0.8, out: 0 });
    }

    // front of the crown, sparse so the limbs show through
    canv += leaves(Math.floor(wid * 0.22), 0.4, 0.6);
    return canv;
  };

  // chautara: a stone resting platform around a pipal tree
  K.chautara = function(xoff, yoff, seed, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, 210 * sca, { sca: sca });
    var levels = [[118 * sca, 7 * sca], [92 * sca, 7 * sca]];
    var pf = platform(xoff, yoff, levels, { tint: ink(0.06) });
    canv += K.pipal(xoff + normRand(-8, 8) * sca, yoff + pf.top + 3 * sca, seed, {
      hei: normRand(150, 190) * sca,
    });
    canv += pf.canv;
    if (Math.random() < 0.6) {
      canv += K.stupa(xoff + randChoice([-1, 1]) * 72 * sca, yoff + 2 * sca, seed, {
        wid: 12 * sca,
        sty: 2,
        ter: 1,
        fla: 0,
      });
    }
    var nm = randChoice([1, 2, 2, 3]);
    for (var i = 0; i < nm; i++) {
      canv += K.figure(xoff + normRand(-55, 55) * sca, yoff + pf.top + 1, seed, { siz: 10.5 * sca });
    }
    return canv;
  };

  // a courtyard (bahal) of stone chaityas around a small shrine
  K.bahal = function(xoff, yoff, seed, args) {
    args = args || {};
    var sca = args.sca != undefined ? args.sca : 1;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, 260 * sca, { sca: sca });
    canv += houseRow(xoff, yoff - 22 * sca, -120 * sca, 120 * sca, seed, { sca: sca * 0.9, maxSto: 4 }).canv;
    canv += K.pagoda(xoff, yoff - 4 * sca, seed, { wid: 28 * sca, tie: 2, plt: 1, gil: 2 });
    var n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var cx = normRand(-100, 100) * sca;
      if (Math.abs(cx) < 30 * sca) cx += 40 * sca * (cx < 0 ? -1 : 1);
      canv += K.stupa(xoff + cx, yoff + normRand(2, 6) * sca, seed, {
        wid: normRand(10, 18) * sca,
        sty: 2,
        ter: 1,
        fla: 0,
      });
    }
    return canv;
  };

  // a conical haystack (kunyu) built around a pole
  K.haystack = function(xoff, yoff, seed, args) {
    args = args || {};
    var siz = args.siz != undefined ? args.siz : 12;
    var canv = "";
    var dome = [];
    for (var i = 0; i <= 16; i++) {
      var a = Math.PI * (i / 16);
      dome.push([-Math.cos(a) * siz * 0.5, -siz * 0.12 - Math.pow(Math.sin(a), 0.7) * siz * 0.95]);
    }
    canv += line([[0, 0], [0, -siz * 1.45]], xoff, yoff, { wid: 0.5, col: ink(0.5), seg: 3 });
    canv += fill(dome, xoff, yoff, "white");
    canv += fill(dome, xoff, yoff, gold(0.16));
    for (var i = 0; i < 7; i++) {
      var hx = normRand(-0.4, 0.4) * siz;
      canv += line([[hx * 0.4, -siz * 1.0], [hx, -siz * 0.2]], xoff, yoff, { wid: 0.35, col: ink(0.3), seg: 3 });
    }
    canv += line(dome, xoff, yoff, { wid: 0.6, col: ink(0.5), seg: 1 });
    return canv;
  };

  // paddy terraces with haystacks and a farmhouse
  K.fields = function(xoff, yoff, seed, args) {
    args = args || {};
    var wid = args.wid != undefined ? args.wid : 360;
    var sca = args.sca != undefined ? args.sca : 1;
    var canv = "";
    canv += K.ground(xoff, yoff + 2 * sca, wid, { sca: sca, dep: 12 * sca });
    var n0 = Math.random() * 10;
    var nt = 4 + Math.floor(Math.random() * 3);
    var strips = [];
    for (var k = nt - 1; k >= 0; k--) {
      var yy = -k * 6.5 * sca;
      var ww = wid * (0.47 - k * 0.045);
      var pts = [];
      for (var i = 0; i <= 30; i++) {
        var t = i / 30;
        pts.push([lerp(-ww, ww, t), yy + Math.sin(t * Math.PI) * 2.5 * sca + (Noise.noise(t * 3, k, n0) - 0.5) * 3 * sca]);
      }
      var band = pts.concat(shift(pts, 0, 6.5 * sca).reverse());
      canv += fill(band, xoff, yoff, "white");
      canv += stroke(shift(pts, xoff, yoff), { wid: 0.9, col: ink(0.32), noi: 0.7, out: 0 });
      canv += stroke(shift(pts, xoff, yoff + 1.5 * sca), { wid: 0.6, col: ink(0.1), noi: 0.7, out: 0 });
      strips.push(pts);
      // young rice in rows
      for (var i = 0; i < ww / 5; i++) {
        var p = pts[Math.floor(Math.random() * pts.length)];
        var ty = p[1] + normRand(1.5, 5.5) * sca;
        canv += line([[p[0], ty], [p[0] + normRand(-0.8, 0.8), ty - 2.6 * sca]], xoff, yoff, {
          wid: 0.3,
          col: ink(0.32),
          seg: 2,
        });
      }
    }
    var nh = randChoice([1, 2]);
    for (var i = 0; i < nh; i++) {
      canv += K.house(xoff + normRand(-wid * 0.35, wid * 0.35), yoff - (nt * 6.5 + 2) * sca, seed, {
        wid: normRand(20, 28) * sca,
        sto: 2,
        sh: 10 * sca,
      });
    }
    for (var i = 0; i < 2; i++) {
      canv += Tree.tree03(xoff + normRand(-wid * 0.45, wid * 0.45), yoff - normRand(nt * 5, nt * 7) * sca, {
        hei: normRand(40, 80) * sca,
        col: ink(0.35),
      });
    }
    var ns = randChoice([2, 3, 4, 5]);
    for (var i = 0; i < ns; i++) {
      var st = randChoice(strips);
      var p = st[Math.floor(normRand(0.15, 0.85) * st.length)];
      canv += K.haystack(xoff + p[0], yoff + p[1] + 5 * sca, seed, { siz: normRand(10, 14) * sca });
    }
    var nf = randChoice([1, 2, 3]);
    for (var i = 0; i < nf; i++) {
      canv += K.figure(xoff + normRand(-wid * 0.4, wid * 0.4), yoff + 4 * sca, seed, {
        siz: 10.5 * sca,
        doko: Math.random() < 0.5,
      });
    }
    return canv;
  };

  // black kites circling over the valley
  K.birds = function(xoff, yoff, seed, args) {
    args = args || {};
    var n = args.n != undefined ? args.n : 2 + Math.floor(Math.random() * 5);
    var spread = args.spread != undefined ? args.spread : 220;
    var canv = "";
    for (var i = 0; i < n; i++) {
      var x = xoff + normRand(-spread, spread);
      var y = yoff + normRand(-spread * 0.25, spread * 0.25);
      var s = normRand(2.5, 6);
      var tilt = normRand(-0.3, 0.3);
      var wing = [];
      for (var j = 0; j <= 12; j++) {
        var t = j / 12;
        var u = t * 2 - 1;
        var lift = Math.abs(u) < 0.15 ? 0 : -Math.sin(Math.abs(u) * Math.PI) * s * 0.35;
        wing.push([x + u * s * 1.6, y + lift + Math.abs(u) * s * 0.25 + u * tilt * s]);
      }
      canv += stroke(wing, {
        wid: Math.max(0.6, s * 0.18),
        col: ink(0.6),
        noi: 0.4,
        out: 0,
        fun: function(x) {
          return Math.pow(Math.sin(x * Math.PI), 0.6);
        },
      });
    }
    return canv;
  };

  // a tiny figure in the manner of scroll painting, a few strokes tall;
  // some carry a doko basket on a tumpline, some wear a red shawl
  K.figure = function(xoff, yoff, seed, args) {
    args = args || {};
    var s = args.siz != undefined ? args.siz : 10;
    var dir = args.dir != undefined ? args.dir : randChoice([-1, 1]);
    var doko = args.doko != undefined ? args.doko : Math.random() < 0.3;
    var shawl = args.shawl != undefined ? args.shawl : Math.random() < 0.3;
    var canv = "";
    var lean = dir * s * 0.03;
    var body = [
      [-s * 0.11 + lean, -s * 0.8],
      [s * 0.11 + lean, -s * 0.8],
      [s * 0.17, -s * 0.12],
      [-s * 0.15, -s * 0.12],
    ];
    canv += fill(body, xoff, yoff, "white");
    canv += fill(body, xoff, yoff, shawl ? rgba(178, 70, 52, 0.5) : ink(0.12));
    canv += line(body.concat([body[0]]), xoff, yoff, { wid: Math.max(0.25, s * 0.035), col: ink(0.6), seg: 2 });
    // legs, one mid-stride
    canv += line([[-s * 0.06, -s * 0.13], [-s * 0.08 - dir * s * 0.05, 0]], xoff, yoff, { wid: s * 0.035, col: ink(0.6), seg: 2 });
    canv += line([[s * 0.07, -s * 0.13], [s * 0.08 + dir * s * 0.06, 0]], xoff, yoff, { wid: s * 0.035, col: ink(0.6), seg: 2 });
    // head and cap
    var hx = lean * 1.3 + dir * s * 0.02;
    canv += poly(ellipse(hx, -s * 0.9, s * 0.085, s * 0.1, 10), { xof: xoff, yof: yoff, fil: ink(0.55) });
    canv += poly(rect(hx - s * 0.09, -s * 0.97, hx + s * 0.08, -s * 1.04), { xof: xoff, yof: yoff, fil: ink(0.7) });
    if (doko) {
      // conical basket on the back, strap across the forehead
      var bx = -dir * s * 0.16;
      var bk = [
        [bx, -s * 0.78],
        [bx - dir * s * 0.34, -s * 0.84],
        [bx - dir * s * 0.24, -s * 0.36],
        [bx - dir * s * 0.06, -s * 0.36],
      ];
      canv += fill(bk, xoff, yoff, "white");
      canv += fill(bk, xoff, yoff, gold(0.25));
      canv += line(bk.concat([bk[0]]), xoff, yoff, { wid: Math.max(0.25, s * 0.03), col: ink(0.55), seg: 2 });
      canv += line([[bx - dir * s * 0.05, -s * 0.8], [hx, -s * 0.97]], xoff, yoff, { wid: s * 0.02, col: ink(0.5), seg: 2 });
    }
    return canv;
  };
}();
