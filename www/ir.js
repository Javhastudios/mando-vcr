/* Codificadores infrarrojos.
   Cada función devuelve { freq: Hz, pattern: [µs marca, µs espacio, ...] },
   que es el formato de ConsumerIrManager.transmit() en Android. */
(function (root) {
  'use strict';

  var rc5Toggle = 0;

  function nec(addr, cmd) {
    var bytes = addr > 255
      ? [addr & 255, (addr >> 8) & 255]      // NEC extendido (dirección de 16 bits)
      : [addr & 255, (~addr) & 255];
    bytes.push(cmd & 255, (~cmd) & 255);
    var p = [9000, 4500];
    bytes.forEach(function (b) {
      for (var i = 0; i < 8; i++) p.push(560, ((b >> i) & 1) ? 1690 : 560);
    });
    p.push(560);
    return { freq: 38000, pattern: p };
  }

  function sony(dev, cmd) {
    var p = [2400, 600], i;
    var bits = [];
    for (i = 0; i < 7; i++) bits.push((cmd >> i) & 1);
    for (i = 0; i < 5; i++) bits.push((dev >> i) & 1);
    bits.forEach(function (b) { p.push(b ? 1200 : 600, 600); });
    var total = p.reduce(function (a, b) { return a + b; }, 0);
    p[p.length - 1] += Math.max(0, 45000 - total);   // trama de 45 ms
    return { freq: 40000, pattern: p.concat(p, p) };  // Sony repite 3 veces
  }

  function rc5(addr, cmd, toggle) {
    var bits = [1, cmd >= 64 ? 0 : 1, toggle ? 1 : 0], i;
    for (i = 4; i >= 0; i--) bits.push((addr >> i) & 1);
    for (i = 5; i >= 0; i--) bits.push((cmd >> i) & 1);
    var half = [];                                    // true = marca, false = espacio
    bits.forEach(function (b) { half.push(!b, !!b); });
    var start = half[0] ? 0 : 1;                      // el patrón debe empezar con marca
    var p = [], cur = half[start], len = 889;
    for (var j = start + 1; j < half.length; j++) {
      if (half[j] === cur) len += 889;
      else { p.push(len); cur = half[j]; len = 889; }
    }
    p.push(len);
    return { freq: 36000, pattern: p };
  }

  function pronto(text) {
    var w = String(text).trim().split(/\s+/).map(function (h) { return parseInt(h, 16); });
    if (w.length < 6 || w.some(isNaN) || w[0] !== 0) {
      throw new Error('No es un código Pronto válido (debe empezar por 0000)');
    }
    var freq = Math.round(1000000 / (w[1] * 0.241246));
    var unit = 1000000 / freq;
    var once = w[2], rep = w[3];
    var pairs = once > 0 ? once : rep;
    var start = 4 + (once > 0 ? 0 : once * 2);
    var raw = w.slice(start, start + pairs * 2);
    if (raw.length < 2 || raw.length !== pairs * 2) {
      throw new Error('El código Pronto está incompleto');
    }
    return {
      freq: freq,
      pattern: raw.map(function (d) { return Math.max(1, Math.round(d * unit)); })
    };
  }

  // Repite la trama completa n veces, con 40 ms entre tramas (como hace el mando original)
  function repeatFrames(r, n) {
    if (!n || n < 2) return r;
    var out = r.pattern.slice();
    for (var i = 1; i < n; i++) out = out.concat([40000], r.pattern);
    return { freq: r.freq, pattern: out };
  }

  function build(d) {
    var r;
    if (d.type === 'nec') r = nec(d.a, d.c);
    else if (d.type === 'sony') r = sony(d.a, d.c);
    else if (d.type === 'rc5') { r = rc5(d.a, d.c, rc5Toggle); rc5Toggle ^= 1; }
    else if (d.type === 'raw') r = { freq: d.freq, pattern: d.pattern };
    else throw new Error('Protocolo desconocido: ' + d.type);
    return repeatFrames(r, d.frames);
  }

  // Trama que envía un mando real mientras se mantiene pulsada la tecla
  function repeatFrame(d) {
    if (d.type === 'nec') return { freq: 38000, pattern: [9000, 2250, 560] };   // código de repetición NEC
    if (d.type === 'sony') return sony(d.a, d.c);
    if (d.type === 'rc5') return rc5(d.a, d.c, rc5Toggle ^ 1);                   // mismo bit toggle que la primera trama
    return { freq: d.freq, pattern: d.pattern };
  }

  var api = { nec: nec, sony: sony, rc5: rc5, pronto: pronto, build: build, repeatFrame: repeatFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IRCodec = api;
})(typeof self !== 'undefined' ? self : this);
