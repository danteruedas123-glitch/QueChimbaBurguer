/**
 * Pruebas de SEGURIDAD: quién puede leer, escribir y ejecutar qué.
 * Se prueban los tres actores contra todas las tablas y funciones.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon, clienteWeb } from '../helpers/bd.js';

const TABLAS = ['staff', 'categorias', 'productos', 'ajustes', 'pedidos', 'pedido_items', 'pedido_eventos'];

let ctx;
before(async () => {
  ctx = await nuevaBase();
  await ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_cliente: clienteWeb() });
});
after(() => ctx.base.cerrar());

const leer = (rol, usuario, tabla) => ctx.base.sql(`select * from public.${tabla}`, [], { rol, usuario });

describe('lectura directa de tablas (RLS)', () => {
  for (const tabla of TABLAS) {
    test(`anónimo NO puede leer ${tabla}`, async () => {
      await fallaCon(leer('anon', null, tabla), /permission denied/);
    });
    test(`usuario que no es del personal no ve filas de ${tabla}`, async () => {
      assert.deepEqual(await leer('authenticated', ctx.intrusoId, tabla), []);
    });
    test(`el personal sí puede leer ${tabla}`, async () => {
      const filas = await leer('authenticated', ctx.staffId, tabla);
      assert.ok(filas.length > 0, `${tabla} debería tener datos visibles`);
    });
  }
});

describe('escritura directa de tablas: prohibida para todos (solo por funciones)', () => {
  const intentos = {
    insert: (t) => `insert into public.${t} default values`,
    update: (t) => `update public.${t} set ${t === 'pedidos' ? "notas = 'x'" : t === 'ajustes' ? 'pedidos_web_activos = false' : t === 'productos' ? 'precio = 1' : t === 'staff' ? "rol = 'admin'" : t === 'categorias' ? "nombre = 'x'" : t === 'pedido_items' ? 'cantidad = 1' : 'motivo = null'}`,
    delete: (t) => `delete from public.${t}`,
  };
  for (const [op, sql] of Object.entries(intentos)) {
    for (const tabla of TABLAS) {
      test(`${op} en ${tabla} rechazado para anónimo y personal`, async () => {
        await fallaCon(ctx.base.sql(sql(tabla), [], { rol: 'anon' }), /permission denied/);
        await fallaCon(ctx.base.sql(sql(tabla), [], { rol: 'authenticated', usuario: ctx.staffId }), /permission denied/);
      });
    }
  }
  test('un cliente de la web no puede bajar el precio de un producto', async () => {
    await fallaCon(ctx.base.sql(`update public.productos set precio = 1`, [], { rol: 'anon' }), /permission denied/);
    const [p] = await ctx.admin(`select precio from public.productos where slug = 'clasica'`);
    assert.equal(p.precio, 18000);
  });
});

describe('permisos de ejecución de funciones', () => {
  const PUBLICAS = ['menu_publico', 'app_info'];
  const DE_PERSONAL = [
    ['menu_admin', {}], ['perfil_actual', {}],
    ['categoria_guardar', { p: { nombre: 'X' } }],
    ['producto_guardar', { p: { nombre: 'X', precio: 1000, categoria_id: '00000000-0000-0000-0000-000000000000' } }],
    ['producto_eliminar', { p_id: '00000000-0000-0000-0000-000000000000' }],
    ['categoria_eliminar', { p_id: '00000000-0000-0000-0000-000000000000' }],
    ['ajustes_guardar', { p: { pedidos_web_activos: false } }],
    ['pedidos_listar', { p_desde: '2026-01-01', p_hasta: '2026-01-31' }],
    ['pedido_cambiar_estado', { p_id: '00000000-0000-0000-0000-000000000000', p_estado: 'cancelado' }],
    ['pedido_actualizar_cobro', { p_id: '00000000-0000-0000-0000-000000000000', p: {} }],
    ['venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' } }],
    ['reporte_ventas', { p_desde: '2026-01-01', p_hasta: '2026-01-31' }],
  ];

  for (const f of PUBLICAS) {
    test(`la web puede llamar ${f}()`, async () => {
      assert.ok(await ctx.web(f, {}));
    });
  }
  for (const [f, args] of DE_PERSONAL) {
    if (f === 'perfil_actual') continue;
    test(`la web NO puede llamar ${f}()`, async () => {
      await fallaCon(ctx.web(f, args), /permission denied/);
    });
    test(`un usuario que no es del personal NO puede usar ${f}()`, async () => {
      await fallaCon(ctx.intruso(f, args), 'SIN_PERMISO');
    });
  }
  test('perfil_actual distingue personal de intrusos', async () => {
    assert.deepEqual(await ctx.intruso('perfil_actual', {}), { es_staff: false });
    assert.deepEqual(await ctx.staff('perfil_actual', {}), { es_staff: true, nombre: 'Encargado', rol: 'admin' });
  });
  test('las funciones internas no se pueden llamar desde afuera', async () => {
    const internas = await ctx.admin(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                      where n.nspname = 'public' and proname ~ '^(_|tg_)'`);
    assert.ok(internas.length >= 10);
    for (const { proname } of internas) {
      const [{ puede_anon, puede_auth }] = await ctx.admin(
        `select bool_or(has_function_privilege('anon', p.oid, 'execute')) puede_anon,
                bool_or(has_function_privilege('authenticated', p.oid, 'execute')) puede_auth
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [proname]);
      assert.equal(puede_anon, false, `anon no debe ejecutar ${proname}`);
      assert.equal(puede_auth, false, `authenticated no debe ejecutar ${proname}`);
    }
  });
});

describe('registros contables inmutables', () => {
  test('nadie puede borrar pedidos, ni siquiera el administrador de la base', async () => {
    await fallaCon(ctx.admin(`delete from public.pedidos`), /no se borran/);
  });
  test('la bitácora de estados no se puede alterar', async () => {
    await fallaCon(ctx.admin(`update public.pedido_eventos set motivo = 'x'`), /no se borran/);
    await fallaCon(ctx.admin(`delete from public.pedido_eventos`), /no se borran/);
  });
});
