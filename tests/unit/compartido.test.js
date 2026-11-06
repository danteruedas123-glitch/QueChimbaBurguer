import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatearCOP, parsearCOP, variacion } from '../../src/shared/dinero.js';
import {
  hoyEn, sumarDias, diasEnRango, inicioSemana, inicioMes, finMes, rangoPeriodo, rangoAnterior,
  validarRango, etiquetaRango, horaLocal,
} from '../../src/shared/periodos.js';
import { transicionValida, siguienteEstado, ESTADOS } from '../../src/shared/estados.js';
import { escapar, compararVersiones, calcularTicket, mensajeError } from '../../src/shared/utilidades.js';

describe('dinero', () => {
  test('formatea pesos sin decimales', () => {
    assert.equal(formatearCOP(29000), '$29.000');
    assert.equal(formatearCOP(1234567), '$1.234.567');
    assert.equal(formatearCOP(0), '$0');
    assert.equal(formatearCOP(-5000), '-$5.000');
    assert.equal(formatearCOP('abc'), '$0');
  });
  test('parsea montos escritos por el usuario', () => {
    assert.equal(parsearCOP('29.000'), 29000);
    assert.equal(parsearCOP('$ 29.000'), 29000);
    assert.equal(parsearCOP('29000'), 29000);
    assert.equal(parsearCOP(18000), 18000);
    assert.equal(parsearCOP('0'), 0);
  });
  test('rechaza montos inválidos', () => {
    for (const malo of ['', '29,5', '2.90', '-100', 'abc', '1.2.3', 12.5, -1, null, undefined, '29.0000']) {
      assert.equal(parsearCOP(malo), null, `debería rechazar ${malo}`);
    }
  });
  test('variación porcentual', () => {
    assert.equal(variacion(150, 100), 50);
    assert.equal(variacion(50, 100), -50);
    assert.equal(variacion(100, 0), null);
    assert.equal(variacion(1, 3), -66.7);
  });
});

describe('periodos (hora de Colombia)', () => {
  test('hoy en Bogotá no depende de la zona del computador', () => {
    // 03:30 UTC del 6 de nov = 22:30 del 5 de nov en Bogotá
    assert.equal(hoyEn('America/Bogota', new Date('2026-11-06T03:30:00Z')), '2026-11-05');
    assert.equal(hoyEn('America/Bogota', new Date('2026-11-06T05:00:00Z')), '2026-11-06');
  });
  test('aritmética de fechas, incluidos cambios de mes y año bisiesto', () => {
    assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
    assert.equal(sumarDias('2026-01-01', -1), '2025-12-31');
    assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
    assert.equal(diasEnRango({ desde: '2026-11-01', hasta: '2026-11-30' }), 30);
    assert.equal(finMes('2028-02-10'), '2028-02-29');
    assert.equal(finMes('2026-12-05'), '2026-12-31');
    assert.equal(inicioMes('2026-11-06'), '2026-11-01');
  });
  test('la semana empieza el lunes', () => {
    assert.equal(inicioSemana('2026-11-06'), '2026-11-02'); // viernes → lunes
    assert.equal(inicioSemana('2026-11-08'), '2026-11-02'); // domingo → lunes anterior
    assert.equal(inicioSemana('2026-11-02'), '2026-11-02');
  });
  test('rangos predefinidos', () => {
    const hoy = '2026-11-06';
    assert.deepEqual(rangoPeriodo('hoy', hoy), { desde: hoy, hasta: hoy });
    assert.deepEqual(rangoPeriodo('ayer', hoy), { desde: '2026-11-05', hasta: '2026-11-05' });
    assert.deepEqual(rangoPeriodo('semana', hoy), { desde: '2026-11-02', hasta: hoy });
    assert.deepEqual(rangoPeriodo('semana_anterior', hoy), { desde: '2026-10-26', hasta: '2026-11-01' });
    assert.deepEqual(rangoPeriodo('mes', hoy), { desde: '2026-11-01', hasta: hoy });
    assert.deepEqual(rangoPeriodo('mes_anterior', hoy), { desde: '2026-10-01', hasta: '2026-10-31' });
    assert.deepEqual(rangoPeriodo('mes_anterior', '2026-03-15'), { desde: '2026-02-01', hasta: '2026-02-28' });
    assert.throws(() => rangoPeriodo('siglo', hoy));
  });
  test('período anterior de igual duración y sin solaparse', () => {
    assert.deepEqual(rangoAnterior({ desde: '2026-11-02', hasta: '2026-11-08' }), { desde: '2026-10-26', hasta: '2026-11-01' });
    assert.deepEqual(rangoAnterior({ desde: '2026-11-06', hasta: '2026-11-06' }), { desde: '2026-11-05', hasta: '2026-11-05' });
  });
  test('validación de rangos personalizados', () => {
    assert.equal(validarRango({ desde: '2026-11-01', hasta: '2026-11-06' }), null);
    assert.match(validarRango({ desde: '2026-11-06', hasta: '2026-11-01' }), /anterior/);
    assert.match(validarRango({ desde: '2026-02-30', hasta: '2026-03-01' }), /válidas/);
    assert.match(validarRango({ desde: '2024-01-01', hasta: '2026-01-01' }), /año/);
  });
  test('textos legibles', () => {
    assert.equal(etiquetaRango({ desde: '2026-11-06', hasta: '2026-11-06' }), '6 nov 2026');
    assert.equal(etiquetaRango({ desde: '2026-11-01', hasta: '2026-11-06' }), '1 nov – 6 nov 2026');
    assert.equal(etiquetaRango({ desde: '2025-12-29', hasta: '2026-01-04' }), '29 dic 2025 – 4 ene 2026');
    assert.match(horaLocal('2026-11-06T00:45:00Z'), /^7:45/); // 7:45 p. m. en Bogotá
  });
});

