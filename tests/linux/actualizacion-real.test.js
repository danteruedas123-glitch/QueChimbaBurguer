/**
 * Prueba REAL de la actualización en Linux (solo en GitHub Actions, Ubuntu):
 * igual que en el Chromebook, descarga de GitHub la última versión publicada,
 * verifica su huella e instala con `sudo -n apt-get` (sin contraseña).
 *   QB_PRUEBA_ACTUALIZACION=1 node --test tests/linux/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { URL_ULTIMA, revisarPublicacion, descargarEInstalar, ejecutarSinConsola } from '../../src/main/version-linux.js';

const ACTIVA = process.platform === 'linux' && process.env.QB_PRUEBA_ACTUALIZACION === '1';

test('la app descarga, verifica e instala sola la última versión publicada', { skip: !ACTIVA && 'solo en Linux de GitHub Actions' }, async () => {
  const r = await fetch(URL_ULTIMA, { headers: { 'User-Agent': 'quechimba-pedidos', Accept: 'application/vnd.github+json' } });
  assert.ok(r.ok, `GitHub respondió ${r.status}`);
  const info = revisarPublicacion(await r.json(), '0.0.0', process.arch);
  assert.equal(info.estado, 'disponible');
  const progresos = [];
  await descargarEInstalar({
    fetch, ...info, arquitectura: process.arch, carpeta: await mkdtemp(path.join(os.tmpdir(), 'qb-act-')),
    alProgreso: (p) => progresos.push(p), ejecutar: ejecutarSinConsola,
  });
  const instalada = execFileSync('dpkg-query', ['-W', '-f=${Version}', 'quechimba-pedidos']).toString().trim();
  assert.equal(instalada, info.nueva, 'quedó instalada la versión publicada');
  assert.ok(progresos.length > 3, 'mostró el avance de la descarga');
});
