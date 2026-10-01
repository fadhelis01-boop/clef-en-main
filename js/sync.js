/* =====================================================================================
   SYNCHRONISATION AUTOMATIQUE ENTRE APPAREILS — via un dépôt GitHub PRIVÉ.
   - Les données sont chiffrées sur l'appareil (AES-GCM 256 bits) avant l'envoi : GitHub ne
     stocke que des fichiers illisibles (etat.enc, photos/<id>.enc).
   - Chaque modification est envoyée quelques secondes après ; les autres appareils la
     récupèrent à l'ouverture, au retour sur l'appli et toutes les 2 minutes.
   - Conflits : GitHub refuse une écriture faite sur une version périmée (sha) ; l'appli
     relit alors la version en ligne, fusionne fiche par fiche (la plus récente gagne, les
     suppressions sont respectées) et renvoie.
   - Un « code de liaison » (dépôt + clé d'accès + clé de chiffrement) relie un autre appareil.
   ===================================================================================== */
const GH_API = (()=>{ try{ return localStorage.getItem('cem-gh-api') || 'https://api.github.com'; }catch(e){ return 'https://api.github.com'; } })();
const SYNC_FILE = 'etat.enc';
let SYNC = { meta:null, key:null, busy:false, timer:null, again:false };

function deviceName(){ const u=navigator.userAgent; return /iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':/Macintosh/.test(u)?'Mac':/Windows/.test(u)?'PC Windows':'Appareil'; }
async function syncLoad(){
  SYNC.meta = await idbGet('kv','sync');
  if(SYNC.meta && SYNC.meta.key){ try{ SYNC.key = await crypto.subtle.importKey('raw', unb64(SYNC.meta.key), 'AES-GCM', false, ['encrypt','decrypt']); }catch(e){ SYNC.key=null; } }
}
async function syncSaveMeta(){ await idbPut('kv','sync', SYNC.meta); }
function syncActive(){ return !!(SYNC.meta && SYNC.meta.token && SYNC.key); }

/* ---- chiffrement ---- */
async function sEnc(obj){ const iv=crypto.getRandomValues(new Uint8Array(12)); const data=await crypto.subtle.encrypt({name:'AES-GCM', iv}, SYNC.key, new TextEncoder().encode(JSON.stringify(obj))); return JSON.stringify({app:'clef-en-main', v:1, iv:b64(iv), data:b64(data)}); }
async function sDec(txt){ const w=JSON.parse(txt); const p=await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(w.iv)}, SYNC.key, unb64(w.data)); return JSON.parse(new TextDecoder().decode(p)); }
function utf8b64(s){ return b64(new TextEncoder().encode(s)); }
function b64utf8(s){ return new TextDecoder().decode(unb64(s.replace(/\s/g,''))); }

