/* =====================================================================
   QUECHIMBA BURGER — Festividades (temas de temporada)
   El dueño elige el tema en la app de escritorio (Ajustes → Festividades)
   y la web cambia colores, escena ilustrada (js/escenas.js), mensajes e ícono al instante.
   Cada festividad tiene 3 diseños: por defecto rotan solos cada año
   (el aniversario rota con su número). Las pruebas verifican que todos
   los colores tengan contraste suficiente para leerse bien.
   Marcadores en el aniversario: {anios} → "3 años" · {ANIOS} → "3 AÑOS"
   ===================================================================== */
window.QB_TEMAS = {
  amor_amistad: {
    nombre: 'Amor y Amistad',
    saludo: '💘 ¡Feliz Amor y Amistad!',
    menu: '¿Qué se te antoja compartir hoy?',
    variantes: [
      { escena: 'cupido', guirnalda: 'corazones', patron: 'corazones', ornamento: 'corazon',
        icono: '💘', movimiento: 'caer', adornos: ['💖', '💘', '🌹', '💌', '💕'],
        colores: { char: '#1f0d14', char2: '#2b1220', mustard: '#ff8fb1', mustard2: '#ffa8c4', ketchup: '#c2185b', ketchup2: '#9d174d', promo: '#be123c', cinta: '#be123c', brillo: 'rgba(255, 143, 177, .30)' },
        cinta: '💘 Mes del Amor y la Amistad · ¡Comparte una Quechimba con tu persona favorita!',
        sello: 'AMOR Y AMISTAD ✦ QUECHIMBA ✦ ',
        marquesina: ['Amor y Amistad', 'Combos para compartir', 'Salchipapas para dos', 'Malteadas', 'Hamburguesas'] },
      { escena: 'pasion', guirnalda: 'corazones', patron: 'corazones', ornamento: 'corazon',
        icono: '❤️', movimiento: 'caer', adornos: ['❤️', '💋', '🌹', '🍫', '💞'],
        colores: { char: '#1a0a0a', char2: '#260f0f', mustard: '#ff6b6b', mustard2: '#ff8787', ketchup: '#b91c1c', ketchup2: '#991b1b', promo: '#991b1b', cinta: '#b91c1c', brillo: 'rgba(255, 107, 107, .30)' },
        cinta: '❤️ Amor y Amistad · El mejor regalo: una Quechimba para dos',
        sello: 'CON AMOR ✦ PARA DOS ✦ ',
        marquesina: ['Amor y Amistad', 'Plan para dos', 'Combo enamorado', 'Malteadas', 'Hamburguesas'] },
      { escena: 'globos', guirnalda: 'banderines', patron: 'confeti', ornamento: 'estrella',
        icono: '💜', movimiento: 'flotar', adornos: ['🤝', '💜', '🎁', '🎈', '✨'],
        colores: { char: '#1a1033', char2: '#241645', mustard: '#c4b5fd', mustard2: '#d4c8fe', ketchup: '#7c3aed', ketchup2: '#6d28d9', promo: '#6d28d9', cinta: '#7c3aed', brillo: 'rgba(196, 181, 253, .28)' },
        cinta: '💜 Amor y Amistad · ¡Celebra con tus parceros!',
        sello: 'PARCEROS ✦ AMISTAD ✦ ',
        marquesina: ['Amor y Amistad', 'Combos para los parceros', 'Salchipapas familiares', 'Malteadas', 'Hamburguesas'] }
    ]
  },
  halloween: {
    nombre: 'Halloween',
    saludo: '🎃 ¡Feliz Halloween!',
    menu: '¿Qué se te antoja esta noche… de terror?',
    variantes: [
      { escena: 'calabazas', guirnalda: 'telaranas', patron: 'murcielagos', ornamento: 'telarana',
        icono: '🎃', movimiento: 'flotar', adornos: ['🎃', '🦇', '👻', '🕸️', '🕷️'],
        colores: { char: '#120b18', char2: '#1d1226', mustard: '#ff8c1a', mustard2: '#ffa64d', ketchup: '#7e22ce', ketchup2: '#6b21a8', promo: '#5b21b6', cinta: '#5b21b6', brillo: 'rgba(255, 140, 26, .32)' },
        cinta: '🎃 Temporada de Halloween · ¡Pedidos de terror… de lo buenos!',
        sello: 'FELIZ HALLOWEEN ✦ DULCE O TRUCO ✦ ',
        marquesina: ['Halloween', 'Burgers de terror', 'Salchipapas embrujadas', 'Dulce o truco', 'Combos monstruosos'] },
      { escena: 'brujas', guirnalda: 'telaranas', patron: 'murcielagos', ornamento: 'telarana',
        icono: '🧙', movimiento: 'flotar', adornos: ['🧙', '🧪', '🦉', '🌙', '🕯️'],
        colores: { char: '#0a0f0a', char2: '#121a12', mustard: '#a3e635', mustard2: '#bef264', ketchup: '#15803d', ketchup2: '#166534', promo: '#14532d', cinta: '#14532d', brillo: 'rgba(163, 230, 53, .26)' },
        cinta: '🧙 Noche de brujas · Hechizos con queso fundido',
        sello: 'NOCHE DE BRUJAS ✦ HECHIZOS ✦ ',
        marquesina: ['Noche de brujas', 'Pociones (malteadas)', 'Salchipapas hechizadas', 'Burgers de bruja', 'Combos mágicos'] },
      { escena: 'zombis', guirnalda: 'telaranas', patron: 'calaveras', ornamento: 'telarana',
        icono: '🧟', movimiento: 'caer', adornos: ['🧟', '💀', '🦴', '⚰️', '🕷️'],
        colores: { char: '#140707', char2: '#200b0b', mustard: '#f97316', mustard2: '#fb923c', ketchup: '#b91c1c', ketchup2: '#991b1b', promo: '#7f1d1d', cinta: '#7f1d1d', brillo: 'rgba(249, 115, 22, .30)' },
        cinta: '🧟 Halloween · ¡Hambre de muerto viviente!',
        sello: 'HAMBRE ZOMBI ✦ HALLOWEEN ✦ ',
        marquesina: ['Halloween', 'Hambre zombi', 'Burgers del más allá', 'Salchipapas', 'Combos de terror'] }
    ]
  },
  dia_muertos: {
    nombre: 'Día de Muertos',
    saludo: '💀 ¡Feliz Día de Muertos!',
    menu: '¿Qué se te antoja para la ofrenda?',
    variantes: [
      { escena: 'catrina', guirnalda: 'papel_picado', patron: 'calaveras', ornamento: 'flor',
        icono: '💀', movimiento: 'flotar', adornos: ['💀', '🌼', '🕯️', '🌺', '🦋'],
        colores: { char: '#170a24', char2: '#22102f', mustard: '#ff9f1c', mustard2: '#ffb347', ketchup: '#b0127a', ketchup2: '#8e0e63', promo: '#6b21a8', cinta: '#b0127a', brillo: 'rgba(255, 159, 28, .30)' },
        cinta: '💀 Día de Muertos · Celebramos la vida con buena comida',
        sello: 'DÍA DE MUERTOS ✦ CON SABOR ✦ ',
        marquesina: ['Día de Muertos', 'Burgers de otro mundo', 'Salchipapas', 'Malteadas', 'Combos'] },
      { escena: 'cempasuchil', guirnalda: 'flores', patron: 'flores', ornamento: 'flor',
        icono: '🌼', movimiento: 'caer', adornos: ['🌼', '🌻', '🕯️', '💀', '🍞'],
        colores: { char: '#1c1006', char2: '#28180a', mustard: '#fbbf24', mustard2: '#fcd34d', ketchup: '#c2410c', ketchup2: '#9a3412', promo: '#9a3412', cinta: '#c2410c', brillo: 'rgba(251, 191, 36, .30)' },
        cinta: '🌼 Día de Muertos · Flores, velas y una buena Quechimba',
        sello: 'FLORES Y SABOR ✦ QUECHIMBA ✦ ',
        marquesina: ['Día de Muertos', 'Ofrenda de sabor', 'Salchipapas', 'Hamburguesas', 'Malteadas'] },
      { escena: 'fuegos', guirnalda: 'papel_picado', patron: 'calaveras', ornamento: 'flor',
        icono: '🎊', movimiento: 'flotar', adornos: ['🎊', '💀', '🌸', '🎉', '🕯️'],
        colores: { char: '#0f172a', char2: '#17213a', mustard: '#f472b6', mustard2: '#f78fc7', ketchup: '#0e7490', ketchup2: '#155e75', promo: '#7e22ce', cinta: '#0e7490', brillo: 'rgba(244, 114, 182, .28)' },
        cinta: '🎊 Día de Muertos · ¡Que viva la fiesta y el buen comer!',
        sello: 'VIVA LA FIESTA ✦ MUERTOS ✦ ',
        marquesina: ['Día de Muertos', 'Fiesta de sabores', 'Combos', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  navidad: {
    nombre: 'Navidad',
    saludo: '🎄 ¡Feliz Navidad!',
    menu: '¿Qué se te antoja para la novena?',
    variantes: [
      { escena: 'pinos', guirnalda: 'luces', patron: 'copos', ornamento: 'copo',
        icono: '🎄', movimiento: 'caer', adornos: ['❄️', '⭐', '🎄', '🎁', '❄️'],
        colores: { char: '#0d1f17', char2: '#13291f', mustard: '#ffd166', mustard2: '#ffdb85', ketchup: '#c1121f', ketchup2: '#9b0e19', promo: '#146c43', cinta: '#146c43', brillo: 'rgba(255, 209, 102, .26)' },
        cinta: '🎄 ¡Feliz Navidad! · Pide para la novena y compártela en familia',
        sello: 'FELIZ NAVIDAD ✦ JO JO JO ✦ ',
        marquesina: ['Feliz Navidad', 'Combos para la novena', 'Salchipapas familiares', 'Malteadas', 'Hamburguesas'] },
      { escena: 'muneco', guirnalda: 'luces', patron: 'copos', ornamento: 'copo',
        icono: '⛄', movimiento: 'caer', adornos: ['❄️', '☃️', '⛄', '❄️', '🌟'],
        colores: { char: '#0b1426', char2: '#12203a', mustard: '#bae6fd', mustard2: '#d0eefe', ketchup: '#1d4ed8', ketchup2: '#1e40af', promo: '#1e3a8a', cinta: '#1e3a8a', brillo: 'rgba(186, 230, 253, .24)' },
        cinta: '⛄ Navidad blanca · Calientito por dentro con una Quechimba',
        sello: 'NAVIDAD BLANCA ✦ QUECHIMBA ✦ ',
        marquesina: ['Feliz Navidad', 'Combos navideños', 'Malteadas', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'trineo', guirnalda: 'luces', patron: 'estrellas', ornamento: 'estrella',
        icono: '🎅', movimiento: 'flotar', adornos: ['🎅', '🦌', '🔔', '🎁', '✨'],
        colores: { char: '#1a1206', char2: '#271b0a', mustard: '#fcd34d', mustard2: '#fde08a', ketchup: '#b91c1c', ketchup2: '#991b1b', promo: '#7f1d1d', cinta: '#b45309', brillo: 'rgba(252, 211, 77, .28)' },
        cinta: '🎅 ¡Jo, jo, jo! · Papá Noel también pide Quechimba',
        sello: 'JO JO JO ✦ FELIZ NAVIDAD ✦ ',
        marquesina: ['Feliz Navidad', 'El combo de Papá Noel', 'Salchipapas', 'Malteadas', 'Hamburguesas'] }
    ]
  },
  ano_nuevo: {
    nombre: 'Año Nuevo',
    saludo: '🥂 ¡Feliz Año Nuevo!',
    menu: '¿Con qué arrancamos el año?',
    variantes: [
      { escena: 'fuegos', guirnalda: 'serpentinas', patron: 'estrellas', ornamento: 'estrella',
        icono: '🎆', movimiento: 'flotar', adornos: ['🎆', '✨', '🥂', '🎉', '🎊'],
        colores: { char: '#0b0b14', char2: '#15151f', mustard: '#f5c542', mustard2: '#f8d26a', ketchup: '#1e3a8a', ketchup2: '#172e6e', promo: '#1f2937', cinta: '#1f2937', brillo: 'rgba(245, 197, 66, .30)' },
        cinta: '🥂 ¡Feliz Año Nuevo! · Arranca el año con una Quechimba',
        sello: 'FELIZ AÑO NUEVO ✦ QUECHIMBA ✦ ',
        marquesina: ['Feliz Año Nuevo', 'Combos para celebrar', 'Salchipapas', 'Malteadas', 'Hamburguesas'] },
      { escena: 'fuegos', guirnalda: 'serpentinas', patron: 'confeti', ornamento: 'estrella',
        icono: '🎇', movimiento: 'flotar', adornos: ['🎇', '🎆', '💥', '⭐', '🎉'],
        colores: { char: '#0a0a1f', char2: '#14143a', mustard: '#f472b6', mustard2: '#f78fc7', ketchup: '#7c3aed', ketchup2: '#6d28d9', promo: '#4c1d95', cinta: '#7c3aed', brillo: 'rgba(244, 114, 182, .28)' },
        cinta: '🎇 ¡Feliz Año Nuevo! · Que el año venga cargado como nuestras salchipapas',
        sello: 'AÑO NUEVO ✦ VIDA NUEVA ✦ ',
        marquesina: ['Feliz Año Nuevo', 'Vida nueva, burger nueva', 'Salchipapas', 'Malteadas', 'Combos'] },
      { escena: 'globos', guirnalda: 'serpentinas', patron: 'estrellas', ornamento: 'estrella',
        icono: '🥂', movimiento: 'caer', adornos: ['✨', '🥂', '🕛', '🎊', '⭐'],
        colores: { char: '#111827', char2: '#1b2433', mustard: '#e5e7eb', mustard2: '#f3f4f6', ketchup: '#374151', ketchup2: '#1f2937', promo: '#1f2937', cinta: '#374151', brillo: 'rgba(229, 231, 235, .22)' },
        cinta: '🥂 Cuenta regresiva · ¡Brindemos por un año quechimba!',
        sello: 'BRINDEMOS ✦ AÑO NUEVO ✦ ',
        marquesina: ['Feliz Año Nuevo', 'Brindemos', 'Combos para la fiesta', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  dia_madre: {
    nombre: 'Día de la Madre',
    saludo: '💐 ¡Feliz día, mamá!',
    menu: '¿Qué se le antoja hoy a mamá?',
    variantes: [
      { escena: 'rosas', guirnalda: 'flores', patron: 'flores', ornamento: 'rosa',
        icono: '💐', movimiento: 'caer', adornos: ['💐', '🌷', '💝', '🌸', '💖'],
        colores: { char: '#1c0f1a', char2: '#281526', mustard: '#f9a8d4', mustard2: '#fbc0e0', ketchup: '#be185d', ketchup2: '#9d174d', promo: '#9d174d', cinta: '#be185d', brillo: 'rgba(249, 168, 212, .30)' },
        cinta: '💐 Feliz Día de la Madre · Consiente a mamá con algo rico',
        sello: 'FELIZ DÍA MAMÁ ✦ QUECHIMBA ✦ ',
        marquesina: ['Feliz Día de la Madre', 'Combos en familia', 'Malteadas', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'lavanda', guirnalda: 'flores', patron: 'flores', ornamento: 'flor',
        icono: '🌷', movimiento: 'flotar', adornos: ['💜', '🌸', '🦋', '🌷', '✨'],
        colores: { char: '#1a1428', char2: '#251d38', mustard: '#d8b4fe', mustard2: '#e4cafe', ketchup: '#7e22ce', ketchup2: '#6b21a8', promo: '#6b21a8', cinta: '#7e22ce', brillo: 'rgba(216, 180, 254, .28)' },
        cinta: '🌷 Mamá se merece lo mejor · ¡Hoy invitas tú!',
        sello: 'PARA MAMÁ ✦ CON AMOR ✦ ',
        marquesina: ['Día de la Madre', 'Para mamá', 'Malteadas', 'Combos', 'Hamburguesas'] },
      { escena: 'pasion', guirnalda: 'flores', patron: 'corazones', ornamento: 'rosa',
        icono: '❤️', movimiento: 'caer', adornos: ['❤️', '🌹', '💐', '🎁', '💕'],
        colores: { char: '#1f0a0a', char2: '#2b0f0f', mustard: '#fca5a5', mustard2: '#fdbaba', ketchup: '#dc2626', ketchup2: '#b91c1c', promo: '#b91c1c', cinta: '#b91c1c', brillo: 'rgba(252, 165, 165, .30)' },
        cinta: '❤️ Gracias, mamá · Celébrala con una Quechimba',
        sello: 'GRACIAS MAMÁ ✦ TE AMAMOS ✦ ',
        marquesina: ['Día de la Madre', 'Gracias, mamá', 'Combos en familia', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  dia_padre: {
    nombre: 'Día del Padre',
    saludo: '👑 ¡Feliz día, papá!',
    menu: '¿Qué se le antoja hoy a papá?',
    variantes: [
      { escena: 'trofeo', guirnalda: 'banderines', patron: 'estrellas', ornamento: 'estrella',
        icono: '👔', movimiento: 'flotar', adornos: ['👔', '🏆', '⭐', '🍔', '🎉'],
        colores: { char: '#0b1220', char2: '#131d30', mustard: '#60a5fa', mustard2: '#85baff', ketchup: '#1d4ed8', ketchup2: '#1e40af', promo: '#1e3a8a', cinta: '#1e3a8a', brillo: 'rgba(96, 165, 250, .28)' },
        cinta: '🍔 Feliz Día del Padre · El combo que papá se merece',
        sello: 'FELIZ DÍA PAPÁ ✦ QUECHIMBA ✦ ',
        marquesina: ['Feliz Día del Padre', 'Combos para papá', 'Burgers dobles', 'Salchipapas', 'Malteadas'] },
      { escena: 'parrilla', guirnalda: 'banderines', patron: 'confeti', ornamento: 'estrella',
        icono: '🔥', movimiento: 'flotar', adornos: ['🍔', '🔥', '🥩', '🏆', '👑'],
        colores: { char: '#1a0f08', char2: '#26170c', mustard: '#fb923c', mustard2: '#fca965', ketchup: '#9a3412', ketchup2: '#7c2d12', promo: '#7c2d12', cinta: '#9a3412', brillo: 'rgba(251, 146, 60, .30)' },
        cinta: '🔥 Papá parrillero · Hoy la parrilla la ponemos nosotros',
        sello: 'PAPÁ PARRILLERO ✦ REY ✦ ',
        marquesina: ['Día del Padre', 'Papá parrillero', 'Burgers dobles', 'Salchipapas', 'Combos'] },
      { escena: 'futbol', guirnalda: 'banderines', patron: 'estrellas', ornamento: 'estrella',
        icono: '⚽', movimiento: 'caer', adornos: ['⚽', '🏆', '👟', '🥇', '🎉'],
        colores: { char: '#052e16', char2: '#0a3d1f', mustard: '#4ade80', mustard2: '#6ee7a0', ketchup: '#15803d', ketchup2: '#166534', promo: '#14532d', cinta: '#15803d', brillo: 'rgba(74, 222, 128, .26)' },
        cinta: '⚽ Papá campeón · Partido y Quechimba, el plan perfecto',
        sello: 'PAPÁ CAMPEÓN ✦ QUECHIMBA ✦ ',
        marquesina: ['Día del Padre', 'Papá campeón', 'Combos para el partido', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  fiestas_patrias: {
    nombre: 'Fiestas Patrias',
    saludo: '🇨🇴 ¡Viva Colombia!',
    menu: '¿Qué se te antoja, parcero?',
    variantes: [
      { escena: 'bandera', guirnalda: 'banderines', patron: 'estrellas', ornamento: 'estrella',
        icono: '⭐', movimiento: 'caer', adornos: ['⭐', '🎉', '🎊', '✨', '⭐'],
        colores: { mustard: '#fcd116', mustard2: '#fddb4c', ketchup: '#ce1126', ketchup2: '#a80e1f', promo: '#003893', cinta: '#003893', brillo: 'rgba(252, 209, 22, .30)' },
        cinta: '¡Viva Colombia! · Celebramos las fiestas patrias con sabor',
        sello: 'VIVA COLOMBIA ✦ 20 DE JULIO ✦ ',
        marquesina: ['¡Viva Colombia!', 'Combos patrios', 'Salchipapas', 'Hamburguesas', 'Malteadas'] },
      { escena: 'bandera', guirnalda: 'banderines', patron: 'confeti', ornamento: 'estrella',
        icono: '🎶', movimiento: 'flotar', adornos: ['🎶', '💃', '🌽', '☕', '⭐'],
        colores: { char: '#0c1a2e', char2: '#13243d', mustard: '#fcd116', mustard2: '#fddb4c', ketchup: '#003893', ketchup2: '#002a6e', promo: '#ce1126', cinta: '#ce1126', brillo: 'rgba(252, 209, 22, .28)' },
        cinta: '🎶 ¡Colombia es pasión! · Cumbia, café y una buena Quechimba',
        sello: 'COLOMBIA ES PASIÓN ✦ ',
        marquesina: ['¡Viva Colombia!', 'Sabor colombiano', 'Salchipapas', 'Combos', 'Hamburguesas'] },
      { escena: 'fuegos', guirnalda: 'banderines', patron: 'estrellas', ornamento: 'estrella',
        icono: '🎆', movimiento: 'flotar', adornos: ['🎆', '🎉', '⭐', '🎊', '🥳'],
        colores: { mustard: '#fcd116', mustard2: '#fddb4c', ketchup: '#ce1126', ketchup2: '#a80e1f', promo: '#ce1126', cinta: '#003893', brillo: 'rgba(252, 209, 22, .30)' },
        cinta: '🎆 Día de la Independencia · ¡Orgullosamente colombianos!',
        sello: 'INDEPENDENCIA ✦ COLOMBIA ✦ ',
        marquesina: ['Independencia', 'Orgullo colombiano', 'Combos patrios', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  festival_vallenato: {
    nombre: 'Festival Vallenato',
    saludo: '🪗 ¡Que viva el Festival!',
    menu: '¿Qué se te antoja pa’ la parranda?',
    variantes: [
      { escena: 'acordeon', guirnalda: 'banderines', patron: 'notas', ornamento: 'nota',
        icono: '🪗', movimiento: 'flotar', adornos: ['🪗', '🎶', '🎵', '🌴', '🥁'],
        colores: { char: '#0c1a17', char2: '#132521', ketchup: '#0f766e', ketchup2: '#0b5f59', promo: '#0f766e', cinta: '#0f766e', brillo: 'rgba(20, 184, 166, .26)' },
        cinta: '🪗 Festival de la Leyenda Vallenata · ¡Valledupar está de fiesta!',
        sello: 'FESTIVAL VALLENATO ✦ VALLEDUPAR ✦ ',
        marquesina: ['Festival Vallenato', 'Valledupar de fiesta', 'Combos parranderos', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'acordeon', guirnalda: 'banderines', patron: 'notas', ornamento: 'nota',
        icono: '🎶', movimiento: 'flotar', adornos: ['🎶', '🪗', '🥁', '🎤', '🎉'],
        colores: { char: '#1c1206', char2: '#28190a', mustard: '#facc15', mustard2: '#fcd34d', ketchup: '#b45309', ketchup2: '#92400e', promo: '#92400e', cinta: '#b45309', brillo: 'rgba(250, 204, 21, .28)' },
        cinta: '🎶 ¡Que viva la parranda! · Festival Vallenato en Valledupar',
        sello: 'QUE VIVA LA PARRANDA ✦ ',
        marquesina: ['Festival Vallenato', 'Parranda vallenata', 'Combos parranderos', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'acordeon', guirnalda: 'banderines', patron: 'notas', ornamento: 'nota',
        icono: '🌴', movimiento: 'caer', adornos: ['🌴', '🌞', '🪗', '🐎', '🎵'],
        colores: { char: '#0b1a0b', char2: '#122612', mustard: '#a3e635', mustard2: '#bef264', ketchup: '#166534', ketchup2: '#14532d', promo: '#14532d', cinta: '#166534', brillo: 'rgba(163, 230, 53, .26)' },
        cinta: '🌴 Del Valle de Upar para el mundo · ¡Festival Vallenato!',
        sello: 'VALLE DE UPAR ✦ VALLENATO ✦ ',
        marquesina: ['Festival Vallenato', 'Sabor de la sabana', 'Combos', 'Salchipapas', 'Hamburguesas'] }
    ]
  },
  aniversario: {
    nombre: 'Aniversario',
    saludo: '🎂 ¡Cumplimos {anios}!',
    menu: '¿Con qué celebramos los {anios}?',
    variantes: [
      { escena: 'pastel', guirnalda: 'serpentinas', patron: 'confeti', ornamento: 'vela',
        icono: '🎂', movimiento: 'caer', adornos: ['🎂', '🎉', '🎈', '🎊', '✨'],
        colores: { promo: '#d33216', cinta: '#d33216' },
        cinta: '🎂 ¡Cumplimos {anios}! · Gracias por hacer parte de Quechimba Burger',
        sello: '{ANIOS} ✦ QUECHIMBA ✦ ',
        marquesina: ['¡Cumplimos {anios}!', 'Gracias Valledupar', 'Combos de aniversario', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'pastel', guirnalda: 'banderines', patron: 'estrellas', ornamento: 'estrella',
        icono: '🥇', movimiento: 'flotar', adornos: ['🥇', '🎂', '✨', '🎆', '🥂'],
        colores: { char: '#0b0b14', char2: '#15151f', mustard: '#f5c542', mustard2: '#f8d26a', ketchup: '#b45309', ketchup2: '#92400e', promo: '#1f2937', cinta: '#b45309', brillo: 'rgba(245, 197, 66, .30)' },
        cinta: '✨ {anios} de sabor · ¡Celebra con nosotros!',
        sello: '{ANIOS} DE SABOR ✦ GRACIAS ✦ ',
        marquesina: ['{anios} de sabor', 'Gracias por preferirnos', 'Combos de aniversario', 'Salchipapas', 'Hamburguesas'] },
      { escena: 'pastel', guirnalda: 'serpentinas', patron: 'confeti', ornamento: 'vela',
        icono: '🥳', movimiento: 'caer', adornos: ['🎊', '🎈', '🎁', '🎂', '🥳'],
        colores: { char: '#1a1033', char2: '#241645', mustard: '#f472b6', mustard2: '#f78fc7', ketchup: '#7c3aed', ketchup2: '#6d28d9', promo: '#6d28d9', cinta: '#7c3aed', brillo: 'rgba(244, 114, 182, .28)' },
        cinta: '🥳 ¡{anios} siendo una quechimba! · Gracias por preferirnos',
        sello: '¡{ANIOS}! ✦ QUECHIMBA ✦ ',
        marquesina: ['¡{anios} siendo una quechimba!', 'Gracias Valledupar', 'Combos de aniversario', 'Salchipapas', 'Hamburguesas'] }
    ]
  }
};
