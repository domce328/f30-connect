F30 Connect v1.3 - Six customizable dashboard quick metrics

Upload/replace these four files in the ROOT of your existing GitHub repo:
  app.js, index.html, styles.css, sw.js

Keep all other files unchanged, especially flespi-direct.js (your working command-history version) and personalize.js.

After the GitHub Pages deployment, hard refresh the page. On iPhone, reopen F30 Connect in Safari if the installed Home Screen app caches an older version.
Go to Settings > Dashboard quick metrics. Six cards: each has a drop-down with the current raw Flespi telemetry keys and a freely editable display label. Press Save dashboard cards, return Home.

The existing Home quick-metric card design is retained. Always 2 columns x 3 rows on iPhone. No tracker configuration is written by these settings.
Settings are saved in this browser's localStorage, so repeat once on every phone/computer. If the device has no live telemetry, saved keys still appear, but currently unavailable keys show No recent reading.

This patch does NOT yet change the BMW car image/lighting-states. That remains the next independent design step.
