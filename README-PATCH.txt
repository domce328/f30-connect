F30 Connect v1.4.4 — Photo Centering and Seamless Hero

Fixed:
- online and ignition-on car photographs are centered on the same grille axis as the offline car
- fades image edges in the assets themselves, so the hard image rectangle disappears
- removes old inline !important sizing rules that blocked the previous CSS changes
- preserves vehicle status pill position and all six customizable telemetry cards

Upload the CONTENTS of the patch ZIP to the GitHub repo ROOT (not the ZIP itself):
- index.html       REPLACE
- app.js           REPLACE
- sw.js            REPLACE
- f30-ui-v144.css  NEW
- f30-offline-aligned-v144.webp  NEW
- f30-online-aligned-v144.webp   NEW
- f30-ignition-aligned-v144.webp NEW

Do NOT upload README-PATCH.txt unless desired. You may leave old assets and CSS files in GitHub;
the new index and app use versioned filenames.

Note: The current 3 visual states depict device online + ignition telemetry, not independently measured headlight states.
