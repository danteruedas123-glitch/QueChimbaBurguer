/* =====================================================================
   QUECHIMBA BURGER — DATOS DEL NEGOCIO
   ---------------------------------------------------------------------
   Este es el ÚNICO archivo que hay que editar para cambiar precios,
   productos, horario, teléfono, dirección o redes sociales.
   El resto del sitio se actualiza solo.

   ⚠️  Los datos marcados con  // PENDIENTE  son de ejemplo y deben
       reemplazarse por los reales antes de publicar el sitio.
   ===================================================================== */
window.QB_CONFIG = {
  negocio: {
    nombre: 'Quechimba Burger',
    whatsapp: '573042987537',            // solo números, con 57 adelante
    telefonoVisible: '304 298 7537',
    direccion: 'Barrio La Florencia',    // PENDIENTE · agregar calle y número exactos
    barrio: 'al lado de San Fernando',
    ciudad: 'Valledupar, Cesar',
    mapaBusqueda: 'Barrio La Florencia, Valledupar, Cesar', // PENDIENTE · afinar con la dirección exacta
    correo: '',                          // PENDIENTE · dejar '' para ocultar
    instagram: 'https://www.instagram.com/quechimbaburger1/',
    facebook: '',                        // PENDIENTE · dejar '' para ocultar
    zonaHoraria: 'America/Bogota',
    mensajeWhatsApp: '¡Hola, Quechimba Burger! 🍔 Quiero hacer un pedido.',
    mediosDePago: ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia'],
    notaDomicilio: '+ valor del domicilio'
  },

  /* Horario · dia: 0 = domingo, 1 = lunes … 6 = sábado.
     Horas en formato 24 h. Si cierra después de medianoche, pon la hora
     real (ej. '01:00'). Para un día cerrado, simplemente bórralo. */
  horario: [                              // PENDIENTE
    { dia: 1, abre: '17:00', cierra: '23:00' },
    { dia: 2, abre: '17:00', cierra: '23:00' },
    { dia: 3, abre: '17:00', cierra: '23:00' },
    { dia: 4, abre: '17:00', cierra: '23:00' },
    { dia: 5, abre: '17:00', cierra: '01:00' },
    { dia: 6, abre: '17:00', cierra: '01:00' },
    { dia: 0, abre: '16:00', cierra: '23:00' }
  ],

  /* Categorías en el orden en que aparecen en el menú */
  categorias: [
    { id: 'hamburguesas', nombre: 'Hamburguesas', },
    { id: 'salchipapas',  nombre: 'Salchipapas',  },
    { id: 'combos',       nombre: 'Combos',       },
    { id: 'perros',       nombre: 'Perros',       },
    { id: 'acompanantes', nombre: 'Para picar',   },
    { id: 'bebidas',      nombre: 'Bebidas',      }
  ],

  /* Productos · PENDIENTE: confirmar nombres, descripciones y precios con el negocio.
     Las fotos reales (de su Instagram) están en assets/img/; el resto son de ejemplo.
     - precio: en pesos, sin puntos (18000 = $18.000)
     - etiqueta: texto corto opcional ('Más pedida', 'Nueva', 'Picante'…)
     - foto: ruta local (fotos reales en assets/img/) o enlace de Unsplash (fotos de ejemplo) */
  productos: [
    { id: 'clasica', categoria: 'hamburguesas', nombre: 'La Clásica', precio: 18000,
      descripcion: 'Carne de res de 150 g, queso cheddar, lechuga, tomate, cebolla y salsa de la casa en pan brioche.',
      foto: 'https://images.unsplash.com/photo-1603064752734-4c48eff53d05' },
    { id: 'quechimba', categoria: 'hamburguesas', nombre: 'La Quechimba', precio: 29000, etiqueta: 'Más pedida',
      descripcion: 'Nuestro pan sellado "Que Chimba", carne de res, tocineta, queso fundido y salsas de la casa.',
      foto: 'assets/img/quechimba.webp' },
    { id: 'costena', categoria: 'hamburguesas', nombre: 'La Costeña', precio: 25000, etiqueta: 'De la casa',
      descripcion: 'Carne de res, queso costeño a la plancha, maduro, suero atollabuey y un toque de ají dulce.',
      foto: 'https://images.unsplash.com/photo-1596662951482-0c4ba74a6df6' },
    { id: 'bbq-bacon', categoria: 'hamburguesas', nombre: 'BBQ Bacon', precio: 26000,
      descripcion: 'Carne de res, cheddar, tocineta, aros de cebolla y salsa BBQ ahumada.',
      foto: 'https://images.unsplash.com/photo-1598182198871-d3f4ab4fd181' },
    { id: 'smash-doble', categoria: 'hamburguesas', nombre: 'Smash Doble', precio: 24000, etiqueta: 'Nueva',
      descripcion: 'Dos carnes smash bien doradas, queso americano, pepinillos, cebolla y mostaza.',
      foto: 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234' },
    { id: 'crispy-chicken', categoria: 'hamburguesas', nombre: 'Crispy Chicken', precio: 22000, etiqueta: 'Picante',
      descripcion: 'Pechuga apanada crocante, ensalada de repollo, pepinillos y mayonesa picante.',
      foto: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086' },

    { id: 'salchipapa-quechimba', categoria: 'salchipapas', nombre: 'Salchipapa Quechimba', precio: 25000, etiqueta: 'La estrella',
      descripcion: 'Papas, salchicha, pollo, maíz tierno, queso rallado y salsas de la casa.',
      foto: 'assets/img/salchipapa-quechimba.webp' },
    { id: 'salchipapa-de-nivel', categoria: 'salchipapas', nombre: 'Salchipapa De Nivel', precio: 40000, etiqueta: 'Para compartir',
      descripcion: 'Bien cargada: chorizo, queso asado, papas, salchicha, queso rallado y salsas.',
      foto: 'assets/img/salchipapa-de-nivel.webp' },
    { id: 'salchipapa-familiar', categoria: 'salchipapas', nombre: 'Salchipapa Familiar', precio: 60000,
      descripcion: 'Bandeja grande con papas, salchicha, queso asado, gratinado y salsas de la casa.',
      foto: 'assets/img/salchipapa-familiar.webp' },

    { id: 'combo-quechimba', categoria: 'combos', nombre: 'Combo Quechimba', precio: 38000, etiqueta: 'Ahorras $5.000',
      descripcion: 'La Quechimba + papas francesas + bebida a elección.',
      foto: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330' },
    { id: 'combo-clasico', categoria: 'combos', nombre: 'Combo Clásico', precio: 27000,
      descripcion: 'La Clásica + papas francesas + bebida a elección.',
      foto: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5' },
    { id: 'combo-x4', categoria: 'combos', nombre: 'Combo x4', precio: 85000, etiqueta: 'Para 4',
      descripcion: '4 hamburguesas, papas para compartir y gaseosa de 1,5 L.',
      foto: 'https://images.unsplash.com/photo-1610614819513-58e34989848b' },

    { id: 'perro-clasico', categoria: 'perros', nombre: 'Perro Clásico', precio: 12000,
      descripcion: 'Salchicha americana, cebolla, papita ripio, queso rallado y salsas.',
      foto: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041' },
    { id: 'perro-quechimba', categoria: 'perros', nombre: 'Perro Quechimba', precio: 18000, etiqueta: 'Más pedido',
      descripcion: 'Salchicha de res, tocineta, queso gratinado, maíz tierno y pico de gallo.',
      foto: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a' },
    { id: 'perro-ranchero', categoria: 'perros', nombre: 'Perro Ranchero', precio: 15000,
      descripcion: 'Salchicha ranchera, cebollín, queso mozzarella y salsa de ajo.',
      foto: 'https://images.unsplash.com/photo-1613482084286-41f25b486fa2' },

    { id: 'papas-francesas', categoria: 'acompanantes', nombre: 'Papas francesas', precio: 7000,
      descripcion: 'Porción de papas crocantes con la sal de la casa.',
      foto: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d' },
    { id: 'papas-queso', categoria: 'acompanantes', nombre: 'Papas con queso y tocineta', precio: 14000,
      descripcion: 'Papas francesas bañadas en cheddar fundido y tocineta picada.',
      foto: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877' },
    { id: 'aros-cebolla', categoria: 'acompanantes', nombre: 'Aros de cebolla', precio: 9000,
      descripcion: 'Aros apanados y crocantes con salsa de la casa para untar.',
      foto: 'https://images.unsplash.com/photo-1639024471283-03518883512d' },

    { id: 'limonada', categoria: 'bebidas', nombre: 'Limonada de hierbabuena', precio: 7000,
      descripcion: 'Limón natural, hierbabuena fresca y mucho hielo.',
      foto: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859' },
    { id: 'jugo-mango', categoria: 'bebidas', nombre: 'Jugo de mango', precio: 7000,
      descripcion: 'Jugo natural en agua o en leche.',
      foto: 'https://images.unsplash.com/photo-1546173159-315724a31696' },
    { id: 'malteada-cookies', categoria: 'bebidas', nombre: 'Malteada cookies & cream', precio: 13000,
      descripcion: 'Helado de vainilla, galleta de chocolate triturada y crema batida.',
      foto: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699' },
    { id: 'malteada-fresa', categoria: 'bebidas', nombre: 'Malteada de fresa', precio: 12000,
      descripcion: 'Fresas naturales, helado de vainilla y crema batida.',
      foto: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc' },
    { id: 'te-helado', categoria: 'bebidas', nombre: 'Té helado de limón', precio: 6000,
      descripcion: 'Preparado en casa, bien frío.',
      foto: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc' }
  ],

  /* Franja promocional: producto destacado, su foto grande y el título pequeño */
  promo: {
    producto: 'salchipapa-de-nivel',
    foto: 'assets/img/promo-salchipapa.webp',
    titulo: 'La estrella de la casa'
  }
};
