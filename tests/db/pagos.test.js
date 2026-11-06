/**
 * Métodos de pago: el negocio solo recibe Nequi y efectivo.
 * Los pedidos viejos con otros métodos se conservan y se pueden seguir gestionando.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon, clienteWeb } from '../helpers/bd.js';
import { PAGOS_ACTIVOS, ETIQUETA_PAGO } from '../../src/shared/estados.js';

let ctx;
before(async () => { ctx = await nuevaBase(); });
after(() => ctx.base.cerrar());

const pedirWeb = (metodo) => ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_cliente: clienteWeb({ metodo_pago: metodo }) });
const ultimo = async () => (await ctx.admin(`select id, metodo_pago from public.pedidos order by numero desc limit 1`))[0];
const venta = (metodo) => ctx.staff('venta_registrar', {
  p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: metodo },
});

describe('solo Nequi y efectivo', () => {
  test('la app ofrece exactamente Nequi y Efectivo', () => {
    assert.deepEqual(PAGOS_ACTIVOS, ['nequi', 'efectivo']);
    assert.ok(PAGOS_ACTIVOS.every((m) => ETIQUETA_PAGO[m]));
  });

  for (const metodo of ['nequi', 'efectivo']) {
    test(`acepta ${metodo} desde la web y en el local`, async () => {
      await pedirWeb(metodo);
      assert.equal((await ultimo()).metodo_pago, metodo);
      await venta(metodo);
      assert.equal((await ultimo()).metodo_pago, metodo);
    });
  }

  for (const metodo of ['daviplata', 'transferencia', 'tarjeta', 'otro']) {
    test(`rechaza ${metodo} en pedidos nuevos (web y local)`, async () => {
      await fallaCon(pedirWeb(metodo), 'DATO_INVALIDO');
      await fallaCon(venta(metodo), 'DATO_INVALIDO');
    });
  }

  test('ni siquiera insertando directo en la tabla se puede usar otro método', async () => {
    await fallaCon(ctx.admin(`insert into public.pedidos (canal, tipo_entrega, metodo_pago) values ('local', 'en_local', 'daviplata')`), /Nequi o en efectivo/);
  });

  test('un pedido no se puede cambiar a otro método, pero sí entre Nequi y efectivo', async () => {
    await pedirWeb('efectivo'); // queda abierto (los del local se registran ya entregados)
    const { id } = await ultimo();
    await fallaCon(ctx.staff('pedido_actualizar_cobro', { p_id: id, p: { metodo_pago: 'transferencia' } }), 'DATO_INVALIDO');
    await ctx.staff('pedido_actualizar_cobro', { p_id: id, p: { metodo_pago: 'nequi' } });
    assert.equal((await ultimo()).metodo_pago, 'nequi');
  });

  test('los pedidos viejos con Daviplata se conservan, se pueden gestionar y salen en la contabilidad', async () => {
    // Simula un pedido de antes de esta regla
    await ctx.admin(`alter table public.pedidos disable trigger tg_pago_permitido`);
    const [{ id }] = await ctx.admin(`insert into public.pedidos (canal, tipo_entrega, metodo_pago) values ('local', 'en_local', 'daviplata') returning id`);
    await ctx.admin(`alter table public.pedidos enable trigger tg_pago_permitido`);
    await ctx.admin(`insert into public.pedido_items (pedido_id, producto_id, nombre_producto, categoria_nombre, precio_unitario, cantidad)
      select $1, p.id, p.nombre, c.nombre, p.precio, 1 from public.productos p join public.categorias c on c.id = p.categoria_id where p.slug = 'clasica'`, [id]);
    const p = await ctx.staff('pedido_actualizar_cobro', { p_id: id, p: { descuento: 1000 } });
    assert.equal(p.metodo_pago, 'daviplata', 'sigue con su método original');
    await ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: 'entregado' });
    const hoy = (await ctx.admin(`select (now() at time zone 'America/Bogota')::date::text d`))[0].d;
    const r = await ctx.staff('reporte_ventas', { p_desde: hoy, p_hasta: hoy });
    assert.ok(r.por_metodo_pago.some((f) => f.metodo === 'daviplata' && f.pedidos === 1), 'la contabilidad lo cuenta');
  });
});
