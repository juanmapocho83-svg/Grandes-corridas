/* Motor de carrera: física, bots, clima y render pseudo-3D en baja resolución */
(function (GC) {
  'use strict';
  var SEG = GC.SEG, G = GC.G;
  var H = 200, CAMD = 6.5, CAMH = 1.9, DRAW = 90, NEAR = 1.2;
  GC.H = H;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function torque(r) { return Math.max(0.3, 1 - 1.6 * (r - 0.8) * (r - 0.8)); }

  function makeSpec(cat, team) {
    var n = cat.gears, first = n >= 8 ? 0.25 : n >= 6 ? 0.3 : 0.34, top = cat.top / 3.6 * team.vel, tops = [0];
    for (var i = 1; i <= n; i++) tops[i] = top * first * Math.pow(1 / first, (i - 1) / (n - 1));
    var acc = cat.acc * team.acc;
    return { cat: cat, tops: tops, top: top, acc: acc, cd: (acc * first * torque(1) - 0.25) / (top * top) };
  }
  function bestAccel(sp, v) {
    var best = 0;
    for (var g = 1; g < sp.tops.length; g++) {
      var r = v / sp.tops[g];
      if (r >= 1) continue;
      var a = sp.acc * (sp.tops[1] / sp.tops[g]) * torque(g === 1 ? Math.max(r, 0.4) : r);
      if (a > best) best = a;
    }
    return best;
  }

  var trackCache = {};
  GC.getTrack = function (def) { return trackCache[def.id] || (trackCache[def.id] = GC.buildTrack(def)); };

  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '-:--.--';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }
  GC.fmtTime = fmtTime;

  /* cfg: {cat, team, track, weather, laps, diff, rivals, trans, tyre, auto} (índices) */
  function Race(cfg, onFinish) {
    this.cfg = cfg; this.onFinish = onFinish;
    var cat = this.cat = GC.CATEGORIES[cfg.cat];
    this.diff = GC.DIFFICULTIES[cfg.diff];
    this.track = GC.getTrack(GC.TRACKS[cfg.track]);
    this.backdrop = GC.backdrop(this.track.theme.back);
    this.scenery = GC.scenery();
    this.time = 0; this.state = 'countdown'; this.cd = 0; this.goAt = 5.4 + Math.random() * 1.2;
    this.msg = null; this.shake = 0; this.flash = 0; this.endT = 0; this.gust = 0; this.hitCd = 0;
    this.sx = new Float32Array(DRAW + 2); this.sdx = new Float32Array(DRAW + 2); this.clip = new Float32Array(DRAW + 2);
    this.buckets = []; for (var b = 0; b <= DRAW; b++) this.buckets.push([]);
    this.drops = []; for (var d = 0; d < 90; d++) this.drops.push([Math.random(), Math.random(), 0.5 + Math.random()]);

    // clima
    var wd = GC.WEATHERS[cfg.weather];
    this.variable = !!wd.variable;
    var w0 = this.variable ? GC.WEATHERS[Math.random() < 0.5 ? 1 : 0] : wd;
    this.ws = { wet: w0.wet, rain: w0.rain, snow: w0.snow, vis: w0.vis, sky0: w0.sky0, sky1: w0.sky1, dark: w0.dark, wind: w0.wind, cloud: w0.cloud, night: w0.night || 0, lightning: w0.lightning || 0, name: w0.name };
    this.wTarget = w0; this.wNext = 25 + Math.random() * 25;
    this.botTyre = GC.tyreGrip('wet', w0.wet, w0.snow) > GC.tyreGrip('slick', w0.wet, w0.snow) ? 'wet' : 'slick';

    // parrilla
    var teams = GC.TEAMS, pt = teams[cfg.team], entries = [], i;
    var order = [cfg.team];
    for (i = 0; i < teams.length; i++) if (i !== cfg.team) order.push(i);
    var total = cfg.rivals + 1;
    for (i = 1; i < total; i++) {
      var ti = order[Math.floor(i / 2) % order.length], di = (ti * 2 + (i % 2)) % GC.DRIVERS.length;
      entries.push({ name: GC.DRIVERS[di], team: teams[ti], rating: (((di * 37 + 11) % 21) - 10) / 400 });
    }
    entries.sort(function (a, b) { return b.rating - a.rating; });
    entries.splice(Math.floor(entries.length * 0.6), 0, { name: cfg.name || 'JUGADOR', team: pt, isPlayer: true });
    this.cars = [];
    var gap = cat.type === 'moto' ? 4.5 : 8;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var car = {
        name: e.name, team: e.team, isPlayer: !!e.isPlayer, spec: makeSpec(cat, e.team),
        dist: -(6 + i * gap), x: (i % 2 ? 1 : -1) * this.track.rw * 0.42, v: 0, gear: 1, rpm: 0.12, shiftT: 0,
        sprite: GC.carSprite(cat.type, e.team.c1, e.team.c2), steerVis: 0, lean: 0,
        skill: this.diff.skill + (e.rating || 0), lane: (i % 2 ? 1 : -1) * (0.3 + 0.4 * Math.random()), tx: 0, errT: 0,
        react: this.diff.react * (0.5 + Math.random()), finished: false, finishT: 0, lap: 0, lapStart: 0, best: null, last: null,
        stalled: false, draft: false, pos: i + 1
      };
      car.tx = car.x;
      if (car.isPlayer) { this.player = car; if (cfg.trans === 'clutch') car.gear = 0; }
      this.cars.push(car);
    }
    this.bestKey = 'gc_best_' + this.track.def.id + '_' + cat.id;
    this.record = parseFloat(GC.store.get(this.bestKey)) || null;
    this.makeProfile();
    this.makeMinimap();
  }
  GC.Race = Race;

  Race.prototype.segAt = function (dist) { return this.track.segs[Math.floor(mod(dist, this.track.L) / SEG) % this.track.N]; };

  Race.prototype.makeProfile = function () {
    var cat = this.cat, segs = this.track.segs, N = this.track.N, i;
    var mu = cat.mu * GC.tyreGrip(this.botTyre, this.ws.wet, this.ws.snow), top = cat.top / 3.6 * 1.05;
    var v = this.vprof || (this.vprof = new Float32Array(N));
    for (i = 0; i < N; i++) {
      var den = Math.abs(segs[i].k) - G * mu * cat.df;
      v[i] = den > 1e-5 ? Math.min(top, Math.sqrt(G * mu / den)) : top;
    }
    for (var pass = 0; pass < 2; pass++) for (i = N - 1; i >= 0; i--) {
      var nx = v[(i + 1) % N], ab = cat.brake * G * mu * (1 + cat.df * nx * nx) * 0.8;
      v[i] = Math.min(v[i], Math.sqrt(nx * nx + 2 * ab * SEG));
    }
    this.profGrip = mu;
  };

  Race.prototype.makeMinimap = function () {
    var S = 44, c = GC.canvas(S, S), x = c.getContext('2d'), b = this.track.bounds, pts = this.track.pts;
    var sc = (S - 6) / Math.max(b[2] - b[0], b[3] - b[1]);
    var ox = 3 + ((S - 6) - (b[2] - b[0]) * sc) / 2, oy = 3 + ((S - 6) - (b[3] - b[1]) * sc) / 2;
    this.mm = { c: c, f: function (p) { return [Math.round(ox + (p[0] - b[0]) * sc), Math.round(oy + (p[1] - b[1]) * sc)]; } };
    x.fillStyle = '#fff';
    for (var i = 0; i < pts.length; i++) { var q = this.mm.f(pts[i]); x.fillRect(q[0], q[1], 1, 1); }
  };

  Race.prototype.say = function (t, dur) { this.msg = { t: t, d: dur || 1.6 }; };

  /* ---------- actualización ---------- */
  Race.prototype.update = function (dt, inp) {
    var self = this, cars = this.cars, p = this.player, L = this.track.L, i;
    this.time += dt;
    if (this.msg && (this.msg.d -= dt) <= 0) this.msg = null;
    this.shake = Math.max(0, this.shake - dt * 4); this.flash = Math.max(0, this.flash - dt * 5); this.hitCd -= dt;
    this.updateWeather(dt);

    if (this.state === 'countdown') {
      var before = Math.floor(this.cd); this.cd += dt;
      var lights = Math.floor(this.cd);
      if (lights !== before && lights >= 1 && lights <= 5) GC.audio.beep(440, 0.12);
      if (this.cd >= this.goAt) { this.state = 'racing'; this.raceT0 = this.time; GC.audio.beep(880, 0.5); this.say('YA!', 1); for (i = 0; i < cars.length; i++) cars[i].lapStart = this.time; }
    }
    var racing = this.state !== 'countdown';
    var rt = racing ? this.time - this.raceT0 : 0;

    for (i = 0; i < cars.length; i++) {
      var c = cars[i], d0 = c.dist;
      if (c.isPlayer && !c.finished && !this.cfg.auto) this.updatePlayer(c, dt, inp, racing);
      else if (racing && rt > (c.isPlayer ? 0 : c.react)) this.updateBot(c, dt);
      // vueltas
      var lb = d0 < 0 ? -1 : Math.floor(d0 / L), la = c.dist < 0 ? -1 : Math.floor(c.dist / L);
      if (la > lb) {
        if (lb >= 0) {
          c.last = this.time - c.lapStart; c.lapStart = this.time;
          if (c.best == null || c.last < c.best) c.best = c.last;
          if (c.isPlayer) {
            if (!this.record || c.last < this.record) { this.record = c.last; GC.store.set(this.bestKey, c.last.toFixed(3)); this.say('RECORD ' + fmtTime(c.last), 2.5); }
            else this.say('VUELTA ' + fmtTime(c.last), 2);
          }
        }
        c.lap = la + 1;
        if (!c.finished && c.dist >= this.cfg.laps * L) {
          c.finished = true; c.finishT = this.time - this.raceT0;
          if (c.isPlayer) { this.state = 'finished'; this.endT = 4; this.say('BANDERA A CUADROS!', 3.5); GC.audio.beep(660, 0.6); }
        }
      }
    }
    // colisiones del jugador con los bots
    if (racing) {
      var hw = this.cat.w, len = this.cat.len;
      p.draft = false;
      for (i = 0; i < cars.length; i++) {
        var o = cars[i]; if (o === p) continue;
        var ds = mod(o.dist - p.dist + L / 2, L) - L / 2, dx = o.x - p.x;
        if (ds > 0 && ds < 38 && Math.abs(dx) < 1.3 && p.v > 25) p.draft = true;
        if (Math.abs(ds) < len && Math.abs(dx) < hw * 0.9) {
          if (ds > 0) { if (p.v > o.v * 0.94) { var pv = p.v; p.v = o.v * 0.94; o.v = Math.min(o.v + (pv - o.v) * 0.3, o.spec.top); this.hit(Math.min(1, (pv - p.v) / 10 + 0.3)); } }
          else if (o.v > p.v * 0.96) o.v = p.v * 0.96;
          p.x -= (dx >= 0 ? 1 : -1) * dt * 5;
        }
      }
    }
    // posiciones
    var sorted = cars.slice().sort(function (a, b) {
      if (a.finished && b.finished) return a.finishT - b.finishT;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.dist - a.dist;
    });
    for (i = 0; i < sorted.length; i++) sorted[i].pos = i + 1;
    this.sorted = sorted;

    // sonido
    var slide = this.slide || 0;
    GC.audio.engine(p.rpm, p.isPlayer && !p.finished ? inp.gas : 0.6, this.cat.snd, !p.stalled);
    GC.audio.ambient(slide, this.ws.rain, this.ws.wind * 0.3 + Math.min(0.5, p.v / 200));

    if (this.state === 'finished' && (this.endT -= dt) <= 0) {
      this.state = 'done';
      if (this.onFinish) this.onFinish(sorted.map(function (c, k) {
        return { pos: k + 1, name: c.name, team: c.team, isPlayer: c.isPlayer, time: c.finished ? c.finishT : null, best: c.best, gapM: c.finished ? 0 : self.cfg.laps * L - c.dist };
      }));
    }
  };

  Race.prototype.hit = function (f) {
    if (!GC.reduceMotion) this.shake = Math.max(this.shake, f);
    if (this.hitCd <= 0) { GC.audio.thud(); this.hitCd = 0.3; if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { } }
  };

  Race.prototype.updateWeather = function (dt) {
    var ws = this.ws;
    this.gust = Math.sin(this.time * 0.7) * Math.sin(this.time * 0.23 + 1) * 1.6;
    if (ws.lightning > 0.5 && Math.random() < dt * 0.12) { this.flash = GC.reduceMotion ? 0.25 : 1; GC.audio.thunder(); }
    if (!this.variable) return;
    if ((this.wNext -= dt) <= 0) {
      var opts = [0, 1, 2, 3, 1, 2], nw;
      do { nw = GC.WEATHERS[opts[Math.floor(Math.random() * opts.length)]]; } while (nw === this.wTarget);
      this.wTarget = nw; this.wNext = 35 + Math.random() * 35;
      this.say('CLIMA: ' + nw.name, 3);
    }
    var t = this.wTarget, k = Math.min(1, dt / 10), keys = ['wet', 'rain', 'vis', 'dark', 'wind', 'cloud'];
    for (var i = 0; i < keys.length; i++) ws[keys[i]] += (t[keys[i]] - ws[keys[i]]) * k;
    ws.sky0 = GC.mix(ws.sky0, t.sky0, k * 1.5); ws.sky1 = GC.mix(ws.sky1, t.sky1, k * 1.5);
    ws.lightning = t.lightning && ws.rain > 0.8 ? 1 : 0; ws.name = t.name;
    var g = this.cat.mu * GC.tyreGrip(this.botTyre, ws.wet, ws.snow);
    if (Math.abs(g - this.profGrip) > 0.03 * this.profGrip) this.makeProfile();
  };

  Race.prototype.updatePlayer = function (c, dt, inp, racing) {
    var sp = c.spec, cat = sp.cat, tr = this.track, ws = this.ws, tops = sp.tops, n = cat.gears;
    var seg = this.segAt(c.dist), nxt = tr.segs[(seg.i + 1) % tr.N];
    var grip = GC.tyreGrip(this.cfg.tyre, ws.wet, ws.snow) * c.team.grip;
    var off = Math.abs(c.x) > tr.rw + 0.4;
    var mu = cat.mu * grip * (off ? 0.55 : 1);
    var aMax = G * mu * (1 + cat.df * c.v * c.v);
    var mode = this.cfg.trans, clutchIn = mode === 'clutch' && inp.clutch > 0.5;
    if (c.shiftT > 0) c.shiftT -= dt;

    if (mode === 'auto') {
      var ra = c.v / tops[c.gear];
      if (c.shiftT <= 0) {
        if (ra > 0.95 && c.gear < n) { c.gear++; c.shiftT = cat.shift; }
        else if (c.gear > 1 && c.v < tops[c.gear - 1] * 0.7) { c.gear--; c.shiftT = cat.shift * 0.5; }
      }
    } else {
      if (inp.up) {
        if (mode === 'clutch' && !clutchIn) { this.say('PISA EL EMBRAGUE', 1); GC.audio.beep(140, 0.08, 'sawtooth', 0.2); }
        else if (c.gear < n) { c.gear++; c.shiftT = cat.shift; }
      }
      if (inp.down) {
        if (mode === 'clutch' && !clutchIn) { this.say('PISA EL EMBRAGUE', 1); GC.audio.beep(140, 0.08, 'sawtooth', 0.2); }
        else if (c.gear > (mode === 'clutch' ? 0 : 1)) {
          if (c.gear > 1 && c.v / tops[c.gear - 1] > 1.1) this.say('MUY RAPIDO PARA BAJAR', 1);
          else { c.gear--; c.shiftT = cat.shift; }
        }
      }
    }
    inp.up = inp.down = false;

    var a = 0, gear = c.gear, vg = gear > 0 ? tops[gear] : 1, r = gear > 0 ? c.v / vg : 0;
    var engaged = gear > 0 && !clutchIn && !c.stalled && racing;
    if (mode === 'clutch') {
      if (c.stalled) { if (clutchIn && inp.gas > 0.1) { c.stalled = false; c.rpm = 0.2; GC.audio.beep(200, 0.15, 'sawtooth'); } }
      else if (engaged && c.v < 1.2 && c.rpm < 0.22) { c.stalled = true; engaged = false; this.say('MOTOR CALADO: EMBRAGUE + GAS', 2.5); }
    }
    this.spin = false;
    if (engaged) {
      var rE = gear === 1 ? Math.max(r, 0.4) : r, thrust = 0;
      if (r >= 1) a -= 2.5;
      else if (c.shiftT <= 0) thrust = inp.gas * sp.acc * (tops[1] / vg) * torque(rE);
      var lim = aMax * 0.92; if (cat.type === 'moto') lim = Math.min(lim, 11.5);
      if (thrust > lim) { this.spin = thrust > lim * 1.15; thrust = lim; }
      a += thrust;
      if (inp.gas < 0.05) a -= 0.4 + 1.6 * r * (tops[1] / vg);
      var tg = Math.max(0.12, gear === 1 && inp.gas > 0.1 ? Math.max(r, 0.4 * inp.gas + 0.12) : r);
      c.rpm += (Math.min(1, tg) - c.rpm) * Math.min(1, dt * 12);
    } else {
      var tf = c.stalled ? 0 : 0.12 + 0.88 * inp.gas;
      c.rpm += (tf - c.rpm) * Math.min(1, dt * (tf > c.rpm ? 5 : 3));
    }
    a -= sp.cd * c.v * c.v * (c.draft ? 0.72 : 1) + (c.v > 0.1 ? 0.25 : 0);
    a -= inp.brake * cat.brake * aMax;
    if (off && c.v > 0) a -= 1.5 + 0.12 * c.v;
    if (c.v > 0.5) a -= G * (nxt.y - seg.y) / SEG;
    c.v = Math.max(0, c.v + a * dt);
    if (!racing) c.v = 0;

    // lateral
    var A = aMax * 1.15, aN = c.v * c.v * seg.k, ratio = clamp(aN / A, -4, 4), low = Math.min(1, c.v / 8);
    var Smax = clamp(0.3 * A, 2.5, 7);
    var vx = Smax * (inp.steer * low - ratio);
    vx += this.gust * ws.wind * (cat.type === 'moto' ? 1.5 : 0.7) * Math.min(1, c.v / 25);
    c.x += vx * dt;
    var over = Math.abs(ratio) - 0.87;
    this.slide = clamp(Math.max(over * 3, this.spin ? 0.6 : 0, inp.brake > 0.9 && c.v > 30 && grip < 0.8 ? 0.5 : 0, off && c.v > 5 ? 0.4 : 0), 0, 1);
    if (Math.abs(aN) > aMax) c.v = Math.max(0, c.v - (Math.abs(aN) - aMax) * 0.12 * dt);
    if (Math.abs(c.x) > tr.wall) {
      c.x = (c.x > 0 ? 1 : -1) * tr.wall;
      if (c.v > 8) { this.hit(Math.min(1, c.v / 60)); c.v -= c.v * 2.2 * dt; }
    }
    c.dist += c.v * dt;
    c.steerVis += (inp.steer - c.steerVis) * Math.min(1, dt * 10);
    c.lean = c.steerVis * 0.45 + clamp(ratio, -1, 1) * 0.25;
  };

  Race.prototype.updateBot = function (c, dt) {
    var sp = c.spec, cat = sp.cat, tr = this.track, L = tr.L, cars = this.cars, ws = this.ws;
    var seg = this.segAt(c.dist), nxt = tr.segs[(seg.i + 1) % tr.N];
    var grip = GC.tyreGrip(this.botTyre, ws.wet, ws.snow) * c.team.grip;
    var skill = c.finished ? 0.8 : c.isPlayer ? 0.93 : c.skill;
    var target = this.vprof[seg.i] * skill * Math.sqrt(c.team.grip);
    if (c.errT > 0) { c.errT -= dt; target *= 0.8; }
    else if (!c.isPlayer && Math.random() < this.diff.err * dt) c.errT = 0.8 + Math.random();
    // tráfico
    var ahead = null, best = 6 + c.v * 0.5, wsum = cat.w + 0.3, i;
    for (i = 0; i < cars.length; i++) {
      var o = cars[i]; if (o === c) continue;
      var gap = mod(o.dist - c.dist, L) - cat.len;
      if (gap > -cat.len && gap < best && Math.abs(o.x - c.x) < wsum + 0.4) { best = gap; ahead = o; }
    }
    var lim = tr.rw - cat.w * 0.5 - 0.3;
    if (ahead) {
      var side = c.x >= ahead.x ? 1 : -1, tx = ahead.x + side * (wsum + 0.7);
      if (Math.abs(tx) > lim) tx = ahead.x - side * (wsum + 0.7);
      c.tx = clamp(tx, -lim, lim);
      if (best < 1.5 + c.v * 0.1) target = Math.min(target, ahead.v * (best < 0.5 ? 0.9 : 1));
    } else {
      c.tx = clamp(c.lane * tr.rw * 0.55 + clamp(seg.k * 300, -1, 1) * tr.rw * 0.35, -lim, lim);
    }
    var dx = clamp(c.tx - c.x, -3.2 * dt, 3.2 * dt) * Math.min(1, c.v / 10);
    c.x += dx;
    var a;
    if (c.v < target) {
      a = Math.min(bestAccel(sp, c.v), G * cat.mu * grip * (1 + cat.df * c.v * c.v) * 0.9, cat.type === 'moto' ? 11.5 : 99);
      a -= sp.cd * c.v * c.v + 0.25 + G * (nxt.y - seg.y) / SEG;
      c.v = Math.min(target, c.v + a * dt);
    } else {
      a = cat.brake * G * cat.mu * grip * (1 + cat.df * c.v * c.v) * 0.9;
      c.v = Math.max(target, c.v - a * dt);
    }
    if (c.v < 0) c.v = 0;
    c.dist += c.v * dt;
    var sv = clamp(seg.k * 40 + dx / dt * 0.2, -1, 1);
    c.steerVis += (sv - c.steerVis) * Math.min(1, dt * 8);
    c.lean = clamp(c.v * c.v * seg.k / 12, -0.6, 0.6);
    if (c.isPlayer) { // piloto automático: estimar marcha y rpm para sonido/HUD
      var g = 1; while (g < cat.gears && c.v > sp.tops[g] * 0.95) g++;
      c.gear = g; c.rpm = clamp(c.v / sp.tops[g], 0.12, 1);
    }
  };

  /* ---------- render ---------- */
  Race.prototype.render = function (ctx, W) {
    var p = this.player, tr = this.track, segs = tr.segs, N = tr.N, L = tr.L, ws = this.ws, th = tr.theme;
    var f = H * 0.92, HOR = Math.round(H * 0.42), rw = tr.rw, i, n, y;
    var camS = mod(p.dist - CAMD, L), bi = Math.floor(camS / SEG) % N, frac = (camS - Math.floor(camS / SEG) * SEG) / SEG;
    var s0 = segs[bi], s1 = segs[(bi + 1) % N];
    var camY = s0.y + (s1.y - s0.y) * frac + CAMH, camX = p.x, cx0 = W / 2;
    var draw = Math.min(DRAW, Math.ceil(ws.vis / SEG) + 2);
    var fogCol = ws.sky1, snow = ws.snow, wet = clamp(ws.wet, 0, 1);

    ctx.save();
    if (this.shake > 0.02) ctx.translate(Math.round((Math.random() - 0.5) * 4 * this.shake), Math.round((Math.random() - 0.5) * 4 * this.shake));

    // cielo
    var bands = 7;
    for (i = 0; i < bands; i++) {
      ctx.fillStyle = GC.mix(ws.sky0, ws.sky1, i / (bands - 1));
      ctx.fillRect(0, Math.floor(HOR * i / bands), W, Math.ceil(HOR / bands) + 1);
    }
    var hoff = s0.head * 163;
    if (ws.night) {
      ctx.fillStyle = '#fff';
      for (i = 0; i < 40; i++) ctx.fillRect(mod(i * 97.3 - hoff * 0.5, W + 20) | 0, (i * 53.7) % (HOR - 8) | 0, 1, 1);
      var mx = mod(W * 0.7 - hoff * 0.5, W + 60) - 30; ctx.fillStyle = '#e8ecd8'; ctx.fillRect(mx, 14, 10, 10); ctx.fillStyle = ws.sky0; ctx.fillRect(mx + 3, 12, 8, 8);
    } else if (ws.cloud < 0.6) {
      var sxp = mod(W * 0.3 - hoff * 0.5, W + 60) - 30;
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(sxp - 1, 11, 14, 12); ctx.fillRect(sxp + 1, 9, 10, 16);
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(sxp + 1, 11, 10, 12);
    }
    var cc = ws.night ? '#2a3358' : GC.mix('#ffffff', ws.sky0, clamp(ws.cloud - 0.3, 0, 0.75));
    ctx.fillStyle = cc;
    var nc = Math.round(3 + ws.cloud * 9);
    for (i = 0; i < nc; i++) {
      var cxp = mod(i * 131.7 + this.time * (2 + i % 3) - hoff * 0.7, W + 80) - 40, cyp = 6 + (i * 29) % (HOR - 34);
      ctx.fillRect(cxp | 0, cyp, 26 + (i % 3) * 8, 5); ctx.fillRect((cxp + 5) | 0, cyp - 3, 14 + (i % 2) * 6, 4);
    }
    var bx = -mod(hoff, 512);
    for (; bx < W; bx += 512) ctx.drawImage(this.backdrop, Math.round(bx), HOR - 48);
    var haze = clamp(1 - ws.vis / 700, 0, 0.95);
    if (haze > 0.02) { ctx.globalAlpha = haze; ctx.fillStyle = fogCol; ctx.fillRect(0, HOR - 48, W, 48); ctx.globalAlpha = 1; }

    // paleta del suelo
    var g0 = th.grass[0], g1 = th.grass[1], r0 = '#6e6e72', r1 = '#68686c';
    if (wet > 0) { r0 = GC.mix(r0, '#33373d', wet * 0.8); r1 = GC.mix(r1, '#30343a', wet * 0.8); g0 = GC.mix(g0, '#1d4a2a', wet * 0.3); g1 = GC.mix(g1, '#1a4426', wet * 0.3); }
    if (snow > 0) { g0 = GC.mix(g0, '#eef2f6', 0.9 * snow); g1 = GC.mix(g1, '#dfe6ee', 0.9 * snow); r0 = GC.mix(r0, '#c4ccd4', 0.45 * snow); r1 = GC.mix(r1, '#b8c1ca', 0.45 * snow); }
    ctx.fillStyle = g0; ctx.fillRect(0, HOR, W, H - HOR);

    // pasada 1: pista de cerca a lejos
    var x = 0, dx = -s0.c * frac, maxy = H, sx = this.sx, sdx = this.sdx, clip = this.clip;
    var wallF = tr.def.wall ? tr.wall / rw : 0;
    for (n = 0; n < draw; n++) {
      var seg = segs[(bi + n) % N], nx = segs[(bi + n + 1) % N];
      var z1 = (n - frac) * SEG, z2 = z1 + SEG;
      sx[n] = x; sdx[n] = dx; clip[n] = maxy;
      if (z2 > NEAR) {
        var xa = x, ya = seg.y;
        if (z1 < NEAR) { var q = (NEAR - z1) / SEG; xa = x + dx * q; ya = seg.y + (nx.y - seg.y) * q; z1 = NEAR; }
        var k1 = f / z1, k2 = f / z2;
        var X1 = cx0 + (xa - camX) * k1, Y1 = HOR + (camY - ya) * k1, w1 = rw * k1;
        var X2 = cx0 + (x + dx - camX) * k2, Y2 = HOR + (camY - nx.y) * k2, w2 = rw * k2;
        var yTop = Math.max(0, Math.ceil(Y2)), yBot = Math.min(maxy, Math.ceil(Y1));
        if (yBot > yTop) {
          var band = Math.floor(seg.i / 3) % 2, rum = Math.floor(seg.i / 2) % 2;
          ctx.fillStyle = band ? g0 : g1; ctx.fillRect(0, yTop, W, yBot - yTop);
          var rc = band ? r0 : r1, rumc = snow > 0.5 ? (rum ? '#d33' : '#dfe6ee') : (rum ? '#d62a2a' : '#f2f2f2');
          var dash = Math.floor(seg.i / 2) % 3 === 0, start = seg.i === 0;
          for (y = yTop; y < yBot; y++) {
            var t = (y - Y2) / (Y1 - Y2), cx = X2 + (X1 - X2) * t, hw = w2 + (w1 - w2) * t;
            var xl = Math.round(cx - hw), xr = Math.round(cx + hw), rwd = Math.max(1, Math.round(hw * 0.13));
            if (xr < 0 && !wallF || xl > W && !wallF) continue;
            if (wallF) {
              var wl = Math.round(cx - hw * wallF), wr = Math.round(cx + hw * wallF), wt = Math.max(1, Math.round(hw * 0.12));
              ctx.fillStyle = '#55585f'; ctx.fillRect(wl, y, wr - wl, 1);
              ctx.fillStyle = rum ? '#e8e8e8' : '#c22'; ctx.fillRect(wl - wt, y, wt, 1); ctx.fillRect(wr, y, wt, 1);
            }
            ctx.fillStyle = rumc; ctx.fillRect(xl - rwd, y, xr - xl + rwd * 2, 1);
            ctx.fillStyle = rc; ctx.fillRect(xl, y, xr - xl, 1);
            if (start) {
              var bw = (xr - xl) / 12, par = t > 0.5 ? 1 : 0;
              ctx.fillStyle = '#f4f4f4'; ctx.fillRect(xl, y, xr - xl, 1); ctx.fillStyle = '#111';
              for (var q2 = par; q2 < 12; q2 += 2) ctx.fillRect(Math.round(xl + q2 * bw), y, Math.ceil(bw), 1);
            } else {
              var lw = Math.max(1, Math.round(hw * 0.035));
              ctx.fillStyle = '#e9e9e9'; ctx.fillRect(xl + lw, y, lw, 1); ctx.fillRect(xr - lw * 2, y, lw, 1);
              if (dash && hw > 6) ctx.fillRect(Math.round(cx - lw / 2), y, lw, 1);
            }
          }
          var fg = Math.floor(Math.min(1, (z2 / ws.vis) * (z2 / ws.vis)) * 8) / 8;
          if (fg > 0) { ctx.globalAlpha = fg; ctx.fillStyle = fogCol; ctx.fillRect(0, yTop, W, yBot - yTop); ctx.globalAlpha = 1; }
          maxy = yTop;
        }
      }
      x += dx; dx += seg.c;
    }

    // autos por segmento
    var buckets = this.buckets, cars = this.cars;
    for (n = 0; n < draw; n++) buckets[n].length = 0;
    for (i = 0; i < cars.length; i++) {
      var c = cars[i], rel = mod(c.dist - p.dist + L / 2, L) - L / 2 + CAMD;
      if (rel < 3.2 || rel >= (draw - 1) * SEG) continue;
      c._rel = rel; buckets[Math.floor(rel / SEG + frac)].push(c);
    }
    // pasada 2: sprites de lejos a cerca
    var sc = this.scenery;
    for (n = draw - 1; n >= 0; n--) {
      var sg = segs[(bi + n) % N], zs = (n - frac) * SEG;
      if (zs > NEAR && sg.sprites.length) {
        var kk = f / zs, fa = 1 - Math.min(1, (zs / ws.vis) * (zs / ws.vis));
        if (fa > 0.05) {
          ctx.globalAlpha = fa;
          for (i = 0; i < sg.sprites.length; i++) {
            var spx = sg.sprites[i];
            this.blit(ctx, sc[spx.kind], cx0 + (sx[n] + spx.x - camX) * kk, HOR + (camY - sg.y) * kk, spx.w * kk, clip[n], W);
          }
          ctx.globalAlpha = 1;
        }
      }
      var bk = buckets[n];
      if (bk.length) {
        if (bk.length > 1) bk.sort(function (a, b) { return b._rel - a._rel; });
        for (i = 0; i < bk.length; i++) this.drawCar(ctx, bk[i], n, frac, f, HOR, camX, camY, cx0, W);
      }
    }

    // ambiente
    if (ws.dark > 0.01) { ctx.globalAlpha = ws.dark; ctx.fillStyle = '#000014'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    var dr = this.drops, nd = Math.round(dr.length * Math.max(ws.rain, snow * 0.8));
    if (nd > 0) {
      var sp = p.v / 60;
      ctx.fillStyle = snow > 0.5 ? '#ffffff' : '#c9dcf0';
      for (i = 0; i < nd; i++) {
        var d = dr[i];
        if (snow > 0.5) { d[1] += 0.004 * d[2]; d[0] += 0.002 * Math.sin(this.time * 2 + i) + this.gust * 0.002; }
        else { d[1] += 0.05 * d[2] + sp * 0.02; d[0] += this.gust * 0.004 - 0.004; }
        if (d[1] > 1) { d[1] -= 1; d[0] = Math.random(); }
        d[0] = mod(d[0], 1);
        if (snow > 0.5) ctx.fillRect((d[0] * W) | 0, (d[1] * H) | 0, d[2] > 1 ? 2 : 1, d[2] > 1 ? 2 : 1);
        else ctx.fillRect((d[0] * W) | 0, (d[1] * H) | 0, 1, 3 + ((d[2] * 3) | 0));
      }
    }
    if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.restore();
    this.hud(ctx, W);
  };

  Race.prototype.blit = function (ctx, img, X, Y, w, clipY, W) {
    if (w < 1.5) return;
    var h = img.height / img.width * w, x0 = Math.round(X - w / 2), y0 = Math.round(Y - h);
    if (x0 > W || x0 + w < 0 || y0 >= clipY) return;
    var vh = Math.min(h, clipY - y0);
    ctx.drawImage(img, 0, 0, img.width, img.height * vh / h, x0, y0, Math.round(w), Math.round(vh));
  };

  Race.prototype.drawCar = function (ctx, c, n, frac, f, HOR, camX, camY, cx0, W) {
    var tr = this.track, segs = tr.segs, N = tr.N, ws = this.ws;
    var bi = (Math.floor(mod(this.player.dist - CAMD, tr.L) / SEG)) % N;
    var seg = segs[(bi + n) % N], nx = segs[(bi + n + 1) % N];
    var pct = c._rel / SEG + frac - n, k = f / c._rel;
    var X = cx0 + (this.sx[n] + this.sdx[n] * pct + c.x - camX) * k;
    var Y = HOR + (camY - (seg.y + (nx.y - seg.y) * pct)) * k;
    var cat = this.cat, spr = c.sprite, moto = cat.type === 'moto';
    var img = moto ? spr.base : spr.frames[c.steerVis < -0.35 ? 0 : c.steerVis > 0.35 ? 2 : 1];
    var w = cat.w * k * (img.width / spr.base.width), h = img.height / img.width * w;
    var clipY = this.clip[n];
    if (Y - h >= clipY || X + w < 0 || X - w > W || w < 1.5) return;
    var fa = 1 - Math.min(1, Math.pow(c._rel / ws.vis, 2)) * 0.9;
    ctx.globalAlpha = 0.35 * fa; ctx.fillStyle = '#000';
    if (Y < clipY) ctx.fillRect(Math.round(X - w * 0.5), Math.round(Y - 1), Math.round(w), Math.max(1, Math.round(h * 0.08)));
    ctx.globalAlpha = fa;
    if (moto && Math.abs(c.lean) > 0.05 && Y < clipY) {
      ctx.save(); ctx.translate(Math.round(X), Math.round(Y)); ctx.rotate(c.lean);
      ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h)); ctx.restore();
    } else this.blit(ctx, img, X, Y, w, clipY, W);
    // spray de agua
    if (ws.wet > 0.35 && c.v > 18 && Y < clipY && !ws.snow) {
      ctx.fillStyle = '#dfe8f0';
      var m = Math.min(5, 1 + Math.round(c.v / 18));
      for (var i = 0; i < m; i++) {
        ctx.globalAlpha = 0.28 * fa * ws.wet;
        var pw = w * (0.5 + Math.random() * 0.6), ph = h * (0.25 + Math.random() * 0.3);
        ctx.fillRect(Math.round(X - pw / 2 + (Math.random() - 0.5) * w * 0.5), Math.round(Y - ph * (0.6 + Math.random())), Math.round(pw), Math.round(ph));
      }
    }
    if (c === this.player && this.slide > 0.5 && c.v > 8) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = Math.abs(c.x) > tr.rw ? '#7a6a4a' : '#ddd';
      ctx.fillRect(Math.round(X - w * 0.5 + (Math.random() - 0.5) * 4), Math.round(Y - 3), Math.round(w * 0.3), 3);
      ctx.fillRect(Math.round(X + w * 0.2 + (Math.random() - 0.5) * 4), Math.round(Y - 3), Math.round(w * 0.3), 3);
    }
    ctx.globalAlpha = 1;
  };

  Race.prototype.hud = function (ctx, W) {
    var p = this.player, L = GC.label, cfg = this.cfg, i, cx = W >> 1;
    function panel(x, y, w, h) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
    // posición y vueltas
    panel(2, 2, 58, 18);
    L(ctx, 'POS ' + p.pos + '/' + this.cars.length, 5, 4, '#ffd21e', 1);
    L(ctx, 'VTA ' + clamp(p.lap, 1, cfg.laps) + '/' + cfg.laps, 5, 12, '#fff', 1);
    // minimapa
    panel(2, 22, 46, 46);
    ctx.drawImage(this.mm.c, 3, 23);
    for (i = 0; i < this.cars.length; i++) {
      var c = this.cars[i]; if (c === p) continue;
      var q = this.mm.f(this.track.pts[this.segAt(c.dist).i]);
      ctx.fillStyle = c.team.c1; ctx.fillRect(3 + q[0] - 1, 23 + q[1] - 1, 2, 2);
    }
    var pq = this.mm.f(this.track.pts[this.segAt(p.dist).i]);
    ctx.fillStyle = '#000'; ctx.fillRect(3 + pq[0] - 2, 23 + pq[1] - 2, 5, 5);
    ctx.fillStyle = (this.time * 4 | 0) % 2 ? '#fff' : '#ffd21e'; ctx.fillRect(3 + pq[0] - 1, 23 + pq[1] - 1, 3, 3);
    // tiempos
    panel(W - 62, 2, 60, 26);
    var lapT = this.state === 'countdown' ? 0 : this.time - p.lapStart;
    L(ctx, fmtTime(p.finished ? p.last : lapT), W - 5, 4, '#fff', 1, 1);
    L(ctx, 'MEJOR ' + fmtTime(p.best), W - 5, 12, '#7fe08a', 1, 1);
    L(ctx, this.ws.name, W - 5, 20, '#9fd2f5', 1, 1);
    // velocímetro
    var kmh = Math.round(p.v * 3.6), n = 16, bw = 4, x0 = cx - (n * bw) / 2;
    panel(x0 - 4, 2, n * bw + 8, 30);
    for (i = 0; i < n; i++) {
      var on = p.rpm * n > i + 0.5;
      ctx.fillStyle = !on ? '#333' : i >= 14 ? '#ff3030' : i >= 11 ? '#ffd21e' : '#35d07f';
      ctx.fillRect(x0 + i * bw, 4, bw - 1, 4);
    }
    var gs = p.stalled ? 'X' : p.gear === 0 ? 'N' : String(p.gear);
    L(ctx, kmh, cx - 2, 11, '#fff', 2, 1);
    L(ctx, 'KM/H', cx - 2, 24, '#aaa', 1, 1);
    ctx.fillStyle = p.rpm > 0.93 && cfg.trans !== 'auto' ? '#ff3030' : '#222'; ctx.fillRect(cx + 6, 10, 16, 19);
    L(ctx, gs, cx + 9, 12, '#ffd21e', 3);
    if (p.draft) L(ctx, 'REBUFO', cx, 35, '#9fd2f5', 1, 0.5);
    // semáforo
    if (this.state === 'countdown') {
      var lit = Math.min(5, Math.floor(this.cd));
      panel(cx - 34, 44, 68, 16);
      for (i = 0; i < 5; i++) { ctx.fillStyle = i < lit ? '#ff2020' : '#401010'; ctx.fillRect(cx - 30 + i * 13, 47, 9, 9); }
      if (cfg.trans === 'clutch' && p.gear === 0) L(ctx, 'EMBRAGUE + SUBIR A 1RA', cx, 64, '#fff', 1, 0.5);
    }
    if (this.msg) L(ctx, this.msg.t, cx, 70, '#fff', this.msg.t.length > 14 ? 1 : 2, 0.5);
    if (Math.abs(p.x) > this.track.rw + 0.4 && p.v > 5 && (this.time * 4 | 0) % 2) L(ctx, 'FUERA DE PISTA', cx, 84, '#ff5a5a', 1, 0.5);
  };
})(window.GC);
