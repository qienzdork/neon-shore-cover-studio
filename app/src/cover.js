// Neon Shore Cover Studio — cover renderer (pure canvas, no DOM).
// Draws a GTA-poster-style multi-panel cover from a state object:
// photos (Image elements), per-panel crop/position slots, a layout,
// a colour grade, and caption text. Everything is drawn in code;
// no external image is ever loaded by the renderer itself.

export const LAYOUTS = [
  { id: 'hero-three', name: 'Hero + Three' },
  { id: 'four-grid', name: 'Four Panel Grid' },
  { id: 'nine-grid', name: 'Nine Panel Grid' },
  { id: 'full-bleed', name: 'Full Bleed' },
  { id: 'tilted', name: 'Tilted Snapshots' },
  { id: 'diagonal', name: 'Diagonal Split' },
];

export const GRADES = [
  { id: 'vice-sunset', name: 'Vice Sunset', filter: 'saturate(1.3) contrast(1.1) brightness(1.02)', tint: '#ff6a3d', tintAlpha: 0.12, sky: ['#1d0b38', '#7b2d8b', '#ff7e5f', '#feb47b'] },
  { id: 'neon-nights', name: 'Neon Nights', filter: 'saturate(1.45) contrast(1.12) brightness(0.96)', tint: '#00e5ff', tintAlpha: 0.10, sky: ['#0b0620', '#3b0f6e', '#c724b1', '#ff2e88'] },
  { id: 'golden-hour', name: 'Golden Hour', filter: 'saturate(1.2) contrast(1.05) sepia(0.22)', tint: '#ffb347', tintAlpha: 0.12, sky: ['#2a1a3a', '#b3541e', '#f6a93b', '#ffe08a'] },
  { id: 'teal-dawn', name: 'Teal Dawn', filter: 'saturate(1.15) contrast(1.06) hue-rotate(-12deg)', tint: '#2dd4bf', tintAlpha: 0.10, sky: ['#062a33', '#0e6b6b', '#3fb8a6', '#b8f1e4'] },
  { id: 'hot-pink', name: 'Hot Pink', filter: 'saturate(1.6) contrast(1.1)', tint: '#ff2e88', tintAlpha: 0.13, sky: ['#2b0a2e', '#8b1e6b', '#ff2e88', '#ff8ac2'] },
  { id: 'mono-noir', name: 'Mono Noir', filter: 'grayscale(1) contrast(1.25) brightness(1.04)', tint: '#ffffff', tintAlpha: 0.05, sky: ['#000000', '#222222', '#555555', '#999999'] },
];

export const SIZES = [
  { id: '1080x1080', name: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', name: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', name: 'Wide 1920 x 1080', w: 1920, h: 1080 },
  { id: '1080x1920', name: 'Story 1080 x 1920', w: 1080, h: 1920 },
];

/** A tiny seeded PRNG so grain and shuffle render the same every time. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) || SIZES[0];
}

/** How many photo panels a layout holds. */
export function slotCount(layout) {
  switch (layout) {
    case 'hero-three': return 4;
    case 'four-grid': return 4;
    case 'nine-grid': return 8;
    case 'full-bleed': return 1;
    case 'tilted': return 3;
    case 'diagonal': return 2;
    default: return 4;
  }
}

export function defaultSlot() {
  return { photo: -1, scale: 1, x: 0, y: 0, rot: 0, flip: false, fit: false };
}

