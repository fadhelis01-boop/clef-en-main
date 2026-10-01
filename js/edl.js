/* =====================================================================================
   ÉTAT DES LIEUX — éditeur pièce par pièce, photos, inventaire du meublé, brouillon
   enregistré en continu (on peut quitter et reprendre sur place), sortie comparée à l'entrée.
   ===================================================================================== */
const EDL_ETATS = ['Neuf','Bon état','État d\'usage','Mauvais état','Hors service','Absent / sans objet'];
const ROOM_TPL = {
  entree:{l:'Entrée / dégagement', items:['Porte d\'entrée, serrure, clés','Sol','Murs','Plafond','Interrupteurs, prises','Éclairage','Placard','Interphone / sonnette']},
  sejour:{l:'Séjour', items:['Sol','Murs','Plafond','Fenêtres, vitrages','Volets / stores','Porte','Prises, interrupteurs','Radiateur / chauffage','Éclairage']},
  cuisine:{l:'Cuisine', items:['Sol','Murs, crédence','Plafond','Fenêtre','Évier, robinetterie','Plaques de cuisson','Four / micro-ondes','Hotte / VMC','Réfrigérateur','Meubles hauts et bas','Prises, interrupteurs']},
  chambre:{l:'Chambre', items:['Sol','Murs','Plafond','Fenêtres, vitrages','Volets / rideaux occultants','Porte','Placard','Prises, interrupteurs','Radiateur / chauffage']},
  sdb:{l:'Salle de bains / salle d\'eau', items:['Sol','Murs, faïence','Plafond','Lavabo, robinetterie','Douche / baignoire, joints','Ventilation (VMC)','Miroir, rangements','Prises, éclairage','Chauffe-eau / sèche-serviettes']},
  wc:{l:'WC', items:['Sol','Murs','Plafond','Cuvette, abattant, chasse d\'eau','Lave-mains','Ventilation','Éclairage']},
  exterieur:{l:'Balcon / terrasse / jardin', items:['Sol','Garde-corps','Plantations','Éclairage extérieur']},
  annexe:{l:'Cave / parking / box', items:['Porte, serrure','Sol','Murs','Éclairage']}
};
let EDL=null; const PHCACHE={};
function edlDraftKey(bailId, sens){ return 'edl:'+bailId+':'+sens; }
function edlRoom(k, name){ const t=ROOM_TPL[k]||{l:name||'Pièce', items:['Sol','Murs','Plafond']}; return {id:uid('r'), name:name||t.l, items:t.items.map(l=>({label:l, etat:'Bon état', obs:'', photos:[]}))}; }
function edlInit(x, sens){
  const draft=(STATE.settings.drafts||{})[edlDraftKey(x.bail.id,sens)];
  if(draft) return JSON.parse(JSON.stringify(draft));
  const d={date:todayISO(), heure:'', cles:'', observations:'', rooms:[]};
  const entree = sens==='sortie' ? STATE.docs.filter(o=>o.bailId===x.bail.id && o.type==='etat_lieux_entree').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0] : null;
  if(entree){ // même structure qu'à l'entrée ; l'état d'entrée sert de point de départ
    d.rooms = JSON.parse(JSON.stringify(entree.data.rooms||[])).map(r=>({id:uid('r'), name:r.name, items:(r.items||[]).map(it=>({label:it.label, etat:it.etat, obs:'', photos:[], entree:it.etat}))}));
    d.cles=entree.data.cles||''; d.inventaire = entree.data.inventaire ? entree.data.inventaire.map(i=>Object.assign({}, i, {obs:'', entree:i.etat})) : null;
    d.nouvelleAdresse=(x.bail.fin||{}).adresseNouvelle||'';
  } else {
    const ch=Math.max(1, num(x.bien.pieces)-1);
    d.rooms=[edlRoom('entree'), edlRoom('sejour'), edlRoom('cuisine')];
    for(let i=1;i<=ch;i++) d.rooms.push(edlRoom('chambre', ch>1?'Chambre '+i:'Chambre'));
    d.rooms.push(edlRoom('sdb'), edlRoom('wc'));
    if(x.bien.annexes) d.rooms.push(edlRoom('annexe', 'Annexes : '+x.bien.annexes.slice(0,40)));
  }
  if(estMeuble(x.bail) && !d.inventaire) d.inventaire = (REG.equipementsMeuble||[]).map(l=>({label:l, qte:'1', etat:'Bon état', obs:''}));
  return d;
}
function edlSaveDraft(){ if(!EDL) return; STATE.settings.drafts=STATE.settings.drafts||{}; STATE.settings.drafts[EDL.key]=EDL.d; save(); }
const edlSaveDraftSoon = debounce(edlSaveDraft, 600);

