// Vista previa jugable: corre el mismo tipo de giro que el motor real,
// con los símbolos, imágenes, efectos y sonidos que estás editando.
// No toca ninguna base de saldo — es plata de mentira, solo para ver
// cómo se siente el juego antes de publicarlo.
//
// Acá mismo se ajusta la posición de marco, grilla y cartel — con un
// selector de "qué estoy editando" arriba del panel, viendo el
// resultado en vivo sobre el tamaño real de un celular.

import { supabase } from './supabase.js';
import { girar, elegirSimbolo } from '../motor/clasico-3x3.js';
import { ANCHO_ESC, ALTO_ESC, construirCadena, iniciarAnimacionLuces } from './luces.js';
import { mostrarTablaPagos } from './tabla-pagos.js';
import { animarSimboloGanador, detenerAnimacionesSimbolos, mostrarAnimacionJuego, detenerAnimacionesJuego } from './lottie.js';

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

  // Con 10 pestañas sueltas en una fila, encontrar la que buscás
  // costaba más de lo debido. Se agrupan en 4 categorías; adentro de
  // cada una siguen siendo las mismas pestañas de siempre, con la
  // misma lógica de abajo — esto solo cambia cómo se navega hasta
  // ellas, no toca ningún pintarPanelX().
  const CATEGORIAS_PANEL = [
    { id: 'capas', etiqueta: 'Capas', tabs: ['fondo_pantalla', 'marco', 'grilla', 'cartel'] },
    { id: 'extras', etiqueta: 'Extras', tabs: ['libres', 'luces', 'animaciones'] },
    { id: 'controles', etiqueta: 'Controles', tabs: ['girar', 'controles'] },
    { id: 'premio', etiqueta: 'Premio', tabs: ['premio'] },
  ];
  const ETIQUETA_CAPA = {
    fondo_pantalla: 'Fondo', marco: 'Marco', grilla: 'Grilla', cartel: 'Cartel',
    libres: 'Libres', luces: 'Luces', animaciones: 'Animaciones',
    girar: 'Girar', controles: 'Controles', premio: 'Premio',
  };
  let categoriaActual = CATEGORIAS_PANEL.find((c) => c.tabs.includes(capaActual))?.id || 'capas';

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

  // Cadenas de luces: mismo criterio que las imágenes libres,
  // cantidad variable. Cada una guarda su modo (marco/libre), focos,
  // colores y animación.
  const { data: filasAnim } = await supabase.from('animaciones_lottie').select('*').eq('juego_id', juego.id).order('orden');
  let animaciones = filasAnim || [];
  let animActual = animaciones[0]?.id ?? null;

  const { data: filasCadenas } = await supabase.from('cadenas_luces').select('*').eq('juego_id', juego.id).order('orden');
  let cadenasLuces = filasCadenas || [];
  let cadenaActual = cadenasLuces[0]?.id ?? null;

  // Botones chicos (−, +, x1, x2, x3): sin fila configurada, cada uno
  // se dibuja con su texto por defecto. Mismo criterio que el de
  // girar: tamaño del botón y de la imagen por separado.
  const CLAVES_BOTON = [
    { clave: 'menos', etiqueta: '− (bajar apuesta)' },
    { clave: 'mas', etiqueta: '+ (subir apuesta)' },
    { clave: 'x1', etiqueta: 'x1' },
    { clave: 'x2', etiqueta: 'x2' },
    { clave: 'x3', etiqueta: 'x3' },
  ];
  const { data: filasBotones } = await supabase.from('botones').select('*').eq('juego_id', juego.id);
  const botones = {};
  CLAVES_BOTON.forEach(({ clave }) => {
    const fila = (filasBotones || []).find((f) => f.clave === clave);
    botones[clave] = {
      id: fila?.id || null, imagen_url: fila?.imagen_url || null,
      tamano: fila?.tamano ?? 28, imagen_tamano: fila?.imagen_tamano ?? 70,
      sin_fondo: fila?.sin_fondo ?? false,
    };
  });
  let botonActual = 'menos';

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
      <!-- position:relative + z-index: la pantalla del juego tiene
           overflow visible a propósito (para ver si algo se pasa del
           borde), así que cualquier capa que se salga por arriba
           quedaba tapando estos botones e interceptando el clic. -->
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; gap:8px; width:420px; position:relative; z-index:50">
        <button id="pv-ajustar">⚙ Ajustar posición</button>
        <button id="pv-probar-premio">🎯 Probar premio</button>
        <button id="pv-cerrar">✕ Cerrar prueba</button>
      </div>
      <div id="pv-escala-wrap" style="width:420px; height:860px; flex-shrink:0">
      <div id="pv-marco-cap" style="width:420px; height:860px; transform-origin:top center; background:var(--surface); border:1px dashed var(--border); border-radius:20px; padding:22px; position:relative; overflow:visible">
        ${juego.fondo_pantalla_url ? `<img id="pv-img-fondo-pantalla" src="${juego.fondo_pantalla_url}" style="position:absolute; object-fit:fill" />` : ''}
        ${juego.marco_url ? `<img id="pv-img-marco" src="${juego.marco_url}" style="position:absolute; object-fit:fill" />` : ''}

        <div style="display:flex; align-items:center; gap:8px; position:relative; z-index:10">
          <div style="width:28px"></div>
          <p id="pv-titulo-juego" style="flex:1; text-align:center; font-weight:600; margin:0; letter-spacing:.04em; ${(juego.mostrar_nombre ?? true) ? '' : 'visibility:hidden'}">${escapeHtml(juego.nombre).toUpperCase()}</p>
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

        <div id="pv-cadenas-luces" style="position:absolute; inset:0; z-index:9; pointer-events:none"></div>

        <div id="pv-anim-rive" style="position:absolute; inset:0; z-index:14; pointer-events:none"></div>

        <div id="pv-premio-popup" style="position:absolute; z-index:15; display:none; border-radius:12px; background:rgba(0,0,0,.55); transition:opacity .25s; opacity:0; transform:translate(-50%,-50%)">
          <img id="pv-img-premio" style="position:absolute; z-index:0; display:none" />
          <strong id="pv-premio-monto" style="position:absolute; z-index:1; font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); white-space:nowrap"></strong>
        </div>

        <div id="pv-grupo-saldo" style="position:absolute; z-index:10; white-space:nowrap; display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
          <p class="hint" style="margin:0">Saldo de prueba</p>
          <strong id="pv-saldo" style="font-size:18px">10.000</strong>
        </div>

        <div id="pv-grupo-apuesta" style="position:absolute; z-index:10; display:flex; align-items:center; gap:6px; white-space:nowrap">
          <button id="pv-apuesta-menos" aria-label="Bajar apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
            <span class="pv-btn-texto">−</span>
            <img class="pv-btn-img" style="display:none; object-fit:contain" />
          </button>
          <div id="pv-caja-apuesta" style="display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
            <p class="hint" style="margin:0">Apuesta</p>
            <strong id="pv-apuesta" style="font-size:15px"></strong>
          </div>
          <button id="pv-apuesta-mas" aria-label="Subir apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
            <span class="pv-btn-texto">+</span>
            <img class="pv-btn-img" style="display:none; object-fit:contain" />
          </button>
        </div>

        <div id="pv-fichas" style="position:absolute; z-index:10; display:flex; gap:4px; flex-wrap:wrap; justify-content:center; white-space:nowrap"></div>

        <div id="pv-turbo" style="position:absolute; z-index:10; display:flex; gap:3px; white-space:nowrap"></div>

        <button id="pv-girar" style="position:absolute; z-index:11; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden">
          <span id="pv-girar-texto" style="font-size:14px">Girar</span>
          <img id="pv-girar-img" style="display:none; object-fit:contain" />
        </button>
      </div>
      </div>
    </div>

    <div id="pv-panel-ajuste" class="card" style="display:none; width:260px; max-height:min(860px, 92vh); overflow:auto; position:relative; z-index:50"></div>
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
  const cadenasLuzEl = overlay.querySelector('#pv-cadenas-luces');

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

  // ---------------- Cadenas de luces ----------------
  // La pantalla del juego es SIEMPRE 420x860 (ver escala fija en
  // main), así que la geometría se calcula en esos píxeles fijos sin
  // depender del dispositivo.
  // Cadenas de luces — geometría, formas y animación viven en
  // src/luces.js, compartido con la otra pantalla.
  const rectMarco = () => {
    if (juego.marco_url) {
      const w = pos.marco_ancho / 100 * ANCHO_ESC, h = pos.marco_alto / 100 * ALTO_ESC;
      return { left: pos.marco_x / 100 * ANCHO_ESC - w / 2, top: pos.marco_y / 100 * ALTO_ESC - h / 2, w, h };
    }
    return { left: ANCHO_ESC * 0.1, top: ALTO_ESC * 0.1, w: ANCHO_ESC * 0.8, h: ALTO_ESC * 0.8 };
  };

  // Rehace los focos de UNA cadena (posiciones, forma, cantidad). No
  // corre en cada frame: solo cuando cambia la configuración.
  const reconstruirCadena = (c) => {
    let wrap = cadenasLuzEl.querySelector(`[data-cadena="${c.id}"]`);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.dataset.cadena = c.id;
      wrap.style.cssText = 'position:absolute; inset:0; pointer-events:none';
      cadenasLuzEl.appendChild(wrap);
    }
    construirCadena(wrap, c, rectMarco);
  };
  cadenasLuces.forEach(reconstruirCadena);

  // Un solo intervalo anima TODAS las cadenas — nunca uno por cadena,
  // para no ir sumando timers sueltos si se agregan varias.
  const timerCadenas = iniciarAnimacionLuces(() => cadenasLuces);

  // Saca el modo arrastre de todos los focos al salir de la pestaña
  // Luces — si no, quedarían tocables encima del resto del juego.
  const desactivarArrastreLuces = () => {
    cadenasLuzEl.querySelectorAll('[data-cadena]').forEach((wrap) => { wrap.style.pointerEvents = 'none'; });
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
  // Dibuja el monto carácter por carácter. Reutiliza los elementos
  // que ya están en pantalla en vez de borrarlos y crearlos de nuevo:
  // con el contador corriendo esto se llama muchas veces por segundo,
  // y recrear imágenes en cada paso trababa la pantalla.
  const pintarMonto = (elemento, texto, alto, espaciado) => {
    elemento.style.display = 'flex';
    elemento.style.alignItems = 'flex-end';
    elemento.style.flexWrap = 'nowrap';
    elemento.style.gap = espaciado + 'px';

    const caracteres = [...texto];
    const hijos = elemento.children;

    caracteres.forEach((c, i) => {
      const url = mapaDigitos[c];
      const tipo = url ? 'IMG' : 'SPAN';
      let el = hijos[i];

      // Solo se crea un elemento nuevo si no había uno, o si cambió
      // de tipo (de imagen a texto o al revés).
      if (!el || el.tagName !== tipo) {
        const nuevoEl = document.createElement(url ? 'img' : 'span');
        if (el) elemento.replaceChild(nuevoEl, el);
        else elemento.appendChild(nuevoEl);
        el = nuevoEl;
      }

      if (url) {
        if (el.getAttribute('src') !== url) el.setAttribute('src', url);
        el.style.cssText = `height:${alto}px; width:auto; display:block`;
      } else {
        if (el.textContent !== c) el.textContent = c;
        el.style.cssText = 'font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5)';
      }
    });

    // Si el número se acortó (por ejemplo de 1.000 a 999), sobran
    // elementos al final: se quitan.
    while (hijos.length > caracteres.length) elemento.removeChild(elemento.lastChild);
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
      <div class="cat-nav" style="margin-bottom:8px">
        ${CATEGORIAS_PANEL.map((c) => `
          <button data-cat="${c.id}" class="cat-btn ${c.id === categoriaActual ? 'on' : ''}">${c.etiqueta}</button>
        `).join('')}
      </div>
      <div class="grupo-nav" style="margin-bottom:14px">
        ${CATEGORIAS_PANEL.find((c) => c.id === categoriaActual).tabs.map((t) => `
          <button data-capa="${t}" class="pv-tab ${t === capaActual ? 'on' : ''}">${ETIQUETA_CAPA[t]}</button>
        `).join('')}
      </div>

      <div id="pv-sliders" class="fade-in"></div>

      <div id="pv-orden-wrap" style="border-top:1px solid var(--border); margin-top:14px; padding-top:14px">
        <p style="font-weight:600; margin:0 0 4px; font-size:13px">Orden de capas</p>
        <p class="hint" style="margin:0 0 8px">De atrás hacia adelante. La de arriba de la lista es la más al fondo.</p>
        <div id="pv-orden"></div>
      </div>

      <button class="primary" id="pv-guardar" style="width:100%; margin-top:14px">Guardar posición</button>
      <p id="pv-guardar-msg" class="hint"></p>
    `;

    panel.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.style.flex = '1 1 40%';
      btn.style.fontSize = '12px';
      btn.style.justifyContent = 'center';
      btn.addEventListener('click', () => {
        categoriaActual = btn.dataset.cat;
        capaActual = CATEGORIAS_PANEL.find((c) => c.id === categoriaActual).tabs[0];
        pintarPanel();
      });
    });

    panel.querySelectorAll('.pv-tab').forEach((btn) => {
      btn.style.flex = '1 1 30%';
      btn.style.fontSize = '12px';
      btn.style.justifyContent = 'center';
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
      desactivarArrastreLuces();
      pintarPanelLibres(slidersEl);
      return;
    }

    if (capaActual === 'animaciones') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      desactivarArrastreLuces();
      pintarPanelAnimaciones(slidersEl);
      return;
    }

    if (capaActual === 'luces') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelLuces(slidersEl);
      return;
    }
    desactivarArrastreLuces();

    if (capaActual === 'girar') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelGirar(slidersEl);
      return;
    }

    if (capaActual === 'controles') {
      panel.querySelector('#pv-orden-wrap').style.display = 'none';
      panel.querySelector('#pv-guardar').style.display = 'none';
      pintarPanelControles(slidersEl);
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
  let resultadoForzado = null;
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

  const posGrupos = {
    saldo_x: juego.saldo_x ?? 14, saldo_y: juego.saldo_y ?? 96,
    apuesta_x: juego.apuesta_x ?? 50, apuesta_y: juego.apuesta_y ?? 96,
    turbo_x: juego.turbo_x ?? 86, turbo_y: juego.turbo_y ?? 96,
    fichas_x: juego.fichas_x ?? 50, fichas_y: juego.fichas_y ?? 88,
    saldo_ancho: juego.saldo_ancho ?? 110, saldo_alto: juego.saldo_alto ?? 44,
    apuesta_ancho: juego.apuesta_ancho ?? 110, apuesta_alto: juego.apuesta_alto ?? 44,
    saldo_fondo_url: juego.saldo_fondo_url || null,
    apuesta_fondo_url: juego.apuesta_fondo_url || null,
  };

  let modoApuesta = juego.modo_apuesta || 'mixto';
  let mostrarNombre = juego.mostrar_nombre ?? true;
  let contadorMs = juego.contador_ms ?? 900;
  // Sin fichas configuradas, se arman solas a partir del mínimo para
  // que la pantalla nunca quede sin opciones que tocar.
  const fichasPorDefecto = [1, 2, 5, 20, 50].map((m) => apuestaMin * m).filter((f) => f <= apuestaMax);
  let fichas = (juego.fichas?.length ? juego.fichas.map(Number) : fichasPorDefecto);

  const grupoSaldoEl = overlay.querySelector('#pv-grupo-saldo');
  const grupoApuestaEl = overlay.querySelector('#pv-grupo-apuesta');
  const grupoTurboEl = overlay.querySelector('#pv-turbo');
  const cajaApuestaEl = overlay.querySelector('#pv-caja-apuesta');
  const fichasEl = overlay.querySelector('#pv-fichas');

  const aplicarGrupos = () => {
    const ubicar = (el, x, y) => Object.assign(el.style, {
      left: x + '%', top: y + '%', transform: 'translate(-50%,-50%)',
    });
    ubicar(grupoSaldoEl, posGrupos.saldo_x, posGrupos.saldo_y);
    ubicar(grupoApuestaEl, posGrupos.apuesta_x, posGrupos.apuesta_y);
    ubicar(grupoTurboEl, posGrupos.turbo_x, posGrupos.turbo_y);
    ubicar(fichasEl, posGrupos.fichas_x, posGrupos.fichas_y);

    // Los recuadros llevan la imagen como fondo estirado a su tamaño:
    // así el texto queda siempre encima y centrado, sin importar qué
    // imagen subas.
    Object.assign(grupoSaldoEl.style, {
      width: posGrupos.saldo_ancho + 'px', height: posGrupos.saldo_alto + 'px',
      backgroundImage: posGrupos.saldo_fondo_url ? `url('${posGrupos.saldo_fondo_url}')` : 'none',
    });
    Object.assign(cajaApuestaEl.style, {
      width: posGrupos.apuesta_ancho + 'px', height: posGrupos.apuesta_alto + 'px',
      backgroundImage: posGrupos.apuesta_fondo_url ? `url('${posGrupos.apuesta_fondo_url}')` : 'none',
    });
  };
  aplicarGrupos();

  // Qué controles se ven, según el modo elegido en el ensamblador.
  const aplicarModo = () => {
    const conFichas = modoApuesta === 'fichas' || modoApuesta === 'mixto';
    const conMasMenos = modoApuesta === 'mas_menos' || modoApuesta === 'mixto';
    fichasEl.style.display = conFichas ? 'flex' : 'none';
    overlay.querySelector('#pv-apuesta-menos').style.display = conMasMenos ? 'flex' : 'none';
    overlay.querySelector('#pv-apuesta-mas').style.display = conMasMenos ? 'flex' : 'none';
    if (conFichas) pintarFichas();
  };

  const pintarFichas = () => {
    fichasEl.innerHTML = fichas.map((f) => `
      <button data-f="${f}" style="padding:3px 9px; font-size:11px; ${f === apuesta ? 'border-color:var(--accent); color:var(--accent)' : ''}">${Number(f).toLocaleString('es-PY')}</button>
    `).join('');
    fichasEl.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        if (girando) return;
        apuesta = Math.max(apuestaMin, Math.min(apuestaMax, Number(b.dataset.f)));
        pintarApuesta();
        pintarFichas();
      });
    });
  };

  // Pinta un botón chico: si tiene imagen, la muestra adentro con su
  // propio tamaño; si no, deja el texto de siempre.
  const aplicarBoton = (el, cfg) => {
    if (!el) return;
    Object.assign(el.style, {
      width: cfg.tamano + 'px', height: cfg.tamano + 'px',
      background: cfg.sin_fondo ? 'transparent' : '',
      border: cfg.sin_fondo ? 'none' : '',
    });
    const img = el.querySelector('.pv-btn-img');
    const texto = el.querySelector('.pv-btn-texto');
    if (cfg.imagen_url) {
      const tam = cfg.tamano * cfg.imagen_tamano / 100;
      img.src = cfg.imagen_url;
      img.style.display = 'block';
      img.style.width = tam + 'px';
      img.style.height = tam + 'px';
      if (texto) texto.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (texto) texto.style.display = 'block';
    }
  };

  const aplicarBotonesApuesta = () => {
    aplicarBoton(overlay.querySelector('#pv-apuesta-menos'), botones.menos);
    aplicarBoton(overlay.querySelector('#pv-apuesta-mas'), botones.mas);
  };
  aplicarBotonesApuesta();

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
  aplicarModo();

  overlay.querySelector('#pv-apuesta-mas').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.min(apuestaMax, apuesta + pasoApuesta);
    pintarApuesta();
    if (fichasEl.style.display !== 'none') pintarFichas();
  });
  overlay.querySelector('#pv-apuesta-menos').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.max(apuestaMin, apuesta - pasoApuesta);
    pintarApuesta();
    if (fichasEl.style.display !== 'none') pintarFichas();
  });

  // La velocidad solo acorta la animación: el resultado ya está
  // decidido antes de que el primer rodillo se mueva.
  const turboEl = overlay.querySelector('#pv-turbo');
  const pintarTurbo = () => {
    turboEl.innerHTML = [1, 2, 3].map((v) => {
      const cfg = botones['x' + v];
      const activo = v === velocidad;
      return `
        <button data-v="${v}" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden; ${activo ? 'border-color:var(--accent); color:var(--accent)' : ''}">
          <span class="pv-btn-texto" style="font-size:11px">x${v}</span>
          <img class="pv-btn-img" style="display:none; object-fit:contain" />
        </button>
      `;
    }).join('');
    turboEl.querySelectorAll('button').forEach((b) => {
      aplicarBoton(b, botones['x' + b.dataset.v]);
      b.addEventListener('click', () => { velocidad = Number(b.dataset.v); pintarTurbo(); });
    });
  };
  pintarTurbo();

  const cerrar = () => { Object.values(audios).forEach((a) => a.pause()); timerCadenas(); detenerAnimacionesSimbolos(); detenerAnimacionesJuego(); overlay.remove(); };
  overlay.querySelector('#pv-cerrar').addEventListener('click', cerrar);

  overlay.querySelector('#pv-info').addEventListener('click', () => mostrarTablaPagos(overlay, simbolos, juego));

  // Cuadro de premio: aparece con el monto y la imagen/posición del
  // nivel que ganó, y se esconde solo a los pocos segundos (o si
  // arranca un giro nuevo antes).
  let timerPremio = null;
  let animContador = null;

  // El monto sube desde cero hasta el total en vez de aparecer de
  // golpe. No cambia nada del resultado: el número final es el que
  // decidió el servidor, solo se muestra progresivamente.
  //
  // La curva desacelera al final (empieza rápido y frena), que es lo
  // que hace que se sienta como un premio "cerrando" y no como un
  // número corriendo. Con contador_ms en 0 aparece directo, como
  // antes.
  function contarHasta(monto, nivel) {
    cancelAnimationFrame(animContador);
    const duracion = Number(juego.contador_ms ?? 900);

    const p = posPremio[nivel];
    let ultimoTexto = null;

    // Solo se redibuja el NÚMERO, y únicamente cuando cambia de
    // verdad. Antes, cada cuadro del contador reasignaba la imagen
    // del premio, recalculaba todos los estilos del cuadro y recreaba
    // las imágenes de todos los dígitos — 60 veces por segundo. Eso
    // trababa la pantalla justo en el momento de ganar.
    const pintar = (valor) => {
      const texto = '+' + Math.round(valor).toLocaleString('es-PY');
      if (texto === ultimoTexto) return;
      ultimoTexto = texto;
      montoDemoTexto = texto;
      pintarMonto(montoPremioEl, texto, p.monto_alto, p.monto_espaciado);
    };

    if (duracion <= 0) { pintar(monto); return; }

    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      // Desaceleración: rápido al principio, suave al final.
      const suave = 1 - Math.pow(1 - t, 3);
      pintar(monto * suave);
      if (t < 1) animContador = requestAnimationFrame(paso);
      else pintar(monto);
    };
    animContador = requestAnimationFrame(paso);
  }

  function mostrarPremio(monto, nivel) {
    clearTimeout(timerPremio);
    montoDemoTexto = '+0';
    aplicarPosicionPremio(nivel);
    premioPopupEl.style.display = 'flex';
    void premioPopupEl.offsetWidth;
    premioPopupEl.style.opacity = '1';
    contarHasta(monto, nivel);
    // El cuadro queda un momento con el monto final ya quieto: si se
    // fuera apenas termina de contar, no daría tiempo a leerlo.
    timerPremio = setTimeout(ocultarPremio, Number(juego.contador_ms ?? 900) + 2000);
  }
  function ocultarPremio() {
    cancelAnimationFrame(animContador);
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

  async function subirArchivoBoton(archivo, clave) {
    const ruta = `botones/${juego.id}/${clave}-${Date.now()}-${archivo.name}`;
    const { error } = await supabase.storage.from('assets').upload(ruta, archivo, { upsert: true });
    if (error) { alert('No se pudo subir: ' + error.message); return null; }
    const { data } = supabase.storage.from('assets').getPublicUrl(ruta);
    return data.publicUrl;
  }

  // Sub-panel "Controles": arriba la posición de los tres grupos
  // (saldo, apuesta, velocidad), abajo cada botón chico por separado
  // con su imagen y sus dos tamaños, igual que el de girar.
  function pintarPanelControles(container) {
    const cfg = botones[botonActual];
    const sl = (campo, etiqueta, min, max, unidad, valor, grupo) => `
      <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="pc-out-${campo}">${valor}${unidad}</span>
        <input type="range" min="${min}" max="${max}" value="${valor}" data-campo="${campo}" data-grupo="${grupo}" />
      </label>
    `;

    container.innerHTML = `
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:12px">
        <input type="checkbox" id="pc-nombre" ${mostrarNombre ? 'checked' : ''} /> Mostrar el nombre del juego arriba
      </label>
      <label style="display:block; margin-bottom:12px; font-size:12px">Contador del premio <span class="hint" id="pc-out-contador">${contadorMs === 0 ? 'directo' : contadorMs + 'ms'}</span>
        <input type="range" min="0" max="3000" step="100" value="${contadorMs}" id="pc-contador" />
      </label>
      <p style="font-size:12px; color:var(--text-dim); margin:0 0 8px">Modo de apuesta</p>
      <select id="pc-modo" style="width:100%; margin-bottom:6px">
        <option value="fichas" ${modoApuesta === 'fichas' ? 'selected' : ''}>Solo fichas</option>
        <option value="mas_menos" ${modoApuesta === 'mas_menos' ? 'selected' : ''}>Solo + y −</option>
        <option value="mixto" ${modoApuesta === 'mixto' ? 'selected' : ''}>Mixto (fichas + ajuste fino)</option>
      </select>
      <label style="display:block; margin-bottom:10px; font-size:12px">Montos de las fichas (separados por coma)
        <input id="pc-fichas" type="text" value="${fichas.join(', ')}" style="width:100%" />
      </label>
      ${sl('fichas_x', 'Fichas — Posición X', 0, 100, '%', posGrupos.fichas_x, 'grupo')}
      ${sl('fichas_y', 'Fichas — Posición Y', 0, 100, '%', posGrupos.fichas_y, 'grupo')}

      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Saldo</p>
      ${sl('saldo_x', 'Posición X', 0, 100, '%', posGrupos.saldo_x, 'grupo')}
      ${sl('saldo_y', 'Posición Y', 0, 100, '%', posGrupos.saldo_y, 'grupo')}
      ${sl('saldo_ancho', 'Ancho del recuadro', 60, 240, 'px', posGrupos.saldo_ancho, 'grupo')}
      ${sl('saldo_alto', 'Alto del recuadro', 24, 120, 'px', posGrupos.saldo_alto, 'grupo')}
      <label style="display:block; height:48px; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:6px">
        ${posGrupos.saldo_fondo_url ? `<img src="${posGrupos.saldo_fondo_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Fondo del recuadro</span>'}
        <input type="file" accept="image/*" hidden id="pc-fondo-saldo" />
      </label>
      ${posGrupos.saldo_fondo_url ? '<button id="pc-quitar-saldo" style="width:100%; margin-bottom:10px; font-size:11px">Quitar fondo</button>' : ''}

      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Apuesta (− y +)</p>
      ${sl('apuesta_x', 'Posición X', 0, 100, '%', posGrupos.apuesta_x, 'grupo')}
      ${sl('apuesta_y', 'Posición Y', 0, 100, '%', posGrupos.apuesta_y, 'grupo')}
      ${sl('apuesta_ancho', 'Ancho del recuadro', 60, 240, 'px', posGrupos.apuesta_ancho, 'grupo')}
      ${sl('apuesta_alto', 'Alto del recuadro', 24, 120, 'px', posGrupos.apuesta_alto, 'grupo')}
      <label style="display:block; height:48px; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:6px">
        ${posGrupos.apuesta_fondo_url ? `<img src="${posGrupos.apuesta_fondo_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Fondo del recuadro</span>'}
        <input type="file" accept="image/*" hidden id="pc-fondo-apuesta" />
      </label>
      ${posGrupos.apuesta_fondo_url ? '<button id="pc-quitar-apuesta" style="width:100%; margin-bottom:10px; font-size:11px">Quitar fondo</button>' : ''}

      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 8px">Velocidad (x1 x2 x3)</p>
      ${sl('turbo_x', 'Posición X', 0, 100, '%', posGrupos.turbo_x, 'grupo')}
      ${sl('turbo_y', 'Posición Y', 0, 100, '%', posGrupos.turbo_y, 'grupo')}

      <p style="font-size:12px; color:var(--text-dim); margin:14px 0 8px">Aspecto de cada botón</p>
      <div id="pc-chips" style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px"></div>

      <label style="display:block; height:64px; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:8px">
        ${cfg.imagen_url ? `<img src="${cfg.imagen_url}" style="width:100%; height:100%; object-fit:contain" />` : '<span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">Subir imagen</span>'}
        <input type="file" accept="image/*" hidden id="pc-subir" />
      </label>
      ${cfg.imagen_url ? '<button id="pc-quitar-img" style="width:100%; margin-bottom:10px; font-size:12px">Quitar imagen</button>' : ''}
      ${sl('tamano', 'Tamaño del botón', 18, 100, 'px', cfg.tamano, 'boton')}
      ${sl('imagen_tamano', 'Tamaño de la imagen', 20, 140, '%', cfg.imagen_tamano, 'boton')}
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin:8px 0">
        <input type="checkbox" id="pc-sinfondo" ${cfg.sin_fondo ? 'checked' : ''} /> Ocultar el fondo del botón
      </label>

      <button class="primary" id="pc-guardar" style="width:100%; margin-top:6px">Guardar todo</button>
      <p id="pc-msg" class="hint"></p>
    `;

    const chipsEl = container.querySelector('#pc-chips');
    chipsEl.innerHTML = CLAVES_BOTON.map(({ clave, etiqueta }) => `
      <button data-clave="${clave}" style="font-size:11px; ${clave === botonActual ? 'border-color:var(--accent); color:var(--accent)' : ''}">${etiqueta}</button>
    `).join('');
    chipsEl.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { botonActual = b.dataset.clave; pintarPanelControles(container); });
    });

    container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        const valor = Number(input.value);
        if (input.dataset.grupo === 'grupo') {
          posGrupos[campo] = valor;
          aplicarGrupos();
        } else {
          botones[botonActual][campo] = valor;
          aplicarBotonesApuesta();
          pintarTurbo();
        }
        const unidad = ['tamano', 'saldo_ancho', 'saldo_alto', 'apuesta_ancho', 'apuesta_alto'].includes(campo) ? 'px' : '%';
        container.querySelector(`#pc-out-${campo}`).textContent = input.value + unidad;
      });
    });

    container.querySelector('#pc-sinfondo').addEventListener('change', (e) => {
      botones[botonActual].sin_fondo = e.target.checked;
      aplicarBotonesApuesta();
      pintarTurbo();
    });

    container.querySelector('#pc-contador').addEventListener('input', (e) => {
      contadorMs = Number(e.target.value);
      juego.contador_ms = contadorMs;
      container.querySelector('#pc-out-contador').textContent = contadorMs === 0 ? 'directo' : contadorMs + 'ms';
    });

    container.querySelector('#pc-nombre').addEventListener('change', (e) => {
      mostrarNombre = e.target.checked;
      const tituloEl = overlay.querySelector('#pv-titulo-juego');
      if (tituloEl) tituloEl.style.visibility = mostrarNombre ? 'visible' : 'hidden';
    });

    container.querySelector('#pc-modo').addEventListener('change', (e) => {
      modoApuesta = e.target.value;
      aplicarModo();
    });

    container.querySelector('#pc-fichas').addEventListener('change', (e) => {
      const lista = e.target.value.split(',')
        .map((t) => Number(String(t).replace(/[^\d]/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (lista.length) { fichas = lista; aplicarModo(); }
    });

    // Fondos de los dos recuadros. Se aplican al toque para poder
    // ajustar ancho y alto viendo la imagen ya puesta.
    const subirFondo = async (input, campo, quitarId) => {
      container.querySelector(input)?.addEventListener('change', async (e) => {
        const archivo = e.target.files?.[0];
        if (!archivo) return;
        const url = await subirArchivoBoton(archivo, campo);
        if (url) { posGrupos[campo] = url; aplicarGrupos(); pintarPanelControles(container); }
      });
      container.querySelector(quitarId)?.addEventListener('click', () => {
        posGrupos[campo] = null; aplicarGrupos(); pintarPanelControles(container);
      });
    };
    subirFondo('#pc-fondo-saldo', 'saldo_fondo_url', '#pc-quitar-saldo');
    subirFondo('#pc-fondo-apuesta', 'apuesta_fondo_url', '#pc-quitar-apuesta');

    container.querySelector('#pc-subir').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const url = await subirArchivoBoton(archivo, botonActual);
      if (url) {
        botones[botonActual].imagen_url = url;
        aplicarBotonesApuesta();
        pintarTurbo();
        pintarPanelControles(container);
      }
    });

    container.querySelector('#pc-quitar-img')?.addEventListener('click', () => {
      botones[botonActual].imagen_url = null;
      aplicarBotonesApuesta();
      pintarTurbo();
      pintarPanelControles(container);
    });

    container.querySelector('#pc-guardar').addEventListener('click', async () => {
      const msgEl = container.querySelector('#pc-msg');
      msgEl.textContent = 'Guardando...';

      const { error: errPos } = await supabase.from('juegos').update({
        saldo_x: posGrupos.saldo_x, saldo_y: posGrupos.saldo_y,
        apuesta_x: posGrupos.apuesta_x, apuesta_y: posGrupos.apuesta_y,
        turbo_x: posGrupos.turbo_x, turbo_y: posGrupos.turbo_y,
        fichas_x: posGrupos.fichas_x, fichas_y: posGrupos.fichas_y,
        saldo_ancho: posGrupos.saldo_ancho, saldo_alto: posGrupos.saldo_alto,
        apuesta_ancho: posGrupos.apuesta_ancho, apuesta_alto: posGrupos.apuesta_alto,
        saldo_fondo_url: posGrupos.saldo_fondo_url,
        apuesta_fondo_url: posGrupos.apuesta_fondo_url,
        modo_apuesta: modoApuesta,
        mostrar_nombre: mostrarNombre,
        contador_ms: contadorMs,
        fichas,
      }).eq('id', juego.id);

      // Se guardan los cinco botones juntos, no solo el que estás
      // editando: así no se pierde lo que ajustaste en los otros
      // antes de cambiar de pestañita.
      const { error: errBtn } = await supabase.from('botones').upsert(
        CLAVES_BOTON.map(({ clave }) => ({
          juego_id: juego.id, clave,
          imagen_url: botones[clave].imagen_url,
          tamano: botones[clave].tamano,
          imagen_tamano: botones[clave].imagen_tamano,
          sin_fondo: botones[clave].sin_fondo,
        })),
        { onConflict: 'juego_id,clave' }
      );

      const error = errPos || errBtn;
      msgEl.textContent = error ? error.message : 'Guardado ✓';
    });
  }

  const PALETA_LUCES = ['#EF9F27', '#D85A30', '#378ADD', '#639922', '#D4537E', '#7F77DD', '#F09595', '#5DCAA5'];

  // Activa el arrastre de los focos de UNA cadena en modo libre —
  // las demás quedan sin tocar (pointer-events:none), así no se
  // arrastra por error un foco de otra cadena.
  const activarArrastreCadena = (c) => {
    desactivarArrastreLuces();
    if (c.modo !== 'libre') return;
    const wrap = cadenasLuzEl.querySelector(`[data-cadena="${c.id}"]`);
    if (!wrap) return;
    wrap.style.pointerEvents = 'auto';
    (c._dots || []).forEach((dot, i) => {
      dot.style.pointerEvents = 'auto';
      dot.style.cursor = 'grab';
      dot.addEventListener('pointerdown', (e) => {
        dot.setPointerCapture(e.pointerId);
        const mover = (ev) => {
          const r = capElPv.getBoundingClientRect();
          const escala = r.width / 420;
          c.puntos[i] = {
            x: Math.max(0, Math.min(100, (ev.clientX - r.left) / escala / 420 * 100)),
            y: Math.max(0, Math.min(100, (ev.clientY - r.top) / escala / 860 * 100)),
          };
          dot.style.left = c.puntos[i].x + '%';
          dot.style.top = c.puntos[i].y + '%';
        };
        dot.addEventListener('pointermove', mover);
        dot.addEventListener('pointerup', () => dot.removeEventListener('pointermove', mover), { once: true });
      });
    });
  };

  // Sub-panel "Luces": lista de cadenas con chips (como Libres), cada
  // una con su modo, cantidad, tamaño, animación, velocidad y
  // colores. En modo libre, los focos se arrastran directo en la
  // vista previa.

  const EVENTOS_ANIM = [
    { valor: 'intro', etiqueta: 'Intro (antes de la carga)', tope: 1 },
    { valor: 'girar', etiqueta: 'Al girar', tope: 2 },
    { valor: 'premio_chico', etiqueta: 'Premio chico', tope: 2 },
    { valor: 'premio_mayor', etiqueta: 'Premio mayor', tope: 2 },
  ];

  const animRiveEl = overlay.querySelector('#pv-anim-rive');

  // Sub-panel "Animaciones": la intro y los complementos de premio
  // comparten controles (archivo, posición, tamaño) — lo único que
  // cambia es CUÁNDO se prenden, que es el campo Evento.
  function pintarPanelAnimaciones(container) {
    container.innerHTML = `
      <div style="display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap; align-items:center">
        <div id="pa-chips" style="display:flex; gap:4px; flex-wrap:wrap; flex:1"></div>
        <button id="pa-agregar" style="font-size:12px; white-space:nowrap">+ Agregar</button>
      </div>
      <div id="pa-editor"></div>
    `;

    const chipsEl = container.querySelector('#pa-chips');
    chipsEl.innerHTML = animaciones.map((a, i) => {
      const ev = EVENTOS_ANIM.find((e) => e.valor === a.evento);
      return `<button data-id="${a.id}" style="font-size:11px">${ev ? ev.etiqueta.split(' ')[0] : a.evento} ${i + 1}</button>`;
    }).join('');
    chipsEl.querySelectorAll('button').forEach((btn) => {
      const on = btn.dataset.id === animActual;
      btn.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
      btn.style.color = on ? 'var(--accent)' : 'var(--text)';
      btn.addEventListener('click', () => { animActual = btn.dataset.id; pintarPanelAnimaciones(container); });
    });

    container.querySelector('#pa-agregar').addEventListener('click', async () => {
      const { data, error } = await supabase.from('animaciones_lottie')
        .insert({ juego_id: juego.id, orden: animaciones.length })
        .select().single();
      if (error) { alert(error.message); return; }
      animaciones.push(data);
      animActual = data.id;
      pintarPanelAnimaciones(container);
    });

    const actual = animaciones.find((a) => a.id === animActual);
    const editorEl = container.querySelector('#pa-editor');
    if (!actual) {
      editorEl.innerHTML = '<p class="hint">Todavía no agregaste ninguna animación.</p>';
      return;
    }

    // Cuántas hay ya en cada evento, para avisar si se pasa del tope
    // acordado (más instancias de Rive a la vez empiezan a competir
    // con la animación de los rodillos).
    const cuantasEn = (ev) => animaciones.filter((a) => a.evento === ev && a.id !== actual.id).length;
    const evActual = EVENTOS_ANIM.find((e) => e.valor === actual.evento);
    const pasado = evActual && cuantasEn(actual.evento) >= evActual.tope;

    const sl = (campo, etiqueta, min, max, unidad) => `
      <label style="display:block; margin-bottom:8px; font-size:12px">${etiqueta} <span class="hint" id="pa-out-${campo}">${actual[campo]}${unidad}</span>
        <input type="range" min="${min}" max="${max}" value="${actual[campo]}" data-campo="${campo}" />
      </label>
    `;

    editorEl.innerHTML = `
      <label style="display:block; margin-bottom:8px; font-size:12px">Cuándo se muestra
        <select id="pa-evento" style="width:100%">
          ${EVENTOS_ANIM.map((e) => `<option value="${e.valor}" ${actual.evento === e.valor ? 'selected' : ''}>${e.etiqueta}</option>`).join('')}
        </select>
      </label>
      ${pasado ? `<p class="hint" style="color:var(--danger)">Ya hay ${evActual.tope} animación(es) en este evento. Más de eso puede tironear el giro en celulares.</p>` : ''}
      <label style="display:block; height:56px; border-radius:8px; border:1px dashed var(--border); background:var(--surface-alt); cursor:pointer; overflow:hidden; position:relative; margin-bottom:8px">
        <span class="hint" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px">${actual.lottie_url ? 'Archivo cargado ✓ — tocá para reemplazar' : 'Subir animación (.json o .lottie)'}</span>
        <input type="file" accept=".json,.lottie" hidden id="pa-archivo" />
      </label>
      ${sl('x', 'Posición X', 0, 100, '%')}
      ${sl('y', 'Posición Y', 0, 100, '%')}
      ${sl('tamano', 'Tamaño', 10, 140, '%')}
      <button id="pa-probar" style="width:100%; margin-top:6px">Probar acá</button>
      <button class="primary" id="pa-guardar" style="width:100%; margin-top:8px">Guardar</button>
      <button id="pa-quitar" style="width:100%; margin-top:8px; color:var(--danger)">Quitar esta animación</button>
      <p id="pa-msg" class="hint"></p>
    `;

    editorEl.querySelector('#pa-evento').addEventListener('change', (e) => {
      actual.evento = e.target.value;
      pintarPanelAnimaciones(container);
    });

    editorEl.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        actual[campo] = Number(input.value);
        editorEl.querySelector(`#pa-out-${campo}`).textContent = input.value + '%';
      });
    });

    editorEl.querySelector('#pa-archivo').addEventListener('change', async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const url = await subirArchivoBoton(archivo, `anim-${actual.id}`);
      if (url) { actual.lottie_url = url; pintarPanelAnimaciones(container); }
    });

    // "Probar acá" la muestra en el lugar exacto donde quedó
    // configurada, sin tener que ganar ni recargar.
    editorEl.querySelector('#pa-probar').addEventListener('click', () => {
      detenerAnimacionesJuego();
      mostrarAnimacionJuego(animRiveEl, actual);
    });

    editorEl.querySelector('#pa-guardar').addEventListener('click', async () => {
      const msgEl = editorEl.querySelector('#pa-msg');
      msgEl.textContent = 'Guardando...';
      const { error } = await supabase.from('animaciones_lottie').update({
        evento: actual.evento, lottie_url: actual.lottie_url,
        x: actual.x, y: actual.y, tamano: actual.tamano,
      }).eq('id', actual.id);
      msgEl.textContent = error ? error.message : 'Guardado ✓';
    });

    editorEl.querySelector('#pa-quitar').addEventListener('click', async () => {
      if (!confirm('¿Quitar esta animación?')) return;
      await supabase.from('animaciones_lottie').delete().eq('id', actual.id);
      animaciones = animaciones.filter((a) => a.id !== actual.id);
      animActual = animaciones[0]?.id ?? null;
      detenerAnimacionesJuego();
      pintarPanelAnimaciones(container);
    });
  }

  // Dispara las animaciones configuradas para un evento del juego.
  const lanzarAnimaciones = (evento) => {
    animaciones.filter((a) => a.evento === evento && a.lottie_url)
      .forEach((a) => mostrarAnimacionJuego(animRiveEl, a));
  };

  function pintarPanelLuces(container) {
    container.innerHTML = `
      <div style="display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap; align-items:center">
        <div id="pz-chips" style="display:flex; gap:4px; flex-wrap:wrap; flex:1"></div>
        <button id="pz-agregar" style="font-size:12px; white-space:nowrap">+ Agregar</button>
      </div>
      <div id="pz-editor"></div>
    `;

    const chipsEl = container.querySelector('#pz-chips');
    chipsEl.innerHTML = cadenasLuces.map((c, i) => `
      <button data-id="${c.id}" style="font-size:11px">Cadena ${i + 1}</button>
    `).join('');
    chipsEl.querySelectorAll('button').forEach((btn) => {
      const activo = btn.dataset.id === cadenaActual;
      btn.style.borderColor = activo ? 'var(--accent)' : 'var(--border)';
      btn.style.color = activo ? 'var(--accent)' : 'var(--text)';
      btn.addEventListener('click', () => { cadenaActual = btn.dataset.id; pintarPanelLuces(container); });
    });

    container.querySelector('#pz-agregar').addEventListener('click', async () => {
      const { data, error } = await supabase.from('cadenas_luces')
        .insert({ juego_id: juego.id, orden: cadenasLuces.length })
        .select().single();
      if (error) { alert(error.message); return; }
      cadenasLuces.push(data);
      cadenaActual = data.id;
      reconstruirCadena(data);
      pintarPanelLuces(container);
    });

    const actual = cadenasLuces.find((c) => c.id === cadenaActual);
    const editorEl = container.querySelector('#pz-editor');
    if (!actual) {
      editorEl.innerHTML = '<p class="hint">Todavía no agregaste ninguna cadena.</p>';
      desactivarArrastreLuces();
      return;
    }

    // Valores por defecto en memoria: si todavía no corriste el SQL
    // de formas, el panel igual se dibuja completo en vez de cortarse
    // a la mitad por leer campos que no existen.
    actual.forma = actual.forma || 'circulo';
    actual.ancho = actual.ancho ?? actual.tamano ?? 11;
    actual.alto = actual.alto ?? actual.tamano ?? 11;
    if (!Array.isArray(actual.colores) || !actual.colores.length) actual.colores = ['#EF9F27', '#378ADD'];
    if (!Array.isArray(actual.puntos)) actual.puntos = [];
    actual.figura = actual.figura || 'rectangulo';
    actual.figura_x = actual.figura_x ?? 50;
    actual.figura_y = actual.figura_y ?? 50;
    actual.figura_ancho = actual.figura_ancho ?? 60;
    actual.figura_alto = actual.figura_alto ?? 30;
    actual.figura_rotacion = actual.figura_rotacion ?? 0;
    actual.glow = actual.glow ?? 14;
    actual.nucleo = actual.nucleo ?? 45;
    actual.apagado = actual.apagado ?? 18;
    actual.vidrio = actual.vidrio ?? true;

    editorEl.innerHTML = `
      <label style="display:block; margin-bottom:8px; font-size:12px">Colocación
        <select id="pz-modo" style="width:100%">
          <option value="marco" ${actual.modo === 'marco' ? 'selected' : ''}>Seguir el marco</option>
          <option value="figura" ${actual.modo === 'figura' ? 'selected' : ''}>Figura propia</option>
          <option value="libre" ${actual.modo === 'libre' ? 'selected' : ''}>Libre (arrastrar en la vista previa)</option>
        </select>
      </label>
      ${actual.modo === 'figura' ? `
        <label style="display:block; margin-bottom:8px; font-size:12px">Figura
          <select id="pz-figura" style="width:100%">
            <option value="rectangulo" ${actual.figura === 'rectangulo' ? 'selected' : ''}>Rectángulo</option>
            <option value="circulo" ${actual.figura === 'circulo' ? 'selected' : ''}>Círculo</option>
            <option value="linea" ${actual.figura === 'linea' ? 'selected' : ''}>Línea</option>
          </select>
        </label>
        <label style="display:block; margin-bottom:8px; font-size:12px">Posición X <span class="hint" id="pz-out-figura_x">${actual.figura_x}%</span>
          <input type="range" min="0" max="100" value="${actual.figura_x}" data-campo="figura_x" />
        </label>
        <label style="display:block; margin-bottom:8px; font-size:12px">Posición Y <span class="hint" id="pz-out-figura_y">${actual.figura_y}%</span>
          <input type="range" min="0" max="100" value="${actual.figura_y}" data-campo="figura_y" />
        </label>
        <label style="display:block; margin-bottom:8px; font-size:12px">Ancho de la figura <span class="hint" id="pz-out-figura_ancho">${actual.figura_ancho}%</span>
          <input type="range" min="5" max="120" value="${actual.figura_ancho}" data-campo="figura_ancho" />
        </label>
        <label style="display:block; margin-bottom:8px; font-size:12px">Alto de la figura <span class="hint" id="pz-out-figura_alto">${actual.figura_alto}%</span>
          <input type="range" min="0" max="100" value="${actual.figura_alto}" data-campo="figura_alto" />
        </label>
        <label style="display:block; margin-bottom:8px; font-size:12px">Rotación <span class="hint" id="pz-out-figura_rotacion">${actual.figura_rotacion}°</span>
          <input type="range" min="-180" max="180" value="${actual.figura_rotacion}" data-campo="figura_rotacion" />
        </label>
      ` : ''}
      <label style="display:block; margin-bottom:8px; font-size:12px">Cantidad de focos <span class="hint" id="pz-out-cantidad">${actual.cantidad}</span>
        <input type="range" min="2" max="40" value="${actual.cantidad}" data-campo="cantidad" />
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Forma del foco
        <select id="pz-forma" style="width:100%">
          <option value="circulo" ${(actual.forma || 'circulo') === 'circulo' ? 'selected' : ''}>Círculo</option>
          <option value="cuadrado" ${actual.forma === 'cuadrado' ? 'selected' : ''}>Cuadrado</option>
          <option value="rombo" ${actual.forma === 'rombo' ? 'selected' : ''}>Rombo</option>
          <option value="barra" ${actual.forma === 'barra' ? 'selected' : ''}>Barra</option>
        </select>
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Ancho <span class="hint" id="pz-out-ancho">${actual.ancho ?? actual.tamano}px</span>
        <input type="range" min="3" max="60" value="${actual.ancho ?? actual.tamano}" data-campo="ancho" />
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Alto <span class="hint" id="pz-out-alto">${actual.alto ?? actual.tamano}px</span>
        <input type="range" min="3" max="60" value="${actual.alto ?? actual.tamano}" data-campo="alto" />
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Animación
        <select id="pz-anim" style="width:100%">
          <option value="secuencial" ${actual.animacion === 'secuencial' ? 'selected' : ''}>Secuencial (uno tras otro)</option>
          <option value="sincronizado" ${actual.animacion === 'sincronizado' ? 'selected' : ''}>Todos juntos</option>
          <option value="ola" ${actual.animacion === 'ola' ? 'selected' : ''}>Ola de color</option>
          <option value="alternado" ${actual.animacion === 'alternado' ? 'selected' : ''}>Alternado (marquesina)</option>
          <option value="aleatorio" ${actual.animacion === 'aleatorio' ? 'selected' : ''}>Parpadeo aleatorio</option>
          <option value="vaiven" ${actual.animacion === 'vaiven' ? 'selected' : ''}>Vaivén (ida y vuelta)</option>
        </select>
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Velocidad <span class="hint" id="pz-out-velocidad">${actual.velocidad}x</span>
        <input type="range" min="0.25" max="4" step="0.25" value="${actual.velocidad}" data-campo="velocidad" />
      </label>
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 6px">Aspecto del foco</p>
      <label style="display:block; margin-bottom:8px; font-size:12px">Resplandor <span class="hint" id="pz-out-glow">${actual.glow}px</span>
        <input type="range" min="0" max="34" value="${actual.glow}" data-campo="glow" />
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Núcleo blanco <span class="hint" id="pz-out-nucleo">${actual.nucleo}%</span>
        <input type="range" min="0" max="80" value="${actual.nucleo}" data-campo="nucleo" />
      </label>
      <label style="display:block; margin-bottom:8px; font-size:12px">Brillo apagado <span class="hint" id="pz-out-apagado">${actual.apagado}%</span>
        <input type="range" min="0" max="60" value="${actual.apagado}" data-campo="apagado" />
      </label>
      <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:10px">
        <input type="checkbox" id="pz-vidrio" ${actual.vidrio ? 'checked' : ''} /> Reflejo de vidrio
      </label>
      <p style="font-size:12px; color:var(--text-dim); margin:10px 0 6px">Colores (1 a 8)</p>
      <div id="pz-colores" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px"></div>
      ${actual.modo === 'libre' ? '<p class="hint" style="margin:0 0 10px">Arrastrá cada foco directo en la vista previa para acomodar la cadena.</p>' : ''}
      <button class="primary" id="pz-guardar" style="width:100%; margin-top:6px">Guardar</button>
      <button id="pz-quitar" style="width:100%; margin-top:8px; color:var(--danger)">Quitar esta cadena</button>
      <p id="pz-msg" class="hint"></p>
    `;

    const pintarColores = () => {
      const cont = editorEl.querySelector('#pz-colores');
      cont.innerHTML = actual.colores.map((col, i) => `
        <button data-i="${i}" style="width:26px; height:26px; padding:0; border-radius:50%; background:${col}"></button>
      `).join('') + (actual.colores.length < 8 ? '<button id="pz-agregar-color" style="width:26px; height:26px; padding:0; font-size:14px">+</button>' : '');
      cont.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
        if (actual.colores.length > 1) { actual.colores.splice(Number(b.dataset.i), 1); pintarColores(); }
      }));
      cont.querySelector('#pz-agregar-color')?.addEventListener('click', () => {
        const usado = PALETA_LUCES.findIndex((c) => !actual.colores.includes(c));
        actual.colores.push(usado >= 0 ? PALETA_LUCES[usado] : PALETA_LUCES[actual.colores.length % PALETA_LUCES.length]);
        pintarColores();
      });
    };
    pintarColores();

    reconstruirCadena(actual);
    activarArrastreCadena(actual);

    editorEl.querySelector('#pz-modo').addEventListener('change', (e) => {
      actual.modo = e.target.value;
      reconstruirCadena(actual);
      activarArrastreCadena(actual);
      pintarPanelLuces(container);
    });
    editorEl.querySelector('#pz-anim').addEventListener('change', (e) => { actual.animacion = e.target.value; });

    editorEl.querySelector('#pz-vidrio').addEventListener('change', (e) => {
      actual.vidrio = e.target.checked;
      reconstruirCadena(actual);
      activarArrastreCadena(actual);
    });

    editorEl.querySelector('#pz-figura')?.addEventListener('change', (e) => {
      actual.figura = e.target.value;
      reconstruirCadena(actual);
    });

    editorEl.querySelector('#pz-forma').addEventListener('change', (e) => {
      actual.forma = e.target.value;
      reconstruirCadena(actual);
      activarArrastreCadena(actual);
    });

    editorEl.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const campo = input.dataset.campo;
        actual[campo] = Number(input.value);
        const unidad = ['tamano', 'ancho', 'alto', 'glow'].includes(campo) ? 'px'
          : ['nucleo', 'apagado'].includes(campo) ? '%'
          : campo === 'velocidad' ? 'x'
          : campo === 'figura_rotacion' ? '°'
          : campo.startsWith('figura_') ? '%' : '';
        const out = editorEl.querySelector(`#pz-out-${campo}`);
        if (out) out.textContent = input.value + unidad;
        if (['cantidad', 'tamano', 'ancho', 'alto'].includes(campo) || campo.startsWith('figura_')) {
          reconstruirCadena(actual);
          activarArrastreCadena(actual);
        }
      });
    });

    editorEl.querySelector('#pz-guardar').addEventListener('click', async () => {
      const msgEl = editorEl.querySelector('#pz-msg');
      msgEl.textContent = 'Guardando...';
      const { error } = await supabase.from('cadenas_luces')
        .update({
          modo: actual.modo, cantidad: actual.cantidad, tamano: actual.tamano,
          forma: actual.forma, ancho: actual.ancho, alto: actual.alto,
          figura: actual.figura, figura_x: actual.figura_x, figura_y: actual.figura_y,
          figura_ancho: actual.figura_ancho, figura_alto: actual.figura_alto,
          figura_rotacion: actual.figura_rotacion,
          glow: actual.glow, nucleo: actual.nucleo,
          apagado: actual.apagado, vidrio: actual.vidrio,
          animacion: actual.animacion, velocidad: actual.velocidad,
          colores: actual.colores, puntos: actual.puntos,
        })
        .eq('id', actual.id);
      msgEl.textContent = error
        ? (/glow|nucleo|apagado|vidrio/.test(error.message)
            ? 'Falta correr el SQL 25_focos_realistas.sql en Supabase.'
          : /figura/.test(error.message)
            ? 'Falta correr el SQL 24_figura_luces.sql en Supabase.'
          : /forma|ancho|alto/.test(error.message)
            ? 'Falta correr el SQL 23_formas_luces.sql en Supabase.'
            : error.message)
        : 'Guardado ✓';
    });

    editorEl.querySelector('#pz-quitar').addEventListener('click', async () => {
      if (!confirm('¿Quitar esta cadena de luces?')) return;
      await supabase.from('cadenas_luces').delete().eq('id', actual.id);
      cadenasLuzEl.querySelector(`[data-cadena="${actual.id}"]`)?.remove();
      cadenasLuces = cadenasLuces.filter((c) => c.id !== actual.id);
      cadenaActual = cadenasLuces[0]?.id ?? null;
      pintarPanelLuces(container);
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
    // Le avisa al navegador que esto se va a mover, para que lo
    // maneje la placa de video en vez del procesador.
    cinta.style.willChange = 'transform';

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


  // ---------------- Probador de premios ----------------
  // Arma un resultado a pedido y lo hace pasar por el MISMO camino
  // que un giro real: gira, frena en la combinación elegida, muestra
  // el cuadro de premio, anima el símbolo con su Rive y lanza las
  // animaciones del evento. Así se prueba todo junto sin depender de
  // que la suerte acompañe.
  overlay.querySelector('#pv-probar-premio').addEventListener('click', () => {
    if (girando) return;
    const anterior = overlay.querySelector('#pv-probador');
    if (anterior) { anterior.remove(); return; }

    const caja = document.createElement('div');
    caja.id = 'pv-probador';
    caja.className = 'card';
    caja.style.cssText = 'position:fixed; z-index:60; top:70px; left:50%; transform:translateX(-50%); width:260px';
    caja.innerHTML = `
      <p style="font-size:13px; font-weight:600; margin:0 0 10px">Probar premio</p>
      <label style="display:block; margin-bottom:8px; font-size:12px">Símbolo
        <select id="pp-simbolo" style="width:100%">
          ${simbolos.map((s, i) => `<option value="${i}">${escapeHtml(s.nombre)}</option>`).join('')}
        </select>
      </label>
      <label style="display:block; margin-bottom:10px; font-size:12px">Combinación
        <select id="pp-nivel" style="width:100%">
          <option value="dos_iguales">Dos iguales (rodillos 1-2)</option>
          <option value="tres_iguales">Tres iguales</option>
          <option value="premio_mayor">Premio mayor</option>
        </select>
      </label>
      <button class="primary" id="pp-simular" style="width:100%">Simular</button>
      <p class="hint" style="margin-top:8px">Gira igual que de verdad y dispara todo lo que tenga ese premio.</p>
    `;
    overlay.appendChild(caja);

    caja.querySelector('#pp-simular').addEventListener('click', () => {
      const simbolo = simbolos[Number(caja.querySelector('#pp-simbolo').value)];
      const nivelElegido = caja.querySelector('#pp-nivel').value;
      if (!simbolo) return;

      const otro = simbolos.find((s) => s.nombre !== simbolo.nombre) || simbolo;
      const alAzar = () => simbolos[Math.floor(Math.random() * simbolos.length)];

      // La línea de pago es la fila del medio; arriba y abajo van
      // símbolos cualesquiera, como en un giro real.
      const columnaCon = (medio) => [alAzar(), medio, alAzar()];
      const dosIguales = nivelElegido === 'dos_iguales';
      const grillaForzada = [
        columnaCon(simbolo),
        columnaCon(simbolo),
        columnaCon(dosIguales ? otro : simbolo),
      ];

      const pago = dosIguales ? (Number(simbolo.pago_dos) || 0) : (Number(simbolo.pago_tres) || 0);
      resultadoForzado = {
        grilla: grillaForzada,
        premio: pago,
        nivel: nivelElegido === 'dos_iguales' ? 'dos_iguales' : nivelElegido,
        simbolosGanadores: dosIguales ? [0, 1] : [0, 1, 2],
        filaPago: 1,
      };

      caja.remove();
      btnGirar.click();
    });
  });

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
    // El probador de premios deja un resultado preparado; si no hay
    // ninguno, se gira normal. Así el probador recorre exactamente el
    // mismo camino que un giro de verdad, sin una vía aparte que
    // pueda quedar desfasada de la real.
    const { grilla, premio, nivel, simbolosGanadores, filaPago } = resultadoForzado || girar(simbolos);
    resultadoForzado = null;
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    detenerAnimacionesSimbolos();
    detenerAnimacionesJuego();
    lanzarAnimaciones('girar');

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
      lanzarAnimaciones(nivel === 'premio_mayor' ? 'premio_mayor' : 'premio_chico');
      // El símbolo del medio de cada cinta es siempre el de la línea
      // de pago (índice RELLENO+1: los 3 finales son [arriba, medio,
      // abajo], en ese orden, al final de cada cinta). Solo se marcan
      // y animan las columnas que REALMENTE forman parte del premio.
      const columnasGanadoras = simbolosGanadores?.length ? simbolosGanadores : [0, 1, 2];
      cintas.forEach((cinta, col) => {
        if (!columnasGanadoras.includes(col)) return;
        const celdaGanadora = cinta.children[RELLENO + 1];
        if (!celdaGanadora) return;
        celdaGanadora.classList.add('celda-ganadora');
        const simboloGanador = grilla[col][filaPago];
        animarSimboloGanador(celdaGanadora, simboloGanador, nivel);
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
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
