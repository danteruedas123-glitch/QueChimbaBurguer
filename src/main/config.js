/**
 * Configuración de la conexión con Supabase.
 * Prioridad: archivo del usuario (AppData) → config.defecto.json (empaquetado).
 * Solo se guarda la URL y la llave PÚBLICA (anon). La llave service_role
 * jamás debe estar en la app: se rechaza explícitamente.
 */
import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFECTO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config.defecto.json');
const rutaUsuario = () => path.join(app.getPath('userData'), 'conexion.json');

async function leerJSON(ruta) {
  try { return JSON.parse(await readFile(ruta, 'utf8')); } catch { return {}; }
}

export async function leerConfig() {
  const base = await leerJSON(DEFECTO);
  const usuario = await leerJSON(rutaUsuario());
  return {
    supabaseUrl: usuario.supabaseUrl || base.supabaseUrl || '',
    supabaseAnonKey: usuario.supabaseAnonKey || base.supabaseAnonKey || '',
  };
}

/** Devuelve un mensaje de error o null si los datos son válidos. */
export function validarConexion({ supabaseUrl, supabaseAnonKey } = {}) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl ?? '')) {
    return 'La URL debe tener la forma https://xxxx.supabase.co';
  }
  const partes = String(supabaseAnonKey ?? '').split('.');
  if (partes.length !== 3 && !/^sb_publishable_/.test(supabaseAnonKey ?? '')) {
    return 'La llave pública (anon) no tiene un formato válido';
  }
  if (partes.length === 3) {
    try {
      const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
      if (carga.role === 'service_role') {
        return 'Esa es la llave secreta (service_role). Usa la llave pública "anon"; la secreta nunca debe ir en la app.';
      }
    } catch {
      return 'La llave pública (anon) no tiene un formato válido';
    }
  }
  if (/^sb_secret_/.test(supabaseAnonKey ?? '')) {
    return 'Esa es una llave secreta. Usa la llave pública.';
  }
  return null;
}

export async function guardarConfig({ supabaseUrl, supabaseAnonKey }) {
  await mkdir(path.dirname(rutaUsuario()), { recursive: true });
  await writeFile(rutaUsuario(), JSON.stringify({ supabaseUrl: supabaseUrl.replace(/\/$/, ''), supabaseAnonKey }, null, 2));
}
