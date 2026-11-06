-- =====================================================================
-- Quechimba Burger · Datos iniciales del menú
-- Copia del menú que hoy tiene la web. Ejecutar UNA vez después de las
-- migraciones. Precios y descripciones: PENDIENTE confirmar con el negocio.
-- =====================================================================

insert into public.categorias (slug, nombre, orden) values
  ('hamburguesas', 'Hamburguesas', 1),
  ('salchipapas',  'Salchipapas',  2),
  ('combos',       'Combos',       3),
  ('perros',       'Perros',       4),
  ('acompanantes', 'Para picar',   5),
  ('bebidas',      'Bebidas',      6);

insert into public.productos (slug, categoria_id, nombre, descripcion, precio, etiqueta, foto_url, orden)
select v.slug, c.id, v.nombre, v.descripcion, v.precio, v.etiqueta, v.foto_url, v.orden
from (values
  ('clasica',          'hamburguesas', 'La Clásica',             'Carne de res de 150 g, queso cheddar, lechuga, tomate, cebolla y salsa de la casa en pan brioche.', 18000, null,             'https://images.unsplash.com/photo-1603064752734-4c48eff53d05', 1),
  ('quechimba',        'hamburguesas', 'La Quechimba',           'Nuestro pan sellado "Que Chimba", carne de res, tocineta, queso fundido y salsas de la casa.',   29000, 'Más pedida',     'assets/img/quechimba.webp', 2),
  ('costena',          'hamburguesas', 'La Costeña',             'Carne de res, queso costeño a la plancha, maduro, suero atollabuey y un toque de ají dulce.',   25000, 'De la casa',     'https://images.unsplash.com/photo-1596662951482-0c4ba74a6df6', 3),
  ('bbq-bacon',        'hamburguesas', 'BBQ Bacon',              'Carne de res, cheddar, tocineta, aros de cebolla y salsa BBQ ahumada.',                          26000, null,             'https://images.unsplash.com/photo-1598182198871-d3f4ab4fd181', 4),
  ('smash-doble',      'hamburguesas', 'Smash Doble',            'Dos carnes smash bien doradas, queso americano, pepinillos, cebolla y mostaza.',                 24000, 'Nueva',          'https://images.unsplash.com/photo-1607013251379-e6eecfffe234', 5),
  ('crispy-chicken',   'hamburguesas', 'Crispy Chicken',         'Pechuga apanada crocante, ensalada de repollo, pepinillos y mayonesa picante.',                  22000, 'Picante',        'https://images.unsplash.com/photo-1606755962773-d324e0a13086', 6),
  ('salchipapa-quechimba', 'salchipapas', 'Salchipapa Quechimba', 'Papas, salchicha, pollo, maíz tierno, queso rallado y salsas de la casa.',                     25000, 'La estrella',    'assets/img/salchipapa-quechimba.webp', 1),
  ('salchipapa-de-nivel',  'salchipapas', 'Salchipapa De Nivel',  'Bien cargada: chorizo, queso asado, papas, salchicha, queso rallado y salsas.',                 40000, 'Para compartir', 'assets/img/salchipapa-de-nivel.webp', 2),
  ('salchipapa-familiar',  'salchipapas', 'Salchipapa Familiar',  'Bandeja grande con papas, salchicha, queso asado, gratinado y salsas de la casa.',               60000, null,             'assets/img/salchipapa-familiar.webp', 3),
  ('combo-quechimba',  'combos',       'Combo Quechimba',        'La Quechimba + papas francesas + bebida a elección.',                                            38000, 'Ahorras $5.000', 'https://images.unsplash.com/photo-1561758033-d89a9ad46330', 1),
  ('combo-clasico',    'combos',       'Combo Clásico',          'La Clásica + papas francesas + bebida a elección.',                                              27000, null,             'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5', 2),
  ('combo-x4',         'combos',       'Combo x4',               '4 hamburguesas, papas para compartir y gaseosa de 1,5 L.',                                       85000, 'Para 4',         'https://images.unsplash.com/photo-1610614819513-58e34989848b', 3),
  ('perro-clasico',    'perros',       'Perro Clásico',          'Salchicha americana, cebolla, papita ripio, queso rallado y salsas.',                            12000, null,             'https://images.unsplash.com/photo-1599599810694-b5b37304c041', 1),
  ('perro-quechimba',  'perros',       'Perro Quechimba',        'Salchicha de res, tocineta, queso gratinado, maíz tierno y pico de gallo.',                      18000, 'Más pedido',     'https://images.unsplash.com/photo-1619740455993-9e612b1af08a', 2),
  ('perro-ranchero',   'perros',       'Perro Ranchero',         'Salchicha ranchera, cebollín, queso mozzarella y salsa de ajo.',                                 15000, null,             'https://images.unsplash.com/photo-1613482084286-41f25b486fa2', 3),
  ('papas-francesas',  'acompanantes', 'Papas francesas',        'Porción de papas crocantes con la sal de la casa.',                                              7000,  null,             'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d', 1),
  ('papas-queso',      'acompanantes', 'Papas con queso y tocineta', 'Papas francesas bañadas en cheddar fundido y tocineta picada.',                              14000, null,             'https://images.unsplash.com/photo-1573080496219-bb080dd4f877', 2),
  ('aros-cebolla',     'acompanantes', 'Aros de cebolla',        'Aros apanados y crocantes con salsa de la casa para untar.',                                     9000,  null,             'https://images.unsplash.com/photo-1639024471283-03518883512d', 3),
  ('limonada',         'bebidas',      'Limonada de hierbabuena','Limón natural, hierbabuena fresca y mucho hielo.',                                               7000,  null,             'https://images.unsplash.com/photo-1621263764928-df1444c5e859', 1),
  ('jugo-mango',       'bebidas',      'Jugo de mango',          'Jugo natural en agua o en leche.',                                                               7000,  null,             'https://images.unsplash.com/photo-1546173159-315724a31696', 2),
  ('malteada-cookies', 'bebidas',      'Malteada cookies & cream','Helado de vainilla, galleta de chocolate triturada y crema batida.',                            13000, null,             'https://images.unsplash.com/photo-1572490122747-3968b75cc699', 3),
  ('malteada-fresa',   'bebidas',      'Malteada de fresa',      'Fresas naturales, helado de vainilla y crema batida.',                                           12000, null,             'https://images.unsplash.com/photo-1579954115545-a95591f28bfc', 4),
  ('te-helado',        'bebidas',      'Té helado de limón',     'Preparado en casa, bien frío.',                                                                  6000,  null,             'https://images.unsplash.com/photo-1556679343-c7306c1976bc', 5)
) as v (slug, cat, nombre, descripcion, precio, etiqueta, foto_url, orden)
join public.categorias c on c.slug = v.cat;

-- Producto destacado de la web y dirección del sitio (para ver fotos locales desde la app)
update public.ajustes set
  producto_destacado_id = (select id from public.productos where slug = 'salchipapa-de-nivel'),
  titulo_destacado      = 'La estrella de la casa',
  foto_destacado_url    = 'assets/img/promo-salchipapa.webp',
  url_sitio             = 'https://raw.githubusercontent.com/danteruedas123-glitch/QueChimbaBurguer/web/'
where id = 1;
