// Pantalla jugable real, sin login: a esta la abre directo el
// jugador cuando toca el juego en el portal de Win777, con
// ?slug=...&token=...&operador=... en la URL. El token identifica
// al jugador pero por sí solo no mueve plata — cada giro lo resuelve
// el servidor (/api/jugar-girar), nunca el navegador.
//
// Es la versión "solo mostrar" de lo que hace preview.js: mismas
// capas, misma animación de rodillos, mismo cuadro de premio — pero
// sin el editor ni el panel de ajuste, porque acá no se edita nada,
// solo se juega.

import './styles.css';
import { ANCHO_ESC, ALTO_ESC, construirCadena, iniciarAnimacionLuces } from './luces.js';
import { mostrarTablaPagos } from './tabla-pagos.js';
import { animarSimboloGanador, detenerAnimacionesSimbolos, mostrarAnimacionJuego, detenerAnimacionesJuego } from './lottie.js';

const params = new URLSearchParams(location.search);
const slug = params.get('slug');
const token = params.get('token');
const raiz = document.getElementById('app');

// Del lado del jugador nada de esto se toca ni se copia: mantener
// presionado abría el menú de Chrome mostrando la URL del archivo y
// del Supabase. Los botones siguen andando normal — esto solo mata
// el menú largo, la selección y el arrastre de imágenes.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

raiz.innerHTML = '<p class="hint" style="padding:40px; text-align:center">Cargando...</p>';
arrancar();

async function arrancar() {
  if (!slug || !token) {
    mostrarError('Falta el juego o el token de acceso.');
    return;
  }
  try {
    const [datos, balance] = await Promise.all([
      fetchJson(`/api/jugar-datos?slug=${encodeURIComponent(slug)}`),
      fetchJson(`/api/jugar-balance?token=${encodeURIComponent(token)}`),
    ]);

    // Intro: corre ANTES de la pantalla de carga, pero la descarga de
    // imágenes y sonidos arranca en paralelo — así la intro no le
    // suma tiempo de espera al jugador, solo tapa el que ya existía.
    const intro = (datos.animaciones || []).find((a) => a.evento === 'intro' && a.lottie_url);

    // El juego se arma escondido detrás de la pantalla de carga y se
    // revela recién cuando todo terminó de bajar. Si no, cada imagen
    // aparece cuando puede y el jugador ve el juego armarse de a
    // pedazos, que da sensación de cosa a medio hacer.
    const pantalla = mostrarPantallaCarga(datos.juego);
    render(datos, balance.saldo);

    const juegoEl = raiz.querySelector('#jg-escenario');
    if (juegoEl) { juegoEl.style.opacity = '0'; juegoEl.style.transition = 'opacity .45s'; }
    raiz.appendChild(pantalla.el);

    // La descarga empieza YA, sin esperar a que termine la intro.
    const descarga = esperarRecursos(datos, pantalla.avance);

    if (intro) await correrIntro(intro, pantalla.el);

    await descarga;

    if (juegoEl) juegoEl.style.opacity = '1';
    pantalla.el.style.opacity = '0';
    setTimeout(() => pantalla.el.remove(), 400);
  } catch (err) {
    mostrarError(err.message || 'No se pudo cargar el juego.');
  }
}

// Corre la animación de intro por encima de la pantalla de carga, y
// devuelve el control cuando la animación terminó su pasada.
//
// TOPE DE 2,5 SEGUNDOS a propósito: si alguien sube por error una
// animación larga, o el archivo nunca avisa que terminó, la entrada
// al juego no puede quedar trabada esperándola.
function correrIntro(cfg, pantallaEl) {
  return new Promise((listo) => {
    // La animación se posiciona en % de la pantalla del juego (420x860),
    // así que la capa que la contiene tiene que tener esa misma forma
    // y escalarse igual — si no, la posición que ajustaste en el
    // ensamblador caería en otro lado durante la intro.
    const escala = Math.min(window.innerWidth / 420, window.innerHeight / 860);
    const capa = document.createElement('div');
    capa.style.cssText = 'position:absolute; left:50%; top:50%; width:420px; height:860px;'
      + `transform:translate(-50%,-50%) scale(${escala}); z-index:2; pointer-events:none;`;
    pantallaEl.appendChild(capa);

    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(tope);
      capa.style.transition = 'opacity .3s';
      capa.style.opacity = '0';
      setTimeout(() => { detenerAnimacionesJuego(); capa.remove(); }, 320);
      listo();
    };

    const tope = setTimeout(cerrar, 2500);
    mostrarAnimacionJuego(capa, cfg, cerrar);
  });
}

// Pantalla de carga: imagen propia del juego si tiene, si no la
// portada, y si tampoco hay, solo el nombre. Nunca queda en blanco.
function mostrarPantallaCarga(juego) {
  const imagen = juego.carga_url || juego.portada_url || null;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed; inset:0; z-index:9999; background:#0b0e14;'
    + 'display:flex; flex-direction:column; align-items:center; justify-content:center;'
    + 'gap:16px; transition:opacity .35s;';
  el.innerHTML = `
    ${imagen ? `<img src="${imagen}" style="width:140px; height:140px; object-fit:contain; border-radius:12px" />` : ''}
    <p style="font-size:14px; color:var(--text-dim); margin:0; letter-spacing:.08em">${escapeHtml(juego.nombre || '').toUpperCase()}</p>
    <div style="width:160px; height:4px; border-radius:2px; background:#1c2433; overflow:hidden">
      <div id="jg-carga-barra" style="width:0%; height:100%; background:var(--accent); transition:width .25s"></div>
    </div>
    <p id="jg-carga-pct" style="font-size:11px; color:var(--text-dim); margin:0">0%</p>
  `;
  const barra = el.querySelector('#jg-carga-barra');
  const pctEl = el.querySelector('#jg-carga-pct');
  return {
    el,
    avance: (hechos, total) => {
      const p = total ? Math.round((hechos / total) * 100) : 100;
      barra.style.width = p + '%';
      pctEl.textContent = p + '%';
    },
  };
}

