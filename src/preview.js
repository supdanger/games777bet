// Vista previa jugable: corre el mismo tipo de giro que el motor real,
// con los símbolos, imágenes, efectos y sonidos que estás editando.
// No toca ninguna base de saldo — es plata de mentira, solo para ver
// cómo se siente el juego antes de publicarlo.

function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;
  for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
  return simbolos[simbolos.length - 1];
}

function girar(simbolos) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const grilla = [];
  for (let f = 0; f < 3; f++) {
    grilla.push([elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total)]);
  }
  // La línea de pago es la fila del medio
  const linea = grilla[1];
  const reales = linea.filter((s) => s.nombre !== 'wild');
  const cand = reales.length ? reales[0] : linea[0];

  let premio = 0, nivel = null;
  if (linea.every((s) => s === cand || s.nombre === 'wild')) {
    premio = (reales.length ? cand : linea[0]).pago_tres;
    nivel = premio >= Math.max(...simbolos.map((s) => s.pago_tres)) ? 'premio_mayor' : 'tres_iguales';
  } else if (linea[0] === linea[1] || (linea[0].nombre === 'wild' || linea[1].nombre === 'wild')) {
    premio = (linea[0].nombre === 'wild' ? linea[1] : linea[0]).pago_dos || 0;
    if (premio > 0) nivel = 'dos_iguales';
  }
  return { grilla, premio, nivel };
}

function celdaHtml(s) {
  if (s.icono_url) return `<img src="${s.icono_url}" style="width:60%; height:60%; object-fit:contain" />`;
  return `<span style="font-size:11px; color:#8fae9a">${s.nombre}</span>`;
}

export function renderPreview({ juego, simbolos, sonidos, efectos }) {
  if (!simbolos.length) { alert('Agregá símbolos antes de probar el juego.'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px';

  const cssEfectos = efectos.map((ef) => ef.css || '').join('\n');
  const audios = {};
  sonidos.forEach((s) => { audios[s.tipo] = new Audio(s.archivo_url); });
  if (audios.musica_fondo) { audios.musica_fondo.loop = true; audios.musica_fondo.volume = 0.5; }

  const marcoBg = juego.marco_url ? `center/cover url('${juego.marco_url}')` : 'var(--surface)';
  const fondoBg = juego.fondo_url ? `center/cover url('${juego.fondo_url}')` : 'var(--surface-alt)';

  overlay.innerHTML = `
    <style>${cssEfectos}</style>
    <div style="background:${marcoBg}; border-radius:20px; padding:22px; max-width:320px; width:100%; position:relative">
      <button id="pv-cerrar" style="position:absolute; top:10px; right:10px; z-index:2">✕</button>
      <p style="text-align:center; font-weight:600; margin:0 0 14px; letter-spacing:.04em">${escapeHtml(juego.nombre).toUpperCase()}</p>

      <div id="pv-grilla" style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; background:${fondoBg}; border-radius:12px; padding:8px; position:relative">
        ${Array(9).fill('<div class="pv-celda" style="aspect-ratio:1; background:rgba(0,0,0,.25); border-radius:8px; display:flex; align-items:center; justify-content:center"></div>').join('')}
        <div id="pv-efecto-premio" style="position:absolute; inset:0; pointer-events:none; opacity:0"></div>
      </div>

      <div style="display:flex; align-items:center; gap:10px; margin-top:14px">
        <div style="flex:1">
          <p class="hint" style="margin:0">Saldo de prueba</p>
          <strong id="pv-saldo" style="font-size:18px">10.000</strong>
        </div>
        <button class="primary" id="pv-girar" style="font-size:16px; padding:12px 22px">Girar</button>
      </div>
      <p id="pv-msg" class="hint" style="text-align:center; min-height:18px; margin-top:8px"></p>
    </div>
  `;

  document.body.appendChild(overlay);

  let saldo = 10000;
  const apuesta = Number(juego.min_bet) || 1000;
  const celdas = overlay.querySelectorAll('.pv-celda');
  const efectoPremio = overlay.querySelector('#pv-efecto-premio');

  const cerrar = () => { Object.values(audios).forEach((a) => a.pause()); overlay.remove(); };
  overlay.querySelector('#pv-cerrar').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  overlay.querySelector('#pv-girar').addEventListener('click', () => {
    if (saldo < apuesta) { overlay.querySelector('#pv-msg').textContent = 'Sin saldo de prueba. Cerrá y volvé a abrir.'; return; }

    // El navegador solo deja sonar audio tras un gesto del usuario:
    // por eso la música arranca acá, en el primer giro, no al abrir.
    if (audios.musica_fondo && audios.musica_fondo.paused) audios.musica_fondo.play().catch(() => {});
    if (audios.giro) { audios.giro.currentTime = 0; audios.giro.play().catch(() => {}); }

    saldo -= apuesta;
    const { grilla, premio, nivel } = girar(simbolos);

    // grilla[fila][columna] -> celda (columna-major en pantalla)
    for (let c = 0; c < 3; c++) {
      for (let f = 0; f < 3; f++) {
        celdas[f * 3 + c].innerHTML = celdaHtml(grilla[c][f]);
      }
    }

    const ganancia = premio * apuesta;
    saldo += ganancia;
    overlay.querySelector('#pv-saldo').textContent = saldo.toLocaleString('es-PY');
    overlay.querySelector('#pv-msg').textContent = premio > 0 ? `¡Ganaste ${ganancia.toLocaleString('es-PY')}! (${premio}x)` : 'Seguí probando';

    if (premio > 0) {
      const ef = efectos.find((e) => e.tipo === 'premio' && e.nivel_premio === nivel);
      if (ef) {
        efectoPremio.className = 'efecto-premio';
        efectoPremio.style.animation = 'none';
        void efectoPremio.offsetWidth;
        efectoPremio.style.cssText = `position:absolute; inset:0; pointer-events:none; ${ef.posicion === 'linea' ? 'top:33%; height:33%;' : ''}`;
        efectoPremio.style.animation = '';
      }
      const sonidoPremio = nivel === 'premio_mayor' ? audios.premio_grande : audios.premio_chico;
      if (sonidoPremio) { sonidoPremio.currentTime = 0; sonidoPremio.play().catch(() => {}); }
    }
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
