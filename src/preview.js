// Vista previa jugable: corre el mismo tipo de giro que el motor real,
// con los símbolos, imágenes, efectos y sonidos que estás editando.
// No toca ninguna base de saldo — es plata de mentira, solo para ver
// cómo se siente el juego antes de publicarlo.
//
// Acá mismo se ajusta la posición de marco, grilla y cartel — con un
// selector de "qué estoy editando" arriba del panel, viendo el
// resultado en vivo sobre el tamaño real de un celular.

import { supabase } from './supabase.js';

function elegirSimbolo(simbolos, total) {
  let r = Math.random() * total;
  for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
  return simbolos[simbolos.length - 1];
}

// La grilla se arma columna por columna: grilla[col] son los 3
// símbolos verticales de ESE rodillo (arriba/medio/abajo).
function girar(simbolos) {
  const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
  const grilla = [];
  for (let c = 0; c < 3; c++) {
    grilla.push([elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total), elegirSimbolo(simbolos, total)]);
  }

  // La línea de pago cruza los tres rodillos por la fila del medio —
  // un símbolo de cada columna, no los tres de una sola columna.
  const FILA_PAGO = 1;
  const linea = [grilla[0][FILA_PAGO], grilla[1][FILA_PAGO], grilla[2][FILA_PAGO]];

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
  return { grilla, premio, nivel, filaPago: FILA_PAGO };
}

function celdaHtml(s) {
  if (s.icono_url) return `<img src="${s.icono_url}" style="width:60%; height:60%; object-fit:contain" />`;
  return `<span style="font-size:11px; color:#8fae9a">${s.nombre}</span>`;
}

// Valores por defecto si el juego todavía no tiene posición guardada
// (juegos creados antes de que existiera este ajuste).
function conDefaults(juego) {
  return {
    fondo_pantalla_x: juego.fondo_pantalla_x ?? 50, fondo_pantalla_y: juego.fondo_pantalla_y ?? 50,
    fondo_pantalla_ancho: juego.fondo_pantalla_ancho ?? 100, fondo_pantalla_alto: juego.fondo_pantalla_alto ?? 100,
    marco_x: juego.marco_x ?? 50, marco_y: juego.marco_y ?? 50,
    marco_ancho: juego.marco_ancho ?? 100, marco_alto: juego.marco_alto ?? 100,
    grilla_x: juego.grilla_x ?? 50, grilla_y: juego.grilla_y ?? 46,
    grilla_tamano: juego.grilla_tamano ?? 70,
    cartel_x: juego.cartel_x ?? 50, cartel_y: juego.cartel_y ?? 15,
    cartel_ancho: juego.cartel_ancho ?? 75, cartel_alto: juego.cartel_alto ?? 16,
    fondo_pantalla_blur: juego.fondo_pantalla_blur ?? 0, fondo_pantalla_oscurecer: juego.fondo_pantalla_oscurecer ?? 0,
    marco_blur: juego.marco_blur ?? 0, marco_oscurecer: juego.marco_oscurecer ?? 0,
    cartel_blur: juego.cartel_blur ?? 0, cartel_oscurecer: juego.cartel_oscurecer ?? 0,
    fondo_blur: juego.fondo_blur ?? 0, fondo_oscurecer: juego.fondo_oscurecer ?? 0,
  };
}

const NOMBRE_CAPA = { fondo_pantalla: 'Fondo de pantalla', marco: 'Marco', grilla: 'Grilla', cartel: 'Cartel' };

function ordenPorDefecto(juego) {
  const orden = juego.capas_orden;
  if (Array.isArray(orden) && orden.length === 4) return [...orden];
  return ['fondo_pantalla', 'marco', 'grilla', 'cartel'];
}

// Qué sliders tiene cada capa, y sus rangos. La grilla usa un solo
// "tamaño" (no ancho/alto separado) para que las celdas se mantengan
// cuadradas — deformarla haría que los íconos se vean estirados feo.
// Las demás sí se pueden deformar a propósito.
const CAMPOS_POR_CAPA = {
  fondo_pantalla: [
    ['fondo_pantalla_x', 'Posición X', -20, 120], ['fondo_pantalla_y', 'Posición Y', -20, 120],
    ['fondo_pantalla_ancho', 'Ancho', 20, 250], ['fondo_pantalla_alto', 'Alto', 20, 250],
  ],
  cartel: [
    ['cartel_x', 'Posición X', -20, 120], ['cartel_y', 'Posición Y', -20, 120],
    ['cartel_ancho', 'Ancho', 10, 200], ['cartel_alto', 'Alto', 5, 150],
  ],
  grilla: [
    ['grilla_x', 'Posición X', -20, 120], ['grilla_y', 'Posición Y', -20, 120],
    ['grilla_tamano', 'Tamaño', 30, 100],
  ],
  marco: [
    ['marco_x', 'Posición X', -50, 150], ['marco_y', 'Posición Y', -50, 150],
    ['marco_ancho', 'Ancho', 20, 250], ['marco_alto', 'Alto', 20, 250],
  ],
};

// Nitidez y oscurecimiento: mismo patrón que los de posición, pero
// con su propia unidad (px para el blur, % para oscurecer). Para la
// grilla, en realidad afectan al fondo del rodillo, no a la grilla
// en sí — no queremos difuminar los íconos de las frutas.
const FILTROS_POR_CAPA = {
  fondo_pantalla: [['fondo_pantalla_blur', 'Nitidez (blur)', 0, 20, 'px'], ['fondo_pantalla_oscurecer', 'Oscurecer', 0, 100, '%']],
  marco: [['marco_blur', 'Nitidez (blur)', 0, 20, 'px'], ['marco_oscurecer', 'Oscurecer', 0, 100, '%']],
  cartel: [['cartel_blur', 'Nitidez (blur)', 0, 20, 'px'], ['cartel_oscurecer', 'Oscurecer', 0, 100, '%']],
  grilla: [['fondo_blur', 'Nitidez del fondo del rodillo', 0, 20, 'px'], ['fondo_oscurecer', 'Oscurecer fondo del rodillo', 0, 100, '%']],
};

const NIVELES_PREMIO = [
  { valor: 'dos_iguales', etiqueta: 'Dos iguales' },
  { valor: 'tres_iguales', etiqueta: 'Tres iguales' },
  { valor: 'premio_mayor', etiqueta: 'Premio mayor' },
];

