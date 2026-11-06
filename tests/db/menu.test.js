/**
 * Pruebas del MENÚ administrado desde la app y publicado en la web.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon } from '../helpers/bd.js';

let ctx;
let catHamb;
before(async () => {
  ctx = await nuevaBase();
  catHamb = (await ctx.admin(`select id from public.categorias where slug = 'hamburguesas'`))[0].id;
});
after(() => ctx.base.cerrar());

const guardar = (p) => ctx.staff('producto_guardar', { p });

describe('productos', () => {
  test('crear un plato lo publica en la web al instante', async () => {
    const p = await guardar({ categoria_id: catHamb, nombre: 'Hamburguesa Mexicana', descripcion: 'Con jalapeños', precio: 27000, etiqueta: 'Nueva' });
    assert.equal(p.slug, 'hamburguesa-mexicana');
    const menu = await ctx.web('menu_publico', {});
    const enWeb = menu.productos.find((x) => x.slug === 'hamburguesa-mexicana');
    assert.equal(enWeb.precio, 27000);
    assert.equal(enWeb.categoria, 'hamburguesas');
  });
  test('genera identificadores únicos y sin tildes', async () => {
    const a = await guardar({ categoria_id: catHamb, nombre: 'Súper Ñoña', precio: 1000 });
    const b = await guardar({ categoria_id: catHamb, nombre: 'Súper Ñoña', precio: 1000 });
    assert.equal(a.slug, 'super-nona');
    assert.equal(b.slug, 'super-nona-2');
  });
  test('editar el precio conserva el identificador (los carritos de la web siguen válidos)', async () => {
    const [q] = await ctx.admin(`select id, slug from public.productos where slug = 'quechimba'`);
    const p = await guardar({ id: q.id, categoria_id: catHamb, nombre: 'La Quechimba Recargada', precio: 31000 });
    assert.equal(p.slug, 'quechimba');
    assert.equal(p.precio, 31000);
  });
  const malos = [
    ['precio negativo', { precio: -1 }],
    ['precio decimal', { precio: 1000.5 }],
    ['precio como texto', { precio: '1000' }],
    ['precio absurdo', { precio: 999999999 }],
    ['sin nombre', { nombre: '' }],
    ['nombre muy largo', { nombre: 'x'.repeat(61) }],
    ['descripción muy larga', { descripcion: 'x'.repeat(241) }],
    ['categoría inexistente', { categoria_id: '00000000-0000-0000-0000-000000000000' }],
    ['categoría inválida', { categoria_id: 'abc' }],
    ['activo no booleano', { activo: 'si' }],
  ];
  for (const [nombre, cambio] of malos) {
    test(`rechaza ${nombre}`, async () => {
      await fallaCon(guardar({ categoria_id: catHamb, nombre: 'Prueba', precio: 1000, ...cambio }), 'DATO_INVALIDO');
    });
  }
  test('ocultos no salen en la web; agotados salen marcados', async () => {
    const [b] = await ctx.admin(`select id, categoria_id from public.productos where slug = 'bbq-bacon'`);
    await guardar({ id: b.id, categoria_id: b.categoria_id, nombre: 'BBQ Bacon', precio: 26000, activo: false });
    const [s] = await ctx.admin(`select id, categoria_id from public.productos where slug = 'smash-doble'`);
    await guardar({ id: s.id, categoria_id: s.categoria_id, nombre: 'Smash Doble', precio: 24000, agotado: true });
    const menu = await ctx.web('menu_publico', {});
    assert.equal(menu.productos.find((x) => x.slug === 'bbq-bacon'), undefined);
    assert.equal(menu.productos.find((x) => x.slug === 'smash-doble').agotado, true);
    const admin = await ctx.staff('menu_admin', {});
    assert.equal(admin.productos.find((x) => x.slug === 'bbq-bacon').activo, false, 'el encargado sí lo ve');
  });
  test('no se puede eliminar un plato con ventas (se oculta)', async () => {
    await ctx.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' } });
    const [c] = await ctx.admin(`select id from public.productos where slug = 'clasica'`);
    await fallaCon(ctx.staff('producto_eliminar', { p_id: c.id }), 'PRODUCTO_CON_VENTAS');
    const admin = await ctx.staff('menu_admin', {});
    assert.equal(admin.productos.find((x) => x.slug === 'clasica').tiene_ventas, true);
  });
  test('un plato sin ventas sí se elimina', async () => {
    const p = await guardar({ categoria_id: catHamb, nombre: 'Para borrar', precio: 1000 });
    await ctx.staff('producto_eliminar', { p_id: p.id });
    assert.equal((await ctx.admin(`select count(*)::int n from public.productos where id = $1`, [p.id]))[0].n, 0);
  });
});

describe('categorías', () => {
  test('crear, renombrar y ordenar', async () => {
    const c = await ctx.staff('categoria_guardar', { p: { nombre: 'Postres', orden: 9 } });
    assert.equal(c.slug, 'postres');
    const r = await ctx.staff('categoria_guardar', { p: { id: c.id, nombre: 'Postres y helados', orden: 2 } });
    assert.equal(r.slug, 'postres', 'el identificador no cambia');
    assert.equal(r.nombre, 'Postres y helados');
  });
  test('una categoría sin productos visibles no aparece en la web', async () => {
    const menu = await ctx.web('menu_publico', {});
    assert.equal(menu.categorias.find((x) => x.slug === 'postres'), undefined);
  });
  test('no se elimina una categoría con productos', async () => {
    await fallaCon(ctx.staff('categoria_eliminar', { p_id: catHamb }), 'CATEGORIA_CON_PRODUCTOS');
  });
  test('ocultar una categoría oculta sus productos en la web', async () => {
    const [cat] = await ctx.admin(`select id from public.categorias where slug = 'perros'`);
    await ctx.staff('categoria_guardar', { p: { id: cat.id, nombre: 'Perros', activa: false } });
    const menu = await ctx.web('menu_publico', {});
    assert.equal(menu.categorias.find((x) => x.slug === 'perros'), undefined);
    assert.equal(menu.productos.filter((x) => x.categoria === 'perros').length, 0);
  });
});

describe('ajustes', () => {
  test('cambiar el producto destacado de la web', async () => {
    const [p] = await ctx.admin(`select id from public.productos where slug = 'combo-x4'`);
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: p.id, titulo_destacado: 'Para compartir' } });
    const menu = await ctx.web('menu_publico', {});
    assert.deepEqual({ producto: menu.destacado.producto, titulo: menu.destacado.titulo }, { producto: 'combo-x4', titulo: 'Para compartir' });
  });
  test('valida el formato de la versión mínima', async () => {
    await fallaCon(ctx.staff('ajustes_guardar', { p: { version_minima_escritorio: 'uno' } }), 'DATO_INVALIDO');
    await ctx.staff('ajustes_guardar', { p: { version_minima_escritorio: '1.2.0' } });
    assert.equal((await ctx.web('app_info', {})).version_minima_escritorio, '1.2.0');
  });
});
