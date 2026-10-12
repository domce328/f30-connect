# F30 Connect — FREE GitHub Pages edition

**No Cloudflare, no paid hosting, no npm or Node.js required.** Uses Flespi's browser REST API directly. Built for FMC130 + CAN-CONTROL in BMW F30.

## Setup from Windows using only a browser

1. In Flespi, create a **new restricted Standard token** (never use your Master token). Allow only the target device (ID defaults to `9056049`, verify it in your Flespi account) and the smallest permissions for device info, telemetry, messages, commands and command results. Do not share the token in ChatGPT. Initially, use a read-only token to validate the dashboard; enable command permissions only if you decide to use the command console and remote controls.
2. Create a free GitHub account if needed. Create a **public** repo, e.g. `f30-connect`, and upload the **contents of this folder** to its root through GitHub's **Add file → Upload files** interface. **Do not include a token, GPS logs, photos, or credentials in the repository.** GitHub Free Pages generally requires the repository to be public.
3. In that repo: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**. Wait until GitHub displays the HTTPS site address, normally `https://YOURNAME.github.io/f30-connect/`.
4. In Flespi, update your restricted token's **Allowed origins** to your exact app origin (e.g. `https://YOURNAME.github.io`). Note: an origin has no pathname. If you also want to use this token with Flespi Panel, allow Flespi's own origins too. Restricting browser origins is an added safeguard; it is not equivalent to secure server-side token storage.
5. Open the HTTPS site. Tap the connection symbol at the top. Paste the restricted token, verify the device ID, and set a passphrase of at least ten characters. The token is checked against Flespi, then saved **encrypted in this browser** (AES-GCM, PBKDF2 with 310,000 iterations). You enter your passphrase on later fresh sessions. It isn't included in site files or uploaded to GitHub.
6. On iPhone Safari open the same HTTPS URL, tap **Share → Add to Home Screen**. To use on your iPhone, you must separately enter the Flespi token there, since photos and credentials are saved on each browser/device separately.

### Costs and privacy

- **GitHub Pages free static hosting**, subject to GitHub's limits and terms. The published *app code* is public, but your token and uploaded images are not part of the repository.
- **Flespi plan/usage** is whatever your existing account uses. This app does not change Flespi's billing.
- Token encryption protects against casual viewing of locally stored credentials but **cannot protect a token once the app decrypts it for use**. Browser extensions, injected JS, shared/untrusted computers, lost/unlocked phones, browser-origin compromise, and XSS can expose your token. This is **not as secure as a server-side backend**. Use the least-privileged, single-device token and revoke it immediately if exposed.
- Browsers can evict local site storage (including encrypted credentials and custom photos). Store originals elsewhere and be prepared to reconnect.
- There is no traditional account login. A local passphrase unlocks Flespi API credentials on that device.

## Features

- **Phone and desktop photos**: Settings → upload Portrait (phone) and Landscape (desktop). Both stay in IndexedDB on their respective devices. Optional blur, dimming and full-wallpaper/hero placement.
- Dashboard: ignition, external voltage, RPM, speed, GNSS, connection state and last-known coordinates.
- Historical trips with approximate distance, route sketch, events and CSV export. Calculations are approximate and depend on device reporting density.
- Crash event history from Flespi decoded messages; avoid treating every event as an actual collision.
- GPRS command console: getinfo/getstatus/getparam/readio; numeric setparam requires typing APPLY and device connectivity. Read-only commands queue with 10-minute TTL.
- Door lock/unlock buttons: require confirmation and send **only as Flespi real-time commands**, never by the delayed queue. They will fail when FMC130 disconnects after the 60-second open-link timeout. Successful command response does **not** establish physical lock state.

## Security / testing notes

- Because this edition sends commands from the browser, token permissions must be configured precisely in Flespi. Never give admin or unrestricted access to the browser token.
- Flespi browser access / allowed origins: https://flespi.com/kb/tokens-access-keys-to-flespi-platform
- Flespi real-time vs queued commands: https://flespi.com/kb/send-device-commands-api
- The direct REST functionality and UI have been checked locally without your secret. Real authorization, CORS, device command compatibility and iPhone behavior must be tested with your token and vehicle.
- No push notifications, no server-side logs, no cloud photo sync. A full cloud backend can be added later if desired.

## Known limitations

- Public hosting of static code is harmless only **as long as the token is never embedded in source**, but it does not provide a login gate around the app UI. The browser encryption passphrase gates the Flespi data per device.
- If your corporate laptop blocks GitHub or access to `flespi.io`, deploy from a permitted personal computer. Do not bypass IT restrictions or type the token into an untrusted work laptop.
- Location and telemetry are fetched only when the application is in use; static hosting has no background crash push mechanism.
