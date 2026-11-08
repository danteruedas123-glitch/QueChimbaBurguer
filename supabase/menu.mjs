/**
 * MENÚ REAL de Quechimba Burger — única fuente de verdad.
 * Transcrito de la carta del local (hamburguesas, combos, salchi menú, menú
 * dog, otras cositas, micheladas, jugos y la carta de Dani' Ress).
 *
 * Al cambiar algo aquí, correr:  npm run menu:generar
 * Eso regenera supabase/seed.sql, supabase/actualizar_menu.sql y el menú de
 * respaldo de la web (WebQuechimbaburger/js/config.js). Una prueba verifica
 * que los tres coincidan con este archivo.
 *
 *  - precio en pesos, sin puntos (23000 = $23.000)
 *  - foto: nombre del archivo en WebQuechimbaburger/assets/img/menu/ (sin .webp)
 *  - opciones: lo que el cliente elige al pedir (se abre una ventanita en la web
 *    y en la caja). Cada grupo: { titulo, elige, opciones: [{ nombre, extra }] }
 *    o { titulo, elige, lista: 'gaseosas' | 'bebidas_michelada' } (listas de BEBIDAS,
 *    que el dueño edita en Ajustes). "extra" se suma al precio (lo calcula el servidor).
 *  - oculto: true → no sale en la web hasta que el dueño lo active desde la app.
 */

/** Listas iniciales de bebidas para elegir (luego se editan en la app: Ajustes). */
export const BEBIDAS = {
  gaseosas: ['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'],
  bebidas_michelada: ['Ginger', 'Bretaña', 'Soda Hatsu', 'Bretaña Hard Seltzer', 'Like', 'Cuates', 'Smirnoff', 'Club Colombia',
    'Coronita', 'Miller Lite', 'Águila', 'Budweiser', 'Heineken', 'Cola y Pola', 'Póker'],
};

// ---------- grupos de opciones ----------
const gaseosas = (n) => [{ titulo: n === 1 ? 'Gaseosa' : 'Gaseosas', elige: n, lista: 'gaseosas' }];
const nivel = (extras) => ({ titulo: 'Nivel', elige: 1,
  opciones: ['Normal', 'Cargada', 'Súper cargada'].slice(0, extras.length).map((nombre, i) => ({ nombre, extra: extras[i] })) });
const BEBIDA_MICHELADA = { titulo: 'Bebida', elige: 1, lista: 'bebidas_michelada' };
const PAPAS = { titulo: 'Papas', elige: 1, opciones: [{ nombre: 'Sin papas', extra: 0 }, { nombre: 'Con papas', extra: 2000 }] };
const PREPARACION = { titulo: 'Preparación', elige: 1, opciones: [{ nombre: 'En agua', extra: 0 }, { nombre: 'En leche', extra: 2000 }] };

const ELIGE = 'Elige el nivel (la normal lleva menos fruta) y tu bebida.';
const CON_TODO = (frutas) => `${frutas}, cerezas, bombombún, masmelo, trululú, tira de caramelo, limón, tajín, hielo y vaso escarchado. ${ELIGE}`;
const SENCILLA = (frutas) => `${frutas}, cerezas, limón, tajín, hielo y vaso escarchado. ${ELIGE}`;
const ACOMPANADO = 'Acompañado con papa frita, yuca o patacón.';

const michelada = (slug, nombre, descripcion, precio, extras, foto) =>
  ({ slug, nombre, descripcion, precio, foto, opciones: [nivel(extras), BEBIDA_MICHELADA] });

const jugo = (slug, nombre) => ({ slug: `jugo-${slug}`, nombre, descripcion: 'Fruta fresca, 100 % natural. En agua o en leche.',
  precio: 8000, foto: `jugo-${slug}`, opciones: [PREPARACION] });
const limonada = (slug, nombre) => ({ slug: `jugo-${slug}`, nombre, descripcion: 'Natural y bien fría.', precio: 8000, foto: `jugo-${slug}` });

