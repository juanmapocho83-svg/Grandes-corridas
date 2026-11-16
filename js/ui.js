/* Menús, entrada (teclado, táctil, mando) y bucle principal */
(function (GC) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('c'), ctx = canvas.getContext('2d'), W = 356, H = GC.H;
  var race = null, mode = 'menu', paused = false, champ = null, isChamp = false;
  var raw = { left: 0, right: 0, gas: 0, brake: 0, clutch: 0 };
  var inp = GC.input = { steer: 0, gas: 0, brake: 0, clutch: 0, up: false, down: false };
  var touchMode = false;

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  var cfg = Object.assign({ cat: 0, team: 0, track: 0, weather: 0, tyre: 0, laps: 3, rivals: 9, diff: 1, trans: 0, sound: true }, load('gc_cfg', {}));
  var TRANS = [{ id: 'auto', name: 'Automática' }, { id: 'manual', name: 'Manual secuencial' }, { id: 'clutch', name: 'Manual + embrague' }];
  var RIVALS = [3, 5, 9, 13, 19], LAPS = [1, 2, 3, 5, 8, 10];
  GC.audio.on = cfg.sound;

  /* ---------- pantallas ---------- */
  var screens = ['sMenu', 'sSetup', 'sResults', 'sPause', 'sHelp'];
  function show(id) {
    screens.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    var playing = !id && mode === 'race';
    $('touch').classList.toggle('hidden', !(playing && touchMode));
    $('bPause').classList.toggle('hidden', !playing);
    if (playing) {
      var t = TRANS[cfg.trans].id;
      $('bUp').classList.toggle('hidden', t === 'auto'); $('bDown').classList.toggle('hidden', t === 'auto');
      $('bClutch').classList.toggle('hidden', t !== 'clutch');
    }
  }

  var ROWS = [
    { k: 'cat', label: 'Categoría', n: function () { return GC.CATEGORIES.length; }, v: function (i) { return GC.CATEGORIES[i].name; }, lock: true },
    { k: 'team', label: 'Equipo', n: function () { return GC.TEAMS.length; }, v: function (i) { return GC.TEAMS[i].name; }, lock: true },
    { k: 'track', label: 'Pista', n: function () { return GC.TRACKS.length; }, v: function (i) { return GC.TRACKS[i].name; }, lock: true },
    { k: 'weather', label: 'Clima', n: function () { return GC.WEATHERS.length; }, v: function (i) { return GC.WEATHERS[i].name; } },
    { k: 'tyre', label: 'Neumáticos', n: function () { return GC.TYRES.length; }, v: function (i) { return GC.TYRES[i].name; } },
    { k: 'laps', label: 'Vueltas', list: LAPS, lock: true },
    { k: 'rivals', label: 'Rivales', list: RIVALS, lock: true },
    { k: 'diff', label: 'Dificultad', n: function () { return GC.DIFFICULTIES.length; }, v: function (i) { return GC.DIFFICULTIES[i].name; }, lock: true },
    { k: 'trans', label: 'Transmisión', n: function () { return TRANS.length; }, v: function (i) { return TRANS[i].name; } }
  ];

  function step(row, d) {
    if (row.list) { var i = row.list.indexOf(cfg[row.k]); if (i < 0) i = 0; cfg[row.k] = row.list[(i + d + row.list.length) % row.list.length]; }
    else cfg[row.k] = (cfg[row.k] + d + row.n()) % row.n();
    save('gc_cfg', cfg); renderSetup();
  }
  function bar(v, lo, hi) { return '<span class="barbg"><span class="bar" style="width:' + Math.round(100 * (v - lo) / (hi - lo)) + '%"></span></span>'; }

  function renderSetup() {
    var locked = isChamp && champ && champ.round > 0, el = $('rows');
    if (isChamp && champ) { cfg.track = champ.round % GC.TRACKS.length; }
    $('setupTitle').textContent = isChamp ? 'Campeonato · Fecha ' + ((champ ? champ.round : 0) + 1) + '/' + GC.TRACKS.length : 'Carrera rápida';
    el.innerHTML = '';
    ROWS.forEach(function (row) {
      var d = document.createElement('div'); d.className = 'row';
      if (isChamp && (row.k === 'track' || (locked && row.lock))) d.className += ' locked';
      var val = row.list ? cfg[row.k] : row.v(cfg[row.k]);
      d.innerHTML = '<label>' + row.label + '</label><button>◀</button><div class="val">' + val + '</div><button>▶</button>';
      var b = d.querySelectorAll('button');
      b[0].onclick = function () { step(row, -1); }; b[1].onclick = function () { step(row, 1); };
      el.appendChild(d);
    });
    // vista previa
    var cat = GC.CATEGORIES[cfg.cat], team = GC.TEAMS[cfg.team], tr = GC.getTrack(GC.TRACKS[cfg.track]);
    var pc = $('pvCar'), px = pc.getContext('2d'), spr = GC.carSprite(cat.type, team.c1, team.c2).base;
    px.clearRect(0, 0, 50, 30); px.drawImage(spr, Math.round((50 - spr.width) / 2), 30 - spr.height);
    $('pvStats').innerHTML = cat.desc + '<br>Vel. máx. ' + Math.round(cat.top * team.vel) + ' km/h<br>' +
      'VEL ' + bar(cat.top * team.vel, 200, 360) + '<br>ACE ' + bar(cat.acc * team.acc, 4, 15) + '<br>AGA ' + bar(cat.mu * team.grip, 1, 2);
    var tc = $('pvTrack'), tx = tc.getContext('2d'), b = tr.bounds, sc = 58 / Math.max(b[2] - b[0], b[3] - b[1]);
    tx.clearRect(0, 0, 64, 64); tx.fillStyle = '#fff';
    var ox = 3 + (58 - (b[2] - b[0]) * sc) / 2, oy = 3 + (58 - (b[3] - b[1]) * sc) / 2;
    for (var i = 0; i < tr.pts.length; i++) tx.fillRect(Math.round(ox + (tr.pts[i][0] - b[0]) * sc), Math.round(oy + (tr.pts[i][1] - b[1]) * sc), 1, 1);
    tx.fillStyle = '#ff3030'; tx.fillRect(Math.round(ox + (tr.pts[0][0] - b[0]) * sc) - 1, Math.round(oy + (tr.pts[0][1] - b[1]) * sc) - 1, 3, 3);
    var rec = parseFloat(localStorage.getItem('gc_best_' + tr.def.id + '_' + cat.id));
    $('pvInfo').innerHTML = tr.def.name + ' · ' + tr.def.country + '<br>' + (tr.L / 1000).toFixed(3) + ' km' + (rec ? '<br>Récord ' + GC.fmtTime(rec) : '');
  }

  /* ---------- carrera ---------- */
  function raceCfg(auto) {
    return { cat: cfg.cat, team: cfg.team, track: cfg.track, weather: cfg.weather, laps: cfg.laps, diff: cfg.diff, rivals: cfg.rivals,
      trans: auto ? 'auto' : TRANS[cfg.trans].id, tyre: GC.TYRES[cfg.tyre].id, auto: !!auto };
  }
  function startDemo() {
    var c = raceCfg(true); c.track = Math.floor(Math.random() * GC.TRACKS.length); c.cat = Math.floor(Math.random() * GC.CATEGORIES.length);
    c.weather = Math.floor(Math.random() * 3); c.laps = 99; c.rivals = 9;
    race = new GC.Race(c, null); race.cd = race.goAt; mode = 'menu';
  }
  function startRace() {
    GC.audio.init();
    inp.steer = inp.gas = inp.brake = inp.clutch = 0; inp.up = inp.down = false;
    race = new GC.Race(raceCfg(false), onFinish);
    mode = 'race'; paused = false; show(null);
  }

  function onFinish(res) {
    mode = 'results'; GC.audio.silence();
    var me = res.filter(function (r) { return r.isPlayer; })[0];
    if (isChamp) {
      res.forEach(function (r) {
        var pts = GC.POINTS[r.pos - 1] || 0;
        champ.pts[r.name] = (champ.pts[r.name] || 0) + pts; champ.team[r.name] = r.team.id;
      });
      champ.round++; save('gc_champ', champ);
    }
    $('resTitle').textContent = (me.pos === 1 ? '¡Victoria! ' : 'Llegaste ' + me.pos + 'º · ') + GC.TRACKS[race.cfg.track].name;
    var h = '<tr><th>#</th><th>Piloto</th><th>Equipo</th><th>Tiempo</th><th>Mejor</th>' + (isChamp ? '<th>Pts</th>' : '') + '</tr>', t0 = res[0].time;
    res.forEach(function (r) {
      var t = r.time == null ? '+' + Math.round(r.gapM) + ' m' : r.pos === 1 ? GC.fmtTime(r.time) : '+' + (r.time - t0).toFixed(2);
      h += '<tr class="' + (r.isPlayer ? 'me' : '') + '"><td>' + r.pos + '</td><td>' + r.name + '</td><td><span class="chip" style="background:' + r.team.c1 +
        '"></span>' + r.team.name + '</td><td>' + t + '</td><td>' + GC.fmtTime(r.best) + '</td>' + (isChamp ? '<td>' + (GC.POINTS[r.pos - 1] || 0) + '</td>' : '') + '</tr>';
    });
    $('resTable').innerHTML = h;
    $('resBtns').innerHTML = isChamp ? '<button data-act="standings" class="primary">Clasificación</button>' :
      '<button data-act="menu">Menú</button><button data-act="setup">Cambiar</button><button data-act="again" class="primary">Repetir</button>';
    show('sResults');
  }

  function standings() {
    var names = Object.keys(champ.pts).sort(function (a, b) { return champ.pts[b] - champ.pts[a]; });
    var tp = {}, over = champ.round >= GC.TRACKS.length;
    names.forEach(function (n) { tp[champ.team[n]] = (tp[champ.team[n]] || 0) + champ.pts[n]; });
    var teamOf = function (id) { return GC.TEAMS.filter(function (t) { return t.id === id; })[0]; };
    var h = '<tr><th>#</th><th>Piloto</th><th>Pts</th><th></th><th>#</th><th>Equipo</th><th>Pts</th></tr>';
    var tids = Object.keys(tp).sort(function (a, b) { return tp[b] - tp[a]; });
    names.forEach(function (n, i) {
      var t = tids[i] ? teamOf(tids[i]) : null;
      h += '<tr class="' + (n === 'JUGADOR' ? 'me' : '') + '"><td>' + (i + 1) + '</td><td><span class="chip" style="background:' + teamOf(champ.team[n]).c1 + '"></span>' + n +
        '</td><td>' + champ.pts[n] + '</td><td></td>' + (t ? '<td>' + (i + 1) + '</td><td><span class="chip" style="background:' + t.c1 + '"></span>' + t.name + '</td><td>' + tp[t.id] + '</td>' : '<td></td><td></td><td></td>') + '</tr>';
    });
    $('resTitle').textContent = over ? (names[0] === 'JUGADOR' ? '¡Campeón del mundo!' : 'Campeón: ' + names[0]) : 'Clasificación · tras ' + champ.round + ' de ' + GC.TRACKS.length;
    $('resTable').innerHTML = h;
    $('resBtns').innerHTML = over ? '<button data-act="endchamp" class="primary">Terminar</button>' :
      '<button data-act="menu">Menú</button><button data-act="next" class="primary">Siguiente fecha</button>';
  }

  function toMenu() { GC.audio.silence(); startDemo(); show('sMenu'); }
  function pause(on) {
    if (mode !== 'race') return;
    paused = on; if (on) GC.audio.silence();
    show(on ? 'sPause' : null);
  }

  var helpFrom = 'sMenu';
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    GC.audio.init();
    switch (b.dataset.act) {
      case 'quick': isChamp = false; renderSetup(); show('sSetup'); break;
      case 'champ':
        isChamp = true; champ = load('gc_champ', null);
        if (champ && champ.round > 0 && champ.round < GC.TRACKS.length && confirm('¿Continuar el campeonato en curso? (Cancelar = empezar uno nuevo)')) {
          cfg.cat = champ.cat; cfg.team = champ.teamIdx; cfg.diff = champ.diff; cfg.rivals = champ.rivals; cfg.laps = champ.laps;
        } else champ = { round: 0, pts: {}, team: {} };
        renderSetup(); show('sSetup'); break;
      case 'help': show('sHelp'); break;
      case 'sound': cfg.sound = !cfg.sound; GC.audio.setOn(cfg.sound); save('gc_cfg', cfg); b.textContent = 'Sonido: ' + (cfg.sound ? 'sí' : 'no'); break;
      case 'full':
        var d = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().then(function () {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { });
        }).catch(function () { });
        break;
      case 'back': show('sMenu'); break;
      case 'go':
        if (isChamp && champ.round === 0) { champ.cat = cfg.cat; champ.teamIdx = cfg.team; champ.diff = cfg.diff; champ.rivals = cfg.rivals; champ.laps = cfg.laps; }
        startRace(); break;
      case 'again': startRace(); break;
      case 'setup': mode = 'menu'; startDemo(); renderSetup(); show('sSetup'); break;
      case 'menu': toMenu(); break;
      case 'standings': standings(); break;
      case 'next': mode = 'menu'; startDemo(); renderSetup(); show('sSetup'); break;
      case 'endchamp': localStorage.removeItem('gc_champ'); champ = null; isChamp = false; toMenu(); break;
      case 'resume': pause(false); break;
      case 'restart': startRace(); break;
      case 'quit': toMenu(); break;
    }
  });
  $('btnSound').textContent = 'Sonido: ' + (cfg.sound ? 'sí' : 'no');
  $('bPause').addEventListener('click', function () { pause(true); });

  /* ---------- entrada ---------- */
  var KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
    Space: 'brake', ShiftLeft: 'clutch', ShiftRight: 'clutch', KeyC: 'clutch' };
  window.addEventListener('keydown', function (e) {
    if (mode !== 'race') return;
    var k = KEYS[e.code];
    if (k) { raw[k] = 1; e.preventDefault(); }
    else if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyX')) inp.up = true;
    else if (!e.repeat && (e.code === 'KeyQ' || e.code === 'KeyZ')) inp.down = true;
    else if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) pause(!paused);
  });
  window.addEventListener('keyup', function (e) { var k = KEYS[e.code]; if (k) raw[k] = 0; });
  window.addEventListener('blur', function () { for (var k in raw) raw[k] = 0; if (mode === 'race' && !paused && race && race.state === 'racing') pause(true); });

  Array.prototype.forEach.call(document.querySelectorAll('.tb'), function (b) {
    var k = b.dataset.k;
    function down(e) {
      e.preventDefault(); GC.audio.init(); b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch (x) { }
      if (k === 'up') inp.up = true; else if (k === 'down') inp.down = true; else raw[k] = 1;
    }
    function up(e) { e.preventDefault(); b.classList.remove('on'); if (k in raw) raw[k] = 0; }
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  window.addEventListener('touchstart', function () { if (!touchMode) { touchMode = true; if (mode === 'race' && !paused) show(null); } }, { passive: true });
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) touchMode = true;

  var padPrev = {};
  function pollPad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], g = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; break; }
    if (!g) return null;
    var bt = function (i) { return g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0; };
    var edge = function (i) { var v = bt(i) > 0.5, was = padPrev[i]; padPrev[i] = v; return v && !was; };
    if (edge(0) || edge(5)) inp.up = true;
    if (edge(2) || edge(4)) inp.down = true;
    if (edge(9)) pause(!paused);
    var ax = g.axes[0] || 0; if (Math.abs(ax) < 0.12) ax = 0;
    if (bt(14)) ax = -1; if (bt(15)) ax = 1;
    return { steer: ax, gas: bt(7), brake: bt(6), clutch: bt(1) };
  }

  function toward(v, t, up, down, dt) { return v < t ? Math.min(t, v + up * dt) : Math.max(t, v - down * dt); }
  function readInput(dt) {
    var pad = pollPad();
    var st = raw.right - raw.left, gas = raw.gas, br = raw.brake, cl = raw.clutch;
    if (pad) { if (pad.steer) st = pad.steer; gas = Math.max(gas, pad.gas); br = Math.max(br, pad.brake); cl = Math.max(cl, pad.clutch); }
    var rate = st === 0 ? 7 : (st > 0) !== (inp.steer > 0) && inp.steer !== 0 ? 9 : 3.8;
    inp.steer = toward(inp.steer, st, rate, rate, dt);
    inp.gas = toward(inp.gas, gas, 5, 9, dt); inp.brake = toward(inp.brake, br, 6, 12, dt); inp.clutch = toward(inp.clutch, cl, 12, 12, dt);
  }

  /* ---------- bucle ---------- */
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw * 1.1;
    var aspect = portrait ? 1.45 : Math.max(1.2, Math.min(2.4, vw / vh));
    W = Math.round(H * aspect); canvas.width = W; canvas.height = H;
    var sc = Math.min(vw / W, vh / H), cw = Math.floor(W * sc), ch = Math.floor(H * sc);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.style.left = Math.floor((vw - cw) / 2) + 'px'; canvas.style.top = (portrait ? 0 : Math.floor((vh - ch) / 2)) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);

  var last = 0, acc = 0, STEP = 1 / 60, idle = { steer: 0, gas: 0, brake: 0, clutch: 0, up: false, down: false };
  function frame(t) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (t - last) / 1000 || 0); last = t;
    if (!race) return;
    if (!(mode === 'race' && paused) && mode !== 'results') {
      acc += dt;
      while (acc >= STEP) {
        if (mode === 'race') { readInput(STEP); race.update(STEP, inp); } else race.update(STEP, idle);
        acc -= STEP;
      }
      if (mode !== 'race') GC.audio.silence();
    }
    ctx.imageSmoothingEnabled = false;
    race.render(ctx, W);
  }

  GC.debug = { get race() { return race; }, cfg: cfg, start: startRace, raw: raw };
  resize(); startDemo(); show('sMenu'); requestAnimationFrame(frame);
})(window.GC);
