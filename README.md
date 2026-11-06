# Quechimba Burger — Sitio web

Página de hamburguesería con menú, carrito de pedido y envío del pedido completo por WhatsApp.
HTML, CSS y JavaScript puros: no requiere instalación, compilación ni servidor especial.

## Estructura

```
WebQuechimbaburger/
├── index.html        # Estructura de la página
├── css/styles.css    # Diseño (colores y fuentes al inicio del archivo)
├── js/config.js      # ⭐ DATOS DEL NEGOCIO: menú, precios, horario, teléfono…
├── js/app.js         # Lógica: menú, carrito, horario, WhatsApp
└── assets/
    ├── fonts/        # Fuente de títulos (24 KB)
    └── img/          # Logo, íconos y fotos reales (de su Instagram), en WebP
```

Fuente de las fotos reales y el logo: Instagram del negocio, [@quechimbaburger1](https://www.instagram.com/quechimbaburger1/).
Son capturas de videos (360 px de ancho); conviene pedir al negocio las fotos y el logo **originales en alta resolución**.

## Conexión con la app de escritorio (Supabase)

En `js/config.js` → `supabase.url` y `supabase.anonKey` (llave **pública** anon). Con eso:

- El **menú, precios, fotos, agotados y el producto destacado** se administran desde la app de escritorio *Quechimba Pedidos* (rama `escritorio`) y se ven aquí al instante.
- Cada pedido queda **registrado** para la contabilidad, y el mensaje de WhatsApp lleva su número (`*Pedido #0142*`).
- Los precios los calcula el servidor: aunque alguien manipule la página, se cobra el precio real.
- Si Supabase no responde, la web sigue funcionando con el último menú conocido y el pedido sale por WhatsApp.
- El encargado puede **pausar los pedidos en línea** desde la app, y la web lo avisa.

Si los dos campos están vacíos, la web funciona como antes, con el menú de `config.js`. Las instrucciones completas están en el README de la rama `escritorio`.

## Cómo cambiar el menú, precios u horario

Sin Supabase, todo se edita en **`js/config.js`** (con Supabase, desde la app de escritorio):

- **Precio:** cambia el número (`precio: 18000` = $18.000).
- **Agregar un producto:** copia un bloque `{ id: … }`, pégalo debajo y cambia los datos. El `id` debe ser único, en minúsculas y sin espacios.
- **Quitar un producto:** borra su bloque.
- **Foto propia:** guarda la imagen en `assets/img/` y pon `foto: 'assets/img/mi-foto.webp'`.
- **Horario:** edita `abre` y `cierra` (formato 24 h). Para un día cerrado, borra su línea.
- **WhatsApp:** `whatsapp: '57XXXXXXXXXX'` (solo números, con el 57 adelante).

## Ver el sitio

Usa siempre un servidor local (así se comporta igual que publicado):

```bash
python -m http.server 8000   # desde esta carpeta; luego entra a http://localhost:8000
```

O en VS Code: extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.

> ⚠️ No abras `index.html` con doble clic: Chrome bloquea la fuente de los títulos
> en páginas abiertas desde el disco (`file:///`) y verás errores de CORS en la consola.
> No pasa nada al publicar el sitio, porque se sirve por `https://`.

## Rendimiento

Lighthouse (celular, 4G lenta): **100 / 100 / 100 / 100**. La página carga en ~1 s y pesa ~450 KB.

- Fuente de títulos local y recortada (24 KB). El texto usa las fuentes del sistema (0 KB).
- Fotos con tamaño justo para cada pantalla (`srcset`) y carga diferida del menú.
- El mapa de Google (~1 MB) solo se descarga si el cliente toca "Ver mapa".
- **Publicar en Netlify, Vercel o Cloudflare Pages** (gratis): comprimen los archivos y usan caché automáticamente.
- Fotos propias: subirlas en formato **WebP**, de unos 900 px de ancho y menos de 120 KB cada una.

## Funciones

- Menú en acordeón: cada categoría se despliega al tocarla (una a la vez) y sus fotos solo se descargan al abrirla. Buscador que ignora tildes.
- Carrito que se guarda aunque el cliente cierre la página.
- El pedido llega a WhatsApp con productos, cantidades, subtotal, entrega, dirección, forma de pago y notas.
- Recuerda nombre y dirección del cliente para su próximo pedido.
- Indicador "Abierto / Cerrado" en vivo según la hora de Colombia.
- SEO: metadatos, vista previa al compartir y datos estructurados de restaurante para Google.
- Accesible (teclado, lectores de pantalla) y respeta "reducir movimiento".
