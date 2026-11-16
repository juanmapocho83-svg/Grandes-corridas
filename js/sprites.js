/* Sprites pixel art generados por código + fuente bitmap 3x5 */
(function (GC) {
  'use strict';

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  GC.canvas = canvas;

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  GC.shade = shade;
  GC.mix = function (a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    var r = (x >> 16) + ((y >> 16) - (x >> 16)) * t, g = ((x >> 8) & 255) + (((y >> 8) & 255) - ((x >> 8) & 255)) * t,
      bl = (x & 255) + ((y & 255) - (x & 255)) * t;
    return '#' + ((1 << 24) | ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0)).toString(16).slice(1);
  };

  function painter(w, h) {
    var c = canvas(w, h), x = c.getContext('2d');
    var R = function (a, b, cw, ch, col) { x.fillStyle = col; x.fillRect(a, b, cw, ch); };
    R.c = c; R.x = x;
    return R;
  }

  function formula(c1, c2) {
    var R = painter(46, 22), d = shade(c1, -0.3), l = shade(c1, 0.25);
    R(4, 5, 6, 5, '#1b1b1b'); R(36, 5, 6, 5, '#1b1b1b');            // ruedas delanteras
    R(10, 12, 26, 1, '#3a3a3a');                                     // suspensión
    R(11, 10, 6, 8, d); R(29, 10, 6, 8, d);                          // pontones
    R(17, 7, 12, 12, c1); R(18, 7, 2, 12, l);                        // carrocería
    R(20, 4, 6, 4, c1); R(21, 5, 4, 2, '#111');                      // toma de aire
    R(10, 18, 26, 3, '#222'); R(14, 19, 2, 2, '#444'); R(30, 19, 2, 2, '#444'); // difusor
    R(0, 9, 10, 13, '#121212'); R(36, 9, 10, 13, '#121212');         // ruedas traseras
    R(1, 10, 8, 1, '#3c3c3c'); R(37, 10, 8, 1, '#3c3c3c');
    R(3, 13, 1, 8, '#2a2a2a'); R(6, 13, 1, 8, '#2a2a2a'); R(39, 13, 1, 8, '#2a2a2a'); R(42, 13, 1, 8, '#2a2a2a');
    R(8, 1, 30, 4, c2); R(8, 4, 30, 1, shade(c2, -0.35));            // alerón
    R(7, 0, 2, 10, c1); R(37, 0, 2, 10, c1);
    R(22, 15, 2, 2, '#ff2a2a');                                      // luz de lluvia
    return R.c;
  }

  function tourer(c1, c2, wing) {
    var R = painter(44, 25), d = shade(c1, -0.3), l = shade(c1, 0.25);
    R(3, 19, 8, 6, '#121212'); R(33, 19, 8, 6, '#121212');           // ruedas
    R(2, 9, 40, 12, c1); R(2, 9, 40, 1, l);                          // carrocería
    R(8, 2, 28, 8, c1); R(9, 2, 26, 1, l);                           // techo
    R(10, 3, 24, 6, '#18242f'); R(11, 4, 20, 1, '#40607c');          // luneta
    R(20, 9, 4, 6, c2); R(20, 2, 4, 1, c2);                          // franja
    R(3, 11, 8, 3, '#e01818'); R(33, 11, 8, 3, '#e01818'); R(4, 11, 3, 1, '#ff8a6a'); R(37, 11, 3, 1, '#ff8a6a');
    R(2, 18, 40, 3, d); R(14, 19, 16, 2, '#161616');                 // paragolpes
    R(19, 15, 6, 3, '#e8e8e8');                                      // patente
    R(15, 20, 2, 2, '#888'); R(27, 20, 2, 2, '#888');                // escapes
    if (wing) { R(3, 5, 38, 2, c2); R(7, 7, 2, 2, '#222'); R(35, 7, 2, 2, '#222'); R(2, 4, 2, 4, d); R(40, 4, 2, 4, d); }
    return R.c;
  }

  function moto(c1, c2) {
    var R = painter(18, 30), d = shade(c2, -0.3);
    R(7, 16, 4, 14, '#121212'); R(8, 17, 1, 12, '#333');             // rueda trasera
    R(12, 16, 2, 6, '#9a9a9a');                                      // escape
    R(5, 12, 8, 7, c1); R(8, 13, 2, 1, '#ff2a2a');                   // colín
    R(2, 11, 3, 8, c2); R(13, 11, 3, 8, c2);                         // piernas
    R(2, 18, 3, 3, '#161616'); R(13, 18, 3, 3, '#161616');           // botas
    R(4, 4, 10, 10, c2); R(4, 4, 10, 1, shade(c2, 0.3));             // torso
    R(7, 6, 4, 5, c1);                                               // dorsal
    R(2, 5, 2, 7, d); R(14, 5, 2, 7, d);                             // brazos
    R(6, 0, 6, 5, c1); R(6, 0, 6, 1, shade(c1, 0.35)); R(7, 4, 4, 1, '#111'); // casco
    return R.c;
  }

  // inclina el sprite por filas para simular el giro
  function sheared(src, dir) {
    var c = canvas(src.width + 4, src.height), x = c.getContext('2d');
    for (var y = 0; y < src.height; y++) {
      var off = Math.round(dir * 2 * (1 - y / src.height));
      x.drawImage(src, 0, y, src.width, 1, 2 + off, y, src.width, 1);
    }
    return c;
  }

  var carCache = {};
  GC.carSprite = function (type, c1, c2) {
    var key = type + c1 + c2;
    if (carCache[key]) return carCache[key];
    var base = type === 'formula' ? formula(c1, c2) : type === 'moto' ? moto(c1, c2) : tourer(c1, c2, type === 'gt');
    var s = { type: type, base: base, frames: [sheared(base, -1), sheared(base, 0), sheared(base, 1)] };
    carCache[key] = s;
    return s;
  };

  /* ---------- escenografía ---------- */
  function tree() {
    var R = painter(16, 24);
    R(7, 15, 2, 9, '#5a3a1c');
    R(3, 2, 10, 14, '#1f6b2a'); R(1, 5, 14, 8, '#1f6b2a'); R(4, 1, 8, 2, '#2a8336');
    R(3, 4, 5, 4, '#2f953d'); R(9, 9, 4, 3, '#17541f');
    return R.c;
  }
  function pine() {
    var R = painter(14, 26);
    R(6, 20, 2, 6, '#4f3216');
    for (var i = 0; i < 5; i++) { R(6 - i, 2 + i * 4, 2 + i * 2, 4, i % 2 ? '#17512a' : '#1d6434'); }
    R(6, 0, 2, 2, '#1d6434');
    return R.c;
  }
  function palm() {
    var R = painter(18, 28);
    R(8, 8, 2, 20, '#7a5a30'); R(9, 12, 1, 3, '#5c4222');
    R(2, 4, 14, 2, '#2c8f3a'); R(0, 6, 5, 2, '#2c8f3a'); R(13, 6, 5, 2, '#2c8f3a'); R(5, 1, 8, 3, '#37a547'); R(7, 6, 4, 3, '#1f6b2a');
    return R.c;
  }
  function bush() { var R = painter(10, 6); R(1, 1, 8, 5, '#236f2d'); R(2, 0, 5, 2, '#2f8e3b'); return R.c; }
  function building(v) {
    var cols = ['#c9b79a', '#b9c3cc', '#d6a78a'], R = painter(24, 44), c = cols[v];
    R(0, 0, 24, 44, c); R(0, 0, 24, 2, shade(c, -0.3)); R(22, 0, 2, 44, shade(c, -0.2));
    for (var y = 4; y < 40; y += 6) for (var x = 2; x < 21; x += 5) R(x, y, 3, 4, (x + y) % 3 ? '#32475c' : '#f2dc7a');
    return R.c;
  }
  function stand() {
    var R = painter(60, 22), cs = ['#d33', '#36c', '#eee', '#fc3', '#3a6', '#e7a'];
    R(0, 2, 60, 2, '#d8d8d8'); R(0, 4, 60, 14, '#555'); R(0, 18, 60, 4, '#888');
    for (var y = 5; y < 17; y += 2) for (var x = 1; x < 59; x += 2) R(x, y, 1, 1, cs[(x * 7 + y * 3) % cs.length]);
    R(2, 0, 1, 4, '#999'); R(57, 0, 1, 4, '#999'); R(29, 0, 1, 4, '#999');
    return R.c;
  }
  function billboard(v) {
    var c = [['#e03a2f', '#fff'], ['#1f58c7', '#ffd21e'], ['#111', '#35d07f']][v], R = painter(32, 18);
    R(3, 10, 2, 8, '#666'); R(27, 10, 2, 8, '#666');
    R(0, 0, 32, 12, '#ddd'); R(1, 1, 30, 10, c[0]);
    R(4, 4, 6, 4, c[1]); R(12, 4, 2, 4, c[1]); R(16, 4, 5, 1, c[1]); R(16, 7, 5, 1, c[1]); R(23, 4, 5, 4, c[1]); R(24, 5, 3, 2, c[0]);
    return R.c;
  }
  function board(txt) {
    var R = painter(12, 14);
    R(5, 8, 2, 6, '#777'); R(0, 0, 12, 9, '#f4f4f4'); R(0, 0, 12, 1, '#999');
    GC.text(R.x, txt, txt.length > 2 ? 0 : 2, 2, '#111', 1);
    return R.c;
  }
  function arrow(dir) {
    var R = painter(14, 12);
    R(6, 8, 2, 4, '#777'); R(0, 0, 14, 9, '#f2c200');
    for (var j = 0; j < 4; j++) { var xx = dir > 0 ? 4 + j : 8 - j; R(xx, 1 + j, 2, 1, '#111'); R(xx, 7 - j, 2, 1, '#111'); }
    return R.c;
  }
  function gantry() {
    var R = painter(96, 34);
    R(1, 6, 3, 28, '#888'); R(92, 6, 3, 28, '#888');
    R(0, 0, 96, 9, '#222'); R(0, 9, 96, 1, '#555');
    for (var i = 0; i < 12; i++) R(4 + i * 8, 2, 4, 5, i % 2 ? '#fff' : '#d33');
    return R.c;
  }

  var scenery = null;
  GC.scenery = function () {
    if (scenery) return scenery;
    scenery = {
      round: tree(), pine: pine(), palm: palm(), bush: bush(), stand: stand(), gantry: gantry(),
      building0: building(0), building1: building(1), building2: building(2),
      bill0: billboard(0), bill1: billboard(1), bill2: billboard(2),
      b100: board('100'), b50: board('50'), arrowL: arrow(-1), arrowR: arrow(1)
    };
    return scenery;
  };

  // fondo lejano (se repite horizontalmente)
  GC.backdrop = function (kind) {
    var w = 512, h = 48, c = canvas(w, h), x = c.getContext('2d'), rnd = GC.rng(kind.length * 977 + 5), i;
    function R(a, b, cw, ch, col) { x.fillStyle = col; x.fillRect(a, b, cw, ch); }
    function ridge(base, amp, col, step) {
      var y = base;
      for (i = 0; i < w; i += step) {
        var t = i / w * Math.PI * 2;
        y = base - amp * (0.5 + 0.3 * Math.sin(t * 3 + amp) + 0.2 * Math.sin(t * 7 + base));
        R(i, y | 0, step, h, col);
      }
    }
    if (kind === 'mountain') { ridge(34, 30, '#5d6f8c', 4); ridge(42, 14, '#2c5a3a', 2); }
    else if (kind === 'forest') { ridge(40, 10, '#3d6b52', 4); ridge(45, 6, '#1f4d2a', 2); }
    else if (kind === 'plain') { ridge(46, 3, '#4f7d3a', 8); for (i = 0; i < 12; i++) R((rnd() * w) | 0, 41, 3, 5, '#2b5a2c'); }
    else if (kind === 'city' || kind === 'sea' || kind === 'stadium') {
      if (kind === 'sea') { ridge(30, 22, '#6c7f96', 4); R(0, 40, w, 8, '#2a62b8'); }
      var n = kind === 'stadium' ? 14 : 46;
      for (i = 0; i < n; i++) {
        var bx = (rnd() * w) | 0, bh = 8 + ((rnd() * (kind === 'sea' ? 18 : 28)) | 0), bw = 6 + ((rnd() * 9) | 0);
        var col = ['#56627a', '#6b768c', '#48546c'][i % 3], top = (kind === 'sea' ? 42 : 48) - bh;
        R(bx, top, bw, bh, col);
        for (var yy = top + 2; yy < top + bh - 1; yy += 3) for (var xx = bx + 1; xx < bx + bw - 1; xx += 2) if (rnd() < 0.4) R(xx, yy, 1, 1, '#f5e08a');
      }
      if (kind === 'stadium') ridge(46, 4, '#3d6b52', 4);
    }
    return c;
  };

  /* ---------- fuente 3x5 ---------- */
  var GL = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
    A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110', E: '111100111100111',
    F: '111100111100100', G: '111100101101111', H: '101101111101101', I: '111010010010111', J: '001001001101111',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '111101101101111',
    P: '111101111100100', Q: '111101101111001', R: '111101110101101', S: '111100111001111', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000', '/': '001001010100100',
    '!': '010010010000010', '+': '000010111010000', '>': '100010001010100', '<': '001010100010001', "'": '010010000000000'
  };
  GC.text = function (ctx, str, x, y, col, sc) {
    sc = sc || 1;
    str = String(str).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    ctx.fillStyle = col;
    for (var i = 0; i < str.length; i++) {
      var g = GL[str[i]];
      if (g) for (var p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + (p % 3) * sc, y + ((p / 3) | 0) * sc, sc, sc);
      x += 4 * sc;
    }
  };
  GC.textW = function (str, sc) { return String(str).length * 4 * (sc || 1) - (sc || 1); };
  // texto con sombra
  GC.label = function (ctx, str, x, y, col, sc, align) {
    var w = GC.textW(str, sc);
    if (align === 1) x -= w; else if (align === 0.5) x -= (w / 2) | 0;
    GC.text(ctx, str, x + (sc || 1), y + (sc || 1), '#000', sc);
    GC.text(ctx, str, x, y, col, sc);
  };
})(window.GC);
