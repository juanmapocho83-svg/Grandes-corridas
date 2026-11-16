/* Construcción de pistas: polígono con esquinas redondeadas -> segmentos con curvatura y relieve */
(function (GC) {
  'use strict';
  var SEG = GC.SEG;

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  GC.rng = rng;

  function outline(verts) {
    var n = verts.length, pts = [];
    for (var i = 0; i < n; i++) {
      var P = verts[i], A = verts[(i + n - 1) % n], B = verts[(i + 1) % n];
      var ax = P[0] - A[0], ay = P[1] - A[1], bx = B[0] - P[0], by = B[1] - P[1];
      var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      ax /= la; ay /= la; bx /= lb; by /= lb;
      var ang = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      var r = P[2] || 0;
      if (Math.abs(ang) < 0.02 || !r) { pts.push([P[0], P[1]]); continue; }
      var half = Math.tan(Math.abs(ang) / 2);
      var t = r * half, maxT = 0.48 * Math.min(la, lb);
      if (t > maxT) { t = maxT; r = t / half; }
      var sgn = ang > 0 ? 1 : -1;
      var sx = P[0] - ax * t, sy = P[1] - ay * t;
      var cx = sx + sgn * r * -ay, cy = sy + sgn * r * ax;
      var m = Math.max(2, Math.ceil(Math.abs(ang) * r / 2));
      for (var k = 0; k <= m; k++) {
        var f = ang * k / m, c = Math.cos(f), s = Math.sin(f);
        var vx = sx - cx, vy = sy - cy;
        pts.push([cx + vx * c - vy * s, cy + vx * s + vy * c]);
      }
    }
    return pts;
  }

  function resample(pts, N) {
    var n = pts.length, cum = [0], i;
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    var total = cum[n], out = [], j = 0;
    for (i = 0; i < N; i++) {
      var d = total * i / N;
      while (cum[j + 1] < d) j++;
      var p = pts[j], q = pts[(j + 1) % n], span = cum[j + 1] - cum[j] || 1, f = (d - cum[j]) / span;
      out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
    return { pts: out, scale: N * SEG / total };
  }

  GC.buildTrack = function (def) {
    var N = Math.round(def.length / SEG);
    var rs = resample(outline(def.verts), N), pts = rs.pts, i, k;
    var head = [], dth = [];
    for (i = 0; i < N; i++) {
      var a = pts[i], b = pts[(i + 1) % N];
      head.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
    }
    for (i = 0; i < N; i++) {
      var d = head[(i + 1) % N] - head[i];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      dth.push(d);
    }
    for (var pass = 0; pass < 2; pass++) {
      var sm = [];
      for (i = 0; i < N; i++) {
        var acc = 0;
        for (k = -2; k <= 2; k++) acc += dth[(i + k + N) % N];
        sm.push(acc / 5);
      }
      dth = sm;
    }
    var segs = [], hd = head[0], theme = GC.THEMES[def.theme];
    for (i = 0; i < N; i++) {
      var y = 0;
      for (k = 0; k < def.hills.length; k++) {
        var h = def.hills[k];
        y += h[1] * Math.sin(2 * Math.PI * h[0] * i / N + h[2]);
      }
      segs.push({ i: i, y: y, c: dth[i] * SEG, k: dth[i] / SEG, head: hd, sprites: [] });
      hd += dth[i];
    }
    // suavizar el relieve cerca de la meta no hace falta: los armónicos son periódicos
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (i = 0; i < N; i++) {
      minX = Math.min(minX, pts[i][0]); maxX = Math.max(maxX, pts[i][0]);
      minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]);
    }
    var track = {
      def: def, segs: segs, N: N, L: N * SEG, rw: def.rw, pts: pts, theme: theme,
      wall: def.wall ? def.rw + def.wall : def.rw + 7,
      bounds: [minX, minY, maxX, maxY]
    };
    decorate(track);
    return track;
  };

  function decorate(track) {
    var rnd = rng(track.N * 7919 + 13), segs = track.segs, N = track.N, th = track.theme, rw = track.rw, i;
    var near = track.def.wall ? rw + 2.5 : rw + 4;
    function add(i, kind, x, w) { segs[(i + N) % N].sprites.push({ kind: kind, x: x, w: w }); }
    for (i = 0; i < N; i++) {
      if (rnd() < th.density) {
        var kind = th.trees[Math.floor(rnd() * th.trees.length)];
        var side = rnd() < 0.5 ? -1 : 1;
        var w = kind === 'building' ? 12 + rnd() * 8 : kind === 'stand' ? 26 : kind === 'bush' ? 3 : 5 + rnd() * 4;
        var off = near + w / 2 + (kind === 'building' ? 0 : rnd() * 26) + (kind === 'stand' ? 10 : 0);
        add(i, kind + (kind === 'building' ? Math.floor(rnd() * 3) : ''), side * off, w);
      }
    }
    // carteles de curva: flechas antes de las curvas fuertes
    for (i = 0; i < N; i++) {
      var k = Math.abs(segs[i].k), prev = Math.abs(segs[(i - 1 + N) % N].k);
      if (k > 0.012 && prev <= 0.012) {
        var dir = segs[i].k > 0 ? 1 : -1;
        add(i - 20, 'b100', -dir * (rw + 2), 2.2);
        add(i - 10, 'b50', -dir * (rw + 2), 2.2);
        for (var j = 2; j < 14; j += 4) add(i + j, dir > 0 ? 'arrowR' : 'arrowL', -dir * (rw + 2.5), 3);
      }
    }
    // publicidad y tribunas
    for (i = 30; i < N; i += 60 + Math.floor(rnd() * 50)) {
      if (Math.abs(segs[i].k) < 0.004) add(i, 'bill' + Math.floor(rnd() * 3), (rnd() < 0.5 ? -1 : 1) * (near + 5), 9);
    }
    if (!track.def.wall) {
      for (i = -30; i < 40; i += 6) { add(i, 'stand', -(rw + 22), 30); if (i % 12 === 0) add(i, 'stand', rw + 22, 30); }
    }
    add(0, 'gantry', 0, rw * 2 + 5);
  }
})(window.GC);
