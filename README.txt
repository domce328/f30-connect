F30 Connect v1.2.3 — Command History reliability patch

Apply to https://github.com/domce328/f30-connect (main, repository root).
Replace all 3 files: flespi-direct.js, app.js and sw.js. Do not upload the ZIP.
Wait for GitHub Pages deployment, then reload F30 Connect in a new tab.

Changes:
- Fetches pending queue and completed command results independently. A HTTP 404
  from GET /commands-queue no longer hides an executed command response.
- Displays endpoint-specific warning(s) instead of replacing all command history.
- Displays up to 3000 characters of the command response with line breaks.
- Remembers locally only the most recent 30 command IDs/kinds to identify results
  even if Flespi does not include command meta. Does not save command text.
- Bumps service-worker cache key to v1.2.3.

Unchanged:
- Token/passphrase, device ID, telemetry, historic trips, events, remote actions.
- No live testing with your token; completed-result GET and device responses
  still require a check in your own browser.

Sources: https://flespi.com/kb/send-device-commands-api
