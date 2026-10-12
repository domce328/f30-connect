F30 CONNECT v1.4 — ACTUAL APP UI UPDATE

This is a functional website update, not another mockup.

What's updated:
- Centered F30 Connect title, Settings gear top left, Flespi connection (+) top right.
- My F30 under title.
- Black BMW front-end rendered from 3 prepared car-only images (not a screenshot of the UI).
- Offline/Disconnected: lights completely off.
- Connected + Ignition OFF: angel eyes on.
- Connected + Ignition ON: angel eyes + low beams on.
- Live status pill centered BELOW the car, followed by real last-connection time.
- Location + Maps link beneath the status pill.
- Existing six customizable raw telemetry cards preserved, along with Trips, Events, Diagnostics, GPRS commands and Settings.
- PWA cache version updated.

UPLOAD:
1. Unzip the PATCH. Upload all seven files directly into the repository ROOT using GitHub Add file > Upload files.
2. Replace app.js, index.html, styles.css and sw.js. The three .webp files are NEW files.
3. Commit and wait for Pages deployment to succeed.
4. Windows: Ctrl+Shift+R. iPhone: reload the website in Safari (if installed to Home Screen, close and reopen after the new version updates).

IMPORTANT:
- Lighting shown by the app is a VISUALIZATION driven by device TCP connection and decoded ignition telemetry. It is not a reading of the real vehicle headlamp switch, and does not remotely turn headlights on/off.
- Device disconnected takes priority over a previously stored ignition=ON value, to avoid a misleading lit vehicle while offline.
- Offline does NOT prove the tracker is sleeping; both conditions use the same unlit graphic.
- Neither your token nor any vehicle logs are included.
- If older photo personalization is enabled with custom hero photos, change your photo placement to Wallpaper or None for clean presentation.