export const CATEGORIAS = [
  { slug: 'hamburguesas', nombre: 'Hamburguesas' },
  { slug: 'combitos', nombre: 'Combitos de hamburguesa' },
  { slug: 'combos', nombre: 'Combos' },
  { slug: 'salchipapas', nombre: 'Salchi menú' },
  { slug: 'perros', nombre: 'Menú dog' },
  { slug: 'otras-cositas', nombre: 'Otras cositas' },
  { slug: 'asados', nombre: 'Asados' },
  { slug: 'antojitos', nombre: 'Antojitos' },
  { slug: 'micheladas', nombre: 'Micheladas' },
  { slug: 'jugos', nombre: 'Jugos naturales' },
  { slug: 'bebidas', nombre: 'Bebidas' },
];

export const PRODUCTOS = {
  hamburguesas: [
    { slug: 'mini-burger', nombre: 'Mini Burger', precio: 6000, descripcion: '60 g de carne.', foto: 'mini-burgers' },
    { slug: 'chimbita-burger', nombre: 'Chimbita Burger', precio: 23000, opciones: gaseosas(1), foto: 'chimbita',
      descripcion: '150 g de carne, queso mozzarella, doble tocineta, jamón, pepinillo, cebolla y tocineta caramelizada, pan ajonjolí o artesanal, papas y gaseosa.' },
    { slug: 'doble-chimba', nombre: 'Doble Chimba', precio: 30000, opciones: gaseosas(1), foto: 'doble-chimba',
      descripcion: '230 g de carne, doble tocineta, doble mozzarella, pepinillo, cebolla caramelizada, pan artesanal, papas y gaseosa.' },
    { slug: 'classic-burger', nombre: 'Classic Burger', precio: 17000, foto: 'classic',
      descripcion: '130 g de carne, tocineta, cebolla caramelizada, mozzarella, lechuga y papas.' },
    { slug: 'burger-chori', nombre: 'Burger Chori', precio: 25000, opciones: gaseosas(1), foto: 'burger-chori',
      descripcion: '130 g de carne y chorizo, doble tocineta, doble queso mozzarella, cebolla caramelizada, salsas de la casa, papas y gaseosa.' },
    { slug: 'la-grilla', nombre: 'La Grilla', precio: 25000, opciones: gaseosas(1), foto: 'la-grilla',
      descripcion: '150 g de carne, queso costeño asado, chorizo asado, tocineta y cebolla caramelizada, pepinillo, papas y gaseosa.' },
    { slug: 'la-de-pollo', nombre: 'La de Pollo', precio: 17000, foto: 'la-de-pollo', descripcion: '130 g de carne de pollo y papas.' },
    { slug: 'la-mixta', nombre: 'La Mixta', precio: 30000, opciones: gaseosas(1), foto: 'la-mixta',
      descripcion: 'Carne de res, carne de pollo apanado crocante, 3 tocinetas, 2 jamones, 2 mozzarellas, papas y gaseosa.' },
    { slug: 'smash-burger', nombre: 'Smash Burger', precio: 30000, foto: 'smash', etiqueta: 'La más chimba',
      descripcion: 'Doble carne smash, cebolla asada, mozzarella y tocineta. ¡Que no falte! Porción de papas y Coca-Cola.' },
    { slug: 'dorichimba', nombre: 'Dorichimba', precio: 30000, foto: 'dorichimba', etiqueta: '¡De locos!',
      descripcion: '200 g de carne artesanal ¡una chimba!, mozzarella, cebolla asada, un paquete de Doritos, papas y Coca-Cola.' },
    { slug: 'montanera', nombre: 'Montañera', precio: 30000, foto: 'montanera',
      descripcion: 'Carne Angus, mozzarella, queso asado y bañado en miel, piña asada, tajadas de maduro, salsa súper de la casa, papas y Coca-Cola.' },
    { slug: 'triple-chimba-burger', nombre: 'Triple Chimba Burger', precio: 35000, foto: 'triple-chimba',
      descripcion: '3 carnes Angus, 5 tocinetas, 4 jamones, 4 mozzarellas, pepinillo, papa y Coca-Cola PET 400.' },
  ],
  combitos: [
    { slug: 'combo-x4', nombre: 'Combo x4', precio: 24000, foto: 'combo-x4', descripcion: '4 mini burger y 1 porción de papas.' },
    { slug: 'combo-melo', nombre: 'Combo Melo', precio: 45000, opciones: gaseosas(2), foto: 'combo-melo', descripcion: '1 Chimbita Burger, 1 Classic Burger, 2 porciones de papas y 2 gaseosas.' },
    { slug: 'chimba-de-combo', nombre: 'Chimba de Combo', precio: 45000, opciones: gaseosas(2), foto: 'combo-plato', descripcion: '1 Classic Burger, 1 hamburguesa mixta, 2 porciones de papas y 2 gaseosas.' },
    { slug: 'combo-chimbita', nombre: 'Combo Chimbita', precio: 60000, opciones: gaseosas(3), foto: 'chimbita', descripcion: '1 Chimbita Burger, 1 Dorichimba, 1 Classic Burger, 3 porciones de papas y 3 gaseosas.' },
    { slug: 'combo-gorditas', nombre: 'Combo Gorditas', precio: 25000, opciones: gaseosas(1), foto: 'combo-minis', descripcion: '2 mini burger especiales, 1 porción de papas y 1 gaseosa.' },
    { slug: 'combo-chuzito', nombre: 'Combo Chuzito', precio: 22000, opciones: gaseosas(1), foto: 'combo-chuzito', descripcion: '1 chuzo mixto, 1 mini burger, 1 porción de papa, 1 arepa y 1 gaseosa.' },
    { slug: 'combo-remelo', nombre: 'Combo Remelo', precio: 50000, opciones: gaseosas(1), foto: 'salchi-30k', descripcion: '1 salchi de 30K, 1 Classic Burger, 1 porción de papas y 1 gaseosa.' },
  ],
  combos: [
    { slug: 'combo-1', nombre: 'Combo 1', precio: 45000, opciones: gaseosas(1), foto: 'perro-americano', descripcion: '1 hamburguesa mixta (120 g de carne y 120 g de pollo), 1 perro americano, 2 porciones de papas y 1 gaseosa.' },
    { slug: 'combo-2', nombre: 'Combo 2', precio: 40000, opciones: gaseosas(2), foto: 'perro-ranchero', descripcion: '1 perro de $15.000 (a elección), 1 Chimba Burger, 2 porciones de papas y 2 gaseosas.' },
    { slug: 'combo-3', nombre: 'Combo 3', precio: 20000, opciones: gaseosas(1), foto: 'combo-3', descripcion: '3 mini burger, 1 porción de papas grandes y 1 gaseosa.' },
    { slug: 'combo-4', nombre: 'Combo 4', precio: 40000, opciones: gaseosas(2), foto: 'combo-miniperros', descripcion: '2 Classic Burger, 2 papas, 2 gaseosas y 1 mini perro.' },
    { slug: 'combo-5', nombre: 'Combo 5', precio: 30000, opciones: gaseosas(1), foto: 'cajita-feliz', descripcion: '1 cajita de pollo, 1 perro sencillo, 1 porción de papas y 1 gaseosa.' },
    { slug: 'combo-6', nombre: 'Combo 6', precio: 25000, opciones: gaseosas(1), foto: 'salchi-sencilla', descripcion: '1 salchi sencilla, 1 perro sencillo y 1 gaseosa.' },
    { slug: 'combo-7', nombre: 'Combo 7', precio: 50000, opciones: gaseosas(2), foto: 'combo-plato', descripcion: '1 hamburguesa mixta, 1 salchi sencilla, 1 perro sencillo, 1 porción de papas y 2 gaseosas.' },
    { slug: 'combo-8', nombre: 'Combo 8', precio: 50000, opciones: gaseosas(2), foto: 'salchichimba', descripcion: '1 salchi de 30, 1 Chimbita Burger, 1 porción de papas y 2 gaseosas.' },
    { slug: 'combo-9', nombre: 'Combo 9', precio: 85000, opciones: gaseosas(1), foto: 'salchi-50k', descripcion: '1 salchi de 50, 1 Chimbita Burger, 1 perro americano, 2 porciones de papas y 1 gaseosa.' },
    { slug: 'combo-10', nombre: 'Combo 10', precio: 60000, foto: 'desgaranado', descripcion: '1 Salchichimba, 1 Chimbita Burger, 1 perro de $15.000 (a elección), 2 porciones de papas y 1 litro de Postobón.' },
    { slug: 'rompedieta', nombre: 'Rompedieta', precio: 50000, foto: 'rompedieta', etiqueta: 'La caja más chimba',
      descripcion: '2 smash burger, tocineta con papas, aros de cebolla y Doritos. ¡La caja más chimba!' },
    { slug: 'combo-aletoso', nombre: 'Combo Aletoso', precio: 20000, foto: null, descripcion: '6 alitas bañadas en salsa de la casa (opcional) con papas.' },
  ],
  salchipapas: [
    { slug: 'salchi-sencilla', nombre: 'Salchi Sencilla', precio: 15000, foto: 'salchi-sencilla',
      descripcion: 'Papas, chorizo, salchicha, butifarra, lechuga, queso rallado y salsas de la casa.' },
    { slug: 'salchichimba', nombre: 'Salchichimba', precio: 23000, foto: 'salchichimba',
      descripcion: 'Papas, chorizo, salchicha ranchera, butifarra, carne, pollo, maíz tierno, queso mozzarella, ripio de papa, lechuga, queso rallado y salsas de la casa.' },
    { slug: 'la-de-30k', nombre: 'La de 30K', precio: 30000, foto: 'salchi-30k',
      descripcion: 'Lo mismo de la Salchichimba pero en más cantidad, con salchicha súper ranchera y huevo de codorniz.' },
    { slug: 'la-de-50k', nombre: 'La de 50K', precio: 50000, foto: 'salchi-50k', etiqueta: 'Para 5 personas',
      descripcion: 'Más cantidad que «La de 30K», con 2 súper rancheras, tocineta y huevo de codorniz.' },
    { slug: 'la-de-80k', nombre: 'La de 80K', precio: 80000, foto: 'desgaranado',
      descripcion: 'Salchicha suiza, ranchera, de pollo y americana, chorizo santandereano, butifarra, carne de res, pollo en trozos, carne y pollo desmechado ¡y todo lo demás! Que chimba.' },
    { slug: 'ranchera-personal', nombre: 'La Ranchera Personal', precio: 18000, foto: 'salchi-30k',
      descripcion: 'Salchicha ranchera, papas, lechuga, queso rallado, papa ripio, salsas de la casa, piña rosada y tártara.' },
    { slug: 'ranchera-para-2', nombre: 'La Ranchera para 2', precio: 30000, foto: 'salchi-50k', etiqueta: 'Para 2',
      descripcion: 'Salchicha ranchera, súper ranchera, carne y pollo asado.' },
  ],
  perros: [
    { slug: 'mini-perro', nombre: 'Mini Perro', precio: 6000, opciones: [PAPAS], foto: 'combo-miniperros',
      descripcion: 'Pan mini, salchicha mini, tocineta caramelizada, queso mozzarella, ripio de papa y salsas de la casa.' },
    { slug: 'mini-perro-ranchero', nombre: 'Mini Perro Ranchero', precio: 7000, opciones: [PAPAS], foto: 'perro-gratinado',
      descripcion: 'Pan mini, salchicha mini ranchera, tocineta caramelizada, queso mozzarella, ripio de papa y salsas de la casa.' },
    { slug: 'el-sencillo', nombre: 'El Sencillo', precio: 10000, opciones: [PAPAS], foto: 'perro-ranchero',
      descripcion: 'Salchicha long, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa y salsas de la casa.' },
    { slug: 'ranchero-con-papas', nombre: 'Ranchero con papas', precio: 15000, foto: 'perro-ranchero',
      descripcion: 'Salchicha súper ranchera, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsa de la casa y huevo de codorniz.' },
    { slug: 'americano-con-papas', nombre: 'Americano con papas', precio: 15000, foto: 'perro-americano',
      descripcion: 'Salchicha americana, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsa de la casa y huevo de codorniz.' },
    { slug: 'chori-perro-con-papas', nombre: 'Chori Perro con papas', precio: 15000, foto: 'perro-americano',
      descripcion: 'Chorizo Zenú, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsas de la casa y huevo de codorniz.' },
    { slug: 'perro-suizo', nombre: 'Perro Suizo', precio: 25000, foto: 'perro-gratinado',
      descripcion: 'Salchicha suiza, tocineta x3, mozzarella x3, queso rallado asado y piña. ¡La salchicha se sale del pan!' },
    { slug: 'perro-triple-chiba', nombre: 'Perro Triple Chiba', precio: 25000, foto: 'perro-triple-chiba',
      descripcion: '3 salchichas de pollo asadas, 3 tocinetas, 3 mozzarellas, maíz, piña y queso rallado. Papas y Coca-Cola.' },
    { slug: 'peperroni', nombre: 'Peperroni', precio: 16000, foto: 'peperroni', etiqueta: 'Picantico',
      descripcion: 'Salchicha americana, cebolla asada, mozzarella, tocineta, salsa americana, mostaza y papas.' },
  ],
  'otras-cositas': [
    { slug: 'cajita-de-pollo', nombre: 'Cajita de Pollo', precio: 16000, foto: 'cajita-feliz',
      descripcion: 'Pollo en nuggets x12, papas, salsita de maíz, salsita leña y mozzarella.' },
    { slug: 'cajita-de-pollo-feliz', nombre: 'Cajita de Pollo Feliz', precio: 20000, foto: 'cajita-feliz',
      descripcion: '12 nuggets, papas, juguito de caja, chocolatina y ¡regalo sorpresa!' },
    { slug: 'papa-tornado', nombre: 'Papa Tornado', precio: 5000, foto: 'papa-tornado',
      descripcion: 'Papa frita apanada en espiral con salsa cheddar, salsa de maíz, salsa rosada, piña y queso rallado.' },
    { slug: 'patacon-con-todo', nombre: 'Patacón con todo', precio: 15000, foto: 'picada',
      descripcion: 'Plátano, hogao, carne y pollo desmechado, queso rallado, salsas y huevo de codorniz.' },
    { slug: 'chuzo-mixto', nombre: 'Chuzo Mixto', precio: 15000, foto: 'chuzo-mixto', descripcion: 'Con papas, arepa y queso rallado.' },
    { slug: 'desgaranado', nombre: 'Desgaranado', precio: 22000, opciones: gaseosas(1), foto: 'desgaranado',
      descripcion: 'Pollo, carne, maíz, chorizo, bollo limpio, ripio, salsas de la casa y gaseosa.' },
  ],
  asados: [
    { slug: 'carne-asada', nombre: 'Carne asada', precio: 20000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'pechuga-asada', nombre: 'Pechuga asada', precio: 20000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'chuleta-de-cerdo', nombre: 'Chuleta de cerdo', precio: 20000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'punta-gorda', nombre: 'Punta gorda', precio: 25000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'lomo-fino', nombre: 'Lomo fino', precio: 30000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'lomo-de-cerdo', nombre: 'Lomo de cerdo', precio: 25000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'costilla-de-cerdo-bbq', nombre: 'Costilla de cerdo BBQ', precio: 30000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'churrasco', nombre: 'Churrasco', precio: 32000, foto: 'asados', descripcion: ACOMPANADO },
    { slug: 'picada', nombre: 'Picada', precio: 20000, foto: 'picada', descripcion: `Carnes asadas para picar, del tamaño que quieras. ${ACOMPANADO}`,
      opciones: [{ titulo: 'Tamaño', elige: 1, opciones: [{ nombre: 'De 20K', extra: 0 }, { nombre: 'De 30K', extra: 10000 }, { nombre: 'De 50K', extra: 30000 }, { nombre: 'De 80K', extra: 60000 }] }] },
    { slug: 'ceviche-de-chicharron', nombre: 'Ceviche de chicharrón', precio: 25000, foto: 'asados', descripcion: ACOMPANADO },
  ],
  antojitos: [
    { slug: 'chorizo-con-arepa', nombre: 'Chorizo con arepa', precio: 9000, foto: 'picada', descripcion: '' },
    { slug: 'mazorquita', nombre: 'Mazorquita', precio: 8000, foto: 'asados', descripcion: '' },
    { slug: 'patacon-con-hogao', nombre: 'Patacón con hogao', precio: 9000, foto: 'picada', descripcion: '' },
    { slug: 'platano-aborrajado', nombre: 'Plátano aborrajado', precio: 8000, foto: null, descripcion: '' },
  ],
  micheladas: [
    michelada('frutos-rojos-con-todo', 'Frutos Rojos con todo', CON_TODO('Mango, manzana roja, fresa'), 12000, [0, 1000, 3000], 'michelada-rojos'),
    michelada('frutos-rojos-sencilla', 'Frutos Rojos sencilla', SENCILLA('Mango, manzana roja'), 10000, [0, 2000], 'michelada-rojos'),
    michelada('frutos-verdes-con-todo', 'Frutos Verdes con todo', CON_TODO('Mango, manzana verde, kiwi'), 12000, [0, 1000, 3000], 'michelada-verdes'),
    michelada('frutos-verdes-sencilla', 'Frutos Verdes sencilla', SENCILLA('Mango, manzana verde'), 10000, [0, 2000], 'michelada-verdes'),
    michelada('frutos-amarillos-con-todo', 'Frutos Amarillos con todo', CON_TODO('Mango, piña, maracuyá'), 12000, [0, 1000, 3000], 'michelada-amarillos'),
    michelada('frutos-amarillos-sencilla', 'Frutos Amarillos sencilla', SENCILLA('Mango, piña'), 10000, [0, 2000], 'michelada-amarillos-sencilla'),
    michelada('michelada-clasica', 'Michelada Clásica', 'Vaso escarchado, limón, tajín, hielo y rodaja de limón. Elige el nivel y tu bebida.', 6000, [0, 1000], 'michelada-clasica'),
  ],
  jugos: [
    jugo('lulo', 'Jugo de Lulo'), jugo('guayaba', 'Jugo de Guayaba'), jugo('tomate-de-arbol', 'Jugo de Tomate de árbol'),
    jugo('borojo', 'Jugo de Borojó'), jugo('guanabana', 'Jugo de Guanábana'), jugo('fresa', 'Jugo de Fresa'),
    jugo('mora', 'Jugo de Mora'), jugo('melon', 'Jugo de Melón'), jugo('pina', 'Jugo de Piña'),
    limonada('limonada-cerezada', 'Limonada Cerezada'), limonada('limonada-natural', 'Limonada Natural'), jugo('maracuya', 'Jugo de Maracuyá'),
    jugo('banano', 'Jugo de Banano'), jugo('zapote', 'Jugo de Zapote'), jugo('nispero', 'Jugo de Níspero'),
  ],
  bebidas: [
    { slug: 'mini-pet-postobon', nombre: 'Mini Pet Postobón 250 ml', precio: 2000, foto: null, descripcion: '' },
    { slug: 'mini-pet-coca-cola', nombre: 'Mini Pet Coca-Cola 250 ml', precio: 2500, foto: null, descripcion: '' },
    { slug: 'jugo-hit-litro', nombre: 'Jugo Hit litro (caja)', precio: 6000, foto: null, descripcion: '' },
    { slug: 'litro-coca-cola', nombre: 'Litro Coca-Cola', precio: 6000, foto: null, descripcion: '' },
    { slug: 'litro-postobon', nombre: 'Litro Postobón', precio: 5000, foto: null, descripcion: '' },
    { slug: 'coca-cola-1-65', nombre: 'Coca-Cola 1,65 L', precio: 8000, foto: null, descripcion: '' },
    { slug: 'agua-250', nombre: 'Agua 250 ml', precio: 1000, foto: null, descripcion: '' },
  ],
};

/** Portada de la web (la foto es la del producto; el dueño lo cambia desde la app). */
export const DESTACADO = { producto: 'smash-burger', titulo: 'La más chimba', foto: null };

/** Lista plana con categoría y orden, lista para generar SQL o la web. */
export function productosPlanos() {
  return CATEGORIAS.flatMap((c) => (PRODUCTOS[c.slug] ?? []).map((p, i) => ({
    ...p, categoria: c.slug, orden: i + 1, etiqueta: p.etiqueta ?? null,
    foto_url: p.foto ? `assets/img/menu/${p.foto}.webp` : null, activo: !p.oculto, opciones: p.opciones ?? [],
  })));
}
