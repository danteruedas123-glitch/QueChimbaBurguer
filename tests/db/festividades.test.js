/**
 * Festividades y aniversario automático.
 * Las fechas se simulan llamando _tema_efectivo(p_hoy) para probar el
 * calendario completo (cambios de año, 29 de febrero, etc.).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaBase, fallaCon } from '../helpers/bd.js';
import { FESTIVIDADES } from '../../src/shared/festividades.js';

let ctx;
before(async () => { ctx = await nuevaBase(); });
after(() => ctx.base.cerrar());

const guardar = (p) => ctx.staff('ajustes_guardar', { p });
const efectivo = async (fecha) => (await ctx.admin(`select public._tema_efectivo($1::date) r`, [fecha]))[0].r;
const anioActual = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date()));
const fijarAniversario = (dia, mes, fundacion) =>
  ctx.admin(`update public.ajustes set aniversario_dia = $1, aniversario_mes = $2, aniversario_fundacion = $3`, [dia, mes, fundacion]);

describe('festividades', () => {
  test('por defecto la web está en tema normal', async () => {
    assert.deepEqual((await ctx.web('menu_publico', {})).festividad, { tema: 'normal', variante: null, numero: null, automatico: false });
  });

  test('elegir Halloween lo publica en la web con un diseño que rota cada año', async () => {
    await guardar({ tema: 'halloween' });
    const f = (await ctx.web('menu_publico', {})).festividad;
    assert.equal(f.tema, 'halloween');
    assert.equal(f.variante, (anioActual % 3) + 1);
    assert.equal((await efectivo('2026-10-31')).variante, (2026 % 3) + 1);
    assert.equal((await efectivo('2027-10-31')).variante, (2027 % 3) + 1, 'otro año, otro diseño');
    assert.notEqual((await efectivo('2026-10-31')).variante, (await efectivo('2027-10-31')).variante);
  });

  test('el dueño puede fijar un diseño; al cambiar de festividad vuelve a automático', async () => {
    await guardar({ tema: 'halloween', tema_variante: 2 });
    assert.equal((await efectivo('2027-10-31')).variante, 2);
    await guardar({ tema: 'navidad' });
    const f = await efectivo('2027-12-24');
    assert.equal(f.tema, 'navidad');
    assert.equal(f.variante, (2027 % 3) + 1, 'nueva festividad: diseño automático');
  });

  for (const [nombre, p, codigo] of [
    ['festividad inexistente', { tema: 'carnaval_de_rio' }, 'DATO_INVALIDO'],
    ['diseño 4', { tema_variante: 4 }, 'DATO_INVALIDO'],
    ['diseño decimal', { tema_variante: 1.5 }, 'DATO_INVALIDO'],
    ['aniversario sin registrar la fecha', { tema: 'aniversario' }, 'ANIVERSARIO_SIN_FECHA'],
  ]) {
    test(`rechaza ${nombre}`, async () => { await fallaCon(guardar(p), codigo); });
  }

  test('la base de datos acepta exactamente las festividades de la app', async () => {
    await ctx.admin(`update public.ajustes set aniversario_dia = 1, aniversario_mes = 1, aniversario_fundacion = 2020`);
    for (const { id } of FESTIVIDADES) {
      const r = await guardar({ tema: id });
      assert.equal(r.tema, id);
    }
    await ctx.admin(`update public.ajustes set aniversario_dia = null, aniversario_mes = null, aniversario_fundacion = null, tema = 'normal'`);
  });

  test('volver a "normal" quita el tema de la web', async () => {
    await guardar({ tema: 'normal' });
    assert.equal((await ctx.web('menu_publico', {})).festividad.tema, 'normal');
  });
});

describe('aniversario', () => {
  test('se registra día, mes y número de ESTE año; se calcula el año de fundación', async () => {
    const r = await guardar({ aniversario: { dia: 15, mes: 3, numero: 3 } });
    assert.equal(r.aniversario_dia, 15);
    assert.equal(r.aniversario_mes, 3);
    assert.equal(r.aniversario_fundacion, anioActual - 3);
  });

  for (const [nombre, a] of [
    ['31 de febrero', { dia: 31, mes: 2, numero: 1 }],
    ['mes 13', { dia: 1, mes: 13, numero: 1 }],
    ['número 0', { dia: 1, mes: 1, numero: 0 }],
    ['número como texto', { dia: 1, mes: 1, numero: '3' }],
  ]) {
    test(`rechaza fecha inválida: ${nombre}`, async () => { await fallaCon(guardar({ aniversario: a }), 'DATO_INVALIDO'); });
  }

  test('se activa SOLO durante 7 días desde el día del aniversario, con el número correcto cada año', async () => {
    await guardar({ tema: 'normal' });
    await fijarAniversario(15, 3, 2023); // fundado el 15 de marzo de 2023
    assert.equal((await efectivo('2026-03-14')).tema, 'normal', 'el día antes, nada');
    assert.deepEqual(await efectivo('2026-03-15'), { tema: 'aniversario', variante: (3 % 3) + 1, numero: 3, automatico: true });
    assert.equal((await efectivo('2026-03-21')).numero, 3, 'séptimo día: sigue');
    assert.equal((await efectivo('2026-03-22')).tema, 'normal', 'octavo día: termina');
    const siguiente = await efectivo('2027-03-15');
    assert.equal(siguiente.numero, 4, 'el año siguiente cumple 4 solo');
    assert.notEqual(siguiente.variante, (await efectivo('2026-03-15')).variante, 'y con otro diseño');
    assert.equal((await efectivo('2033-03-16')).numero, 10);
  });

  test('el aniversario automático tiene prioridad sobre la festividad elegida y luego la devuelve', async () => {
    await guardar({ tema: 'halloween' });
    assert.equal((await efectivo('2026-03-16')).tema, 'aniversario');
    assert.equal((await efectivo('2026-03-25')).tema, 'halloween');
  });

  test('una semana de aniversario que cruza el año nuevo funciona (28 de diciembre)', async () => {
    await guardar({ tema: 'normal' });
    await fijarAniversario(28, 12, 2020);
    assert.deepEqual([await efectivo('2026-12-31'), await efectivo('2027-01-03')].map((f) => [f.tema, f.numero]),
      [['aniversario', 6], ['aniversario', 6]], 'del 28 dic 2026 al 3 ene 2027 se celebran los 6 años');
    assert.equal((await efectivo('2027-01-04')).tema, 'normal');
  });

  test('29 de febrero: en años no bisiestos se celebra el 28', async () => {
    await fijarAniversario(29, 2, 2024);
    assert.equal((await efectivo('2027-02-28')).numero, 3);
    assert.equal((await efectivo('2027-02-27')).tema, 'normal');
    assert.equal((await efectivo('2028-02-29')).numero, 4);
  });

  test('activarlo a mano fuera de su semana muestra el último número cumplido', async () => {
    await fijarAniversario(15, 3, 2023);
    await guardar({ tema: 'aniversario' });
    assert.deepEqual([(await efectivo('2026-11-07')).tema, (await efectivo('2026-11-07')).numero], ['aniversario', 3]);
    assert.equal((await efectivo('2026-02-01')).numero, 2, 'antes del aniversario de este año: el del año pasado');
    assert.equal((await efectivo('2026-11-07')).automatico, false);
  });

  test('antes del primer aniversario no se activa solo; a mano muestra el que viene', async () => {
    await guardar({ tema: 'normal' });
    await fijarAniversario(1, 6, 2026); // abrieron el 1 de junio de 2026
    assert.equal((await efectivo('2026-06-01')).tema, 'normal', 'el día que abrieron no es aniversario');
    assert.equal((await efectivo('2027-06-01')).numero, 1, 'al año siguiente: primer aniversario');
    await guardar({ tema: 'aniversario' });
    assert.equal((await efectivo('2026-11-07')).numero, 1);
  });

  test('borrar la fecha del aniversario quita su tema', async () => {
    await guardar({ tema: 'aniversario' });
    const r = await guardar({ aniversario: null });
    assert.equal(r.tema, 'normal');
    assert.equal(r.aniversario_mes, null);
  });

  test('las funciones internas del calendario no se pueden llamar desde la web', async () => {
    for (const sql of ['select public._tema_efectivo()', 'select public._fecha_aniversario(2026, 1, 1)']) {
      await fallaCon(ctx.base.sql(sql, [], { rol: 'anon' }), /permission denied/);
    }
  });
});
