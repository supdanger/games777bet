import { supabase } from './supabase.js';
import { renderEditor } from './editor.js';
import { renderClientes } from './clientes.js';
import { renderCatalogo } from './catalogo.js';
import { MOTORES_DISPONIBLES, MOTOR_POR_DEFECTO } from '../motor/registro.js';

const ESTADOS = { borrador: 'Borrador', en_prueba: 'En prueba', listo: 'Listo' };

export function renderApp(raiz, session, onSalir) {
  raiz.innerHTML = `
    <div style="max-width:960px; margin:0 auto; padding:20px">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px">
        <h2 style="margin:0; flex:1">gameswin777</h2>
        <button id="ap-catalogo">Catálogo</button>
        <button id="ap-clientes">Clientes</button>
        <button id="ap-salir">Salir</button>
      </div>

      <div id="ap-catalogo-panel"></div>
      <div id="ap-clientes-panel"></div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px" id="ap-lista"></div>

      <div style="display:flex; gap:8px; margin-bottom:20px">
        <input id="ap-nuevo-nombre" placeholder="Nombre del juego nuevo" style="flex:1" />
        <select id="ap-nuevo-motor" style="width:auto">
          ${MOTORES_DISPONIBLES.map((m) => `<option value="${m.valor}" ${m.valor === MOTOR_POR_DEFECTO ? 'selected' : ''}>${m.etiqueta}</option>`).join('')}
        </select>
        <button class="primary" id="ap-crear">Crear juego</button>
        <button id="ap-duplicar" style="display:none">Duplicar el seleccionado</button>
        <button id="ap-eliminar" style="display:none; color:var(--danger)">Eliminar</button>
      </div>

      <div id="ap-editor"></div>
    </div>
  `;

  raiz.querySelector('#ap-salir').addEventListener('click', onSalir);
  raiz.querySelector('#ap-clientes').addEventListener('click', () => {
    renderClientes(raiz.querySelector('#ap-clientes-panel'));
  });
  raiz.querySelector('#ap-catalogo').addEventListener('click', () => {
    renderCatalogo(raiz.querySelector('#ap-catalogo-panel'));
  });

  let juegos = [];
  let seleccionado = null;

  const cargarLista = async () => {
    const { data, error } = await supabase.from('juegos').select('*').order('updated_at', { ascending: false });

    if (error) {
      raiz.querySelector('#ap-lista').innerHTML = `<p class="hint error">${error.message}</p>`;
      return;
    }

    juegos = data || [];

    if (!seleccionado && juegos.length) seleccionado = juegos[0].id;

    const listaEl = raiz.querySelector('#ap-lista');
    listaEl.innerHTML = juegos.map((j) => `
      <button class="pill ${j.id === seleccionado ? 'on' : ''}" data-id="${j.id}">
        ${escapeHtml(j.nombre)}
        <span class="badge ${j.estado}" style="margin-left:6px">${ESTADOS[j.estado]}</span>
      </button>
    `).join('') || '<p class="hint">Todavía no creaste ningún juego.</p>';

    listaEl.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => { seleccionado = btn.dataset.id; cargarLista(); mostrarEditor(); });
    });

    const btnDup = raiz.querySelector('#ap-duplicar');
    if (btnDup) btnDup.style.display = seleccionado ? 'inline-flex' : 'none';
    const btnDel = raiz.querySelector('#ap-eliminar');
    if (btnDel) btnDel.style.display = seleccionado ? 'inline-flex' : 'none';

    mostrarEditor();
  };

  const mostrarEditor = () => {
    const editorEl = raiz.querySelector('#ap-editor');
    const juego = juegos.find((j) => j.id === seleccionado);

    if (!juego) { editorEl.innerHTML = ''; return; }

    renderEditor(editorEl, juego, cargarLista);
  };

  // Duplicar: clona el juego entero (símbolos, imágenes, capas,
  // sonidos, botones, posiciones) para no rearmar todo el layout cada
  // vez. La copia entra como borrador, nunca publicada.
  raiz.querySelector('#ap-duplicar').addEventListener('click', async () => {
    const original = juegos.find((j) => j.id === seleccionado);
    if (!original) return;

    const nombre = prompt('Nombre del juego nuevo:', original.nombre + ' (copia)');
    if (!nombre?.trim()) return;

    const slug = prompt('Slug del juego nuevo (sin espacios, va en la URL):', original.slug + '-copia');
    if (!slug?.trim()) return;

    const btn = raiz.querySelector('#ap-duplicar');
    btn.disabled = true;
    btn.textContent = 'Duplicando...';

    const { data, error } = await supabase.rpc('duplicar_juego', {
      p_juego_id: original.id,
      p_nombre: nombre.trim(),
      p_slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
    });

    btn.disabled = false;
    btn.textContent = 'Duplicar el seleccionado';

    if (error) { alert('No se pudo duplicar: ' + error.message); return; }

    seleccionado = data;
    cargarLista();
  });

  // Eliminar un juego. Borra la fila (la base se lleva en cascada
  // símbolos, sonidos, capas, luces, botones, premios y rondas) y
  // además limpia los archivos del bucket: si no, las imágenes y los
  // sonidos quedarían ocupando espacio para siempre sin que nadie
  // sepa de qué juego eran.
  const CARPETAS_ASSETS = [
    'iconos', 'sonidos', 'digitos', 'premios', 'libres', 'girar', 'botones',
    'fondo_url', 'fondo_pantalla_url', 'marco_url', 'cartel_url', 'portada_url', 'carga_url',
  ];

  const borrarArchivosDelJuego = async (juegoId) => {
    for (const carpeta of CARPETAS_ASSETS) {
      const { data } = await supabase.storage.from('assets').list(`${carpeta}/${juegoId}`);
      if (data?.length) {
        await supabase.storage.from('assets')
          .remove(data.map((f) => `${carpeta}/${juegoId}/${f.name}`));
      }
    }
  };

  raiz.querySelector('#ap-eliminar').addEventListener('click', async () => {
    const juego = juegos.find((j) => j.id === seleccionado);
    if (!juego) return;

    // Un juego publicado está en el catálogo de Win777: borrarlo de
    // golpe le rompe el lanzamiento a quien lo tenga abierto. Primero
    // hay que despublicarlo.
    if (juego.publicado) {
      alert('Este juego está publicado. Despublicalo desde el editor antes de eliminarlo, así deja de aparecer en el catálogo.');
      return;
    }

    // Se pide escribir el nombre a propósito: no hay papelera ni
    // forma de recuperarlo, y un "¿estás seguro?" se acepta sin leer.
    const escrito = prompt(`Esto elimina "${juego.nombre}" y TODO lo que tenga adentro (símbolos, imágenes, sonidos, luces, historial). No se puede deshacer.\n\nEscribí el nombre del juego para confirmar:`);
    if (escrito === null) return;
    if (escrito.trim() !== juego.nombre) {
      alert('El nombre no coincide. No se eliminó nada.');
      return;
    }

    const btn = raiz.querySelector('#ap-eliminar');
    btn.disabled = true;
    btn.textContent = 'Eliminando...';

    // Primero los archivos: si fallara la base, al menos no quedan
    // huérfanos sin dueño. Al revés sí sería un problema.
    await borrarArchivosDelJuego(juego.id);
    const { error } = await supabase.from('juegos').delete().eq('id', juego.id);

    btn.disabled = false;
    btn.textContent = 'Eliminar';

    if (error) { alert('No se pudo eliminar: ' + error.message); return; }

    seleccionado = null;
    cargarLista();
  });

  raiz.querySelector('#ap-crear').addEventListener('click', async () => {
    const input = raiz.querySelector('#ap-nuevo-nombre');
    const nombre = input.value.trim();
    if (!nombre) return;

    const motor = raiz.querySelector('#ap-nuevo-motor').value;
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);

    const { data, error } = await supabase.from('juegos').insert({ nombre, slug, motor }).select().single();

    if (error) { alert(error.message); return; }

    input.value = '';
    seleccionado = data.id;
    cargarLista();
  });

  cargarLista();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
