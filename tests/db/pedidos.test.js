/**
 * Pruebas FUNCIONALES e de INTEGRIDAD de pedidos y ventas.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon, clienteWeb } from '../helpers/bd.js';
import { ESTADOS, transicionValida } from '../../src/shared/estados.js';

let ctx;
before(async () => { ctx = await nuevaBase(); });
after(() => ctx.base.cerrar());

const pedirWeb = (items, cliente = clienteWeb()) => ctx.web('crear_pedido_web', { p_items: items, p_cliente: cliente });
const venta = (items, datos = {}) => ctx.staff('venta_registrar', {
  p_items: items, p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo', ...datos },
});
const ultimo = async () => (await ctx.admin(`select * from public.pedidos order by numero desc limit 1`))[0];

describe('pedido desde la web', () => {
  test('usa los precios del servidor aunque el cliente envíe otros', async () => {
    const r = await pedirWeb([{ slug: 'quechimba', cantidad: 2, precio: 1, precio_unitario: 1 }]);
    assert.equal(r.total, 58000);
    assert.equal(r.items[0].precio_unitario, 29000);
  });
  test('suma las líneas repetidas del mismo producto', async () => {
    const r = await pedirWeb([{ slug: 'limonada', cantidad: 1 }, { slug: 'limonada', cantidad: 2 }]);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].cantidad, 3);
    assert.equal(r.total, 21000);
  });
  test('el número de pedido es consecutivo y único', async () => {
    const a = await pedirWeb([{ slug: 'clasica', cantidad: 1 }]);
    const b = await pedirWeb([{ slug: 'clasica', cantidad: 1 }]);
    assert.equal(b.numero, a.numero + 1);
  });
  test('queda pendiente (nuevo), con su bitácora', async () => {
    await pedirWeb([{ slug: 'clasica', cantidad: 1 }]);
    const p = await ultimo();
    assert.equal(p.estado, 'nuevo');
    assert.equal(p.canal, 'web');
    const ev = await ctx.admin(`select * from public.pedido_eventos where pedido_id = $1`, [p.id]);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].estado_nuevo, 'nuevo');
  });
  test('guarda el texto tal cual (sin ejecutar código ni SQL)', async () => {
    const malicioso = `Robert'); drop table pedidos;-- <script>alert(1)</script>`.slice(0, 60);
    await pedirWeb([{ slug: 'clasica', cantidad: 1 }], clienteWeb({ nombre: malicioso }));
    const p = await ultimo();
    assert.equal(p.cliente_nombre, malicioso);
    assert.ok((await ctx.admin(`select count(*)::int n from public.pedidos`))[0].n > 0);
  });

  const invalidos = [
    ['sin productos', [], clienteWeb(), 'PEDIDO_VACIO'],
    ['items no es lista', { slug: 'clasica' }, clienteWeb(), 'PEDIDO_VACIO'],
    ['cantidad cero', [{ slug: 'clasica', cantidad: 0 }], clienteWeb(), 'DATO_INVALIDO'],
    ['cantidad negativa', [{ slug: 'clasica', cantidad: -3 }], clienteWeb(), 'DATO_INVALIDO'],
    ['cantidad decimal', [{ slug: 'clasica', cantidad: 1.5 }], clienteWeb(), 'DATO_INVALIDO'],
    ['cantidad como texto', [{ slug: 'clasica', cantidad: '2' }], clienteWeb(), 'DATO_INVALIDO'],
    ['más de 99 sumando líneas', [{ slug: 'clasica', cantidad: 60 }, { slug: 'clasica', cantidad: 50 }], clienteWeb(), 'DATO_INVALIDO'],
    ['producto inexistente', [{ slug: 'pizza-hawaiana', cantidad: 1 }], clienteWeb(), 'PRODUCTO_NO_EXISTE'],
    ['sin nombre', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ nombre: '   ' }), 'DATO_INVALIDO'],
    ['nombre muy largo', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ nombre: 'x'.repeat(61) }), 'DATO_INVALIDO'],
    ['domicilio sin dirección', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ direccion: '' }), 'DATO_INVALIDO'],
    ['método de pago inventado', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ metodo_pago: 'bitcoin' }), 'DATO_INVALIDO'],
    ['entrega "en el local" desde la web', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ tipo_entrega: 'en_local' }), 'DATO_INVALIDO'],
    ['teléfono inválido', [{ slug: 'clasica', cantidad: 1 }], clienteWeb({ telefono: 'llámame' }), 'DATO_INVALIDO'],
    ['sin datos de cliente', [{ slug: 'clasica', cantidad: 1 }], null, 'DATO_INVALIDO'],
  ];
  for (const [nombre, items, cliente, codigo] of invalidos) {
    test(`rechaza: ${nombre}`, async () => {
      const antes = (await ctx.admin(`select count(*)::int n from public.pedidos`))[0].n;
      await fallaCon(pedirWeb(items, cliente), codigo);
      const despues = (await ctx.admin(`select count(*)::int n from public.pedidos`))[0].n;
      assert.equal(despues, antes, 'no debe quedar ningún pedido a medias');
    });
  }

  test('rechaza productos ocultos o agotados', async () => {
    await ctx.admin(`update public.productos set agotado = true where slug = 'aros-cebolla'`);
    await ctx.admin(`update public.productos set activo = false where slug = 'te-helado'`);
    await fallaCon(pedirWeb([{ slug: 'aros-cebolla', cantidad: 1 }]), 'PRODUCTO_NO_DISPONIBLE');
    await fallaCon(pedirWeb([{ slug: 'te-helado', cantidad: 1 }]), 'PRODUCTO_NO_DISPONIBLE');
    await ctx.admin(`update public.productos set agotado = false, activo = true where slug in ('aros-cebolla', 'te-helado')`);
  });
  test('respeta la pausa de pedidos en línea', async () => {
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: false } });
    await fallaCon(pedirWeb([{ slug: 'clasica', cantidad: 1 }]), 'PEDIDOS_PAUSADOS');
    assert.equal((await ctx.web('menu_publico', {})).pedidos_web_activos, false);
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: true } });
  });
});

describe('ventas registradas por el encargado', () => {
  test('venta de mostrador queda entregada con totales exactos', async () => {
    const v = await venta([{ slug: 'clasica', cantidad: 2 }, { slug: 'jugo-mango', cantidad: 1 }], { descuento: 3000 });
    assert.equal(v.estado, 'entregado');
    assert.equal(v.subtotal, 43000);
    assert.equal(v.total, 40000);
    assert.ok(v.entregado_en);
  });
  test('venta por WhatsApp a domicilio enviada a cocina', async () => {
    const v = await venta([{ slug: 'combo-x4', cantidad: 1 }], {
      canal: 'whatsapp', tipo_entrega: 'domicilio', metodo_pago: 'nequi', costo_domicilio: 5000, entregado: false,
    });
    assert.equal(v.estado, 'nuevo');
    assert.equal(v.total, 90000);
  });
  test('rechaza descuento mayor que el total', async () => {
    await fallaCon(venta([{ slug: 'clasica', cantidad: 1 }], { descuento: 18001 }), 'DATO_INVALIDO');
  });
  test('rechaza registrar como "web"', async () => {
    await fallaCon(venta([{ slug: 'clasica', cantidad: 1 }], { canal: 'web' }), 'DATO_INVALIDO');
  });
  test('puede vender productos agotados (decisión del encargado)', async () => {
    await ctx.admin(`update public.productos set agotado = true where slug = 'perro-ranchero'`);
    const v = await venta([{ slug: 'perro-ranchero', cantidad: 1 }]);
    assert.equal(v.total, 15000);
    await ctx.admin(`update public.productos set agotado = false where slug = 'perro-ranchero'`);
  });
});

describe('estados e integridad', () => {
  test('la máquina de estados de la app y la de la base de datos son idénticas', async () => {
    for (const a of ESTADOS) {
      for (const b of ESTADOS) {
        const [{ r }] = await ctx.admin(`select public.transicion_valida($1::public.estado_pedido, $2::public.estado_pedido) r`, [a, b]);
        assert.equal(r, transicionValida(a, b), `${a} → ${b}`);
      }
    }
  });
  test('flujo completo nuevo → preparando → listo → entregado con bitácora', async () => {
    await pedirWeb([{ slug: 'quechimba', cantidad: 1 }]);
    const { id } = await ultimo();
    for (const e of ['preparando', 'listo', 'entregado']) {
      const p = await ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: e });
      assert.equal(p.estado, e);
    }
    const ev = await ctx.admin(`select estado_anterior, estado_nuevo, usuario_id from public.pedido_eventos where pedido_id = $1 order by id`, [id]);
    assert.deepEqual(ev.map((x) => x.estado_nuevo), ['nuevo', 'preparando', 'listo', 'entregado']);
    assert.equal(ev[3].usuario_id, ctx.staffId, 'la bitácora registra quién hizo el cambio');
  });
  test('no se puede retroceder ni revivir un cancelado', async () => {
    await pedirWeb([{ slug: 'quechimba', cantidad: 1 }]);
    const { id } = await ultimo();
    await ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: 'listo' });
    await fallaCon(ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: 'preparando' }), 'TRANSICION_INVALIDA');
    await ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: 'cancelado', p_motivo: 'Cliente no contestó' });
    await fallaCon(ctx.staff('pedido_cambiar_estado', { p_id: id, p_estado: 'entregado' }), 'TRANSICION_INVALIDA');
  });
  test('anular un pedido entregado exige motivo y conserva su historial', async () => {
    const v = await venta([{ slug: 'clasica', cantidad: 1 }]);
    await fallaCon(ctx.staff('pedido_cambiar_estado', { p_id: v.id, p_estado: 'cancelado' }), /motivo/);
    const p = await ctx.staff('pedido_cambiar_estado', { p_id: v.id, p_estado: 'cancelado', p_motivo: 'Se cobró dos veces' });
    assert.equal(p.estado, 'cancelado');
    assert.ok(p.entregado_en && p.cancelado_en);
    assert.equal(p.motivo_cancelacion, 'Se cobró dos veces');
  });
  test('un pedido cerrado no admite cambios de productos ni de valores', async () => {
    const v = await venta([{ slug: 'clasica', cantidad: 1 }]);
    await fallaCon(ctx.admin(`update public.pedido_items set cantidad = 5 where pedido_id = $1`, [v.id]), /cerrado/);
    await fallaCon(ctx.admin(`insert into public.pedido_items (pedido_id, nombre_producto, precio_unitario, cantidad) values ($1, 'X', 1, 1)`, [v.id]), /cerrado/);
    await fallaCon(ctx.staff('pedido_actualizar_cobro', { p_id: v.id, p: { descuento: 1000 } }), 'PEDIDO_CERRADO');
    await fallaCon(ctx.admin(`update public.pedidos set costo_domicilio = 9999 where id = $1`, [v.id]), /solo se puede anular/);
  });
  test('el subtotal no se puede alterar a mano, siempre coincide con los productos', async () => {
    await pedirWeb([{ slug: 'clasica', cantidad: 2 }]);
    const { id } = await ultimo();
    await fallaCon(ctx.admin(`update public.pedidos set subtotal = 1 where id = $1`, [id]), /se calcula/);
    await fallaCon(ctx.admin(`insert into public.pedidos (canal, tipo_entrega, metodo_pago, subtotal) values ('local','en_local','efectivo', 500)`), /se calcula/);
    const [{ inconsistentes }] = await ctx.admin(`
      select count(*)::int inconsistentes from public.pedidos p
      where p.subtotal <> (select coalesce(sum(subtotal), 0) from public.pedido_items i where i.pedido_id = p.id)
         or p.total <> p.subtotal + p.costo_domicilio - p.descuento`);
    assert.equal(inconsistentes, 0);
  });
  test('ajustar domicilio y descuento antes de entregar recalcula el total', async () => {
    await pedirWeb([{ slug: 'combo-quechimba', cantidad: 1 }]);
    const { id } = await ultimo();
    const p = await ctx.staff('pedido_actualizar_cobro', { p_id: id, p: { costo_domicilio: 4000, descuento: 2000, metodo_pago: 'efectivo' } });
    assert.equal(p.total, 38000 + 4000 - 2000);
    assert.equal(p.metodo_pago, 'efectivo');
    await fallaCon(ctx.staff('pedido_actualizar_cobro', { p_id: id, p: { descuento: 999999 } }), 'DATO_INVALIDO');
  });
  test('cambiar el precio del menú no altera ventas anteriores', async () => {
    const v = await venta([{ slug: 'te-helado', cantidad: 2 }]);
    const [prod] = await ctx.admin(`select id, categoria_id from public.productos where slug = 'te-helado'`);
    await ctx.staff('producto_guardar', { p: { id: prod.id, categoria_id: prod.categoria_id, nombre: 'Té helado', precio: 9000 } });
    const [despues] = await ctx.admin(`select total from public.pedidos where id = $1`, [v.id]);
    assert.equal(despues.total, 12000);
  });
});
