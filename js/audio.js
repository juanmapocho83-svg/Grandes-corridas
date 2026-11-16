/* Sonido sintetizado con WebAudio: motor, derrape, lluvia y efectos */
(function (GC) {
  'use strict';
  var A = { ctx: null, on: true };
  GC.audio = A;

  function noiseBuf(ctx) {
    var b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function noise(ctx, type, freq, q) {
    var s = ctx.createBufferSource(); s.buffer = A.nb; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(A.master); s.start();
    return g;
  }

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var c = A.ctx = new AC();
      A.master = c.createGain(); A.master.gain.value = A.on ? 0.6 : 0; A.master.connect(c.destination);
      A.nb = noiseBuf(c);
      A.o1 = c.createOscillator(); A.o1.type = 'sawtooth';
      A.o2 = c.createOscillator(); A.o2.type = 'square';
      A.lp = c.createBiquadFilter(); A.lp.type = 'lowpass'; A.lp.frequency.value = 800;
      A.eg = c.createGain(); A.eg.gain.value = 0;
      var g2 = c.createGain(); g2.gain.value = 0.5;
      A.o1.connect(A.lp); A.o2.connect(g2); g2.connect(A.lp); A.lp.connect(A.eg); A.eg.connect(A.master);
      A.o1.start(); A.o2.start();
      A.skidG = noise(c, 'bandpass', 1900, 4);
      A.rainG = noise(c, 'highpass', 3500, 0.5);
      A.windG = noise(c, 'lowpass', 500, 0.5);
    } catch (e) { A.ctx = null; }
  };
  A.setOn = function (on) { A.on = on; if (A.master) A.master.gain.value = on ? 0.6 : 0; };

  function set(p, v) { p.setTargetAtTime(v, A.ctx.currentTime, 0.03); }
  // r: rpm 0..1 · gas 0..1 · snd: [frecuencia base, rango]
  A.engine = function (r, gas, snd, alive) {
    if (!A.ctx) return;
    var f = snd[0] + snd[1] * r;
    set(A.o1.frequency, f); set(A.o2.frequency, f / 2);
    set(A.lp.frequency, 500 + 2600 * r * (0.5 + gas * 0.5));
    set(A.eg.gain, alive ? 0.07 + 0.1 * gas + 0.04 * r : 0);
  };
  A.ambient = function (skid, rain, wind) {
    if (!A.ctx) return;
    set(A.skidG.gain, skid * 0.25); set(A.rainG.gain, rain * 0.12); set(A.windG.gain, wind * 0.25);
  };
  A.silence = function () { if (A.ctx) { A.engine(0, 0, [60, 0], false); A.ambient(0, 0, 0); } };
  A.beep = function (freq, dur, type, vol) {
    if (!A.ctx) return;
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.value = vol || 0.15; g.gain.setTargetAtTime(0, c.currentTime + dur, 0.03);
    o.connect(g); g.connect(A.master); o.start(); o.stop(c.currentTime + dur + 0.2);
  };
  A.thud = function () { A.beep(70, 0.12, 'sawtooth', 0.35); };
  A.thunder = function () {
    if (!A.ctx) return;
    var g = A.windG.gain, t = A.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(0.9, t + 0.15); g.setTargetAtTime(0.1, t + 0.3, 0.6);
  };
})(window.GC);
