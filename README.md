# Quechimba Pedidos · App de escritorio

App de Windows para el encargado de **Quechimba Burger**. Desde ella se puede:

- recibir los pedidos de la web en vivo;
- registrar las ventas del local y de WhatsApp;
- administrar el menú que se ve en la página;
- llevar la contabilidad y descargarla en PDF.

Hecha con **Electron** y conectada a **Supabase** (PostgreSQL), la misma base de datos que usa la página web.

```
 Página web (rama web)                       App de escritorio (esta rama)
 ─────────────────────                       ─────────────────────────────
 menu_publico()      ──► lee el menú         Pedidos en vivo (Realtime + sonido + notificación)
 crear_pedido_web()  ──► registra pedido     Nueva venta (local / WhatsApp)
        └── y abre WhatsApp con el #         Menú: platos, precios, fotos, agotados
                    │                        Contabilidad + PDF (día / semana / mes / rango)
                    ▼                        Ajustes: web activada/desactivada, destacado, versión mínima
            ┌────────────────┐                        │
            │    SUPABASE    │ ◄──────────────────────┘
            │  PostgreSQL +  │   Toda la lógica de dinero vive en funciones SQL
            │  Auth + Storage│   (una sola fuente de verdad, validada en el servidor)
            └────────────────┘
```

## Probar ya (sin Supabase): modo demo

```bash
npm install
npm run demo
```

El modo demo usa una base de datos local con las **mismas reglas** que producción y genera 45 días de ventas de ejemplo.

- Usuario: `demo@quechimba.co`
- Contraseña: `demo1234`
- Para probar las alertas, usa el botón **"Simular pedido web"**.

> Si ejecutas desde una terminal integrada de VS Code y Electron arranca como Node, quita la variable `ELECTRON_RUN_AS_NODE`.

## Estructura

```
supabase/
  migrations/        Esquema, integridad, seguridad (RLS), funciones y reportes
  seed.sql           Menú inicial (el mismo de la web)
  instalar_todo.sql  Todo unido para instalar en un paso (npm run sql:unificar)
src/
  main/              Proceso principal: ventana segura, PDF, actualizaciones, modo demo
  preload/           Puente seguro (la interfaz no tiene acceso a Node)
  renderer/          Interfaz: pedidos, venta, menú, contabilidad, ajustes, reporte PDF
  shared/            Lógica pura compartida (dinero, fechas en hora de Colombia, estados)
tests/
  unit/              Lógica compartida
  db/                Base de datos: seguridad, pedidos, menú, contabilidad, rendimiento
  web/               Página web real contra las funciones SQL reales
  e2e/               App de escritorio completa (Electron real)
  mutacion.mjs       Verifica que las pruebas detecten errores introducidos a propósito
```

## Conectar con Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com). Como región, elige **South America (São Paulo)**, la más cercana a Colombia.
2. Ve a **SQL Editor**, pega completo [`supabase/instalar_todo.sql`](supabase/instalar_todo.sql) y toca **Run**. Esto crea las tablas, la seguridad, las funciones, el bucket de fotos y el menú inicial.
3. En **Authentication → Sign In / Providers**, desactiva **"Allow new users to sign up"**. Así nadie puede crearse una cuenta desde afuera.
4. En **Authentication → Users → Add user**, crea el usuario del encargado (correo y contraseña) y copia su **User UID**.
5. Autoriza a ese usuario como personal. En el SQL Editor:
   ```sql
   insert into public.staff (user_id, nombre, rol)
   values ('PEGA-AQUI-EL-UID', 'Nombre del encargado', 'admin');
   ```
6. En **Project Settings → API**, copia la **Project URL** y la llave pública **anon / publishable**.
   - ⚠️ **Nunca** uses la llave `service_role`: la app la rechaza a propósito.
7. **App de escritorio:** al abrirla por primera vez pide la URL y la llave. Si prefieres que el instalador ya traiga la conexión, escríbelas antes de compilar en `src/main/config.defecto.json`.
8. **Página web:** en `js/config.js` de la rama `web`, llena `supabase.url` y `supabase.anonKey`, y súbelo.
9. En la app, ve a **Ajustes → Dirección del sitio web** y escribe la URL pública de la web. La app la usa para mostrar las fotos que están guardadas en la web.

## Reglas contables (probadas automáticamente)