/** Panel rectangles for a layout, in canvas pixels. kind 'title' is a caption block, not a photo. */
export function layoutPanels(layout, W, H) {
  const g = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  switch (layout) {
    case 'hero-three': {
      const heroH = Math.round(H * 0.60);
      const sw = (W - g * 2) / 3;
      const sh = H - heroH - g;
      return [
        { x: 0, y: 0, w: W, h: heroH, kind: 'photo' },
        { x: 0, y: heroH + g, w: sw, h: sh, kind: 'photo' },
        { x: sw + g, y: heroH + g, w: sw, h: sh, kind: 'photo' },
        { x: 2 * (sw + g), y: heroH + g, w: sw, h: sh, kind: 'photo' },
      ];
    }
    case 'four-grid': {
      const cw = (W - g) / 2;
      const ch = (H - g) / 2;
      return [
        { x: 0, y: 0, w: cw, h: ch, kind: 'photo' },
        { x: cw + g, y: 0, w: cw, h: ch, kind: 'photo' },
        { x: 0, y: ch + g, w: cw, h: ch, kind: 'photo' },
        { x: cw + g, y: ch + g, w: cw, h: ch, kind: 'photo' },
      ];
    }
    case 'nine-grid': {
      const cw = (W - g * 2) / 3;
      const ch = (H - g * 2) / 3;
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const centre = r === 1 && c === 1;
          cells.push({ x: c * (cw + g), y: r * (ch + g), w: cw, h: ch, kind: centre ? 'title' : 'photo' });
        }
      }
      return cells;
    }
    case 'full-bleed':
      return [{ x: 0, y: 0, w: W, h: H, kind: 'photo' }];
    case 'tilted': {
      const pw = W * 0.52;
      const ph = H * 0.42;
      const foot = Math.round(ph * 0.16);
      return [
        { x: W * 0.04, y: H * 0.06, w: pw, h: ph, rot: -0.10, foot, kind: 'polaroid' },
        { x: W * 0.44, y: H * 0.30, w: pw, h: ph, rot: 0.07, foot, kind: 'polaroid' },
        { x: W * 0.10, y: H * 0.55, w: pw, h: ph, rot: -0.03, foot, kind: 'polaroid' },
      ];
    }
    case 'diagonal': {
      const band = Math.round(Math.min(W, H) * 0.05);
      return [
        { x: 0, y: 0, w: W, h: H, kind: 'photo', poly: [[0, 0], [W, 0], [0, H - band]] },
        { x: 0, y: 0, w: W, h: H, kind: 'photo', poly: [[W, band], [W, H], [0, H]] },
      ];
    }
    default:
      return layoutPanels('hero-three', W, H);
  }
}

/** Clip the context to a panel's shape (rectangle, polygon, or rotated frame). */
export function clipPanel(ctx, panel) {
  ctx.save();
  ctx.beginPath();
  if (panel.poly) {
    ctx.moveTo(panel.poly[0][0], panel.poly[0][1]);
    for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i][0], panel.poly[i][1]);
    ctx.closePath();
  } else if (panel.rot) {
    const cx = panel.x + panel.w / 2;
    const cy = panel.y + panel.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(panel.rot);
    ctx.rect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
  } else {
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
  }
  ctx.clip();
}

/** Draw one photo into a panel rect, honouring the slot's crop, zoom, pan, rotation and flip. */
export function drawPhotoIn(ctx, img, panel, slot, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const px = panel.x;
  const py = panel.y;
  const pw = panel.w;
  const ph = panel.h - (panel.foot || 0);
  ctx.save();
  ctx.filter = grade.filter;
  if (slot.fit) {
    // Blurred backdrop that covers the panel, then the whole photo contained on top.
    ctx.save();
    ctx.filter = `blur(${Math.round(pw * 0.02)}px) saturate(1.2) brightness(0.8)`;
    const bs = Math.max(pw / iw, ph / ih) * 1.05;
    ctx.drawImage(img, px + pw / 2 - (iw * bs) / 2, py + ph / 2 - (ih * bs) / 2, iw * bs, ih * bs);
    ctx.restore();
    ctx.filter = grade.filter;
    const fs = Math.min(pw / iw, ph / ih) * slot.scale;
    if (slot.flip) {
      ctx.translate(px + pw / 2 + slot.x, py + ph / 2 + slot.y);
      ctx.scale(-1, 1);
      ctx.rotate(slot.rot);
      ctx.drawImage(img, (-iw * fs) / 2, (-ih * fs) / 2, iw * fs, ih * fs);
    } else {
      ctx.translate(px + pw / 2 + slot.x, py + ph / 2 + slot.y);
      ctx.rotate(slot.rot);
      ctx.drawImage(img, (-iw * fs) / 2, (-ih * fs) / 2, iw * fs, ih * fs);
    }
  } else {
    const base = Math.max(pw / iw, ph / ih);
    const s = base * slot.scale;
    ctx.translate(px + pw / 2 + slot.x, py + ph / 2 + slot.y);
    ctx.rotate(slot.rot);
    if (slot.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, (-iw * s) / 2, (-ih * s) / 2, iw * s, ih * s);
  }
  ctx.restore();
}

