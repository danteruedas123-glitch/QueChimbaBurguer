/**
 * Capa de datos. La interfaz usa SIEMPRE esta API, sin importar si detrás
 * está Supabase (producción) o PGlite (modo demo). Ambos ejecutan las mismas
 * funciones SQL, así que el comportamiento es idéntico.
 */

const errorDe = (e) => Object.assign(new Error(e?.message ?? 'Error'), { hint: e?.hint ?? null, code: e?.code ?? null });

function fuenteDemo() {
  const d = window.qb.demo;
  const abrir = (r) => { if (r?.error) throw errorDe(r.error); return r?.datos ?? null; };
  return {
    tipo: 'demo',
    iniciarSesion: async (email, password) => abrir(await d.login(email, password)),
    cerrarSesion: () => d.logout(),
    usuarioActual: () => d.sesion(),
    rpc: async (nombre, args = {}) => abrir(await d.rpc(nombre, args)),
    suscribirPedidos: (alCambio, alEstado) => { alEstado?.('en-vivo'); return d.alCambiarPedidos(alCambio); },
    subirFoto: (blob) => new Promise((ok, mal) => {
      const lector = new FileReader();
      lector.onload = () => ok(lector.result);
      lector.onerror = () => mal(new Error('No se pudo leer la imagen'));
      lector.readAsDataURL(blob);
    }),
    simularPedidoWeb: async () => abrir(await d.simularPedidoWeb()),
  };
}

function fuenteSupabase(url, llave) {
  const cliente = window.supabase.createClient(url, llave, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'qb-sesion' },
  });
  return {
    tipo: 'supabase',
    async iniciarSesion(email, password) {
      const { data, error } = await cliente.auth.signInWithPassword({ email, password });
      if (error) throw errorDe(error);
      return data.user;
    },
    async cerrarSesion() { await cliente.auth.signOut(); },
    async usuarioActual() {
      const { data } = await cliente.auth.getSession();
      return data.session?.user ?? null;
    },
    async rpc(nombre, args = {}) {
      const { data, error } = await cliente.rpc(nombre, args);
      if (error) throw errorDe(error);
      return data;
    },
    suscribirPedidos(alCambio, alEstado) {
      const canal = cliente.channel('pedidos-en-vivo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => alCambio())
        .subscribe((estado) => alEstado?.(estado === 'SUBSCRIBED' ? 'en-vivo' : estado === 'CLOSED' || estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' ? 'caida' : 'conectando'));
      return () => cliente.removeChannel(canal);
    },
    async subirFoto(blob) {
      const nombre = `${crypto.randomUUID()}.webp`;
      const { error } = await cliente.storage.from('productos').upload(nombre, blob, {
        contentType: blob.type, upsert: false, cacheControl: '31536000',
      });
      if (error) throw errorDe(error);
      return cliente.storage.from('productos').getPublicUrl(nombre).data.publicUrl;
    },
  };
}

export function crearFuente(config) {
  if (config.modoDemo) return fuenteDemo();
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  return fuenteSupabase(config.supabaseUrl, config.supabaseAnonKey);
}

/** API del negocio, construida sobre las funciones SQL. */
export function crearApi(fuente) {
  const rpc = (n, a) => fuente.rpc(n, a);
  return {
    fuente,
    perfil: () => rpc('perfil_actual'),
    appInfo: () => rpc('app_info'),
    menu: () => rpc('menu_admin'),
    guardarProducto: (p) => rpc('producto_guardar', { p }),
    eliminarProducto: (id) => rpc('producto_eliminar', { p_id: id }),
    guardarCategoria: (p) => rpc('categoria_guardar', { p }),
    eliminarCategoria: (id) => rpc('categoria_eliminar', { p_id: id }),
    guardarAjustes: (p) => rpc('ajustes_guardar', { p }),
    pedidos: (desde, hasta, estados) => rpc('pedidos_listar', { p_desde: desde, p_hasta: hasta, ...(estados ? { p_estados: estados } : {}) }),
    cambiarEstado: (id, estado, motivo) => rpc('pedido_cambiar_estado', { p_id: id, p_estado: estado, ...(motivo ? { p_motivo: motivo } : {}) }),
    actualizarCobro: (id, p) => rpc('pedido_actualizar_cobro', { p_id: id, p }),
    registrarVenta: (items, datos) => rpc('venta_registrar', { p_items: items, p_datos: datos }),
    reporte: (desde, hasta) => rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta }),
    /** Festividad que la web muestra HOY (incluye el aniversario automático). */
    festividadHoy: async () => (await rpc('menu_publico'))?.festividad ?? { tema: 'normal' },
  };
}

/**
 * URL lista para mostrar una foto:
 *  • rutas relativas ("assets/img/x.webp") → URL completa del sitio web;
 *  • fotos de Unsplash → se piden al tamaño justo (las originales pesan varios MB
 *    y decodificarlas bloquea la app).
 */
export function urlFoto(url, urlSitio, ancho = 320) {
  if (!url) return 'img/logo.webp';
  if (url.includes('images.unsplash.com') && !url.includes('?')) return `${url}?auto=format&fit=crop&w=${ancho}&q=70`;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return urlSitio ? urlSitio.replace(/\/?$/, '/') + url.replace(/^\//, '') : 'img/logo.webp';
}

/** Reduce y convierte la foto a WebP (máx. 900 px) antes de subirla: carga rápido en la web. */
export async function optimizarFoto(archivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error('Usa una imagen JPG, PNG o WebP');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen es muy pesada (máx. 15 MB)');
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const lienzo = new OffscreenCanvas(Math.round(bmp.width * escala), Math.round(bmp.height * escala));
  lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  return lienzo.convertToBlob({ type: 'image/webp', quality: 0.82 });
}
