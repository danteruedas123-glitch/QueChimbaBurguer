/**
 * Opciones al pedir: bebida del combo, en agua o en leche, nivel de la michelada…
 * El cliente solo dice QUÉ eligió; el precio lo calcula siempre el servidor.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon, clienteWeb } from '../helpers/bd.js';

let ctx;
let cat;
before(async () => {
  ctx = await nuevaBase();
  [{ id: cat }] = await ctx.admin(`select id from public.categorias where slug = 'combos'`);
  await ctx.staff('producto_guardar', { p: {
    categoria_id: cat, nombre: 'Combo Prueba', precio: 20000,
    opciones: [
      { titulo: 'Preparación', elige: 1, opciones: [{ nombre: 'En agua', extra: 0 }, { nombre: 'En leche', extra: 2000 }] },
      { titulo: 'Gaseosas', elige: 2, lista: 'gaseosas' },
    ],
  } });
});
after(() => ctx.base.cerrar());

const pedirWeb = (items) => ctx.web('crear_pedido_web', { p_items: items, p_cliente: clienteWeb() });
const items = async (numero) => ctx.admin(
  `select i.nombre_producto, i.precio_unitario, i.cantidad, i.subtotal, i.detalle from public.pedido_items i
   join public.pedidos p on p.id = i.pedido_id where p.numero = $1 order by i.detalle`, [numero]);

describe('opciones del producto', () => {
  for (const [nombre, opciones] of [
    ['elige 0', [{ titulo: 'X', elige: 0, opciones: [{ nombre: 'a', extra: 0 }, { nombre: 'b', extra: 0 }] }]],
    ['opción repetida', [{ titulo: 'X', elige: 1, opciones: [{ nombre: 'a', extra: 0 }, { nombre: 'a', extra: 0 }] }]],
    ['lista desconocida', [{ titulo: 'X', elige: 1, lista: 'cervezas' }]],
    ['extra negativo', [{ titulo: 'X', elige: 1, opciones: [{ nombre: 'a', extra: -100 }, { nombre: 'b', extra: 0 }] }]],
    ['extra con decimales', [{ titulo: 'X', elige: 1, opciones: [{ nombre: 'a', extra: 10.5 }, { nombre: 'b', extra: 0 }] }]],
    ['una sola opción', [{ titulo: 'X', elige: 1, opciones: [{ nombre: 'a', extra: 0 }] }]],
    ['sin título', [{ titulo: '', elige: 1, opciones: [{ nombre: 'a', extra: 0 }, { nombre: 'b', extra: 0 }] }]],
  ]) {
    test(`rechaza opciones mal formadas: ${nombre}`, async () => {
      await fallaCon(ctx.staff('producto_guardar', { p: { categoria_id: cat, nombre: `Malo ${nombre}`, precio: 1000, opciones } }), 'DATO_INVALIDO');
    });
  }

  test('la web recibe las opciones de cada producto y las listas de bebidas', async () => {
    const menu = await ctx.web('menu_publico', {});
    const p = menu.productos.find((x) => x.slug === 'combo-prueba');
    assert.equal(p.opciones.length, 2);
    assert.ok(menu.bebidas.gaseosas.includes('Coca-Cola'));
    assert.ok(menu.bebidas.bebidas_michelada.includes('Águila'));
    assert.deepEqual(menu.productos.find((x) => x.slug === 'clasica').opciones, []);
  });

  test('el servidor cobra base + extras y guarda lo elegido en la línea', async () => {
    const r = await pedirWeb([{ slug: 'combo-prueba', cantidad: 2, opciones: [['En leche'], ['Coca-Cola', 'Pepsi']], precio: 1, extra: 0 }]);
    assert.equal(r.total, (20000 + 2000) * 2);
    assert.deepEqual(await items(r.numero), [{
      nombre_producto: 'Combo Prueba', precio_unitario: 22000, cantidad: 2, subtotal: 44000,
      detalle: 'Preparación: En leche · Gaseosas: Coca-Cola, Pepsi',
    }]);
    assert.equal(r.items[0].detalle, 'Preparación: En leche · Gaseosas: Coca-Cola, Pepsi', 'el detalle va en la respuesta (para WhatsApp)');
  });

  test('lo mismo elegido se suma en una línea; lo distinto va en líneas separadas', async () => {
    const r = await pedirWeb([
      { slug: 'combo-prueba', cantidad: 1, opciones: [['En agua'], ['Coca-Cola', 'Coca-Cola']] },
      { slug: 'combo-prueba', cantidad: 2, opciones: [['En agua'], ['Coca-Cola', 'Coca-Cola']] },
      { slug: 'combo-prueba', cantidad: 1, opciones: [['En leche'], ['Pepsi', 'Ginger']] },
    ]);
    const lineas = await items(r.numero);
    assert.deepEqual(lineas.map((l) => [l.cantidad, l.precio_unitario]), [[3, 20000], [1, 22000]]);
    assert.equal(r.total, 3 * 20000 + 22000);
  });

  for (const [nombre, opciones, codigo] of [
    ['sin elegir nada', undefined, 'OPCIONES_INCOMPLETAS'],
    ['falta un grupo', [['En agua']], 'OPCIONES_INCOMPLETAS'],
    ['una gaseosa cuando son dos', [['En agua'], ['Coca-Cola']], 'OPCIONES_INCOMPLETAS'],
    ['una bebida inventada', [['En agua'], ['Coca-Cola', 'Whisky']], 'OPCION_NO_EXISTE'],
    ['una preparación inventada', [['En chocolate'], ['Coca-Cola', 'Pepsi']], 'OPCION_NO_EXISTE'],
    ['formato raro', [['En agua'], 'Coca-Cola'], 'OPCIONES_INCOMPLETAS'],
  ]) {
    test(`la web rechaza un pedido con ${nombre}`, async () => {
      await fallaCon(pedirWeb([{ slug: 'combo-prueba', cantidad: 1, ...(opciones ? { opciones } : {}) }]), codigo);
    });
  }

  test('no se pueden mandar opciones a un producto que no las tiene', async () => {
    await fallaCon(pedirWeb([{ slug: 'clasica', cantidad: 1, opciones: [['En leche']] }]), 'DATO_INVALIDO');
  });

  test('si el dueño quita una gaseosa de la lista, ya no se puede pedir', async () => {
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', 'Postobón Manzana'] } });
    await fallaCon(pedirWeb([{ slug: 'combo-prueba', cantidad: 1, opciones: [['En agua'], ['Pepsi', 'Coca-Cola']] }]), 'OPCION_NO_EXISTE');
    const r = await pedirWeb([{ slug: 'combo-prueba', cantidad: 1, opciones: [['En agua'], ['Postobón Manzana', 'Coca-Cola']] }]);
    assert.equal(r.total, 20000);
    await ctx.staff('bebidas_guardar', { p: { gaseosas: ['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'] } });
  });

  for (const [nombre, p] of [
    ['lista vacía', { gaseosas: [] }],
    ['repetidas', { gaseosas: ['Coca-Cola', 'Coca-Cola'] }],
    ['nombre vacío', { bebidas_michelada: ['Águila', ' '] }],
    ['no es lista', { gaseosas: 'Coca-Cola' }],
  ]) {
    test(`rechaza listas de bebidas inválidas: ${nombre}`, async () => {
      await fallaCon(ctx.staff('bebidas_guardar', { p }), 'DATO_INVALIDO');
    });
  }

  test('solo el personal cambia las listas de bebidas', async () => {
    await fallaCon(ctx.web('bebidas_guardar', { p: { gaseosas: ['Gratis'] } }), /permission denied|SIN_PERMISO/);
    await fallaCon(ctx.intruso('bebidas_guardar', { p: { gaseosas: ['Gratis'] } }), 'SIN_PERMISO');
  });

  test('la caja: con opciones se validan y cobran igual; sin opciones (app anterior) va el precio base', async () => {
    const datos = { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' };
    const conOpc = await ctx.staff('venta_registrar', { p_items: [{ slug: 'combo-prueba', cantidad: 1, opciones: [['En leche'], ['Ginger', 'Pepsi']] }], p_datos: datos });
    assert.equal(conOpc.total, 22000);
    const sinOpc = await ctx.staff('venta_registrar', { p_items: [{ slug: 'combo-prueba', cantidad: 1 }], p_datos: datos });
    assert.equal(sinOpc.total, 20000);
    await fallaCon(ctx.staff('venta_registrar', { p_items: [{ slug: 'combo-prueba', cantidad: 1, opciones: [['En leche'], ['Ron', 'Pepsi']] }], p_datos: datos }), 'OPCION_NO_EXISTE');
  });

  test('editar el producto sin mandar opciones las conserva', async () => {
    const menu = await ctx.staff('menu_admin', {});
    const p = menu.productos.find((x) => x.slug === 'combo-prueba');
    await ctx.staff('producto_guardar', { p: { id: p.id, categoria_id: cat, nombre: 'Combo Prueba', precio: 21000 } });
    const despues = (await ctx.staff('menu_admin', {})).productos.find((x) => x.slug === 'combo-prueba');
    assert.equal(despues.opciones.length, 2);
    assert.equal(despues.precio, 21000);
  });
});
