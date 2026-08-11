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
    render(datos, balance.saldo);
  } catch (err) {
    mostrarError(err.message || 'No se pudo cargar el juego.');
  }
}

function mostrarError(msg) {
  raiz.innerHTML = `<p style="padding:40px; text-align:center; color:var(--danger)">${escapeHtml(msg)}</p>`;
}

async function fetchJson(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red');
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
  const { juego, simbolos, sonidos: sonidosData, efectos, premios, digitos, capasLibres } = datos;

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

        <div style="display:flex; align-items:center; gap:8px; position:relative; z-index:10">
          <p style="flex:1; text-align:center; font-weight:600; margin:0; letter-spacing:.04em">${escapeHtml(juego.nombre).toUpperCase()}</p>
        </div>

        <div id="jg-grilla" style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; border-radius:12px; padding:8px; position:absolute; overflow:hidden; aspect-ratio:1">
          <div id="jg-grilla-fondo" style="position:absolute; inset:0; background:${fondoBg}; z-index:0"></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-0" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-1" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div style="position:relative; overflow:hidden; z-index:1"><div class="jg-cinta" id="jg-cinta-2" style="display:flex; flex-direction:column; position:absolute; top:0; left:0; width:100%"></div></div>
          <div id="jg-efecto-premio" style="position:absolute; inset:0; pointer-events:none; opacity:0; z-index:2"></div>
        </div>

        ${juego.cartel_url ? `<img id="jg-cartel" src="${juego.cartel_url}" style="position:absolute; object-fit:fill" />` : ''}

        <div id="jg-capas-libres" style="position:absolute; inset:0; z-index:8; pointer-events:none"></div>

        <div id="jg-premio-popup" style="position:absolute; z-index:15; display:none; border-radius:12px; background:rgba(0,0,0,.55); transition:opacity .25s; opacity:0; transform:translate(-50%,-50%)">
          <img id="jg-img-premio" style="position:absolute; z-index:0; display:none" />
          <strong id="jg-premio-monto" style="position:absolute; z-index:1; font-size:20px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); white-space:nowrap"></strong>
        </div>

        <div style="display:flex; align-items:flex-end; gap:10px; position:absolute; left:22px; right:22px; bottom:22px; z-index:10">
          <div style="flex:1">
            <p class="hint" style="margin:0">Saldo</p>
            <strong id="jg-saldo" style="font-size:18px">${saldo.toLocaleString('es-PY')}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:6px">
            <button id="jg-apuesta-menos" aria-label="Bajar apuesta" style="width:28px; height:28px; padding:0">−</button>
            <div style="text-align:center; min-width:66px">
              <p class="hint" style="margin:0">Apuesta</p>
              <strong id="jg-apuesta" style="font-size:15px"></strong>
            </div>
            <button id="jg-apuesta-mas" aria-label="Subir apuesta" style="width:28px; height:28px; padding:0">+</button>
          </div>
          <div id="jg-turbo" style="display:flex; gap:3px"></div>
        </div>

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

  const apuestaEl = raiz.querySelector('#jg-apuesta');
  const pintarApuesta = () => { apuestaEl.textContent = apuesta.toLocaleString('es-PY'); };
  pintarApuesta();

  raiz.querySelector('#jg-apuesta-mas').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.min(apuestaMax, apuesta + pasoApuesta);
    pintarApuesta();
  });
  raiz.querySelector('#jg-apuesta-menos').addEventListener('click', () => {
    if (girando) return;
    apuesta = Math.max(apuestaMin, apuesta - pasoApuesta);
    pintarApuesta();
  });

  const turboEl = raiz.querySelector('#jg-turbo');
  const pintarTurbo = () => {
    turboEl.innerHTML = [1, 2, 3].map((v) => `
      <button data-v="${v}" style="padding:2px 7px; font-size:11px; ${v === velocidad ? 'border-color:var(--accent); color:var(--accent)' : ''}">x${v}</button>
    `).join('');
    turboEl.querySelectorAll('button').forEach((b) => {
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

  aplicarPosiciones();
  aplicarOrden();
  aplicarFiltros();
  aplicarCapasLibres();

  // ---------------- Animación de rodillos (solo muestra, nunca decide) ----------------
  const RELLENO = 18;
  const DURACION_COLUMNA = [1400, 1800, 2200];

  function elegirSimboloFiller(total) {
    let r = Math.random() * total;
    for (const s of simbolos) { r -= s.peso; if (r <= 0) return s; }
    return simbolos[simbolos.length - 1];
  }

  function celdaHtml(s) {
    if (s.icono_url) return `<img src="${s.icono_url}" style="width:60%; height:60%; object-fit:contain" />`;
    return `<span style="font-size:11px; color:#8fae9a">${escapeHtml(s.nombre)}</span>`;
  }

  function crearCeldaCinta(simbolo, tamano) {
    const div = document.createElement('div');
    div.style.cssText = `width:${tamano}px; height:${tamano}px; display:flex; align-items:center; justify-content:center; flex-shrink:0`;
    div.innerHTML = celdaHtml(simbolo);
    return div;
  }

  // Al abrir, ya se ven símbolos en vez de rodillos vacíos. Es solo
  // decorado: se descarta cualquier combinación que pagaría, para no
  // mostrar un premio que el jugador no ganó. El resultado de verdad
  // siempre viene del servidor, esto nunca lo toca.
  function lineaPagaria(linea) {
    const reales = linea.filter((s) => s.nombre !== 'wild');
    const cand = reales.length ? reales[0] : linea[0];
    if (linea.every((s) => s === cand || s.nombre === 'wild')) return true;
    return linea[0] === linea[1] || linea[0].nombre === 'wild' || linea[1].nombre === 'wild';
  }

  function pintarGrillaInicial() {
    const total = simbolos.reduce((a, s) => a + s.peso, 0) || 1;
    let grilla;
    for (let intento = 0; intento < 40; intento++) {
      grilla = [0, 1, 2].map(() => [0, 1, 2].map(() => elegirSimboloFiller(total)));
      if (!lineaPagaria([grilla[0][1], grilla[1][1], grilla[2][1]])) break;
    }
    cintas.forEach((cinta, col) => {
      cinta.innerHTML = '';
      cinta.style.transition = 'none';
      cinta.style.transform = 'translateY(0px)';
      const tamanoCelda = cinta.parentElement.clientWidth;
      grilla[col].forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda)));
    });
  }
  requestAnimationFrame(pintarGrillaInicial);

  // Arma la cinta de arranque: solo relleno, sin resultado todavía.
  // El giro empieza al toque, antes de que el servidor conteste — los
  // 3 símbolos definitivos se enganchan después, cuando llega.
  function armarCintaInicial(col, total) {
    const cinta = cintas[col];
    cinta.innerHTML = '';
    cinta.style.transition = 'none';
    cinta.style.transform = 'translateY(0px)';
    const tamanoCelda = cinta.parentElement.clientWidth;
    for (let i = 0; i < RELLENO; i++) cinta.appendChild(crearCeldaCinta(elegirSimboloFiller(total), tamanoCelda));
    return tamanoCelda;
  }

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

    // 2) Los rodillos arrancan en el mismo instante del toque, girando
    // en falso sobre relleno. Esto es puro decorado: no sabe ni puede
    // saber el resultado, que lo decide el servidor.
    const tamanoCelda = [0, 1, 2].map((col) => armarCintaInicial(col, total));
    void cintas[0].offsetWidth;
    const arranque = Date.now();
    cintas.forEach((cinta, col) => {
      cinta.style.transition = `transform ${Math.round(700 / velocidad)}ms linear`;
      cinta.style.transform = `translateY(-${(RELLENO - 3) * tamanoCelda[col]}px)`;
    });

    // 3) Llega el resultado. Si tardó menos que el giro en falso, se
    // espera lo que falte para que no corte de golpe.
    let resultado;
    try {
      resultado = await pedido;
    } catch (err) {
      cintas.forEach((cinta) => { cinta.style.transition = 'none'; cinta.style.transform = 'translateY(0px)'; });
      alert(err.message || 'No se pudo resolver el giro. Probá de nuevo.');
      girando = false;
      btnGirar.disabled = false;
      return;
    }
    const restante = Math.round(700 / velocidad) - (Date.now() - arranque);
    if (restante > 0) await new Promise((r) => setTimeout(r, restante));

    const { grilla, premio, nivel, saldo: saldoNuevo } = resultado;

    // 4) Se enganchan los 3 definitivos al final de cada cinta y se
    // hace el frenado en cascada hasta ellos.
    cintas.forEach((cinta, col) => {
      for (let i = 0; i < RELLENO; i++) cinta.appendChild(crearCeldaCinta(elegirSimboloFiller(total), tamanoCelda[col]));
      grilla[col].forEach((s) => cinta.appendChild(crearCeldaCinta(s, tamanoCelda[col])));
    });
    const OFFSET_FINAL = (RELLENO * 2) - 3;
    void cintas[0].offsetWidth;

    await Promise.all(cintas.map((cinta, col) => new Promise((resolve) => {
      const ms = Math.round(DURACION_COLUMNA[col] / velocidad);
      cinta.style.transition = `transform ${ms}ms cubic-bezier(0.15, 0.85, 0.3, 1)`;
      cinta.style.transform = `translateY(-${OFFSET_FINAL * tamanoCelda[col]}px)`;
      setTimeout(resolve, ms);
    })));

    saldo = Number(saldoNuevo);
    saldoEl.textContent = saldo.toLocaleString('es-PY');

    if (premio > 0) {
      mostrarPremio(premio, nivel);
      cintas.forEach((cinta) => {
        const celdaGanadora = cinta.children[OFFSET_FINAL + 1];
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
