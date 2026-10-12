F30 Connect v1.4.3 — Hero Blend Update

This patch keeps the current UI and fixes the choppy cut-out look by blending the hero background with the BMW image.

Changes:
- matched dark-blue hero background behind the car
- soft bottom fade and vignette on the car image
- smoother visual transition between the car scene and the dashboard cards
- no telemetry, trips, token, or settings logic changes

Replace these files in the repository root:
- index.html
- sw.js
- f30-ui-v143.css  (new file)

Then commit and wait for GitHub Pages to deploy.
Hard refresh desktop with Ctrl+Shift+R. On iPhone, reload Safari or reopen the PWA after the service worker updates.
