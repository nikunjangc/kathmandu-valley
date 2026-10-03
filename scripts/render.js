#!/usr/bin/env node
/*
 * render.js - paint a stretch of the scroll from the command line
 *
 *   node scripts/render.js --seed 42 --width 3000 --out scroll.svg
 *   node scripts/render.js --seed 42 --x 6200 --width 1600 --scale 2 --out view.png
 *
 * SVG needs nothing but Node. PNG uses @resvg/resvg-js (npm install).
 * The same seed and x give exactly what the browser shows.
 */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var zlib = require("zlib");

function parse(argv) {
  var o = { seed: "1", x: 0, width: 3000, scale: 1, out: "" };
  for (var i = 2; i < argv.length; i++) {
    var k = argv[i].replace(/^--/, "");
    if (k == "help" || k == "h") o.help = true;
    else o[k] = argv[++i];
  }
  o.x = +o.x;
  o.width = +o.width;
  o.scale = +o.scale;
  if (!o.out) o.out = "kathmandu-valley-" + o.seed + ".svg";
  return o;
}

// load the engine, motifs and planner into a sandbox (they are plain scripts)
function loadValley() {
  var ctx = { console: console };
  vm.createContext(ctx);
  ["shanshui.js", "kathmandu.js", "valley.js"].forEach(function(f) {
    var file = path.join(__dirname, "..", "src", f);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  return ctx;
}

// minimal PNG encoder for the paper texture
var CRC = (function() {
  var t = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf) {
  var c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  var td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  var raw = Buffer.alloc((w * 4 + 1) * h);
  for (var y = 0; y < h; y++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  var o = parse(process.argv);
  if (o.help) {
    console.log("usage: node scripts/render.js [--seed S] [--x X] [--width W] [--scale N] [--out file.svg|file.png]");
    return;
  }
  var t0 = Date.now();
  var ctx = loadValley();
  ctx.Valley.init(o.seed);
  var p = ctx.Valley.paper(512);
  var paper = "data:image/png;base64," + encodePNG(p.width, p.height, p.data).toString("base64");
  var svg = ctx.Valley.svg(o.x, o.width, { paper: paper, scale: o.scale });

  if (/\.png$/i.test(o.out)) {
    var Resvg;
    try {
      Resvg = require("@resvg/resvg-js").Resvg;
    } catch (e) {
      console.error("PNG output needs @resvg/resvg-js: run `npm install` first, or write an .svg");
      process.exit(1);
    }
    var png = new Resvg(svg, { fitTo: { mode: "width", value: Math.round(o.width * o.scale) } }).render().asPng();
    fs.writeFileSync(o.out, png);
  } else {
    fs.writeFileSync(o.out, svg);
  }
  console.log(
    "painted seed " + o.seed + ", x " + o.x + " to " + (o.x + o.width) + " -> " + o.out + " (" + ((Date.now() - t0) / 1000).toFixed(1) + "s)",
  );
}

main();
