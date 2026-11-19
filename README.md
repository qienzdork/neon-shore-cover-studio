# Neon Shore Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/qienzdork/neon-shore-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/qienzdork/neon-shore-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns your photos into poster-style cover art for the
fictional open-world game "Neon Shore". It is a cover-creation studio, not a
game: you load up to 4 photos, arrange them in a layout, add a title and
badge, grade the colours, and export a PNG for a feed post, a portrait
poster, a wide banner, or a story.

Everything runs locally in the browser. Photos are read on your machine and
never uploaded; the app makes no network requests at all.

## Try it

```sh
node serve.ts        # or: node serve.ts --port 8080
# open http://localhost:8080
```

## What it does

- **6 layouts** — Hero + Three, Four Panel Grid, Nine Panel Grid (centre title
  block), Full Bleed, Tilted Snapshots (polaroids over a code-drawn sunset sky
  with sun and palm silhouettes), Diagonal Split.
- **6 colour grades** — Vice Sunset, Neon Nights, Golden Hour, Teal Dawn,
  Hot Pink, Mono Noir (a canvas filter plus a tint wash).
- **Your photos** — up to 4 from disk; per-panel photo assignment, click a
  panel to drag-pan, scroll to zoom, rotate, flip, a "fit whole photo" mode
  (blurred-backdrop contain), and a one-photo-in-every-panel toggle.
- **Lettering** — Anton gradient title with ink outline, Pacifico subtitle,
  Bebas Neue badge ribbon; the fonts are vendored under `app/fonts/` under
  the OFL, so the app needs no network.
- **Finish** — film grain, halftone dots, vignette, undo/redo, and a
  Surprise-me shuffle.
- **Export** — PNG at 1080×1080, 1080×1350, 1920×1080, 1080×1920.

## Layout

- `app/` — the static app: `index.html`, `style.css`, `src/cover.js`
  (layout, grades, lettering, finish, export), `src/main.js` (editor wiring),
  `src/shots.js` (`?shot=` scenes for screenshots), `fonts/` (OFL fonts),
  `samples/` (two sample photos drawn on canvas).
- `screenshots/` — four rendered views of the app.
- `main.ts` — the entry program (Node 22, standard library only): copies
  `app/` and `screenshots/` into the output dir and writes `dossier.json`
  with the kit's vendored library.
- `serve.ts` — a tiny local static server for trying the app.
- `vendor/makefun-app.ts` — the kit's vendored library, unchanged.
- `LICENSE` — MIT.

## Originality

All art, lettering, layouts and code are original work made for this entry.
The city name "Neon Shore" is fictional. No Rockstar logo, artwork or fonts
are used, and no assets are fetched from the network.

## Screenshots

The four views in `screenshots/` are rendered with a headless browser
(Playwright's bundled Chromium) against the live app:

- `cover-wide.png` — a 1920×1080 cover, Full Bleed, Vice Sunset.
- `editor.png` — the editor with a photo loaded and the Hero + Three layout.
- `cover-portrait.png` — a 1080×1350 cover, Tilted Snapshots, Neon Nights.
- `cover-story.png` — a 1080×1920 cover, Nine Panel Grid, Golden Hour.

Capture them again with `?shot=cover` or `?shot=editor` on the page URL,
for example `http://localhost:8080/?shot=cover&layout=full-bleed&grade=vice-sunset&size=1920x1080&photo=pier&caption=Sunset%20Heist`.
