/**
 * Pruebas de CONTABILIDAD.
 * 1) Casos puntuales (zona horaria, redondeos, cancelaciones).
 * 2) Prueba por propiedades: cientos de pedidos aleatorios y un cálculo
 *    independiente en JavaScript que debe coincidir peso por peso con el
 *    reporte de la base de datos, más los invariantes contables.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon, pedidoHistorico } from '../helpers/bd.js';
import { hoyEn, sumarDias } from '../../src/shared/periodos.js';

const suma = (arr, k) => arr.reduce((s, x) => s + Number(x[k]), 0);

describe('casos puntuales', () => {
  let ctx;
  before(async () => { ctx = await nuevaBase(); });
  after(() => ctx.base.cerrar());
  const reporte = (desde, hasta = desde) => ctx.staff('reporte_ventas', { p_desde: desde, p_hasta: hasta });

  test('un pedido de las 11:59 p. m. cuenta para ese día; el de medianoche para el siguiente', async () => {
    // 04:59:59 UTC = 11:59:59 p. m. del día anterior en Bogotá (UTC−5)
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-15T04:59:59Z', lineas: [{ slug: 'clasica', cantidad: 1 }] });
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-15T05:00:00Z', lineas: [{ slug: 'quechimba', cantidad: 1 }] });
    assert.equal((await reporte('2026-10-14')).resumen.total, 18000);
    assert.equal((await reporte('2026-10-15')).resumen.total, 29000);
    const r = await reporte('2026-10-14', '2026-10-15');
    assert.deepEqual(r.por_dia.map((d) => [d.fecha, d.total]), [['2026-10-14', 18000], ['2026-10-15', 29000]]);
    assert.equal(r.por_hora.find((h) => h.hora === 23).total, 18000);
    assert.equal(r.por_hora.find((h) => h.hora === 0).total, 29000);
  });

  test('cancelados y pendientes se informan aparte y no suman ventas', async () => {
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-20T18:00:00Z', lineas: [{ slug: 'clasica', cantidad: 2 }] });
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-20T19:00:00Z', lineas: [{ slug: 'combo-x4', cantidad: 1 }], estado: 'cancelado' });
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-20T20:00:00Z', lineas: [{ slug: 'limonada', cantidad: 3 }], estado: 'preparando' });
    const r = await reporte('2026-10-20');
    assert.equal(r.resumen.total, 36000);
    assert.equal(r.resumen.pedidos, 1);
    assert.deepEqual(r.cancelados, { pedidos: 1, total: 85000 });
    assert.deepEqual(r.pendientes, { pedidos: 1, total: 21000 });
  });

  test('domicilios y descuentos se reflejan en el total', async () => {
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-21T18:00:00Z', lineas: [{ slug: 'quechimba', cantidad: 2 }], domicilio: 5000, descuento: 3000, entrega: 'domicilio' });
    const r = await reporte('2026-10-21');
    assert.deepEqual(
      { t: r.resumen.total, s: r.resumen.subtotal, d: r.resumen.domicilios, x: r.resumen.descuentos },
      { t: 60000, s: 58000, d: 5000, x: 3000 });
  });

  test('ticket promedio redondeado al peso', async () => {
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-22T18:00:00Z', lineas: [{ slug: 'te-helado', cantidad: 1 }] }); // 6000
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-22T18:10:00Z', lineas: [{ slug: 'limonada', cantidad: 1 }] }); // 7000
    await pedidoHistorico(ctx.admin, { creadoEn: '2026-10-22T18:20:00Z', lineas: [{ slug: 'limonada', cantidad: 1 }] }); // 7000
    assert.equal((await reporte('2026-10-22')).resumen.ticket_promedio, 6667); // 20000 / 3 = 6666,67
  });

  test('un día sin ventas devuelve ceros (no errores ni vacíos)', async () => {
    const r = await reporte('2026-01-01');
    assert.equal(r.resumen.total, 0);
    assert.equal(r.resumen.ticket_promedio, 0);
    assert.deepEqual(r.por_dia, [{ fecha: '2026-01-01', pedidos: 0, total: 0 }]);
    assert.equal(r.por_hora.length, 24);
    assert.deepEqual(r.por_producto, []);
  });

  test('valida el rango de fechas', async () => {
    await fallaCon(reporte('2026-10-10', '2026-10-01'), 'RANGO_INVALIDO');
    await fallaCon(reporte('2024-01-01', '2026-01-01'), 'RANGO_INVALIDO');
  });
});

describe('prueba por propiedades: 400 pedidos aleatorios', () => {
  let ctx;
  let pedidos;          // modelo esperado
  const DIAS = 40;
  const HOY = '2026-11-06';
  const DESDE = sumarDias(HOY, -(DIAS - 1));

  // Generador pseudoaleatorio con semilla fija: la prueba es reproducible
  let semilla = 20261106;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2 ** 31; return semilla / 2 ** 31; };
  const elegir = (arr) => arr[Math.floor(azar() * arr.length)];

  before(async () => {
    ctx = await nuevaBase();
    const prods = await ctx.admin(`select p.slug, p.nombre, p.precio, c.nombre categoria from public.productos p join public.categorias c on c.id = p.categoria_id`);
    pedidos = [];
    for (let i = 0; i < 400; i++) {
      // Instante aleatorio dentro de la ventana, en UTC (incluye madrugadas)
      const ms = Date.parse(`${DESDE}T05:00:00Z`) + Math.floor(azar() * DIAS * 86_400_000);
      const creadoEn = new Date(ms).toISOString();
      const lineas = Array.from({ length: 1 + Math.floor(azar() * 3) }, () => ({ ...elegir(prods), cantidad: 1 + Math.floor(azar() * 4) }));
      // Unificar slugs repetidos como haría el sistema real
      const unicas = Object.values(lineas.reduce((m, l) => {
        m[l.slug] = m[l.slug] ? { ...l, cantidad: m[l.slug].cantidad + l.cantidad } : l; return m;
      }, {}));
      const subtotal = unicas.reduce((s, l) => s + l.precio * l.cantidad, 0);
      const domicilio = elegir([0, 0, 3000, 5000]);
      const descuento = azar() < 0.15 ? Math.min(subtotal, 1000 * Math.floor(azar() * 6)) : 0;
      const r = azar();
      const estado = r < 0.72 ? 'entregado' : r < 0.84 ? 'cancelado' : elegir(['nuevo', 'preparando', 'listo']);
      const p = {
        creadoEn, lineas: unicas, estado, domicilio, descuento,
        canal: elegir(['local', 'whatsapp', 'web']), pago: elegir(['efectivo', 'nequi', 'daviplata', 'transferencia']),
        entrega: elegir(['domicilio', 'recoger', 'en_local']),
      };
      p.total = subtotal + domicilio - descuento;
      p.subtotal = subtotal;
      p.fecha = hoyEn('America/Bogota', new Date(ms));
      p.hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));
      await pedidoHistorico(ctx.admin, { ...p, lineas: unicas.map((l) => ({ slug: l.slug, cantidad: l.cantidad })) });
      pedidos.push(p);
    }
  });
  after(() => ctx.base.cerrar());

  /** Cálculo independiente en JavaScript de lo que el reporte debe decir */
  function esperado(desde, hasta) {
    const enRango = pedidos.filter((p) => p.fecha >= desde && p.fecha <= hasta);
    const ventas = enRango.filter((p) => p.estado === 'entregado');
    const agrupar = (arr, clave, valor = (p) => p.total) => {
      const m = {};
      for (const p of arr) {
        const k = clave(p);
        m[k] ??= { pedidos: 0, total: 0 };
        m[k].pedidos += 1;
        m[k].total += valor(p);
      }
      return m;
    };
    const items = ventas.flatMap((p) => p.lineas);
    const porProducto = {};
    for (const l of items) {
      porProducto[l.nombre] ??= { unidades: 0, total: 0 };
      porProducto[l.nombre].unidades += l.cantidad;
      porProducto[l.nombre].total += l.precio * l.cantidad;
    }
    const total = suma(ventas, 'total');
    return {
      resumen: {
        total, pedidos: ventas.length,
        subtotal: suma(ventas, 'subtotal'), domicilios: suma(ventas, 'domicilio'), descuentos: suma(ventas, 'descuento'),
        ticket_promedio: ventas.length ? Math.round(total / ventas.length) : 0,
        unidades: items.reduce((s, l) => s + l.cantidad, 0),
      },
      cancelados: { pedidos: enRango.filter((p) => p.estado === 'cancelado').length, total: suma(enRango.filter((p) => p.estado === 'cancelado'), 'total') },
      pendientes: {
        pedidos: enRango.filter((p) => ['nuevo', 'preparando', 'listo'].includes(p.estado)).length,
        total: suma(enRango.filter((p) => ['nuevo', 'preparando', 'listo'].includes(p.estado)), 'total'),
      },
      porMetodo: agrupar(ventas, (p) => p.pago),
      porCanal: agrupar(ventas, (p) => p.canal),
      porDia: agrupar(ventas, (p) => p.fecha),
      porHora: agrupar(ventas, (p) => p.hora),
      porProducto,
    };
  }

  const comoMapa = (arr, k) => Object.fromEntries(arr.map((x) => [x[k], { pedidos: x.pedidos, total: x.total }]));

  const RANGOS = [
    ['todo el período', DESDE, HOY],
    ['un día', sumarDias(HOY, -3), sumarDias(HOY, -3)],
    ['una semana', sumarDias(HOY, -13), sumarDias(HOY, -7)],
    ['el primer día (borde)', DESDE, DESDE],
    ['el último día (borde)', HOY, HOY],
    ['quincena', sumarDias(HOY, -20), sumarDias(HOY, -6)],
  ];

  for (const [nombre, desde, hasta] of RANGOS) {
    test(`reporte de ${nombre} coincide peso por peso con el cálculo independiente`, async () => {
      const r = await ctx.staff('reporte_ventas', { p_desde: desde, p_hasta: hasta });
      const e = esperado(desde, hasta);
      assert.deepEqual(r.resumen, e.resumen, 'resumen');
      assert.deepEqual(r.cancelados, e.cancelados, 'cancelados');
      assert.deepEqual(r.pendientes, e.pendientes, 'pendientes');
      assert.deepEqual(comoMapa(r.por_metodo_pago, 'metodo'), e.porMetodo, 'por método de pago');
      assert.deepEqual(comoMapa(r.por_canal, 'canal'), e.porCanal, 'por canal');
      const diasConVentas = Object.fromEntries(r.por_dia.filter((d) => d.pedidos > 0).map((d) => [d.fecha, { pedidos: d.pedidos, total: d.total }]));
      assert.deepEqual(diasConVentas, e.porDia, 'por día');
      const horasConVentas = Object.fromEntries(r.por_hora.filter((h) => h.pedidos > 0).map((h) => [h.hora, { pedidos: h.pedidos, total: h.total }]));
      assert.deepEqual(horasConVentas, e.porHora, 'por hora');
      assert.deepEqual(Object.fromEntries(r.por_producto.map((p) => [p.nombre, { unidades: p.unidades, total: p.total }])), e.porProducto, 'por producto');
    });

    test(`invariantes contables del reporte de ${nombre}`, async () => {
      const r = await ctx.staff('reporte_ventas', { p_desde: desde, p_hasta: hasta });
      const t = r.resumen.total;
      assert.equal(suma(r.por_metodo_pago, 'total'), t, 'Σ métodos de pago = total');
      assert.equal(suma(r.por_canal, 'total'), t, 'Σ canales = total');
      assert.equal(suma(r.por_entrega, 'total'), t, 'Σ tipos de entrega = total');
      assert.equal(suma(r.por_dia, 'total'), t, 'Σ días = total');
      assert.equal(suma(r.por_hora, 'total'), t, 'Σ horas = total');
      assert.equal(suma(r.por_producto, 'total'), r.resumen.subtotal, 'Σ productos = subtotal');
      assert.equal(suma(r.por_categoria, 'total'), r.resumen.subtotal, 'Σ categorías = subtotal');
      assert.equal(suma(r.por_producto, 'unidades'), r.resumen.unidades, 'Σ unidades');
      assert.equal(r.resumen.subtotal + r.resumen.domicilios - r.resumen.descuentos, t, 'subtotal + domicilios − descuentos = total');
      assert.equal(suma(r.por_dia, 'pedidos'), r.resumen.pedidos, 'Σ pedidos por día');
      assert.equal(r.por_dia.length, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1, 'un registro por cada día del rango');
      for (const k of ['por_producto', 'por_metodo_pago']) {
        const totales = r[k].map((x) => x.total);
        assert.deepEqual(totales, [...totales].sort((a, b) => b - a), `${k} ordenado de mayor a menor`);
      }
    });
  }

  test('dividir el período en días y sumarlos da exactamente el total del período', async () => {
    const total = (await ctx.staff('reporte_ventas', { p_desde: DESDE, p_hasta: HOY })).resumen.total;
    let acumulado = 0;
    for (let i = 0; i < DIAS; i++) {
      const d = sumarDias(DESDE, i);
      acumulado += (await ctx.staff('reporte_ventas', { p_desde: d, p_hasta: d })).resumen.total;
    }
    assert.equal(acumulado, total);
  });
});
