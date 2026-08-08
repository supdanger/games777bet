import { supabase } from './supabase.js';
import { analizar } from './motor.js';
import { renderPreview } from './preview.js';

const COLORES = ['#f87171', '#fbbf24', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#94a3b8'];

const SONIDOS = [
  { tipo: 'musica_fondo', etiqueta: 'Música de fondo' },
  { tipo: 'giro', etiqueta: 'Sonido de giro' },
  { tipo: 'premio_chico', etiqueta: 'Premio chico' },
  { tipo: 'premio_grande', etiqueta: 'Premio grande' },
];

const NIVELES = [
  { valor: 'dos_iguales', etiqueta: 'Dos iguales' },
  { valor: 'tres_iguales', etiqueta: 'Tres iguales' },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor' },
];

export function renderEditor(el, juego, onCambio) {
  let simbolos = [];
  let efectos = [];
  let sonidos = [];

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px">
        <input id="ed-nombre" value="${escapeHtml(juego.nombre)}" style="flex:1; min-width:160px; font-size:16px; font-weight:600" />
        <select id="ed-estado" style="width:auto">
          <option value="borrador" ${juego.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
          <option value="en_prueba" ${juego.estado === 'en_prueba' ? 'selected' : ''}>En prueba</option>
          <option value="listo" ${juego.estado === 'listo' ? 'selected' : ''}>Listo</option>
        </select>
        <button class="primary" id="ed-preview">▶ Vista previa</button>
      </div>

      <label style="display:block; margin-bottom:10px">Descripción
        <input id="ed-desc" value="${escapeHtml(juego.descripcion || '')}" placeholder="Clásico de 3 rodillos con comodín" />
      </label>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px">
        <label>Apuesta mínima<input id="ed-min" type="number" value="${juego.min_bet}" /></label>
        <label>Apuesta máxima<input id="ed-max" type="number" value="${juego.max_bet}" /></label>
      </div>

      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0">
        <div><p class="hint" style="margin:0">Retorno</p><strong id="out-rtp" style="font-size:20px">--</strong></div>
        <div><p class="hint" style="margin:0">Volatilidad</p><strong id="out-vol" style="font-size:20px">--</strong></div>
        <div><p class="hint" style="margin:0">Premio mayor</p><strong id="out-mayor" style="font-size:20px">--</strong></div>
        <div><p class="hint" style="margin:0">Frecuencia</p><strong id="out-frec" style="font-size:20px">--</strong></div>
      </div>
      <p id="ed-aviso" style="display:none; padding:8px 10px; border-radius:8px; font-size:13px; margin:0 0 12px"></p>

      <strong style="font-size:14px">Símbolos</strong>
      <div id="ed-tabla" style="display:flex; flex-direction:column; gap:6px; margin-top:8px"></div>
      <button id="ed-agregar" style="margin-top:10px">+ Agregar símbolo</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <strong style="font-size:15px">Imágenes de la máquina</strong>
      <p class="hint" style="margin-bottom:14px">El fondo se repite detrás de los símbolos. El marco es el diseño alrededor de la grilla.</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
        <div id="ed-fondo"></div>
        <div id="ed-marco"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <strong style="font-size:15px">Sonidos</strong>
      <p class="hint" style="margin-bottom:14px">Archivos cortos (mp3 u ogg). La música arranca con el primer toque del jugador.</p>
      <div id="ed-sonidos" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px"></div>
    </div>

    <div class="card">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px">
        <strong style="font-size:15px; flex:1">Efectos</strong>
        <button id="ef-nuevo">+ Nuevo efecto</button>
      </div>
      <p class="hint" style="margin-bottom:14px">Animaciones CSS. Las de carcasa se ven siempre; las de premio disparan al ganar.</p>
      <div id="ed-efectos" style="display:flex; flex-direction:column; gap:10px"></div>
    </div>
  `;

  // ---------------- Símbolos ----------------
  const cargarSimbolos = async () => {
    const { data } = await supabase.from('simbolos').select('*').eq('juego_id', juego.id).order('orden');
    simbolos = data || [];
    pintarTabla();
    calcular();
  };

  const pintarTabla = () => {
    const cont = el.querySelector('#ed-tabla');
    cont.innerHTML = simbolos.map((s, i) => `
      <div style="display:flex; align-items:center; gap:8px; background:var(--surface-alt); border-radius:8px; padding:8px">
        <label style="width:34px; height:34px; border-radius:8px; background:var(--surface); border:1px solid var(--border); flex-shrink:0; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center">
          ${s.icono_url
            ? `<img src="${s.icono_url}" style="width:100%; height:100%; object-fit:cover" />`
            : `<span style="width:14px; height:14px; border-radius:50%; background:${COLORES[i % COLORES.length]}"></span>`}
          <input type="file" accept="image/*" data-icono="${i}" hidden />
        </label>
        <input data-i="${i}" data-campo="nombre" value="${escapeHtml(s.nombre)}" style="flex:1; min-width:80px" />
        <label style="font-size:11px; color:var(--text-dim); white-space:nowrap">peso<input data-i="${i}" data-campo="peso" type="number" value="${s.peso}" style="width:55px" /></label>
        <label style="font-size:11px; color:var(--text-dim); white-space:nowrap">x3<input data-i="${i}" data-campo="pago_tres" type="number" value="${s.pago_tres}" style="width:65px" /></label>
        <label style="font-size:11px; color:var(--text-dim); white-space:nowrap">x2<input data-i="${i}" data-campo="pago_dos" type="number" value="${s.pago_dos}" style="width:55px" /></label>
        <button data-borrar="${i}" aria-label="Quitar">✕</button>
      </div>
    `).join('') || '<p class="hint">Todavía no agregaste símbolos.</p>';

    cont.querySelectorAll('input[data-campo]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const i = +e.target.dataset.i, campo = e.target.dataset.campo;
        simbolos[i][campo] = campo === 'nombre' ? e.target.value : (+e.target.value || 0);
        calcular();
      });
      inp.addEventListener('change', (e) => guardarSimbolo(simbolos[+e.target.dataset.i]));
    });

    cont.querySelectorAll('[data-borrar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const s = simbolos[+btn.dataset.borrar];
        if (s.id) await supabase.from('simbolos').delete().eq('id', s.id);
        cargarSimbolos();
      });
    });

    cont.querySelectorAll('[data-icono]').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const archivo = e.target.files?.[0];
        if (!archivo) return;
        const s = simbolos[+e.target.dataset.icono];
        const url = await subirArchivo(archivo, `iconos/${juego.id}`);
        if (url) { s.icono_url = url; await guardarSimbolo(s); pintarTabla(); }
      });
    });
  };

  const calcular = () => {
    const { rtp, volatilidad, frecuencia, premioMayor } = analizar(
      simbolos.length ? simbolos : [{ nombre: '-', peso: 1, pago_tres: 0, pago_dos: 0 }]
    );
    el.querySelector('#out-rtp').textContent = rtp.toFixed(1) + '%';
    el.querySelector('#out-vol').textContent = volatilidad.toFixed(1);
    el.querySelector('#out-mayor').textContent = premioMayor + 'x';
    el.querySelector('#out-frec').textContent = frecuencia ? '1 en ' + frecuencia.toFixed(1) : '--';

    const aviso = el.querySelector('#ed-aviso');
    if (rtp > 100) {
      aviso.style.display = 'block';
      aviso.style.background = 'rgba(248,113,113,.12)'; aviso.style.color = 'var(--danger)';
      aviso.textContent = 'El juego pagaría más de lo que recauda. Bajá algún pago antes de publicarlo.';
    } else if (rtp > 0 && rtp < 70) {
      aviso.style.display = 'block';
      aviso.style.background = 'rgba(251,191,36,.12)'; aviso.style.color = 'var(--warning)';
      aviso.textContent = 'Retorno muy bajo: el jugador se queda sin saldo enseguida.';
    } else {
      aviso.style.display = 'none';
    }
  };

  const guardarSimbolo = async (s) => {
    if (s.id) {
      await supabase.from('simbolos').update({
        nombre: s.nombre, peso: s.peso, pago_tres: s.pago_tres, pago_dos: s.pago_dos, icono_url: s.icono_url,
      }).eq('id', s.id);
    } else {
      const { data } = await supabase.from('simbolos').insert({
        juego_id: juego.id, nombre: s.nombre, peso: s.peso, pago_tres: s.pago_tres, pago_dos: s.pago_dos, orden: simbolos.length,
      }).select().single();
      if (data) s.id = data.id;
    }
  };

  el.querySelector('#ed-agregar').addEventListener('click', async () => {
    simbolos.push({ nombre: 'nuevo', peso: 5, pago_tres: 10, pago_dos: 1 });
    await guardarSimbolo(simbolos[simbolos.length - 1]);
    pintarTabla(); calcular();
  });

  // ---------------- Imágenes (fondo + marco) ----------------
  const pintarImagen = (contId, campo, etiqueta) => {
    const cont = el.querySelector(contId);
    const url = juego[campo];
    cont.innerHTML = `
      <p class="hint" style="margin:0 0 6px">${etiqueta}</p>
      <label style="display:block; aspect-ratio:1; border-radius:10px; border:1px dashed var(--border); background:${url ? `center/cover url('${url}')` : 'var(--surface-alt)'}; cursor:pointer; display:flex; align-items:center; justify-content:center; overflow:hidden">
        ${url ? '' : '<span class="hint">Subir imagen</span>'}
        <input type="file" accept="image/*" hidden />
      </label>
    `;
    cont.querySelector('input').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const nuevaUrl = await subirArchivo(archivo, `${campo}/${juego.id}`);
      if (nuevaUrl) {
        await supabase.from('juegos').update({ [campo]: nuevaUrl }).eq('id', juego.id);
        juego[campo] = nuevaUrl;
        pintarImagen(contId, campo, etiqueta);
      }
    });
  };

  // ---------------- Sonidos ----------------
  const cargarSonidos = async () => {
    const { data } = await supabase.from('sonidos').select('*').eq('juego_id', juego.id);
    sonidos = data || [];
    const cont = el.querySelector('#ed-sonidos');
    cont.innerHTML = SONIDOS.map((s) => {
      const existe = sonidos.find((x) => x.tipo === s.tipo);
      return `
        <label style="background:var(--surface-alt); border-radius:10px; padding:12px; text-align:center; cursor:pointer; display:block">
          <div style="font-size:20px">${existe ? '🔊' : '🎵'}</div>
          <p class="hint" style="margin:6px 0 0; color:${existe ? 'var(--accent)' : 'var(--text-dim)'}">${s.etiqueta}</p>
          ${existe ? '<p class="hint" style="margin:2px 0 0; font-size:10px">cargado ✓</p>' : ''}
          <input type="file" accept="audio/*" data-tipo="${s.tipo}" hidden />
        </label>
      `;
    }).join('');

    cont.querySelectorAll('input[data-tipo]').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const archivo = e.target.files?.[0];
        if (!archivo) return;
        const tipo = e.target.dataset.tipo;
        const url = await subirArchivo(archivo, `sonidos/${juego.id}`);
        if (!url) return;
        await supabase.from('sonidos').upsert(
          { juego_id: juego.id, tipo, archivo_url: url },
          { onConflict: 'juego_id,tipo' }
        );
        cargarSonidos();
      });
    });
  };

  // ---------------- Efectos ----------------
  const cargarEfectos = async () => {
    const { data } = await supabase.from('efectos').select('*').eq('juego_id', juego.id).order('created_at');
    efectos = data || [];
    const cont = el.querySelector('#ed-efectos');

    cont.innerHTML = efectos.map((ef, i) => `
      <div style="background:var(--surface-alt); border-radius:10px; padding:12px">
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap">
          <input data-ef="${i}" data-campo="nombre" value="${escapeHtml(ef.nombre)}" placeholder="Nombre del efecto" style="flex:1; min-width:120px" />
          <select data-ef="${i}" data-campo="tipo" style="width:auto">
            <option value="carcasa" ${ef.tipo === 'carcasa' ? 'selected' : ''}>Carcasa (siempre)</option>
            <option value="premio" ${ef.tipo === 'premio' ? 'selected' : ''}>Premio (al ganar)</option>
          </select>
          <button data-borrar-ef="${i}">✕</button>
        </div>
        <div data-solo-premio="${i}" style="display:${ef.tipo === 'premio' ? 'flex' : 'none'}; gap:8px; margin-bottom:8px; flex-wrap:wrap">
          <select data-ef="${i}" data-campo="nivel_premio" style="width:auto">
            ${NIVELES.map((n) => `<option value="${n.valor}" ${ef.nivel_premio === n.valor ? 'selected' : ''}>${n.etiqueta}</option>`).join('')}
          </select>
          <select data-ef="${i}" data-campo="posicion" style="width:auto">
            <option value="linea" ${ef.posicion === 'linea' ? 'selected' : ''}>Sobre la línea</option>
            <option value="pantalla" ${ef.posicion === 'pantalla' ? 'selected' : ''}>Toda la pantalla</option>
          </select>
        </div>
        <textarea data-ef="${i}" data-campo="css" rows="4" style="font-family:monospace; font-size:12px" placeholder="@keyframes ... { }">${escapeHtml(ef.css || '')}</textarea>
      </div>
    `).join('') || '<p class="hint">Sin efectos todavía. Agregá uno y pegá el CSS de la animación.</p>';

    cont.querySelectorAll('[data-campo]').forEach((inp) => {
      inp.addEventListener('change', async (e) => {
        const i = +e.target.dataset.ef, campo = e.target.dataset.campo;
        efectos[i][campo] = e.target.value;
        if (campo === 'tipo') cont.querySelector(`[data-solo-premio="${i}"]`).style.display = e.target.value === 'premio' ? 'flex' : 'none';
        await supabase.from('efectos').update({ [campo]: e.target.value }).eq('id', efectos[i].id);
      });
    });

    cont.querySelectorAll('[data-borrar-ef]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await supabase.from('efectos').delete().eq('id', efectos[+btn.dataset.borrarEf].id);
        cargarEfectos();
      });
    });
  };

  el.querySelector('#ef-nuevo').addEventListener('click', async () => {
    await supabase.from('efectos').insert({
      juego_id: juego.id, nombre: 'Efecto nuevo', tipo: 'carcasa',
      css: '@keyframes brillo {\n  0%,100% { opacity:.3; }\n  50% { opacity:1; }\n}\n.efecto { animation: brillo 2.6s ease-in-out infinite; }',
    });
    cargarEfectos();
  });

  // ---------------- Datos generales ----------------
  const guardarDetalles = async () => {
    const nombre = el.querySelector('#ed-nombre').value.trim();
    if (!nombre) return;
    await supabase.from('juegos').update({
      nombre,
      descripcion: el.querySelector('#ed-desc').value.trim() || null,
      min_bet: Number(el.querySelector('#ed-min').value) || 0,
      max_bet: Number(el.querySelector('#ed-max').value) || 0,
    }).eq('id', juego.id);
    onCambio();
  };

  ['#ed-nombre', '#ed-desc', '#ed-min', '#ed-max'].forEach((sel) => {
    el.querySelector(sel).addEventListener('change', guardarDetalles);
  });

  el.querySelector('#ed-estado').addEventListener('change', async (e) => {
    await supabase.from('juegos').update({ estado: e.target.value }).eq('id', juego.id);
    onCambio();
  });

  el.querySelector('#ed-preview').addEventListener('click', () => {
    renderPreview({ juego, simbolos, sonidos, efectos });
  });

  // Arranque
  cargarSimbolos();
  pintarImagen('#ed-fondo', 'fondo_url', 'Fondo del rodillo');
  pintarImagen('#ed-marco', 'marco_url', 'Marco de la máquina');
  cargarSonidos();
  cargarEfectos();
}

async function subirArchivo(archivo, carpeta) {
  const ruta = `${carpeta}/${Date.now()}-${archivo.name}`;
  const { error } = await supabase.storage.from('assets').upload(ruta, archivo, { upsert: true });
  if (error) { alert('No se pudo subir: ' + error.message); return null; }
  const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
  return data.publicUrl;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