// Espera a que bajen imágenes Y sonidos. El progreso es real: cuenta
// archivos terminados, no un temporizador.
//
// TOPE DE SEGURIDAD: pasados los 15 segundos entra igual. Un archivo
// roto o un audio que nunca termina no puede dejar al jugador mirando
// una pantalla de carga para siempre — mejor entrar con una imagen
// faltante que no entrar nunca.
function esperarRecursos(datos, avance) {
  const { juego, simbolos, sonidos, digitos, capasLibres, botones } = datos;

  const imagenes = [
    juego.fondo_url, juego.fondo_pantalla_url, juego.marco_url, juego.cartel_url,
    juego.girar_imagen_url, juego.saldo_fondo_url, juego.apuesta_fondo_url,
    ...simbolos.map((s) => s.icono_url),
    ...(digitos || []).map((d) => d.imagen_url),
    ...(capasLibres || []).map((c) => c.imagen_url),
    ...(botones || []).map((b) => b.imagen_url),
  ].filter(Boolean);

  const audios = (sonidos || []).map((s) => s.archivo_url).filter(Boolean);
  const total = imagenes.length + audios.length;
  if (!total) { avance(1, 1); return Promise.resolve(); }

  let hechos = 0;
  const marcar = () => { hechos++; avance(hechos, total); };

  const tareas = [
    ...imagenes.map((url) => new Promise((listo) => {
      const img = new Image();
      // onerror también resuelve: una imagen rota no debe trabar todo.
      img.onload = img.onerror = () => { marcar(); listo(); };
      img.src = url;
    })),
    ...audios.map((url) => new Promise((listo) => {
      const a = new Audio();
      const fin = () => { marcar(); listo(); };
      a.addEventListener('canplaythrough', fin, { once: true });
      a.addEventListener('error', fin, { once: true });
      a.preload = 'auto';
      a.src = url;
    })),
  ];

  return Promise.race([
    Promise.all(tareas),
    new Promise((listo) => setTimeout(listo, 15000)),
  ]);
}

function mostrarError(msg) {
  raiz.innerHTML = `<p style="padding:40px; text-align:center; color:var(--danger)">${escapeHtml(msg)}</p>`;
}

async function fetchJson(url, opciones) {
  const res = await fetch(url, opciones);

  let data = {};

  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detalle =
      data?.error ||
      data?.message ||
      `El servidor respondió con HTTP ${res.status}`;

    throw new Error(`Error ${res.status}: ${detalle}`);
  }

  return data;
}

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

function ordenPorDefecto(juego) {
  const orden = juego.capas_orden;
  if (Array.isArray(orden) && orden.length === 4) return [...orden];
  return ['fondo_pantalla', 'marco', 'grilla', 'cartel'];
}

