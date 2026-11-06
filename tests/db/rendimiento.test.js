/**
 * Pruebas NO FUNCIONALES de rendimiento con volumen realista:
 * ~1 año de operación (10.000 pedidos). PGlite (WebAssembly) es varias
 * veces más lento que el PostgreSQL de Supabase, así que si pasa aquí,
 * en producción sobra margen.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, clienteWeb } from '../helpers/bd.js';

const PEDIDOS = 10_000;
// Los servidores de GitHub Actions son más lentos: solo los límites de TIEMPO se amplían allí
const FACTOR = process.env.CI ? 3 : 1;
let ctx;

before(async () => {
  ctx = await nuevaBase();
  // Carga masiva pasando por los mismos triggers de integridad
  await ctx.base.db.exec(`
    do $$
    declare v_ids uuid[]; v_precios int[]; v_nombres text[]; v_n int; v_id uuid; i int; k int;
    begin
      select array_agg(id order by slug), array_agg(precio order by slug), array_agg(nombre order by slug)
        into v_ids, v_precios, v_nombres from public.productos;
      v_n := array_length(v_ids, 1);
      for i in 1..${PEDIDOS} loop
        insert into public.pedidos (canal, tipo_entrega, metodo_pago, creado_en)
        values ((array['web','whatsapp','local'])[1 + i % 3]::public.canal_pedido, 'en_local',
                (array['efectivo','nequi'])[1 + i % 2]::public.metodo_pago,
                now() - (i * interval '52 minutes'))
        returning id into v_id;
        k := 1 + (i * 7) % v_n;
        insert into public.pedido_items (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad)
        values (v_id, v_ids[k], v_nombres[k], v_precios[k], 1 + i % 3);
        update public.pedidos set estado = 'entregado' where id = v_id;
      end loop;
    end $$;`);
});
after(() => ctx.base.cerrar());

const medir = async (fn, veces = 3) => {
  const tiempos = [];
  for (let i = 0; i < veces; i++) { const t0 = performance.now(); await fn(); tiempos.push(performance.now() - t0); }
  return Math.min(...tiempos);
};
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() - n * 86_400_000));

test(`hay ${PEDIDOS.toLocaleString('es-CO')} pedidos cargados (≈ 1 año)`, async () => {
  const [{ n }] = await ctx.admin(`select count(*)::int n from public.pedidos where estado = 'entregado'`);
  assert.equal(n, PEDIDOS);
});

test('reporte de un mes en menos de 1,5 s', async () => {
  const ms = await medir(() => ctx.staff('reporte_ventas', { p_desde: haceDias(29), p_hasta: hoy() }));
  assert.ok(ms < 1500 * FACTOR, `${Math.round(ms)} ms`);
});

test('reporte de un año completo en menos de 5 s', async () => {
  const ms = await medir(() => ctx.staff('reporte_ventas', { p_desde: haceDias(365), p_hasta: hoy() }), 2);
  assert.ok(ms < 5000 * FACTOR, `${Math.round(ms)} ms`);
});

test('el menú de la web responde en menos de 150 ms', async () => {
  const ms = await medir(() => ctx.web('menu_publico', {}));
  assert.ok(ms < 150 * FACTOR, `${Math.round(ms)} ms`);
});

test('el tablero de pedidos (2 días) carga en menos de 500 ms', async () => {
  const ms = await medir(() => ctx.staff('pedidos_listar', { p_desde: haceDias(1), p_hasta: hoy() }));
  assert.ok(ms < 500 * FACTOR, `${Math.round(ms)} ms`);
});

test('crear un pedido web toma en promedio menos de 100 ms', async () => {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    await ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }, { slug: 'limonada', cantidad: 2 }], p_cliente: clienteWeb() });
  }
  const promedio = (performance.now() - t0) / 20;
  assert.ok(promedio < 100 * FACTOR, `${Math.round(promedio)} ms`);
});
