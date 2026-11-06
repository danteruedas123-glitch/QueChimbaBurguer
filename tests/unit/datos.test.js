import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { urlFoto } from '../../src/renderer/js/datos.js';
import { rutaSupabaseUMD } from '../../src/main/rutas.js';

test('las fotos de Unsplash se piden al tamaño justo (no el original de varios MB)', () => {
  assert.equal(urlFoto('https://images.unsplash.com/photo-1', ''), 'https://images.unsplash.com/photo-1?auto=format&fit=crop&w=320&q=70');
  assert.equal(urlFoto('https://images.unsplash.com/photo-1', '', 120), 'https://images.unsplash.com/photo-1?auto=format&fit=crop&w=120&q=70');
});
test('las rutas relativas usan la dirección del sitio web', () => {
  assert.equal(urlFoto('assets/img/x.webp', 'https://sitio.co'), 'https://sitio.co/assets/img/x.webp');
  assert.equal(urlFoto('/assets/img/x.webp', 'https://sitio.co/'), 'https://sitio.co/assets/img/x.webp');
});
test('sin foto o sin sitio configurado se usa el logo', () => {
  assert.equal(urlFoto(null, ''), 'img/logo.webp');
  assert.equal(urlFoto('assets/img/x.webp', ''), 'img/logo.webp');
});
test('las fotos de Supabase Storage y data URLs se usan tal cual', () => {
  const s = 'https://abc.supabase.co/storage/v1/object/public/productos/a.webp';
  assert.equal(urlFoto(s, ''), s);
  assert.equal(urlFoto('data:image/webp;base64,AAA', ''), 'data:image/webp;base64,AAA');
});

test('la librería de Supabase para la interfaz existe y es el bundle UMD', () => {
  const ruta = rutaSupabaseUMD();
  assert.ok(existsSync(ruta));
  assert.match(readFileSync(ruta, 'utf8').slice(0, 2000), /supabase/i);
});
