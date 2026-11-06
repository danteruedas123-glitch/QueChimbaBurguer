/**
 * El historial de ejemplo del modo demo debe ser contablemente válido
 * (se genera con las mismas reglas e integridad que producción).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDemo, CREDENCIALES_DEMO } from '../../src/main/demo.js';
import { hoyEn, sumarDias } from '../../src/shared/periodos.js';

let base;
let usuario;
before(async () => {
  base = await crearBaseDemo();
  [{ id: usuario }] = await base.sql(`select id from auth.users where email = $1`, [CREDENCIALES_DEMO.email], { rol: 'postgres' });
});
after(() => base.cerrar());

test('genera un historial amplio de 45 días', async () => {
  const [{ n, dias }] = await base.sql(`select count(*)::int n, count(distinct (creado_en at time zone 'America/Bogota')::date)::int dias from public.pedidos`, [], { rol: 'postgres' });
  assert.ok(n > 300, `pedidos: ${n}`);
  assert.ok(dias >= 40, `días con pedidos: ${dias}`);
});

test('todos los pedidos son consistentes (ítems, totales, fechas)', async () => {
  const [r] = await base.sql(`
    select
      count(*) filter (where p.subtotal <> (select coalesce(sum(subtotal), 0) from public.pedido_items i where i.pedido_id = p.id))::int malos_subtotal,
      count(*) filter (where not exists (select 1 from public.pedido_items i where i.pedido_id = p.id))::int sin_items,
      count(*) filter (where p.creado_en > now())::int en_futuro
    from public.pedidos p`, [], { rol: 'postgres' });
  assert.deepEqual(r, { malos_subtotal: 0, sin_items: 0, en_futuro: 0 });
});

test('el encargado demo puede consultar la contabilidad del mes', async () => {
  const hoy = hoyEn();
  const rep = await base.rpc('reporte_ventas', { p_desde: sumarDias(hoy, -29), p_hasta: hoy }, { rol: 'authenticated', usuario });
  assert.ok(rep.resumen.total > 0);
  assert.equal(rep.por_dia.length, 30);
});