describe('estados de pedido', () => {
  test('flujo normal y cancelación', () => {
    assert.ok(transicionValida('nuevo', 'preparando'));
    assert.ok(transicionValida('nuevo', 'entregado'));
    assert.ok(transicionValida('listo', 'cancelado'));
    assert.ok(transicionValida('entregado', 'cancelado'));
    assert.ok(!transicionValida('preparando', 'nuevo'));
    assert.ok(!transicionValida('cancelado', 'nuevo'));
    assert.ok(!transicionValida('entregado', 'listo'));
    assert.ok(!transicionValida('nuevo', 'nuevo'));
    assert.ok(!transicionValida('nuevo', 'inventado'));
  });
  test('siguiente paso', () => {
    assert.equal(siguienteEstado('nuevo'), 'preparando');
    assert.equal(siguienteEstado('listo'), 'entregado');
    assert.equal(siguienteEstado('entregado'), null);
    assert.equal(siguienteEstado('cancelado'), null);
    assert.equal(ESTADOS.length, 5);
  });
});

describe('utilidades', () => {
  test('escapa HTML peligroso', () => {
    assert.equal(escapar('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(escapar("O'Neil & Co"), 'O&#39;Neil &amp; Co');
    assert.equal(escapar(null), '');
  });
  test('compara versiones numéricamente', () => {
    assert.equal(compararVersiones('1.2.10', '1.2.9'), 1);
    assert.equal(compararVersiones('1.0.0', '1.0.0'), 0);
    assert.equal(compararVersiones('0.9.9', '1.0.0'), -1);
    assert.equal(compararVersiones('2.0', '1.9.9'), 1);
  });
  test('calcula tickets con enteros y rechaza datos inválidos', () => {
    assert.deepEqual(calcularTicket([{ precio: 29000, cantidad: 2 }, { precio: 7000, cantidad: 1 }], { domicilio: 4000, descuento: 5000 }),
      { subtotal: 65000, total: 64000 });
    assert.throws(() => calcularTicket([{ precio: 1000, cantidad: 0 }]));
    assert.throws(() => calcularTicket([{ precio: 10.5, cantidad: 1 }]));
    assert.throws(() => calcularTicket([{ precio: 1000, cantidad: 1 }], { descuento: 2000 }), /descuento/);
  });
  test('mensajes de error comprensibles', () => {
    assert.match(mensajeError({ hint: 'SIN_PERMISO', message: 'x' }), /permiso/);
    assert.equal(mensajeError({ hint: 'DATO_INVALIDO', message: 'Falta el nombre' }), 'Falta el nombre');
    assert.match(mensajeError(new Error('Failed to fetch')), /conexión/);
    assert.match(mensajeError({ message: 'Invalid login credentials' }), /incorrectos/);
  });
});
