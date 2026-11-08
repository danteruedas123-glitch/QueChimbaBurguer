import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearBaseLocal } from '../../src/main/db-local.js';

/** Menú pequeño y fijo de las pruebas (el real puede cambiar sin romperlas). */
export const MENU_PRUEBAS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'menu-pruebas.sql');

/**
 * Base de pruebas con tres actores:
 *   web      → visitante anónimo de la página
 *   staff    → encargado con acceso a la app
 *   intruso  → usuario autenticado que NO es del personal
 */
export async function nuevaBase(opciones) {
  const base = await crearBaseLocal({ semilla: MENU_PRUEBAS, ...opciones });
  const staffId = await base.crearUsuario('encargado@quechimba.co', 'x', { nombre: 'Encargado', rol: 'admin' });
  const intrusoId = await base.crearUsuario('intruso@correo.co', 'x');
  const web = (f, a) => base.rpc(f, a, { rol: 'anon' });
  const staff = (f, a) => base.rpc(f, a, { rol: 'authenticated', usuario: staffId });
  const intruso = (f, a) => base.rpc(f, a, { rol: 'authenticated', usuario: intrusoId });
  const admin = (sql, params) => base.sql(sql, params, { rol: 'postgres' });
  return { base, staffId, intrusoId, web, staff, intruso, admin };
}

/** Espera que la promesa falle con el código (hint) o patrón indicado. */
export async function fallaCon(promesa, esperado) {
  await assert.rejects(promesa, (e) => {
    const ok = typeof esperado === 'string' ? e.hint === esperado : esperado.test(e.message);
    if (!ok) assert.fail(`Error inesperado: [${e.hint}] ${e.message}`);
    return true;
  });
}

export const clienteWeb = (extra = {}) => ({
  nombre: 'Ana Pérez', tipo_entrega: 'domicilio', direccion: 'Calle 10 # 5-20', metodo_pago: 'nequi', ...extra,
});

/**
 * Inserta un pedido histórico con fecha controlada (solo pruebas).
 * Pasa por los mismos triggers que un pedido real.
 */
export async function pedidoHistorico(admin, { creadoEn, lineas, estado = 'entregado', canal = 'local', pago = 'efectivo', domicilio = 0, descuento = 0, entrega = 'en_local' }) {
  const [p] = await admin(
    `insert into public.pedidos (canal, tipo_entrega, metodo_pago, costo_domicilio, creado_en, direccion)
     values ($1, $2, $3, $4, $5, 'x') returning id`, [canal, entrega, pago, domicilio, creadoEn]);
  for (const l of lineas) {
    await admin(
      `insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad)
       select $1, p.id, p.nombre, c.nombre, p.precio, $3 from public.productos p join public.categorias c on c.id = p.categoria_id
       where p.slug = $2`, [p.id, l.slug, l.cantidad]);
  }
  if (descuento) await admin(`update public.pedidos set descuento = $2 where id = $1`, [p.id, descuento]);
  if (estado === 'entregado' || estado === 'cancelado') {
    await admin(`update public.pedidos set estado = 'entregado' where id = $1`, [p.id]);
  }
  if (estado === 'cancelado') {
    await admin(`update public.pedidos set estado = 'cancelado', motivo_cancelacion = 'prueba' where id = $1`, [p.id]);
  } else if (estado !== 'entregado' && estado !== 'nuevo') {
    await admin(`update public.pedidos set estado = $2 where id = $1`, [p.id, estado]);
  }
  return p.id;
}
