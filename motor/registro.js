// =========================================================
// REGISTRO DE MOTORES
//
// Un solo lugar que sabe qué archivo de motor corresponde a
// juego.motor. Lo usan el servidor (api/jugar-girar.js), el
// simulador de RTP y la vista previa del ensamblador — así elegir el
// motor "desde el panel" es de verdad: todos leen de acá, nadie
// tiene el motor fijo por código.
//
// Sumar un motor nuevo el día de mañana es: escribir su archivo en
// esta carpeta, agregarlo a MOTORES de abajo, y agregarlo como
// opción en el selector del editor. No hay que tocar ningún motor
// existente ni ningún otro archivo.
// =========================================================

const MOTORES = {
  'clasico-3x3': () => import('./clasico-3x3.js'),
  'clasico-5x3': () => import('./clasico-5x3.js'),
};

export const MOTOR_POR_DEFECTO = 'clasico-3x3';

// Nombres para mostrar en el selector del editor — un solo lugar
// para no repetir el mapeo en cada archivo que arma ese <select>.
export const MOTORES_DISPONIBLES = [
  { valor: 'clasico-3x3', etiqueta: '3 rodillos, 1 línea' },
  { valor: 'clasico-5x3', etiqueta: '5 rodillos, 1 línea' },
];

/**
 * Carga el módulo del motor que le corresponde a un juego. Si el
 * campo motor viene vacío o con un valor que no existe (un juego
 * viejo, un dato corrupto), cae en el motor por defecto en vez de
 * romper — más vale mostrar el juego con el motor de siempre que no
 * mostrar nada.
 */
export async function cargarMotor(nombreMotor) {
  const cargar = MOTORES[nombreMotor] || MOTORES[MOTOR_POR_DEFECTO];
  return cargar();
}

/**
 * Dado que un símbolo forma una cadena de "cadena" de largo (2, 3, 4
 * o 5 según el motor), resuelve el premio y el nivel con el MISMO
 * criterio que usan los motores reales: coincidir la línea entera
 * solo cuenta como premio mayor si además es, para esa cantidad de
 * columnas, el pago más alto que existe en el juego — matchear la
 * línea con un símbolo cualquiera no alcanza.
 *
 * La usa el probador de premios de la Vista previa, para no repetir
 * esta cuenta a mano ahí también.
 */
const CAMPO_PAGO = { 2: 'pago_dos', 3: 'pago_tres', 4: 'pago_cuatro', 5: 'pago_cinco' };

export function resolverNivel(simbolos, simbolo, cadena, columnas) {
  const campo = CAMPO_PAGO[cadena];
  const premio = Number(simbolo[campo]) || 0;
  if (cadena < 2 || premio <= 0) return { premio: 0, nivel: null };

  if (cadena === columnas) {
    const mayor = Math.max(0, ...simbolos.map((s) => Number(s[CAMPO_PAGO[columnas]]) || 0));
    return { premio, nivel: premio >= mayor ? 'premio_mayor' : 'tres_iguales' };
  }
  return { premio, nivel: cadena === 2 ? 'dos_iguales' : 'tres_iguales' };
}
