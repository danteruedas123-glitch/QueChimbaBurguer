/**
 * El archivo de instalación en un paso (supabase/instalar_todo.sql) debe
 * estar sincronizado con las migraciones y funcionar en una base nueva.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { crearBaseVacia, DIR_SUPABASE } from '../../src/main/db-local.js';

const ARCHIVO = path.join(DIR_SUPABASE, 'instalar_todo.sql');

test('instalar_todo.sql contiene todas las migraciones actuales y la semilla', async () => {
  const unificado = await readFile(ARCHIVO, 'utf8');
  const migraciones = (await readdir(path.join(DIR_SUPABASE, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const f of migraciones) {
    const contenido = await readFile(path.join(DIR_SUPABASE, 'migrations', f), 'utf8');
    assert.ok(unificado.includes(contenido), `${f} desactualizada en instalar_todo.sql: corre "npm run sql:unificar"`);
  }
  assert.ok(unificado.includes(await readFile(path.join(DIR_SUPABASE, 'seed.sql'), 'utf8')), 'semilla desactualizada');
});

test('se instala de una sola vez en una base nueva y deja el menú listo', async () => {
  const base = await crearBaseVacia();
  await base.db.exec(await readFile(ARCHIVO, 'utf8'));
  const menu = await base.rpc('menu_publico', {}, { rol: 'anon' });
  assert.equal(menu.productos.length, 97, 'el menú real: 112 productos, 15 jugos ocultos hasta tener precio');
  assert.equal(menu.destacado.producto, 'salchichimba');
  await base.cerrar();
});
