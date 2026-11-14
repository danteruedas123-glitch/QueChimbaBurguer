/**
 * Actualizaciones en Linux (Chromebook).
 * ChromeOS ya no deja instalar archivos .deb con doble clic, así que la app
 * se actualiza sola: descarga el instalador correcto para el procesador
 * (Intel/AMD = amd64, ARM = arm64), comprueba su huella sha512 contra la
 * publicada en GitHub y lo instala con apt (en el Chromebook no pide
 * contraseña). Si el equipo sí pide contraseña (Ubuntu normal), muestra los
 * comandos para hacerlo a mano.
 * Sin dependencias de Electron para poder probarlo con node:test.
 */
import { compararVersiones } from '../shared/utilidades.js';

export const URL_ULTIMA = 'https://api.github.com/repos/danteruedas123-glitch/QueChimbaBurguer/releases/latest';
const DESCARGAS = 'https://github.com/danteruedas123-glitch/QueChimbaBurguer/releases/download/';

/**
 * A partir de la respuesta de GitHub decide si hay versión nueva y qué archivo descargar.
 * @returns {{ estado: 'al-dia' } | { estado: 'disponible', nueva: string, url: string, archivo: string } | { estado: 'error', mensaje: string }}
 */
export function revisarPublicacion(publicacion, versionActual, arquitectura) {
  const nueva = String(publicacion?.tag_name ?? '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(nueva)) return { estado: 'error', mensaje: 'Respuesta inesperada de GitHub' };
  if (compararVersiones(nueva, versionActual) <= 0) return { estado: 'al-dia' };
  const archivo = `Quechimba-Pedidos-${nueva}-${arquitectura === 'arm64' ? 'arm64' : 'amd64'}.deb`;
  const url = (publicacion.assets ?? []).find((a) => a?.name === archivo)?.browser_download_url;
  // Solo se descarga de las publicaciones de GitHub del proyecto (nunca una dirección arbitraria)
  if (url !== `${DESCARGAS}v${nueva}/${archivo}`) return { estado: 'al-dia' }; // aún no hay instalador para este equipo
  return { estado: 'disponible', nueva, url, archivo };
}

/** Dirección del archivo con las huellas (lo publica electron-builder junto al .deb). */
export const urlManifiesto = (nueva, arquitectura) =>
  `${DESCARGAS}v${nueva}/latest-linux${arquitectura === 'arm64' ? '-arm64' : ''}.yml`;

/** Huella sha512 (base64) del archivo dentro del manifiesto, o null si no está. */
export function huellaDe(manifiesto, archivo) {
  const lineas = String(manifiesto ?? '').split(/\r?\n/);
  const i = lineas.findIndex((l) => l.trim() === `- url: ${archivo}`);
  if (i < 0) return null;
  for (const l of lineas.slice(i + 1, i + 4)) {
    const m = l.match(/^\s+sha512:\s*([A-Za-z0-9+/]{80,}={0,2})\s*$/);
    if (m) return m[1];
  }
  return null;
}

/** Comandos para actualizar a mano desde la Terminal (si apt pide contraseña). */
export const comandosManuales = (url, archivo) => [`wget ${url}`, `sudo apt install ./${archivo}`];

/**
 * Descarga el .deb, verifica su huella sha512 contra el manifiesto oficial y
 * lo instala con apt. Recibe `fetch` para poder usarse con Electron (net.fetch)
 * o con Node en las pruebas. Lanza un Error con `necesitaClave` si apt pide contraseña.
 */
export async function descargarEInstalar({ fetch, nueva, url, archivo, arquitectura, carpeta, alProgreso = () => {}, ejecutar }) {
  const { createHash } = await import('node:crypto');
  const { mkdir, writeFile, rm } = await import('node:fs/promises');
  const path = await import('node:path');
  const cab = { 'User-Agent': 'quechimba-pedidos' };

  const m = await fetch(urlManifiesto(nueva, arquitectura), { headers: cab });
  const huella = m.ok ? huellaDe(await m.text(), archivo) : null;
  if (!huella) throw new Error('No se encontró la huella de seguridad del instalador');

  const r = await fetch(url, { headers: cab });
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  const partes = [];
  let recibido = 0;
  let ultimo = 0;
  const lector = r.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    recibido += value.length;
    const progreso = total ? Math.floor((recibido / total) * 100) : 0;
    if (progreso >= ultimo + 5) { ultimo = progreso; alProgreso(progreso); }
  }
  const datos = Buffer.concat(partes);
  if (createHash('sha512').update(datos).digest('base64') !== huella) {
    throw new Error('El instalador descargado no coincide con el original; no se instaló nada');
  }

  const ruta = path.join(carpeta, archivo);
  await mkdir(carpeta, { recursive: true });
  await writeFile(ruta, datos);
  try {
    await ejecutar('sudo', ['-n', 'apt-get', 'install', '-y', '--allow-downgrades', ruta]);
  } finally {
    await rm(carpeta, { recursive: true, force: true }).catch(() => {});
  }
}

/** Ejecuta un programa sin pasar por la consola (sin riesgo de inyección) y avisa si sudo pide contraseña. */
export async function ejecutarSinConsola(programa, argumentos) {
  const { execFile } = await import('node:child_process');
  return new Promise((ok, mal) => {
    execFile(programa, argumentos, { timeout: 10 * 60_000 }, (error, _out, err) => {
      if (!error) return ok();
      const texto = String(err || error.message).trim();
      mal(Object.assign(new Error(texto.split('\n').pop()), { necesitaClave: /password|contraseña|a terminal is required/i.test(texto) }));
    });
  });
}
