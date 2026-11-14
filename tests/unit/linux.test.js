/**
 * Versión para Chromebook (Linux): actualización automática y empaquetado.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { revisarPublicacion, huellaDe, urlManifiesto, descargarEInstalar, comandosManuales } from '../../src/main/version-linux.js';

const BASE = 'https://github.com/danteruedas123-glitch/QueChimbaBurguer/releases/download/v1.5.0/';
const publicacion = {
  tag_name: 'v1.5.0',
  assets: ['Quechimba-Pedidos-Setup-1.5.0.exe', 'Quechimba-Pedidos-1.5.0-amd64.deb', 'Quechimba-Pedidos-1.5.0-arm64.deb']
    .map((name) => ({ name, browser_download_url: BASE + name })),
};
const MANIFIESTO = `version: 1.5.0
files:
  - url: Quechimba-Pedidos-1.5.0-amd64.deb
    sha512: SoawsMCQBRiiqvvu96yeOwTtt3o74RxBA/laQ6lgZMAD4ZedGAVAXNh88JsZv1pfNYF6oHvEV0sMC1n5qQ9fBQ==
    size: 108425168
path: Quechimba-Pedidos-1.5.0-amd64.deb
sha512: SoawsMCQBRiiqvvu96yeOwTtt3o74RxBA/laQ6lgZMAD4ZedGAVAXNh88JsZv1pfNYF6oHvEV0sMC1n5qQ9fBQ==
releaseDate: '2026-11-14T05:17:26.508Z'`;

/** fetch simulado: sirve un manifiesto y un "instalador" con el contenido dado. */
const fetchFalso = (contenido, manifiesto) => async (url) => {
  if (url.endsWith('.yml')) return new Response(manifiesto);
  return new Response(contenido, { headers: { 'content-length': String(contenido.length) } });
};

describe('actualizaciones en Chromebook', () => {
  test('ofrece el instalador correcto según el procesador (Intel/AMD o ARM)', () => {
    assert.deepEqual(revisarPublicacion(publicacion, '1.4.0', 'x64'),
      { estado: 'disponible', nueva: '1.5.0', url: `${BASE}Quechimba-Pedidos-1.5.0-amd64.deb`, archivo: 'Quechimba-Pedidos-1.5.0-amd64.deb' });
    assert.equal(revisarPublicacion(publicacion, '1.4.0', 'arm64').archivo, 'Quechimba-Pedidos-1.5.0-arm64.deb');
    assert.equal(urlManifiesto('1.5.0', 'arm64'), `${BASE}latest-linux-arm64.yml`);
    assert.equal(urlManifiesto('1.5.0', 'x64'), `${BASE}latest-linux.yml`);
  });

  test('si ya está al día, o la versión nueva aún no tiene instalador, no molesta', () => {
    assert.deepEqual(revisarPublicacion(publicacion, '1.5.0', 'x64'), { estado: 'al-dia' });
    assert.deepEqual(revisarPublicacion(publicacion, '1.6.0', 'x64'), { estado: 'al-dia' });
    assert.deepEqual(revisarPublicacion({ tag_name: 'v2.0.0', assets: [] }, '1.4.0', 'x64'), { estado: 'al-dia' });
  });

  test('nunca descarga de otro sitio, aunque la respuesta de GitHub venga alterada', () => {
    const trampa = { tag_name: 'v9.9.9', assets: [{ name: 'Quechimba-Pedidos-9.9.9-amd64.deb', browser_download_url: 'https://sitio-malo.com/Quechimba-Pedidos-9.9.9-amd64.deb' }] };
    assert.deepEqual(revisarPublicacion(trampa, '1.4.0', 'x64'), { estado: 'al-dia' });
    for (const raro of [null, {}, { tag_name: 'ultima' }, { tag_name: 5 }]) {
      assert.equal(revisarPublicacion(raro, '1.4.0', 'x64').estado, 'error');
    }
  });

  test('lee la huella sha512 del manifiesto oficial (y no se confunde de archivo)', () => {
    assert.equal(huellaDe(MANIFIESTO, 'Quechimba-Pedidos-1.5.0-amd64.deb'), 'SoawsMCQBRiiqvvu96yeOwTtt3o74RxBA/laQ6lgZMAD4ZedGAVAXNh88JsZv1pfNYF6oHvEV0sMC1n5qQ9fBQ==');
    assert.equal(huellaDe(MANIFIESTO, 'Quechimba-Pedidos-1.5.0-arm64.deb'), null);
    assert.equal(huellaDe('basura', 'x.deb'), null);
  });

  test('un instalador alterado NO se instala', async () => {
    let instalo = false;
    const bueno = Buffer.from('instalador original');
    const manifiesto = `files:\n  - url: a.deb\n    sha512: ${createHash('sha512').update(bueno).digest('base64')}\n`;
    await assert.rejects(descargarEInstalar({
      fetch: fetchFalso(Buffer.from('instalador con virus'), manifiesto), nueva: '1.5.0', url: 'x', archivo: 'a.deb', arquitectura: 'x64',
      carpeta: await mkdtemp(path.join(os.tmpdir(), 'qb-')), ejecutar: async () => { instalo = true; },
    }), /no coincide con el original/);
    assert.equal(instalo, false);
  });

  test('el instalador correcto se instala con apt, sin consola y sin pedir nada en pantalla', async () => {
    const bueno = Buffer.from('instalador original');
    const manifiesto = `files:\n  - url: a.deb\n    sha512: ${createHash('sha512').update(bueno).digest('base64')}\n`;
    const llamadas = [];
    const progresos = [];
    await descargarEInstalar({
      fetch: fetchFalso(bueno, manifiesto), nueva: '1.5.0', url: 'x', archivo: 'a.deb', arquitectura: 'x64',
      carpeta: await mkdtemp(path.join(os.tmpdir(), 'qb-')), alProgreso: (p) => progresos.push(p),
      ejecutar: async (prog, args) => { llamadas.push([prog, args.slice(0, 5)]); assert.equal((await readFile(args[5])).toString(), 'instalador original'); },
    });
    assert.deepEqual(llamadas, [['sudo', ['-n', 'apt-get', 'install', '-y', '--allow-downgrades']]]);
    assert.ok(progresos.includes(100));
  });

  test('si apt pide contraseña, se ofrecen los comandos para la Terminal', () => {
    assert.deepEqual(comandosManuales(`${BASE}Quechimba-Pedidos-1.5.0-amd64.deb`, 'Quechimba-Pedidos-1.5.0-amd64.deb'),
      [`wget ${BASE}Quechimba-Pedidos-1.5.0-amd64.deb`, 'sudo apt install ./Quechimba-Pedidos-1.5.0-amd64.deb']);
  });

  test('el empaquetado produce instaladores .deb para Intel/AMD y ARM', async () => {
    const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
    assert.deepEqual(pkg.build.linux.target, [{ target: 'deb', arch: ['x64', 'arm64'] }]);
    assert.equal(pkg.build.linux.artifactName, 'Quechimba-Pedidos-${version}-${arch}.${ext}');
    assert.match(pkg.author.email, /@/, 'el paquete .deb exige un correo de quien lo mantiene');
  });
});
