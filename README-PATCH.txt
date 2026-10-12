F30 Connect v1.4.7 — Full-Screen Studio Background

Fix: the car is part of a continuous full-screen studio background, instead of
a rectangular image in the hero. This restores the normal iPhone car proportions
and removes the visual photo edges.

Files to upload directly to GitHub repository ROOT:
index.html — REPLACE
app.js — REPLACE
sw.js — REPLACE
f30-ui-v147.css — NEW
f30-stage-offline-v147.webp — NEW
f30-stage-online-v147.webp — NEW
f30-stage-ignition-v147.webp — NEW

Keep your existing JS modules, manifest, and icons; do not delete old files.
Do not upload a copy of the ZIP itself. Wait for GitHub Pages and refresh Safari.

UI logic still uses Flespi connection and ignition telemetry. Lighting is an
illustration, not an independently measured vehicle headlamp state.
No telemetry, trips, diagnostic, command or metric settings logic was modified.