export async function renderPreview({ juego, simbolos, sonidos, efectos }) {
  if (!simbolos.length) { alert('Agregá símbolos antes de probar el juego.'); return; }

  const pos = conDefaults(juego);
  let ordenCapas = ordenPorDefecto(juego);
  let capaActual = 'grilla';

  // Una imagen y posición por nivel de premio — igual que ya
  // funciona con los sonidos (premio chico / premio grande).
  const { data: filasPremio } = await supabase.from('premios_visuales').select('*').eq('juego_id', juego.id);
  const posPremio = {};
  NIVELES_PREMIO.forEach(({ valor }) => {
    const fila = (filasPremio || []).find((f) => f.nivel_premio === valor);
    posPremio[valor] = {
      id: fila?.id || null, imagen_url: fila?.imagen_url || null,
      x: fila?.x ?? 50, y: fila?.y ?? 50, ancho: fila?.ancho ?? 60, alto: fila?.alto ?? 30,
      blur: fila?.blur ?? 0, oscurecer: fila?.oscurecer ?? 0,
      imagen_x: fila?.imagen_x ?? 50, imagen_y: fila?.imagen_y ?? 50, imagen_tamano: fila?.imagen_tamano ?? 60,
      monto_x: fila?.monto_x ?? 50, monto_y: fila?.monto_y ?? 50,
      monto_alto: fila?.monto_alto ?? 44, monto_espaciado: fila?.monto_espaciado ?? 4,
    };
  });

  // Íconos de dígitos (0-9 y el punto) para mostrar el monto ganado
  // con imágenes en vez de texto. Lo que no tenga ícono subido cae
  // en el texto de siempre — nunca queda un carácter sin mostrar.
  const { data: filasDigitos } = await supabase.from('digitos').select('*').eq('juego_id', juego.id);
  const mapaDigitos = {};
  (filasDigitos || []).forEach((d) => { if (d.imagen_url) mapaDigitos[d.caracter] = d.imagen_url; });
  let nivelPremioActual = 'dos_iguales';
  let montoDemoTexto = null;

  // Imágenes libres: cantidad variable, cada una con su fila propia
  // (a diferencia de fondo/marco/cartel que son un campo fijo cada
  // uno). Se guardan de a una, igual que el premio por nivel.
  const { data: filasLibres } = await supabase.from('capas_libres').select('*').eq('juego_id', juego.id).order('orden');
  let capasLibres = filasLibres || [];
  let libreActual = capasLibres[0]?.id ?? null;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; gap:12px; flex-wrap:wrap';

  const cssEfectos = efectos.map((ef) => ef.css || '').join('\n');
  const audios = {};
  sonidos.forEach((s) => { audios[s.tipo] = new Audio(s.archivo_url); });
  if (audios.musica_fondo) { audios.musica_fondo.loop = true; audios.musica_fondo.volume = 0.5; }

  const fondoBg = juego.fondo_url ? `center/cover url('${juego.fondo_url}')` : 'var(--surface-alt)';

  // Sin overflow:hidden a propósito: si algo se pasa del borde por
  // estar mal ajustado, tenés que VERLO pasarse, no que quede
  // cortado en silencio. El z-index de cada capa lo pone el JS según
  // el orden elegido — acá no van fijos.
  overlay.innerHTML = `
    <style>${cssEfectos}</style>
    <div style="display:flex; flex-direction:column; align-items:center">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; gap:8px; width:420px">
        <button id="pv-ajustar">⚙ Ajustar posición</button>
        <button id="pv-cerrar">✕ Cerrar prueba</button>
      </div>
      <div id="pv-escala-wrap" style="width:420px; height:860px; flex-shrink:0">
      <div id="pv-marco-cap" style="width:420px; height:860px; transform-origin:top center; background:var(--surface); border:1px dashed var(--border); border-radius:20px; padding:22px; position:relative; overflow:visible">
        ${juego.fondo_pantalla_url ? `<img id="pv-img-fondo-pantalla" src="${juego.fondo_pantalla_url}" style="position:absolute; object-fit:fill" />` : ''}
        ${juego.marco_url ? `<img id="pv-img-marco" src="${juego.marco_url}" style="position:absolute; object-fit:fill" />` : ''}

        <div style="display:flex; align-items:center; gap:8px; position:relative; z-index:10">
          <div style="width:28px"></div>
          <p style="flex:1; text-align:center; font-weight:600; margin:0; letter-spacing:.04em">${escapeHtml(juego.nombre).toUpperCase()}</p>
          <button id="pv-info" aria-label="Ver información del juego" style="width:28px; height:28px; padding:0; border-radius:50%; flex-shrink:0">ℹ</button>
        </div>

        <div id="pv-grilla" style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; border-radius:12px; padding:8px; position:absolute; overflow:hidden; aspect-ratio:1">
          <div id="pv-grilla-fondo" style="position:absolute; inset:0; background:${fondoBg}; z-index:0"></div>
          <div class="pv-columna" data-col="0" style="position:relative; overflow:hidden; z-index:1"><div class="pv-cinta" id="pv-cinta-0" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div class="pv-columna" data-col="1" style="position:relative; overflow:hidden; z-index:1"><div class="pv-cinta" id="pv-cinta-1" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div class="pv-columna" data-col="2" style="position:relative; overflow:hidden; z-index:1"><div class="pv-cinta" id="pv-cinta-2" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div id="pv-efecto-premio" style="position:absolute; inset:0; pointer-events:none; opacity:0; z-index:2"></div>
        </div>

        ${juego.cartel_url ? `<img id="pv-img-cartel" src="${juego.cartel_url}" style="position:absolute; object-fit:fill" />` : ''}

        <div id="pv-capas-libres" style="position:absolute; inset:0; z-index:8; pointer-events:none"></div>

        <div id="pv-premio-popup" style="position:absolute; z-index:15; display:none; border-radius:12px; background:rgba(0,0,0,.55); transition:opacity .25s; opacity:0; transform:translate(-50%,-50%)">
          <img id="pv-img-premio" style="position:absolute; z-index:0; display:none" />
          <strong id="pv-premio-monto" style="position:absolute; z-index:1; font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); white-space:nowrap"></strong>
        </div>

        <div style="display:flex; align-items:flex-end; gap:10px; position:absolute; left:22px; right:22px; bottom:22px; z-index:10">
          <div style="flex:1">
            <p class="hint" style="margin:0">Saldo de prueba</p>
            <strong id="pv-saldo" style="font-size:18px">10.000</strong>
          </div>
          <div style="display:flex; align-items:center; gap:6px">
            <button id="pv-apuesta-menos" aria-label="Bajar apuesta" style="width:28px; height:28px; padding:0">−</button>
            <div style="text-align:center; min-width:66px">
              <p class="hint" style="margin:0">Apuesta</p>
              <strong id="pv-apuesta" style="font-size:15px"></strong>
            </div>
            <button id="pv-apuesta-mas" aria-label="Subir apuesta" style="width:28px; height:28px; padding:0">+</button>
          </div>
          <div id="pv-turbo" style="display:flex; gap:3px"></div>
        </div>

        <button id="pv-girar" style="position:absolute; z-index:11; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden">
          <span id="pv-girar-texto" style="font-size:14px">Girar</span>
          <img id="pv-girar-img" style="display:none; object-fit:contain" />
        </button>
      </div>
      </div>
    </div>

    <div id="pv-panel-ajuste" class="card" style="display:none; width:260px; max-height:min(860px, 92vh); overflow:auto"></div>
  `;

  document.body.appendChild(overlay);

  // Misma escala que del lado del jugador: la pantalla mide 420x860
  // fijo por dentro y se achica entera si no entra. Así lo que ajustás
  // acá es exactamente lo que se ve en el celular, sin sorpresas.
  const capElPv = overlay.querySelector('#pv-marco-cap');
  const wrapPv = overlay.querySelector('#pv-escala-wrap');
  const ajustarEscalaPv = () => {
    const escala = Math.min(1, (window.innerHeight - 90) / 860);
    capElPv.style.transform = `scale(${escala})`;
    wrapPv.style.height = (860 * escala) + 'px';
    wrapPv.style.width = (420 * escala) + 'px';
    capElPv.style.marginLeft = ((420 * escala - 420) / 2) + 'px';
  };
  ajustarEscalaPv();
  window.addEventListener('resize', ajustarEscalaPv);

  // ---------------- Posicionamiento y orden de las cuatro capas ----------------
  const ELEMENTO_CAPA = {
    fondo_pantalla: overlay.querySelector('#pv-img-fondo-pantalla'),
    marco: overlay.querySelector('#pv-img-marco'),
    grilla: overlay.querySelector('#pv-grilla'),
    cartel: overlay.querySelector('#pv-img-cartel'),
  };
  const grillaFondoEl = overlay.querySelector('#pv-grilla-fondo');
  const premioPopupEl = overlay.querySelector('#pv-premio-popup');
  const imgPremio = overlay.querySelector('#pv-img-premio');
  const montoPremioEl = overlay.querySelector('#pv-premio-monto');
  const capasLibresEl = overlay.querySelector('#pv-capas-libres');

  const aplicarOrden = () => {
    ordenCapas.forEach((capa, i) => {
      if (ELEMENTO_CAPA[capa]) ELEMENTO_CAPA[capa].style.zIndex = i;
    });
  };

  const aplicarPosiciones = () => {
    const posicionar = (el, x, y, ancho, alto) => {
      if (!el) return;
      Object.assign(el.style, {
        left: x + '%', top: y + '%', width: ancho + '%',
        ...(alto !== undefined ? { height: alto + '%' } : {}),
        transform: 'translate(-50%,-50%)',
      });
    };
    posicionar(ELEMENTO_CAPA.fondo_pantalla, pos.fondo_pantalla_x, pos.fondo_pantalla_y, pos.fondo_pantalla_ancho, pos.fondo_pantalla_alto);
    posicionar(ELEMENTO_CAPA.marco, pos.marco_x, pos.marco_y, pos.marco_ancho, pos.marco_alto);
    posicionar(ELEMENTO_CAPA.cartel, pos.cartel_x, pos.cartel_y, pos.cartel_ancho, pos.cartel_alto);
    posicionar(ELEMENTO_CAPA.grilla, pos.grilla_x, pos.grilla_y, pos.grilla_tamano);
  };

  // Cada imagen libre mantiene su proporción original (ancho fijado
  // por el slider, alto automático) y puede rotar sobre su propio
  // centro — el ángulo va en el mismo transform que el centrado, no
  // pisa la posición.
  const aplicarCapasLibres = () => {
    capasLibresEl.innerHTML = capasLibres.map((c) => c.imagen_url ? `
      <img src="${c.imagen_url}" style="position:absolute; left:${c.x}%; top:${c.y}%; width:${c.tamano}%; height:auto; transform:translate(-50%,-50%) rotate(${c.angulo}deg); filter:${filtroCss(c.blur, c.oscurecer)}" />
    ` : '').join('');
  };

  // El cuadro de premio tiene su propia posición POR NIVEL — se
  // posiciona igual aunque esté oculto, así el panel de ajuste lo
  // puede mostrar en vivo sin tener que ganar. Recibe el nivel como
  // parámetro (no lee una variable externa) para que, al ganar de
  // verdad, siempre use el nivel que ganó — no la pestaña que
  // tengas abierta mientras estás editando otra cosa.
  const aplicarPosicionPremio = (nivel) => {
    const p = posPremio[nivel];
    premioPopupEl.style.left = p.x + '%';
    premioPopupEl.style.top = p.y + '%';
    premioPopupEl.style.width = p.ancho + '%';
    premioPopupEl.style.height = p.alto + '%';
    if (p.imagen_url) {
      imgPremio.src = p.imagen_url;
      imgPremio.style.display = 'block';
      imgPremio.style.filter = filtroCss(p.blur, p.oscurecer);
    } else {
      imgPremio.style.display = 'none';
    }
    // Ancho fijado por el slider, alto automático (mantiene las
    // proporciones originales del archivo, nunca se deforma), y
    // posición propia en % del cuadro — puede salirse del borde a
    // propósito, no se recorta.
    Object.assign(imgPremio.style, {
      left: p.imagen_x + '%', top: p.imagen_y + '%', width: p.imagen_tamano + '%', height: 'auto',
      transform: 'translate(-50%,-50%)',
    });
    Object.assign(montoPremioEl.style, {
      left: p.monto_x + '%', top: p.monto_y + '%', transform: 'translate(-50%,-50%)',
    });
    if (montoDemoTexto !== null) pintarMonto(montoPremioEl, montoDemoTexto, p.monto_alto, p.monto_espaciado);
  };

  // Arma el monto carácter por carácter: si el carácter tiene ícono
  // subido lo muestra como imagen (sin deformar, alto fijo, ancho
  // automático); si no, cae en texto normal — así nunca falta un
  // carácter aunque todavía no hayas subido todos los íconos.
  const pintarMonto = (elemento, texto, alto, espaciado) => {
    elemento.style.display = 'flex';
    elemento.style.alignItems = 'flex-end';
    elemento.style.flexWrap = 'nowrap';
    elemento.style.gap = espaciado + 'px';
    elemento.innerHTML = [...texto].map((c) => {
      const url = mapaDigitos[c];
      if (url) return `<img src="${url}" style="height:${alto}px; width:auto; display:block" />`;
      return `<span style="font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5)">${escapeHtml(c)}</span>`;
    }).join('');
  };

  // Blur + oscurecer, con filter: cada imagen puede tener su propio
  // nivel. Para el fondo del rodillo, el filtro va en la sub-capa
  // de atrás (#pv-grilla-fondo), no en la grilla entera — si no, los
  // íconos de las frutas se difuminarían también.
  const filtroCss = (blur, oscurecer) => `blur(${blur}px) brightness(${1 - oscurecer / 100})`;

  const aplicarFiltros = () => {
    if (ELEMENTO_CAPA.fondo_pantalla) ELEMENTO_CAPA.fondo_pantalla.style.filter = filtroCss(pos.fondo_pantalla_blur, pos.fondo_pantalla_oscurecer);
    if (ELEMENTO_CAPA.marco) ELEMENTO_CAPA.marco.style.filter = filtroCss(pos.marco_blur, pos.marco_oscurecer);
    if (ELEMENTO_CAPA.cartel) ELEMENTO_CAPA.cartel.style.filter = filtroCss(pos.cartel_blur, pos.cartel_oscurecer);
    grillaFondoEl.style.filter = filtroCss(pos.fondo_blur, pos.fondo_oscurecer);
  };

  aplicarPosicionPremio(nivelPremioActual);
  aplicarPosiciones();
  aplicarOrden();
  aplicarFiltros();
  aplicarCapasLibres();


  // ---------------- Panel de ajuste, con selector de capa y orden ----------------
  const panel = overlay.querySelector('#pv-panel-ajuste');
  const btnAjustar = overlay.querySelector('#pv-ajustar');

  const hayImagen = {
    fondo_pantalla: !!juego.fondo_pantalla_url, grilla: true,
    marco: !!juego.marco_url, cartel: !!juego.cartel_url,
  };

  const pintarPanel = () => {
    panel.innerHTML = `
      <strong>Ajustar posición</strong>
      <p class="hint" style="margin:4px 0 10px">Se ve en vivo a la izquierda.</p>

      <p style="font-weight:600; margin:0 0 6px; font-size:13px">Estoy ajustando</p>
      <div style="display:flex; gap:4px; margin-bottom:14px; flex-wrap:wrap">
        <button data-capa="fondo_pantalla" class="pv-tab">Fondo</button>
        <button data-capa="marco" class="pv-tab">Marco</button>
        <button data-capa="grilla" class="pv-tab">Grilla</button>
        <button data-capa="cartel" class="pv-tab">Cartel</button>
        <button data-capa="libres" class="pv-tab">Libres</button>
        <button data-capa="girar" class="pv-tab">Girar</button>
        <button data-capa="premio" class="pv-tab">Premio</button>
      </div>

      <div id="pv-sliders"></div>

      <div id="pv-orden-wrap" style="border-top:1px solid var(--border); margin-top:14px; padding-top:14px">
        <p style="font-weight:600; margin:0 0 4px; font-size:13px">Orden de capas</p>
        <p class="hint" style="margin:0 0 8px">De atrás hacia adelante. La de arriba de la lista es la más al fondo.</p>
        <div id="pv-orden"></div>
      </div>

      <button class="primary" id="pv-guardar" style="width:100%; margin-top:14px">Guardar posición</button>
      <p id="pv-guardar-msg" class="hint"></p>
    `;

    panel.querySelectorAll('.pv-tab').forEach((btn) => {
      const activo = btn.dataset.capa === capaActual;
      btn.style.borderColor = activo ? 'var(--accent)' : 'var(--border)';
      btn.style.color = activo ? 'var(--accent)' : 'var(--text)';
      btn.style.flex = '1 1 40%';
      btn.style.fontSize = '12px';
      btn.addEventListener('click', () => { capaActual = btn.dataset.capa; pintarPanel(); });
    });

    const slidersEl = panel.querySelector('#pv-sliders');

    // El premio no comparte el patrón de las otras cuatro: tiene un
    // nivel por elegir (dos iguales / tres iguales / mayor), y se
    // guarda aparte, en su propia tabla — no participa del orden de
    // capas ni del botón "Guardar posición" general.
    if (capaActual === 'premio') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelPremio(slidersEl);
      return;
    }

    // Las imágenes libres tampoco comparten el patrón de las otras
    // cuatro: son una lista de cantidad variable con su propia
    // tabla, cada una se sube/guarda/borra de a una.
    if (capaActual === 'libres') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelLibres(slidersEl);
      return;
    }

    if (capaActual === 'girar') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelGirar(slidersEl);
      return;
    }

    if (!hayImagen[capaActual]) {
      slidersEl.innerHTML = `<p class="hint">Este juego todavía no tiene ${NOMBRE_CAPA[capaActual].toLowerCase()}. Subilo desde el editor primero.</p>`;
    } else {
      const sliderHtml = ([clave, etiqueta, min, max, unidad]) => `
        <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="out-${clave}">${pos[clave]}${unidad || '%'}</span>
          <input type="range" min="${min}" max="${max}" value="${pos[clave]}" data-clave="${clave}" />
        </label>
      `;

      slidersEl.innerHTML = `
        ${CAMPOS_POR_CAPA[capaActual].map((c) => sliderHtml(c)).join('')}
        <p style="font-size:12px; color:var(--text-dim); margin:12px 0 8px">Nitidez y oscurecimiento</p>
        ${FILTROS_POR_CAPA[capaActual].map((c) => sliderHtml(c)).join('')}
      `;

      slidersEl.querySelectorAll('input[type="range"]').forEach((input) => {
        input.addEventListener('input', () => {
          const clave = input.dataset.clave;
          pos[clave] = Number(input.value);
          const esFiltro = clave.includes('blur') || clave.includes('oscurecer');
          panel.querySelector(`#out-${clave}`).textContent = input.value + (esFiltro && clave.includes('blur') ? 'px' : '%');
          aplicarPosiciones();
          aplicarFiltros();
        });
      });
    }

    // ---------------- Orden de capas: subir/bajar con flechas ----------------
    const pintarOrden = () => {
      const ordenEl = panel.querySelector('#pv-orden');
      ordenEl.innerHTML = ordenCapas.map((capa, i) => `
        <div style="display:flex; align-items:center; gap:6px; background:var(--surface-alt); border-radius:8px; padding:6px 8px; margin-bottom:4px">
          <span style="flex:1; font-size:12px">${NOMBRE_CAPA[capa]}</span>
          <button data-subir="${i}" aria-label="Subir" ${i === ordenCapas.length - 1 ? 'disabled' : ''} style="padding:2px 8px">↑</button>
          <button data-bajar="${i}" aria-label="Bajar" ${i === 0 ? 'disabled' : ''} style="padding:2px 8px">↓</button>
        </div>
      `).join('');

      ordenEl.querySelectorAll('[data-subir]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.subir);
          [ordenCapas[i], ordenCapas[i + 1]] = [ordenCapas[i + 1], ordenCapas[i]];
          aplicarOrden(); pintarOrden();
        });
      });
      ordenEl.querySelectorAll('[data-bajar]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.bajar);
          [ordenCapas[i], ordenCapas[i - 1]] = [ordenCapas[i - 1], ordenCapas[i]];
          aplicarOrden(); pintarOrden();
        });
      });
    };
    pintarOrden();

    panel.querySelector('#pv-guardar').addEventListener('click', async () => {
      const msgEl = panel.querySelector('#pv-guardar-msg');
      msgEl.textContent = 'Guardando...';
      const { error } = await supabase.from('juegos').update({ ...pos, capas_orden: ordenCapas }).eq('id', juego.id);
      msgEl.textContent = error ? error.message : 'Guardado ✓';
      Object.assign(juego, pos, { capas_orden: ordenCapas });
    });
  };

  pintarPanel();

  btnAjustar.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  // ---------------- Juego ----------------
  let saldo = 10000;
  let girando = false;
  const pasoApuesta = Number(juego.paso_apuesta) || 500;
  const apuestaMin = Number(juego.min_bet) || 1000;
  const apuestaMax = Number(juego.max_bet) || 100000;
  let apuesta = apuestaMin;
  let velocidad = 1;
  const cintas = [0, 1, 2].map((i) => overlay.querySelector(`#pv-cinta-${i}`));
  const efectoPremio = overlay.querySelector('#pv-efecto-premio');
  const btnGirar = overlay.querySelector('#pv-girar');
  const girarImgEl = overlay.querySelector('#pv-girar-img');
  const girarTextoEl = overlay.querySelector('#pv-girar-texto');

  const posGirar = {
    girar_x: juego.girar_x ?? 50, girar_y: juego.girar_y ?? 90,
    girar_tamano: juego.girar_tamano ?? 64,
    girar_imagen_tamano: juego.girar_imagen_tamano ?? 70,
    girar_imagen_url: juego.girar_imagen_url || null,
    girar_sin_fondo: juego.girar_sin_fondo ?? false,
  };

  // El botón es un círculo posicionable: la imagen va adentro con su
  // propio tamaño (en % del botón) para poder calzarla sin deformar.
  const aplicarGirar = () => {
    const tam = posGirar.girar_tamano;
    Object.assign(btnGirar.style, {
      left: posGirar.girar_x + '%', top: posGirar.girar_y + '%',
      transform: 'translate(-50%,-50%)',
      width: tam + 'px', height: tam + 'px',
      background: posGirar.girar_sin_fondo ? 'transparent' : '',
      border: posGirar.girar_sin_fondo ? 'none' : '',
    });
    if (posGirar.girar_imagen_url) {
      girarImgEl.src = posGirar.girar_imagen_url;
      girarImgEl.style.display = 'block';
      girarImgEl.style.width = (tam * posGirar.girar_imagen_tamano / 100) + 'px';
      girarImgEl.style.height = (tam * posGirar.girar_imagen_tamano / 100) + 'px';
      girarTextoEl.style.display = 'none';
    } else {
      girarImgEl.style.display = 'none';
      girarTextoEl.style.display = 'block';
    }
  };
  aplicarGirar();

  const apuestaEl = overlay.querySelector('#pv-apuesta');
  const pintarApuesta = () => { apuestaEl.textContent = apuesta.toLocaleString('es-PY'); };
  pintarApuesta();

  overlay.querySelector('#pv-apuesta-mas').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.min(apuestaMax, apuesta + pasoApuesta);
    pintarApuesta();
  });
  overlay.querySelector('#pv-apuesta-menos').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.max(apuestaMin, apuesta - pasoApuesta);
    pintarApuesta();
  });

  // La velocidad solo acorta la animación: el resultado ya está
  // decidido antes de que el primer rodillo se mueva.
  const turboEl = overlay.querySelector('#pv-turbo');
  const pintarTurbo = () => {
    turboEl.innerHTML = [1, 2, 3].map((v) => `
      <button data-v="${v}" style="padding:2px 7px; font-size:11px; ${v === velocidad ? 'border-color:var(--accent); color:var(--accent)' : ''}">x${v}</button>
    `).join('');
    turboEl.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { velocidad = Number(b.dataset.v); pintarTurbo(); });
    });
  };
  pintarTurbo();

  const cerrar = () => { Object.values(audios).forEach((a) => a.pause()); overlay.remove(); };
  overlay.querySelector('#pv-cerrar').addEventListener('click', cerrar);

  overlay.querySelector('#pv-info').addEventListener('click', () => mostrarTablaPagos(overlay, simbolos, juego));

  // Cuadro de premio: aparece con el monto y la imagen/posición del
  // nivel que ganó, y se esconde solo a los pocos segundos (o si
  // arranca un giro nuevo antes).
  let timerPremio = null;
  function mostrarPremio(monto, nivel) {
    clearTimeout(timerPremio);
    montoDemoTexto = '+' + monto.toLocaleString('es-PY');
    aplicarPosicionPremio(nivel);
    premioPopupEl.style.display = 'flex';
    void premioPopupEl.offsetWidth;
    premioPopupEl.style.opacity = '1';
    timerPremio = setTimeout(ocultarPremio, 2500);
  }
  function ocultarPremio() {
    premioPopupEl.style.opacity = '0';
    setTimeout(() => { premioPopupEl.style.display = 'none'; }, 250);
  }

  async function subirArchivoPremio(archivo, nivel) {
    const ruta = `premios/${juego.id}/${nivel}-${Date.now()}-${archivo.name}`;
    const { error } = await supabase.storage.from('assets').upload(ruta, archivo, { upsert: true });
    if (error) { alert('No se pudo subir: ' + error.message); return null; }
    const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
    return data.publicUrl;
  }

  // Sub-panel de la pestaña "Premio": elegís el nivel, subís su
  // imagen, ajustás su posición, y se guarda aparte — en
  // premios_visuales, no en el botón general de "Guardar posición".
  function pintarPanelPremio(container) {
    const p = posPremio[nivelPremioActual];

    const sliderHtml = (campo, etiqueta, min, max, unidad) => `
      <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="pp-out-${campo}">${p[campo]}${unidad}</span>
        <input type="range" min="${min}" max="${max}" value="${p[campo]}" data-campo="${campo}" />
      </label>
    `;

    container.innerHTML = `
      <div style="display:flex; gap:4px; margin-bottom:10px">
        ${NIVELES_PREMIO.map((n) => `<button data-nivel="${n.valor}" class="pv-subtab" style="flex:1; font-size:11px">${n.etiqueta}</button>`).join('')}
      </div>

      <label style="display:block; aspect-ratio:2; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:8px">
        ${p.imagen_url ? `<img src="${p.imagen_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Subir imagen</span>'}
        <input type="file" accept="image/*" hidden id="pp-subir" />
      </label>

      <p style="font-size:12px; color:var(--text-dim); margin:0 0 8px">Cuadro</p>
      ${sliderHtml('x', 'Posición X', -20, 120, '%')}
      ${sliderHtml('y', 'Posición Y', -20, 120, '%')}
      ${sliderHtml('ancho', 'Ancho', 15, 150, '%')}
      ${sliderHtml('alto', 'Alto', 10, 100, '%')}
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Nitidez y oscurecimiento</p>
      ${sliderHtml('blur', 'Nitidez (blur)', 0, 20, 'px')}
      ${sliderHtml('oscurecer', 'Oscurecer', 0, 100, '%')}
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Imagen (independiente del cuadro)</p>
      ${sliderHtml('imagen_x', 'Posición X', -20, 120, '%')}
      ${sliderHtml('imagen_y', 'Posición Y', -20, 120, '%')}
      ${sliderHtml('imagen_tamano', 'Tamaño', 15, 150, '%')}
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Monto ganado (independiente de la imagen)</p>
      ${sliderHtml('monto_x', 'Posición X', -20, 120, '%')}
      ${sliderHtml('monto_y', 'Posición Y', -20, 120, '%')}
      ${sliderHtml('monto_alto', 'Alto', 16, 80, 'px')}
      ${sliderHtml('monto_espaciado', 'Espaciado', 0, 16, 'px')}

      <button id="pp-probar" style="width:100%; margin-top:6px">Probar</button>
      <button class="primary" id="pp-guardar" style="width:100%; margin-top:8px">Guardar este nivel</button>
      <p id="pp-guardar-msg" class="hint"></p>
    `;

    container.querySelectorAll('.pv-subtab').forEach((btn) => {
      const activo = btn.dataset.nivel === nivelPremioActual;
      btn.style.borderColor = activo ? 'var(--accent)' : 'var(--border)';
      btn.style.color = activo ? 'var(--accent)' : 'var(--text)';
      btn.addEventListener('click', () => {
        nivelPremioActual = btn.dataset.nivel;
        aplicarPosicionPremio(nivelPremioActual);
        pintarPanelPremio(container);
      });
    });

    container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        posPremio[nivelPremioActual][campo] = Number(input.value);
        const unidad = (campo === 'blur' || campo === 'monto_alto' || campo === 'monto_espaciado') ? 'px' : '%';
        container.querySelector(`#pp-out-${campo}`).textContent = input.value + unidad;
        aplicarPosicionPremio(nivelPremioActual);
      });
    });

    container.querySelector('#pp-probar').addEventListener('click', () => mostrarPremio(123000, nivelPremioActual));

    container.querySelector('#pp-subir').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const url = await subirArchivoPremio(archivo, nivelPremioActual);
      if (url) {
        posPremio[nivelPremioActual].imagen_url = url;
        aplicarPosicionPremio(nivelPremioActual);
        pintarPanelPremio(container);
      }
    });

    container.querySelector('#pp-guardar').addEventListener('click', async () => {
      const msgEl = container.querySelector('#pp-guardar-msg');
      msgEl.textContent = 'Guardando...';
      const datos = posPremio[nivelPremioActual];
      const { data, error } = await supabase.from('premios_visuales')
        .upsert(
          { id: datos.id || undefined, juego_id: juego.id, nivel_premio: nivelPremioActual,
            imagen_url: datos.imagen_url, x: datos.x, y: datos.y, ancho: datos.ancho, alto: datos.alto,
            blur: datos.blur, oscurecer: datos.oscurecer,
            imagen_x: datos.imagen_x, imagen_y: datos.imagen_y, imagen_tamano: datos.imagen_tamano,
            monto_x: datos.monto_x, monto_y: datos.monto_y,
            monto_alto: datos.monto_alto, monto_espaciado: datos.monto_espaciado },
          { onConflict: 'juego_id,nivel_premio' }
        ).select().single();

      if (error) { msgEl.textContent = error.message; return; }
      datos.id = data.id;
      msgEl.textContent = 'Guardado ✓';
    });
  }

  async function subirArchivoLibre(archivo, id) {    const ruta = `libres/${juego.id}/${id}-${Date.now()}-${archivo.name}`;
    const { error } = await supabase.storage.from('assets').upload(ruta, archivo, { upsert: true });
    if (error) { alert('No se pudo subir: ' + error.message); return null; }
    const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
    return data.publicUrl;
  }

  // Sub-panel de la pestaña "Libres": a diferencia de las otras
  // capas (un slot fijo cada una), acá la cantidad es variable —
  // "Agregar" y "Quitar" tocan la base al toque para no dejar
  // altas/bajas sueltas sin guardar; los ajustes de posición/tamaño/
  // ángulo se guardan con el botón, igual que el premio por nivel.
  async function subirArchivoGirar(archivo) {
    const ruta = `girar/${juego.id}/${Date.now()}-${archivo.name}`;
    const { error } = await supabase.storage.from('assets').upload(ruta, archivo, { upsert: true });
    if (error) { alert('No se pudo subir: ' + error.message); return null; }
    const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
    return data.publicUrl;
  }

  // Sub-panel "Girar": posición y tamaño del botón, imagen opcional
  // con su propio tamaño (para calzarla al botón sin deformarla), y
  // el paso con el que suben/bajan los botones de apuesta.
  function pintarPanelGirar(container) {
    const sliderHtml = (campo, etiqueta, min, max, unidad, valor) => `
      <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="pg-out-${campo}">${valor}${unidad}</span>
        <input type="range" min="${min}" max="${max}" value="${valor}" data-campo="${campo}" />
      </label>
    `;

    container.innerHTML = `
      <label style="display:block; height:70px; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:10px">
        ${posGirar.girar_imagen_url ? `<img src="${posGirar.girar_imagen_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Subir imagen del botón</span>'}
        <input type="file" accept="image/*" hidden id="pg-subir" />
      </label>
      ${posGirar.girar_imagen_url ? '<button id="pg-quitar-img" style="width:100%; margin-bottom:10px; font-size:12px">Quitar imagen</button>' : ''}
      ${sliderHtml('girar_x', 'Posición X', 0, 100, '%', posGirar.girar_x)}
      ${sliderHtml('girar_y', 'Posición Y', 0, 100, '%', posGirar.girar_y)}
      ${sliderHtml('girar_tamano', 'Tamaño del botón', 36, 140, 'px', posGirar.girar_tamano)}
      ${sliderHtml('girar_imagen_tamano', 'Tamaño de la imagen', 20, 140, '%', posGirar.girar_imagen_tamano)}
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin:10px 0">
        <input type="checkbox" id="pg-sinfondo" ${posGirar.girar_sin_fondo ? 'checked' : ''} /> Ocultar el fondo del botón
      </label>
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Apuesta</p>
      <label style="display:block; margin-bottom:8px; font-size:12px">Sube y baja de a
        <input type="number" id="pg-paso" value="${pasoApuesta}" min="1" style="width:100%" />
      </label>
      <button class="primary" id="pg-guardar" style="width:100%; margin-top:6px">Guardar</button>
      <p id="pg-msg" class="hint"></p>
    `;

    container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        posGirar[campo] = Number(input.value);
        const unidad = campo === 'girar_tamano' ? 'px' : '%';
        container.querySelector(`#pg-out-${campo}`).textContent = input.value + unidad;
        aplicarGirar();
      });
    });

    container.querySelector('#pg-sinfondo').addEventListener('change', (e) => {
      posGirar.girar_sin_fondo = e.target.checked;
      aplicarGirar();
    });

    container.querySelector('#pg-subir').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const url = await subirArchivoGirar(archivo);
      if (url) { posGirar.girar_imagen_url = url; aplicarGirar(); pintarPanelGirar(container); }
    });

    container.querySelector('#pg-quitar-img')?.addEventListener('click', () => {
      posGirar.girar_imagen_url = null;
      aplicarGirar();
      pintarPanelGirar(container);
    });

    container.querySelector('#pg-guardar').addEventListener('click', async () => {
      const msgEl = container.querySelector('#pg-msg');
      msgEl.textContent = 'Guardando...';
      const paso = Number(container.querySelector('#pg-paso').value) || 500;
      const { error } = await supabase.from('juegos').update({
        girar_x: posGirar.girar_x, girar_y: posGirar.girar_y,
        girar_tamano: posGirar.girar_tamano,
        girar_imagen_url: posGirar.girar_imagen_url,
        girar_imagen_tamano: posGirar.girar_imagen_tamano,
        girar_sin_fondo: posGirar.girar_sin_fondo,
        paso_apuesta: paso,
      }).eq('id', juego.id);
      msgEl.textContent = error ? error.message : 'Guardado ✓ (el paso nuevo se aplica al reabrir)';
    });
  }

  function pintarPanelLibres(container) {
    container.innerHTML = `
      <div style="display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap; align-items:center">
        <div id="pl-chips" style="display:flex; gap:4px; flex-wrap:wrap; flex:1"></div>
        <button id="pl-agregar" style="font-size:12px; white-space:nowrap">+ Agregar</button>
      </div>
      <div id="pl-editor"></div>
    `;

    const chipsEl = container.querySelector('#pl-chips');
    chipsEl.innerHTML = capasLibres.map((c, i) => `
      <button data-id="${c.id}" style="font-size:11px">Imagen ${i + 1}</button>
    `).join('');
    chipsEl.querySelectorAll('button').forEach((btn) => {
      const activo = btn.dataset.id === libreActual;
      btn.style.borderColor = activo ? 'var(--accent)' : 'var(--border)';
      btn.style.color = activo ? 'var(--accent)' : 'var(--text)';
      btn.addEventListener('click', () => { libreActual = btn.dataset.id; pintarPanelLibres(container); });
    });

    container.querySelector('#pl-agregar').addEventListener('click', async () => {
      const { data, error } = await supabase.from('capas_libres')
        .insert({ juego_id: juego.id, x: 50, y: 50, tamano: 40, angulo: 0, blur: 0, oscurecer: 0, orden: capasLibres.length })
        .select().single();
      if (error) { alert(error.message); return; }
      capasLibres.push(data);
      libreActual = data.id;
      aplicarCapasLibres();
      pintarPanelLibres(container);
    });

    const actual = capasLibres.find((c) => c.id === libreActual);
    const editorEl = container.querySelector('#pl-editor');
    if (!actual) {
      editorEl.innerHTML = '<p class="hint">Todavía no agregaste ninguna imagen.</p>';
      return;
    }

    const sliderHtml = (campo, etiqueta, min, max, unidad) => `
      <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="pl-out-${campo}">${actual[campo]}${unidad}</span>
        <input type="range" min="${min}" max="${max}" value="${actual[campo]}" data-campo="${campo}" />
      </label>
    `;

    editorEl.innerHTML = `
      <label style="display:block; aspect-ratio:1; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:8px">
        ${actual.imagen_url ? `<img src="${actual.imagen_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Subir imagen</span>'}
        <input type="file" accept="image/*" hidden id="pl-subir" />
      </label>
      ${sliderHtml('x', 'Posición X', -20, 120, '%')}
      ${sliderHtml('y', 'Posición Y', -20, 120, '%')}
      ${sliderHtml('tamano', 'Tamaño', 10, 150, '%')}
      ${sliderHtml('angulo', 'Ángulo', -180, 180, '°')}
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Nitidez y oscurecimiento</p>
      ${sliderHtml('blur', 'Nitidez (blur)', 0, 20, 'px')}
      ${sliderHtml('oscurecer', 'Oscurecer', 0, 100, '%')}
      <button class="primary" id="pl-guardar" style="width:100%; margin-top:6px">Guardar</button>
      <button id="pl-quitar" style="width:100%; margin-top:8px; color:var(--danger)">Quitar esta imagen</button>
      <p id="pl-guardar-msg" class="hint"></p>
    `;

    editorEl.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        actual[campo] = Number(input.value);
        const unidad = campo === 'blur' ? 'px' : campo === 'angulo' ? '°' : '%';
        editorEl.querySelector(`#pl-out-${campo}`).textContent = input.value + unidad;
        aplicarCapasLibres();
      });
    });

    editorEl.querySelector('#pl-subir').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const url = await subirArchivoLibre(archivo, actual.id);
      if (url) {
        actual.imagen_url = url;
        aplicarCapasLibres();
        pintarPanelLibres(container);
      }
    });

    editorEl.querySelector('#pl-guardar').addEventListener('click', async () => {
      const msgEl = editorEl.querySelector('#pl-guardar-msg');
      msgEl.textContent = 'Guardando...';
      const { error } = await supabase.from('capas_libres')
        .update({
          x: actual.x, y: actual.y, tamano: actual.tamano, angulo: actual.angulo,
          blur: actual.blur, oscurecer: actual.oscurecer, imagen_url: actual.imagen_url,
        })
        .eq('id', actual.id);
      msgEl.textContent = error ? error.message : 'Guardado ✓';
    });

    editorEl.querySelector('#pl-quitar').addEventListener('click', async () => {
      if (!confirm('¿Quitar esta imagen?')) return;
      await supabase.from('capas_libres').delete().eq('id', actual.id);
      capasLibres = capasLibres.filter((c) => c.id !== actual.id);
      libreActual = capasLibres[0]?.id ?? null;
      aplicarCapasLibres();
      pintarPanelLibres(container);
    });
  }

  // Cuánto "relleno" tiene cada cinta antes de los 3 símbolos finales
  // — más relleno, más sensación de recorrido antes de frenar.
  const RELLENO = 18;
  const DURACION_COLUMNA = [1400, 1800, 2200];

  // Arma una cinta: RELLENO símbolos al azar + los 3 definitivos al
  // final. La animación mueve la cinta hasta dejar esos últimos 3
  // dentro de la ventana visible — el mismo movimiento que probamos
  // en la maqueta, ahora terminando en el resultado real.
  function armarCinta(col, valoresFinales, total) {
    const cinta = cintas[col];
    cinta.innerHTML = '';
    cinta.style.transition = 'none';
    cinta.style.transform = 'translateY(0px)';

    const tamanoCelda = cinta.parentElement.clientWidth;

    for (let i = 0; i < RELLENO; i++) {
      cinta.appendChild(crearCeldaCinta(elegirSimbolo(simbolos, total), tamanoCelda));
    }
    valoresFinales.forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda)));

    return tamanoCelda;
  }

  function crearCeldaCinta(simbolo, tamano) {
    const div = document.createElement('div');
    div.style.cssText = `width:${tamano}px; height:${tamano}px; display:flex; align-items:center; justify-content:center; flex-shrink:0`;
    div.innerHTML = celdaHtml(simbolo);
    return div;
  }

  // Al abrir, la pantalla ya muestra símbolos en vez de estar vacía —
  // pero se descarta cualquier tirada que pague, para no simular un
  // premio que el jugador no ganó. Se pinta directo, sin animar.
  function pintarGrillaInicial() {
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    let grilla;
    for (let intento = 0; intento < 40; intento++) {
      grilla = girar(simbolos);
      if (!grilla.premio) break;
    }
    cintas.forEach((cinta, col) => {
      cinta.innerHTML = '';
      cinta.style.transition = 'none';
      cinta.style.transform = 'translateY(0px)';
      const tamanoCelda = cinta.parentElement.clientWidth;
      grilla.grilla[col].forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda)));
    });
  }
  // Esperar al layout: antes de que el navegador mida los rodillos,
  // clientWidth es 0 y las celdas saldrían de tamaño cero.
  requestAnimationFrame(pintarGrillaInicial);

  btnGirar.addEventListener('click', async () => {
    if (girando) return;
    if (saldo < apuesta) { alert('Sin saldo de prueba. Cerrá y volvé a abrir.'); return; }

    girando = true;
    btnGirar.disabled = true;
    ocultarPremio();

    if (audios.musica_fondo && audios.musica_fondo.paused) audios.musica_fondo.play().catch(() => {});
    if (audios.giro) { audios.giro.currentTime = 0; audios.giro.play().catch(() => {}); }

    saldo -= apuesta;
    // El resultado se calcula ANTES de que arranque el giro visual —
    // igual que en el servidor real, la animación nunca decide el
    // resultado, solo lo muestra.
    const { grilla, premio, nivel } = girar(simbolos);
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;

    const tamanoCelda = [0, 1, 2].map((col) => armarCinta(col, grilla[col], total));

    // Forzar que el navegador registre la posición inicial antes de
    // animar — si no, "salta" directo al final sin mostrar el giro.
    void cintas[0].offsetWidth;

    await Promise.all(cintas.map((cinta, col) => new Promise((resolve) => {
      const ms = Math.round(DURACION_COLUMNA[col] / velocidad);
      cinta.style.transition = `transform ${ms}ms cubic-bezier(0.15, 0.85, 0.3, 1)`;
      cinta.style.transform = `translateY(-${RELLENO * tamanoCelda[col]}px)`;
      setTimeout(resolve, ms);
    })));

    const ganancia = premio * apuesta;
    saldo += ganancia;
    overlay.querySelector('#pv-saldo').textContent = saldo.toLocaleString('es-PY');

    if (premio > 0) {
      mostrarPremio(ganancia, nivel);
      // El símbolo del medio de cada cinta es siempre el de la línea
      // de pago (índice RELLENO+1: los 3 finales son [arriba, medio,
      // abajo], en ese orden, al final de cada cinta).
      cintas.forEach((cinta) => {
        const celdaGanadora = cinta.children[RELLENO + 1];
        if (celdaGanadora) celdaGanadora.classList.add('celda-ganadora');
      });

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

    girando = false;
    btnGirar.disabled = false;
  });
}

