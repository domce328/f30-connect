F30 Connect v1.4.6 — Full Hero Background

This patch changes the hero section to use the full matching scene image instead of a separate cutout plus synthetic background.
The result is that the surrounding background around the car matches the photo and fills the whole iPhone screen width.

Replace these files in the repo root:
- index.html
- app.js
- sw.js
- f30-ui-v146.css
- f30-scene-sleeping-v146.webp
- f30-scene-online-v146.webp
- f30-scene-ignition-v146.webp

Then commit, wait for GitHub Pages, hard refresh desktop, and reopen Safari / the PWA on iPhone.
