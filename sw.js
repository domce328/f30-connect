// Intentionally cache only the static application shell — NEVER cache telemetry, locations or API replies.
const CACHE='f30-connect-v161-custom-commands-shell';
const FILES=['./','./index.html','./f30-ui-v151.css','./app.js?v=1.6.1','./parameter-history.js','./parameter-history.css','./command-policy.js','./flespi-direct.js','./personalize.js','./manifest.webmanifest','./icons/icon-192.png','./f30-stage-offline-v147.webp','./f30-stage-online-v147.webp','./f30-stage-ignition-v147.webp'];
self.addEventListener('install', e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(p=>new URL(p,self.registration.scope)))).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate', e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/cdn-cgi/'))return;
  // Network first, static fallback: app may open offline, live data NEVER appears as live while offline.
  if(FILES.some(file=>new URL(file,self.registration.scope).pathname===url.pathname))e.respondWith(fetch(e.request).then(response=>{
    if(response.ok && response.type==='basic') {const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
    return response;
  }).catch(()=>caches.match(e.request)));
});
