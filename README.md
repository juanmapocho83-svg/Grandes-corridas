# Grandes Corridas

Juego de carreras en tercera persona con estética pixel art, jugable en celular y computadora. Sin dependencias ni compilación: HTML + JavaScript puro.

## Cómo jugar

- **En la computadora:** abrí `index.html` en el navegador, o servilo con cualquier servidor estático (`python3 -m http.server 8000` y entrá a `http://localhost:8000`).
- **En el celular (enlace permanente):** activá GitHub Pages en este repositorio: *Settings → Pages → Build and deployment → Source: Deploy from a branch*, elegí la rama y la carpeta `/ (root)` y guardá. En un par de minutos queda publicado en `https://<usuario>.github.io/<repositorio>/`.

Conviene jugar con el celular en horizontal.

## Qué incluye

- **7 categorías**: Fórmula A, B y C, Gran Turismo, Turismo, Moto 1000 y Moto 600, cada una con su velocidad, aceleración, agarre, carga aerodinámica y caja de cambios.
- **7 pistas** con trazados aproximados de circuitos reales: Monza, Interlagos, Spa-Francorchamps, Suzuka, Mónaco, Buenos Aires e Indianápolis (óvalo), con su longitud real y relieve.
- **10 equipos** (ficticios) con colores propios y pequeñas diferencias de rendimiento; cada equipo tiene dos pilotos.
- **Climas** que cambian la jugabilidad: soleado, nublado, lluvia, tormenta (viento y rayos), niebla, nieve, noche y variable (cambia durante la carrera). Afectan agarre, frenado y visibilidad; hay que elegir neumáticos secos o de lluvia.
- **Bots** con 4 dificultades (Novato, Amateur, Profesional, Leyenda): frenan para las curvas, adelantan, cometen errores y aprovechan el rebufo.
- **Transmisión** automática, manual secuencial o manual con embrague (con punto muerto y calado del motor).
- **Modos**: carrera rápida y campeonato por puntos (pilotos y equipos), con récords de vuelta guardados.

## Controles

| Acción | Teclado | Celular | Mando |
|---|---|---|---|
| Dirección | ← → / A D | Panel ◀ ▶ (deslizá el pulgar: más lejos del centro, más gira) | Stick izquierdo |
| Acelerador | ↑ / W | GAS | RT |
| Freno | ↓ / S / Espacio | FRENO | LT |
| Subir / bajar marcha | E o X / Q o Z | ▲ ▼ | A o RB / X o LB |
| Embrague | Shift o C | EMB | B |
| Pausa | P / Esc | II | Start |

Con embrague habilitado se larga en punto muerto: pisá el embrague, subí a 1ª, acelerá y soltá.

## Estructura

- `js/data.js` — categorías, equipos, pistas, climas
- `js/track.js` — generador de pistas (curvatura, relieve, escenografía)
- `js/sprites.js` — sprites pixel art generados por código y fuente bitmap
- `js/game.js` — física, bots, clima y render pseudo-3D
- `js/audio.js` — sonido sintetizado (WebAudio)
- `js/ui.js` — menús, entrada y bucle principal
