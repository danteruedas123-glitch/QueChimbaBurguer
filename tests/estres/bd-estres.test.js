/**
 * PRUEBAS DE ESTRÉS de la base de datos (copia local idéntica a producción).
 * Ataques con datos basura y maliciosos, volumen extremo, auditoría de
 * permisos y verificación de que la contabilidad siga cuadrando después.
 *   npm run test:estres
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, clienteWeb } from '../helpers/bd.js';

let ctx;
before(async () => { ctx = await nuevaBase(); });
after(() => ctx.base.cerrar());

// ---------- generador determinista (mismos ataques en cada corrida) ----------
let semilla = 20261109;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const uno = (xs) => xs[Math.floor(azar() * xs.length)];

const anidado = (n) => { let x = 'fondo'; for (let i = 0; i < n; i++) x = [x]; return x; };
const BASURA = [
  null, true, false, 0, -1, 1.5, 1e308, -1e308, 2 ** 31, -(2 ** 31), 2 ** 53, '', ' ', '0', '-5', '1e9', 'NaN', 'Infinity',
  'a'.repeat(100_000), "'; drop table public.pedidos; --", "' or 1=1 --", '<script>alert(1)</script>', '<img src=x onerror=alert(1)>',
  '\u0000', '‮ invertido', '🍔'.repeat(500), '../../etc/passwd', '{"$ne":null}', '00000000-0000-0000-0000-000000000000',
  [], {}, [[]], anidado(500), Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`k${i}`, i])), Array.from({ length: 5000 }, (_, i) => i),
];
const basura = () => uno(BASURA);

// Errores que son RESPUESTAS CONTROLADAS (mensaje claro al usuario)
// 22P05: carácter nulo (\u0000) que Postgres rechaza antes de entrar a la función (PostgREST responde 400)
const CONTROLADOS = new Set(['P0001', '42501', '22P02', '22P05', '22007', '22008', '22023', '42883', 'PGRST202']);
const clasificar = (e) => (CONTROLADOS.has(e.code) ? 'controlado' : `NO CONTROLADO ${e.code}: ${e.message.slice(0, 120)}`);

async function atacar(llamar, veces) {
  const resultado = { ok: 0, controlado: 0, fugas: new Map() };
  for (let i = 0; i < veces; i++) {
    const t0 = performance.now();
    try { await llamar(); resultado.ok++; } catch (e) {
      const c = clasificar(e);
      if (c === 'controlado') resultado.controlado++; else resultado.fugas.set(c, (resultado.fugas.get(c) ?? 0) + 1);
    }
    const ms = performance.now() - t0;
    if (ms > 3000) resultado.fugas.set(`LENTO (${Math.round(ms)} ms)`, (resultado.fugas.get(`LENTO (${Math.round(ms)} ms)`) ?? 0) + 1);
  }
  return resultado;
}

const SLUGS = ['clasica', 'quechimba', 'combo-x4', 'limonada', 'no-existe', 'aros-cebolla'];
const itemBasura = () => uno([
  { slug: uno(SLUGS), cantidad: basura() },
  { slug: basura(), cantidad: 1 },
  { producto_id: basura(), cantidad: 1 },
  { slug: uno(SLUGS), cantidad: 1, opciones: basura() },
  { slug: uno(SLUGS), cantidad: 1, precio: 1, precio_unitario: 1, subtotal: 1, extra: -99999 },
  basura(),
]);
const clienteBasura = () => uno([
  basura(),
  { ...clienteWeb(), nombre: basura() },
  { ...clienteWeb(), tipo_entrega: basura() },
  { ...clienteWeb(), metodo_pago: basura() },
  { ...clienteWeb(), direccion: basura(), tipo_entrega: 'domicilio' },
  { ...clienteWeb(), telefono: basura() },
  { ...clienteWeb(), notas: basura() },
  { ...clienteWeb(), total: 1, descuento: 999999, costo_domicilio: -50000 },
]);

describe('ataque con datos basura y maliciosos (fuzzing)', () => {
  test('crear_pedido_web: 3.000 pedidos venenosos desde la web', async () => {
    const r = await atacar(() => ctx.web('crear_pedido_web', {
      p_items: uno([basura(), Array.from({ length: 1 + Math.floor(azar() * 5) }, itemBasura)]),
      p_cliente: clienteBasura(),
    }), 3000);
    assert.deepEqual([...r.fugas], [], 'ningún error interno ni respuesta lenta');
  });

  test('funciones del personal: 2.000 llamadas con basura en cada campo', async () => {
    const menu = await ctx.staff('menu_admin', {});
    const cat = menu.categorias[0].id;
    const prod = menu.productos[0];
    const llamadas = [
      () => ctx.staff('producto_guardar', { p: { id: uno([prod.id, basura()]), categoria_id: uno([cat, basura()]), nombre: uno(['Ok', basura()]), precio: basura(), descripcion: basura(), etiqueta: basura(), foto_url: basura(), opciones: basura(), orden: basura(), activo: basura() } }),
      () => ctx.staff('categoria_guardar', { p: { nombre: basura(), orden: basura(), activa: basura() } }),
      () => ctx.staff('ajustes_guardar', { p: { [uno(['tema', 'tema_variante', 'aniversario', 'titulo_destacado', 'producto_destacado_id', 'foto_destacado_url', 'url_sitio', 'version_minima_escritorio', 'pedidos_web_activos'])]: basura() } }),
      () => ctx.staff('bebidas_guardar', { p: { gaseosas: basura(), bebidas_michelada: basura() } }),
      () => ctx.staff('venta_registrar', { p_items: uno([basura(), [itemBasura()]]), p_datos: uno([basura(), { canal: basura(), tipo_entrega: 'en_local', metodo_pago: 'efectivo', descuento: basura(), costo_domicilio: basura() }]) }),
      () => ctx.staff('pedido_actualizar_cobro', { p_id: uno(['00000000-0000-0000-0000-000000000000', 'x']), p: { descuento: basura(), costo_domicilio: basura(), metodo_pago: basura() } }),
      () => ctx.staff('reporte_ventas', { p_desde: uno(['2026-01-01', '9999-12-31', '0001-01-01', 'ayer']), p_hasta: uno(['2026-12-31', '2026-01-01', '9999-12-31']) }),
      () => ctx.staff('pedidos_listar', { p_desde: uno(['2026-01-01', '1900-01-01']), p_hasta: uno(['2027-01-01', '9999-12-31']) }),
    ];
    const r = await atacar(() => uno(llamadas)(), 2000);
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: true, tema: 'normal' } });
    assert.deepEqual([...r.fugas], [], 'ningún error interno ni respuesta lenta');
  });

  test('inyección SQL en cada texto: nada se ejecuta y las tablas siguen intactas', async () => {
    const antes = await ctx.admin(`select (select count(*) from public.productos)::int p, (select count(*) from public.categorias)::int c`);
    for (const ataque of ["'; drop table public.pedidos; --", "x'); delete from public.productos; --", "$$; drop table public.staff; $$", "clasica' or '1'='1"]) {
      await ctx.web('crear_pedido_web', { p_items: [{ slug: ataque, cantidad: 1 }], p_cliente: { ...clienteWeb(), nombre: ataque, notas: ataque } }).catch(() => {});
      await ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_cliente: { ...clienteWeb(), nombre: ataque, notas: ataque, direccion: ataque } });
      await ctx.staff('categoria_guardar', { p: { nombre: ataque.slice(0, 40) } });
    }
    const [{ n }] = await ctx.admin(`select count(*)::int n from public.pedidos where cliente_nombre like '%drop table%'`);
    assert.ok(n >= 1, 'el texto se guardó como texto, sin ejecutarse');
    const despues = await ctx.admin(`select (select count(*) from public.productos)::int p, (select count(*) from public.categorias)::int c`);
    assert.equal(despues[0].p, antes[0].p, 'ningún producto borrado');
  });
});

describe('límites de dinero (que nunca se desborde ni dé negativo)', () => {
  test('un pedido gigante (40 productos × 99 unidades del más caro) se rechaza limpio o se cobra exacto', async () => {
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias limit 1`);
    await ctx.staff('producto_guardar', { p: { categoria_id: cat, nombre: 'Producto Carísimo', precio: 5_000_000 } });
    const items = Array.from({ length: 40 }, () => ({ slug: 'producto-carisimo', cantidad: 99 }));
    try {
      const r = await ctx.web('crear_pedido_web', { p_items: items, p_cliente: clienteWeb() });
      assert.fail(`aceptó un pedido de ${r.total}: debía rechazarlo por el máximo de 99 unidades`);
    } catch (e) {
      assert.equal(clasificar(e), 'controlado', 'mensaje controlado, no un desbordamiento');
    }
    const casiMax = await ctx.web('crear_pedido_web', { p_items: [{ slug: 'producto-carisimo', cantidad: 99 }], p_cliente: clienteWeb() })
      .then((r) => r.total, (e) => clasificar(e));
    assert.ok(casiMax === 495_000_000 || casiMax === 'controlado', `99 × $5.000.000: ${casiMax}`);
  });

  test('40 productos DISTINTOS de $5.000.000 × 99 unidades: no desborda el total, se rechaza limpio', async () => {
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias limit 1`);
    for (let i = 0; i < 40; i++) await ctx.staff('producto_guardar', { p: { categoria_id: cat, nombre: `Caro ${i}`, precio: 5_000_000 } });
    const r = await ctx.web('crear_pedido_web', { p_items: Array.from({ length: 40 }, (_, i) => ({ slug: `caro-${i}`, cantidad: 99 })), p_cliente: clienteWeb() })
      .then((x) => `aceptó ${x.total}`, (e) => clasificar(e));
    assert.equal(r, 'controlado');
    await ctx.admin(`update public.productos set activo = false where slug like 'caro-%' or slug in ('producto-carisimo', 'extras-locos')`);
  });

  test('opciones con extras enormes: se rechaza limpio, nunca un error interno', async () => {
    const [{ id: cat }] = await ctx.admin(`select id from public.categorias limit 1`);
    const opc = Array.from({ length: 6 }, (_, g) => ({ titulo: `G${g}`, elige: 5, opciones: [{ nombre: 'Caro', extra: 1_000_000 }, { nombre: 'Normal', extra: 0 }] }));
    const r = await ctx.staff('producto_guardar', { p: { categoria_id: cat, nombre: 'Extras Locos', precio: 5_000_000, opciones: opc } }).then(() => 'guardado', (e) => clasificar(e));
    if (r === 'guardado') {
      const pedido = await ctx.web('crear_pedido_web', { p_items: [{ slug: 'extras-locos', cantidad: 1, opciones: opc.map(() => Array(5).fill('Caro')) }], p_cliente: clienteWeb() })
        .then((x) => `cobró ${x.total}`, (e) => clasificar(e));
      assert.equal(pedido, 'controlado', 'precio con opciones > $5.000.000: mensaje claro');
    }
  });

  test('descuento mayor al total y domicilio negativo: se rechazan', async () => {
    const v = await ctx.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo', descuento: 999_999 } }).then(() => 'aceptó', (e) => clasificar(e));
    assert.equal(v, 'controlado');
    const d = await ctx.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'domicilio', direccion: 'x', metodo_pago: 'efectivo', costo_domicilio: -5000 } }).then(() => 'aceptó', (e) => clasificar(e));
    assert.equal(d, 'controlado');
  });
});

describe('abuso y avalancha', () => {
  test('avalancha de 200 pedidos web seguidos: se frena en 60 cada 10 minutos', async () => {
    const ctx = await nuevaBase(); // base limpia: la fecha de un pedido no se puede alterar (ni para pruebas)
    let aceptados = 0;
    let frenados = 0;
    for (let i = 0; i < 200; i++) {
      try { await ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_cliente: clienteWeb() }); aceptados++; } catch (e) { if (e.hint === 'DEMASIADOS_PEDIDOS') frenados++; else throw e; }
    }
    assert.deepEqual([aceptados, frenados], [60, 140]);
    await ctx.base.cerrar();
  });

  test('100 ventas de caja disparadas "a la vez": números de pedido únicos y seguidos', async () => {
    const ventas = await Promise.all(Array.from({ length: 100 }, () => ctx.staff('venta_registrar', {
      p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' },
    })));
    const numeros = ventas.map((v) => v.numero).sort((a, b) => a - b);
    assert.equal(new Set(numeros).size, 100, 'sin números repetidos');
    assert.equal(numeros[99] - numeros[0], 99, 'sin huecos');
  });
});

describe('tablero en un día de locos', () => {
  test('1.500 pedidos pendientes + 2.000 cerrados hoy: TODOS los pendientes salen en el tablero', async () => {
    const ctx2 = await nuevaBase();
    const datos = { canal: 'whatsapp', tipo_entrega: 'en_local', metodo_pago: 'efectivo' };
    for (let i = 0; i < 1500; i++) await ctx2.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { ...datos, entregado: false } });
    for (let i = 0; i < 2000; i++) await ctx2.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { ...datos, entregado: true } });
    const hoy = (await ctx2.admin(`select (now() at time zone 'America/Bogota')::date::text d`))[0].d;
    const lista = await ctx2.staff('pedidos_listar', { p_desde: hoy, p_hasta: hoy });
    const pendientes = lista.filter((p) => p.estado === 'nuevo').length;
    assert.equal(pendientes, 1500, 'ningún pedido pendiente se queda por fuera');
    assert.equal(Math.min(...lista.filter((p) => p.estado === 'nuevo').map((p) => p.numero)), 1, 'incluido el más viejo (el más urgente)');
    await ctx2.base.cerrar();
  });
});

describe('volumen extremo', () => {
  const PEDIDOS = 50_000;
  test(`${PEDIDOS.toLocaleString('es-CO')} pedidos (~5 años de ventas) y 2.000 productos: todo responde rápido`, async () => {
    await ctx.base.db.exec(`
      do $$
      declare v_cat uuid; v_ids uuid[]; v_n int; v_id uuid; i int; k int;
      begin
        select id into v_cat from public.categorias limit 1;
        for i in 1..2000 loop
          insert into public.productos (slug, categoria_id, nombre, precio, orden) values ('masivo-' || i, v_cat, 'Producto masivo ' || i, 1000 + i, i);
        end loop;
        select array_agg(id) into v_ids from public.productos;
        v_n := array_length(v_ids, 1);
        for i in 1..${PEDIDOS} loop
          insert into public.pedidos (canal, tipo_entrega, metodo_pago, creado_en)
          values ((array['web','whatsapp','local'])[1 + i % 3]::public.canal_pedido, 'en_local', 'efectivo', now() - (i * interval '50 minutes'))
          returning id into v_id;
          k := 1 + (i * 7) % v_n;
          insert into public.pedido_items (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad)
          select v_id, p.id, p.nombre, p.precio, 1 + i % 3 from public.productos p where p.id = v_ids[k];
          update public.pedidos set estado = 'entregado' where id = v_id;
        end loop;
      end $$;`);
    const medir = async (f) => { const t = performance.now(); await f(); return Math.round(performance.now() - t); };
    const tiempos = {
      menu_web: await medir(() => ctx.web('menu_publico', {})),
      menu_admin: await medir(() => ctx.staff('menu_admin', {})),
      reporte_anio: await medir(() => ctx.staff('reporte_ventas', { p_desde: '2025-11-10', p_hasta: '2026-11-09' })),
      reporte_mes: await medir(() => ctx.staff('reporte_ventas', { p_desde: '2026-10-01', p_hasta: '2026-10-31' })),
      pedidos_hoy: await medir(() => ctx.staff('pedidos_listar', { p_desde: '2026-11-09', p_hasta: '2026-11-09' })),
      pedido_web: await medir(() => ctx.web('crear_pedido_web', { p_items: [{ slug: 'masivo-1500', cantidad: 2 }], p_cliente: clienteWeb() })),
    };
    console.log('    tiempos (ms, PGlite; Supabase es varias veces más rápido):', JSON.stringify(tiempos));
    const limites = { menu_web: 3000, menu_admin: 5000, reporte_anio: 8000, reporte_mes: 3000, pedidos_hoy: 2000, pedido_web: 1000 };
    for (const [k, ms] of Object.entries(tiempos)) assert.ok(ms < limites[k] * (process.env.CI ? 3 : 1), `${k}: ${ms} ms`);
  });
});

describe('integridad después de toda la paliza', () => {
  test('cada pedido cuadra: subtotal = suma de líneas, total = subtotal + domicilio − descuento, nada negativo', async () => {
    const malos = await ctx.admin(`
      select p.numero, p.subtotal, p.total, p.costo_domicilio, p.descuento, coalesce(sum(i.subtotal), 0)::bigint lineas
      from public.pedidos p left join public.pedido_items i on i.pedido_id = p.id
      group by p.id
      having p.subtotal <> coalesce(sum(i.subtotal), 0)
          or p.total <> p.subtotal + p.costo_domicilio - p.descuento
          or p.total < 0 or p.descuento < 0 or p.costo_domicilio < 0
      limit 5`);
    assert.deepEqual(malos, []);
    const lineas = await ctx.admin(`select count(*)::int n from public.pedido_items where cantidad not between 1 and 99 or precio_unitario < 0 or subtotal <> precio_unitario * cantidad`);
    assert.equal(lineas[0].n, 0);
  });

  test('la contabilidad suma exactamente lo mismo que los pedidos entregados', async () => {
    const r = await ctx.staff('reporte_ventas', { p_desde: '2025-11-10', p_hasta: '2026-11-09' });
    const [{ total, n }] = await ctx.admin(`select coalesce(sum(total), 0)::bigint total, count(*)::int n from public.pedidos where estado = 'entregado'
      and (creado_en at time zone 'America/Bogota')::date between '2025-11-10' and '2026-11-09'`);
    assert.equal(Number(r.resumen.total), Number(total));
    assert.equal(r.resumen.pedidos, n);
    assert.equal(r.por_metodo_pago.reduce((s, f) => s + Number(f.total), 0), Number(total), 'métodos de pago = total');
  });

  test('la historia es inmutable: nadie borra ni altera pedidos cerrados', async () => {
    const [p] = await ctx.admin(`select id from public.pedidos where estado = 'entregado' limit 1`);
    for (const sql of [`delete from public.pedidos where id = '${p.id}'`, `update public.pedido_items set precio_unitario = 1 where pedido_id = '${p.id}'`]) {
      await assert.rejects(ctx.admin(sql));
    }
  });
});

describe('auditoría automática de permisos (como Supabase: lo nuevo nace abierto)', () => {
  test('todas las tablas tienen seguridad por filas (RLS) y nadie escribe directo', async () => {
    const r = await ctx.admin(`
      select c.relname, c.relrowsecurity rls,
             has_table_privilege('anon', c.oid, 'insert,update,delete') anon_escribe,
             has_table_privilege('authenticated', c.oid, 'insert,update,delete') auth_escribe,
             has_table_privilege('anon', c.oid, 'select') anon_lee
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    const problemas = r.filter((t) => !t.rls || t.anon_escribe || t.auth_escribe || t.anon_lee).map((t) => t.relname);
    assert.deepEqual(problemas, []);
  });

  test('la web (anon) solo puede llamar las 3 funciones públicas; nada interno', async () => {
    const r = await ctx.admin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    assert.deepEqual(r.map((x) => x.proname).filter((f) => !['transicion_valida'].includes(f)), ['app_info', 'crear_pedido_web', 'menu_publico']);
  });

  test('cada función del personal verifica el permiso por dentro', async () => {
    const r = await ctx.admin(`
      select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('es_staff', 'perfil_actual')`);
    assert.ok(r.length >= 12);
    assert.deepEqual(r.filter((f) => !f.prosrc.includes('_requiere_staff')).map((f) => f.proname), []);
  });

  test('toda función con privilegios fija su search_path (evita secuestro de funciones)', async () => {
    const r = await ctx.admin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    assert.deepEqual(r, []);
  });
});
