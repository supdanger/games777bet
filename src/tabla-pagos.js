// =========================================================
// TABLA DE PAGOS Y REGLAS
//
// Compartido entre el ensamblador (preview.js) y la pantalla real
// del jugador (jugar.js): el jugador tiene que poder ver exactamente
// la misma información que ve Max al armar el juego. Si estuviera
// duplicado, tarde o temprano una copia diría algo distinto de la
// otra — que en un casino es un problema serio, no un detalle.
//
// Se arma solo a partir de los símbolos y los datos del juego, así
// que nunca queda desactualizada respecto de lo que realmente paga.
// =========================================================

export function mostrarTablaPagos(overlayJuego, simbolos, juego) {
  const ordenados = [...simbolos].sort((a, b) => b.pago_tres - a.pago_tres);

  const filasPagos = ordenados.map((s) => `
    <div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-soft, var(--border))">
      <div style="width:36px; height:36px; border-radius:8px; background:var(--surface-alt); flex-shrink:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
        ${s.icono_url ? `<img src="${s.icono_url}" style="width:80%; height:80%; object-fit:contain" />` : `<span class="hint" style="font-size:10px">${escapeHtml(s.nombre.slice(0, 3))}</span>`}
      </div>
      <p style="flex:1; margin:0; font-size:13px">${escapeHtml(s.nombre)}</p>
      <div style="text-align:right">
        <p style="margin:0; font-size:13px"><span class="hint">3 iguales</span> ${s.pago_tres}x</p>
        ${s.pago_dos > 0 ? `<p style="margin:0; font-size:12px" class="hint">2 iguales ${s.pago_dos}x</p>` : ''}
      </div>
    </div>
  `).join('');

  const hayWild = simbolos.some((s) => s.nombre?.toLowerCase() === 'wild');

  // Las reglas se escriben tal cual las aplica el motor. Si el texto
  // dijera algo distinto de lo que realmente paga, el jugador vería
  // una combinación "ganadora" que no cobra — y eso, con razón, se
  // lee como una estafa.
  const panelReglas = `
    ${juego.descripcion ? `<p style="font-size:13px; margin:0 0 12px">${escapeHtml(juego.descripcion)}</p>` : ''}
    <div style="background:var(--surface-alt); border-radius:8px; padding:10px 12px; margin-bottom:10px">
      <p class="hint" style="margin:0 0 6px">Cómo se gana</p>
      <p style="margin:0 0 6px; font-size:13px">Hay una sola línea de pago: la fila del medio.</p>
      <p style="margin:0 0 6px; font-size:13px">Tres símbolos iguales en esa línea pagan el premio de tres.</p>
      <p style="margin:0 0 6px; font-size:13px">Dos símbolos iguales pagan solo si están en los <strong>dos primeros rodillos</strong>, empezando por la izquierda. Dos iguales en el segundo y el tercero no pagan.</p>
      ${hayWild ? '<p style="margin:0; font-size:13px">El comodín (wild) reemplaza a cualquier símbolo.</p>' : ''}
    </div>
    <div style="background:var(--surface-alt); border-radius:8px; padding:10px 12px">
      <p class="hint" style="margin:0 0 2px">Apuesta</p>
      <p style="margin:0; font-size:13px">${Number(juego.min_bet).toLocaleString('es-PY')} - ${Number(juego.max_bet).toLocaleString('es-PY')}</p>
    </div>
  `;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px';
  modal.innerHTML = `
    <div class="card" style="max-width:340px; width:100%; max-height:80vh; overflow:auto">
      <div style="display:flex; align-items:center; margin-bottom:10px">
        <strong style="flex:1">Información del juego</strong>
        <button id="tp-cerrar">✕</button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:14px">
        <button id="tp-tab-pagos" class="tp-tab" style="flex:1">Tabla de pagos</button>
        <button id="tp-tab-reglas" class="tp-tab" style="flex:1">Reglas</button>
      </div>

      <div id="tp-panel-pagos">
        <p class="hint" style="margin:0 0 10px">Solo paga la línea del medio, de izquierda a derecha.</p>
        ${filasPagos}
      </div>
      <div id="tp-panel-reglas" style="display:none">${panelReglas}</div>
    </div>
  `;

  const marcarActivo = (activaId) => {
    modal.querySelectorAll('.tp-tab').forEach((btn) => {
      const activo = btn.id === activaId;
      btn.style.borderColor = activo ? 'var(--accent)' : 'var(--border)';
      btn.style.color = activo ? 'var(--accent)' : 'var(--text)';
    });
    modal.querySelector('#tp-panel-pagos').style.display = activaId === 'tp-tab-pagos' ? 'block' : 'none';
    modal.querySelector('#tp-panel-reglas').style.display = activaId === 'tp-tab-reglas' ? 'block' : 'none';
  };

  modal.querySelector('#tp-tab-pagos').addEventListener('click', () => marcarActivo('tp-tab-pagos'));
  modal.querySelector('#tp-tab-reglas').addEventListener('click', () => marcarActivo('tp-tab-reglas'));
  marcarActivo('tp-tab-pagos');

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#tp-cerrar').addEventListener('click', () => modal.remove());
  overlayJuego.appendChild(modal);
}


function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
