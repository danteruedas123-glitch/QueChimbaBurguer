/**
 * Actualizaciones en Linux (Chromebook): el sistema no permite que la app se
 * reinstale sola, así que se revisa la última versión publicada en GitHub y,
 * si hay una nueva, se ofrece descargar el instalador .deb correcto para el
 * procesador del equipo (Intel/AMD = x64, ARM = arm64).
 * Sin dependencias de Electron para poder probarlo con node:test.
 */
import { compararVersiones } from '../shared/utilidades.js';

export const URL_ULTIMA = 'https://api.github.com/repos/danteruedas123-glitch/QueChimbaBurguer/releases/latest';

/**
 * A partir de la respuesta de GitHub decide si hay versión nueva y qué archivo descargar.
 * @returns {{ estado: 'al-dia' } | { estado: 'disponible', nueva: string, url: string } | { estado: 'error', mensaje: string }}
 */
export function revisarPublicacion(publicacion, versionActual, arquitectura) {
  const nueva = String(publicacion?.tag_name ?? '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(nueva)) return { estado: 'error', mensaje: 'Respuesta inesperada de GitHub' };
  if (compararVersiones(nueva, versionActual) <= 0) return { estado: 'al-dia' };
  const sufijo = `-${arquitectura === 'arm64' ? 'arm64' : 'x64'}.deb`;
  const archivo = (publicacion.assets ?? []).find((a) => typeof a?.name === 'string' && a.name.endsWith(sufijo));
  const url = archivo?.browser_download_url;
  // Solo se abren descargas de GitHub (nunca una dirección arbitraria)
  if (!url || !/^https:\/\/github\.com\/danteruedas123-glitch\/QueChimbaBurguer\/releases\/download\//.test(url)) {
    return { estado: 'al-dia' }; // la versión nueva aún no tiene instalador para este equipo
  }
  return { estado: 'disponible', nueva, url };
}
