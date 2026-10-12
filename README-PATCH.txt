F30 Connect v1.4.2 — iPhone car photo stacking and header layout fix

The v1.4 iPhone screenshot shows all three car photos stacked because
Safari appears to have cached the old CSS after the page HTML changed.

Fixes:
1) The DOM now has ONE <img> only, and app.js changes its src as state changes.
   Stacking is impossible, even if a stylesheet is outdated.
2) Separate fresh CSS file f30-ui-v142.css forces Safari to fetch the current layout.
3) Critical mobile hero and header CSS lives in the page itself as fallback.
4) JS filename URL is versioned; service worker has a new cache version.
5) Keeps the six metric cards and their saved settings, commands, trips, and
   Flespi token storage unchanged.

Upload these FOUR required files into GitHub repository root:
  index.html (replace)
  app.js (replace)
  f30-ui-v142.css (NEW FILE; important)
  sw.js (replace)

README-PATCH.txt is only instructions; do not upload it.

IMPORTANT: Upload the actual new f30-ui-v142.css file. The older styles.css
can remain in the repository; it is no longer used by v1.4.2.
Leave the three existing car-*.webp files as they are.

Wait for successful Pages deployment, then open the usual site in Safari.
If already installed on Home Screen, close and reopen after loading Safari.
Do NOT reset saved credentials or your six custom metrics.
