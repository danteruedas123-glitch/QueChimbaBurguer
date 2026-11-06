/**
 * Une todas las migraciones + datos iniciales en un solo archivo para pegarlo
 * en el "SQL Editor" de Supabase (instalación en un paso, sin la CLI).
 *   npm run sql:unificar  →  supabase/instalar_todo.sql
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const migraciones = (await readdir(path.join(DIR, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();

let salida = `-- =====================================================================
-- Quechimba Burger · INSTALACIÓN COMPLETA (generado automáticamente)
-- Pegar TODO en Supabase → SQL Editor → Run. Ejecutar UNA sola vez en un
-- proyecto nuevo. Incluye: ${migraciones.length} migraciones + menú inicial.
-- No editar aquí: editar supabase/migrations y correr "npm run sql:unificar".
-- =====================================================================\n\n`;
for (const f of migraciones) {
  salida += `-- >>>>>>>>>> ${f}\n${await readFile(path.join(DIR, 'migrations', f), 'utf8')}\n\n`;
}
salida += `-- >>>>>>>>>> seed.sql\n${await readFile(path.join(DIR, 'seed.sql'), 'utf8')}\n`;
await writeFile(path.join(DIR, 'instalar_todo.sql'), salida);
console.log(`supabase/instalar_todo.sql creado (${migraciones.length} migraciones + semilla, ${salida.length.toLocaleString()} caracteres)`);
