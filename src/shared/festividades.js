/**
 * Festividades disponibles para la web. Los identificadores deben coincidir
 * con la restricción de la base de datos (migración 08) y con js/temas.js de
 * la web (hay pruebas que lo verifican).
 */
export const FESTIVIDADES = [
  { id: 'normal', nombre: 'Normal', emoji: '🍔', ayuda: 'Diseño de siempre' },
  { id: 'amor_amistad', nombre: 'Amor y Amistad', emoji: '💘', ayuda: 'Septiembre' },
  { id: 'halloween', nombre: 'Halloween', emoji: '🎃', ayuda: '31 de octubre' },
  { id: 'dia_muertos', nombre: 'Día de Muertos', emoji: '💀', ayuda: '1 y 2 de noviembre' },
  { id: 'navidad', nombre: 'Navidad', emoji: '🎄', ayuda: 'Diciembre' },
  { id: 'ano_nuevo', nombre: 'Año Nuevo', emoji: '🎆', ayuda: '31 dic – 1 ene' },
  { id: 'dia_madre', nombre: 'Día de la Madre', emoji: '💐', ayuda: 'Mayo' },
  { id: 'dia_padre', nombre: 'Día del Padre', emoji: '👔', ayuda: 'Junio' },
  { id: 'fiestas_patrias', nombre: 'Fiestas Patrias', emoji: '⭐', ayuda: '20 de julio' },
  { id: 'festival_vallenato', nombre: 'Festival Vallenato', emoji: '🪗', ayuda: 'Abril – mayo' },
  { id: 'aniversario', nombre: 'Aniversario', emoji: '🎂', ayuda: 'Se activa solo cada año' },
];

export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Días que dura la celebración automática (debe coincidir con _dias_aniversario() en SQL). */
export const DIAS_ANIVERSARIO = 7;

const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const fecha = (anio, mes, dia) => `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimoDia(anio, mes))).padStart(2, '0')}`;

/**
 * Próxima celebración del aniversario a partir de "hoy" (YYYY-MM-DD).
 * Devuelve { fecha, numero, enCurso } — enCurso = estamos dentro de su semana.
 */
export function proximoAniversario({ dia, mes, fundacion }, hoy) {
  const anio = Number(hoy.slice(0, 4));
  for (const a of [anio - 1, anio, anio + 1]) {
    const inicio = fecha(a, mes, dia);
    const fin = new Date(`${inicio}T00:00:00Z`);
    fin.setUTCDate(fin.getUTCDate() + DIAS_ANIVERSARIO - 1);
    const finTexto = fin.toISOString().slice(0, 10);
    const numero = a - fundacion;
    if (numero >= 1 && hoy <= finTexto) return { fecha: inicio, numero, enCurso: hoy >= inicio };
  }
  return null;
}