/* ---- API GitHub ---- */
class SyncError extends Error{ constructor(code, msg){ super(msg); this.code=code; } }
async function gh(method, path, body, headers){
  let r;
  try{ r = await fetch(GH_API+path, {method, cache:'no-store', headers:Object.assign({'Authorization':'Bearer '+SYNC.meta.token, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'}, body?{'Content-Type':'application/json'}:{}, headers||{}), body: body?JSON.stringify(body):undefined}); }
  catch(e){ throw new SyncError('reseau', 'Pas de connexion Internet.'); }
  if(r.status===401) throw new SyncError('jeton', 'La clé d\'accès GitHub n\'est plus valable (expirée ou supprimée).');
  if(r.status===403 && r.headers.get('x-ratelimit-remaining')==='0') throw new SyncError('quota', 'Trop de requêtes vers GitHub : nouvel essai dans quelques minutes.');
  return r;
}
const repoPath = p => `/repos/${SYNC.meta.owner}/${SYNC.meta.repo}/contents/${p}`;
async function ghGetFile(p){
  const r=await gh('GET', repoPath(p));
  if(r.status===404) return null;
  if(!r.ok) throw new SyncError('github', 'GitHub a répondu '+r.status+'.');
  const j=await r.json();
  if(j.content && j.encoding==='base64') return {sha:j.sha, text:b64utf8(j.content)};
  // fichier de plus de 1 Mo : contenu brut
  const r2=await gh('GET', repoPath(p), null, {'Accept':'application/vnd.github.raw+json'});
  if(!r2.ok) throw new SyncError('github', 'Lecture impossible ('+r2.status+').');
  return {sha:j.sha, text:await r2.text()};
}
async function ghPutFile(p, text, sha, message){
  const r=await gh('PUT', repoPath(p), Object.assign({message, content:utf8b64(text)}, sha?{sha}:{}));
  if(r.status===409 || r.status===422) return {conflict:true, status:r.status};
  if(!r.ok) throw new SyncError('github', 'Écriture refusée par GitHub ('+r.status+').');
  const j=await r.json(); return {sha:j.content.sha};
}

/* ---- fusion fiche par fiche ---- */
function mergeState(inc){
  inc = migrateState(inc||{});
  let changed=false, localAhead=false;
  const tomb=Object.assign({}, STATE.suppr);
  for(const k in inc.suppr){ if(!tomb[k] || inc.suppr[k]>tomb[k]){ tomb[k]=inc.suppr[k]; changed=true; } }
  for(const k in STATE.suppr){ if(!inc.suppr[k] || STATE.suppr[k]>inc.suppr[k]) localAhead=true; }
  COLLS.forEach(coll=>{
    const map={}; STATE[coll].forEach(x=>map[x.id]=x);
    const incIds=new Set();
    inc[coll].forEach(x=>{ incIds.add(x.id); const cur=map[x.id];
      if(!cur){ map[x.id]=x; changed=true; }
      else if((x.updatedAt||'') > (cur.updatedAt||'')){ map[x.id]=x; changed=true; }
      else if((cur.updatedAt||'') > (x.updatedAt||'')) localAhead=true; });
    STATE[coll].forEach(x=>{ if(!incIds.has(x.id)) localAhead=true; });
    const before=Object.keys(map).length;
    STATE[coll]=Object.values(map).filter(x=>!(tomb[x.id] && tomb[x.id] > (x.updatedAt||'')));
    if(STATE[coll].length!==before) changed=true;
  });
  STATE.suppr=tomb;
  const s=STATE.settings, si=inc.settings||{};
  if(si.regVu && (!s.regVu || si.regVu>s.regVu)) s.regVu=si.regVu;
  return {changed, localAhead};
}

/* ---- cycle de synchronisation ---- */
async function syncPull(){
  const f=await ghGetFile(SYNC_FILE);
  if(!f){ SYNC.meta.sha=null; SYNC.meta.dirty=true; return false; }
  if(f.sha===SYNC.meta.sha) return false;
  let p; try{ p=await sDec(f.text); }catch(e){ throw new SyncError('cle', 'Les données en ligne ne peuvent pas être déchiffrées avec la clé de cet appareil. Reliez-le avec le code de liaison du premier appareil.'); }
  window._syncApplying=true;
  try{ const r=mergeState(p.state); SYNC.meta.sha=f.sha; if(r.localAhead) SYNC.meta.dirty=true; cycleDeVie(); await saveNow(); return r.changed; }
  finally{ window._syncApplying=false; }
}
async function syncPush(){
  for(let i=0;i<4;i++){
    if(!SYNC.meta.dirty) return;
    const text=await sEnc({app:'clef-en-main', v:3, at:new Date().toISOString(), device:SYNC.meta.device, appVersion:APP_VERSION, state:STATE});
    const r=await ghPutFile(SYNC_FILE, text, SYNC.meta.sha, 'Synchronisation — '+SYNC.meta.device+' — '+new Date().toLocaleString('fr-FR'));
    if(!r.conflict){ SYNC.meta.sha=r.sha; SYNC.meta.dirty=false; return; }
    await syncPull();   // version en ligne plus récente : on fusionne puis on renvoie
    SYNC.meta.dirty=true;
  }
  throw new SyncError('conflit', 'Conflit d\'écriture persistant : nouvel essai bientôt.');
}
async function syncPhotos(){
  const used=photoIdsOf(STATE); SYNC.meta.photosUp=SYNC.meta.photosUp||{};
  let n=0;
  for(const id of used){
    if(SYNC.meta.photosUp[id]) continue;
    const local=await idbGet('photos', id);
    if(local){
      const r=await ghPutFile('photos/'+id+'.enc', await sEnc({p:local}), null, 'Photo '+id);
      if(r.conflict || r.sha) SYNC.meta.photosUp[id]=1; n++;
    } else {
      SYNC.meta.photosMiss=SYNC.meta.photosMiss||{}; if(Date.now()-(SYNC.meta.photosMiss[id]||0)<3600000) continue;
      const f=await ghGetFile('photos/'+id+'.enc');
      if(f){ const o=await sDec(f.text); await idbPut('photos', id, o.p); SYNC.meta.photosUp[id]=1; n++; } else SYNC.meta.photosMiss[id]=Date.now();
    }
    if(n>=40){ SYNC.again=true; break; }   // par lots, pour ne pas bloquer l'appli
  }
}
async function syncNow(manual){
  if(!syncActive()) return;
  if(SYNC.busy){ SYNC.again=true; await SYNC.running; return syncNow(manual); }
  if(!navigator.onLine){ SYNC.meta.lastError='Hors connexion : vos modifications seront envoyées au retour du réseau.'; SYNC.meta.errCode='reseau'; updateSyncBadge(); return; }
  SYNC.busy=true; SYNC.again=false; updateSyncBadge();
  let fin; SYNC.running=new Promise(r=>fin=r);
  let changed=false;
  try{
    changed = await syncPull();
    await syncPush();
    await syncPhotos();
    SYNC.meta.lastSync=new Date().toISOString(); SYNC.meta.lastError=null;
    if(manual) toast('Synchronisé.');
  }catch(e){
    console.warn(e); SYNC.meta.lastError=e.message||'Erreur de synchronisation.'; SYNC.meta.errCode=e.code||'';
    if(manual) toast(SYNC.meta.lastError, 5000);
  }finally{
    SYNC.busy=false; await syncSaveMeta(); updateSyncBadge(); fin();
    if(changed && !MODAL_STACK.length && !document.querySelector('input:focus,textarea:focus,select:focus')) refresh();
    if(SYNC.again) setTimeout(()=>syncNow(), 1500);
  }
}
const syncOnChange = debounce(()=>{ if(!syncActive() || window._syncApplying) return; SYNC.meta.dirty=true; syncSaveMeta(); syncNow(); }, 4000);
function syncMarkDirty(){ if(syncActive() && !window._syncApplying){ SYNC.meta.dirty=true; syncOnChange(); } }
function syncStart(){
  clearInterval(SYNC.timer);
  if(!syncActive()) return;
  syncNow();
  SYNC.timer=setInterval(()=>{ if(document.visibilityState==='visible') syncNow(); }, 120000);
}
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && syncActive()) syncNow(); else if(document.visibilityState==='hidden' && syncActive() && SYNC.meta.dirty) syncNow(); });
window.addEventListener('online', ()=>{ if(syncActive()) syncNow(); });

/* ---- mise en place ---- */
function linkCode(){ const m=SYNC.meta; return 'CEM1.'+b64(new TextEncoder().encode(JSON.stringify({o:m.owner, r:m.repo, t:m.token, k:m.key}))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function parseLinkCode(code){
  const c=(code||'').trim().replace(/\s/g,''); if(!c.startsWith('CEM1.')) throw new SyncError('code','Ce code de liaison n\'est pas valide.');
  let s=c.slice(5).replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  try{ const o=JSON.parse(new TextDecoder().decode(unb64(s))); if(!o.o||!o.r||!o.t||!o.k) throw 0; return o; }catch(e){ throw new SyncError('code','Ce code de liaison est incomplet : copiez-le en entier.'); }
}
async function syncVerifyRepo(){
  const r=await gh('GET', `/repos/${SYNC.meta.owner}/${SYNC.meta.repo}`);
  if(r.status===404) throw new SyncError('depot', `Le dépôt ${SYNC.meta.owner}/${SYNC.meta.repo} est introuvable, ou la clé d'accès n'y a pas accès (vérifiez « Repository access »).`);
  if(!r.ok) throw new SyncError('github','GitHub a répondu '+r.status+'.');
  const j=await r.json();
  if(!j.private) throw new SyncError('public', 'Ce dépôt est PUBLIC : par prudence, la synchronisation n\'utilise qu\'un dépôt privé.');
  if(j.permissions && j.permissions.push===false) throw new SyncError('droits', 'La clé d\'accès ne permet pas d\'écrire dans ce dépôt : donnez-lui « Contents : Read and write ».');
}
async function syncSetupFirst(token, repo){
  SYNC.meta={token:token.trim(), repo:(repo||'clef-en-main-donnees').trim(), device:deviceName(), dirty:true, sha:null, photosUp:{}};
  try{
    const u=await gh('GET','/user'); if(!u.ok) throw new SyncError('jeton','Clé d\'accès refusée par GitHub. Vérifiez que vous l\'avez copiée en entier.');
    SYNC.meta.owner=(await u.json()).login;
    await syncVerifyRepo();
    if(await ghGetFile(SYNC_FILE)) throw new SyncError('existe', 'Ce dépôt contient déjà des données d\'un autre appareil : utilisez plutôt « Relier cet appareil » avec le code de liaison affiché sur cet appareil-là.');
    const raw=crypto.getRandomValues(new Uint8Array(32)); SYNC.meta.key=b64(raw);
    SYNC.key=await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
    SYNC.meta.connectedAt=new Date().toISOString(); await syncSaveMeta();
    await syncNow(); syncStart(); return true;
  }catch(e){ SYNC.meta=null; SYNC.key=null; throw e; }
}
async function syncJoin(code){
  const o=parseLinkCode(code);
  SYNC.meta={owner:o.o, repo:o.r, token:o.t, key:o.k, device:deviceName(), dirty:true, sha:null, photosUp:{}, connectedAt:new Date().toISOString()};
  try{
    SYNC.key=await crypto.subtle.importKey('raw', unb64(o.k), 'AES-GCM', false, ['encrypt','decrypt']);
    await syncVerifyRepo(); await syncSaveMeta(); await syncNow(); if(SYNC.meta.lastError) throw new SyncError('x', SYNC.meta.lastError);
    syncStart(); return true;
  }catch(e){ SYNC.meta=null; SYNC.key=null; await idbDel('kv','sync'); throw e; }
}
async function syncReplaceToken(token){ SYNC.meta.token=token.trim(); SYNC.meta.lastError=null; await syncSaveMeta(); await syncVerifyRepo(); await syncNow(true); }
async function syncDisconnect(){ clearInterval(SYNC.timer); SYNC.meta=null; SYNC.key=null; await idbDel('kv','sync'); updateSyncBadge(); }
async function syncDeleteRemote(){
  const f=await ghGetFile(SYNC_FILE); if(f){ await gh('DELETE', repoPath(SYNC_FILE), {message:'Suppression des données synchronisées', sha:f.sha}); }
  const r=await gh('GET', repoPath('photos')); if(r.ok){ for(const it of await r.json()){ await gh('DELETE', repoPath(it.path), {message:'Suppression photo', sha:it.sha}); } }
}

/* ---- affichage ---- */
function syncLabel(){
  if(!syncActive()) return '';
  const m=SYNC.meta;
  if(SYNC.busy) return '☁️ Synchronisation…';
  if(m.lastError) return '⚠️ '+(m.errCode==='reseau'||!navigator.onLine?'Hors connexion — en attente':'Synchro à vérifier');
  if(m.dirty) return '☁️ Envoi en attente…';
  return m.lastSync ? '☁️ Synchronisé à '+new Date(m.lastSync).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '☁️ Synchronisation activée';
}
function updateSyncBadge(){ document.querySelectorAll('[data-syncbadge]').forEach(el=>{ el.textContent=syncLabel(); el.classList.toggle('warnc', !!(SYNC.meta&&SYNC.meta.lastError)); }); }

function openSyncSetup(){
  const tokenUrl='https://github.com/settings/personal-access-tokens/new?name='+encodeURIComponent('Clef en Main ('+deviceName()+')')+'&description='+encodeURIComponent('Synchronisation chiffrée de l\'appli Clef en Main')+'&expires_in=366&contents=write';
  const m=openModal({title:'☁️ Synchronisation automatique', wide:true, body:`
    <p>Vos données seront mises à jour toutes seules sur tous vos appareils. Elles sont <b>chiffrées sur l'appareil</b> avant d'être rangées dans un dépôt GitHub <b>privé</b> : même GitHub ne peut pas les lire.</p>
    <div class="radios" id="syMode"><label class="radio on"><input type="radio" name="mode" value="first" checked> <span><b>C'est mon premier appareil</b> — je mets en place la synchronisation</span></label><label class="radio"><input type="radio" name="mode" value="join"> <span><b>Relier cet appareil</b> — j'ai un code de liaison affiché sur mon autre appareil</span></label></div>
    <div id="syFirst"><ol class="steps">
      <li>Le dépôt privé <b>clef-en-main-donnees</b> doit exister sur votre compte GitHub (<a href="https://github.com/new?name=clef-en-main-donnees&visibility=private" target="_blank" rel="noopener">le créer</a> s'il n'existe pas).</li>
      <li><a href="${tokenUrl}" target="_blank" rel="noopener"><b>Ouvrir GitHub pour créer la clé d'accès</b></a>. Le formulaire est pré-rempli. Dans « Repository access », choisissez <b>Only select repositories</b> › <b>clef-en-main-donnees</b>. Vérifiez « Contents : Read and write », puis cliquez <b>Generate token</b>.</li>
      <li>Copiez la clé (elle commence par <code>github_pat_</code>) et collez-la ci-dessous.</li></ol>
      ${formHtml([{n:'token', l:'Clé d\'accès GitHub', t:'text', ph:'github_pat_…'},{n:'repo', l:'Nom du dépôt privé', t:'text', v:'clef-en-main-donnees'}],'sy')}</div>
    <div id="syJoin" style="display:none">${formHtml([{n:'code', l:'Code de liaison (copié depuis l\'autre appareil : Réglages › Synchronisation › Relier un autre appareil)', t:'textarea', rows:4, ph:'CEM1.…'}],'sj')}
      <p class="hint">Les données de cet appareil et celles en ligne seront fusionnées : rien n'est perdu.</p></div>
    <div class="infobox warn">La clé d'accès et le code de liaison donnent accès à vos données : ne les communiquez à personne. La clé expire au bout d'un an : l'appli vous préviendra.</div>`,
    actions:[{label:'Annuler'},{label:'Activer la synchronisation', cls:'btn-teal', onClick:async(c,bg)=>{
      const v=formValues(bg); const btn=bg.querySelector('.modal-foot .btn-teal'); btn.disabled=true; btn.textContent='Connexion…';
      try{
        if(v.mode==='join'){ await syncJoin(v.code); toast('Appareil relié : vos données sont synchronisées.', 4000); }
        else { if(!/^(github_pat_|ghp_)/.test((v.token||'').trim())){ throw new SyncError('jeton','Collez la clé d\'accès GitHub (elle commence par github_pat_).'); } await syncSetupFirst(v.token, v.repo); toast('Synchronisation activée.', 4000); setTimeout(openLinkCode, 300); }
        refresh(); return true;
      }catch(e){ toast(e.message||'Échec.', 6000); btn.disabled=false; btn.textContent='Activer la synchronisation'; return false; }
    }}]});
  m.el.querySelector('#syMode').addEventListener('change', ()=>{ const j=m.el.querySelector('[name=mode]:checked').value==='join'; m.el.querySelector('#syFirst').style.display=j?'none':''; m.el.querySelector('#syJoin').style.display=j?'':'none'; });
}
function openLinkCode(){
  const code=linkCode();
  openModal({title:'Relier un autre appareil', wide:true, body:`<p>Sur votre autre appareil (téléphone, tablette, ordinateur) : ouvrez Clef en Main › Réglages › <b>Synchronisation</b> › « Relier cet appareil », puis collez ce code :</p>
    <textarea class="codebox" readonly rows="4" onclick="this.select()">${esc(code)}</textarea>
    <p class="hint">Pour le transférer, copiez-le puis envoyez-le vous par un moyen sûr (message à vous-même, note personnelle), et effacez-le ensuite. Il donne accès à vos données.</p>`,
    actions:[{label:'Fermer'},{label:'Partager', onClick:()=>{ if(navigator.share) navigator.share({title:'Code de liaison Clef en Main', text:code}).catch(()=>{}); else toast('Partage indisponible : utilisez Copier.'); return false; }},{label:'Copier le code', cls:'btn-teal', onClick:()=>{ navigator.clipboard.writeText(code).then(()=>toast('Code copié.')); return false; }}]});
}
function syncCardHtml(){
  if(!syncActive()) return `<div class="card"><h3>☁️ Synchronisation automatique entre appareils</h3><p>Utilisez l'appli sur votre téléphone, votre tablette et votre ordinateur : chaque modification apparaît partout, toute seule. Données chiffrées, rangées dans un dépôt GitHub privé à votre nom.</p><div class="btnrow"><button class="btn btn-teal" onclick="openSyncSetup()">Activer la synchronisation</button></div></div>`;
  const m=SYNC.meta;
  return `<div class="card"><h3>☁️ Synchronisation automatique</h3><p><b data-syncbadge>${esc(syncLabel())}</b></p>
    <dl class="dl"><dt>Dépôt privé</dt><dd>${esc(m.owner+'/'+m.repo)}</dd><dt>Cet appareil</dt><dd>${esc(m.device)}</dd>${m.lastError?`<dt>Dernier problème</dt><dd class="neg">${esc(m.lastError)}</dd>`:''}</dl>
    <div class="btnrow"><button class="btn btn-teal btn-sm" onclick="syncNow(true)">Synchroniser maintenant</button><button class="btn btn-ghost btn-sm" onclick="openLinkCode()">Relier un autre appareil</button>
      <button class="btn btn-ghost btn-sm" onclick="(async()=>{ const t=await promptBox('Nouvelle clé d\\'accès','Collez la nouvelle clé GitHub (github_pat_…)',''); if(t){ try{ await syncReplaceToken(t); refresh(); }catch(e){ toast(e.message,5000); } } })()">Remplacer la clé d'accès</button>
      <button class="btn btn-ghost btn-sm" onclick="(async()=>{ if(await confirmBox('Arrêter la synchronisation sur cet appareil ?','Les données restent sur cet appareil et en ligne ; il ne recevra plus les modifications des autres appareils.','Arrêter')){ await syncDisconnect(); refresh(); } })()">Arrêter sur cet appareil</button>
      <button class="btn btn-ghost btn-sm danger" onclick="(async()=>{ if(await confirmBox('Effacer les données en ligne ?','Le fichier chiffré et les photos seront supprimés du dépôt GitHub (l\\'historique du dépôt garde les anciennes versions chiffrées : supprimez le dépôt sur GitHub pour tout effacer). Vos appareils gardent leurs données.','Effacer',true)){ try{ await syncDeleteRemote(); await syncDisconnect(); toast('Données en ligne effacées.'); refresh(); }catch(e){ toast(e.message,5000); } } })()">Effacer les données en ligne…</button></div>
    <p class="hint">Chaque envoi crée une version dans le dépôt : en cas de fausse manipulation, les versions précédentes restent récupérables. La clé d'accès expire au bout d'un an : remplacez-la sur chaque appareil, ou générez un nouveau code de liaison.</p></div>`;
}
