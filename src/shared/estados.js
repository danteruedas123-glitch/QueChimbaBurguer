/**
 * Estados de un pedido. Debe coincidir EXACTAMENTE con la función SQL
 * public.transicion_valida (hay una prueba que lo verifica).
 */
export const ESTADOS = ['nuevo', 'preparando', 'listo', 'entregado', 'cancelado'];
const FLUJO = ['nuevo', 'preparando', 'listo', 'entregado'];

export const ETIQUETA_ESTADO = {
  nuevo: 'Nuevo',
  preparando: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ETIQUETA_CANAL = { web: 'Web', whatsapp: 'WhatsApp', local: 'Local' };
export const ETIQUETA_ENTREGA = { domicilio: 'Domicilio', recoger: 'Recoger', en_local: 'En el local' };
/** Nombres de TODOS los métodos (los pedidos viejos pueden tener cualquiera). */
export const ETIQUETA_PAGO = {
  efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata',
  transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro',
};
/** Métodos que el negocio recibe hoy (la base de datos rechaza los demás en pedidos nuevos). */
export const PAGOS_ACTIVOS = ['nequi', 'efectivo'];

export function transicionValida(desde, hacia) {
  if (!ESTADOS.includes(desde) || !ESTADOS.includes(hacia)) return false;
  if (desde === hacia) return false;
  if (desde === 'cancelado') return false;
  if (desde === 'entregado') return hacia === 'cancelado';
  if (hacia === 'cancelado') return true;
  return FLUJO.indexOf(hacia) > FLUJO.indexOf(desde);
}

/** Siguiente paso natural del flujo (para el botón principal de cada tarjeta). */
export function siguienteEstado(estado) {
  const i = FLUJO.indexOf(estado);
  return i >= 0 && i < FLUJO.length - 1 ? FLUJO[i + 1] : null;
}

export const esCerrado = (estado) => estado === 'entregado' || estado === 'cancelado';
