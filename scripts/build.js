#!/usr/bin/env node
/*
 * build.js - bundle index.html and its scripts into one self-contained file
 *
 *   node scripts/build.js            -> dist/kathmandu-valley.html
 *
 * The single file opens anywhere (email it, host it, drop it in a gist)
 * and still paints in Web Workers where the browser allows them.
 */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");

var out = html.replace(/<script( data-kv)? src="([^"]+)"><\/script>/g, function(m, kv, src) {
  var code = fs.readFileSync(path.join(root, src), "utf8").replace(/<\/script/gi, "<\\/script");
  return "<script" + (kv || "") + ">\n" + code + "\n</script>";
});

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
var file = path.join(root, "dist", "kathmandu-valley.html");
fs.writeFileSync(file, out);
console.log("wrote " + path.relative(root, file) + " (" + Math.round(out.length / 1024) + " KB)");