- **Qué es una venta:** un pedido en estado **entregado**. Los cancelados, los anulados y los que siguen sin cerrar se informan aparte y no suman.
- **Fecha de la venta:** la fecha en que se **creó** el pedido, en **hora de Colombia**. Un pedido de las 11:50 p. m. cuenta para ese día.
- **Total:** productos + domicilio − descuento. Todo se guarda en **pesos enteros**, sin decimales ni redondeos ocultos.
- **Precios congelados:** cada pedido guarda el precio del momento. Cambiar un precio del menú **no altera** las ventas pasadas.
- **Nada se borra:** los pedidos no se eliminan, se cancelan. Para anular una venta entregada hay que escribir el motivo, y queda en una bitácora de solo lectura con quién la anuló y cuándo.
- **Cuadres:** la suma por método de pago, por canal, por día y por hora da exactamente el total. La suma por producto y por categoría da exactamente el subtotal de productos.

> Esto es **control interno de ventas**. No reemplaza la facturación electrónica de la DIAN.

## Seguridad

- **La web (rol anónimo)** no puede leer ni escribir tablas. Solo puede consultar el menú y crear pedidos, y el precio lo pone siempre el servidor.
- **Usuarios que no son del personal** no ven nada, aunque inicien sesión.
- **El personal** solo escribe a través de funciones que validan cada dato (tipos, rangos, longitudes, transiciones de estado).
- **Protección contra ataques:** el código malicioso se guarda como texto y nunca se ejecuta. Hay un límite contra pedidos falsos masivos.
- **La app de escritorio** tiene aislamiento de contexto, sandbox, CSP estricta y un protocolo propio que no deja leer archivos del disco. Los enlaces externos se abren en el navegador.

## Pruebas

```bash
npm test               # unitarias + base de datos (seguridad, pedidos, menú, contabilidad, rendimiento)
npm run test:web       # la página web real contra las funciones SQL
npm run test:e2e       # la app completa en Electron (modo demo)
npm run test:mutacion  # 12 errores introducidos a propósito: las pruebas deben detectarlos todos
```

`npm run test:web` necesita la carpeta de la web al lado (`../WebQuechimbaburger`) o en `QB_WEB_DIR`, y Chrome o Edge instalado.

| Suite | Qué verifica |
|---|---|
| Seguridad (71) | Cada rol contra cada tabla y función; registros inmutables |
| Pedidos (35) | Precios del servidor, validaciones, estados, anulaciones, integridad |
| Menú (22) | Crear/editar/ocultar/agotar platos y su reflejo en la web |
| Contabilidad (19) | 400 pedidos aleatorios cuadran **peso por peso** con un cálculo independiente; zona horaria; invariantes |
| Rendimiento (6) | 10.000 pedidos: reporte anual < 5 s, mensual < 1,5 s, pedido < 100 ms |
| Web (11) | Menú en vivo, pedido registrado + WhatsApp con #, precio manipulado, Supabase caído, pausa |
| E2E (21) | Flujos del encargado, PDF, seguridad del proceso, accesibilidad, velocidad, sin errores de consola |
| Unitarias (21) | Dinero, fechas en hora de Colombia, estados, fotos, escape de HTML |
| Instalación y demo (5) | El instalador SQL en un paso y el historial de ejemplo son válidos |
| Mutación (12/12) | Las pruebas detectan errores reales de contabilidad y seguridad |

## Publicar una actualización

Las apps instaladas se actualizan solas desde **GitHub Releases**:

```bash
npm version patch          # 1.0.0 → 1.0.1  (minor para funciones nuevas)
git push --follow-tags     # GitHub Actions: corre TODAS las pruebas → compila → publica
```

Si alguna prueba falla, no se publica nada. La app descarga la actualización en segundo plano y la instala **al cerrarse**; nunca interrumpe el servicio. Para un cambio crítico, sube la **versión mínima** en *Ajustes*: las versiones anteriores pedirán actualizar.

**Primera instalación:** descarga `Quechimba-Pedidos-Setup-x.y.z.exe` desde *Releases*. Si Windows muestra "Windows protegió su PC" (el instalador no tiene firma de pago), toca *Más información* → *Ejecutar de todas formas*.

Para compilar localmente sin publicar: `npm run build` (instalador) o `npm run build:dir` (carpeta).

## Copias de seguridad

El plan gratuito de Supabase **no incluye copias automáticas** y pausa el proyecto tras 7 días sin uso. Para un negocio que guarda su contabilidad ahí, se recomienda el **plan Pro**, o como mínimo exportar la base de datos con regularidad (*Database → Backups*).