/** A flat-colour placeholder panel for an empty photo slot (drawn, never a photo). */
export function drawEmptyPanel(ctx, panel, seed) {
  const rnd = mulberry32(seed * 31 + Math.round(panel.x + panel.y));
  const hues = ['#3b2d5c', '#173a4d', '#4d1f3d', '#2c4d2a'];
  const c = hues[Math.floor(rnd() * hues.length)];
  ctx.save();
  ctx.fillStyle = c;
  if (panel.poly) {
    ctx.beginPath();
    ctx.moveTo(panel.poly[0][0], panel.poly[0][1]);
    for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i][0], panel.poly[i][1]);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h - (panel.foot || 0));
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(panel.x + 8, panel.y + 8, panel.w - 16, panel.h - (panel.foot || 0) - 16);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.max(14, Math.round(panel.w * 0.045))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+ ADD PHOTO', panel.x + panel.w / 2, panel.y + (panel.h - (panel.foot || 0)) / 2);
  ctx.restore();
}

/** A Vice City sunset sky: gradient, slatted sun, distant skyline, palm silhouettes. */
export function drawSky(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const stops = grade.sky;
  stops.forEach((c, i) => sky.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Slatted sun: a disc with sky-coloured bars cut through its lower half.
  const sx = W * 0.68;
  const sy = H * 0.34;
  const sr = Math.min(W, H) * 0.17;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd166';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = stops[0];
  for (let i = 0; i < 5; i++) {
    const y = sy + sr * 0.05 + i * sr * 0.16;
    ctx.fillRect(sx - sr, y, sr * 2, sr * 0.05 + i * 1.5);
  }
  ctx.restore();
  // Distant skyline blocks.
  ctx.save();
  ctx.fillStyle = 'rgba(10, 4, 24, 0.55)';
  const rnd = mulberry32(99);
  let bx = 0;
  while (bx < W) {
    const bw = W * (0.05 + rnd() * 0.08);
    const bh = H * (0.05 + rnd() * 0.10);
    ctx.fillRect(bx, H * 0.78 - bh, bw, bh);
    bx += bw + W * 0.015;
  }
  ctx.restore();
  // Palm silhouettes along both edges.
  drawPalm(ctx, W * 0.06, H * 0.98, Math.min(W, H) * 0.34, -0.12);
  drawPalm(ctx, W * 0.94, H * 0.98, Math.min(W, H) * 0.30, 0.14);
}

/** One palm silhouette: a leaning trunk and drooping frond blades. */
export function drawPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = 'rgba(8, 3, 18, 0.9)';
  // Trunk, slightly curved.
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.quadraticCurveTo(s * 0.03, -s * 0.5, s * 0.10, -s * 0.92);
  ctx.quadraticCurveTo(s * 0.13, -s * 0.94, s * 0.12, -s * 0.90);
  ctx.quadraticCurveTo(s * 0.07, -s * 0.5, s * 0.03, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: filled drooping blades fanning from the crown.
  const cx = s * 0.11;
  const cy = -s * 0.92;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.08 + (i / 6) * 0.84);
    const len = s * (0.34 + (i % 3) * 0.04);
    const tipX = cx + Math.cos(a) * len;
    const tipY = cy + Math.sin(a) * len * 0.55 + len * 0.28;
    const midX = cx + Math.cos(a) * len * 0.5;
    const midY = cy + Math.sin(a) * len * 0.5 - len * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + len * 0.08, midY + len * 0.10, cx, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Bold caption lettering: gradient Anton title with an ink outline, Pacifico subtitle, Bebas badge ribbon. */
export function drawLettering(ctx, W, H, title, subtitle, badge, seed) {
  const unit = Math.min(W, H);
  const titleText = title === null ? null : (title || 'NEON SHORE').toUpperCase();
  let size = Math.round(unit * 0.105);
  const tx = W * 0.045;
  const ty = H - unit * 0.055;
  // Title: fit to 92% of the width, slightly tilted, bottom-left over a soft scrim.
  if (titleText !== null) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const fitTitle = (px) => {
    ctx.font = `${px}px Anton, 'Arial Black', sans-serif`;
    return ctx.measureText(titleText).width;
  };
  while (size > 20 && fitTitle(size) > W * 0.92) size -= 4;
  const scrimH = size * 1.9;
  const scrim = ctx.createLinearGradient(0, H - scrimH, 0, H);
  scrim.addColorStop(0, 'rgba(5, 2, 16, 0)');
  scrim.addColorStop(1, 'rgba(5, 2, 16, 0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H - scrimH, W, scrimH);
  ctx.translate(tx, ty);
  ctx.rotate(-0.02);
  const grad = ctx.createLinearGradient(0, -size, 0, size * 0.2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#ffe9a8');
  grad.addColorStop(1, '#ff9e57');
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12061f';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeText(titleText, 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(titleText, 0, 0);
  ctx.restore();
  }
  // Subtitle in Pacifico, tucked under the title.
  if (subtitle) {
    ctx.save();
    ctx.font = `${Math.round(size * 0.34)}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9a8';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.translate(tx + size * 0.1, ty + size * 0.42);
    ctx.rotate(-0.02);
    ctx.fillText(subtitle, 0, 0);
    ctx.restore();
  }
  // Badge ribbon, top-right, hot pink with Bebas lettering.
  if (badge) {
    ctx.save();
    const bs = Math.round(unit * 0.038);
    ctx.font = `${bs}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    const bw = ctx.measureText(badge.toUpperCase()).width + bs * 1.6;
    const bh = bs * 1.7;
    ctx.translate(W - bw - W * 0.03, H * 0.035);
    ctx.rotate(0.05);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bw, 0);
    ctx.lineTo(bw - bh * 0.35, bh);
    ctx.lineTo(0, bh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.toUpperCase(), bw / 2, bh / 2 + 1);
    ctx.restore();
  }
}

/** Title block for the nine-grid centre cell: dark tile, title stacked, small badge line. */
export function drawTitleBlock(ctx, panel, title, subtitle, badge) {
  ctx.save();
  const grad = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
  grad.addColorStop(0, '#160a2e');
  grad.addColorStop(1, '#3d1155');
  ctx.fillStyle = grad;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(2, panel.w * 0.012);
  ctx.strokeRect(panel.x + 4, panel.y + 4, panel.w - 8, panel.h - 8);
  const words = (title || 'NEON SHORE').toUpperCase().split(/\s+/);
  let size = Math.round(panel.w * 0.17);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fit = (px) => {
    ctx.font = `${px}px Anton, 'Arial Black', sans-serif`;
    return Math.max(...words.map((w) => ctx.measureText(w).width));
  };
  while (size > 12 && fit(size) > panel.w * 0.82) size -= 2;
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  ctx.fillStyle = '#ffe9a8';
  const lh = size * 1.15;
  const startY = panel.y + panel.h / 2 - ((words.length - 1) * lh) / 2 - size * 0.25;
  words.forEach((w, i) => ctx.fillText(w, panel.x + panel.w / 2, startY + i * lh));
  if (subtitle) {
    ctx.font = `${Math.round(size * 0.42)}px Pacifico, cursive`;
    ctx.fillStyle = '#ff8ac2';
    ctx.fillText(subtitle, panel.x + panel.w / 2, panel.y + panel.h - size * 0.7);
  }
  ctx.restore();
}

/** Film grain: seeded speckles across the whole cover. */
export function drawGrain(ctx, W, H, seed) {
  const rnd = mulberry32(seed * 7 + 13);
  const n = Math.round((W * H) / 1400);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const r = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Halftone dots along the bottom edge, growing toward the corner. */
export function drawHalftone(ctx, W, H) {
  ctx.save();
  const step = Math.max(10, Math.round(W * 0.014));
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let x = step / 2; x < W * 0.42; x += step) {
      const y = H - step / 2 - r * step;
      const rad = (step * 0.32 * (r + 1)) / rows;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A soft dark vignette around the edges. */
export function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Resolve which photo each panel shows (one-photo mode repeats the first photo). */
export function resolveSlots(state) {
  const panels = layoutPanels(state.layout, state.size.w, state.size.h);
  const photoPanels = panels.filter((p) => p.kind !== 'title');
  const slots = [];
  for (let i = 0; i < photoPanels.length; i++) {
    const base = state.slots[i] || defaultSlot();
    const slot = { ...base };
    if (state.onePhoto) slot.photo = state.photos.length > 0 ? 0 : -1;
    else if (slot.photo >= state.photos.length) slot.photo = -1;
    slots.push(slot);
  }
  return { panels, slots };
}

/** Draw the whole cover onto a canvas sized to state.size. Returns the canvas. */
export function drawCover(canvas, state) {
  const size = sizeById(state.size);
  const W = size.w;
  const H = size.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  const { panels, slots } = resolveSlots({ ...state, size });
  ctx.fillStyle = '#0b0620';
  ctx.fillRect(0, 0, W, H);
  if (state.layout === 'tilted') drawSky(ctx, W, H, grade);
  let photoIdx = 0;
  for (const panel of panels) {
    if (panel.kind === 'title') {
      drawTitleBlock(ctx, panel, state.title, state.subtitle, state.badge);
      continue;
    }
    const slot = slots[photoIdx++];
    const img = slot.photo >= 0 ? state.photos[slot.photo] : null;
    if (panel.kind === 'polaroid') {
      // White polaroid frame, rotated; photo inside, foot at the bottom.
      ctx.save();
      const cx = panel.x + panel.w / 2;
      const cy = panel.y + panel.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(panel.rot || 0);
      ctx.fillStyle = '#fdfdf8';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(W * 0.006);
      ctx.fillRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
      ctx.restore();
      const inner = { x: panel.x + panel.w * 0.04, y: panel.y + panel.h * 0.04, w: panel.w * 0.92, h: panel.h - panel.foot - panel.h * 0.04, rot: panel.rot };
      ctx.save();
      ctx.translate(inner.x + inner.w / 2, inner.y + inner.h / 2);
      ctx.rotate(panel.rot || 0);
      ctx.beginPath();
      ctx.rect(-inner.w / 2, -inner.h / 2, inner.w, inner.h);
      ctx.clip();
      ctx.translate(-inner.w / 2, -inner.h / 2);
      if (img) drawPhotoIn(ctx, img, { x: 0, y: 0, w: inner.w, h: inner.h }, slot, grade);
      else drawEmptyPanel(ctx, { x: 0, y: 0, w: inner.w, h: inner.h }, state.seed + photoIdx);
      ctx.restore();
      continue;
    }
    clipPanel(ctx, panel);
    if (img) drawPhotoIn(ctx, img, panel, slot, grade);
    else drawEmptyPanel(ctx, panel, state.seed + photoIdx);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    if (panel.poly) {
      ctx.beginPath();
      ctx.moveTo(panel.poly[0][0], panel.poly[0][1]);
      for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i][0], panel.poly[i][1]);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    }
    ctx.restore();
  }
  // Grade tint wash over the photos, then lettering, then finish.
  ctx.save();
  ctx.globalAlpha = grade.tintAlpha;
  ctx.fillStyle = grade.tint;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (state.layout === 'nine-grid') {
    // Title lives in the centre cell; still add the badge ribbon.
    if (state.badge) drawLettering(ctx, W, H, null, '', state.badge, state.seed);
  } else {
    drawLettering(ctx, W, H, state.title, state.subtitle, state.badge, state.seed);
  }
  drawHalftone(ctx, W, H);
  drawGrain(ctx, W, H, state.seed);
  drawVignette(ctx, W, H);
  return canvas;
}

/** Render the cover at its export size on a fresh canvas. */
export function exportCover(state) {
  const canvas = document.createElement('canvas');
  return drawCover(canvas, state);
}

/** A fresh default state for a new session. */
export function defaultState() {
  return {
    layout: 'hero-three',
    grade: 'neon-nights',
    size: '1080x1350',
    title: 'NEON SHORE',
    subtitle: 'a vice city story',
    badge: 'OUT NOW',
    photos: [],
    slots: [defaultSlot(), defaultSlot(), defaultSlot(), defaultSlot()],
    fitWhole: false,
    onePhoto: false,
    seed: 7,
  };
}
