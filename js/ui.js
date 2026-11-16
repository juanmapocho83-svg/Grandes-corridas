/* Menús, entrada (teclado, táctil, mando) y bucle principal */
(function (GC) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), canvas = $('c'), ctx = canvas.getContext('2d'), W = 356, H = GC.H;
  var race = null, mode = 'menu', paused = false, champ = null, savedChamp = null, isChamp = false;
  var raw = { left: 0, right: 0, gas: 0, brake: 0, clutch: 0, pad: null };
  var inp = GC.input = { steer: 0, gas: 0, brake: 0, clutch: 0, up: false, down: false };
  var touchMode = false, store = GC.store, noop = function () { };
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  GC.reduceMotion = !!(mq && mq.matches);

  function load(k, d) { try { return JSON.parse(store.get(k)) || d; } catch (e) { return d; } }
  function save(k, v) { store.set(k, JSON.stringify(v)); }

  var TRANS = [{ id: 'auto', name: 'Automática' }, { id: 'manual', name: 'Manual secuencial' }, { id: 'clutch', name: 'Manual + embrague' }];
  var RIVALS = [3, 5, 9, 13, 19], LAPS = [1, 2, 3, 5, 8, 10];
  var cfg = Object.assign({ cat: 0, team: 0, track: 0, weather: 0, tyre: 0, laps: 3, rivals: 9, diff: 1, trans: 0, sound: true }, load('gc_cfg', {}));
  function idx(v, n, d) { return (v | 0) === v && v >= 0 && v < n ? v : d; }
  function sanitize() {
    cfg.cat = idx(cfg.cat, GC.CATEGORIES.length, 0); cfg.team = idx(cfg.team, GC.TEAMS.length, 0);
    cfg.track = idx(cfg.track, GC.TRACKS.length, 0); cfg.weather = idx(cfg.weather, GC.WEATHERS.length, 0);
    cfg.tyre = idx(cfg.tyre, GC.TYRES.length, 0); cfg.diff = idx(cfg.diff, GC.DIFFICULTIES.length, 1);
    cfg.trans = idx(cfg.trans, TRANS.length, 0);
    if (LAPS.indexOf(cfg.laps) < 0) cfg.laps = 3;
    if (RIVALS.indexOf(cfg.rivals) < 0) cfg.rivals = 9;
    cfg.sound = cfg.sound !== false;
  }
  sanitize();
  GC.audio.on = cfg.sound;

  function validChamp(c) {
    if (!c || typeof c !== 'object' || typeof c.pts !== 'object' || typeof c.team !== 'object' || !c.pts || !c.team) return null;
    if (idx(c.round, GC.TRACKS.length + 1, -1) < 0 || idx(c.cat, GC.CATEGORIES.length, -1) < 0 || idx(c.teamIdx, GC.TEAMS.length, -1) < 0 ||
      idx(c.diff, GC.DIFFICULTIES.length, -1) < 0 || RIVALS.indexOf(c.rivals) < 0 || LAPS.indexOf(c.laps) < 0) return null;
    return c;
  }

  /* ---------- pantallas ---------- */
  var screens = ['sMenu', 'sSetup', 'sChamp', 'sResults', 'sPause', 'sHelp'];
  function show(id, focus) {
    screens.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    var playing = !id && mode === 'race';
    $('touch').classList.toggle('hidden', !(playing && touchMode));
    $('bPause').classList.toggle('hidden', !playing);
    if (playing) {
      var t = TRANS[cfg.trans].id;
      $('bUp').classList.toggle('hidden', t === 'auto'); $('bDown').classList.toggle('hidden', t === 'auto');
      $('bClutch').classList.toggle('hidden', t !== 'clutch');
    }
    if (id && focus && !touchMode) {
      var b = $(id).querySelector('.primary') || $(id).querySelector('button');
      if (b) try { b.focus({ preventScroll: true }); } catch (e) { }
    } else if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
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

  function rowLocked(row) { return !!(isChamp && (row.k === 'track' || (row.lock && champ && champ.round > 0))); }
  function step(row, d) {
    if (rowLocked(row)) return;
    if (row.list) { var i = row.list.indexOf(cfg[row.k]); if (i < 0) i = 0; cfg[row.k] = row.list[(i + d + row.list.length) % row.list.length]; }
    else cfg[row.k] = (cfg[row.k] + d + row.n()) % row.n();
    save('gc_cfg', cfg); renderSetup();
  }
  function buildRows() {
    var el = $('rows');
    ROWS.forEach(function (row) {
      var d = document.createElement('div'); d.className = 'row'; d.id = 'row-' + row.k;
      d.innerHTML = '<span class="lab">' + row.label + '</span><button id="prev-' + row.k + '" aria-label="' + row.label + ': anterior">◀</button>' +
        '<span class="val" id="val-' + row.k + '"></span><button id="next-' + row.k + '" aria-label="' + row.label + ': siguiente">▶</button>';
      el.appendChild(d);
      $('prev-' + row.k).onclick = function () { step(row, -1); };
      $('next-' + row.k).onclick = function () { step(row, 1); };
    });
  }
  function stat(label, v, lo, hi) {
    var p = Math.round(100 * Math.max(0.04, Math.min(1, (v - lo) / (hi - lo))));
    return '<div class="stat"><span>' + label + '</span><span class="barbg"><span class="bar" style="width:' + p + '%"></span></span></div>';
  }

  function renderSetup() {
    if (isChamp && champ) cfg.track = champ.round % GC.TRACKS.length;
    $('setupTitle').textContent = isChamp ? 'Campeonato · Fecha ' + ((champ ? champ.round : 0) + 1) + ' de ' + GC.TRACKS.length : 'Carrera rápida';
    ROWS.forEach(function (row) {
      var locked = rowLocked(row);
      $('row-' + row.k).classList.toggle('locked', locked);
      $('prev-' + row.k).disabled = locked; $('next-' + row.k).disabled = locked;
      $('val-' + row.k).textContent = row.list ? cfg[row.k] : row.v(cfg[row.k]);
    });
    // vista previa
    var cat = GC.CATEGORIES[cfg.cat], team = GC.TEAMS[cfg.team], tr = GC.getTrack(GC.TRACKS[cfg.track]);
    var pc = $('pvCar'), px = pc.getContext('2d'), spr = GC.carSprite(cat.type, team.c1, team.c2).base;
    px.clearRect(0, 0, 50, 30); px.drawImage(spr, Math.round((50 - spr.width) / 2), 30 - spr.height);
    $('pvStats').innerHTML = '<div>' + cat.desc + '</div><div class="muted">Máxima ' + Math.round(cat.top * team.vel) + ' km/h</div>' +
      stat('VEL', cat.top * team.vel, 200, 360) + stat('ACE', cat.acc * team.acc, 4, 15) + stat('AGA', cat.mu * team.grip, 1, 2);
    var tc = $('pvTrack'), tx = tc.getContext('2d'), b = tr.bounds, sc = 58 / Math.max(b[2] - b[0], b[3] - b[1]);
    tx.clearRect(0, 0, 64, 64); tx.fillStyle = '#fff';
    var ox = 3 + (58 - (b[2] - b[0]) * sc) / 2, oy = 3 + (58 - (b[3] - b[1]) * sc) / 2;
    for (var i = 0; i < tr.pts.length; i++) tx.fillRect(Math.round(ox + (tr.pts[i][0] - b[0]) * sc), Math.round(oy + (tr.pts[i][1] - b[1]) * sc), 1, 1);
    tx.fillStyle = '#ff3030'; tx.fillRect(Math.round(ox + (tr.pts[0][0] - b[0]) * sc) - 1, Math.round(oy + (tr.pts[0][1] - b[1]) * sc) - 1, 3, 3);
    var rec = parseFloat(store.get('gc_best_' + tr.def.id + '_' + cat.id));
    $('pvInfo').innerHTML = '<div>' + tr.def.name + '</div><div class="muted">' + tr.def.country + ' · ' + (tr.L / 1000).toFixed(3) + ' km</div>' +
      '<div class="muted">' + (rec ? 'Tu récord ' + GC.fmtTime(rec) : 'Sin récord todavía') + '</div>';
  }

  /* ---------- carrera ---------- */
  function raceCfg(auto) {
    return {
      cat: cfg.cat, team: cfg.team, track: cfg.track, weather: cfg.weather, laps: cfg.laps, diff: cfg.diff, rivals: cfg.rivals,
      trans: auto ? 'auto' : TRANS[cfg.trans].id, tyre: GC.TYRES[cfg.tyre].id, auto: !!auto
    };
  }
  function resetInput() {
    raw.left = raw.right = raw.gas = raw.brake = raw.clutch = 0; raw.pad = null;
    inp.steer = inp.gas = inp.brake = inp.clutch = 0; inp.up = inp.down = false;
  }
  function startDemo() {
    var c = raceCfg(true);
    c.track = Math.floor(Math.random() * GC.TRACKS.length); c.cat = Math.floor(Math.random() * GC.CATEGORIES.length);
    c.weather = Math.floor(Math.random() * 3); c.laps = 99; c.rivals = 9;
    race = new GC.Race(c, null); race.cd = race.goAt; mode = 'menu';
    if (GC.reduceMotion) for (var i = 0; i < 600; i++) race.update(1 / 60, idle);   // cuadro fijo, ya en carrera
  }
  function startRace() {
    GC.audio.init(); resetInput();
    race = new GC.Race(raceCfg(false), onFinish);
    mode = 'race'; paused = false; show(null);
  }

  function chip(team) { return '<span class="chip" style="background:' + team.c1 + '"></span>'; }

  function onFinish(res) {
    mode = 'results'; GC.audio.silence(); resetInput();
    var me = res.filter(function (r) { return r.isPlayer; })[0];
    if (isChamp) {
      res.forEach(function (r) {
        champ.pts[r.name] = (champ.pts[r.name] || 0) + (GC.POINTS[r.pos - 1] || 0); champ.team[r.name] = r.team.id;
      });
      champ.round++; save('gc_champ', champ);
    }
    $('resTitle').textContent = (me.pos === 1 ? '¡Victoria!' : 'Llegaste ' + me.pos + '.º') + ' · ' + GC.TRACKS[race.cfg.track].name;
    var h = '<table><tr><th class="num">#</th><th>Piloto</th><th class="wide">Equipo</th><th class="num">Tiempo</th><th class="num">Mejor</th>' +
      (isChamp ? '<th class="num">Pts</th>' : '') + '</tr>', t0 = res[0].time;
    res.forEach(function (r) {
      var t = r.time == null ? '+' + Math.round(r.gapM) + ' m' : r.pos === 1 ? GC.fmtTime(r.time) : '+' + (r.time - t0).toFixed(2);
      h += '<tr' + (r.isPlayer ? ' class="me"' : '') + '><td class="num">' + r.pos + '</td><td>' + chip(r.team) + r.name + '</td><td class="wide">' + r.team.name +
        '</td><td class="num">' + t + '</td><td class="num">' + GC.fmtTime(r.best) + '</td>' + (isChamp ? '<td class="num">' + (GC.POINTS[r.pos - 1] || 0) + '</td>' : '') + '</tr>';
    });
    $('resTables').innerHTML = h + '</table>';
    $('resBtns').innerHTML = isChamp ? '<button id="btnStand" data-act="standings" class="primary">Clasificación</button>' :
      '<button id="btnResMenu" data-act="menu">Menú</button><button id="btnResSetup" data-act="setup">Cambiar</button><button id="btnAgain" data-act="again" class="primary">Repetir</button>';
    show('sResults');
  }

  function standings() {
    var names = Object.keys(champ.pts).sort(function (a, b) { return champ.pts[b] - champ.pts[a]; });
    var tp = {}, over = champ.round >= GC.TRACKS.length;
    names.forEach(function (n) { tp[champ.team[n]] = (tp[champ.team[n]] || 0) + champ.pts[n]; });
    var teamOf = function (id) { return GC.TEAMS.filter(function (t) { return t.id === id; })[0] || GC.TEAMS[0]; };
    var tids = Object.keys(tp).sort(function (a, b) { return tp[b] - tp[a]; });
    var h = '<table><tr><th class="num">#</th><th>Piloto</th><th class="num">Pts</th></tr>';
    names.forEach(function (n, i) {
      h += '<tr' + (n === 'JUGADOR' ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + chip(teamOf(champ.team[n])) + n + '</td><td class="num">' + champ.pts[n] + '</td></tr>';
    });
    h += '</table><table><tr><th class="num">#</th><th>Equipo</th><th class="num">Pts</th></tr>';
    tids.forEach(function (id, i) {
      var t = teamOf(id);
      h += '<tr' + (t === GC.TEAMS[champ.teamIdx] ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td>' + chip(t) + t.name + '</td><td class="num">' + tp[id] + '</td></tr>';
    });
    $('resTitle').textContent = over ? (names[0] === 'JUGADOR' ? '¡Saliste campeón!' : 'Campeón: ' + names[0]) :
      'Clasificación · ' + champ.round + ' de ' + GC.TRACKS.length + ' fechas';
    $('resTables').innerHTML = h + '</table>';
    $('resBtns').innerHTML = over ? '<button id="btnEndChamp" data-act="endchamp" class="primary">Terminar</button>' :
      '<button id="btnStMenu" data-act="menu">Menú</button><button id="btnNext" data-act="next" class="primary">Siguiente fecha</button>';
  }

  function newChamp() { isChamp = true; champ = { round: 0, pts: {}, team: {} }; renderSetup(); show('sSetup', true); }
  function toMenu() { GC.audio.silence(); startDemo(); show('sMenu', true); }
  function pause(on) {
    if (mode !== 'race') return;
    paused = on; resetInput();
    if (on) GC.audio.silence();
    show(on ? 'sPause' : null);
  }

  var fsEl = document.documentElement;
  if (!fsEl.requestFullscreen || document.fullscreenEnabled === false) $('btnFull').classList.add('hidden');
  function lockLandscape() {
    try { var o = window.screen && screen.orientation; if (o && o.lock) { var l = o.lock('landscape'); if (l && l.catch) l.catch(noop); } } catch (e) { }
  }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) { var x = document.exitFullscreen(); if (x && x.catch) x.catch(noop); }
      else { var pr = fsEl.requestFullscreen(); if (pr && pr.then) pr.then(lockLandscape).catch(noop); }
    } catch (e) { }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return;
    GC.audio.init();
    switch (b.dataset.act) {
      case 'quick': isChamp = false; renderSetup(); show('sSetup', true); break;
      case 'champ':
        savedChamp = validChamp(load('gc_champ', null));
        if (savedChamp && savedChamp.round > 0 && savedChamp.round < GC.TRACKS.length) {
          $('champInfo').textContent = GC.CATEGORIES[savedChamp.cat].name + ' con ' + GC.TEAMS[savedChamp.teamIdx].name + '. Próxima fecha: ' +
            (savedChamp.round + 1) + ' de ' + GC.TRACKS.length + ', ' + GC.TRACKS[savedChamp.round].name + '.';
          show('sChamp', true);
        } else newChamp();
        break;
      case 'champcont':
        champ = savedChamp; isChamp = true;
        cfg.cat = champ.cat; cfg.team = champ.teamIdx; cfg.diff = champ.diff; cfg.rivals = champ.rivals; cfg.laps = champ.laps;
        renderSetup(); show('sSetup', true); break;
      case 'champnew': newChamp(); break;
      case 'help': show('sHelp', true); break;
      case 'sound': cfg.sound = !cfg.sound; GC.audio.setOn(cfg.sound); save('gc_cfg', cfg); b.textContent = 'Sonido: ' + (cfg.sound ? 'sí' : 'no'); break;
      case 'full': toggleFullscreen(); break;
      case 'back': show('sMenu', true); break;
      case 'go':
        if (isChamp && champ.round === 0) { champ.cat = cfg.cat; champ.teamIdx = cfg.team; champ.diff = cfg.diff; champ.rivals = cfg.rivals; champ.laps = cfg.laps; }
        startRace(); break;
      case 'again': startRace(); break;
      case 'setup': case 'next': mode = 'menu'; startDemo(); renderSetup(); show('sSetup', true); break;
      case 'menu': toMenu(); break;
      case 'standings': standings(); break;
      case 'endchamp': store.del('gc_champ'); champ = null; isChamp = false; toMenu(); break;
      case 'resume': pause(false); break;
      case 'restart': startRace(); break;
      case 'quit': toMenu(); break;
    }
  });
  $('btnSound').textContent = 'Sonido: ' + (cfg.sound ? 'sí' : 'no');
  $('bPause').addEventListener('click', function () { pause(true); });

  /* ---------- entrada ---------- */
  var KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
    Space: 'brake', ShiftLeft: 'clutch', ShiftRight: 'clutch', KeyC: 'clutch'
  };
  window.addEventListener('keydown', function (e) {
    if (mode === 'race') {
      var k = KEYS[e.code];
      if (k) { raw[k] = 1; e.preventDefault(); }
      else if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyX')) inp.up = true;
      else if (!e.repeat && (e.code === 'KeyQ' || e.code === 'KeyZ')) inp.down = true;
      else if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) pause(!paused);
      return;
    }
    // en la preparación: flechas para cambiar valores y moverse entre filas
    var row = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.row') : null;
    if (!row || $('sSetup').classList.contains('hidden')) return;
    var key = row.id.slice(4), next = document.activeElement.id.indexOf('next-') === 0;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault(); var btn = $((e.code === 'ArrowLeft' ? 'prev-' : 'next-') + key);
      if (!btn.disabled) { btn.focus(); btn.click(); }
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      var sib = row;
      do { sib = e.code === 'ArrowUp' ? sib.previousElementSibling : sib.nextElementSibling; } while (sib && sib.classList.contains('locked'));
      if (sib) $((next ? 'next-' : 'prev-') + sib.id.slice(4)).focus();
    }
  });
  window.addEventListener('keyup', function (e) { var k = KEYS[e.code]; if (k) raw[k] = 0; });
  window.addEventListener('blur', function () { if (mode === 'race' && !paused && race && race.state === 'racing') pause(true); else resetInput(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    if (mode === 'race' && !paused) pause(true); else GC.audio.silence();
  });

  // pedales y marchas
  Array.prototype.forEach.call(document.querySelectorAll('button.tb'), function (b) {
    var k = b.dataset.k;
    function down(e) {
      e.preventDefault(); GC.audio.init(); b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch (x) { }
      if (k === 'up') inp.up = true; else if (k === 'down') inp.down = true; else raw[k] = 1;
    }
    function up(e) { e.preventDefault(); b.classList.remove('on'); if (k !== 'up' && k !== 'down') raw[k] = 0; }
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  // volante: la posición del pulgar dentro del panel da el ángulo
  var pad = $('bSteer'), padId = null;
  function padMove(e) {
    var r = pad.getBoundingClientRect(), v = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.3);
    v = v > 1 ? 1 : v < -1 ? -1 : v; if (Math.abs(v) < 0.12) v = 0;
    raw.pad = v;
    $('stL').classList.toggle('on', v < 0); $('stR').classList.toggle('on', v > 0);
  }
  function padUp(e) {
    if (e.pointerId !== padId) return;
    padId = null; raw.pad = null; pad.classList.remove('on'); $('stL').classList.remove('on'); $('stR').classList.remove('on');
  }
  pad.addEventListener('pointerdown', function (e) {
    e.preventDefault(); GC.audio.init(); padId = e.pointerId; pad.classList.add('on');
    try { pad.setPointerCapture(e.pointerId); } catch (x) { }
    padMove(e);
  });
  pad.addEventListener('pointermove', function (e) { if (e.pointerId === padId) { e.preventDefault(); padMove(e); } });
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function setTouch() { if (touchMode) return; touchMode = true; resize(); if (mode === 'race' && !paused) show(null); }
  window.addEventListener('touchstart', setTouch, { passive: true });
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) touchMode = true;

  var padPrev = {}, padOk = true;
  function pollPad() {
    if (!padOk || !navigator.getGamepads) return null;
    var pads, g = null;
    try { pads = navigator.getGamepads(); } catch (e) { padOk = false; return null; }   // bloqueado en algunos marcos
    if (!pads) return null;
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
    var gp = pollPad();
    var st = raw.pad != null ? raw.pad : raw.right - raw.left, gas = raw.gas, br = raw.brake, cl = raw.clutch;
    if (gp) { if (gp.steer) st = gp.steer; gas = Math.max(gas, gp.gas); br = Math.max(br, gp.brake); cl = Math.max(cl, gp.clutch); }
    var rate = st === 0 ? 7 : (st > 0) !== (inp.steer > 0) && inp.steer !== 0 ? 9 : 3.8;
    inp.steer = toward(inp.steer, st, rate, rate, dt);
    inp.gas = toward(inp.gas, gas, 5, 9, dt); inp.brake = toward(inp.brake, br, 6, 12, dt); inp.clutch = toward(inp.clutch, cl, 12, 12, dt);
  }

  /* ---------- bucle ---------- */
  function resize() {
    var vw = view.clientWidth, vh = view.clientHeight;
    if (!vw || !vh) return;
    var portrait = vh > vw * 1.1;
    var aspect = portrait ? 1.3 : Math.max(1.2, Math.min(2.4, vw / vh));
    W = Math.round(H * aspect);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    var sc = Math.min(vw / W, vh / H), cw = Math.floor(W * sc), ch = Math.floor(H * sc);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.style.left = Math.floor((vw - cw) / 2) + 'px';
    canvas.style.top = (portrait && touchMode ? 0 : Math.floor((vh - ch) / 2)) + 'px';
    ctx.imageSmoothingEnabled = false;
    if (race) race.render(ctx, W);
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(view);

  var last = 0, acc = 0, STEP = 1 / 60, idle = { steer: 0, gas: 0, brake: 0, clutch: 0, up: false, down: false };
  function frame(t) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, (t - last) / 1000 || 0); last = t;
    if (!race) return;
    var live = mode === 'race' ? !paused : mode === 'menu' && !GC.reduceMotion;
    if (live) {
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
  buildRows(); resize(); startDemo(); show('sMenu'); requestAnimationFrame(frame);
})(window.GC);
