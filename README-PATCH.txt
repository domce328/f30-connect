F30 Connect v1.3.1 — Front-End Lighting States

This patch adds the BMW-style front-end hero and three visual states:
- Sleeping / offline: no angel eyes
- Online: angel eyes on
- Ignition ON: angel eyes + short beams

Replace these files in the repository root:
- app.js
- index.html
- styles.css
- sw.js

Then commit and wait for GitHub Pages to deploy.
On desktop, refresh with Ctrl+Shift+R. On iPhone, open a fresh Safari tab or reload after the service worker updates.
