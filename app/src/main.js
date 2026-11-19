// Neon Shore Cover Studio — editor wiring (DOM, state, history, export).
// The cover itself is drawn by cover.js; this file owns the controls,
// the photo tray, pointer crop/position, undo/redo and PNG export.

import {
  LAYOUTS, GRADES, SIZES, drawCover, exportCover, defaultState,
  layoutPanels, slotCount, defaultSlot, gradeById, sizeById,
} from './cover.js';
import { initShotMode } from './shots.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const statusEl = $('status');
const state = defaultState();
let selected = 0;
let history = [];
let future = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, badge: state.badge,
    slots: state.slots, fitWhole: state.fitWhole, onePhoto: state.onePhoto,
    seed: state.seed, selected,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  // Photos are Image objects and never serialized; keep the loaded ones.
  Object.assign(state, s);
  selected = s.selected || 0;
  syncControls();
}

/** Push the current state onto the undo stack (call before a change). */
function commit() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateHistoryButtons();
}

function undo() {
  if (history.length === 0) return;
  future.push(snapshot());
  restore(history.pop());
  render();
  updateHistoryButtons();
}

function redo() {
  if (future.length === 0) return;
  history.push(snapshot());
  restore(future.pop());
  render();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('undoBtn').disabled = history.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

/** Keep the slot list the right length for the current layout. */
function ensureSlots() {
  const n = slotCount(state.layout);
  while (state.slots.length < n) state.slots.push(defaultSlot());
  state.slots.length = n;
  if (selected >= n) selected = 0;
}

/** Photo panels (not the nine-grid title cell), in draw order. */
function photoPanels() {
  const size = sizeById(state.size);
  return layoutPanels(state.layout, size.w, size.h).filter((p) => p.kind !== 'title');
}

function render() {
  ensureSlots();
  drawCover(stage, state);
  syncSlotLabel();
}

function syncSlotLabel() {
  const panels = photoPanels();
  const slot = state.slots[selected] || defaultSlot();
  const photoName = slot.photo >= 0 && state.photos[slot.photo]
    ? state.photos[slot.photo].dataset.name || `Photo ${slot.photo + 1}`
    : 'empty';
  $('slotLabel').textContent = `Panel ${selected + 1} of ${panels.length} — ${photoName}`;
}

function syncControls() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('fitWhole').checked = state.fitWhole;
  $('onePhoto').checked = state.onePhoto;
  for (const btn of document.querySelectorAll('#layoutPicker button')) {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  }
  for (const btn of document.querySelectorAll('#gradePicker button')) {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
  }
  for (const btn of document.querySelectorAll('#sizePicker button')) {
    btn.classList.toggle('active', btn.dataset.size === state.size);
  }
  renderTray();
}

