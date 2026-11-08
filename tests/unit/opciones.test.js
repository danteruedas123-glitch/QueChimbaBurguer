import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aTexto, desdeTexto, eleccionValida, extraDe, detalleDe, claveLinea, leerLinea, opcionesDe } from '../../src/shared/opciones.js';
import { productosPlanos, BEBIDAS } from '../../supabase/menu.mjs';

const JUGO = { precio: 8000, opciones: [{ titulo: 'Preparación', elige: 1, opciones: [{ nombre: 'En agua', extra: 0 }, { nombre: 'En leche', extra: 2000 }] }] };
const COMBO = { precio: 45000, opciones: [{ titulo: 'Gaseosas', elige: 2, lista: 'gaseosas' }] };

describe('opciones al pedir', () => {
  test('el editor de texto ida y vuelta conserva TODAS las opciones del menú real', () => {
    for (const p of productosPlanos().filter((x) => x.opciones.length)) {
      assert.deepEqual(desdeTexto(aTexto(p.opciones)), p.opciones, p.slug);
    }
  });

  test('el texto se lee como lo escribiría el dueño', () => {
    assert.equal(aTexto(JUGO.opciones), 'Preparación: En agua, En leche +2.000');
    assert.deepEqual(desdeTexto('Tamaño: Pequeña, Grande + $3.500\nGaseosas x2: [gaseosas]\nBebida: [micheladas]'), [
      { titulo: 'Tamaño', elige: 1, opciones: [{ nombre: 'Pequeña', extra: 0 }, { nombre: 'Grande', extra: 3500 }] },
      { titulo: 'Gaseosas', elige: 2, lista: 'gaseosas' },
      { titulo: 'Bebida', elige: 1, lista: 'bebidas_michelada' },
    ]);
    assert.deepEqual(desdeTexto('   \n'), [], 'vacío = sin opciones');
  });

  for (const [nombre, texto, error] of [
    ['sin dos puntos', 'Preparación En agua', /formato/],
    ['una sola opción', 'Papas: Con papas +2000', /al menos 2/],
    ['repetidas', 'Papas: Sí, Sí', /repetidas/],
    ['precio con decimales', 'Papas: No, Sí +2.5', /pesos/],
    ['elige 9', 'Gaseosas x9: [gaseosas]', /1 a 5/],
    ['siete grupos', 'A: a, b\nB: a, b\nC: a, b\nD: a, b\nE: a, b\nF: a, b\nG: a, b', /6 grupos/],
  ]) {
    test(`el editor explica el error: ${nombre}`, () => assert.throws(() => desdeTexto(texto), error));
  }

  test('precio con extras, validez y detalle (mismo formato que el servidor)', () => {
    assert.equal(JUGO.precio + extraDe(JUGO, [['En leche']]), 10000);
    assert.ok(eleccionValida(COMBO, [['Coca-Cola', 'Pepsi']], BEBIDAS));
    assert.ok(!eleccionValida(COMBO, [['Coca-Cola']], BEBIDAS), 'faltó una gaseosa');
    assert.ok(!eleccionValida(COMBO, [['Coca-Cola', 'Whisky']], BEBIDAS), 'bebida inventada');
    assert.ok(eleccionValida({ precio: 1, opciones: [] }, null));
    assert.equal(detalleDe(COMBO, [['Coca-Cola', 'Pepsi']]), 'Gaseosas: Coca-Cola, Pepsi');
    assert.equal(opcionesDe({ lista: 'bebidas_michelada' }, BEBIDAS).length, 15);
  });

  test('cada línea del carrito separa lo elegido', () => {
    const clave = claveLinea('combo-melo', [['Coca-Cola', 'Pepsi']]);
    assert.notEqual(clave, claveLinea('combo-melo', [['Pepsi', 'Pepsi']]));
    assert.deepEqual(leerLinea(clave), { id: 'combo-melo', elegidas: [['Coca-Cola', 'Pepsi']] });
    assert.deepEqual(leerLinea('clasica'), { id: 'clasica', elegidas: null });
  });
});
