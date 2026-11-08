-- =====================================================================
-- Quechimba Burger · REEMPLAZAR EL MENÚ POR EL MENÚ REAL
-- GENERADO desde supabase/menu.mjs con "npm run menu:generar". No editar aquí.
-- Pegar TODO en Supabase → SQL Editor → Run (una vez), DESPUÉS de las
-- migraciones 08, 09 y 10.
-- • Crea o actualiza las 11 categorías y los 96 productos del menú real.
-- • Los productos viejos que NUNCA se vendieron se borran; los que ya tienen
--   ventas se ocultan (la contabilidad histórica no cambia).
-- • La web se actualiza sola en segundos (aviso en vivo de la migración 07).
-- =====================================================================
begin;

insert into public.categorias (slug, nombre, orden) values
  ('hamburguesas', 'Hamburguesas', 1),
  ('combitos', 'Combitos de hamburguesa', 2),
  ('combos', 'Combos', 3),
  ('salchipapas', 'Salchi menú', 4),
  ('perros', 'Menú dog', 5),
  ('otras-cositas', 'Otras cositas', 6),
  ('asados', 'Asados', 7),
  ('antojitos', 'Antojitos', 8),
  ('micheladas', 'Micheladas', 9),
  ('jugos', 'Jugos naturales', 10),
  ('bebidas', 'Bebidas', 11)
on conflict (slug) do update set nombre = excluded.nombre, orden = excluded.orden, activa = true;

insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, activo, orden, opciones)
select v.slug, c.id, v.nombre, v.descripcion, v.precio, v.etiqueta, v.foto_url, v.activo, v.orden, v.opciones
from (values
  ('mini-burger', 'hamburguesas', 'Mini Burger', '60 g de carne.', 6000, null, 'assets/img/menu/mini-burgers.webp', true, 1, '[]'::jsonb),
  ('chimbita-burger', 'hamburguesas', 'Chimbita Burger', '150 g de carne, queso mozzarella, doble tocineta, jamón, pepinillo, cebolla y tocineta caramelizada, pan ajonjolí o artesanal, papas y gaseosa.', 23000, null, 'assets/img/menu/chimbita.webp', true, 2, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('doble-chimba', 'hamburguesas', 'Doble Chimba', '230 g de carne, doble tocineta, doble mozzarella, pepinillo, cebolla caramelizada, pan artesanal, papas y gaseosa.', 30000, null, 'assets/img/menu/doble-chimba.webp', true, 3, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('classic-burger', 'hamburguesas', 'Classic Burger', '130 g de carne, tocineta, cebolla caramelizada, mozzarella, lechuga y papas.', 17000, null, 'assets/img/menu/classic.webp', true, 4, '[]'::jsonb),
  ('burger-chori', 'hamburguesas', 'Burger Chori', '130 g de carne y chorizo, doble tocineta, doble queso mozzarella, cebolla caramelizada, salsas de la casa, papas y gaseosa.', 25000, null, 'assets/img/menu/burger-chori.webp', true, 5, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('la-grilla', 'hamburguesas', 'La Grilla', '150 g de carne, queso costeño asado, chorizo asado, tocineta y cebolla caramelizada, pepinillo, papas y gaseosa.', 25000, null, 'assets/img/menu/la-grilla.webp', true, 6, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('la-de-pollo', 'hamburguesas', 'La de Pollo', '130 g de carne de pollo y papas.', 17000, null, 'assets/img/menu/la-de-pollo.webp', true, 7, '[]'::jsonb),
  ('la-mixta', 'hamburguesas', 'La Mixta', 'Carne de res, carne de pollo apanado crocante, 3 tocinetas, 2 jamones, 2 mozzarellas, papas y gaseosa.', 30000, null, 'assets/img/menu/la-mixta.webp', true, 8, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('smash-burger', 'hamburguesas', 'Smash Burger', 'Doble carne smash, cebolla asada, mozzarella y tocineta. ¡Que no falte! Porción de papas y Coca-Cola.', 30000, 'La más chimba', 'assets/img/menu/smash.webp', true, 9, '[]'::jsonb),
  ('dorichimba', 'hamburguesas', 'Dorichimba', '200 g de carne artesanal ¡una chimba!, mozzarella, cebolla asada, un paquete de Doritos, papas y Coca-Cola.', 30000, '¡De locos!', 'assets/img/menu/dorichimba.webp', true, 10, '[]'::jsonb),
  ('montanera', 'hamburguesas', 'Montañera', 'Carne Angus, mozzarella, queso asado y bañado en miel, piña asada, tajadas de maduro, salsa súper de la casa, papas y Coca-Cola.', 30000, null, 'assets/img/menu/montanera.webp', true, 11, '[]'::jsonb),
  ('triple-chimba-burger', 'hamburguesas', 'Triple Chimba Burger', '3 carnes Angus, 5 tocinetas, 4 jamones, 4 mozzarellas, pepinillo, papa y Coca-Cola PET 400.', 35000, null, 'assets/img/menu/triple-chimba.webp', true, 12, '[]'::jsonb),
  ('combo-x4', 'combitos', 'Combo x4', '4 mini burger y 1 porción de papas.', 24000, null, 'assets/img/menu/combo-x4.webp', true, 1, '[]'::jsonb),
  ('combo-melo', 'combitos', 'Combo Melo', '1 Chimbita Burger, 1 Classic Burger, 2 porciones de papas y 2 gaseosas.', 45000, null, 'assets/img/menu/combo-melo.webp', true, 2, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('chimba-de-combo', 'combitos', 'Chimba de Combo', '1 Classic Burger, 1 hamburguesa mixta, 2 porciones de papas y 2 gaseosas.', 45000, null, 'assets/img/menu/combo-plato.webp', true, 3, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('combo-chimbita', 'combitos', 'Combo Chimbita', '1 Chimbita Burger, 1 Dorichimba, 1 Classic Burger, 3 porciones de papas y 3 gaseosas.', 60000, null, 'assets/img/menu/chimbita.webp', true, 4, '[{"titulo":"Gaseosas","elige":3,"lista":"gaseosas"}]'::jsonb),
  ('combo-gorditas', 'combitos', 'Combo Gorditas', '2 mini burger especiales, 1 porción de papas y 1 gaseosa.', 25000, null, 'assets/img/menu/combo-minis.webp', true, 5, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-chuzito', 'combitos', 'Combo Chuzito', '1 chuzo mixto, 1 mini burger, 1 porción de papa, 1 arepa y 1 gaseosa.', 22000, null, 'assets/img/menu/combo-chuzito.webp', true, 6, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-remelo', 'combitos', 'Combo Remelo', '1 salchi de 30K, 1 Classic Burger, 1 porción de papas y 1 gaseosa.', 50000, null, 'assets/img/menu/salchi-30k.webp', true, 7, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-1', 'combos', 'Combo 1', '1 hamburguesa mixta (120 g de carne y 120 g de pollo), 1 perro americano, 2 porciones de papas y 1 gaseosa.', 45000, null, 'assets/img/menu/perro-americano.webp', true, 1, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-2', 'combos', 'Combo 2', '1 perro de $15.000 (a elección), 1 Chimba Burger, 2 porciones de papas y 2 gaseosas.', 40000, null, 'assets/img/menu/perro-ranchero.webp', true, 2, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('combo-3', 'combos', 'Combo 3', '3 mini burger, 1 porción de papas grandes y 1 gaseosa.', 20000, null, 'assets/img/menu/combo-3.webp', true, 3, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-4', 'combos', 'Combo 4', '2 Classic Burger, 2 papas, 2 gaseosas y 1 mini perro.', 40000, null, 'assets/img/menu/combo-miniperros.webp', true, 4, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('combo-5', 'combos', 'Combo 5', '1 cajita de pollo, 1 perro sencillo, 1 porción de papas y 1 gaseosa.', 30000, null, 'assets/img/menu/cajita-feliz.webp', true, 5, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-6', 'combos', 'Combo 6', '1 salchi sencilla, 1 perro sencillo y 1 gaseosa.', 25000, null, 'assets/img/menu/salchi-sencilla.webp', true, 6, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-7', 'combos', 'Combo 7', '1 hamburguesa mixta, 1 salchi sencilla, 1 perro sencillo, 1 porción de papas y 2 gaseosas.', 50000, null, 'assets/img/menu/combo-plato.webp', true, 7, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('combo-8', 'combos', 'Combo 8', '1 salchi de 30, 1 Chimbita Burger, 1 porción de papas y 2 gaseosas.', 50000, null, 'assets/img/menu/salchichimba.webp', true, 8, '[{"titulo":"Gaseosas","elige":2,"lista":"gaseosas"}]'::jsonb),
  ('combo-9', 'combos', 'Combo 9', '1 salchi de 50, 1 Chimbita Burger, 1 perro americano, 2 porciones de papas y 1 gaseosa.', 85000, null, 'assets/img/menu/salchi-50k.webp', true, 9, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('combo-10', 'combos', 'Combo 10', '1 Salchichimba, 1 Chimbita Burger, 1 perro de $15.000 (a elección), 2 porciones de papas y 1 litro de Postobón.', 60000, null, 'assets/img/menu/desgaranado.webp', true, 10, '[]'::jsonb),
  ('rompedieta', 'combos', 'Rompedieta', '2 smash burger, tocineta con papas, aros de cebolla y Doritos. ¡La caja más chimba!', 50000, 'La caja más chimba', 'assets/img/menu/rompedieta.webp', true, 11, '[]'::jsonb),
  ('combo-aletoso', 'combos', 'Combo Aletoso', '6 alitas bañadas en salsa de la casa (opcional) con papas.', 20000, null, null, true, 12, '[]'::jsonb),
  ('salchi-sencilla', 'salchipapas', 'Salchi Sencilla', 'Papas, chorizo, salchicha, butifarra, lechuga, queso rallado y salsas de la casa.', 15000, null, 'assets/img/menu/salchi-sencilla.webp', true, 1, '[]'::jsonb),
  ('salchichimba', 'salchipapas', 'Salchichimba', 'Papas, chorizo, salchicha ranchera, butifarra, carne, pollo, maíz tierno, queso mozzarella, ripio de papa, lechuga, queso rallado y salsas de la casa.', 23000, null, 'assets/img/menu/salchichimba.webp', true, 2, '[]'::jsonb),
  ('la-de-30k', 'salchipapas', 'La de 30K', 'Lo mismo de la Salchichimba pero en más cantidad, con salchicha súper ranchera y huevo de codorniz.', 30000, null, 'assets/img/menu/salchi-30k.webp', true, 3, '[]'::jsonb),
  ('la-de-50k', 'salchipapas', 'La de 50K', 'Más cantidad que «La de 30K», con 2 súper rancheras, tocineta y huevo de codorniz.', 50000, 'Para 5 personas', 'assets/img/menu/salchi-50k.webp', true, 4, '[]'::jsonb),
  ('la-de-80k', 'salchipapas', 'La de 80K', 'Salchicha suiza, ranchera, de pollo y americana, chorizo santandereano, butifarra, carne de res, pollo en trozos, carne y pollo desmechado ¡y todo lo demás! Que chimba.', 80000, null, 'assets/img/menu/desgaranado.webp', true, 5, '[]'::jsonb),
  ('ranchera-personal', 'salchipapas', 'La Ranchera Personal', 'Salchicha ranchera, papas, lechuga, queso rallado, papa ripio, salsas de la casa, piña rosada y tártara.', 18000, null, 'assets/img/menu/salchi-30k.webp', true, 6, '[]'::jsonb),
  ('ranchera-para-2', 'salchipapas', 'La Ranchera para 2', 'Salchicha ranchera, súper ranchera, carne y pollo asado.', 30000, 'Para 2', 'assets/img/menu/salchi-50k.webp', true, 7, '[]'::jsonb),
  ('mini-perro', 'perros', 'Mini Perro', 'Pan mini, salchicha mini, tocineta caramelizada, queso mozzarella, ripio de papa y salsas de la casa.', 6000, null, 'assets/img/menu/combo-miniperros.webp', true, 1, '[{"titulo":"Papas","elige":1,"opciones":[{"nombre":"Sin papas","extra":0},{"nombre":"Con papas","extra":2000}]}]'::jsonb),
  ('mini-perro-ranchero', 'perros', 'Mini Perro Ranchero', 'Pan mini, salchicha mini ranchera, tocineta caramelizada, queso mozzarella, ripio de papa y salsas de la casa.', 7000, null, 'assets/img/menu/perro-gratinado.webp', true, 2, '[{"titulo":"Papas","elige":1,"opciones":[{"nombre":"Sin papas","extra":0},{"nombre":"Con papas","extra":2000}]}]'::jsonb),
  ('el-sencillo', 'perros', 'El Sencillo', 'Salchicha long, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa y salsas de la casa.', 10000, null, 'assets/img/menu/perro-ranchero.webp', true, 3, '[{"titulo":"Papas","elige":1,"opciones":[{"nombre":"Sin papas","extra":0},{"nombre":"Con papas","extra":2000}]}]'::jsonb),
  ('ranchero-con-papas', 'perros', 'Ranchero con papas', 'Salchicha súper ranchera, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsa de la casa y huevo de codorniz.', 15000, null, 'assets/img/menu/perro-ranchero.webp', true, 4, '[]'::jsonb),
  ('americano-con-papas', 'perros', 'Americano con papas', 'Salchicha americana, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsa de la casa y huevo de codorniz.', 15000, null, 'assets/img/menu/perro-americano.webp', true, 5, '[]'::jsonb),
  ('chori-perro-con-papas', 'perros', 'Chori Perro con papas', 'Chorizo Zenú, jamón, tocineta y cebolla caramelizada, queso mozzarella, ripio de papa, salsas de la casa y huevo de codorniz.', 15000, null, 'assets/img/menu/perro-americano.webp', true, 6, '[]'::jsonb),
  ('perro-suizo', 'perros', 'Perro Suizo', 'Salchicha suiza, tocineta x3, mozzarella x3, queso rallado asado y piña. ¡La salchicha se sale del pan!', 25000, null, 'assets/img/menu/perro-gratinado.webp', true, 7, '[]'::jsonb),
  ('perro-triple-chiba', 'perros', 'Perro Triple Chiba', '3 salchichas de pollo asadas, 3 tocinetas, 3 mozzarellas, maíz, piña y queso rallado. Papas y Coca-Cola.', 25000, null, 'assets/img/menu/perro-triple-chiba.webp', true, 8, '[]'::jsonb),
  ('peperroni', 'perros', 'Peperroni', 'Salchicha americana, cebolla asada, mozzarella, tocineta, salsa americana, mostaza y papas.', 16000, 'Picantico', 'assets/img/menu/peperroni.webp', true, 9, '[]'::jsonb),
  ('cajita-de-pollo', 'otras-cositas', 'Cajita de Pollo', 'Pollo en nuggets x12, papas, salsita de maíz, salsita leña y mozzarella.', 16000, null, 'assets/img/menu/cajita-feliz.webp', true, 1, '[]'::jsonb),
  ('cajita-de-pollo-feliz', 'otras-cositas', 'Cajita de Pollo Feliz', '12 nuggets, papas, juguito de caja, chocolatina y ¡regalo sorpresa!', 20000, null, 'assets/img/menu/cajita-feliz.webp', true, 2, '[]'::jsonb),
  ('papa-tornado', 'otras-cositas', 'Papa Tornado', 'Papa frita apanada en espiral con salsa cheddar, salsa de maíz, salsa rosada, piña y queso rallado.', 5000, null, 'assets/img/menu/papa-tornado.webp', true, 3, '[]'::jsonb),
  ('patacon-con-todo', 'otras-cositas', 'Patacón con todo', 'Plátano, hogao, carne y pollo desmechado, queso rallado, salsas y huevo de codorniz.', 15000, null, 'assets/img/menu/picada.webp', true, 4, '[]'::jsonb),
  ('chuzo-mixto', 'otras-cositas', 'Chuzo Mixto', 'Con papas, arepa y queso rallado.', 15000, null, 'assets/img/menu/chuzo-mixto.webp', true, 5, '[]'::jsonb),
  ('desgaranado', 'otras-cositas', 'Desgaranado', 'Pollo, carne, maíz, chorizo, bollo limpio, ripio, salsas de la casa y gaseosa.', 22000, null, 'assets/img/menu/desgaranado.webp', true, 6, '[{"titulo":"Gaseosa","elige":1,"lista":"gaseosas"}]'::jsonb),
  ('carne-asada', 'asados', 'Carne asada', 'Acompañado con papa frita, yuca o patacón.', 20000, null, 'assets/img/menu/asados.webp', true, 1, '[]'::jsonb),
  ('pechuga-asada', 'asados', 'Pechuga asada', 'Acompañado con papa frita, yuca o patacón.', 20000, null, 'assets/img/menu/asados.webp', true, 2, '[]'::jsonb),
  ('chuleta-de-cerdo', 'asados', 'Chuleta de cerdo', 'Acompañado con papa frita, yuca o patacón.', 20000, null, 'assets/img/menu/asados.webp', true, 3, '[]'::jsonb),
  ('punta-gorda', 'asados', 'Punta gorda', 'Acompañado con papa frita, yuca o patacón.', 25000, null, 'assets/img/menu/asados.webp', true, 4, '[]'::jsonb),
  ('lomo-fino', 'asados', 'Lomo fino', 'Acompañado con papa frita, yuca o patacón.', 30000, null, 'assets/img/menu/asados.webp', true, 5, '[]'::jsonb),
  ('lomo-de-cerdo', 'asados', 'Lomo de cerdo', 'Acompañado con papa frita, yuca o patacón.', 25000, null, 'assets/img/menu/asados.webp', true, 6, '[]'::jsonb),
  ('costilla-de-cerdo-bbq', 'asados', 'Costilla de cerdo BBQ', 'Acompañado con papa frita, yuca o patacón.', 30000, null, 'assets/img/menu/asados.webp', true, 7, '[]'::jsonb),
  ('churrasco', 'asados', 'Churrasco', 'Acompañado con papa frita, yuca o patacón.', 32000, null, 'assets/img/menu/asados.webp', true, 8, '[]'::jsonb),
  ('picada', 'asados', 'Picada', 'Carnes asadas para picar, del tamaño que quieras. Acompañado con papa frita, yuca o patacón.', 20000, null, 'assets/img/menu/picada.webp', true, 9, '[{"titulo":"Tamaño","elige":1,"opciones":[{"nombre":"De 20K","extra":0},{"nombre":"De 30K","extra":10000},{"nombre":"De 50K","extra":30000},{"nombre":"De 80K","extra":60000}]}]'::jsonb),
  ('ceviche-de-chicharron', 'asados', 'Ceviche de chicharrón', 'Acompañado con papa frita, yuca o patacón.', 25000, null, 'assets/img/menu/asados.webp', true, 10, '[]'::jsonb),
  ('chorizo-con-arepa', 'antojitos', 'Chorizo con arepa', '', 9000, null, 'assets/img/menu/picada.webp', true, 1, '[]'::jsonb),
  ('mazorquita', 'antojitos', 'Mazorquita', '', 8000, null, 'assets/img/menu/asados.webp', true, 2, '[]'::jsonb),
  ('patacon-con-hogao', 'antojitos', 'Patacón con hogao', '', 9000, null, 'assets/img/menu/picada.webp', true, 3, '[]'::jsonb),
  ('platano-aborrajado', 'antojitos', 'Plátano aborrajado', '', 8000, null, null, true, 4, '[]'::jsonb),
  ('frutos-rojos-con-todo', 'micheladas', 'Frutos Rojos con todo', 'Mango, manzana roja, fresa, cerezas, bombombún, masmelo, trululú, tira de caramelo, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 12000, null, 'assets/img/menu/michelada-rojos.webp', true, 1, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":1000},{"nombre":"Súper cargada","extra":3000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('frutos-rojos-sencilla', 'micheladas', 'Frutos Rojos sencilla', 'Mango, manzana roja, cerezas, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 10000, null, 'assets/img/menu/michelada-rojos.webp', true, 2, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":2000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('frutos-verdes-con-todo', 'micheladas', 'Frutos Verdes con todo', 'Mango, manzana verde, kiwi, cerezas, bombombún, masmelo, trululú, tira de caramelo, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 12000, null, 'assets/img/menu/michelada-verdes.webp', true, 3, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":1000},{"nombre":"Súper cargada","extra":3000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('frutos-verdes-sencilla', 'micheladas', 'Frutos Verdes sencilla', 'Mango, manzana verde, cerezas, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 10000, null, 'assets/img/menu/michelada-verdes.webp', true, 4, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":2000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('frutos-amarillos-con-todo', 'micheladas', 'Frutos Amarillos con todo', 'Mango, piña, maracuyá, cerezas, bombombún, masmelo, trululú, tira de caramelo, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 12000, null, 'assets/img/menu/michelada-amarillos.webp', true, 5, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":1000},{"nombre":"Súper cargada","extra":3000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('frutos-amarillos-sencilla', 'micheladas', 'Frutos Amarillos sencilla', 'Mango, piña, cerezas, limón, tajín, hielo y vaso escarchado. Elige el nivel (la normal lleva menos fruta) y tu bebida.', 10000, null, 'assets/img/menu/michelada-amarillos-sencilla.webp', true, 6, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":2000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('michelada-clasica', 'micheladas', 'Michelada Clásica', 'Vaso escarchado, limón, tajín, hielo y rodaja de limón. Elige el nivel y tu bebida.', 6000, null, 'assets/img/menu/michelada-clasica.webp', true, 7, '[{"titulo":"Nivel","elige":1,"opciones":[{"nombre":"Normal","extra":0},{"nombre":"Cargada","extra":1000}]},{"titulo":"Bebida","elige":1,"lista":"bebidas_michelada"}]'::jsonb),
  ('jugo-lulo', 'jugos', 'Jugo de Lulo', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-lulo.webp', true, 1, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-guayaba', 'jugos', 'Jugo de Guayaba', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-guayaba.webp', true, 2, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-tomate-de-arbol', 'jugos', 'Jugo de Tomate de árbol', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-tomate-de-arbol.webp', true, 3, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-borojo', 'jugos', 'Jugo de Borojó', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-borojo.webp', true, 4, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-guanabana', 'jugos', 'Jugo de Guanábana', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-guanabana.webp', true, 5, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-fresa', 'jugos', 'Jugo de Fresa', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-fresa.webp', true, 6, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-mora', 'jugos', 'Jugo de Mora', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-mora.webp', true, 7, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-melon', 'jugos', 'Jugo de Melón', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-melon.webp', true, 8, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-pina', 'jugos', 'Jugo de Piña', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-pina.webp', true, 9, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-limonada-cerezada', 'jugos', 'Limonada Cerezada', 'Natural y bien fría.', 8000, null, 'assets/img/menu/jugo-limonada-cerezada.webp', true, 10, '[]'::jsonb),
  ('jugo-limonada-natural', 'jugos', 'Limonada Natural', 'Natural y bien fría.', 8000, null, 'assets/img/menu/jugo-limonada-natural.webp', true, 11, '[]'::jsonb),
  ('jugo-maracuya', 'jugos', 'Jugo de Maracuyá', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-maracuya.webp', true, 12, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-banano', 'jugos', 'Jugo de Banano', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-banano.webp', true, 13, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-zapote', 'jugos', 'Jugo de Zapote', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-zapote.webp', true, 14, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('jugo-nispero', 'jugos', 'Jugo de Níspero', 'Fruta fresca, 100 % natural. En agua o en leche.', 8000, null, 'assets/img/menu/jugo-nispero.webp', true, 15, '[{"titulo":"Preparación","elige":1,"opciones":[{"nombre":"En agua","extra":0},{"nombre":"En leche","extra":2000}]}]'::jsonb),
  ('mini-pet-postobon', 'bebidas', 'Mini Pet Postobón 250 ml', '', 2000, null, null, true, 1, '[]'::jsonb),
  ('mini-pet-coca-cola', 'bebidas', 'Mini Pet Coca-Cola 250 ml', '', 2500, null, null, true, 2, '[]'::jsonb),
  ('jugo-hit-litro', 'bebidas', 'Jugo Hit litro (caja)', '', 6000, null, null, true, 3, '[]'::jsonb),
  ('litro-coca-cola', 'bebidas', 'Litro Coca-Cola', '', 6000, null, null, true, 4, '[]'::jsonb),
  ('litro-postobon', 'bebidas', 'Litro Postobón', '', 5000, null, null, true, 5, '[]'::jsonb),
  ('coca-cola-1-65', 'bebidas', 'Coca-Cola 1,65 L', '', 8000, null, null, true, 6, '[]'::jsonb),
  ('agua-250', 'bebidas', 'Agua 250 ml', '', 1000, null, null, true, 7, '[]'::jsonb)
) as v (slug, cat, nombre, descripcion, precio, etiqueta, foto_url, activo, orden, opciones)
join public.categorias c on c.slug = v.cat
on conflict (slug) do update set
  categoria_id = excluded.categoria_id, nombre = excluded.nombre, descripcion = excluded.descripcion,
  precio = excluded.precio, etiqueta = excluded.etiqueta, foto_url = excluded.foto_url,
  activo = excluded.activo, agotado = false, orden = excluded.orden, opciones = excluded.opciones;

-- Menú viejo: se borra lo que nunca se vendió y se oculta lo que sí
delete from public.productos p
where p.slug not in ('mini-burger', 'chimbita-burger', 'doble-chimba', 'classic-burger', 'burger-chori', 'la-grilla', 'la-de-pollo', 'la-mixta', 'smash-burger', 'dorichimba', 'montanera', 'triple-chimba-burger', 'combo-x4', 'combo-melo', 'chimba-de-combo', 'combo-chimbita', 'combo-gorditas', 'combo-chuzito', 'combo-remelo', 'combo-1', 'combo-2', 'combo-3', 'combo-4', 'combo-5', 'combo-6', 'combo-7', 'combo-8', 'combo-9', 'combo-10', 'rompedieta', 'combo-aletoso', 'salchi-sencilla', 'salchichimba', 'la-de-30k', 'la-de-50k', 'la-de-80k', 'ranchera-personal', 'ranchera-para-2', 'mini-perro', 'mini-perro-ranchero', 'el-sencillo', 'ranchero-con-papas', 'americano-con-papas', 'chori-perro-con-papas', 'perro-suizo', 'perro-triple-chiba', 'peperroni', 'cajita-de-pollo', 'cajita-de-pollo-feliz', 'papa-tornado', 'patacon-con-todo', 'chuzo-mixto', 'desgaranado', 'carne-asada', 'pechuga-asada', 'chuleta-de-cerdo', 'punta-gorda', 'lomo-fino', 'lomo-de-cerdo', 'costilla-de-cerdo-bbq', 'churrasco', 'picada', 'ceviche-de-chicharron', 'chorizo-con-arepa', 'mazorquita', 'patacon-con-hogao', 'platano-aborrajado', 'frutos-rojos-con-todo', 'frutos-rojos-sencilla', 'frutos-verdes-con-todo', 'frutos-verdes-sencilla', 'frutos-amarillos-con-todo', 'frutos-amarillos-sencilla', 'michelada-clasica', 'jugo-lulo', 'jugo-guayaba', 'jugo-tomate-de-arbol', 'jugo-borojo', 'jugo-guanabana', 'jugo-fresa', 'jugo-mora', 'jugo-melon', 'jugo-pina', 'jugo-limonada-cerezada', 'jugo-limonada-natural', 'jugo-maracuya', 'jugo-banano', 'jugo-zapote', 'jugo-nispero', 'mini-pet-postobon', 'mini-pet-coca-cola', 'jugo-hit-litro', 'litro-coca-cola', 'litro-postobon', 'coca-cola-1-65', 'agua-250')
  and not exists (select 1 from public.pedido_items i where i.producto_id = p.id);
update public.productos set activo = false
where slug not in ('mini-burger', 'chimbita-burger', 'doble-chimba', 'classic-burger', 'burger-chori', 'la-grilla', 'la-de-pollo', 'la-mixta', 'smash-burger', 'dorichimba', 'montanera', 'triple-chimba-burger', 'combo-x4', 'combo-melo', 'chimba-de-combo', 'combo-chimbita', 'combo-gorditas', 'combo-chuzito', 'combo-remelo', 'combo-1', 'combo-2', 'combo-3', 'combo-4', 'combo-5', 'combo-6', 'combo-7', 'combo-8', 'combo-9', 'combo-10', 'rompedieta', 'combo-aletoso', 'salchi-sencilla', 'salchichimba', 'la-de-30k', 'la-de-50k', 'la-de-80k', 'ranchera-personal', 'ranchera-para-2', 'mini-perro', 'mini-perro-ranchero', 'el-sencillo', 'ranchero-con-papas', 'americano-con-papas', 'chori-perro-con-papas', 'perro-suizo', 'perro-triple-chiba', 'peperroni', 'cajita-de-pollo', 'cajita-de-pollo-feliz', 'papa-tornado', 'patacon-con-todo', 'chuzo-mixto', 'desgaranado', 'carne-asada', 'pechuga-asada', 'chuleta-de-cerdo', 'punta-gorda', 'lomo-fino', 'lomo-de-cerdo', 'costilla-de-cerdo-bbq', 'churrasco', 'picada', 'ceviche-de-chicharron', 'chorizo-con-arepa', 'mazorquita', 'patacon-con-hogao', 'platano-aborrajado', 'frutos-rojos-con-todo', 'frutos-rojos-sencilla', 'frutos-verdes-con-todo', 'frutos-verdes-sencilla', 'frutos-amarillos-con-todo', 'frutos-amarillos-sencilla', 'michelada-clasica', 'jugo-lulo', 'jugo-guayaba', 'jugo-tomate-de-arbol', 'jugo-borojo', 'jugo-guanabana', 'jugo-fresa', 'jugo-mora', 'jugo-melon', 'jugo-pina', 'jugo-limonada-cerezada', 'jugo-limonada-natural', 'jugo-maracuya', 'jugo-banano', 'jugo-zapote', 'jugo-nispero', 'mini-pet-postobon', 'mini-pet-coca-cola', 'jugo-hit-litro', 'litro-coca-cola', 'litro-postobon', 'coca-cola-1-65', 'agua-250');
delete from public.categorias c
where c.slug not in ('hamburguesas', 'combitos', 'combos', 'salchipapas', 'perros', 'otras-cositas', 'asados', 'antojitos', 'micheladas', 'jugos', 'bebidas')
  and not exists (select 1 from public.productos p where p.categoria_id = c.id);
update public.categorias set activa = false
where slug not in ('hamburguesas', 'combitos', 'combos', 'salchipapas', 'perros', 'otras-cositas', 'asados', 'antojitos', 'micheladas', 'jugos', 'bebidas');

update public.ajustes set
  producto_destacado_id = (select id from public.productos where slug = 'smash-burger'),
  titulo_destacado      = 'La más chimba',
  foto_destacado_url    = null,
  bebidas_gaseosa       = array['Coca-Cola', 'Coca-Cola Zero', 'Postobón Manzana', 'Postobón Colombiana', 'Pepsi', 'Ginger'],
  bebidas_michelada     = array['Ginger', 'Bretaña', 'Soda Hatsu', 'Bretaña Hard Seltzer', 'Like', 'Cuates', 'Smirnoff', 'Club Colombia', 'Coronita', 'Miller Lite', 'Águila', 'Budweiser', 'Heineken', 'Cola y Pola', 'Póker']
where id = 1;

commit;
