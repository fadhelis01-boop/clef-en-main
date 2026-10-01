/* Service worker : l'appli fonctionne hors connexion.
   - Fichiers de l'appli : servis depuis le cache ; une nouvelle version attend l'accord de l'utilisateur.
   - regles.json : toujours demandé au réseau d'abord (dernières règles), copie de secours en cache. */
const CACHE = 'clef-en-main-2.0.0-c10baf70';
const FILES = ['./','./index.html','./app.css','./regles.js','./regles.json','./js/core.js','./js/store.js','./js/metier.js','./js/docs.js','./js/envoi.js','./js/edl.js','./js/ui.js','./js/assistant.js','./js/app.js',
  './js/vendor/html2pdf.bundle.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(u=>new Request(u, {cache:'reload'}))))); });
self.addEventListener('message', e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url); if(url.origin!==location.origin) return;
  if(url.pathname.endsWith('regles.json')){
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(CACHE).then(c=>c.put('./regles.json', cp)); return r; }).catch(()=>caches.match('./regles.json')));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch:true}).then(hit=>hit || fetch(req)));
});
