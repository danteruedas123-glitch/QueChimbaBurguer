/**
 * Versión para Chromebook (Linux): avisos de actualización y empaquetado.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { revisarPublicacion } from '../../src/main/version-linux.js';

const BASE = 'https://github.com/danteruedas123-glitch/QueChimbaBurguer/releases/download/v1.5.0/';
const publicacion = {
  tag_name: 'v1.5.0',
  assets: [
    { name: 'Quechimba-Pedidos-Setup-1.5.0.exe', browser_download_url: `${BASE}Quechimba-Pedidos-Setup-1.5.0.exe` },
    { name: 'Quechimba-Pedidos-1.5.0-x64.deb', browser_download_url: `${BASE}Quechimba-Pedidos-1.5.0-x64.deb` },
    { name: 'Quechimba-Pedidos-1.5.0-arm64.deb', browser_download_url: `${BASE}Quechimba-Pedidos-1.5.0-arm64.deb` },
  ],
};

describe('actualizaciones en Chromebook', () => {
  test('ofrece el instalador correcto según el procesador (Intel/AMD o ARM)', () => {
    assert.deepEqual(revisarPublicacion(publicacion, '1.4.0', 'x64'), { estado: 'disponible', nueva: '1.5.0', url: `${BASE}Quechimba-Pedidos-1.5.0-x64.deb` });
    assert.deepEqual(revisarPublicacion(publicacion, '1.4.0', 'arm64'), { estado: 'disponible', nueva: '1.5.0', url: `${BASE}Quechimba-Pedidos-1.5.0-arm64.deb` });
  });

  test('si ya está al día, o la versión nueva aún no tiene instalador, no molesta', () => {
    assert.deepEqual(revisarPublicacion(publicacion, '1.5.0', 'x64'), { estado: 'al-dia' });
    assert.deepEqual(revisarPublicacion(publicacion, '1.6.0', 'x64'), { estado: 'al-dia' });
    assert.deepEqual(revisarPublicacion({ tag_name: 'v2.0.0', assets: [] }, '1.4.0', 'x64'), { estado: 'al-dia' });
  });

  test('nunca abre una descarga que no sea de GitHub, aunque la respuesta venga alterada', () => {
    const trampa = { tag_name: 'v9.9.9', assets: [{ name: 'Quechimba-Pedidos-9.9.9-x64.deb', browser_download_url: 'https://sitio-malo.com/Quechimba-Pedidos-9.9.9-x64.deb' }] };
    assert.deepEqual(revisarPublicacion(trampa, '1.4.0', 'x64'), { estado: 'al-dia' });
    for (const raro of [null, {}, { tag_name: 'ultima' }, { tag_name: 5 }]) {
      assert.equal(revisarPublicacion(raro, '1.4.0', 'x64').estado, 'error');
    }
  });

  test('el empaquetado produce instaladores .deb para x64 y arm64 con los nombres que espera el aviso', async () => {
    const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
    assert.deepEqual(pkg.build.linux.target, [{ target: 'deb', arch: ['x64', 'arm64'] }]);
    assert.equal(pkg.build.linux.artifactName, 'Quechimba-Pedidos-${version}-${arch}.${ext}');
    assert.match(pkg.author.email, /@/, 'el paquete .deb exige un correo de quien lo mantiene');
  });
});
