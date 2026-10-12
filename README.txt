F30 Connect v1.2.2 - Telemetry API fix

Replace flespi-direct.js and sw.js in the GitHub repository root. Commit changes, wait for GitHub Pages deployment and refresh the app.

Fixes obsolete /gw/devices/{id}/telemetry endpoint by using the Flespi-supported /gw/devices/{id}/telemetry/all.
The service-worker static shell cache was also versioned so browsers can update.

Do not upload API tokens or passphrases to GitHub.
