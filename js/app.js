/* =====================================================================================
   DÉMARRAGE — chargement des données, règles, cycle de vie des baux, mise à jour de
   l'appli (service worker : bandeau « Nouvelle version », jamais de rechargement forcé).
   ===================================================================================== */
async function boot(){
  await storeInit();
  await regLoadCached();
  try{ const u=JSON.parse(sessionStorage.getItem('cem-ui')||'null'); if(u && u.view) UI=u; }catch(e){}
  cycleDeVie();
  render();
  // veille réglementaire : relue au plus une fois par jour, appliquée sans action de l'utilisateur
  regCheckOnline(false).then(r=>{ if(r && r.nouveau){ toast('Nouvelles règles reçues ('+fdateCourt(r.version)+') : appliquées à vos baux.', 4500); refresh(); } });
  // si l'appli reste ouverte plusieurs jours (tablette), on rejoue le cycle de vie chaque jour
  let lastDay=todayISO();
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && todayISO()!==lastDay){ lastDay=todayISO(); cycleDeVie(); regCheckOnline(false); refresh(); } });
}
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); window._installPrompt=e; });

if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      const offer=(w)=>{ const b=document.createElement('div'); b.className='updbar'; b.innerHTML='Une nouvelle version de Clef en Main est prête. <button>Mettre à jour</button>';
        b.querySelector('button').onclick=()=>{ w.postMessage('SKIP_WAITING'); }; document.body.appendChild(b); };
      if(reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', ()=>{ const w=reg.installing; w && w.addEventListener('statechange', ()=>{ if(w.state==='installed' && navigator.serviceWorker.controller) offer(w); }); });
      setInterval(()=>reg.update().catch(()=>{}), 6*3600*1000);
    }).catch(()=>{});
    let reloading=false; const hadController=!!navigator.serviceWorker.controller; // première installation : pas de rechargement
    navigator.serviceWorker.addEventListener('controllerchange', async()=>{ if(reloading || !hadController) return; reloading=true; await saveNow(); location.reload(); });
  });
}
boot();
