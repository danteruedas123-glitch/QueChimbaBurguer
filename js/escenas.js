/* =====================================================================
   QUECHIMBA BURGER — Escenas ilustradas de las festividades (SVG a mano)
   Cada escena dibuja: una guirnalda arriba, un cielo/ambiente, un suelo
   con personajes abajo, un patrón para el menú, un adorno para las
   tarjetas y la ilustración grande de la bienvenida. Todo vectorial y
   liviano; las animaciones están en css/styles.css (sección Escenas).
   ===================================================================== */
(() => {
  'use strict';

  // ---------- utilidades ----------
  const svg = (vb, cuerpo, clase = '', par = 'xMidYMid meet') =>
    `<svg class="${clase}" viewBox="${vb}" preserveAspectRatio="${par}" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const azar = (i, s = 1) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
  const uri = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  const estilo = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');

  // ---------- formas base ----------
  const CORAZON = 'M12 21.6C11.6 21.3 2 15 2 8.8 2 5.6 4.5 3 7.6 3c1.9 0 3.4.9 4.4 2.3C13 3.9 14.5 3 16.4 3 19.5 3 22 5.6 22 8.8c0 6.2-9.6 12.5-10 12.8z';
  const MURCIELAGO = 'M50 13L46 5 45 14C38 9 24 4 2 6Q10 18 16 14 22 24 30 18 36 28 46 24L50 30 54 24Q64 28 70 18 78 24 84 14 90 18 98 6C76 4 62 9 55 14L54 5Z';
  const ESTRELLA = 'M0 -10L2.9 -3.1 10 -3.1 4.3 1.2 6.5 8.1 0 3.8 -6.5 8.1 -4.3 1.2 -10 -3.1 -2.9 -3.1Z';
  const NOTA = '<ellipse cx="6" cy="24" rx="6" ry="4.5" transform="rotate(-20 6 24)"/><rect x="10.5" y="2" width="2.2" height="22"/><path d="M12.7 2C19 6 21 10 16.5 16 18 10 16 8 12.7 7Z"/>';

  // ---------- piezas ilustradas ----------
  const luna = (color = '#fef3c7', halo = 'rgba(254, 243, 199, .35)') => svg('-120 -120 240 240', `
    <defs><radialGradient id="qb-halo"><stop offset="0" stop-color="${halo}"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient></defs>
    <circle r="118" fill="url(#qb-halo)"/>
    <circle r="62" fill="${color}"/>
    <g fill="#000" opacity=".08"><circle cx="-18" cy="-14" r="12"/><circle cx="20" cy="10" r="16"/><circle cx="-6" cy="26" r="8"/><circle cx="26" cy="-26" r="6"/></g>`, 'pieza-luna');

  const murcielago = (i) => `<div class="vuela vuela-${i % 3}" style="${estilo({ top: `${8 + i * 9}%`, '--d': `${14 + i * 4}s`, '--r': `${-i * 3.5}s` })}">
      ${svg('0 0 100 32', `<path class="aleteo" d="${MURCIELAGO}" fill="#1c1228" stroke="rgba(255,190,120,.45)" stroke-width="1.5"/>`, 'pieza-murcielago')}</div>`;

  const calabaza = (x, escala, i, y = 150) => `<g transform="translate(${x} ${y}) scale(${escala})">
      <circle r="78" cy="-6" fill="url(#qb-brillo-calabaza)" class="parpadeo" style="--r:${-i * .7}s"/>
      <ellipse rx="52" ry="42" fill="url(#qb-calabaza)"/>
      <ellipse rx="30" ry="42" fill="none" stroke="rgba(124,45,18,.55)" stroke-width="3"/>
      <ellipse rx="11" ry="42" fill="none" stroke="rgba(124,45,18,.45)" stroke-width="3"/>
      <path d="M-5 -38C-4 -50 2 -58 12 -60L14 -54C6 -52 3 -46 4 -38Z" fill="#4d7c0f"/>
      <g fill="#fde047" class="parpadeo" style="--r:${-i * .5}s">
        <path d="M-32 -8L-19 -26-6 -8Z"/><path d="M6 -8L19 -26 32 -8Z"/><path d="M-5 2L0 -7 5 2Z"/>
        <path d="M-34 10C-17 32 17 32 34 10L26 14 19 7 12 16 6 9 0 18-6 9-12 16-19 7-26 14Z"/>
      </g></g>`;

  const defsCalabaza = `<defs>
      <radialGradient id="qb-calabaza" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fdba74"/><stop offset=".55" stop-color="#f97316"/><stop offset="1" stop-color="#7c2d12"/></radialGradient>
      <radialGradient id="qb-brillo-calabaza"><stop offset="0" stop-color="rgba(251,146,60,.55)"/><stop offset="1" stop-color="rgba(251,146,60,0)"/></radialGradient></defs>`;

  const suelo = (color, alto = 46) => `<path d="M0 ${200 - alto}C120 ${200 - alto - 18} 240 ${200 - alto + 10} 380 ${200 - alto - 6}S640 ${200 - alto - 24} 820 ${200 - alto - 4}S1080 ${200 - alto + 8} 1200 ${200 - alto - 12}V200H0Z" fill="${color}"/>`;

  const niebla = () => `<div class="niebla niebla-1"></div><div class="niebla niebla-2"></div>`;

  const lapida = (x, alto, texto) => `<g transform="translate(${x} ${200 - alto})">
      <path d="M0 ${alto}V28C0 10 12 0 28 0S56 10 56 28V${alto}Z" fill="#2b2635" stroke="#3d3649" stroke-width="2"/>
      ${texto ? `<text x="28" y="40" text-anchor="middle" font-family="Georgia,serif" font-size="14" font-weight="700" fill="#5a5168">${texto}</text>` : ''}
      <path d="M10 46H46M14 56H42" stroke="#3d3649" stroke-width="2"/></g>`;

  const cruz = (x, alto) => `<g transform="translate(${x} ${200 - alto})" fill="#231f2c"><rect x="10" width="10" height="${alto}" rx="2"/><rect y="14" width="30" height="9" rx="2"/></g>`;

  const manoZombi = (x, i) => `<g transform="translate(${x} 122)"><g class="mano-zombi" style="--r:${-i * 1.6}s">
      <path d="M12 90V52C6 50 3 44 4 38L5 20C5 15 11 15 11 20L12 34 13 10C13 5 19 5 19 10L20 32 22 6C22 1 28 1 28 6V33L30 14C30 9 36 9 36 14L35 44C35 50 31 54 28 56L30 90Z" fill="#7d9b68" stroke="#3f5a33" stroke-width="2"/>
      <path d="M7 46C2 42-1 36 1 31 4 29 8 33 10 40" fill="#7d9b68" stroke="#3f5a33" stroke-width="2"/>
      <path d="M14 22H17M22 18H25M30 24H33" stroke="#3f5a33" stroke-width="1.5"/>
      <path d="M8 78 12 72 16 78 20 71 24 77 28 72 33 78V92H8Z" fill="#3b3346"/></g>
      <path d="M-18 84Q20 58 58 84Z" fill="#2a1a12"/></g>`;

  const arbolTorcido = (x) => `<path transform="translate(${x} 0)" fill="#06040a" d="M38 200C40 170 36 140 30 118 22 100 10 92 0 88 12 88 22 94 28 102 26 84 18 70 6 62 20 66 30 78 34 92 38 74 48 60 62 52 52 64 44 80 42 98 50 88 62 84 76 86 62 90 50 100 46 116 50 140 54 170 58 200Z"/>`;

  const bruja = () => svg('0 -18 124 88', `<g fill="#05060a">
      <path d="M6 54L112 40" stroke="#05060a" stroke-width="4" stroke-linecap="round"/>
      <path d="M16 52L0 44 3 53 0 62Z"/>
      <path d="M46 46C40 30 44 18 54 14 62 16 66 26 64 44Z"/>
      <path d="M48 30C36 34 26 42 16 52 30 45 40 45 50 44Z"/>
      <circle cx="58" cy="11" r="6"/>
      <path d="M45 9Q60 3 75 9 60 13 45 9Z"/><path d="M52 8L58 -16 68 7Z"/>
      <path d="M58 26L80 40" stroke="#05060a" stroke-width="3" stroke-linecap="round"/></g>`, 'pieza-bruja');

  const caldero = () => `<g transform="translate(1040 112)">
      <ellipse cx="0" cy="-6" rx="70" ry="30" fill="url(#qb-brillo-pocion)"/>
      <path d="M-46 -10C-50 30-30 46 0 46S50 30 46-10Z" fill="#0b0b0f"/>
      <ellipse cy="-10" rx="50" ry="10" fill="#1f2937"/><ellipse cy="-10" rx="43" ry="7" fill="#84cc16"/>
      <path d="M-30 44L-36 60M30 44L36 60" stroke="#0b0b0f" stroke-width="6" stroke-linecap="round"/>
      ${rep(6, (i) => `<circle class="burbuja" cx="${-28 + i * 11}" cy="-14" r="${3 + (i % 3) * 2}" fill="#a3e635" style="--r:${-i * .45}s;--d:${2.2 + (i % 3) * .5}s"/>`)}
    </g>`;

  const corazonAlado = (color = '#e11d48', ala = '#fff7ea') => `
      <g class="ala ala-izq"><path d="M-8 -6C-20 -22-40-24-46-12-38-14-32-10-30-6-38-6-42 0-42 4-34-2-26-2-20 0-24 4-24 8-22 10-16 4-10 2-6 2Z" fill="${ala}"/></g>
      <g class="ala ala-der" transform="scale(-1 1)"><path d="M-8 -6C-20 -22-40-24-46-12-38-14-32-10-30-6-38-6-42 0-42 4-34-2-26-2-20 0-24 4-24 8-22 10-16 4-10 2-6 2Z" fill="${ala}"/></g>
      <path d="${CORAZON}" transform="translate(-21 -23) scale(1.75)" fill="${color}"/><ellipse cx="-7" cy="-9" rx="4" ry="6" fill="#fff" opacity=".3" transform="rotate(-30 -7 -9)"/>`;

  const flecha = () => svg('0 0 170 24', `
      <path d="M12 12H146" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/>
      <path d="M144 4L166 12 144 20Z" fill="#fde68a"/>
      <path d="M12 12L2 3H16L24 12 16 21H2Z" fill="#fb7185"/>`, 'pieza-flecha');

  /** Rosa vista desde arriba: pétalos exteriores festoneados y pétalos internos en espiral. */
  const arco = (r, a1, a2) => {
    const p = (a) => `${(Math.cos(a * Math.PI / 180) * r).toFixed(1)} ${(Math.sin(a * Math.PI / 180) * r).toFixed(1)}`;
    return `M${p(a1)}A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${p(a2)}`;
  };
  const formaRosa = (tono, oscuro, conHojas = true) => `
      ${conHojas ? `<path d="M-12 22C-34 20-52 30-58 46-38 50-22 42-12 22Z" fill="#15803d"/><path d="M-14 26C-28 33-40 39-52 45" stroke="#0f5132" stroke-width="1.6" fill="none"/>
      <path d="M12 22C34 20 52 30 58 46 38 50 22 42 12 22Z" fill="#166534"/><path d="M14 26C28 33 40 39 52 45" stroke="#0f5132" stroke-width="1.6" fill="none"/>` : ''}
      ${rep(6, (k) => { const an = (k * 60 - 90) * Math.PI / 180; return `<circle cx="${(Math.cos(an) * 17).toFixed(1)}" cy="${(Math.sin(an) * 17).toFixed(1)}" r="15" fill="${oscuro}"/>`; })}
      ${rep(6, (k) => { const an = (k * 60 - 90) * Math.PI / 180; return `<circle cx="${(Math.cos(an) * 15.5).toFixed(1)}" cy="${(Math.sin(an) * 15.5).toFixed(1)}" r="13.5" fill="${tono}"/>`; })}
      <circle r="22" fill="${tono}"/>
      <g fill="none" stroke-linecap="round">
        <g stroke="${oscuro}" stroke-width="2.6">
          <path d="${arco(21, 200, 340)}"/><path d="${arco(17, 10, 190)}"/><path d="${arco(13, 220, 390)}"/><path d="${arco(9, 50, 250)}"/><path d="${arco(5, 270, 460)}"/>
        </g>
        <g stroke="#fff" stroke-opacity=".32" stroke-width="1.6">
          <path d="${arco(18.6, 215, 320)}"/><path d="${arco(14.6, 30, 170)}"/><path d="${arco(10.6, 240, 370)}"/><path d="${arco(6.6, 70, 220)}"/>
        </g>
      </g>
      <circle r="2.4" fill="${oscuro}"/>`;
  const rosa = (x, y, escala, tono = '#e11d48', oscuro = '#9f1239') =>
    `<g transform="translate(${x} ${y}) scale(${escala * .8})">${formaRosa(tono, oscuro)}</g>`;

  const fresa = (x, y, escala, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${escala})">
      <path d="M0 -14C10 -14 16 -6 14 4 12 14 4 22 0 24-4 22-12 14-14 4-16-6-10-14 0-14Z" fill="url(#qb-fresa)"/>
      ${rep(11, (i) => `<ellipse cx="${(azar(i, 3) - .5) * 20}" cy="${-6 + azar(i, 5) * 22}" rx="1.1" ry="1.7" fill="#fde68a"/>`)}
      <path d="M0 -12L-12 -20-6 -12-16 -10-4 -8 0 -2 4 -8 16 -10 6 -12 12 -20Z" fill="#16a34a"/>
      <path d="M0 -14V-22" stroke="#15803d" stroke-width="2.5" stroke-linecap="round"/></g>`;

  const defsFresa = `<defs><radialGradient id="qb-fresa" cx=".4" cy=".35"><stop offset="0" stop-color="#fca5a5"/><stop offset=".5" stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/></radialGradient></defs>`;

  const lavanda = (x, alto, i) => `<g transform="translate(${x} 200)"><g class="balanceo" style="--r:${-i * .8}s">
      <path d="M0 0C2 ${-alto / 2} -2 ${-alto * .8} 0 ${-alto}" stroke="#4d7c0f" stroke-width="3" fill="none"/>
      ${rep(9, (k) => `<ellipse cx="${(k % 2 ? 4 : -4)}" cy="${-alto + 6 + k * 7}" rx="4" ry="6" fill="${k % 3 ? '#a78bfa' : '#8b5cf6'}"/>`)}</g></g>`;

  const mariposa = (i) => `<div class="mariposa-vuelo" style="${estilo({ top: `${14 + i * 18}%`, '--d': `${16 + i * 5}s`, '--r': `${-i * 4}s` })}">
      ${svg('-24 -20 48 40', `<g class="aleteo-lateral"><ellipse cx="-11" cy="-6" rx="11" ry="9" fill="#c4b5fd"/><ellipse cx="-9" cy="8" rx="7" ry="6" fill="#a78bfa"/></g>
        <g transform="scale(-1 1)"><g class="aleteo-lateral"><ellipse cx="-11" cy="-6" rx="11" ry="9" fill="#c4b5fd"/><ellipse cx="-9" cy="8" rx="7" ry="6" fill="#a78bfa"/></g></g>
        <rect x="-1.5" y="-12" width="3" height="24" rx="1.5" fill="#3b0764"/>`, 'pieza-mariposa')}</div>`;

  const llama = (x, y, escala = 1, i = 0) => `<g transform="translate(${x} ${y}) scale(${escala})">
      <circle r="16" cy="-10" fill="url(#qb-luz-vela)" class="parpadeo" style="--r:${-i * .3}s"/>
      <path class="llama" style="--r:${-i * .23}s" d="M0 -26C7 -16 9 -8 0 0-9-8-7-16 0-26Z" fill="url(#qb-llama)"/></g>`;

  const defsLlama = `<defs>
      <radialGradient id="qb-llama" cx=".5" cy=".75" r=".8"><stop offset="0" stop-color="#fffbeb"/><stop offset=".35" stop-color="#fde047"/><stop offset="1" stop-color="#f97316"/></radialGradient>
      <radialGradient id="qb-luz-vela"><stop offset="0" stop-color="rgba(253,224,71,.55)"/><stop offset="1" stop-color="rgba(253,224,71,0)"/></radialGradient></defs>`;

  /** Pastel de aniversario con el número en velas. */
  const pastel = (n) => {
    const digitos = String(n);
    const ancho = 26 * digitos.length;
    const goteo = (x0, ancho2, y, color) => {
      let d = `M${x0} ${y - 12}H${x0 + ancho2}V${y}`;
      for (let x = x0 + ancho2; x > x0; x -= 18) {
        const largo = 8 + azar(x, 7) * 16;
        d += `Q${x - 4} ${y + largo} ${x - 9} ${y + largo - 2}Q${x - 14} ${y} ${x - 18} ${y}`;
      }
      return `<path d="${d}V${y - 12}Z" fill="${color}"/>`;
    };
    return `${defsLlama}
      <ellipse cx="130" cy="206" rx="124" ry="11" fill="rgba(255,255,255,.18)"/>
      <rect x="18" y="122" width="224" height="82" rx="12" style="fill:var(--mustard)"/>
      ${goteo(18, 224, 134, '#fff7ea')}
      ${rep(16, (i) => `<rect x="${30 + azar(i, 2) * 196}" y="${150 + azar(i, 4) * 44}" width="7" height="3" rx="1.5" fill="${['#f472b6', '#38bdf8', '#a3e635', '#fde047', '#fb7185'][i % 5]}" transform="rotate(${azar(i, 6) * 180} ${34 + azar(i, 2) * 196} ${152 + azar(i, 4) * 44})"/>`)}
      <rect x="58" y="62" width="144" height="64" rx="12" style="fill:var(--ketchup)"/>
      ${goteo(58, 144, 74, '#fff7ea')}
      ${rep(8, (i) => `<circle cx="${70 + i * 17}" cy="${102 + (i % 2) * 8}" r="3" fill="#fff7ea" opacity=".85"/>`)}
      <text x="130" y="58" text-anchor="middle" font-family="'Bricolage Grotesque',Impact,sans-serif" font-weight="800" font-size="58" fill="#fde68a" stroke="#b45309" stroke-width="2.5" letter-spacing="2">${digitos}</text>
      ${rep(digitos.length, (i) => llama(130 - ancho / 2 + 13 + i * 26, 12, 1, i))}
      ${[34, 226].map((x, i) => `<rect x="${x - 4}" y="94" width="8" height="30" rx="2" fill="#fff7ea"/><path d="M${x - 4} 100l8 -4M${x - 4} 110l8 -4M${x - 4} 120l8 -4" stroke="#f472b6" stroke-width="2"/>${llama(x, 94, .7, i + 3)}`).join('')}`;
  };

  const globo = (i, color) => `<div class="sube" style="${estilo({ left: `${6 + ((i * 37) % 88)}%`, '--d': `${13 + (i % 4) * 3}s`, '--r': `${-i * 2.4}s` })}">
      ${svg('-20 -26 40 116', `<path d="M0 14C6 30-6 46 0 62S-4 82 0 88" stroke="rgba(255,255,255,.55)" stroke-width="1.2" fill="none"/>
        <ellipse rx="17" ry="21" fill="${color}"/><ellipse cx="-6" cy="-8" rx="4" ry="7" fill="#fff" opacity=".35"/><path d="M-3 20L0 14 3 20Z" fill="${color}"/>`, 'pieza-globo balanceo')}</div>`;

  const globoCorazon = (i, color) => `<div class="sube" style="${estilo({ left: `${4 + ((i * 41) % 90)}%`, '--d': `${14 + (i % 4) * 3}s`, '--r': `${-i * 2.8}s` })}">
      ${svg('-16 -14 32 96', `<path d="M0 18C6 34-6 50 0 66S-4 86 0 90" stroke="rgba(255,255,255,.5)" stroke-width="1.2" fill="none"/>
        <path d="${CORAZON}" transform="translate(-15 -14) scale(1.25)" fill="${color}"/><ellipse cx="-6" cy="-3" rx="3" ry="5" fill="#fff" opacity=".35"/>`, 'pieza-globo balanceo')}</div>`;

  const regalo = (x, ancho, alto, color, lazo) => `<g transform="translate(${x} ${200 - alto})">
      <rect width="${ancho}" height="${alto}" rx="4" fill="${color}"/><rect x="${ancho / 2 - 5}" width="10" height="${alto}" fill="${lazo}"/>
      <rect y="${alto * .35 - 5}" width="${ancho}" height="10" fill="${lazo}" opacity=".9"/>
      <path d="M${ancho / 2} 0C${ancho / 2 - 22} -18 ${ancho / 2 - 26} 2 ${ancho / 2} 0C${ancho / 2 + 22} -18 ${ancho / 2 + 26} 2 ${ancho / 2} 0Z" fill="${lazo}"/></g>`;

  const pino = (x, escala, i, estrella = false) => `<g transform="translate(${x} 200) scale(${escala})">
      <rect x="-6" y="-14" width="12" height="16" fill="#3f2a1d"/>
      <path d="M0 -150L32 -98H18L46 -56H28L58 -14H-58L-28 -56H-46L-18 -98H-32Z" fill="#14532d"/>
      <path d="M0 -150L32 -98 22 -96 0 -128-22-96-32-98Z M-46 -56H46L34 -52 0 -76-34-52Z M-58 -14H58L44 -10 0 -36-44-10Z" fill="#f0fdf4" opacity=".9"/>
      ${rep(12, (k) => `<circle class="titila" style="--r:${-(k + i) * .37}s" cx="${(azar(k + i * 13, 2) - .5) * (20 + (k % 4) * 22)}" cy="${-120 + (k % 4) * 30 + azar(k, 9) * 10}" r="3.2" fill="${['#fde047', '#f87171', '#60a5fa', '#a3e635'][k % 4]}"/>`)}
      ${estrella ? `<path d="${ESTRELLA}" transform="translate(0 -156) scale(1.6)" fill="#fde047" class="parpadeo"/>` : ''}</g>`;

  const munecoNieve = () => `<g transform="translate(1030 200)">
      <ellipse cy="-2" rx="58" ry="8" fill="#e0f2fe" opacity=".6"/>
      <circle cy="-36" r="38" fill="#f8fafc"/><circle cy="-98" r="28" fill="#f1f5f9"/><circle cy="-146" r="21" fill="#f8fafc"/>
      <path d="M-24 -102L-62 -128M-58 -124L-66 -136M24 -102L62 -128M58 -124L66 -136" stroke="#5b3a29" stroke-width="4" stroke-linecap="round"/>
      <rect x="-18" y="-176" width="36" height="8" rx="2" fill="#111827"/><rect x="-12" y="-198" width="24" height="24" rx="3" fill="#111827"/><rect x="-12" y="-180" width="24" height="5" fill="#dc2626"/>
      <circle cx="-7" cy="-150" r="2.6" fill="#111827"/><circle cx="7" cy="-150" r="2.6" fill="#111827"/>
      <path d="M0 -144L22 -140 0 -138Z" fill="#f97316"/>
      <path d="M-22 -126H22V-118H-22Z" fill="#dc2626"/><path d="M10 -120L18 -96 26 -98 16 -120Z" fill="#b91c1c"/>
      ${[-104, -90, -76].map((y) => `<circle cy="${y + 10}" r="3" fill="#111827"/>`).join('')}</g>`;

  const trineo = () => svg('0 0 230 70', `<g fill="#06070d">
      ${[0, 34, 68].map((x) => `<g transform="translate(${x} 0)"><ellipse cx="22" cy="34" rx="14" ry="6"/><circle cx="36" cy="26" r="4.5"/>
        <path d="M34 22L32 12M33 16L28 12M37 22L40 12M39 16L44 12" stroke="#06070d" stroke-width="1.6" fill="none"/>
        <path d="M12 38L8 50M18 39L18 52M28 39L30 52M33 37L38 49" stroke="#06070d" stroke-width="2.2"/></g>`).join('')}
      <path d="M104 30L150 28" stroke="#06070d" stroke-width="1.4"/>
      <path d="M150 40H204C214 40 218 30 214 20H208C208 28 204 32 198 32H154Z"/><path d="M144 50C160 53 196 53 220 44" stroke="#06070d" stroke-width="3" fill="none"/>
      <circle cx="178" cy="22" r="10"/><circle cx="182" cy="8" r="5"/><path d="M178 6L190 -2 186 8Z"/></g>`, 'pieza-trineo');

  const estallido = (i, colores) => {
    const c = colores[i % colores.length];
    return `<div class="estallido" style="${estilo({ left: `${8 + ((i * 29) % 84)}%`, top: `${6 + ((i * 17) % 38)}%`, '--r': `${-i * 1.1}s`, '--d': `${3.2 + (i % 3) * .6}s` })}">
      ${svg('-60 -60 120 120', rep(16, (k) => {
        const a = (k / 16) * Math.PI * 2;
        return `<path d="M${(Math.cos(a) * 12).toFixed(1)} ${(Math.sin(a) * 12).toFixed(1)}L${(Math.cos(a) * 50).toFixed(1)} ${(Math.sin(a) * 50).toFixed(1)}" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${(Math.cos(a) * 54).toFixed(1)}" cy="${(Math.sin(a) * 54).toFixed(1)}" r="2.4" fill="${c}"/>`;
      }), 'pieza-estallido')}</div>`;
  };

  const ciudad = () => {
    let x = 0;
    let edificios = '';
    let ventanas = '';
    for (let i = 0; x < 1200; i++) {
      const ancho = 40 + azar(i, 3) * 70;
      const alto = x < 600 ? 26 + azar(i, 8) * 42 : 36 + azar(i, 8) * 84;
      edificios += `<rect x="${x.toFixed(0)}" y="${(200 - alto).toFixed(0)}" width="${ancho.toFixed(0)}" height="${alto.toFixed(0)}"/>`;
      for (let k = 0; k < 4; k++) {
        if (azar(i * 7 + k, 4) > .45) ventanas += `<rect class="${azar(i + k, 11) > .8 ? 'titila' : ''}" style="--r:${-k * .8}s" x="${(x + 8 + (k % 2) * (ancho / 2 - 6)).toFixed(0)}" y="${(200 - alto + 12 + Math.floor(k / 2) * 22).toFixed(0)}" width="8" height="10" fill="#fde68a" opacity=".75"/>`;
      }
      x += ancho + 4;
    }
    return `<g fill="#05050c">${edificios}</g>${ventanas}`;
  };

  const calavera = () => svg('-62 -72 124 140', `
      <path d="M-46 -10C-46-48-24-66 0-66S46-48 46-10C46 10 36 20 30 26V44C30 52 22 56 14 56H-14C-22 56-30 52-30 44V26C-36 20-46 10-46-10Z" fill="#fff7ea"/>
      ${[-20, 20].map((cx, i) => `<g transform="translate(${cx} -8)">${rep(8, (k) => `<circle cx="${(Math.cos(k / 8 * 6.283) * 15).toFixed(1)}" cy="${(Math.sin(k / 8 * 6.283) * 15).toFixed(1)}" r="5.5" fill="${i ? '#f472b6' : '#22d3ee'}"/>`)}<circle r="11" fill="#1e1b4b"/><circle r="4" fill="#fde047"/></g>`).join('')}
      <path d="M0 14C-6 6-12 14 0 22 12 14 6 6 0 14Z" fill="#1e1b4b"/>
      <path d="M-20 36H20M-14 30V42M-7 30V42M0 30V42M7 30V42M14 30V42" stroke="#1e1b4b" stroke-width="2"/>
      <g transform="translate(0 -44)">${rep(6, (k) => `<ellipse rx="5" ry="9" transform="rotate(${k * 60}) translate(0 -8)" fill="#fb923c"/>`)}<circle r="5" fill="#a855f7"/></g>
      <path d="M-36 14c-6 0-8 6-4 8s6-2 2-4M36 14c6 0 8 6 4 8s-6-2-2-4" stroke="#a855f7" stroke-width="2" fill="none"/>`, 'pieza-calavera');

  const velaSuelo = (x, i) => `<g transform="translate(${x} 200)"><rect x="-7" y="-40" width="14" height="40" rx="3" fill="#fef3c7"/><rect x="-7" y="-40" width="14" height="6" rx="3" fill="#fde68a"/>${llama(0, -40, .8, i)}</g>`;

  const cempasuchil = (x, y, escala) => `<g transform="translate(${x} ${y}) scale(${escala})">${rep(12, (k) => `<ellipse rx="5" ry="11" transform="rotate(${k * 30}) translate(0 -9)" fill="${k % 2 ? '#f97316' : '#fb923c'}"/>`)}${rep(8, (k) => `<ellipse rx="4" ry="7" transform="rotate(${k * 45 + 20}) translate(0 -5)" fill="#fbbf24"/>`)}<circle r="4" fill="#b45309"/></g>`;

  const acordeon = () => `<g transform="translate(980 86)">
      <defs><linearGradient id="qb-caja-acordeon" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#991b1b"/></linearGradient></defs>
      <g class="fuelle">
        <rect x="50" y="6" width="118" height="94" fill="#7f1d1d"/>
        ${rep(12, (k) => `<path d="M${52 + k * 9.6} 6L${56.8 + k * 9.6} 12V94L${52 + k * 9.6} 100" stroke="${k % 2 ? '#fde68a' : '#fca5a5'}" stroke-width="1.6" fill="none"/>`)}
        <path d="M50 6H168M50 100H168" stroke="#fbbf24" stroke-width="3"/>
      </g>
      <rect x="0" y="0" width="54" height="106" rx="9" fill="url(#qb-caja-acordeon)" stroke="#fbbf24" stroke-width="2.5"/>
      <circle cx="27" cy="20" r="9" fill="none" stroke="#fde68a" stroke-width="2"/><path d="M27 13V27M20 20H34" stroke="#fde68a" stroke-width="1.6"/>
      ${rep(12, (k) => `<circle cx="${14 + (k % 3) * 13}" cy="${42 + Math.floor(k / 3) * 15}" r="4.2" fill="#fff7ea" stroke="#7f1d1d" stroke-width="1"/>`)}
      <rect x="164" y="0" width="54" height="106" rx="9" fill="url(#qb-caja-acordeon)" stroke="#fbbf24" stroke-width="2.5"/>
      <rect x="176" y="8" width="30" height="90" rx="3" fill="#fff7ea"/>
      ${rep(9, (k) => `<path d="M176 ${18 + k * 10}H206" stroke="#cbd5e1" stroke-width="1"/>`)}
      ${rep(5, (k) => `<rect x="176" y="${14 + k * 17 + (k > 2 ? 4 : 0)}" width="17" height="6" rx="1.5" fill="#111827"/>`)}
      <path d="M8 -6C40 -24 178 -24 210 -6" stroke="#5b3a29" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;

  const nota = (i) => `<div class="sube nota-musical" style="${estilo({ left: `${60 + ((i * 13) % 34)}%`, '--d': `${7 + (i % 3) * 2}s`, '--r': `${-i * 1.5}s` })}">${svg('0 0 22 30', `<g fill="${['#fde047', '#fff7ea', '#5eead4'][i % 3]}">${NOTA}</g>`, 'pieza-nota')}</div>`;

  const palmera = (x, escala, i) => `<g transform="translate(${x} 200) scale(${escala})"><g class="balanceo" style="--r:${-i}s">
      <path d="M-4 0C-2-50 6-100 18-150L26-148C14-100 8-50 8 0Z" fill="#05140e"/>
      ${rep(6, (k) => `<path transform="translate(22 -150) rotate(${-150 + k * 50})" d="M0 0C30-10 60-6 82 10 60 2 30 4 0 6Z" fill="#05140e"/>`)}</g></g>`;

  const sol = () => svg('-80 -80 160 160', `<g>${rep(14, (k) => `<path d="M0 -76L6 -52H-6Z" fill="#fde047" transform="rotate(${k * (360 / 14)})"/>`)}</g><circle r="44" fill="#facc15"/><circle r="44" fill="url(#qb-halo)" opacity=".4"/>`, 'pieza-sol');

  const banderaOndeando = () => {
    const ola = (y0, alto, color) => {
      let d = `M0 ${y0}`;
      for (let x = 0; x <= 2400; x += 100) d += `Q${x + 25} ${y0 - 10} ${x + 50} ${y0}T${x + 100} ${y0}`;
      d += `V${y0 + alto}`;
      for (let x = 2400; x >= 0; x -= 100) d += `Q${x - 25} ${y0 + alto + 10} ${x - 50} ${y0 + alto}T${x - 100} ${y0 + alto}`;
      return `<path d="${d}Z" fill="${color}"/>`;
    };
    return `<div class="bandera-ondea">${svg('0 0 2400 80', ola(10, 30, '#fcd116') + ola(40, 15, '#003893') + ola(55, 15, '#ce1126'), '', 'none')}</div>`;
  };

  const trofeo = () => `<g transform="translate(1030 190)">
      <defs><linearGradient id="qb-oro" x1="0" x2="1"><stop offset="0" stop-color="#b45309"/><stop offset=".45" stop-color="#fde68a"/><stop offset="1" stop-color="#d97706"/></linearGradient>
        <clipPath id="qb-copa"><path d="M-36 -150H36C36-110 20-88 0-86-20-88-36-110-36-150Z"/></clipPath></defs>
      <path d="M-36 -146C-62 -146-62-110-30-104M36 -146C62 -146 62-110 30-104" stroke="url(#qb-oro)" stroke-width="7" fill="none"/>
      <path d="M-36 -150H36C36-110 20-88 0-86-20-88-36-110-36-150Z" fill="url(#qb-oro)"/>
      <g clip-path="url(#qb-copa)"><g transform="skewX(-20)"><rect class="destello" x="-60" y="-160" width="22" height="90" fill="#fff" opacity=".55"/></g></g>
      <rect x="-8" y="-86" width="16" height="40" fill="url(#qb-oro)"/><rect x="-34" y="-48" width="68" height="16" rx="3" fill="url(#qb-oro)"/>
      <rect x="-42" y="-32" width="84" height="22" rx="4" fill="#1f2937"/><path d="${ESTRELLA}" transform="translate(0 -122) scale(1.4)" fill="#fff7ea" opacity=".8"/></g>`;

  const parrilla = () => `<g transform="translate(1020 196)">
      ${rep(4, (k) => `<path class="humo" style="--r:${-k * 1.2}s" d="M${-30 + k * 20} -120C${-40 + k * 20} -150 ${-20 + k * 20} -160 ${-30 + k * 20} -190" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round" fill="none"/>`)}
      ${rep(6, (k) => `<path class="llama" style="--r:${-k * .2}s" d="M${-48 + k * 19} -112C${-42 + k * 19} -126 ${-40 + k * 19} -134 ${-48 + k * 19} -146 ${-58 + k * 19} -134 ${-56 + k * 19} -124 ${-48 + k * 19} -112Z" fill="#f97316"/>`)}
      <path d="M-70 -110H70C66 -66 36 -46 0 -46S-66 -66-70 -110Z" fill="#111827"/><path d="M-72 -112H72" stroke="#9ca3af" stroke-width="4"/>
      <path d="M-40 -56L-60 0M40 -56L60 0M0 -46V0" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <rect x="-30" y="-122" width="40" height="10" rx="5" fill="#7c2d12"/><rect x="16" y="-124" width="34" height="12" rx="6" fill="#9a3412"/></g>`;

  const balon = () => `<div class="rebota">${svg('-30 -30 60 60', `<circle r="27" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/><path d="M0 -10L9.5 -3 6 8H-6L-9.5 -3Z" fill="#0f172a"/>${rep(5, (k) => `<path d="M0 -10L0 -24" stroke="#0f172a" stroke-width="2" transform="rotate(${k * 72})"/>`)}`, 'pieza-balon')}</div>`;

  // ---------- guirnaldas (parte de arriba) ----------
  const cuerda = (y = 18) => `<path d="M0 ${y}Q150 ${y + 26} 300 ${y}T600 ${y}T900 ${y}T1200 ${y}" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/>`;
  const yCuerda = (x, y = 18) => y + 13 * Math.sin((x % 300) / 300 * Math.PI);

  const GUIRNALDAS = {
    telaranas: () => `
      ${svg('0 0 220 220', `<g stroke="rgba(255,255,255,.32)" stroke-width="1.4" fill="none">${rep(7, (k) => `<path d="M0 0L${(Math.cos(k / 6 * 1.5708) * 220).toFixed(0)} ${(Math.sin(k / 6 * 1.5708) * 220).toFixed(0)}"/>`)}${rep(5, (r) => { const R = 40 + r * 38; return `<path d="${rep(6, (k) => { const a1 = k / 6 * 1.5708; const a2 = (k + 1) / 6 * 1.5708; const m = (a1 + a2) / 2; return `${k ? '' : `M${(Math.cos(a1) * R).toFixed(0)} ${(Math.sin(a1) * R).toFixed(0)}`}Q${(Math.cos(m) * R * .82).toFixed(0)} ${(Math.sin(m) * R * .82).toFixed(0)} ${(Math.cos(a2) * R).toFixed(0)} ${(Math.sin(a2) * R).toFixed(0)}`; })}"/>`; })}</g>`, 'telarana telarana-izq')}
      ${svg('0 0 220 220', `<g stroke="rgba(255,255,255,.32)" stroke-width="1.4" fill="none" transform="translate(220 0) scale(-1 1)">${rep(7, (k) => `<path d="M0 0L${(Math.cos(k / 6 * 1.5708) * 220).toFixed(0)} ${(Math.sin(k / 6 * 1.5708) * 220).toFixed(0)}"/>`)}${rep(5, (r) => { const R = 40 + r * 38; return `<path d="${rep(6, (k) => { const a1 = k / 6 * 1.5708; const a2 = (k + 1) / 6 * 1.5708; const m = (a1 + a2) / 2; return `${k ? '' : `M${(Math.cos(a1) * R).toFixed(0)} ${(Math.sin(a1) * R).toFixed(0)}`}Q${(Math.cos(m) * R * .82).toFixed(0)} ${(Math.sin(m) * R * .82).toFixed(0)} ${(Math.cos(a2) * R).toFixed(0)} ${(Math.sin(a2) * R).toFixed(0)}`; })}"/>`; })}</g>`, 'telarana telarana-der')}
      <div class="arana">${svg('-20 -150 40 170', `<path d="M0 -150V-6" stroke="rgba(255,255,255,.4)" stroke-width="1.2"/><g fill="#06040a" stroke="#06040a" stroke-width="2.2" stroke-linecap="round"><ellipse cy="4" rx="9" ry="11"/><circle cy="-8" r="6"/>${[-1, 1].map((s) => rep(4, (k) => `<path d="M0 ${-2 + k * 4}l${s * 10} ${-6 + k * 4} ${s * 6} ${8}" fill="none"/>`)).join('')}</g><circle cx="-2.5" cy="-9" r="1.4" fill="#ef4444"/><circle cx="2.5" cy="-9" r="1.4" fill="#ef4444"/>`, 'pieza-arana')}</div>`,

    corazones: (v) => svg('0 0 1200 120', `${cuerda()}${rep(16, (k) => {
      const x = 40 + k * 74;
      const y = yCuerda(x);
      return `<g transform="translate(${x} ${y})"><g class="vaiven" style="--r:${-k * .4}s"><path d="M0 0V${16 + (k % 3) * 10}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/><path d="${CORAZON}" transform="translate(-12 ${12 + (k % 3) * 10}) scale(${1 + (k % 2) * .25})" fill="${k % 2 ? v.c('mustard') : v.c('ketchup')}"/></g></g>`;
    })}`, 'guirnalda', 'xMidYMin slice'),

    luces: () => svg('0 0 1200 90', `${cuerda(14)}${rep(26, (k) => {
      const x = 22 + k * 46;
      const y = yCuerda(x, 14);
      const color = ['#f87171', '#fde047', '#4ade80', '#60a5fa', '#f472b6'][k % 5];
      return `<g transform="translate(${x} ${y}) rotate(${(k % 2 ? 1 : -1) * 12})"><rect x="-3.5" y="0" width="7" height="7" rx="1.5" fill="#1f2937"/><ellipse class="titila" style="--r:${-k * .31}s" cy="15" rx="6.5" ry="10" fill="${color}"/><ellipse cy="15" rx="12" ry="16" fill="${color}" opacity=".18"/></g>`;
    })}`, 'guirnalda', 'xMidYMin slice'),

    papel_picado: (v) => svg('0 0 1200 120', `<path d="M0 10H1200" stroke="rgba(255,255,255,.6)" stroke-width="2"/>${rep(15, (k) => {
      const color = ['#f472b6', '#fbbf24', '#22d3ee', '#a78bfa', '#f97316', '#4ade80'][k % 6];
      return `<g transform="translate(${8 + k * 80} 10)"><g class="vaiven" style="--r:${-k * .35}s"><path d="M0 0H70V78L62 88 54 78 46 88 38 78 30 88 22 78 14 88 6 78 0 88Z" fill="${color}"/>
        <g style="fill:${v.c('char')}"><circle cx="35" cy="34" r="9"/>${rep(6, (q) => `<circle cx="${(35 + Math.cos(q * 1.047) * 18).toFixed(1)}" cy="${(34 + Math.sin(q * 1.047) * 18).toFixed(1)}" r="3.6"/>`)}<path d="M10 62L18 54 26 62 18 70Z M44 62L52 54 60 62 52 70Z"/></g></g></g>`;
    })}`, 'guirnalda', 'xMidYMin slice'),

    banderines: (v) => svg('0 0 1200 90', `${cuerda(10)}${rep(24, (k) => {
      const x = 12 + k * 50;
      const y = yCuerda(x, 10);
      const colores = v.tema === 'fiestas_patrias' ? ['#fcd116', '#003893', '#ce1126'] : [v.c('mustard'), v.c('ketchup'), '#fff7ea', v.c('promo')];
      return `<g transform="translate(${x} ${y})"><path class="vaiven" style="--r:${-k * .28}s" d="M-20 0H20L0 34Z" fill="${colores[k % colores.length]}"/></g>`;
    })}`, 'guirnalda', 'xMidYMin slice'),

    flores: (v) => svg('0 0 1200 100', `${cuerda(12)}${rep(18, (k) => {
      const x = 30 + k * 66;
      const y = yCuerda(x, 12);
      const tono = v.tema === 'dia_muertos' ? ['#f97316', '#fbbf24'][k % 2] : [v.c('ketchup'), v.c('mustard'), '#fff7ea'][k % 3];
      return `<g transform="translate(${x} ${y + 6})"><g class="vaiven" style="--r:${-k * .3}s">${rep(6, (q) => `<ellipse rx="5.5" ry="10" transform="rotate(${q * 60}) translate(0 -8)" fill="${tono}"/>`)}<circle r="5" fill="#fde047"/><ellipse cx="14" cy="6" rx="8" ry="3.5" fill="#16a34a" transform="rotate(25 14 6)"/></g></g>`;
    })}`, 'guirnalda', 'xMidYMin slice'),

    serpentinas: () => svg('0 0 1200 120', rep(9, (k) => {
      const x = 40 + k * 140;
      const color = ['#f472b6', '#fde047', '#60a5fa', '#a3e635', '#fb923c'][k % 5];
      return `<g transform="translate(${x} 0)"><path class="vaiven" style="--r:${-k * .5}s" d="M0 0C14 16-14 30 0 46S-14 76 0 92 14 108 6 118" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`;
    }) + rep(30, (k) => `<rect x="${azar(k, 3) * 1200}" y="${azar(k, 5) * 60}" width="7" height="4" rx="1" fill="${['#f472b6', '#fde047', '#60a5fa', '#a3e635'][k % 4]}" transform="rotate(${azar(k, 2) * 180} ${azar(k, 3) * 1200} ${azar(k, 5) * 60})"/>`), 'guirnalda', 'xMidYMin slice'),
  };

  // ---------- partículas (CSS) ----------
  const particulas = (tipo, n, colores) => rep(n, (k) => `<i class="particula ${tipo}" style="${estilo({
    left: `${(k * 61 + 7) % 100}%`, '--d': `${8 + (k % 7) * 2}s`, '--r': `${-((k * 1.7) % 14).toFixed(1)}s`,
    '--c': colores[k % colores.length], '--t': `${0.6 + (k % 4) * 0.25}`,
  })}"></i>`);

  /* Actor: una pieza animada con su propio SVG pequeño, ubicada con las mismas
     coordenadas del suelo (1200 × 200). Así el celular solo redibuja ese pedacito
     y no toda la franja del suelo en cada cuadro. */
  const actor = (x, y, ancho, alto, contenido) =>
    `<div class="actor" style="${estilo({ left: `${(x / 12).toFixed(2)}%`, width: `${(ancho / 12).toFixed(2)}%`, bottom: `${((200 - y - alto) / 2).toFixed(2)}%` })}">${svg(`${x} ${y} ${ancho} ${alto}`, contenido)}</div>`;

  // ---------- escenas (cielo + suelo) ----------
  const ESCENAS = {
    calabazas: (v) => ({
      cielo: `${luna()}${rep(3, murcielago)}${niebla()}`,
      suelo: svg('0 0 1200 200', `${defsCalabaza}${suelo('#0b0710', 54)}${arbolTorcido(1112)}${calabaza(250, .7, 0, 168)}${calabaza(360, .55, 1, 172)}${calabaza(860, .7, 2, 164)}${calabaza(1040, 1.05, 3, 150)}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-70 -80 140 130', `${defsCalabaza}${calabaza(0, 1, 0, 0)}`),
    }),
    brujas: () => ({
      cielo: `${luna('#d9f99d', 'rgba(217, 249, 157, .35)')}<div class="vuelo-bruja">${bruja()}</div>${rep(2, murcielago)}${niebla()}`,
      suelo: svg('0 0 1200 200', `<defs><radialGradient id="qb-brillo-pocion"><stop offset="0" stop-color="rgba(163,230,53,.45)"/><stop offset="1" stop-color="rgba(163,230,53,0)"/></radialGradient></defs>${defsCalabaza}${suelo('#060a06', 50)}${calabaza(140, .55, 0, 172)}${calabaza(230, .4, 1, 180)}${arbolTorcido(860)}`, 'escena-suelo', 'xMidYMax slice') + actor(966, 40, 148, 136, caldero()),
      intro: `<div class="intro-luna">${luna('#d9f99d', 'rgba(217, 249, 157, .35)')}<div class="intro-bruja">${bruja()}</div></div>`,
    }),
    zombis: () => ({
      cielo: `${luna('#fecaca', 'rgba(248, 113, 113, .35)')}${rep(3, murcielago)}${niebla()}`,
      suelo: svg('0 0 1200 200', `${suelo('#0d0606', 40)}${lapida(80, 72, 'RIP')}${cruz(190, 64)}${lapida(860, 110, 'RIP')}${lapida(1080, 84, '')}${cruz(990, 92)}`, 'escena-suelo', 'xMidYMax slice') + [60, 640, 760, 880, 1000].map((x, i) => actor(x - 20, 110, 80, 90, manoZombi(x, i))).join(''),
      intro: svg('-30 40 190 175', `${lapida(70, 140, 'RIP')}${manoZombi(14, 0)}<ellipse cx="66" cy="204" rx="92" ry="12" fill="#2a1a12"/>`),
    }),
    cupido: (v) => ({
      cielo: `${particulas('corazon-bokeh', 14, [v.c('ketchup'), v.c('mustard'), '#fda4af'])}
        ${rep(3, (i) => `<div class="vuela vuela-${i}" style="${estilo({ top: `${10 + i * 16}%`, '--d': `${18 + i * 5}s`, '--r': `${-i * 6}s` })}">${svg('-50 -30 100 60', corazonAlado(i % 2 ? v.c('mustard') : v.c('ketchup')), 'pieza-corazon-alado')}</div>`)}
        <div class="disparo-flecha">${flecha()}</div>`,
      suelo: svg('0 0 1200 200', `${rep(9, (k) => `<g transform="translate(${60 + k * 130} ${150 - (k % 3) * 14}) scale(${2 + (k % 3) * .6})"><path d="${CORAZON}" fill="${k % 2 ? v.c('ketchup') : v.c('mustard')}" opacity=".85" class="late" style="--r:${-k * .3}s"/></g>`)}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-56 -36 112 72', corazonAlado(v.c('ketchup')), 'intro-latido'),
      figura: svg('-80 -52 160 104', `<g transform="rotate(-18)"><path d="M-60 0H50" stroke="#fde68a" stroke-width="3.2" stroke-linecap="round"/><path d="M-60 0L-70 -8H-56L-48 0-56 8H-70Z" fill="#fb7185"/></g>
        <g class="late">${corazonAlado(v.c('ketchup'))}</g>
        <g transform="rotate(-18)"><path d="M14 0H46" stroke="#fde68a" stroke-width="3.2" stroke-linecap="round"/><path d="M44 -8L62 0 44 8Z" fill="#fde68a"/></g>`),
    }),
    pasion: (v) => ({
      cielo: `${particulas('petalo', 18, ['#ef4444', '#b91c1c', '#fda4af'])}${particulas('corazon-bokeh', 10, [v.c('ketchup'), '#fda4af'])}`,
      suelo: svg('0 0 1200 200', `${defsFresa}${rosa(80, 170, 1.4, '#dc2626', '#991b1b')}${rosa(170, 186, 1, '#ef4444', '#b91c1c')}${rosa(1120, 170, 1.4, '#dc2626', '#991b1b')}${rosa(1030, 188, 1, '#ef4444', '#b91c1c')}
        <path class="dibuja" d="M600 186C520 130 470 90 500 60 530 34 580 50 600 80 620 50 670 34 700 60 730 90 680 130 600 186Z" fill="none" stroke="${v.c('mustard')}" stroke-width="5" stroke-linecap="round"/>`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('0 0 24 24', `<path d="${CORAZON}" fill="${v.c('ketchup')}"/>`, 'intro-latido'),
    }),
    globos: (v) => ({
      cielo: `${rep(6, (i) => (i % 2 ? globo(i, [v.c('mustard'), v.c('ketchup'), '#fde68a'][i % 3]) : globoCorazon(i, [v.c('ketchup'), v.c('mustard')][i % 2])))}${particulas('confeti', 18, [v.c('mustard'), v.c('ketchup'), '#fde047', '#fff7ea'])}`,
      suelo: svg('0 0 1200 200', `${regalo(60, 70, 60, v.c('ketchup'), v.c('mustard'))}${regalo(140, 50, 44, v.c('mustard'), v.c('ketchup'))}${regalo(1040, 80, 66, v.c('promo'), '#fde047')}${regalo(1130, 50, 40, v.c('ketchup'), '#fff7ea')}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-62 -48 124 118', `<g stroke="#fff7ea" stroke-width="1.4" fill="none" opacity=".8"><path d="M-30 0C-24 24-6 40 0 58"/><path d="M0 -6C-4 20 4 40 0 58"/><path d="M30 0C24 24 6 40 0 58"/></g>
        <path d="M-6 56L0 60 6 56 4 66 0 62-4 66Z" fill="${v.c('mustard')}"/>
        <ellipse cx="-30" cy="-16" rx="22" ry="27" fill="${v.c('mustard')}"/><ellipse cx="-37" cy="-27" rx="5" ry="9" fill="#fff" opacity=".35"/>
        <ellipse cx="30" cy="-16" rx="22" ry="27" fill="#fde68a"/><ellipse cx="23" cy="-27" rx="5" ry="9" fill="#fff" opacity=".35"/>
        <path d="${CORAZON}" transform="translate(-26 -48) scale(2.15)" fill="${v.c('ketchup')}"/><ellipse cx="-10" cy="-30" rx="4" ry="7" fill="#fff" opacity=".35" transform="rotate(-30 -10 -30)"/>`, 'intro-latido'),
    }),
    rosas: (v) => ({
      cielo: `${particulas('petalo', 18, [v.c('ketchup'), v.c('mustard'), '#fbcfe8'])}`,
      suelo: svg('0 0 1200 200', `${defsFresa}${rosa(70, 170, 1.2, v.c('ketchup'), v.c('ketchup2'))}${rosa(150, 184, .95, v.c('mustard'), v.c('ketchup'))}${rosa(30, 192, .9, v.c('mustard'), v.c('ketchup2'))}
        ${fresa(230, 182, 1.3, -15)}${fresa(268, 190, 1, 18)}${fresa(950, 186, 1.2, 12)}
        ${rosa(1130, 160, 1.5, v.c('ketchup'), v.c('ketchup2'))}${rosa(1050, 184, 1.05, v.c('mustard'), v.c('ketchup'))}${rosa(1176, 192, .9, v.c('mustard'), v.c('ketchup2'))}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-80 -50 160 120', `${rosa(0, 0, 1.62, v.c('ketchup'), v.c('ketchup2'))}`),
    }),
    lavanda: (v) => ({
      cielo: `${rep(3, mariposa)}${particulas('petalo', 10, ['#c4b5fd', '#e9d5ff', v.c('ketchup')])}`,
      suelo: svg('0 0 1200 200', `${defsFresa}${rep(9, (k) => lavanda(30 + k * 18, 46 + (k % 3) * 12, k))}${rep(9, (k) => lavanda(1010 + k * 18, 70 + (k % 3) * 22, k + 3))}${fresa(220, 186, 1.2, -10)}${fresa(980, 188, 1.1, 14)}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-24 -20 48 40', `<ellipse cx="-11" cy="-6" rx="11" ry="9" fill="#c4b5fd"/><ellipse cx="-9" cy="8" rx="7" ry="6" fill="#a78bfa"/><g transform="scale(-1 1)"><ellipse cx="-11" cy="-6" rx="11" ry="9" fill="#c4b5fd"/><ellipse cx="-9" cy="8" rx="7" ry="6" fill="#a78bfa"/></g><rect x="-1.5" y="-12" width="3" height="24" rx="1.5" fill="#3b0764"/>`, 'intro-latido'),
    }),
    pastel: (v, n) => ({
      cielo: `${rep(6, (i) => globo(i, [v.c('mustard'), v.c('ketchup'), '#fde68a', v.c('promo')][i % 4]))}${particulas('confeti', 26, [v.c('mustard'), v.c('ketchup'), '#fde047', '#fff7ea', '#38bdf8'])}`,
      suelo: svg('0 0 1200 200', `${regalo(50, 70, 60, v.c('ketchup'), v.c('mustard'))}${regalo(130, 50, 44, v.c('mustard'), v.c('ketchup'))}${regalo(1060, 74, 62, v.c('promo'), '#fde047')}${regalo(1140, 46, 40, v.c('ketchup'), '#fff7ea')}`, 'escena-suelo', 'xMidYMax meet'),
      intro: svg('0 -30 260 246', pastel(n)),
    }),
    pinos: () => ({
      cielo: `${particulas('copo', 34, ['#ffffff', '#e0f2fe'])}`,
      suelo: svg('0 0 1200 200', `${suelo('#f8fafc', 34)}${pino(60, .44, 0)}${pino(140, .5, 1, true)}${pino(215, .38, 2)}${pino(950, .8, 3)}${pino(1060, 1.2, 4, true)}${pino(1150, .85, 5)}${regalo(320, 46, 34, '#dc2626', '#fde047')}${regalo(880, 40, 30, '#16a34a', '#fde047')}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-70 -170 140 180', pino(0, 1, 0, true).replace('translate(0 200)', 'translate(0 0)')),
    }),
    muneco: () => ({
      cielo: `${particulas('copo', 44, ['#ffffff', '#e0f2fe'])}`,
      suelo: svg('0 0 1200 200', `${suelo('#f8fafc', 40)}${pino(80, .48, 0, true)}${pino(160, .38, 1)}${regalo(240, 44, 32, '#dc2626', '#fde047')}${pino(980, .9, 2)}${pino(1080, 1.15, 3, true)}${regalo(1150, 40, 30, '#2563eb', '#fde047')}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('-70 -210 140 220', munecoNieve().replace('translate(1030 200)', 'translate(0 0)')),
    }),
    trineo: () => ({
      cielo: `${luna()}<div class="vuelo-trineo">${trineo()}</div>${particulas('copo', 26, ['#ffffff'])}`,
      suelo: svg('0 0 1200 200', `${suelo('#e2e8f0', 36)}${pino(80, .48, 0, true)}${pino(1100, 1, 1, true)}${regalo(180, 50, 40, '#b91c1c', '#fcd34d')}${regalo(990, 46, 36, '#15803d', '#fcd34d')}`, 'escena-suelo', 'xMidYMax slice'),
      intro: `<div class="intro-luna">${luna()}<div class="intro-trineo">${trineo()}</div></div>`,
    }),
    fuegos: (v) => ({
      cielo: `${rep(7, (i) => estallido(i, [v.c('mustard'), v.c('mustard2'), '#f472b6', '#a3e635', '#fff7ea']))}${particulas('confeti', 16, [v.c('mustard'), '#f472b6', '#60a5fa'])}`,
      suelo: svg('0 0 1200 200', ciudad(), 'escena-suelo', 'xMidYMax slice'),
      intro: `<div class="intro-fuegos">${rep(4, (i) => estallido(i, [v.c('mustard'), '#f472b6', '#60a5fa', '#a3e635']))}</div>`,
    }),
    catrina: (v) => ({
      cielo: `${particulas('petalo-cempasuchil', 22, ['#f97316', '#fb923c', '#fbbf24'])}<div class="pieza-calavera-cielo pieza-flor-cielo">${svg('-30 -30 60 60', cempasuchil(0, 0, 2.3))}</div>`,
      suelo: svg('0 0 1200 200', `${defsLlama}${rep(6, (k) => cempasuchil(40 + k * 50, 190, .9))}${rep(5, (k) => cempasuchil(960 + k * 55, 192, .85))}`, 'escena-suelo', 'xMidYMax slice')
        + rep(5, (k) => actor(44 + k * 46, 132, 32, 68, velaSuelo(60 + k * 46, k))) + rep(4, (k) => actor(964 + k * 50, 132, 32, 68, velaSuelo(980 + k * 50, k + 5))),
      intro: calavera(),
    }),
    cempasuchil: () => ({
      cielo: `${particulas('petalo-cempasuchil', 34, ['#f97316', '#fb923c', '#fbbf24'])}`,
      suelo: svg('0 0 1200 200', `${defsLlama}${rep(14, (k) => cempasuchil(20 + k * 44, 186 - (k % 2) * 10, 1.1))}${rep(10, (k) => cempasuchil(760 + k * 46, 186 - (k % 2) * 10, 1.1))}`, 'escena-suelo', 'xMidYMax slice')
        + rep(3, (k) => actor(624 + k * 40, 132, 32, 68, velaSuelo(640 + k * 40, k))),
      intro: svg('-38 -38 76 76', cempasuchil(0, 0, 1.8)),
    }),
    acordeon: (v) => ({
      cielo: `<div class="pieza-sol-cielo">${svg('-120 -120 240 240', `<defs><radialGradient id="qb-halo"><stop offset="0" stop-color="rgba(250,204,21,.4)"/><stop offset="1" stop-color="rgba(250,204,21,0)"/></radialGradient></defs><circle r="118" fill="url(#qb-halo)"/>`)}${sol()}</div>${rep(8, nota)}`,
      suelo: svg('0 0 1200 200', `${suelo('#05140e', 44)}${palmera(60, .46, 0)}${palmera(140, .36, 1)}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('966 56 260 146', acordeon()),
    }),
    bandera: (v) => ({
      cielo: `${rep(4, (i) => estallido(i, ['#fcd116', '#ce1126', '#fff7ea', '#60a5fa']))}${particulas('confeti', 20, ['#fcd116', '#003893', '#ce1126'])}`,
      suelo: banderaOndeando(),
      intro: `<div class="intro-bandera">${banderaOndeando()}</div>`,
    }),
    trofeo: (v) => ({
      cielo: `${particulas('estrellita', 18, ['#fde68a', '#fff7ea', v.c('mustard')])}`,
      suelo: svg('0 0 1200 200', `${suelo('#0b1220', 30)}${rep(5, (k) => `<path d="${ESTRELLA}" transform="translate(${80 + k * 60} ${170 - (k % 2) * 20}) scale(${1.4 + (k % 3) * .4})" fill="${v.c('mustard')}" class="parpadeo" style="--r:${-k * .4}s"/>`)}`, 'escena-suelo', 'xMidYMax slice'),
      intro: svg('960 20 140 180', trofeo()),
    }),
    parrilla: () => ({
      cielo: `${particulas('chispa', 22, ['#f97316', '#fbbf24', '#ef4444'])}`,
      suelo: svg('0 0 1200 200', suelo('#140b05', 30), 'escena-suelo', 'xMidYMax slice'),
      intro: svg('930 -10 180 210', parrilla()),
    }),
    futbol: () => ({
      cielo: `${particulas('confeti', 18, ['#4ade80', '#fff7ea', '#fde047'])}`,
      suelo: `${svg('0 0 1200 200', `<rect y="150" width="1200" height="50" fill="#14532d"/><path d="M0 162H1200M600 150V200" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
        <g transform="translate(1000 60)" stroke="#f8fafc" stroke-width="5" fill="none"><path d="M0 92V0H160V92"/><g stroke-width="1" opacity=".5">${rep(10, (k) => `<path d="M${k * 16} 0V92M0 ${k * 9.2}H160"/>`)}</g></g>`, 'escena-suelo', 'xMidYMax slice')}${balon()}`,
      intro: svg('-30 -30 60 60', `<circle r="27" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/><path d="M0 -10L9.5 -3 6 8H-6L-9.5 -3Z" fill="#0f172a"/>`, 'intro-latido'),
    }),
  };

  // ---------- patrones del menú y adornos de las tarjetas ----------
  const PATRONES = {
    murcielagos: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><path d='${MURCIELAGO}' transform='translate(20 20) scale(.5)' fill='${c}'/><path d='${MURCIELAGO}' transform='translate(96 74) scale(.38) rotate(-12)' fill='${c}'/></svg>`,
    calaveras: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><g fill='${c}' transform='translate(30 30) scale(.35)'><path d='M-46 -10C-46-48-24-66 0-66S46-48 46-10C46 10 36 20 30 26V44H-30V26C-36 20-46 10-46-10Z'/></g><g fill='${c}' transform='translate(100 100) scale(.25)'><path d='M-46 -10C-46-48-24-66 0-66S46-48 46-10C46 10 36 20 30 26V44H-30V26C-36 20-46 10-46-10Z'/></g></svg>`,
    corazones: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><path d='${CORAZON}' transform='translate(14 14) scale(1.3)' fill='${c}'/><path d='${CORAZON}' transform='translate(74 70) scale(.9) rotate(15)' fill='${c}'/></svg>`,
    flores: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='${c}' transform='translate(30 30)'>${rep(5, (k) => `<ellipse rx='5' ry='10' transform='rotate(${k * 72}) translate(0 -8)'/>`)}</g><g fill='${c}' transform='translate(90 88) scale(.7)'>${rep(5, (k) => `<ellipse rx='5' ry='10' transform='rotate(${k * 72}) translate(0 -8)'/>`)}</g></svg>`,
    copos: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g stroke='${c}' stroke-width='3' stroke-linecap='round' transform='translate(32 32)'>${rep(6, (k) => `<path d='M0 0V-18M0 -10L-5 -15M0 -10L5 -15' transform='rotate(${k * 60})'/>`)}</g><g stroke='${c}' stroke-width='2.5' stroke-linecap='round' transform='translate(90 88) scale(.65)'>${rep(6, (k) => `<path d='M0 0V-18M0 -10L-5 -15M0 -10L5 -15' transform='rotate(${k * 60})'/>`)}</g></svg>`,
    estrellas: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><path d='${ESTRELLA}' transform='translate(30 30) scale(1.6)' fill='${c}'/><path d='${ESTRELLA}' transform='translate(88 86) scale(1)' fill='${c}'/></svg>`,
    notas: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='${c}' transform='translate(20 20)'>${NOTA}</g><g fill='${c}' transform='translate(80 70) scale(.8)'>${NOTA}</g></svg>`,
    confeti: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='${c}'><rect x='20' y='20' width='10' height='5' rx='2' transform='rotate(30 25 22)'/><rect x='80' y='40' width='10' height='5' rx='2' transform='rotate(-40 85 42)'/><circle cx='50' cy='90' r='3.5'/><rect x='96' y='96' width='9' height='5' rx='2' transform='rotate(70 100 98)'/></g></svg>`,
  };

  const ORNAMENTOS = {
    telarana: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><g stroke='${c}' stroke-width='1.5' fill='none'><path d='M60 0L0 0M60 0L60 60M60 0L14 46M60 0L34 56M60 0L4 26'/><path d='M44 0Q46 10 60 16M28 0Q32 22 60 32M12 0Q18 36 60 48'/></g></svg>`,
    corazon: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${CORAZON}' fill='${c}'/></svg>`,
    rosa: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-60 -36 120 90'>${formaRosa(c, '#4c0519').replaceAll('"', "'")}</svg>`,
    copo: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-24 -24 48 48'><g stroke='${c}' stroke-width='3' stroke-linecap='round'>${rep(6, (k) => `<path d='M0 0V-20M0 -12L-6 -18M0 -12L6 -18' transform='rotate(${k * 60})'/>`)}</g></svg>`,
    estrella: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-11 -11 22 22'><path d='${ESTRELLA}' fill='${c}'/></svg>`,
    nota: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 30'><g fill='${c}'>${NOTA}</g></svg>`,
    vela: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-12 -30 24 52'><rect x='-6' y='0' width='12' height='22' rx='2' fill='${c}'/><path d='M0 -26C6 -16 8 -8 0 -2-8-8-6-16 0-26Z' fill='#f59e0b'/></svg>`,
    flor: (c) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-20 -20 40 40'>${rep(10, (k) => `<ellipse rx='4' ry='9' transform='rotate(${k * 36}) translate(0 -7)' fill='${c}'/>`)}<circle r='4' fill='#b45309'/></svg>`,
  };

  // ---------- adornos del título "quechimba" (por festividad) ----------
  const gotas = () => svg('0 0 300 60', `<rect width="300" height="9" rx="4"/>${rep(10, (k) => {
    const x = 12 + k * 29 + azar(k, 4) * 8;
    const w = 7 + azar(k, 2) * 6;
    const largo = 10 + azar(k, 9) * 34;
    return `<path class="gota" style="--r:${-k * .6}s;--d:${3 + azar(k, 1) * 3}s" d="M${x.toFixed(1)} 4h${w.toFixed(1)}v${largo.toFixed(1)}a${(w / 2).toFixed(1)} ${(w / 2).toFixed(1)} 0 0 1 -${w.toFixed(1)} 0z"/>`;
  })}`, 'titulo-gotas', 'none');
  const gorroNieve = () => svg('0 0 300 34', `<path d="M2 30C0 18 10 10 22 14 26 4 44 2 52 10 60 2 78 2 84 12 92 4 112 4 118 14 128 6 146 6 150 14 160 4 180 4 186 14 196 6 214 6 220 14 230 4 250 4 256 14 266 6 284 8 288 18 298 18 300 26 298 30Z" fill="#f8fafc"/><path d="M40 30V38M90 30V42M150 30V36M210 30V44M262 30V38" stroke="#e0f2fe" stroke-width="5" stroke-linecap="round"/>`, 'titulo-nieve', 'none');
  const destellos = (color) => `<span class="titulo-destellos">${rep(5, (k) => `<i style="${estilo({ left: `${[3, 28, 54, 80, 76][k]}%`, top: `${[96, 102, 96, 102, 34][k]}%`, '--r': `${-k * .45}s` })}">${svg('-11 -11 22 22', `<path d="${ESTRELLA}" fill="${color}"/>`)}</i>`)}</span>`;
  const corazoncitos = (color) => `<span class="titulo-corazones">${rep(5, (k) => `<i style="${estilo({ left: `${8 + k * 20}%`, '--r': `${-k * .7}s`, '--t': `${.7 + (k % 3) * .2}` })}">${svg('0 0 24 24', `<path d="${CORAZON}" fill="${color}"/>`)}</i>`)}</span>`;
  const corona = () => svg('-40 -30 80 40', `<path d="M-34 6L-38-22-18-6 0-28 18-6 38-22 34 6Z" fill="#fcd34d" stroke="#b45309" stroke-width="2"/><circle cx="0" cy="-28" r="4" fill="#ef4444"/><circle cx="-38" cy="-22" r="3.4" fill="#38bdf8"/><circle cx="38" cy="-22" r="3.4" fill="#38bdf8"/><rect x="-34" y="2" width="68" height="7" rx="2" fill="#f59e0b"/>`, 'titulo-corona');
  const florTitulo = () => `<span class="titulo-flor">${svg('-46 -46 92 92', cempasuchil(0, 0, 2.2))}</span>`;

  const TITULOS = {
    halloween: () => gotas(),
    navidad: () => gorroNieve(),
    aniversario: () => destellos('#fde68a'),
    ano_nuevo: () => destellos('#fff7ea'),
    amor_amistad: (v) => corazoncitos(v.c('ketchup')),
    dia_madre: (v) => corazoncitos(v.c('mustard')),
    dia_padre: () => corona(),
    dia_muertos: () => florTitulo(),
    festival_vallenato: () => `<span class="titulo-corazones titulo-notas">${rep(4, (k) => `<i style="${estilo({ left: `${10 + k * 26}%`, '--r': `${-k * .9}s`, '--t': `${.8 + (k % 2) * .3}` })}">${svg('0 0 22 30', `<g fill="#fde047">${NOTA}</g>`)}</i>`)}</span>`,
  };

  // ---------- borde de arriba del menú (sale de la franja amarilla) ----------
  const BORDES = {
    halloween: () => svg('0 0 1200 60', `<path d="M0 0H1200V8${rep(24, (k) => {
      const x = 1200 - k * 50;
      const largo = 12 + azar(k, 6) * 40;
      return `C${x - 8} 8 ${x - 10} ${largo} ${x - 18} ${largo}S${x - 26} 8 ${x - 34} 8 ${x - 44} 14 ${x - 50} 8`;
    })}Z"/>`, 'borde-baba', 'none'),
    navidad: () => svg('0 0 1200 40', `<path d="M0 0H1200V6${rep(60, (k) => { const x = 1200 - k * 20; const l = 8 + azar(k, 3) * 26; return `L${x - 6} 6 ${x - 10} ${l.toFixed(1)} ${x - 14} 6`; })}L0 6Z" fill="#e0f2fe"/>`, 'borde-hielo', 'none'),
  };

  // ---------- API pública ----------
  window.QB_ESCENAS = {
    /** Nombres válidos (las pruebas verifican que cada diseño use uno que exista). */
    catalogo: { escenas: Object.keys(ESCENAS), guirnaldas: Object.keys(GUIRNALDAS), patrones: Object.keys(PATRONES), ornamentos: Object.keys(ORNAMENTOS) },
    /** Devuelve las piezas HTML de la escena para una variante de tema. */
    construir(v, tema, numero) {
      const vv = { ...v, tema, c: (k) => (v.colores?.[k] ?? { char: '#17120e', char2: '#221a14', mustard: '#ffb703', mustard2: '#ffc93c', ketchup: '#d33216', ketchup2: '#b92b12', promo: '#d33216' }[k]) };
      const e = (ESCENAS[v.escena] ?? ESCENAS.globos)(vv, numero);
      const colorPatron = vv.c(['notas', 'copos', 'estrellas'].includes(v.patron) ? 'promo' : 'ketchup');
      const esSvg = typeof e.intro === 'string' && e.intro.startsWith('<svg');
      return {
        guirnalda: v.guirnalda === 'telaranas'
          ? `<div class="capa-guirnalda">${GUIRNALDAS.telaranas(vv)}</div>`
          : GUIRNALDAS[v.guirnalda] ? `<div class="capa-guirnalda capa-guirnalda--tira" style="background-image:${uri(GUIRNALDAS[v.guirnalda](vv).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}"></div>` : '',
        cielo: `<div class="capa-cielo">${e.cielo}</div>`,
        suelo: `<div class="capa-suelo capa-suelo--${v.escena}">${e.suelo}</div>`,
        intro: e.intro,
        figura: (e.figura ?? (esSvg ? e.intro : '')).replace('preserveAspectRatio="xMidYMid meet"', 'preserveAspectRatio="xMidYMax meet"'),
        titulo: TITULOS[tema] ? TITULOS[tema](vv) : '',
        borde: BORDES[tema] ? BORDES[tema]() : '',
        patron: PATRONES[v.patron] ? uri(PATRONES[v.patron](colorPatron)) : 'none',
        patronClaro: PATRONES[v.patron] ? uri(PATRONES[v.patron]('#ffffff')) : 'none',
        ornamento: ORNAMENTOS[v.ornamento] ? uri(ORNAMENTOS[v.ornamento](vv.c('ketchup'))) : 'none',
      };
    },
  };
})();
