# Background image

Single nebula photo for the dashboard: **`nebula1.webp`** (served from `/backgrounds/nebula1.webp`).

Blur is applied in CSS on **one fixed layer** behind the UI (`filter: blur(8px)` on `.app-background__image` in `src/index.css`), not via `backdrop-filter` on cards — that keeps scroll performance acceptable.

## Replacing the image

Overwrite `nebula1.webp`. Target **1920px wide**, **~150–200 KB** WebP for fast loads.

Disable the background entirely: `VITE_ENABLE_DYNAMIC_BG=false` in `.env.local`.
