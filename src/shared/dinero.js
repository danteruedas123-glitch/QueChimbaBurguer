/** Dinero en pesos colombianos ENTEROS (sin decimales). */

const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** 29000 → "$29.000" ; -5000 → "-$5.000" */
export function formatearCOP(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '$0';
  const abs = formato.format(Math.abs(Math.round(n)));
  return `${n < 0 ? '-' : ''}$${abs}`;
}

/** "$29.000" | "29.000" | "29000" | 29000 → 29000. Devuelve null si no es un entero válido ≥ 0. */
export function parsearCOP(texto) {
  if (typeof texto === 'number') return Number.isInteger(texto) && texto >= 0 ? texto : null;
  if (typeof texto !== 'string') return null;
  const limpio = texto.replace(/[\s$]/g, '');
  if (limpio === '') return null;
  // Solo dígitos con puntos de miles opcionales y bien ubicados (rechaza decimales con coma)
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(limpio)) return null;
  const n = Number(limpio.replace(/\./g, ''));
  return Number.isSafeInteger(n) ? n : null;
}

/** Variación porcentual redondeada a 1 decimal; null si no hay base de comparación. */
export function variacion(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}
