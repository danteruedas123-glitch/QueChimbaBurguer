/**
 * Fechas de calendario ("YYYY-MM-DD") en hora de Colombia.
 * Toda la aritmética se hace sobre fechas puras (UTC a medianoche) para
 * evitar errores por la zona horaria del computador.
 */
export const ZONA = 'America/Bogota';

const fmtFecha = (zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha de hoy en Colombia, sin importar la zona del computador. */
export function hoyEn(zona = ZONA, ahora = new Date()) {
  return fmtFecha(zona).format(ahora);
}

const aUTC = (f) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Error(`Fecha inválida: ${f}`);
  const d = new Date(`${f}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f) throw new Error(`Fecha inválida: ${f}`);
  return d;
};
const aTexto = (d) => d.toISOString().slice(0, 10);

export function sumarDias(fecha, dias) {
  const d = aUTC(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** Número de días del rango, ambos extremos incluidos. */
export function diasEnRango({ desde, hasta }) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000) + 1;
}

/** Lunes de la semana de la fecha (semana ISO: lunes a domingo). */
export function inicioSemana(fecha) {
  const d = aUTC(fecha);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return sumarDias(fecha, -dow);
}

export const inicioMes = (fecha) => `${fecha.slice(0, 7)}-01`;

export function finMes(fecha) {
  const d = aUTC(inicioMes(fecha));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return aTexto(d);
}

export const PERIODOS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: 'semana', nombre: 'Esta semana' },
  { id: 'semana_anterior', nombre: 'Semana pasada' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mes_anterior', nombre: 'Mes pasado' },
];

/** Rango { desde, hasta } de un período predefinido, relativo a "hoy". */
export function rangoPeriodo(id, hoy = hoyEn()) {
  switch (id) {
    case 'hoy': return { desde: hoy, hasta: hoy };
    case 'ayer': { const a = sumarDias(hoy, -1); return { desde: a, hasta: a }; }
    case 'semana': return { desde: inicioSemana(hoy), hasta: hoy };
    case 'semana_anterior': { const l = sumarDias(inicioSemana(hoy), -7); return { desde: l, hasta: sumarDias(l, 6) }; }
    case 'mes': return { desde: inicioMes(hoy), hasta: hoy };
    case 'mes_anterior': { const f = sumarDias(inicioMes(hoy), -1); return { desde: inicioMes(f), hasta: f }; }
    default: throw new Error(`Período desconocido: ${id}`);
  }
}

/** Período inmediatamente anterior con el mismo número de días (para comparar). */
export function rangoAnterior({ desde, hasta }) {
  const n = diasEnRango({ desde, hasta });
  return { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
}

/** Valida un rango personalizado. Devuelve un mensaje de error o null. */
export function validarRango({ desde, hasta }) {
  try {
    aUTC(desde); aUTC(hasta);
  } catch {
    return 'Elige fechas válidas';
  }
  if (hasta < desde) return 'La fecha final no puede ser anterior a la inicial';
  if (diasEnRango({ desde, hasta }) > 367) return 'El rango máximo es de un año';
  return null;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "2026-11-06" → "6 nov 2026" */
export function fechaCorta(f, { conAnio = true } = {}) {
  const d = aUTC(f);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}${conAnio ? ` ${d.getUTCFullYear()}` : ''}`;
}

export const diaSemana = (f) => DIAS[aUTC(f).getUTCDay()];

/** Texto legible de un rango: "6 nov 2026" o "1 nov – 6 nov 2026" */
export function etiquetaRango({ desde, hasta }) {
  if (desde === hasta) return fechaCorta(desde);
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  return `${fechaCorta(desde, { conAnio: !mismoAnio })} – ${fechaCorta(hasta)}`;
}

/** Hora local de Colombia "7:45 p. m." a partir de un timestamp ISO. */
export function horaLocal(iso, zona = ZONA) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: zona, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso)).replace(/\s/g, ' ');
}
