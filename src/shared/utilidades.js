/** Utilidades puras compartidas por la app y las pruebas. */

/** Escapa texto para insertarlo en HTML (previene inyección de código). */
export function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Compara versiones "1.2.10" vs "1.2.9" → 1 | 0 | -1 */
export function compararVersiones(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Total de un ticket (vista previa; el valor oficial lo calcula la base de datos). */
export function calcularTicket(lineas, { domicilio = 0, descuento = 0 } = {}) {
  let subtotal = 0;
  for (const { precio, cantidad } of lineas) {
    if (!Number.isInteger(precio) || precio < 0) throw new Error('Precio inválido');
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) throw new Error('Cantidad inválida');
    subtotal += precio * cantidad;
  }
  if (!Number.isInteger(domicilio) || domicilio < 0) throw new Error('Domicilio inválido');
  if (!Number.isInteger(descuento) || descuento < 0) throw new Error('Descuento inválido');
  const total = subtotal + domicilio - descuento;
  if (total < 0) throw new Error('El descuento no puede ser mayor que el total');
  return { subtotal, total };
}

/** Mensaje claro a partir de un error de la base de datos o de la red. */
export function mensajeError(error) {
  const porCodigo = {
    SIN_PERMISO: 'Tu usuario no tiene permiso para esta acción.',
    PEDIDOS_PAUSADOS: 'Los pedidos en línea están pausados.',
    PRODUCTO_CON_VENTAS: 'Este producto tiene ventas registradas. Ocúltalo en lugar de eliminarlo.',
    CATEGORIA_CON_PRODUCTOS: 'La categoría tiene productos. Muévelos o elimínalos primero.',
  };
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.hint && porCodigo[error.hint]) return porCodigo[error.hint];
  if (error.hint) return error.message;
  if (/fetch|network|Failed to fetch|ENOTFOUND|timeout/i.test(error.message ?? '')) {
    return 'Sin conexión con el servidor. Revisa el internet e intenta de nuevo.';
  }
  if (/Invalid login credentials/i.test(error.message ?? '')) return 'Correo o contraseña incorrectos.';
  return error.message || 'Ocurrió un error inesperado.';
}