/** Load an image from a File, a sample path, or a data URL; returns the Image. */
function loadImage(source, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.dataset.name = name;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${name}`));
    if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = () => reject(new Error(`could not read ${name}`));
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

async function addPhotos(files) {
  let added = 0;
  for (const file of files) {
    if (state.photos.length >= 4) break;
    try {
      const img = await loadImage(file, file.name || `Photo ${state.photos.length + 1}`);
      state.photos.push(img);
      added++;
    } catch (err) {
      setStatus(err.message);
    }
  }
  if (added > 0) {
    commit();
    // Fill empty slots with the new photos in order.
    let next = 0;
    for (const slot of state.slots) {
      if (slot.photo < 0 && next < state.photos.length) slot.photo = next++;
    }
    syncControls();
    render();
    setStatus(`${added} photo${added > 1 ? 's' : ''} loaded. Click a panel, drag to position it.`);
  }
}

async function loadSample(path, name) {
  if (state.photos.length >= 4) {
    setStatus('The tray already holds 4 photos.');
    return;
  }
  try {
    const img = await loadImage(path, name);
    state.photos.push(img);
    commit();
    for (const slot of state.slots) {
      if (slot.photo < 0) { slot.photo = state.photos.length - 1; break; }
    }
    syncControls();
    render();
    setStatus(`${name} loaded as a sample photo.`);
  } catch (err) {
    setStatus(err.message);
  }
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  state.photos.forEach((img, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.title = img.dataset.name || `Photo ${i + 1}`;
    const pic = document.createElement('img');
    pic.src = img.src;
    pic.alt = thumb.title;
    thumb.appendChild(pic);
    thumb.addEventListener('click', () => {
      commit();
      const slot = state.slots[selected];
      if (slot) slot.photo = i;
      render();
      setStatus(`Panel ${selected + 1} now shows ${thumb.title}.`);
    });
    tray.appendChild(thumb);
  });
  for (let i = state.photos.length; i < 4; i++) {
    const empty = document.createElement('span');
    empty.className = 'thumb empty';
    empty.textContent = '—';
    tray.appendChild(empty);
  }
}

function buildPickers() {
  const layoutPicker = $('layoutPicker');
  for (const layout of LAYOUTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.layout = layout.id;
    btn.textContent = layout.name;
    btn.addEventListener('click', () => {
      commit();
      state.layout = layout.id;
      selected = 0;
      syncControls();
      render();
    });
    layoutPicker.appendChild(btn);
  }
  const gradePicker = $('gradePicker');
  for (const grade of GRADES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.grade = grade.id;
    btn.textContent = grade.name;
    btn.style.setProperty('--swatch', grade.tint);
    btn.addEventListener('click', () => {
      commit();
      state.grade = grade.id;
      syncControls();
      render();
    });
    gradePicker.appendChild(btn);
  }
  const sizePicker = $('sizePicker');
  for (const size of SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.size = size.id;
    btn.textContent = size.name;
    btn.addEventListener('click', () => {
      commit();
      state.size = size.id;
      syncControls();
      render();
    });
    sizePicker.appendChild(btn);
  }
}

/** Map a pointer event on the displayed canvas to cover pixels. */
function eventToCover(event) {
  const rect = stage.getBoundingClientRect();
  const size = sizeById(state.size);
  return {
    x: ((event.clientX - rect.left) / rect.width) * size.w,
    y: ((event.clientY - rect.top) / rect.height) * size.h,
  };
}

function hitPanel(point) {
  const panels = photoPanels();
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (p.poly) {
      if (pointInPoly(point, p.poly)) return i;
    } else if (point.x >= p.x && point.x <= p.x + p.w && point.y >= p.y && point.y <= p.y + p.h) {
      return i;
    }
  }
  return -1;
}

function pointInPoly(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > point.y) !== (yj > point.y) && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

let drag = null;

stage.addEventListener('pointerdown', (event) => {
  const point = eventToCover(event);
  const hit = hitPanel(point);
  if (hit < 0) return;
  selected = hit;
  const slot = state.slots[selected];
  drag = { startX: point.x, startY: point.y, slotX: slot.x, slotY: slot.y, moved: false };
  stage.setPointerCapture(event.pointerId);
  render();
});

stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = eventToCover(event);
  const size = sizeById(state.size);
  const rect = stage.getBoundingClientRect();
  const k = size.w / rect.width;
  const dx = (point.x - drag.startX);
  const dy = (point.y - drag.startY);
  if (Math.abs(dx) + Math.abs(dy) > 2 / k) drag.moved = true;
  const slot = state.slots[selected];
  slot.x = drag.slotX + dx;
  slot.y = drag.slotY + dy;
  render();
});

stage.addEventListener('pointerup', () => {
  if (drag && drag.moved) commit();
  drag = null;
});

stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  const slot = state.slots[selected];
  if (!slot) return;
  commit();
  slot.scale = Math.min(4, Math.max(0.5, slot.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  render();
}, { passive: false });

function rotateSelected(deg) {
  const slot = state.slots[selected];
  if (!slot) return;
  commit();
  slot.rot = (slot.rot + (deg * Math.PI) / 180) % (Math.PI * 2);
  render();
}

function flipSelected() {
  const slot = state.slots[selected];
  if (!slot) return;
  commit();
  slot.flip = !slot.flip;
  render();
}

function toggleFitSelected() {
  const slot = state.slots[selected];
  if (!slot) return;
  commit();
  slot.fit = !slot.fit;
  render();
  setStatus(slot.fit ? 'Fit whole photo on for this panel.' : 'Fill panel on for this panel.');
}

async function exportPng() {
  const size = sizeById(state.size);
  const canvas = exportCover(state);
  setStatus('Exporting…');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    setStatus('Export failed: the browser gave no PNG.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon-shore-cover-${size.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Saved ${size.name} PNG (${(blob.size / 1048576).toFixed(1)} MB).`);
}

function surprise() {
  commit();
  const rnd = Math.random;
  state.layout = LAYOUTS[Math.floor(rnd() * LAYOUTS.length)].id;
  state.grade = GRADES[Math.floor(rnd() * GRADES.length)].id;
  state.seed = Math.floor(rnd() * 100000);
  for (const slot of state.slots) {
    if (state.photos.length > 0) slot.photo = Math.floor(rnd() * state.photos.length);
    slot.rot = (rnd() - 0.5) * 0.3;
  }
  selected = 0;
  syncControls();
  render();
  setStatus('Surprise! A new layout, grade and crop — undo brings it back.');
}

function wireControls() {
  $('photoFiles').addEventListener('change', (event) => {
    addPhotos([...event.target.files]);
    event.target.value = '';
  });
  $('samplePier').addEventListener('click', () => loadSample('samples/pier.jpg', 'Pier (sample)'));
  $('sampleBoulevard').addEventListener('click', () => loadSample('samples/boulevard.jpg', 'Boulevard (sample)'));
  $('titleInput').addEventListener('input', (event) => { state.title = event.target.value; render(); });
  $('titleInput').addEventListener('change', () => commit());
  $('subtitleInput').addEventListener('input', (event) => { state.subtitle = event.target.value; render(); });
  $('subtitleInput').addEventListener('change', () => commit());
  $('badgeInput').addEventListener('input', (event) => { state.badge = event.target.value; render(); });
  $('badgeInput').addEventListener('change', () => commit());
  $('fitWhole').addEventListener('change', (event) => {
    commit();
    state.fitWhole = event.target.checked;
    for (const slot of state.slots) slot.fit = state.fitWhole;
    render();
  });
  $('onePhoto').addEventListener('change', (event) => {
    commit();
    state.onePhoto = event.target.checked;
    render();
  });
  $('rotLeft').addEventListener('click', () => rotateSelected(-15));
  $('rotRight').addEventListener('click', () => rotateSelected(15));
  $('flipBtn').addEventListener('click', flipSelected);
  $('fitBtn').addEventListener('click', toggleFitSelected);
  $('surpriseBtn').addEventListener('click', surprise);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', exportPng);
}

async function boot() {
  buildPickers();
  wireControls();
  syncControls();
  updateHistoryButtons();
  try {
    await document.fonts.ready;
  } catch {
    // Fonts are local files; a failure still leaves the fallback stack.
  }
  render();
  setStatus('Add up to 4 photos, pick a layout and grade, then export.');
  await initShotMode(state, { render, setStatus, loadSample });
}

boot();
