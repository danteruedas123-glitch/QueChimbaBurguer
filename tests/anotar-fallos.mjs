/**
 * Convierte las pruebas fallidas (salida TAP de node --test) en anotaciones
 * de GitHub Actions (::error::), visibles en la página del flujo y en la API
 * pública, sin tener que abrir los registros completos.
 *   Uso: node tests/anotar-fallos.mjs resultados/*.tap
 */
import { readFileSync, existsSync } from 'node:fs';

const escapar = (t) => t.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');

let total = 0;
for (const archivo of process.argv.slice(2)) {
  if (!existsSync(archivo)) continue;
  const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^(\s*)not ok \d+ - (.+)$/);
    if (!m) continue;
    // Bloque YAML de detalles: líneas más indentadas hasta "..."
    const detalles = [];
    for (let j = i + 1; j < lineas.length && !/^\s*\.\.\.\s*$/.test(lineas[j]); j++) detalles.push(lineas[j].trim());
    const texto = detalles.join('\n');
    if (/failureType: 'subtestsFailed'/.test(texto)) continue; // el detalle está en la subprueba
    const error = (texto.match(/error: (?:\|-?\n)?([\s\S]*?)\n(?:code|name|stack|expected|actual|operator|location):/) ?? [])[1]
      ?? texto.slice(0, 600);
    const datos = ['expected', 'actual'].map((k) => (texto.match(new RegExp(`\\n${k}: (.*)`)) ?? [])[1]).filter(Boolean);
    const mensaje = `${error.trim().slice(0, 700)}${datos.length ? `\nesperado: ${datos[0]}\nobtenido: ${datos[1] ?? ''}` : ''}`;
    console.log(`::error title=${escapar(`[${archivo.split(/[\\/]/).pop()}] ${m[2]}`.slice(0, 200))}::${escapar(mensaje)}`);
    total++;
  }
}
console.log(`${total} prueba(s) fallida(s) anotada(s)`);