async function openEDL(bailId, sens){
  const x=ctxBail(bailId); if(!x) return;
  EDL={x, sens, key:edlDraftKey(bailId,sens), d:edlInit(x, sens)};
  for(const r of EDL.d.rooms) for(const it of r.items) for(const p of it.photos) if(!PHCACHE[p]) PHCACHE[p]=await photoGet(p);
  const hasDraft=!!((STATE.settings.drafts||{})[EDL.key]);
  const m=openModal({ title:(sens==='sortie'?'🚪 État des lieux de sortie':'🔑 État des lieux d\'entrée'), wide:true, sticky:true, body:`
    ${hasDraft?'<div class="infobox">Brouillon repris là où vous l\'aviez laissé.</div>':''}
    ${sens==='sortie' && !STATE.docs.some(o=>o.bailId===bailId && o.type==='etat_lieux_entree')?'<div class="infobox warn">Aucun état des lieux d\'entrée n\'est enregistré dans l\'appli pour ce bail. Si vous en avez un sur papier, gardez-le sous les yeux : seules les différences avec l\'entrée (au-delà de l\'usure normale) peuvent justifier une retenue. Sans état des lieux d\'entrée, le logement est présumé avoir été remis en bon état, sauf si le bailleur a lui-même empêché de le faire.</div>':''}
    <p class="hint">Faites-le <b>ensemble, sur place</b>, à la lumière du jour. Tout ce que vous saisissez est enregistré au fur et à mesure : vous pouvez fermer et reprendre plus tard.${sens==='sortie'?' Les états de l\'entrée sont pré-remplis : ne modifiez que ce qui a changé.':''}</p>
    <form id="edlForm" onsubmit="return false">${formHtml([
      {n:'date', l:'Date', t:'date', v:EDL.d.date, col:3}, {n:'heure', l:'Heure', t:'text', v:EDL.d.heure, ph:'10 h', col:3}, {n:'representant', l:'Représentant du bailleur (si autre)', t:'text', v:EDL.d.representant||'', col:3},
      {t:'section', l:'Compteurs'},
      {n:'compteurElec', l:'Électricité (relevé)', t:'text', v:EDL.d.compteurElec||'', col:2}, {n:'elecNum', l:'N° PDL / compteur', t:'text', v:EDL.d.elecNum||'', col:2},
      {n:'compteurGaz', l:'Gaz (relevé)', t:'text', v:EDL.d.compteurGaz||'', col:2}, {n:'gazNum', l:'N° PCE / compteur', t:'text', v:EDL.d.gazNum||'', col:2},
      {n:'compteurEau', l:'Eau froide', t:'text', v:EDL.d.compteurEau||'', col:2}, {n:'compteurEauChaude', l:'Eau chaude', t:'text', v:EDL.d.compteurEauChaude||'', col:2},
      {n:'chauffageEtat', l:'Chauffage / eau chaude : état et fonctionnement', t:'text', v:EDL.d.chauffageEtat||'', col:2}, {n:'chaudiereEntretien', l:'Dernier entretien chaudière', t:'date', v:EDL.d.chaudiereEntretien||'', col:2}
    ],'el')}
    <h3 class="fsect">Pièces</h3><div id="edlRooms"></div>
    <div class="eladdroom"><select id="edlAddType">${Object.keys(ROOM_TPL).map(k=>`<option value="${k}">${ROOM_TPL[k].l}</option>`).join('')}<option value="custom">Autre pièce…</option></select><button type="button" class="btn btn-ghost btn-sm" id="edlAdd">+ Ajouter une pièce</button></div>
    <div id="edlInv"></div>
    ${formHtml([{t:'section', l:'Clés et observations'},
      {n:'cles', l:'Clés et moyens d\'accès remis (nombre et type)', t:'text', v:EDL.d.cles},
      sens==='sortie'?{n:'nouvelleAdresse', l:'Nouvelle adresse du locataire', t:'text', v:EDL.d.nouvelleAdresse||''}:null,
      {n:'observations', l:'Observations générales'+(sens==='sortie'?' / réserves':''), t:'textarea', v:EDL.d.observations}].filter(Boolean),'el2')}
    </form>`,
    actions:[
      {label:'Fermer (garder le brouillon)', onClick:()=>{ edlCollect(m.el); edlSaveDraft(); toast('Brouillon enregistré.'); }},
      {label:'👁️ Aperçu', onClick:(c,bg)=>{ edlCollect(bg); previewDoc(genEtatLieux(x, EDL.d, sens), 'Aperçu'); return false; }},
      {label:'Terminer et enregistrer', cls:'btn-teal', onClick:async(c,bg)=>{
        edlCollect(bg);
        const type= sens==='sortie'?'etat_lieux_sortie':'etat_lieux_entree';
        const data=JSON.parse(JSON.stringify(EDL.d));
        if(sens==='sortie'){
          const diffs = data.rooms.some(r=>r.items.some(it=>it.entree && it.entree!==it.etat)) || (data.inventaire||[]).some(i=>i.entree && i.entree!==i.etat);
          x.bail.fin=Object.assign(x.bail.fin||{}, {remiseCles:x.bail.fin&&x.bail.fin.remiseCles||data.date, edlConforme:!diffs, adresseNouvelle:data.nouvelleAdresse||(x.bail.fin||{}).adresseNouvelle});
          if(['actif','preavis'].includes(x.bail.statut) && data.date<=todayISO()){ x.bail.statut='sortie'; x.bail.fin.date=x.bail.fin.date||data.date; }
          upsert('baux', x.bail);
        }
        if(STATE.settings.drafts) delete STATE.settings.drafts[EDL.key];
        const doc=saveDoc(type, x, data);
        EDL=null; return true;
      }}
    ]});
  edlRender(m.el);
  m.el.querySelector('#edlAdd').onclick=async()=>{ edlCollect(m.el); const k=m.el.querySelector('#edlAddType').value; let name=null; if(k==='custom'){ name=await promptBox('Nouvelle pièce','Nom de la pièce','Bureau'); if(!name) return; } EDL.d.rooms.push(edlRoom(k==='custom'?'x':k, name)); edlRender(m.el); edlSaveDraftSoon(); };
  m.el.addEventListener('input', ()=>{ edlCollect(m.el); edlSaveDraftSoon(); });
  m.el.addEventListener('change', async e=>{
    const t=e.target;
    if(t.matches('[data-ph-in]')){
      const [ri,ii]=t.dataset.phIn.split(':').map(Number); const files=[...(t.files||[])]; if(!files.length) return;
      toast('Ajout de '+plural(files.length,'photo')+'…');
      for(const f of files){ try{ const du=await compressImage(f); const id=await photoSave(du); PHCACHE[id]=du; EDL.d.rooms[ri].items[ii].photos.push(id); }catch(err){ toast('Photo illisible.'); } }
      edlCollect(m.el); edlRender(m.el); edlSaveDraft();
    } else { edlCollect(m.el); edlSaveDraftSoon(); }
  });
  m.el.addEventListener('click', async e=>{
    const b=e.target.closest('[data-edl]'); if(!b) return; const [act,a,c]=b.dataset.edl.split(':'); const ri=+a, ii=+c;
    edlCollect(m.el);
    if(act==='delphoto'){ const [r,i,p]=[ri,ii,+b.dataset.p]; EDL.d.rooms[r].items[i].photos.splice(p,1); }
    if(act==='additem'){ const l=await promptBox('Ajouter un élément','Élément','Placard'); if(!l) return; EDL.d.rooms[ri].items.push({label:l, etat:'Bon état', obs:'', photos:[]}); }
    if(act==='delroom'){ if(!(await confirmBox('Retirer cette pièce ?','La pièce « '+esc(EDL.d.rooms[ri].name)+' » sera retirée de l\'état des lieux.','Retirer',true))) return; EDL.d.rooms.splice(ri,1); }
    if(act==='toggle'){ const el=m.el.querySelector(`[data-room="${ri}"]`); el.classList.toggle('closed'); return; }
    if(act==='allgood'){ EDL.d.rooms[ri].items.forEach(it=>{ if(!it.entree) it.etat='Bon état'; }); }
    if(act==='addinv'){ const l=await promptBox('Ajouter au mobilier','Équipement','Canapé'); if(!l) return; EDL.d.inventaire.push({label:l, qte:'1', etat:'Bon état', obs:''}); }
    if(act==='delinv'){ EDL.d.inventaire.splice(ri,1); }
    edlRender(m.el); edlSaveDraft();
  });
}
function edlRender(root){
  const etats=(cur)=>EDL_ETATS.map(o=>`<option ${cur===o?'selected':''}>${o}</option>`).join('');
  root.querySelector('#edlRooms').innerHTML = EDL.d.rooms.map((r,ri)=>`
    <div class="elroom" data-room="${ri}">
      <div class="elroom-head"><button type="button" class="linkbtn" data-edl="toggle:${ri}" aria-label="Replier">▾</button>
        <input type="text" class="elroom-name" data-k="room:${ri}" value="${esc(r.name)}" aria-label="Nom de la pièce">
        <button type="button" class="btn btn-ghost btn-sm" data-edl="allgood:${ri}" title="Tout en bon état">✓ tout bon</button>
        <button type="button" class="btn btn-ghost btn-sm" data-edl="additem:${ri}">+ élément</button>
        <button type="button" class="btn btn-ghost btn-sm" data-edl="delroom:${ri}" aria-label="Retirer la pièce">🗑</button></div>
      <div class="elitems">${r.items.map((it,ii)=>`
        <div class="elitem ${it.entree&&it.entree!==it.etat?'changed':''}">
          <div class="eln">${esc(it.label)}${it.entree?`<span class="was">entrée : ${esc(it.entree)}</span>`:''}</div>
          <select data-k="etat:${ri}:${ii}" aria-label="État">${etats(it.etat)}</select>
          <input type="text" data-k="obs:${ri}:${ii}" value="${esc(it.obs)}" placeholder="Observation (rayure, tache, trou…)" aria-label="Observation">
          <label class="phbtn" title="Ajouter une photo">📷<input type="file" accept="image/*" capture="environment" multiple hidden data-ph-in="${ri}:${ii}"></label>
          ${it.photos.length?`<div class="phthumbs">${it.photos.map((p,pi)=>`<span class="phthumb"><img src="${PHCACHE[p]||''}" alt=""><button type="button" data-edl="delphoto:${ri}:${ii}" data-p="${pi}" aria-label="Retirer la photo">✕</button></span>`).join('')}</div>`:''}
        </div>`).join('')}</div>
    </div>`).join('');
  const inv=root.querySelector('#edlInv');
  if(EDL.d.inventaire){
    inv.innerHTML=`<h3 class="fsect">Inventaire du mobilier (logement meublé)</h3><p class="hint">Les 11 premiers éléments sont le minimum légal d'un meublé (décret n° 2015-981). S'il en manque un, le logement peut être requalifié en location vide.</p>
      <div class="invlist">${EDL.d.inventaire.map((i,k)=>`<div class="invrow"><span class="eln">${esc(i.label)}</span><input type="text" data-k="iq:${k}" value="${esc(i.qte)}" aria-label="Quantité" class="qte"><select data-k="ie:${k}" aria-label="État">${etats(i.etat)}</select><input type="text" data-k="io:${k}" value="${esc(i.obs)}" placeholder="Observation"><button type="button" class="linkbtn" data-edl="delinv:${k}" aria-label="Retirer">✕</button></div>`).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-edl="addinv">+ Ajouter un meuble ou équipement</button>`;
  } else inv.innerHTML='';
}
function edlCollect(root){
  if(!EDL) return;
  const f=formValues(root.querySelector('#edlForm')); ['date','heure','representant','compteurElec','elecNum','compteurGaz','gazNum','compteurEau','compteurEauChaude','chauffageEtat','chaudiereEntretien','cles','nouvelleAdresse','observations'].forEach(k=>{ if(k in f) EDL.d[k]=f[k]; });
  root.querySelectorAll('[data-k]').forEach(el=>{
    const p=el.dataset.k.split(':'); const v=el.value;
    if(p[0]==='room' && EDL.d.rooms[+p[1]]) EDL.d.rooms[+p[1]].name=v;
    if(p[0]==='etat' && EDL.d.rooms[+p[1]]) EDL.d.rooms[+p[1]].items[+p[2]].etat=v;
    if(p[0]==='obs' && EDL.d.rooms[+p[1]]) EDL.d.rooms[+p[1]].items[+p[2]].obs=v;
    if(EDL.d.inventaire && EDL.d.inventaire[+p[1]]){ if(p[0]==='iq') EDL.d.inventaire[+p[1]].qte=v; if(p[0]==='ie') EDL.d.inventaire[+p[1]].etat=v; if(p[0]==='io') EDL.d.inventaire[+p[1]].obs=v; }
  });
}