/**
 * Info del juego: dos pestañas, Pagos y Reglas. Se arma sola a
 * partir de los datos que ya cargaste — no hay que configurar nada
 * aparte.
 */
function mostrarTablaPagos(overlayJuego, simbolos, juego) {
  const ordenados = [...simbolos].sort((a, b) => b.pago_tres - a.pago_tres);

  const filasPagos = ordenados.map((s) => `
    <div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-soft, var(--border))">
      <div style="width:36px; height:36px; border-radius:8px; background:var(--surface-alt); flex-shrink:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
        ${s.icono_url ? `<img src="${s.icono_url}" style="width:80%; height:80%; object-fit:contain" />` : `<span class="hint" style="font-size:10px">${escapeHtml(s.nombre.slice(0, 3))}</span>`}
      </div>
      <p style="flex:1; margin:0; font-size:13px">${escapeHtml(s.nombre)}</p>
      <div style="text-align:right">
        <p style="margin:0; font-size:13px"><span class="hint">x3</span> ${s.pago_tres}x</p>
        ${s.pago_dos > 0 ? `<p style="margin:0; font-size:12px" class="hint">x2 ${s.pago_dos}x</p>` : ''}
      </div>
    </div>
  `).join('');

  const panelReglas = `
    ${juego.descripcion ? `<p style="font-size:13px; margin:0 0 12px">${escapeHtml(juego.descripcion)}</p>` : ''}
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
        <p class="hint" style="margin:0 0 10px">Tres iguales en la línea del medio pagan x3. Dos iguales, x2.</p>
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
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
