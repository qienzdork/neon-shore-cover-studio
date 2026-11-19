// Shot scenes for screenshots: ?shot=cover renders just the cover,
// ?shot=editor shows the full editor with a photo loaded. The page
// signals readiness through window.__shotReady once fonts, the sample
// photo and the first render are all done.

import { sizeById } from './cover.js';

function param(name, fallback) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value === null || value === '' ? fallback : value;
}

async function waitForImages(state) {
  const pending = state.photos.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  })));
  await Promise.all(pending);
}

/** Apply a ?shot= scene; resolves true when a scene ran, false otherwise. */
export async function initShotMode(state, api) {
  const shot = param('shot', '');
  if (shot !== 'cover' && shot !== 'editor') return false;
  const photo = param('photo', 'pier');
  const caption = param('caption', 'Sunset Heist');
  const layout = param('layout', state.layout);
  const grade = param('grade', state.grade);
  const size = param('size', shot === 'cover' ? '1920x1080' : state.size);
  // URLSearchParams already decoded the query value; do not decode twice.
  state.title = caption;
  state.layout = layout;
  state.grade = grade;
  state.size = size;
  if (photo) {
    await api.loadSample(`samples/${photo}.jpg`, `${photo} (sample)`);
  }
  try {
    await document.fonts.ready;
  } catch {
    // Fallbacks still render.
  }
  await waitForImages(state);
  api.render();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const sizeDef = sizeById(state.size);
    const stage = document.getElementById('stage');
    // Fit the whole cover inside the viewport (backing store stays full-res).
    const scale = Math.min(window.innerWidth / sizeDef.w, window.innerHeight / sizeDef.h);
    stage.style.width = `${Math.round(sizeDef.w * scale)}px`;
    stage.style.height = `${Math.round(sizeDef.h * scale)}px`;
    stage.style.maxWidth = 'none';
    stage.style.maxHeight = 'none';
  }
  api.render();
  window.__shotReady = true;
  return true;
}