function render(datos, saldoInicial) {
  const { juego, simbolos, sonidos: sonidosData, efectos, premios, digitos, capasLibres, cadenasLuces, animaciones } = datos;

  const pos = conDefaults(juego);
  const ordenCapas = ordenPorDefecto(juego);
  const pasoApuesta = Number(juego.paso_apuesta) || 500;
  const apuestaMin = Number(juego.min_bet) || 1000;
  const apuestaMax = Number(juego.max_bet) || 100000;
  let apuesta = apuestaMin;
  let velocidad = 1;
  let saldo = Number(saldoInicial);
  let girando = false;

  const posPremio = {};
  ['dos_iguales', 'tres_iguales', 'premio_mayor'].forEach((valor) => {
    const fila = premios.find((f) => f.nivel_premio === valor);
    posPremio[valor] = {
      imagen_url: fila?.imagen_url || null,
      x: fila?.x ?? 50, y: fila?.y ?? 50, ancho: fila?.ancho ?? 60, alto: fila?.alto ?? 30,
      blur: fila?.blur ?? 0, oscurecer: fila?.oscurecer ?? 0,
      imagen_x: fila?.imagen_x ?? 50, imagen_y: fila?.imagen_y ?? 50, imagen_tamano: fila?.imagen_tamano ?? 60,
      monto_x: fila?.monto_x ?? 50, monto_y: fila?.monto_y ?? 50,
      monto_alto: fila?.monto_alto ?? 44, monto_espaciado: fila?.monto_espaciado ?? 4,
    };
  });

  const mapaDigitos = {};
  digitos.forEach((d) => { if (d.imagen_url) mapaDigitos[d.caracter] = d.imagen_url; });

  const cssEfectos = efectos.map((ef) => ef.css || '').join('\n');
  const audios = {};
  sonidosData.forEach((s) => { audios[s.tipo] = new Audio(s.archivo_url); });
  if (audios.musica_fondo) { audios.musica_fondo.loop = true; audios.musica_fondo.volume = 0.5; }

  const fondoBg = juego.fondo_url ? `center/cover url('${juego.fondo_url}')` : 'var(--surface-alt)';

  raiz.innerHTML = `
    <style>
      #app, #app * {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      #app img {
        -webkit-user-drag: none;
        user-drag: none;
        pointer-events: none;
      }
      #app button, #app button * { pointer-events: auto; }
      ${cssEfectos}
    </style>
    <div id="jg-escenario" style="min-height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden">
      <div id="jg-marco-cap" style="width:420px; height:860px; flex-shrink:0; transform-origin:center center; background:var(--surface); border-radius:20px; padding:22px; position:relative; overflow:visible">
        ${juego.fondo_pantalla_url ? `<img id="jg-fondo-pantalla" src="${juego.fondo_pantalla_url}" style="position:absolute; object-fit:fill" />` : ''}
        ${juego.marco_url ? `<img id="jg-marco" src="${juego.marco_url}" style="position:absolute; object-fit:fill" />` : ''}

        ${(juego.mostrar_nombre ?? true) ? `
        <div style="display:flex; align-items:center; gap:8px; position:relative; z-index:10">
          <p style="flex:1; text-align:center; font-weight:600; margin:0; letter-spacing:.04em">${escapeHtml(juego.nombre).toUpperCase()}</p>
        </div>` : ''}

        <div id="jg-grilla" style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; border-radius:12px; padding:8px; position:absolute; overflow:hidden; aspect-ratio:1">
          <div id="jg-grilla-fondo" style="position:absolute; inset:0; background:${fondoBg}; z-index:0"></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-0" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-1" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-2" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div id="jg-efecto-premio" style="position:absolute; inset:0; pointer-events:none; opacity:0; z-index:2"></div>
        </div>

        ${juego.cartel_url ? `<img id="jg-cartel" src="${juego.cartel_url}" style="position:absolute; object-fit:fill" />` : ''}

        <div id="jg-capas-libres" style="position:absolute; inset:0; z-index:8; pointer-events:none"></div>

        <div id="jg-cadenas-luces" style="position:absolute; inset:0; z-index:9; pointer-events:none"></div>

        <div id="jg-anim-rive" style="position:absolute; inset:0; z-index:14; pointer-events:none"></div>

        <button id="jg-info" aria-label="Ver reglas y tabla de pagos" style="position:absolute; right:22px; top:22px; z-index:12; width:30px; height:30px; padding:0; border-radius:50%">ℹ</button>

        <div id="jg-premio-popup" style="position:absolute; z-index:15; display:none; border-radius:12px; background:rgba(0,0,0,.55); transition:opacity .25s; opacity:0; transform:translate(-50%,-50%)">
          <img id="jg-img-premio" style="position:absolute; z-index:0; display:none" />
          <strong id="jg-premio-monto" style="position:absolute; z-index:1; font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); white-space:nowrap"></strong>
        </div>

        <div id="jg-grupo-saldo" style="position:absolute; z-index:10; white-space:nowrap; display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
          <p class="hint" style="margin:0">Saldo</p>
          <strong id="jg-saldo" style="font-size:18px">${saldo.toLocaleString('es-PY')}</strong>
        </div>

        <div id="jg-grupo-apuesta" style="position:absolute; z-index:10; display:flex; align-items:center; gap:6px; white-space:nowrap">
          <button id="jg-apuesta-menos" aria-label="Bajar apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
            <span class="jg-btn-texto">−</span>
            <img class="jg-btn-img" style="display:none; object-fit:contain" />
          </button>
          <div id="jg-caja-apuesta" style="display:flex; flex-direction:column; align-items:center; justify-content:center; background-size:100% 100%; background-repeat:no-repeat">
            <p class="hint" style="margin:0">Apuesta</p>
            <strong id="jg-apuesta" style="font-size:15px"></strong>
          </div>
          <button id="jg-apuesta-mas" aria-label="Subir apuesta" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden">
            <span class="jg-btn-texto">+</span>
            <img class="jg-btn-img" style="display:none; object-fit:contain" />
          </button>
        </div>

        <div id="jg-fichas" style="position:absolute; z-index:10; display:flex; gap:4px; flex-wrap:wrap; justify-content:center; white-space:nowrap"></div>

        <div id="jg-turbo" style="position:absolute; z-index:10; display:flex; gap:3px; white-space:nowrap"></div>

        <button id="jg-girar" style="position:absolute; z-index:11; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden">
          <span id="jg-girar-texto" style="font-size:14px">Girar</span>
          <img id="jg-girar-img" style="display:none; object-fit:contain" />
        </button>
      </div>
    </div>
  `;

  const capEl = raiz.querySelector('#jg-marco-cap');

  // La pantalla del juego SIEMPRE mide 420x860 por dentro: eso es lo
  // que ves en el ensamblador y lo que ve el jugador. Para que entre
  // en cualquier celular no se estira (eso deformaba el layout: la
  // grilla pisaba el marco, el cartel se corría), se escala entera
  // manteniendo la proporción. Un solo diseño, idéntico en todos los
  // dispositivos, y los tamaños en px (botón de girar, dígitos del
  // monto) escalan junto con el resto.
  const ANCHO_BASE = 420, ALTO_BASE = 860;
  const ajustarEscala = () => {
    const escala = Math.min(window.innerWidth / ANCHO_BASE, window.innerHeight / ALTO_BASE);
    capEl.style.transform = `scale(${escala})`;
    // Sin esto, el hueco que deja el elemento sigue siendo el del
    // tamaño original y aparecen barras de scroll fantasma.
    capEl.style.margin = `${(ALTO_BASE * escala - ALTO_BASE) / 2}px ${(ANCHO_BASE * escala - ANCHO_BASE) / 2}px`;
  };
  ajustarEscala();
  window.addEventListener('resize', ajustarEscala);
  window.addEventListener('orientationchange', ajustarEscala);

  const ELEMENTO_CAPA = {
    fondo_pantalla: raiz.querySelector('#jg-fondo-pantalla'),
    marco: raiz.querySelector('#jg-marco'),
    grilla: raiz.querySelector('#jg-grilla'),
    cartel: raiz.querySelector('#jg-cartel'),
  };
  const grillaFondoEl = raiz.querySelector('#jg-grilla-fondo');
  const premioPopupEl = raiz.querySelector('#jg-premio-popup');
  const imgPremio = raiz.querySelector('#jg-img-premio');
  const montoPremioEl = raiz.querySelector('#jg-premio-monto');
  const capasLibresEl = raiz.querySelector('#jg-capas-libres');
  const cadenasLuzEl = raiz.querySelector('#jg-cadenas-luces');
  const animRiveEl = raiz.querySelector('#jg-anim-rive');

  // Complementos de Rive: acompañan al momento (el dragón escupiendo
  // fuego mientras los símbolos festejan). Se cortan al arrancar el
  // giro siguiente, así nunca se superponen dos festejos.
  const lanzarAnimaciones = (evento) => {
    (animaciones || []).filter((a) => a.evento === evento && a.lottie_url)
      .forEach((a) => mostrarAnimacionJuego(animRiveEl, a));
  };
  const cintas = [0, 1, 2].map((i) => raiz.querySelector(`#jg-cinta-${i}`));
  const efectoPremio = raiz.querySelector('#jg-efecto-premio');
  const btnGirar = raiz.querySelector('#jg-girar');
  const saldoEl = raiz.querySelector('#jg-saldo');
  const girarImgEl = raiz.querySelector('#jg-girar-img');
  const girarTextoEl = raiz.querySelector('#jg-girar-texto');

  const tamBoton = Number(juego.girar_tamano) || 64;
  Object.assign(btnGirar.style, {
    left: (juego.girar_x ?? 50) + '%', top: (juego.girar_y ?? 90) + '%',
    transform: 'translate(-50%,-50%)', width: tamBoton + 'px', height: tamBoton + 'px',
    background: juego.girar_sin_fondo ? 'transparent' : '',
    border: juego.girar_sin_fondo ? 'none' : '',
  });
  if (juego.girar_imagen_url) {
    const tamImg = tamBoton * (Number(juego.girar_imagen_tamano) || 70) / 100;
    girarImgEl.src = juego.girar_imagen_url;
    girarImgEl.style.display = 'block';
    girarImgEl.style.width = tamImg + 'px';
    girarImgEl.style.height = tamImg + 'px';
    girarTextoEl.style.display = 'none';
  }

  // El jugador puede ver las mismas reglas y la misma tabla de pagos
  // que ve el ensamblador: es la información con la que decide si
  // apostar, no puede quedar del lado de adentro solamente.
  raiz.querySelector('#jg-info').addEventListener('click', () => {
    mostrarTablaPagos(raiz, simbolos, juego);
  });

  const apuestaEl = raiz.querySelector('#jg-apuesta');
  const pintarApuesta = () => { apuestaEl.textContent = apuesta.toLocaleString('es-PY'); };
  pintarApuesta();

  // Posición de los tres grupos y aspecto de cada botón chico, tal
  // como quedaron configurados en el ensamblador.
  const cfgBotones = {};
  ['menos', 'mas', 'x1', 'x2', 'x3'].forEach((clave) => {
    const fila = (datos.botones || []).find((b) => b.clave === clave);
    cfgBotones[clave] = {
      imagen_url: fila?.imagen_url || null,
      tamano: fila?.tamano ?? 28,
      imagen_tamano: fila?.imagen_tamano ?? 70,
      sin_fondo: fila?.sin_fondo ?? false,
    };
  });

  const ubicarGrupo = (sel, x, y) => {
    const el = raiz.querySelector(sel);
    if (el) Object.assign(el.style, { left: x + '%', top: y + '%', transform: 'translate(-50%,-50%)' });
  };
  ubicarGrupo('#jg-grupo-saldo', juego.saldo_x ?? 14, juego.saldo_y ?? 96);
  ubicarGrupo('#jg-grupo-apuesta', juego.apuesta_x ?? 50, juego.apuesta_y ?? 96);
  ubicarGrupo('#jg-turbo', juego.turbo_x ?? 86, juego.turbo_y ?? 96);
  ubicarGrupo('#jg-fichas', juego.fichas_x ?? 50, juego.fichas_y ?? 88);

  // Recuadros de Saldo y Apuesta: la imagen va de fondo estirada al
  // tamaño configurado, con el texto siempre encima y centrado.
  const grupoSaldoEl = raiz.querySelector('#jg-grupo-saldo');
  const cajaApuestaEl = raiz.querySelector('#jg-caja-apuesta');
  Object.assign(grupoSaldoEl.style, {
    width: (juego.saldo_ancho ?? 110) + 'px', height: (juego.saldo_alto ?? 44) + 'px',
    backgroundImage: juego.saldo_fondo_url ? `url('${juego.saldo_fondo_url}')` : 'none',
  });
  Object.assign(cajaApuestaEl.style, {
    width: (juego.apuesta_ancho ?? 110) + 'px', height: (juego.apuesta_alto ?? 44) + 'px',
    backgroundImage: juego.apuesta_fondo_url ? `url('${juego.apuesta_fondo_url}')` : 'none',
  });

  // Modo de apuesta: qué controles se dibujan lo decide el
  // ensamblador. El monto se valida igual en el servidor.
  const modoApuesta = juego.modo_apuesta || 'mixto';
  const fichasPorDefecto = [1, 2, 5, 20, 50].map((m) => apuestaMin * m).filter((f) => f <= apuestaMax);
  const fichas = (juego.fichas?.length ? juego.fichas.map(Number) : fichasPorDefecto);
  const fichasEl = raiz.querySelector('#jg-fichas');

  const conFichas = modoApuesta === 'fichas' || modoApuesta === 'mixto';
  const conMasMenos = modoApuesta === 'mas_menos' || modoApuesta === 'mixto';
  fichasEl.style.display = conFichas ? 'flex' : 'none';
  raiz.querySelector('#jg-apuesta-menos').style.display = conMasMenos ? 'flex' : 'none';
  raiz.querySelector('#jg-apuesta-mas').style.display = conMasMenos ? 'flex' : 'none';

  const pintarFichas = () => {
    if (!conFichas) return;
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
  pintarFichas();

  const aplicarBoton = (el, cfg) => {
    if (!el) return;
    Object.assign(el.style, {
      width: cfg.tamano + 'px', height: cfg.tamano + 'px',
      background: cfg.sin_fondo ? 'transparent' : '',
      border: cfg.sin_fondo ? 'none' : '',
    });
    const img = el.querySelector('.jg-btn-img');
    const texto = el.querySelector('.jg-btn-texto');
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
  aplicarBoton(raiz.querySelector('#jg-apuesta-menos'), cfgBotones.menos);
  aplicarBoton(raiz.querySelector('#jg-apuesta-mas'), cfgBotones.mas);

  raiz.querySelector('#jg-apuesta-mas').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.min(apuestaMax, apuesta + pasoApuesta);
    pintarApuesta();
    pintarFichas();
  });
  raiz.querySelector('#jg-apuesta-menos').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.max(apuestaMin, apuesta - pasoApuesta);
    pintarApuesta();
    pintarFichas();
  });

  const turboEl = raiz.querySelector('#jg-turbo');
  const pintarTurbo = () => {
    turboEl.innerHTML = [1, 2, 3].map((v) => `
      <button data-v="${v}" style="padding:0; display:flex; align-items:center; justify-content:center; overflow:hidden; ${v === velocidad ? 'border-color:var(--accent); color:var(--accent)' : ''}">
        <span class="jg-btn-texto" style="font-size:11px">x${v}</span>
        <img class="jg-btn-img" style="display:none; object-fit:contain" />
      </button>
    `).join('');
    turboEl.querySelectorAll('button').forEach((b) => {
      aplicarBoton(b, cfgBotones['x' + b.dataset.v]);
      b.addEventListener('click', () => { velocidad = Number(b.dataset.v); pintarTurbo(); });
    });
  };
  pintarTurbo();

  const filtroCss = (blur, oscurecer) => `blur(${blur}px) brightness(${1 - oscurecer / 100})`;

  const aplicarOrden = () => {
    ordenCapas.forEach((capa, i) => { if (ELEMENTO_CAPA[capa]) ELEMENTO_CAPA[capa].style.zIndex = i; });
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

  const aplicarFiltros = () => {
    if (ELEMENTO_CAPA.fondo_pantalla) ELEMENTO_CAPA.fondo_pantalla.style.filter = filtroCss(pos.fondo_pantalla_blur, pos.fondo_pantalla_oscurecer);
    if (ELEMENTO_CAPA.marco) ELEMENTO_CAPA.marco.style.filter = filtroCss(pos.marco_blur, pos.marco_oscurecer);
    if (ELEMENTO_CAPA.cartel) ELEMENTO_CAPA.cartel.style.filter = filtroCss(pos.cartel_blur, pos.cartel_oscurecer);
    grillaFondoEl.style.filter = filtroCss(pos.fondo_blur, pos.fondo_oscurecer);
  };

  const aplicarCapasLibres = () => {
    capasLibresEl.innerHTML = capasLibres.map((c) => c.imagen_url ? `
      <img src="${c.imagen_url}" style="position:absolute; left:${c.x}%; top:${c.y}%; width:${c.tamano}%; height:auto; transform:translate(-50%,-50%) rotate(${c.angulo}deg); filter:${filtroCss(c.blur, c.oscurecer)}" />
    ` : '').join('');
  };

  // ---------------- Cadenas de luces ----------------
  // Solo se muestran: acá no se editan ni se arrastran, el jugador no
  // configura nada. La geometría se calcula sobre la pantalla fija de
  // 420x860, la misma que usa el ensamblador, así se ve idéntico.
  // Cadenas de luces — geometría, formas y animación viven en
  // src/luces.js, compartido con la otra pantalla.
  const rectMarco = () => {
    if (juego.marco_url) {
      const w = pos.marco_ancho / 100 * ANCHO_ESC, h = pos.marco_alto / 100 * ALTO_ESC;
      return { left: pos.marco_x / 100 * ANCHO_ESC - w / 2, top: pos.marco_y / 100 * ALTO_ESC - h / 2, w, h };
    }
    return { left: ANCHO_ESC * 0.1, top: ALTO_ESC * 0.1, w: ANCHO_ESC * 0.8, h: ALTO_ESC * 0.8 };
  };

  // Acá las luces solo se muestran: no se editan ni se arrastran.
  const construirTodas = () => {
    cadenasLuzEl.innerHTML = '';
    (cadenasLuces || []).forEach((c) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute; inset:0; pointer-events:none';
      cadenasLuzEl.appendChild(wrap);
      construirCadena(wrap, c, rectMarco);
    });
  };
  construirTodas();

  // Un solo intervalo para todas las cadenas, igual que en el
  // ensamblador: no se crea un timer por cadena.
  if ((cadenasLuces || []).length) iniciarAnimacionLuces(() => cadenasLuces, () => girando);

  let montoDemoTexto = null;
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
    Object.assign(imgPremio.style, {
      left: p.imagen_x + '%', top: p.imagen_y + '%', width: p.imagen_tamano + '%', height: 'auto',
      transform: 'translate(-50%,-50%)',
    });
    Object.assign(montoPremioEl.style, {
      left: p.monto_x + '%', top: p.monto_y + '%', transform: 'translate(-50%,-50%)',
    });
    if (montoDemoTexto !== null) pintarMonto(montoPremioEl, montoDemoTexto, p.monto_alto, p.monto_espaciado);
  };

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

  aplicarPosiciones();
  aplicarOrden();
  aplicarFiltros();
  aplicarCapasLibres();

  // ================= MOTOR DE ANIMACIÓN DE RODILLOS =================
  //
  // Solo dibuja: el resultado lo decide el servidor y esta parte se
  // limita a llevar visualmente los rodillos hasta ese resultado.
  //
  // Cómo funciona, y por qué así:
  //
  //  - Las celdas se crean UNA sola vez, al abrir el juego. Durante
  //    el giro no se crea ni se borra ningún elemento: lo único que
  //    cambia es el `src` de tres imágenes que en ese momento están
  //    fuera de la vista. Antes se agregaban y reconstruían decenas
  //    de celdas en pleno movimiento, y eso obligaba al navegador a
  //    recalcular todo justo cuando menos podía.
  //
  //  - La posición la controla un solo bucle de requestAnimationFrame
  //    con una variable en píxeles. Antes se mezclaba una animación
  //    CSS infinita con una transición, y para pasar de una a otra
  //    había que leer la posición con getComputedStyle: ese cruce era
  //    el que producía los saltos y las "teletransportaciones".
  //
  //  - La cinta tiene LOOP celdas más una copia de las 3 primeras al
  //    final, y la posición se toma en módulo. Así el giro puede
  //    durar lo que haga falta sin que se note dónde vuelve a
  //    empezar, y sin ir alargando la tira.
  const LOOP = 20;
  const CELDAS_TIRA = LOOP + 3;
  const DURACION_BASE = [1100, 1320, 1540];
  // Cuánto se pasa el rodillo del punto final antes de acomodarse.
  // Es chico a propósito: lo justo para que se sienta que algo con
  // peso frenó, no un rebote de dibujo animado.
  const PASADA = 0.11;

  function elegirSimboloFiller(total) {
    let r = Math.random() * total;
    for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
    return simbolos[simbolos.length - 1];
  }

  // Cada celda nace con su <img> y su <span> ya creados. Cambiar de
  // símbolo es cambiar un `src` y una visibilidad — nunca crear
  // elementos nuevos, que es lo caro.
  function crearCelda(tamano) {
    const div = document.createElement('div');
    div.style.cssText = `width:${tamano}px; height:${tamano}px; display:flex; align-items:center; justify-content:center; flex-shrink:0`;
    const img = document.createElement('img');
    img.style.cssText = 'width:60%; height:60%; object-fit:contain; display:none';
    img.draggable = false;
    const span = document.createElement('span');
    span.style.cssText = 'font-size:11px; color:#8fae9a; display:none';
    div.append(img, span);
    return div;
  }

  function ponerSimbolo(celda, simbolo) {
    const img = celda.firstElementChild;
    const span = celda.lastElementChild;
    if (simbolo.icono_url) {
      if (img.getAttribute('src') !== simbolo.icono_url) img.src = simbolo.icono_url;
      img.style.display = 'block';
      span.style.display = 'none';
    } else {
      span.textContent = simbolo.nombre;
      span.style.display = 'block';
      img.style.display = 'none';
    }
  }

  // Estado de cada rodillo. `y` es la distancia total recorrida en
  // píxeles; lo que se dibuja es esa distancia en módulo del largo
  // del bucle.
  const rodillos = [0, 1, 2].map(() => ({
    y: 0, v: 0, vMax: 0, celdaPx: 0, loopPx: 0, celdas: [],
    fase: 'quieto', destino: 0, salida: 0, distancia: 0, inicio: 0, duracion: 0, pasada: 0,
  }));

  function medirYConstruir() {
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    cintas.forEach((cinta, col) => {
      const r = rodillos[col];
      const celdaPx = cinta.parentElement.clientWidth;
      if (!celdaPx) return;
      r.celdaPx = celdaPx;
      r.loopPx = LOOP * celdaPx;
      cinta.innerHTML = '';
      r.celdas = [];
      for (let i = 0; i < CELDAS_TIRA; i++) {
        const celda = crearCelda(celdaPx);
        cinta.appendChild(celda);
        r.celdas.push(celda);
      }
      // Relleno inicial: las 3 últimas copian a las 3 primeras para
      // que el punto de repetición sea invisible.
      const tira = Array.from({ length: LOOP }, () => elegirSimboloFiller(total));
      tira.forEach((sim, i) => ponerSimbolo(r.celdas[i], sim));
      for (let i = 0; i < 3; i++) ponerSimbolo(r.celdas[LOOP + i], tira[i]);
      cinta.style.transform = 'translate3d(0,0,0)';
      cinta.style.backfaceVisibility = 'hidden';
    });
  }

  // Al abrir ya se ven símbolos, pero nunca una combinación que
  // pagaría: mostrar un premio que el jugador no ganó se lee como
  // una estafa aunque sea solo decorado.
  function lineaPagaria(linea) {
    const reales = linea.filter((s) => s.nombre !== 'wild');
    const cand = reales.length ? reales[0] : linea[0];
    if (linea.every((s) => s === cand || s.nombre === 'wild')) return true;
    return linea[0] === linea[1] || linea[0].nombre === 'wild' || linea[1].nombre === 'wild';
  }

  function pintarGrillaInicial() {
    medirYConstruir();
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    let grillaDemo;
    for (let intento = 0; intento < 40; intento++) {
      grillaDemo = [0, 1, 2].map(() => [0, 1, 2].map(() => elegirSimboloFiller(total)));
      if (!lineaPagaria([grillaDemo[0][1], grillaDemo[1][1], grillaDemo[2][1]])) break;
    }
    rodillos.forEach((r, col) => {
      if (!r.celdas.length) return;
      grillaDemo[col].forEach((sim, fila) => ponerSimbolo(r.celdas[fila], sim));
      r.y = 0;
      cintas[col].style.transform = 'translate3d(0,0,0)';
    });
  }
  requestAnimationFrame(pintarGrillaInicial);

  // El bucle único: nada de leer el layout acá adentro, solo mover.
  let ultimoFrame = 0;
  function frameRodillos(ahora) {
    // Tope bajo a propósito: si un cuadro tarda mucho (el navegador
    // se distrajo con otra cosa), se avanza como si hubieran pasado
    // 34ms en vez del tiempo real. Se pierde un poco de exactitud
    // pero no se produce un tirón grande, que es lo que se ve.
    const dt = ultimoFrame ? Math.min(34, ahora - ultimoFrame) : 16;
    ultimoFrame = ahora;

    rodillos.forEach((r, col) => {
      if (r.fase === 'quieto' || !r.loopPx) return;

      if (r.fase === 'acelerando' || r.fase === 'constante') {
        // r.vMax se fija al arrancar el giro y no se vuelve a leer:
        // antes se calculaba en cada cuadro a partir de `velocidad`,
        // y como los botones x1/x2/x3 siguen tocables mientras gira,
        // tocar uno a mitad del giro hacía que los rodillos
        // aceleraran de golpe.
        if (r.v < r.vMax) {
          // Arranque progresivo: la subida es más fuerte al principio
          // y se va suavizando, en vez de una rampa recta que llega a
          // la velocidad final de un saque.
          const falta = (r.vMax - r.v) / r.vMax;
          r.v = Math.min(r.vMax, r.v + (r.vMax / 340) * dt * (0.35 + falta));
        } else {
          r.fase = 'constante';
        }
        r.y += r.v * dt;
      } else if (r.fase === 'frenando') {
        const t = Math.min(1, (ahora - r.inicio) / r.duracion);
        // Curva cuadrática, no cúbica. La cúbica frena de golpe al
        // principio y después se arrastra: con la misma duración
        // recorría apenas 5 celdas, así que entraban 3 símbolos a la
        // vista y ya estaba parado — de ahí la sensación de que el
        // resultado aparecía de la nada. La cuadrática reparte mejor
        // y deja ver el doble de símbolos llegando.
        r.y = r.salida + r.distancia * (1 - Math.pow(1 - t, 2));
        if (t >= 1) {
          r.fase = 'asentando';
          r.inicio = ahora;
        }
      } else if (r.fase === 'asentando') {
        // El rodillo se pasó un poquito y vuelve a su lugar. Es lo que
        // hace que se sienta un objeto con peso deteniéndose, en vez
        // de una animación que simplemente termina.
        const t = Math.min(1, (ahora - r.inicio) / 170);
        const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        r.y = r.pasada + (r.destino - r.pasada) * suave;
        if (t >= 1) {
          r.y = r.destino;
          r.v = 0;
          r.fase = 'quieto';
          cintas[col].style.willChange = 'auto';
        }
      }

      const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
      cintas[col].style.transform = `translate3d(0, ${-off}px, 0)`;
    });

    requestAnimationFrame(frameRodillos);
  }
  requestAnimationFrame(frameRodillos);

  function arrancarRodillos() {
    rodillos.forEach((r, col) => {
      if (!r.loopPx) return;
      r.fase = 'acelerando';
      r.v = 0;
      r.vMax = r.celdaPx / (55 / velocidad);
      cintas[col].style.willChange = 'transform';
    });
  }

  // Elige dónde escribir el resultado: una posición que en este
  // instante esté fuera de la vista (la ventana muestra 3 celdas) y
  // que no caiga en la zona de copias del final.
  function ranuraLibre(r) {
    const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
    const k = Math.floor(off / r.celdaPx);
    for (let d = 5; d < LOOP; d++) {
      const cand = (k + d) % LOOP;
      if (cand < 3 || cand > LOOP - 3) continue;
      return cand;
    }
    return 3;
  }

  // Frena hasta que las celdas del resultado queden exactamente en la
  // ventana visible. La distancia se ajusta hacia arriba en vueltas
  // enteras hasta caer justo en la ranura, así el final es exacto.
  function frenarRodillo(col, simbolosFinales) {
    const r = rodillos[col];
    if (!r.loopPx) return 0;

    const duracionDeseada = DURACION_BASE[col] / velocidad;
    const vActual = Math.max(r.v, r.vMax || r.celdaPx / 400);

    // Con la curva cuadrática la velocidad de arranque es 2*d/D: de
    // ahí sale la distancia que le corresponde a la velocidad que el
    // rodillo ya traía. Respetarla es lo que evita el tirón al pasar
    // de girar a frenar.
    const distanciaIdeal = (vActual * duracionDeseada) / 2;

    // Y ACÁ el orden importa: primero se calcula dónde caería el
    // rodillo con esa distancia, y recién después se elige la ranura
    // que queda justo ahí. Al revés (elegir la ranura primero y
    // estirar la distancia hasta alcanzarla) había que sumar vueltas
    // enteras, y el frenado terminaba durando entre uno y cinco
    // segundos según dónde estuviera la cinta.
    const off = ((r.y % r.loopPx) + r.loopPx) % r.loopPx;
    const ranura = Math.round((off + distanciaIdeal) / r.celdaPx) % LOOP;

    let delta = ranura * r.celdaPx - off;
    // La distancia queda siempre pegada a la ideal: como mucho media
    // celda de diferencia por el redondeo. Nunca se suma una vuelta
    // entera para "alcanzar" la ranura, que era lo que hacía que un
    // frenado durara un segundo y el siguiente cuatro.
    if (delta < r.celdaPx) delta += r.loopPx;

    // El resultado se escribe en la ranura. Las 3 últimas celdas de
    // la tira son copia de las 3 primeras (es lo que hace invisible
    // el punto donde el bucle vuelve a empezar), así que cuando el
    // resultado toca esa zona hay que escribirlo en los dos lugares
    // o el empalme mostraría símbolos distintos.
    simbolosFinales.forEach((sim, fila) => {
      const i = ranura + fila;
      ponerSimbolo(r.celdas[i], sim);
      if (i < 3) ponerSimbolo(r.celdas[LOOP + i], sim);
      else if (i >= LOOP) ponerSimbolo(r.celdas[i - LOOP], sim);
    });

    const pasadaPx = r.celdaPx * PASADA;
    r.salida = r.y;
    r.distancia = delta + pasadaPx;
    r.destino = r.y + delta;
    r.pasada = r.destino + pasadaPx;
    r.duracion = (2 * (delta + pasadaPx)) / vActual;
    r.inicio = performance.now();
    r.fase = 'frenando';
    return ranura;
  }

  function esperarFrenado() {
    return new Promise((listo) => {
      const revisar = () => {
        if (rodillos.every((r) => r.fase === 'quieto')) listo();
        else requestAnimationFrame(revisar);
      };
      requestAnimationFrame(revisar);
    });
  }

  // Si cambia el tamaño de la pantalla hay que rehacer la medida de
  // las celdas, pero nunca en pleno giro.
  window.addEventListener('resize', () => {
    if (girando) return;
    pintarGrillaInicial();
  });


  btnGirar.addEventListener('click', async () => {
    if (girando) return;
    if (saldo < apuesta) { alert('No te alcanza el saldo para esta apuesta.'); return; }

    girando = true;
    btnGirar.disabled = true;
    ocultarPremio();

    if (audios.musica_fondo && audios.musica_fondo.paused) audios.musica_fondo.play().catch(() => {});
    if (audios.giro) { audios.giro.currentTime = 0; audios.giro.play().catch(() => {}); }

    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;

    // 1) El pedido sale YA, pero no se espera acá: sigue de largo.
    const pedido = fetchJson('/api/jugar-girar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slug, apuesta, clientId: crypto.randomUUID() }),
    });

    // 2) Los rodillos arrancan en el mismo instante del toque y giran
    // sin parar hasta que llegue el resultado. Nunca quedan quietos
    // sobre relleno mientras se espera: si en una pausa casual
    // cayeran tres iguales, parecería un premio que nunca existió.
    rodillos.forEach((r) => {
      r.celdas.forEach((celda) => celda.classList.remove('celda-ganadora'));
    });
    detenerAnimacionesSimbolos();
    detenerAnimacionesJuego();
    lanzarAnimaciones('girar');

    const arranque = Date.now();
    arrancarRodillos();

    // 3) Llega el resultado.
    let resultado;
    try {
      resultado = await pedido;
    } catch (err) {
      rodillos.forEach((r, col) => {
        r.fase = 'quieto';
        r.v = 0;
        cintas[col].style.willChange = 'auto';
      });
      alert(err.message || 'No se pudo resolver el giro. Probá de nuevo.');
      girando = false;
      btnGirar.disabled = false;
      return;
    }

    // Un mínimo de giro para que no se corte en seco cuando el
    // servidor contesta muy rápido.
    // Un mínimo de giro parejo antes de empezar a frenar: si el
    // servidor contesta enseguida, sin esto el rodillo arrancaría y
    // frenaría casi en el mismo movimiento.
    const restante = 750 / velocidad - (Date.now() - arranque);
    if (restante > 0) await new Promise((r) => setTimeout(r, restante));

    const { grilla, premio, nivel, saldo: saldoNuevo, simbolosGanadores } = resultado;
    const filaPago = 1; // única línea de pago del motor, la del medio

    // 4) Frenado. Los tres símbolos de cada rodillo se escriben en
    // celdas que en ese momento están fuera de la vista (solo cambia
    // un `src` ya precargado, no se crea ni se borra nada), y después
    // el rodillo recorre físicamente la distancia que falta hasta
    // ellos, desacelerando. El destino sale del resultado del
    // servidor y de ningún otro lado.
    const ranuras = [0, 1, 2].map((col) => frenarRodillo(col, grilla[col]));
    await esperarFrenado();

    saldo = Number(saldoNuevo);
    saldoEl.textContent = saldo.toLocaleString('es-PY');

    if (premio > 0) {
      mostrarPremio(premio, nivel);
      lanzarAnimaciones(nivel === 'premio_mayor' ? 'premio_mayor' : 'premio_chico');
      // Solo se marcan y animan las columnas que REALMENTE forman
      // parte de la combinación ganadora — antes se pintaban las tres
      // aunque fuera un premio de "dos iguales" (rodillos 1-2, la
      // tercera no había pagado nada y se marcaba igual, lo que
      // confundía la lectura de la jugada).
      const columnasGanadoras = simbolosGanadores?.length ? simbolosGanadores : [0, 1, 2];
      rodillos.forEach((r, col) => {
        if (!columnasGanadoras.includes(col)) return;
        const celdaGanadora = r.celdas[ranuras[col] + 1];
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
