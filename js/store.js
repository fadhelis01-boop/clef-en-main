/* =====================================================================================
   STORE — enregistrement automatique sur l'appareil (IndexedDB), photos à part,
   corbeille, sauvegarde/synchronisation entre appareils par fichier (chiffrable),
   reprise des données de l'ancienne version (v1, localStorage « clefenmain: »).
   ===================================================================================== */
const DB_NAME = 'clef-en-main', DB_VER = 1;
const COLLS = ['bailleurs','biens','baux','paiements','depenses','docs'];
let DB = null;
let STATE = null;

function emptyState(){
  return { schema:2, bailleurs:[], biens:[], baux:[], paiements:[], depenses:[], docs:[],
    corbeille:[], suppr:{}, settings:{ createdAt:todayISO(), lastBackup:null, regVu:null, regCheck:null, onboarding:false } };
}

function idbOpen(){
  return new Promise((res)=>{
    if(!('indexedDB' in window)) return res(null);
    let req; try{ req=indexedDB.open(DB_NAME, DB_VER); }catch(e){ return res(null); }
    req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos'); };
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>res(null);
    req.onblocked=()=>res(null);
  });
}
function idbGet(store, key){
  return new Promise(res=>{ if(!DB) return res(null); try{ const r=DB.transaction(store).objectStore(store).get(key); r.onsuccess=()=>res(r.result===undefined?null:r.result); r.onerror=()=>res(null);}catch(e){res(null);} });
}
function idbPut(store, key, val){
  return new Promise(res=>{ if(!DB) return res(false); try{ const tx=DB.transaction(store,'readwrite'); tx.objectStore(store).put(val,key); tx.oncomplete=()=>res(true); tx.onerror=()=>{ console.error(tx.error); res(false); }; }catch(e){ console.error(e); res(false);} });
}
function idbDel(store, key){
  return new Promise(res=>{ if(!DB) return res(false); try{ const tx=DB.transaction(store,'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);}catch(e){res(false);} });
}
function idbAll(store){
  return new Promise(res=>{ if(!DB) return res({}); try{
    const out={}; const r=DB.transaction(store).objectStore(store).openCursor();
    r.onsuccess=()=>{ const c=r.result; if(c){ out[c.key]=c.value; c.continue(); } else res(out); };
    r.onerror=()=>res(out);
  }catch(e){ res({}); } });
}

/* ---- Chargement ---- */
async function storeInit(){
  DB = await idbOpen();
  let st = await idbGet('kv','state');
  if(!st){ try{ const raw=localStorage.getItem('clef-en-main:state'); if(raw) st=JSON.parse(raw); }catch(e){} }
  STATE = st ? migrateState(st) : emptyState();
  // reprise automatique de l'ancienne version si elle a tourné à la même adresse
  if(!st){
    try{
      const old = localStorage.getItem('clefenmain:contracts-index');
      if(old){
        const contracts = JSON.parse(old)||[]; const docs={};
        contracts.forEach(c=>{ try{ docs[c.id]=JSON.parse(localStorage.getItem('clefenmain:docs:'+c.id)||'[]'); }catch(e){ docs[c.id]=[]; } });
        await importV1({app:'clef-en-main', version:1, contracts, docs}, true);
        toast('Vos baux de l\'ancienne version ont été repris automatiquement.', 4500);
      }
    }catch(e){ console.error(e); }
  }
  purgeCorbeille();
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
}
function migrateState(st){
  const base = emptyState();
  const out = Object.assign(base, st);
  COLLS.forEach(k=>{ if(!Array.isArray(out[k])) out[k]=[]; });
  out.settings = Object.assign(emptyState().settings, st.settings||{});
  out.suppr = out.suppr||{}; out.corbeille = out.corbeille||[];
  out.schema = 2;
  return out;
}

/* ---- Enregistrement ---- */
let _saveTimer=null, _lastSaveOk=true;
function save(){ clearTimeout(_saveTimer); _saveTimer=setTimeout(saveNow, 250); }
async function saveNow(){
  clearTimeout(_saveTimer);
  STATE.settings.savedAt = new Date().toISOString();
  let ok = await idbPut('kv','state', STATE);
  if(!ok){
    try{ localStorage.setItem('clef-en-main:state', JSON.stringify(STATE)); ok=true; }
    catch(e){ if(_lastSaveOk) toast('Attention : enregistrement impossible sur cet appareil (mémoire pleine ?). Faites une copie de sauvegarde.', 6000); }
  }
  _lastSaveOk = ok; return ok;
}
window.addEventListener('pagehide', ()=>{ if(_saveTimer) saveNow(); });
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden' && _saveTimer) saveNow(); });

/* ---- Accès aux données ---- */
function byId(coll, id){ return (STATE[coll]||[]).find(x=>x.id===id) || null; }
function upsert(coll, obj){
  obj.updatedAt = new Date().toISOString();
  const arr=STATE[coll]; const i=arr.findIndex(x=>x.id===obj.id);
  if(i>=0) arr[i]=obj; else arr.push(obj);
  save(); return obj;
}
/* Suppression = mise à la corbeille (30 jours), jamais immédiate. */
function softDelete(coll, id, label){
  const arr=STATE[coll]; const i=arr.findIndex(x=>x.id===id); if(i<0) return;
  const item=arr.splice(i,1)[0];
  STATE.corbeille.push({coll, item, label:label||'', deletedAt:new Date().toISOString()});
  STATE.suppr[id]=new Date().toISOString();
  save();
}
function restoreFromCorbeille(idx){
  const e=STATE.corbeille[idx]; if(!e) return;
  if(e.coll==='biens' && biensActifs().length>=MAX_BIENS && e.item.statut!=='archive'){ toast('6 biens actifs maximum : archivez ou supprimez un bien d\'abord.'); return false; }
  e.item.updatedAt=new Date().toISOString();
  STATE[e.coll].push(e.item); delete STATE.suppr[e.item.id];
  STATE.corbeille.splice(idx,1); save(); return true;
}
async function purgeCorbeille(force){
  const lim = addDays(todayISO(), -30);
  const keep=[], gone=[];
  STATE.corbeille.forEach(e=>{ (force || e.deletedAt.slice(0,10) < lim ? gone : keep).push(e); });
  if(!gone.length) return;
  STATE.corbeille = keep;
  for(const e of gone){ for(const pid of photoIdsOf(e.item)) await idbDel('photos', pid); }
  // les traces de suppression servent à la synchronisation : gardées 1 an
  const limT = addDays(todayISO(), -365);
  for(const k in STATE.suppr){ if(STATE.suppr[k].slice(0,10) < limT) delete STATE.suppr[k]; }
  save();
}
function photoIdsOf(obj){
  const ids=[]; const walk=o=>{ if(!o||typeof o!=='object') return; if(Array.isArray(o)) return o.forEach(walk);
    for(const k in o){ if(k==='photos' && Array.isArray(o[k])) o[k].forEach(p=>{ if(typeof p==='string' && p.startsWith('ph_')) ids.push(p); }); else walk(o[k]); } };
  walk(obj); return ids;
}

/* ---- Photos ---- */
async function photoSave(dataUrl){ const id=uid('ph'); await idbPut('photos', id, dataUrl); return id; }
async function photoGet(id){ if(!id) return null; if(id.startsWith('data:')) return id; return await idbGet('photos', id); }
async function hydratePhotos(root){
  for(const img of root.querySelectorAll('img[data-ph]')){ const src=await photoGet(img.dataset.ph); if(src) img.src=src; else img.closest('.photobox')?.remove(); }
}
function compressImage(file, maxDim, q){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{ const img=new Image();
      img.onload=()=>{ maxDim=maxDim||1100; let w=img.width,h=img.height;
        if(w>=h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; } else if(h>w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
        const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cv.toDataURL('image/jpeg', q||0.68)); };
      img.onerror=()=>reject(new Error('image')); img.src=e.target.result; };
    reader.onerror=()=>reject(new Error('lecture')); reader.readAsDataURL(file);
  });
}

/* =====================================================================================
   SAUVEGARDE ET SYNCHRONISATION ENTRE APPAREILS
   Un seul fichier « .clef » contient tout (y compris les photos). On l'enregistre dans
   Google Drive, iCloud Drive, OneDrive, une clé USB ou on se l'envoie par e-mail, puis on
   l'ouvre sur l'autre appareil : les deux contenus sont FUSIONNÉS fiche par fiche
   (la version la plus récemment modifiée gagne, les suppressions sont respectées).
   ===================================================================================== */
async function buildBackupPayload(){
  const photos = await idbAll('photos');
  const used = new Set(photoIdsOf(STATE));
  const ph={}; for(const k in photos){ if(used.has(k)) ph[k]=photos[k]; }
  return { app:'clef-en-main', v:2, appVersion:APP_VERSION, exportedAt:new Date().toISOString(), state:STATE, photos:ph };
}
function b64(buf){ let s=''; const b=new Uint8Array(buf); for(let i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null, b.subarray(i,i+0x8000)); return btoa(s); }
function unb64(s){ const bin=atob(s); const b=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) b[i]=bin.charCodeAt(i); return b; }
async function deriveKey(pass, salt){
  const base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function encryptPayload(obj, pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(pass, salt);
  const data=await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
  return {app:'clef-en-main', v:2, chiffre:true, salt:b64(salt), iv:b64(iv), data:b64(data)};
}
async function decryptPayload(wrap, pass){
  const key=await deriveKey(pass, unb64(wrap.salt));
  const plain=await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(wrap.iv)}, key, unb64(wrap.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function exportBackup(pass){
  await saveNow();
  let payload = await buildBackupPayload();
  if(pass) payload = await encryptPayload(payload, pass);
  const name = 'clef-en-main-'+todayISO()+(pass?'-chiffre':'')+'.clef';
  const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
  const file = new File([blob], name, {type:'application/json'});
  let shared=false;
  try{
    if(navigator.canShare && navigator.canShare({files:[file]}) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
      await navigator.share({files:[file], title:'Sauvegarde Clef en Main', text:'Sauvegarde de mes locations — à ouvrir dans Clef en Main sur un autre appareil.'});
      shared=true;
    }
  }catch(e){ if(e && e.name==='AbortError') return false; }
  if(!shared) downloadBlob(blob, name);
  STATE.settings.lastBackup = new Date().toISOString(); save();
  return true;
}
async function readBackupFile(file){
  const txt = await file.text();
  let p; try{ p=JSON.parse(txt); }catch(e){ throw new Error('Ce fichier n\'est pas une sauvegarde Clef en Main.'); }
  if(!p || p.app!=='clef-en-main') throw new Error('Ce fichier n\'est pas une sauvegarde Clef en Main.');
  if(p.chiffre){
    const pass = await promptBox('Sauvegarde protégée', 'Mot de passe de la sauvegarde', '');
    if(!pass) throw new Error('Import annulé.');
    try{ p = await decryptPayload(p, pass); }catch(e){ throw new Error('Mot de passe incorrect.'); }
  }
  return p;
}
/* Fusion fiche par fiche */
async function mergePayload(p){
  if(p.version===1 || Array.isArray(p.contracts)) return importV1(p, false);
  const inc = migrateState(p.state||{});
  const stats={ajouts:0, majs:0};
  const tomb = Object.assign({}, STATE.suppr);
  for(const k in inc.suppr){ if(!tomb[k] || inc.suppr[k]>tomb[k]) tomb[k]=inc.suppr[k]; }
  COLLS.forEach(coll=>{
    const map={}; STATE[coll].forEach(x=>map[x.id]=x);
    inc[coll].forEach(x=>{
      const cur=map[x.id];
      if(!cur){ map[x.id]=x; stats.ajouts++; }
      else if((x.updatedAt||'') > (cur.updatedAt||'')){ map[x.id]=x; stats.majs++; }
    });
    STATE[coll] = Object.values(map).filter(x=> !(tomb[x.id] && tomb[x.id] > (x.updatedAt||'')));
  });
  STATE.suppr = tomb;
  const s=STATE.settings, si=inc.settings||{};
  if(si.lastBackup && (!s.lastBackup || si.lastBackup>s.lastBackup)) s.lastBackup=si.lastBackup;
  if(si.regVu && (!s.regVu || si.regVu>s.regVu)) s.regVu=si.regVu;
  for(const id in (p.photos||{})){ if(!(await idbGet('photos', id))) await idbPut('photos', id, p.photos[id]); }
  // si la fusion dépasse 6 biens actifs, les plus anciens restent actifs, les autres sont signalés
  await saveNow();
  return stats;
}
async function replaceWithPayload(p){
  if(p.version===1 || Array.isArray(p.contracts)){ STATE=emptyState(); return importV1(p,false); }
  STATE = migrateState(p.state||{});
  for(const id in (p.photos||{})) await idbPut('photos', id, p.photos[id]);
  await saveNow(); return {ajouts:0, majs:0, remplace:true};
}

/* ---- Reprise du format de la version 1 (fichier « clef-en-main-sauvegarde-*.json ») ---- */
async function importV1(payload, silent){
  const stats={ajouts:0, majs:0};
  for(const c of (payload.contracts||[])){
    if(byId('baux', c.id)) continue;
    // bailleur (dédoublonné sur nom + adresse)
    const bk=(c.bailleur.nom+'|'+c.bailleur.adresse).toLowerCase();
    let bl=STATE.bailleurs.find(b=>(b.nom+'|'+b.adresse).toLowerCase()===bk);
    if(!bl){ bl={id:uid('bl'), type:c.bailleur.qualite==='sci'?'sci':'physique', nom:c.bailleur.nom, prenom:c.bailleur.prenom, raison:c.bailleur.qualite==='sci'?(c.bailleur.siret||''):'', siret:c.bailleur.siret||'', adresse:c.bailleur.adresse, tel:c.bailleur.tel, email:c.bailleur.email}; upsert('bailleurs', bl); }
    // bien (dédoublonné sur adresse)
    const ak=(c.bien.adresse+'|'+c.bien.cp).toLowerCase();
    let bi=STATE.biens.find(b=>(b.adresse+'|'+b.cp).toLowerCase()===ak);
    if(!bi){
      bi={id:uid('bi'), bailleurId:bl.id, statut:'actif', surnom:'', adresse:c.bien.adresse, complement:'', cp:c.bien.cp, ville:c.bien.ville, type:(c.bien.type||'Appartement'),
        surface:c.bien.surface, pieces:c.bien.pieces, etage:c.bien.etage, chauffage:c.bien.chauffage, annexes:c.bien.equipements, dpe:{classe:(c.bien.dpe||'').toUpperCase().slice(0,1)}, diagnostics:{}, createdAt:c.createdAt||todayISO()};
      if(biensActifs().length>=MAX_BIENS) bi.statut='archive';
      upsert('biens', bi);
    }
    const loyer=num(c.loyerHC), ch=num(c.charges);
    const bail={ id:c.id, ref:c.ref, bienId:bi.id, bailleurId:bl.id, statut:'actif',
      type:c.typeLocation==='meuble'?'meuble':'vide', dureeMois: c.dureeType==='determinee'? num(c.dureeMois)||12 : (c.typeLocation==='meuble'?12:36),
      dureeReduite: c.dureeType==='determinee' && c.typeLocation!=='meuble', motifDureeReduite:'',
      locataires:[{id:uid('lo'), nom:c.locataire.nom, prenom:c.locataire.prenom, adresseAvant:c.locataire.adresseAvant, tel:c.locataire.tel, email:c.locataire.email}],
      garants:[], dateDebut:c.dateDebut, dateSignature:c.dateSignature, lieuSignature:c.lieuSignature,
      loyerHC:loyer, charges:ch, chargesType:c.chargesType||'provision', depot:num(c.depotGarantie), jourPaiement:num(c.jourPaiement)||1, terme:'echoir', modePaiement:c.modePaiement||'virement',
      historiqueLoyer:[{du:c.dateDebut, loyerHC:loyer, charges:ch, motif:'Loyer initial'}], irl:{}, revision:true, createdAt:c.createdAt||todayISO(), reprisV1:true };
    upsert('baux', bail); stats.ajouts++;
    for(const d of ((payload.docs||{})[c.id]||[])){
      const nd = Object.assign({}, d); let type=d.type;
      // photos des états des lieux : sorties du document vers le stockage photos
      if(nd.rooms){ for(const r of nd.rooms){ for(const it of (r.items||[])){ const ids=[]; for(const p of (it.photos||[])){ ids.push(p.startsWith('data:')? await photoSave(p) : p); } it.photos=ids; } } }
      // correspondance des anciens formulaires vers les nouveaux modèles
      if(type==='relance'){ if(num(d.niveau)>=3){ type='mise_en_demeure'; } nd.niveau=String(Math.min(num(d.niveau)||1,2)); nd.montant=d.montantDu; nd.envoi=num(d.niveau)>=2?'lrar':'simple'; }
      if(type==='mise_en_demeure'){ nd.montant=d.montantDu; nd.envoi='lrar'; }
      if(type==='avis_echeance' || type==='quittance'){ nd.mois=parseMoisTexte(d.periode); }
      if(type==='attestation'){ if(d.type==='assurance') type='demande_assurance'; nd.typeAtt={hebergement:'domicile', loyer_caf:'loyer_caf', bon_voisinage:'bon_voisinage'}[d.type]||'loyer_caf'; }
      if(type==='conge'){ if(d.emetteur==='bailleur'){ type='conge_bailleur'; nd.motif='legitime'; nd.motifTexte=d.motif; } else { type='accuse_conge'; nd.dateReception=d.createdAt; } nd.envoi='lrar'; }
      if(type==='solde'){ type='restitution_depot'; nd.remiseCles=d.createdAt; nd.conforme='oui'; nd.impayes=0; nd.copro=0; nd.retenues=(d.retenues||[]).map(r=>r.motif+' ; '+r.montant).join('\n'); }
      if(type==='resiliation_amiable'){ nd.conditions=d.commentaire; }
      const doc={id:d.id, type, bailId:c.id, bienId:bi.id, ref:d.ref, createdAt:d.createdAt||todayISO(), data:nd, envois:[], repris:true};
      if(type==='quittance' && nd.mois){
        upsert('paiements', {id:uid('pa'), bailId:c.id, date:d.datePaiement||d.createdAt, montant:r2(num(d.loyerHC)+num(d.charges)), mode:d.modePaiement||'virement', origine:'locataire', note:'Repris de la quittance '+(d.ref||'')});
      }
      // le document est figé tel qu'il est généré à la reprise ; à défaut, résumé de ses données
      try{ if((type==='quittance'||type==='avis_echeance') && !nd.mois) throw new Error('mois'); doc.html = DOCS[type].gen(ctxBail(c.id), nd); }
      catch(e){ doc.html = '<div class="docsheet"><h1>'+esc((DOCS[type]||{}).l||type)+'</h1><p class="small">Document repris de l\'ancienne version (réf. '+esc(d.ref||'')+', '+fdate(d.createdAt)+').</p><table>'+Object.keys(d).filter(k=>!['id','type','ref','createdAt','rooms'].includes(k)).map(k=>'<tr><td>'+esc(k)+'</td><td>'+esc(typeof d[k]==='object'?JSON.stringify(d[k]):d[k])+'</td></tr>').join('')+'</table></div>'; }
      upsert('docs', doc);
    }
  }
  await saveNow();
  if(!silent) toast('Données de l\'ancienne version importées.');
  return stats;
}

/* =====================================================================================
   VEILLE RÉGLEMENTAIRE : regles.json publié à côté de l'appli, relu au démarrage
   (au plus une fois par jour) — mis à jour chaque mois par la veille programmée.
   ===================================================================================== */
async function regLoadCached(){
  const cached = await idbGet('kv','regles');
  if(cached) REG = regFusion(cached);
}
async function regCheckOnline(force){
  const last = STATE.settings.regCheck;
  if(!force && last && last.slice(0,10)===todayISO()) return {skipped:true};
  if(location.protocol==='file:') return {offline:true};
  try{
    const r = await fetch('regles.json?t='+Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const remote = await r.json();
    const before = REG.version;
    REG = regFusion(remote);
    await idbPut('kv','regles', remote);
    STATE.settings.regCheck = new Date().toISOString(); save();
    return {ok:true, version:REG.version, nouveau: REG.version>before};
  }catch(e){ return {error:true}; }
}
