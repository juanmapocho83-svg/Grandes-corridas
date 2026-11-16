/* Grandes Corridas - datos del juego: categorías, equipos, pistas y climas */
window.GC = window.GC || {};
(function (GC) {
  'use strict';

  GC.SEG = 5;      // largo de cada segmento de pista (m)

  // Guardado local tolerante a fallos (modo privado, marcos incrustados, etc.)
  GC.store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { } }
  };
  GC.reduceMotion = false;
  GC.G = 9.81;

  // top: km/h · acc: aceleración máx. en 1ª (m/s²) · mu: agarre · df: carga aerodinámica
  GC.CATEGORIES = [
    { id: 'fa', name: 'Fórmula A', desc: 'Monoplaza élite · 8 marchas', type: 'formula', top: 340, acc: 14, mu: 1.9, df: 2.2e-4, brake: 1.15, gears: 8, rpm: 13000, w: 2.0, len: 5.2, shift: 0.07, snd: [75, 430] },
    { id: 'fb', name: 'Fórmula B', desc: 'Monoplaza intermedio · 6 marchas', type: 'formula', top: 300, acc: 10.5, mu: 1.7, df: 1.5e-4, brake: 1.1, gears: 6, rpm: 10500, w: 1.9, len: 5.0, shift: 0.1, snd: [70, 360] },
    { id: 'fc', name: 'Fórmula C', desc: 'Monoplaza escuela · 6 marchas', type: 'formula', top: 250, acc: 7.5, mu: 1.5, df: 1.0e-4, brake: 1.05, gears: 6, rpm: 8500, w: 1.8, len: 4.6, shift: 0.14, snd: [65, 300] },
    { id: 'gt', name: 'Gran Turismo', desc: 'Deportivo de resistencia · 6 marchas', type: 'gt', top: 285, acc: 8, mu: 1.4, df: 0.6e-4, brake: 1.05, gears: 6, rpm: 9000, w: 2.0, len: 4.8, shift: 0.14, snd: [50, 250] },
    { id: 'tu', name: 'Turismo', desc: 'Auto de calle preparado · 5 marchas', type: 'turismo', top: 235, acc: 5.8, mu: 1.15, df: 0.2e-4, brake: 1.0, gears: 5, rpm: 7500, w: 1.9, len: 4.5, shift: 0.22, snd: [45, 210] },
    { id: 'm1', name: 'Moto 1000', desc: 'Prototipo de 1000 cc · 6 marchas', type: 'moto', top: 345, acc: 12.5, mu: 1.45, df: 0, brake: 0.95, gears: 6, rpm: 17000, w: 0.9, len: 2.2, shift: 0.08, snd: [90, 520] },
    { id: 'm6', name: 'Moto 600', desc: 'Intermedia de 600 cc · 6 marchas', type: 'moto', top: 295, acc: 9, mu: 1.4, df: 0, brake: 0.95, gears: 6, rpm: 15000, w: 0.9, len: 2.1, shift: 0.1, snd: [85, 460] }
  ];

  // Equipos ficticios. vel/acc/grip son multiplicadores.
  GC.TEAMS = [
    { id: 'rosso', name: 'Rosso Fuoco', c1: '#d81e1e', c2: '#ffd21e', vel: 1.02, acc: 1.00, grip: 0.99 },
    { id: 'plata', name: 'Flecha de Plata', c1: '#b9c2c9', c2: '#19c7b0', vel: 1.01, acc: 1.01, grip: 0.99 },
    { id: 'toro', name: 'Toro Bravo', c1: '#1c2a6b', c2: '#e8b21a', vel: 0.99, acc: 1.00, grip: 1.02 },
    { id: 'papaya', name: 'Papaya Racing', c1: '#ff7a1a', c2: '#1b6fd6', vel: 1.00, acc: 1.02, grip: 0.99 },
    { id: 'verde', name: 'Verde Imperial', c1: '#0f5c3f', c2: '#c9e03a', vel: 1.00, acc: 0.99, grip: 1.02 },
    { id: 'pampa', name: 'Pampa Motorsport', c1: '#6ec6f2', c2: '#ffffff', vel: 1.01, acc: 0.99, grip: 1.01 },
    { id: 'alpes', name: 'Alpes Bleu', c1: '#1d5fd1', c2: '#ff4f9a', vel: 0.99, acc: 1.02, grip: 1.00 },
    { id: 'lobo', name: 'Lobo Blanco', c1: '#f1f1f1', c2: '#d81e1e', vel: 1.00, acc: 1.01, grip: 1.00 },
    { id: 'sol', name: 'Sol Naciente', c1: '#f4f4f4', c2: '#c8102e', vel: 0.99, acc: 1.01, grip: 1.01 },
    { id: 'condor', name: 'Cóndor Andino', c1: '#2b2b2b', c2: '#f2c200', vel: 1.02, acc: 0.99, grip: 1.00 }
  ];

  GC.DRIVERS = ['L. Ferreyra', 'T. Nakamura', 'J. Whitmore', 'A. Rossetti', 'K. Lindqvist', 'P. Dubois', 'R. Oliveira',
    'S. Muller', 'D. Connor', 'F. Castillo', 'N. Petrov', 'H. Tanaka', 'E. Van Dijk', 'C. Moreno', 'B. Schwartz',
    'G. Fontana', 'I. Kowalski', 'O. Haddad', 'V. Silva', 'M. Aguirre'];

  GC.DIFFICULTIES = [
    { id: 'novato', name: 'Novato', skill: 0.80, err: 0.06, react: 0.7 },
    { id: 'amateur', name: 'Amateur', skill: 0.87, err: 0.035, react: 0.5 },
    { id: 'pro', name: 'Profesional', skill: 0.935, err: 0.018, react: 0.32 },
    { id: 'leyenda', name: 'Leyenda', skill: 0.99, err: 0.006, react: 0.2 }
  ];

  GC.POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

  // Climas. wet: humedad del asfalto · vis: visibilidad (m)
  GC.WEATHERS = [
    { id: 'sol', name: 'Soleado', wet: 0, rain: 0, snow: 0, vis: 1100, sky0: '#2f7fd8', sky1: '#9fd2f5', dark: 0, wind: 0, cloud: 0.25 },
    { id: 'nublado', name: 'Nublado', wet: 0.05, rain: 0, snow: 0, vis: 800, sky0: '#75869a', sky1: '#bcc6cf', dark: 0.05, wind: 0.1, cloud: 1 },
    { id: 'lluvia', name: 'Lluvia', wet: 0.7, rain: 0.55, snow: 0, vis: 380, sky0: '#4f5a67', sky1: '#8b96a1', dark: 0.12, wind: 0.3, cloud: 1 },
    { id: 'tormenta', name: 'Tormenta', wet: 1, rain: 1, snow: 0, vis: 230, sky0: '#262c37', sky1: '#555d69', dark: 0.25, wind: 1, cloud: 1, lightning: 1 },
    { id: 'niebla', name: 'Niebla', wet: 0.15, rain: 0, snow: 0, vis: 120, sky0: '#a5aeb5', sky1: '#c9d0d4', dark: 0.03, wind: 0, cloud: 0 },
    { id: 'nieve', name: 'Nieve', wet: 0.3, rain: 0, snow: 1, vis: 280, sky0: '#93a1b0', sky1: '#dfe6ec', dark: 0.04, wind: 0.3, cloud: 1 },
    { id: 'noche', name: 'Noche', wet: 0, rain: 0, snow: 0, vis: 420, sky0: '#05081a', sky1: '#1b2447', dark: 0.42, wind: 0, cloud: 0.1, night: 1 },
    { id: 'variable', name: 'Variable', variable: true }
  ];

  GC.TYRES = [{ id: 'slick', name: 'Secos (slick)' }, { id: 'wet', name: 'De lluvia' }];

  GC.tyreGrip = function (tyre, wet, snow) {
    var g = tyre === 'wet' ? 0.92 - 0.24 * wet : 1 - 0.5 * wet;
    if (snow > 0) g *= (1 - 0.45 * snow) * (tyre === 'wet' ? 1.15 : 1);
    return g;
  };

  /* Pistas: trazados aproximados de circuitos reales.
     verts: [x, y, radio] en metros aprox. (y hacia abajo); el primer punto es la línea de meta.
     hills: [armónico, amplitud m, fase] */
  GC.TRACKS = [
    {
      id: 'monza', name: 'Monza', country: 'Italia', length: 5793, rw: 6, theme: 'forest',
      hills: [[1, 4, 0], [3, 2, 1]],
      verts: [[300, 0], [1150, 0, 18], [1178, 36, 18], [1650, 60, 330], [1785, 580, 15], [1822, 612, 15], [1900, 900, 70],
        [1673, 1006, 60], [1222, 692, 250], [846, 555, 40], [783, 585, 45], [726, 528, 50], [-330, 528, 150], [-330, 0, 264]]
    },
    {
      id: 'interlagos', name: 'Interlagos', country: 'Brasil', length: 4309, rw: 6, theme: 'city',
      hills: [[1, 16, 0.6], [2, 7, 2], [5, 3, 0]],
      verts: [[800, 400], [250, 400, 35], [215, 500, 40], [110, 540, 80], [80, 740, 100], [260, 860, 160], [900, 1100, 60],
        [960, 980, 50], [660, 930, 70], [610, 790, 50], [790, 750, 40], [810, 640, 35], [660, 620, 28], [640, 540, 28],
        [1080, 560, 70], [1230, 480, 80], [1180, 400, 60]]
    },
    {
      id: 'spa', name: 'Spa-Francorchamps', country: 'Bélgica', length: 7004, rw: 6, theme: 'hills',
      hills: [[1, 34, 1.2], [3, 10, 0], [7, 4, 2]],
      verts: [[200, 900], [60, 900, 20], [330, 780, 300], [540, 750, 45], [600, 640, 60], [700, 560, 80], [1500, 150, 35],
        [1560, 190, 30], [1640, 180, 40], [1700, 330, 60], [1760, 560, 45], [1650, 600, 45], [1560, 560, 40],
        [1500, 900, 110], [1800, 1050, 130], [1960, 1000, 60], [2150, 1200, 60], [2050, 1400, 90], [1200, 1500, 400],
        [600, 1150, 300], [300, 940, 15], [280, 900, 15]]
    },
    {
      id: 'suzuka', name: 'Suzuka', country: 'Japón', length: 5807, rw: 6, theme: 'hills',
      hills: [[1, 14, 0], [2, 6, 1], [6, 3, 0.5]],
      verts: [[1400, 300], [2000, 300, 80], [2060, 440, 70], [1880, 500, 45], [1780, 560, 45], [1680, 500, 45],
        [1580, 560, 50], [1350, 570, 150], [1180, 740, 35], [1080, 750, 25], [560, 560, 20], [420, 900, 250],
        [150, 1000, 70], [60, 1020, 60], [80, 1150, 60], [900, 620, 130], [960, 420, 18], [1000, 400, 18], [1040, 300, 50]]
    },
    {
      id: 'monaco', name: 'Mónaco', country: 'Mónaco', length: 3337, rw: 4.4, theme: 'sea', wall: 1.2,
      hills: [[1, 16, 2.2], [2, 5, 0]],
      verts: [[200, 800], [200, 470, 22], [470, 250, 80], [520, 150, 28], [760, 200, 50], [740, 300, 22], [650, 320, 13],
        [700, 400, 20], [560, 500, 120], [380, 520, 12], [350, 555, 12], [310, 560, 30], [300, 700, 18], [320, 740, 18],
        [320, 800, 18], [300, 840, 18], [300, 1050, 15], [200, 1050, 18]]
    },
    {
      id: 'baires', name: 'Buenos Aires', country: 'Argentina', length: 5968, rw: 6.5, theme: 'plain',
      hills: [[1, 1.5, 0]],
      verts: [[500, 300], [1300, 300, 60], [1300, 420, 60], [1500, 420, 90], [1500, 640, 110], [-500, 640, 200],
        [-500, 200, 200], [0, 200, 45], [120, 440, 40], [240, 520, 25], [300, 520, 22], [300, 300, 45]]
    },
    {
      id: 'indy', name: 'Indianápolis (óvalo)', country: 'EE.UU.', length: 4023, rw: 7.5, theme: 'stadium',
      hills: [],
      verts: [[759, 0], [1518, 0, 256], [1518, 713, 256], [0, 713, 256], [0, 0, 256]]
    }
  ];

  GC.THEMES = {
    forest: { grass: ['#2f8a34', '#2a7d2f'], back: 'forest', trees: ['round', 'pine'], density: 0.5 },
    city: { grass: ['#4a9a3a', '#448f35'], back: 'city', trees: ['round', 'palm'], density: 0.3 },
    hills: { grass: ['#2d7d3b', '#287236'], back: 'mountain', trees: ['pine', 'pine', 'round'], density: 0.6 },
    sea: { grass: ['#7d7f86', '#75777e'], back: 'sea', trees: ['building', 'building', 'palm'], density: 0.75 },
    plain: { grass: ['#6aa238', '#629833'], back: 'plain', trees: ['round', 'bush'], density: 0.22 },
    stadium: { grass: ['#3d9440', '#388a3b'], back: 'stadium', trees: ['stand'], density: 0.5 }
  };
})(window.GC);
