/**
 * Web en vivo (aviso por Realtime) y foto del producto destacado.
 * Como PGlite no trae Supabase Realtime, se instala un realtime.send()
 * falso que registra cada aviso para poder verificarlo.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase } from '../helpers/bd.js';

let ctx;
before(async () => {
  ctx = await nuevaBase();
  await ctx.base.db.exec(`
    create schema realtime;
    create table realtime.avisos (id serial, payload jsonb, evento text, tema text, privado boolean);
    create table realtime.falla (activa boolean);
    insert into realtime.falla values (false);
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language plpgsql as $$
    begin
      if (select activa from realtime.falla) then raise exception 'Realtime caído (simulado)'; end if;
      insert into realtime.avisos (payload, evento, tema, privado) values (payload, event, topic, private);
    end $$;`);
});
after(() => ctx.base.cerrar());
beforeEach(() => ctx.admin(`truncate realtime.avisos`));

const avisos = () => ctx.admin(`select payload, evento, tema, privado from realtime.avisos order by id`);
const producto = async (slug) => (await ctx.admin(`select id, categoria_id, nombre, precio, foto_url from public.productos where slug = $1`, [slug]))[0];

describe('aviso en vivo a la web', () => {
  test('cambiar un precio avisa por el canal público "menu-publico" sin enviar datos', async () => {
    const p = await producto('clasica');
    await ctx.staff('producto_guardar', { p: { ...p, precio: 19000 } });
    assert.deepEqual(await avisos(), [{ payload: { tabla: 'productos' }, evento: 'menu-cambio', tema: 'menu-publico', privado: false }]);
  });

  test('agotar, crear categoría y desactivar la web también avisan', async () => {
    const p = await producto('limonada');
    await ctx.staff('producto_guardar', { p: { ...p, agotado: true } });
    await ctx.staff('categoria_guardar', { p: { nombre: 'Postres' } });
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: false } });
    assert.deepEqual((await avisos()).map((a) => a.payload.tabla), ['productos', 'categorias', 'ajustes']);
    await ctx.staff('ajustes_guardar', { p: { pedidos_web_activos: true } });
  });

  test('un cambio masivo produce un solo aviso (no uno por fila)', async () => {
    await ctx.admin(`update public.productos set orden = orden`);
    assert.equal((await avisos()).length, 1);
  });

  test('los pedidos NO se anuncian por el canal público (son privados)', async () => {
    await ctx.web('crear_pedido_web', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_cliente: { nombre: 'Ana', tipo_entrega: 'recoger', metodo_pago: 'efectivo' } });
    await ctx.staff('venta_registrar', { p_items: [{ slug: 'clasica', cantidad: 1 }], p_datos: { canal: 'local', tipo_entrega: 'en_local', metodo_pago: 'efectivo' } });
    assert.deepEqual(await avisos(), []);
  });

  test('si Realtime falla, el cambio del menú se guarda igual', async () => {
    await ctx.admin(`update realtime.falla set activa = true`);
    const p = await producto('te-helado');
    await ctx.staff('producto_guardar', { p: { ...p, precio: 6500 } });
    assert.equal((await producto('te-helado')).precio, 6500);
    await ctx.admin(`update realtime.falla set activa = false`);
  });

  test('la web (anónimo) no puede disparar el aviso a mano', async () => {
    await assert.rejects(ctx.base.sql(`select public.tg_avisar_cambio_menu()`, [], { rol: 'anon' }), /permission denied|trigger functions can only be called as triggers/);
  });
});

describe('foto del producto destacado', () => {
  const destacadoWeb = async () => (await ctx.web('menu_publico', {})).destacado;

  test('al elegir otro producto, la web muestra la foto de ese producto (no la anterior)', async () => {
    assert.equal((await destacadoWeb()).foto_url, 'assets/img/promo-salchipapa.webp');
    const combo = await producto('combo-x4');
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: combo.id } });
    const d = await destacadoWeb();
    assert.equal(d.producto, 'combo-x4');
    assert.equal(d.foto_url, null, 'sin foto especial: la web usa la del producto');
  });

  test('cambiar solo el título conserva la foto', async () => {
    await ctx.staff('ajustes_guardar', { p: { foto_destacado_url: 'https://ejemplo.co/foto-especial.webp' } });
    await ctx.staff('ajustes_guardar', { p: { titulo_destacado: 'Para compartir' } });
    assert.equal((await destacadoWeb()).foto_url, 'https://ejemplo.co/foto-especial.webp');
  });

  test('una foto especial enviada junto con el producto se respeta', async () => {
    const q = await producto('quechimba');
    await ctx.staff('ajustes_guardar', { p: { producto_destacado_id: q.id, foto_destacado_url: 'https://ejemplo.co/otra.webp' } });
    assert.equal((await destacadoWeb()).foto_url, 'https://ejemplo.co/otra.webp');
  });
});
