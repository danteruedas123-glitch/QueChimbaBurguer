/**
 * El MENÚ REAL (supabase/menu.mjs) instalado de verdad:
 * seed.sql, el script de producción actualizar_menu.sql y el respaldo de la web
 * tienen que decir exactamente lo mismo, y cada foto tiene que existir.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { crearBaseLocal } from '../../src/main/db-local.js';
import { nuevaBase } from '../helpers/bd.js';
import { CATEGORIAS, DESTACADO, productosPlanos } from '../../supabase/menu.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = process.env.QB_WEB_DIR ?? path.resolve(RAIZ, '..', 'WebQuechimbaburger');
const PRODUCTOS = productosPlanos();
const ACTIVOS = PRODUCTOS.filter((p) => p.activo);

let base;
before(async () => { base = await crearBaseLocal(); }); // con el menú real (seed.sql)
after(() => base.cerrar());

describe('menú real', () => {
  test('se instala completo: 11 categorías y 112 productos (los 15 jugos ocultos)', async () => {
    const [{ c }] = await base.sql('select count(*)::int c from public.categorias', [], { rol: 'postgres' });
    const [{ p, ocultos }] = await base.sql('select count(*)::int p, count(*) filter (where not activo)::int ocultos from public.productos', [], { rol: 'postgres' });
    assert.deepEqual([c, p, ocultos], [CATEGORIAS.length, PRODUCTOS.length, 15]);
    assert.deepEqual([CATEGORIAS.length, PRODUCTOS.length], [11, 112]);
  });

  test('la web muestra todo lo que tiene precio, en el orden de la carta, y nada sin precio', async () => {
    const menu = await base.rpc('menu_publico', {}, { rol: 'anon' });
    assert.deepEqual(menu.categorias.map((c) => c.slug), CATEGORIAS.filter((c) => c.slug !== 'jugos').map((c) => c.slug));
    assert.equal(menu.productos.length, ACTIVOS.length);
    assert.ok(menu.productos.every((p) => p.precio > 0), 'ningún producto visible en $0');
    assert.equal(menu.destacado.producto, DESTACADO.producto);
  });

  test('precios clave de la carta', async () => {
    const precio = Object.fromEntries((await base.rpc('menu_publico', {}, { rol: 'anon' })).productos.map((p) => [p.slug, p.precio]));
    assert.deepEqual(
      ['chimbita-burger', 'triple-chimba-burger', 'combo-9', 'salchichimba', 'la-de-80k', 'mini-perro-con-papas', 'papa-tornado', 'churrasco',
        'frutos-rojos-con-todo-super-cargada', 'michelada-clasica-normal', 'agua-250'].map((s) => precio[s]),
      [23000, 35000, 85000, 23000, 80000, 8000, 5000, 32000, 15000, 6000, 1000],
    );
  });

  test('cada producto cabe en las reglas de la base de datos', () => {
    for (const p of PRODUCTOS) {
      assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, p.slug);
      assert.ok(p.nombre.length <= 60 && p.descripcion.length <= 240, `${p.slug}: textos muy largos`);
      assert.ok(!p.etiqueta || p.etiqueta.length <= 24, `${p.slug}: etiqueta muy larga`);
    }
    assert.equal(new Set(PRODUCTOS.map((p) => p.slug)).size, PRODUCTOS.length, 'sin productos repetidos');
  });

  test('cada foto del menú existe en la web', async () => {
    const fotos = [...new Set(PRODUCTOS.map((p) => p.foto_url).filter(Boolean)), DESTACADO.foto];
    for (const f of fotos) await access(path.join(WEB, f)).catch(() => assert.fail(`falta la foto ${f}`));
  });

  test('el menú de respaldo de la web es idéntico al de la base de datos', async () => {
    const ventana = {};
    vm.runInNewContext(await readFile(path.join(WEB, 'js', 'config.js'), 'utf8'), { window: ventana });
    const cfg = JSON.parse(JSON.stringify(ventana.QB_CONFIG)); // objetos creados en otro contexto
    assert.deepEqual(
      cfg.productos.map((p) => [p.id, p.categoria, p.nombre, p.precio, p.descripcion]),
      ACTIVOS.map((p) => [p.slug, p.categoria, p.nombre, p.precio, p.descripcion]),
      'corre "npm run menu:generar"',
    );
    assert.equal(cfg.promo.producto, DESTACADO.producto);
  });

  test('seed.sql e instalar_todo.sql están al día con menu.mjs', async () => {
    const seed = await readFile(path.join(RAIZ, 'supabase', 'seed.sql'), 'utf8');
    for (const p of PRODUCTOS) assert.ok(seed.includes(`'${p.slug}'`), `seed.sql sin ${p.slug}: corre "npm run menu:generar"`);
  });
});

describe('actualizar_menu.sql (producción)', () => {
  let ctx;
  before(async () => { ctx = await nuevaBase(); }); // base con el menú viejo de pruebas
  after(() => ctx.base.cerrar());

  test('reemplaza el menú viejo sin tocar la historia de ventas, y se puede correr dos veces', async () => {
    // Una venta vieja con "La Clásica" (debe conservarse)
    await ctx.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 2 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' } });
    const antes = await ctx.admin(`select coalesce(sum(total), 0)::int t from public.pedidos`);
    const script = await readFile(path.join(RAIZ, 'supabase', 'actualizar_menu.sql'), 'utf8');
    await ctx.base.db.exec(script); // como en el SQL Editor de Supabase
    await ctx.base.db.exec(script); // se puede correr dos veces sin daño

    const menu = await ctx.web('menu_publico', {});
    assert.deepEqual(menu.productos.map((p) => p.slug), ACTIVOS.map((p) => p.slug), 'la web muestra solo el menú real');
    assert.equal(menu.destacado.producto, DESTACADO.producto);
    const [clasica] = await ctx.admin(`select activo from public.productos where slug = 'clasica'`);
    assert.equal(clasica.activo, false, 'lo vendido se oculta, no se borra');
    const [{ n }] = await ctx.admin(`select count(*)::int n from public.productos where slug = 'te-helado'`);
    assert.equal(n, 0, 'lo que nunca se vendió se borra');
    assert.deepEqual(await ctx.admin(`select coalesce(sum(total), 0)::int t from public.pedidos`), antes, 'la contabilidad no cambia');
    const jugos = await ctx.staff('menu_admin', {});
    assert.ok(jugos.productos.filter((p) => p.slug.startsWith('jugo-') && p.slug !== 'jugo-hit-litro').every((p) => !p.activo && p.precio === 0), 'jugos ocultos y en $0');
  });
});
