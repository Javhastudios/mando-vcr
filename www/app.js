window.addEventListener('error', function (e) {
  var el = document.getElementById('vfdSub');
  if (el) el.textContent = 'Error: ' + e.message;
});
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ---------- Plugin nativo ---------- */
  var cap = window.Capacitor;
  var native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  var IR = null;
  try {
    if (cap && cap.Plugins && cap.Plugins.Ir) IR = cap.Plugins.Ir;
    else if (cap && typeof cap.registerPlugin === 'function') IR = cap.registerPlugin('Ir');
  } catch (e) { IR = null; }

  /* ---------- Botones ---------- */
  var ICONS = {
    power: '<svg viewBox="0 0 24 24"><path d="M12 3v9M6.3 6.5a8 8 0 1 0 11.4 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    eject: '<svg viewBox="0 0 24 24"><path d="M12 4l8 9H4zM4 16h16v3H4z"/></svg>',
    rew:   '<svg viewBox="0 0 24 24"><path d="M11 6v12l-8-6zM21 6v12l-8-6z"/></svg>',
    play:  '<svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z"/></svg>',
    ff:    '<svg viewBox="0 0 24 24"><path d="M13 6v12l8-6zM3 6v12l8-6z"/></svg>',
    stop:  '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    rec:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>'
  };
  var BUTTONS = [
    { id: 'power', label: 'Encender',   icon: 'power', span: 2 },
    { id: 'eject', label: 'Expulsar',   icon: 'eject', span: 2 },
    { id: 'rew',   label: 'Rebobinar',  icon: 'rew' },
    { id: 'play',  label: 'Reproducir', icon: 'play' },
    { id: 'ff',    label: 'Avance',     icon: 'ff' },
    { id: 'stop',  label: 'Parar',      icon: 'stop' },
    { id: 'pause', label: 'Pausa',      icon: 'pause' },
    { id: 'rec',   label: 'Grabar',     icon: 'rec' },
    { id: 'chdn',  label: 'Canal −',    text: 'CH −' },
    { id: 'chup',  label: 'Canal +',    text: 'CH +' }
  ];
  function labelOf(id) { return BUTTONS.filter(function (b) { return b.id === id; })[0].label; }

  /* ---------- Estado guardado ---------- */
  var KEY = 'mando-vcr-v1';
  var state = { codes: {} };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.codes) state = saved;
  } catch (e) { /* almacenamiento vacío o no disponible */ }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }

  /* ---------- Pantalla ---------- */
  function show(main, sub) {
    $('#vfdMain').textContent = main;
    if (sub !== undefined) $('#vfdSub').textContent = sub;
  }
  function describe(d) {
    if (d.type === 'raw') return 'Pronto ' + Math.round(d.freq / 1000) + ' kHz';
    var name = { nec: 'NEC', sony: 'Sony', rc5: 'RC-5' }[d.type];
    return name + '  dir ' + d.a + '  cmd ' + d.c;
  }

  /* ---------- Envío ---------- */
  function send(d) {
    var built = IRCodec.build(d);
    if (!IR) return Promise.resolve();      // modo demo en navegador
    return IR.transmit({ frequency: built.freq, pattern: built.pattern });
  }
  function fail(err) {
    show('ERROR', (err && (err.message || err)) || 'No se pudo enviar');
  }

  /* ---------- Pestaña Mando ---------- */
  function renderPad() {
    var pad = $('#pad');
    pad.innerHTML = '';
    BUTTONS.forEach(function (b) {
      var el = document.createElement('button');
      el.className = 'key' + (b.span === 2 ? ' span2' : '') + (b.id === 'rec' ? ' rec' : '') +
        (b.id === 'power' ? ' power' : '') + (state.codes[b.id] ? '' : ' empty');
      el.setAttribute('aria-label', b.label);
      el.innerHTML = '<span class="ico">' + (b.icon ? ICONS[b.icon] : b.text) + '</span><span>' + b.label + '</span>';
      el.addEventListener('click', function () { press(b.id); });
      pad.appendChild(el);
    });
    var n = Object.keys(state.codes).length;
    $('#padHint').textContent = n === 0
      ? 'Los botones apagados no tienen código. Ve a Buscar para encontrar el de tu vídeo.'
      : n + ' de ' + BUTTONS.length + ' botones con código.';
  }
  function press(id) {
    var d = state.codes[id];
    if (navigator.vibrate) navigator.vibrate(15);
    if (!d) { show('SIN CÓDIGO', 'Asigna ' + labelOf(id) + ' en Buscar o Códigos'); return; }
    show(labelOf(id).toUpperCase(), describe(d));
    send(d).catch(fail);
  }

  /* ---------- Selectores de botón ---------- */
  function fillTargets() {
    ['#assignTarget', '#prontoTarget'].forEach(function (sel) {
      var el = $(sel), keep = el.value;
      el.innerHTML = BUTTONS.map(function (b) { return '<option value="' + b.id + '">' + b.label + '</option>'; }).join('');
      if (keep) el.value = keep;
    });
  }

  /* ---------- Búsqueda ---------- */
  var LIMITS = { nec: { a: 255, c: 255 }, sony: { a: 31, c: 127 }, rc5: { a: 31, c: 127 } };
  var sw = { run: 0, running: false, i: 0, n: 0, p: null };

  function num(sel, min, max) {
    var v = parseInt($(sel).value, 10);
    if (isNaN(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }
  function readParams() {
    var proto = $('#proto').value, lim = LIMITS[proto];
    var a0 = num('#a0', 0, lim.a), a1 = num('#a1', 0, lim.a);
    var c0 = num('#c0', 0, lim.c), c1 = num('#c1', 0, lim.c);
    if (a1 < a0) { var t = a0; a0 = a1; a1 = t; }
    if (c1 < c0) { var u = c0; c0 = c1; c1 = u; }
    return { proto: proto, a0: a0, a1: a1, c0: c0, c1: c1, delay: num('#delay', 150, 5000) };
  }
  function itemAt(i) {
    var nc = sw.p.c1 - sw.p.c0 + 1;
    return { type: sw.p.proto, a: sw.p.a0 + Math.floor(i / nc), c: sw.p.c0 + (i % nc) };
  }
  function updateEstimate() {
    var p = readParams();
    var n = (p.a1 - p.a0 + 1) * (p.c1 - p.c0 + 1);
    var secs = Math.round(n * p.delay / 1000);
    var t = secs >= 120 ? Math.round(secs / 60) + ' min' : secs + ' s';
    $('#sweepEstimate').textContent = n + ' códigos · unos ' + t + ' como máximo';
  }
  function onProtoChange() {
    var lim = LIMITS[$('#proto').value];
    $('#a0').max = $('#a1').max = lim.a;
    $('#c0').max = $('#c1').max = lim.c;
    $('#a0').value = 0; $('#a1').value = lim.a;
    $('#c0').value = 0; $('#c1').value = lim.c;
    updateEstimate();
  }
  function sweepView(mode) {
    $('#sweepIdle').hidden = mode !== 'idle';
    $('#sweepRun').hidden = mode !== 'run';
    $('#sweepPaused').hidden = mode !== 'paused';
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function showCurrent() {
    var d = itemAt(sw.i);
    show('D' + d.a + ' C' + d.c, describe(d) + '  (' + (sw.i + 1) + '/' + sw.n + ')');
  }

  function loop() {
    var id = ++sw.run;
    sw.running = true;
    sweepView('run');
    (function step() {
      if (id !== sw.run) return;
      if (sw.i >= sw.n) {
        sw.running = false; sw.i = sw.n - 1;
        show('FIN', 'Sin respuesta. Prueba otro protocolo o rango.');
        sweepView('idle');
        return;
      }
      showCurrent();
      send(itemAt(sw.i)).catch(fail).then(function () { return sleep(sw.p.delay); }).then(function () {
        if (id !== sw.run) return;
        sw.i++;
        step();
      });
    })();
  }
  function stopLoop() { sw.run++; sw.running = false; }

  function startSweep() {
    sw.p = readParams();
    sw.n = (sw.p.a1 - sw.p.a0 + 1) * (sw.p.c1 - sw.p.c0 + 1);
    sw.i = 0;
    loop();
  }
  function found() {
    stopLoop();
    sw.i = Math.max(0, sw.i - 2);
    showCurrent();
    sweepView('paused');
  }
  function pauseSweep() { stopLoop(); showCurrent(); sweepView('paused'); }
  function stepTo(i) {
    sw.i = Math.min(sw.n - 1, Math.max(0, i));
    showCurrent();
    send(itemAt(sw.i)).catch(fail);
  }
  function resume() { sw.i = Math.min(sw.n, sw.i + 1); loop(); }
  function assignCurrent() {
    var target = $('#assignTarget').value, d = itemAt(sw.i);
    state.codes[target] = d;
    persist(); renderPad(); renderList();
    show('GUARDADO', labelOf(target) + ' = ' + describe(d));
    if (d.type !== 'raw') {
      $('#a0').value = d.a; $('#a1').value = d.a;
      $('#c0').value = 0;   $('#c1').value = LIMITS[d.type].c;
      updateEstimate();
    }
  }

  /* ---------- Pestaña Códigos ---------- */
  function renderList() {
    var ul = $('#codeList');
    var ids = Object.keys(state.codes);
    if (!ids.length) { ul.innerHTML = '<li>Todavía no hay códigos guardados.</li>'; return; }
    ul.innerHTML = '';
    BUTTONS.forEach(function (b) {
      var d = state.codes[b.id];
      if (!d) return;
      var li = document.createElement('li');
      li.innerHTML = '<span>' + b.label + '<br><code>' + describe(d) + '</code></span>';
      var rm = document.createElement('button');
      rm.className = 'btn ghost small';
      rm.textContent = 'Quitar';
      rm.addEventListener('click', function () { delete state.codes[b.id]; persist(); renderPad(); renderList(); });
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }
  function presetRc5() {
    var map = { power: 12, rew: 50, play: 53, ff: 52, stop: 54, pause: 48, rec: 55, chup: 32, chdn: 33 };
    Object.keys(map).forEach(function (k) { state.codes[k] = { type: 'rc5', a: 5, c: map[k] }; });
    persist(); renderPad(); renderList();
    show('RC-5', 'Perfil cargado. Prueba Encender.');
  }
  function readPronto() {
    try { return { type: 'raw', freq: 0, pattern: [] , parsed: IRCodec.pronto($('#prontoText').value) }; }
    catch (e) { fail(e); return null; }
  }
  function prontoTest() {
    var r = readPronto(); if (!r) return;
    show('PRONTO', Math.round(r.parsed.freq / 1000) + ' kHz, ' + r.parsed.pattern.length + ' pulsos');
    send({ type: 'raw', freq: r.parsed.freq, pattern: r.parsed.pattern }).catch(fail);
  }
  function prontoSave() {
    var r = readPronto(); if (!r) return;
    var target = $('#prontoTarget').value;
    state.codes[target] = { type: 'raw', freq: r.parsed.freq, pattern: r.parsed.pattern };
    persist(); renderPad(); renderList();
    show('GUARDADO', labelOf(target) + ' = Pronto');
  }

  /* ---------- Pestañas ---------- */
  function selectTab(name) {
    $$('nav button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
    ['mando', 'buscar', 'codigos'].forEach(function (t) { $('#tab-' + t).hidden = t !== name; });
    if (name !== 'buscar' && sw.running) pauseSweep();
    window.scrollTo(0, 0);
  }

  /* ---------- Arranque ---------- */
  $$('nav button').forEach(function (b) { b.addEventListener('click', function () { selectTab(b.dataset.tab); }); });
  $('#proto').addEventListener('change', onProtoChange);
  ['#a0', '#a1', '#c0', '#c1', '#delay'].forEach(function (s) { $(s).addEventListener('input', updateEstimate); });
  $('#btnStart').addEventListener('click', startSweep);
  $('#btnFound').addEventListener('click', found);
  $('#btnPauseSweep').addEventListener('click', pauseSweep);
  $('#btnPrev').addEventListener('click', function () { stepTo(sw.i - 1); });
  $('#btnNext').addEventListener('click', function () { stepTo(sw.i + 1); });
  $('#btnResend').addEventListener('click', function () { stepTo(sw.i); });
  $('#btnAssign').addEventListener('click', assignCurrent);
  $('#btnResume').addEventListener('click', resume);
  $('#btnClear').addEventListener('click', function () {
    if (confirm('¿Borrar todos los códigos guardados?')) { state.codes = {}; persist(); renderPad(); renderList(); show('--:--', 'Códigos borrados'); }
  });
  $('#btnPresetRc5').addEventListener('click', presetRc5);
  $('#btnProntoTest').addEventListener('click', prontoTest);
  $('#btnProntoSave').addEventListener('click', prontoSave);

  fillTargets();
  renderPad();
  renderList();
  onProtoChange();
  sweepView('idle');

  if (IR) {
    try {
      IR.hasEmitter().then(function (r) {
        show('--:--', r && r.available ? 'Listo. Apunta al vídeo.' : 'Este móvil no tiene emisor IR');
      }).catch(function (err) {
        show('--:--', 'Error IR: ' + ((err && err.message) || err));
      });
    } catch (e) {
      show('--:--', 'Error IR: ' + e.message);
    }
  } else if (native) {
    show('--:--', 'Plugin IR no encontrado en la app');
  } else {
    show('--:--', 'Modo demo: aquí no se emite IR');
  }
})();
