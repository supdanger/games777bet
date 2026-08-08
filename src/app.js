import { supabase } from './supabase.js';
import { renderEditor } from './editor.js';

const ESTADOS = { borrador: 'Borrador', en_prueba: 'En prueba', listo: 'Listo' };

export function renderApp(raiz, session, onSalir) {
  raiz.innerHTML = `
    <div style="max-width:960px; margin:0 auto; padding:20px">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px">
        <h2 style="margin:0; flex:1">gameswin777</h2>
        <button id="ap-salir">Salir</button>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px" id="ap-lista"></div>

      <div style="display:flex; gap:8px; margin-bottom:20px">
        <input id="ap-nuevo-nombre" placeholder="Nombre del juego nuevo" style="flex:1" />
        <button class="primary" id="ap-crear">Crear juego</button>
      </div>

      <div id="ap-editor"></div>
    </div>
  `;

  raiz.querySelector('#ap-salir').addEventListener('click', onSalir);

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

    mostrarEditor();
  };

  const mostrarEditor = () => {
    const editorEl = raiz.querySelector('#ap-editor');
    const juego = juegos.find((j) => j.id === seleccionado);

    if (!juego) { editorEl.innerHTML = ''; return; }

    renderEditor(editorEl, juego, cargarLista);
  };

  raiz.querySelector('#ap-crear').addEventListener('click', async () => {
    const input = raiz.querySelector('#ap-nuevo-nombre');
    const nombre = input.value.trim();
    if (!nombre) return;

    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);

    const { data, error } = await supabase.from('juegos').insert({ nombre, slug }).select().single();

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
