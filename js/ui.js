/* =====================================================================================
   INTERFACE — navigation, écrans principaux. Principe : chaque écran répond à
   « qu'est-ce que je dois faire ? » ; les actions sont à un geste ; les termes juridiques
   sont expliqués au moment où on en a besoin.
   ===================================================================================== */
let UI = {view:'accueil', p:{}};
const NAV = [
  {k:'accueil', l:'Accueil', ic:'🏠'}, {k:'biens', l:'Mes biens', ic:'🔑'}, {k:'loyers', l:'Loyers', ic:'💶'},
  {k:'courriers', l:'Courriers', ic:'✉️'}, {k:'bilan', l:'Bilan & impôts', ic:'📊'}, {k:'aide', l:'Aide & guides', ic:'🧭'}, {k:'reglages', l:'Réglages', ic:'⚙️'}
];
const NAV_MOBILE = ['accueil','biens','loyers','courriers','plus'];

function go(view, p){ UI={view, p:p||{}}; try{ sessionStorage.setItem('cem-ui', JSON.stringify(UI)); }catch(e){} render(); window.scrollTo(0,0); }
function refresh(){ render(true); }
function render(keepScroll){
  const y=window.scrollY;
  const app=document.getElementById('app');
  const active = UI.view==='bien' ? 'biens' : UI.view;
  app.innerHTML = `
    <aside class="sidebar" aria-label="Menu">
      <div class="brand"><div class="mark" aria-hidden="true">🗝️</div><div><div class="name">Clef en Main</div><div class="sub">Gestion locative</div></div></div>
      <nav>${NAV.map(n=>`<button class="navitem ${active===n.k?'active':''}" onclick="go('${n.k}')" ${active===n.k?'aria-current="page"':''}><span aria-hidden="true">${n.ic}</span>${n.l}</button>`).join('')}</nav>
      <div class="sidebar-foot">${savedLabel()}<br>Version ${APP_VERSION} · règles du ${fdateCourt(REG.version)}</div>
    </aside>
    <main class="main" id="main"></main>
    <nav class="tabbar" aria-label="Menu principal">${NAV_MOBILE.map(k=>{ const n=NAV.find(x=>x.k===k)||{k:'plus', l:'Plus', ic:'☰'}; const on = k==='plus' ? ['bilan','aide','reglages'].includes(active) : active===k;
      return `<button class="${on?'on':''}" onclick="${k==='plus'?'openPlus()':`go('${k}')`}" ${on?'aria-current="page"':''}><span aria-hidden="true">${n.ic}</span>${n.l}</button>`; }).join('')}</nav>`;
  const m=document.getElementById('main');
  const screens={accueil:scrAccueil, biens:scrBiens, bien:scrBien, loyers:scrLoyers, courriers:scrCourriers, bilan:scrBilan, aide:scrAide, reglages:scrReglages};
  try{ (screens[UI.view]||scrAccueil)(m); }catch(e){ console.error(e); m.innerHTML=`<div class="card"><h2>Oups</h2><p>Cet écran n'a pas pu s'afficher.</p><button class="btn btn-ghost" onclick="go('accueil')">Retour à l'accueil</button></div>`; }
  bindAlertButtons(m);
  if(keepScroll) window.scrollTo(0,y);
}
function savedLabel(){ const s=STATE.settings.lastBackup; return s ? 'Dernière copie : '+fdateCourt(s.slice(0,10)) : '<span class="warnc">Aucune copie de sauvegarde</span>'; }
function openPlus(){
  openModal({title:'Plus', body:`<div class="menu-list">${['bilan','aide','reglages'].map(k=>{const n=NAV.find(x=>x.k===k); return `<button class="menu-item" data-k="${k}"><span>${n.ic}</span>${n.l}</button>`;}).join('')}
    <button class="menu-item" data-k="sauvegarde"><span>💾</span>Sauvegarde et autres appareils</button></div>`,
    onOpen:(bg,close)=>bg.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>{ close(); b.dataset.k==='sauvegarde'?openSauvegarde():go(b.dataset.k); })});
}
function pill(txt, c){ return `<span class="pill pill-${c||'grey'}">${txt}</span>`; }
function head(t, sub, right){ return `<div class="pagehead"><div><h1>${t}</h1>${sub?`<p>${sub}</p>`:''}</div>${right?`<div class="ph-right">${right}</div>`:''}</div>`; }
function bindAlertButtons(root){ root.querySelectorAll('[data-afn]').forEach(b=>b.onclick=()=>{ const f=ALERT_FN[b.dataset.afn]; if(f) f(); }); }
function alertCard(a, i){
  const acts=a.actions.map((ac,j)=>{ const k='a'+i+'_'+j; ALERT_FN[k]=ac.fn; return `<button class="btn btn-sm ${j===0?'btn-teal':'btn-ghost'}" data-afn="${k}">${ac.l}</button>`; }).join('');
  return `<div class="alert lv${a.niv}"><div class="alert-dot" aria-hidden="true"></div><div class="alert-body"><div class="alert-t">${esc(a.titre)}</div><div class="alert-d">${esc(a.texte)}</div>${acts?`<div class="btnrow">${acts}</div>`:''}</div></div>`;
}

/* =====================================================================================
   ACCUEIL
   ===================================================================================== */
function scrAccueil(m){
  const t=todayISO(); const mk=monthKey(t);
  if(!STATE.bailleurs.length && !STATE.biens.length){ return scrBienvenue(m); }
  const baux=bauxEnCours();
  let attendu=0, recu=0, impTot=0;
  const rows=baux.map(b=>{ const l=etatMois(b, mk); const c=compteLocatif(b); if(l){ attendu+=l.montant; recu+=l.paye; } if(c.solde>0) impTot+=c.solde; return {b, l, c}; });
  const alerts=computeAlerts();
  const urg=alerts.filter(a=>a.niv===1).length;
  m.innerHTML = head('Bonjour'+(STATE.bailleurs[0]&&STATE.bailleurs[0].prenom?' '+esc(STATE.bailleurs[0].prenom):''), fdate(t).replace(/^./,c=>c.toUpperCase())) + `
    <div class="kpis">
      <div class="kpi"><div class="k">Loyers de ${MOIS[parseISO(t).getMonth()]}</div><div class="v">${eur0(recu)} <small>/ ${eur0(attendu)}</small></div><div class="bar"><span style="width:${attendu?Math.min(100,recu/attendu*100):0}%"></span></div></div>
      <div class="kpi ${impTot>0?'bad':''}"><div class="k">Impayés en cours</div><div class="v">${eur0(impTot)}</div><div class="s">${impTot>0?'Voir les actions ci-dessous':'Tout est à jour'}</div></div>
      <div class="kpi"><div class="k">Biens</div><div class="v">${baux.length} loué${baux.length>1?'s':''} <small>/ ${biensActifs().length}</small></div><div class="s">${MAX_BIENS-biensActifs().length} emplacement(s) libre(s)</div></div>
    </div>
    <section><h2 class="sect">À faire ${urg?`<span class="badge">${urg} urgent${urg>1?'s':''}</span>`:''}</h2>
      ${alerts.length? `<div class="alerts">${alerts.slice(0,12).map(alertCard).join('')}</div>${alerts.length>12?`<p class="hint">+ ${alerts.length-12} autres points dans chaque bien.</p>`:''}` : `<div class="card empty small"><div class="ic">✅</div><p>Rien d'urgent. Tout est en ordre.</p></div>`}
    </section>
    ${rows.length?`<section><h2 class="sect">Ce mois-ci</h2><div class="card list">
      ${rows.map(({b,l,c})=>{ const bien=bienDe(b); const et=l?l.etat:'avenir';
        return `<div class="lrow"><div class="lmain" onclick="go('bien',{id:'${bien.id}',tab:'loyers'})"><b>${esc(nomsLocataires(b))}</b><span>${esc(nomBien(bien))}</span></div>
          <div class="lamt">${l?eur(l.montant):'—'}</div><div>${etatPill(et)}</div>
          <div class="lact">${et!=='paye'&&l?`<button class="btn btn-sm btn-teal" onclick="quickEncaisser('${b.id}','${mk}')">Encaissé</button>`:`<button class="btn btn-sm btn-ghost" onclick="openDoc('quittance','${b.id}',{mois:'${mk}'})">Quittance</button>`}</div></div>`; }).join('')}
    </div></section>`:''}
    <section><h2 class="sect">Raccourcis</h2><div class="grid3">
      ${tile('teal','💶','Encaisser un loyer','Noter un paiement reçu.', "openPaiement()")}
      ${tile('teal','🧾','Faire une quittance','Pour le mois payé.', "pickBail(id=>openDoc('quittance',id))")}
      ${tile('amber','➕','Ajouter un bien', biensActifs().length+' / '+MAX_BIENS+' emplacements utilisés.', "openBienForm()")}
      ${tile('brick','⏰','Relancer un impayé','Rappel, relance, mise en demeure.', "pickBail(id=>openDoc('relance',id))")}
      ${tile('teal','🧮','Ajouter une dépense','Taxe foncière, travaux, copropriété…', "openDepense()")}
      ${tile('amber','💾','Sauvegarder / autre appareil','Copie à ranger dans votre Drive / iCloud.', "openSauvegarde()")}
    </div></section>`;
}
function scrBienvenue(m){
  m.innerHTML = `<div class="hero">
    <div class="hero-ic" aria-hidden="true">🗝️</div>
    <h1>Gérez vos locations sans agence, sereinement</h1>
    <p>Contrats conformes à la loi, quittances, relances, révision du loyer, fin de bail, impôts : l'application vous guide pas à pas, par des questions simples. Jusqu'à ${MAX_BIENS} logements.</p>
    <ol class="steps big"><li><b>Vos coordonnées</b> de propriétaire (elles apparaissent sur les documents).</li><li><b>Votre logement</b> : adresse, surface, diagnostics.</li><li><b>La location</b> : l'assistant prépare le bail et vérifie qu'il respecte la loi.</li></ol>
    <div class="btnrow center"><button class="btn btn-amber btn-lg" onclick="openBailleurForm()">Commencer</button>
    <button class="btn btn-ghost" onclick="openSauvegarde('import')">J'ai déjà une sauvegarde</button></div>
    <p class="hint center">Vos données restent sur votre appareil. Rien n'est envoyé sur Internet.</p></div>`;
}
function tile(c, ic, t, d, on){ return `<button class="actiontile ${c}" onclick="${on}"><div class="ic" aria-hidden="true">${ic}</div><div class="t">${t}</div><div class="d">${d}</div></button>`; }
function etatPill(et){ return {paye:pill('Payé','teal'), partiel:pill('Partiel','amber'), impaye:pill('Impayé','brick'), avenir:pill('À venir','grey'), avoir:pill('Avoir','teal')}[et]||''; }
function pickBail(cb, filtre){
  const baux=(filtre? STATE.baux.filter(filtre) : bauxEnCours().concat(STATE.baux.filter(b=>b.statut==='sortie')));
  if(!baux.length){ toast('Aucun bail en cours.'); return; }
  if(baux.length===1) return cb(baux[0].id);
  openModal({title:'Quel locataire ?', body:`<div class="menu-list">${baux.map(b=>`<button class="menu-item" data-id="${b.id}"><span>🏠</span><div><b>${esc(nomsLocataires(b))}</b><br><small>${esc(nomBien(bienDe(b)))}</small></div></button>`).join('')}</div>`,
    onOpen:(bg,close)=>bg.querySelectorAll('.menu-item').forEach(x=>x.onclick=()=>{ close(); cb(x.dataset.id); })});
}

/* =====================================================================================
   MES BIENS — 6 emplacements
   ===================================================================================== */
function scrBiens(m){
  const actifs=biensActifs(); const arch=STATE.biens.filter(b=>b.statut==='archive');
  const slots=[];
  actifs.forEach(b=>slots.push(bienCard(b)));
  for(let i=actifs.length;i<MAX_BIENS;i++) slots.push(`<button class="slot-empty" onclick="openBienForm()"><span>＋</span>Emplacement libre<small>Ajouter un logement</small></button>`);
  m.innerHTML = head('Mes biens', `${actifs.length} sur ${MAX_BIENS} emplacements utilisés. Un emplacement correspond à un logement : quand un bail se termine, le logement reste et peut être reloué ; l'ancien bail est archivé dans son historique.`) +
    `<div class="slots">${slots.join('')}</div>
    ${arch.length?`<details class="card arch"><summary>Biens archivés (${arch.length}) — vendus ou retirés de la location</summary><div class="list">${arch.map(b=>`<div class="lrow"><div class="lmain" onclick="go('bien',{id:'${b.id}'})"><b>${esc(nomBien(b))}</b><span>${esc(adresseBien(b))}</span></div><div class="lact"><button class="btn btn-sm btn-ghost" onclick="reactiverBien('${b.id}')">Réactiver</button></div></div>`).join('')}</div></details>`:''}`;
}
function bienCard(b){
  const bail=bailCourant(b.id); const st=bail?STATUTS_BAIL[bail.statut]:{l:'Libre',c:'amber'};
  let info='';
  if(bail && ['actif','preavis'].includes(bail.statut)){ const c=compteLocatif(bail); info=`<div class="bc-meta"><span>${eur(totalMensuel(bail))}/mois</span>${c.solde>0.01?`<span class="neg">Dû : ${eur(c.solde)}</span>`:'<span class="pos">À jour</span>'}</div>`; }
  return `<div class="bcard" onclick="go('bien',{id:'${b.id}'})" tabindex="0" role="button" onkeydown="if(event.key==='Enter')this.click()">
    <div class="bc-top"><div class="bc-ic" aria-hidden="true">${b.type==='Maison'?'🏡':'🏢'}</div>${pill(st.l, st.c)}</div>
    <h3>${esc(nomBien(b))}</h3><div class="bc-addr">${esc(adresseBien(b))}</div>
    <div class="bc-loc">${bail?'👤 '+esc(nomsLocataires(bail))+' · '+TYPES_BAIL[bail.type].court:'Aucun locataire'}</div>${info}
    ${dpeClasse(b)?`<span class="dpe dpe-${dpeClasse(b)}" title="Classe DPE">${dpeClasse(b)}</span>`:''}</div>`;
}
async function reactiverBien(id){
  if(biensActifs().length>=MAX_BIENS){ toast('Les 6 emplacements sont occupés : archivez d\'abord un autre bien.'); return; }
  const b=byId('biens',id); b.statut='actif'; upsert('biens',b); refresh();
}

/* =====================================================================================
   FICHE D'UN BIEN
   ===================================================================================== */
const BIEN_TABS=[['location','Location'],['loyers','Loyers'],['docs','Documents'],['depenses','Dépenses'],['infos','Le logement'],['historique','Historique']];
function scrBien(m){
  const bien=byId('biens', UI.p.id); if(!bien){ go('biens'); return; }
  const tab=UI.p.tab||'location'; const bail=bailCourant(bien.id);
  m.innerHTML = `<button class="btn btn-ghost btn-sm back" onclick="go('biens')">← Mes biens</button>`+
    head(esc(nomBien(bien)), esc(adresseBien(bien))+(bien.statut==='archive'?' · '+pill('Archivé','grey'):''), bail?pill(STATUTS_BAIL[bail.statut].l, STATUTS_BAIL[bail.statut].c):pill('Libre','amber')) +
    `<div class="tabs" role="tablist">${BIEN_TABS.map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" class="${tab===k?'on':''}" onclick="go('bien',{id:'${bien.id}',tab:'${k}'})">${l}</button>`).join('')}</div><div id="tabArea"></div>`;
  const a=m.querySelector('#tabArea');
  ({location:tabLocation, loyers:tabLoyers, docs:tabDocs, depenses:tabDepenses, infos:tabInfos, historique:tabHistorique}[tab]||tabLocation)(a, bien, bail);
}
function tabLocation(a, bien, bail){
  if(!bail){
    const ctl=controlesBail({type:'vide', dateDebut:todayISO(), loyerHC:0, depot:0, bailleurId:bien.bailleurId}, bien).filter(c=>c.lv!=='ok' && !/Dépôt|loyer/i.test(c.t));
    a.innerHTML = `<div class="card cta"><div><h2>Ce logement est libre</h2><p>L'assistant vous pose quelques questions simples, choisit le bon type de bail (vide, meublé, étudiant, mobilité), vérifie le loyer, le dépôt de garantie et les diagnostics, puis prépare tous les documents.</p></div>
      <button class="btn btn-amber btn-lg" onclick="startAssistantBail('${bien.id}')">Louer ce logement</button></div>
      ${ctl.length?`<div class="card"><h3>Avant de louer, vérifiez</h3><ul class="checks">${ctl.map(c=>`<li class="${c.lv}">${esc(c.t)}</li>`).join('')}</ul><button class="btn btn-ghost btn-sm" onclick="go('bien',{id:'${bien.id}',tab:'infos'})">Compléter la fiche du logement</button></div>`:''}
      <div class="card"><h3>Trouver un locataire</h3><p>Pièces que vous pouvez demander au candidat (et aucune autre) :</p><ul>${REG.piecesCandidat.map(p=>'<li>'+esc(p)+'</li>').join('')}</ul>
      <details><summary>Pièces interdites (amende jusqu'à 3 000 €)</summary><ul>${REG.piecesInterdites.map(p=>'<li>'+esc(p)+'</li>').join('')}</ul></details>
      <p class="hint">La sélection ne doit reposer sur aucun critère discriminatoire (origine, sexe, situation de famille, état de santé…). Pensez à la garantie Visale (gratuite, Action Logement) ou à la caution.</p></div>`;
    return;
  }
  const x=ctxBail(bail.id); const c=compteLocatif(bail); const rv=revisionInfo(bail); const ech=echeanceBail(bail); const cg=dateLimiteCongeBailleur(bail);
  const l=loyerA(bail, todayISO());
  a.innerHTML = `${bail.statut==='brouillon'?`<div class="infobox warn"><b>Bail en préparation.</b> Imprimez-le, signez-le avec le locataire, puis indiquez-le ici : les loyers commenceront à être suivis. <div class="btnrow"><button class="btn btn-teal btn-sm" onclick="marquerSigne('${bail.id}')">Le bail est signé</button><button class="btn btn-ghost btn-sm" onclick="openDoc('contrat_bail','${bail.id}')">Imprimer le bail</button><button class="btn btn-ghost btn-sm" onclick="editBail('${bail.id}')">Modifier</button><button class="btn btn-ghost btn-sm" onclick="supprimerBail('${bail.id}')">Abandonner</button></div></div>`:''}
    ${bail.statut==='sortie'?`<div class="card cta brick"><div><h2>Le locataire est parti</h2><p>Dernières étapes : état des lieux de sortie, restitution du dépôt (${restitutionInfo(bail)?'avant le '+fdate(restitutionInfo(bail).limite):'1 mois, ou 2 mois en cas de dégradations'}), solde du compte. Le bail sera ensuite archivé automatiquement ; le logement est déjà disponible pour un nouveau bail.</p></div>
      <div class="btnrow"><button class="btn btn-ghost" onclick="openEDL('${bail.id}','sortie')">État des lieux</button><button class="btn btn-ghost" onclick="openDoc('restitution_depot','${bail.id}')">Restituer le dépôt</button><button class="btn btn-brick" onclick="clotureManuelle('${bail.id}')">Clôturer le bail</button><button class="btn btn-amber" onclick="startAssistantBail('${bien.id}')">Préparer le bail suivant</button></div></div>`:''}
    <div class="grid2">
      <div class="card"><h3>Le bail</h3><dl class="dl">
        <dt>Locataire(s)</dt><dd>${x.locs.map(lo=>esc(nomPersonne(lo))+(lo.tel?' · '+esc(lo.tel):'')+(lo.email?` · <a href="mailto:${esc(lo.email)}">${esc(lo.email)}</a>`:'')).join('<br>')}</dd>
        <dt>Type</dt><dd>${TYPES_BAIL[bail.type].l}</dd>
        <dt>Début</dt><dd>${fdate(bail.dateDebut)}</dd>
        <dt>${bail.statut==='sortie'?'Fin du bail':reconductible(bail)?'Prochaine échéance':'Fin du bail'}</dt><dd>${fdate(bail.statut==='sortie'&&bail.fin?bail.fin.date:ech)}${cg&&bail.statut==='actif'?`<br><small>Congé du bailleur possible jusqu'au ${fdate(cg.limite)}</small>`:''}</dd>
        ${bail.statut==='preavis'?`<dt>Départ prévu</dt><dd><b>${fdate(bail.fin.date)}</b> (${esc(bail.fin.motif||'')})</dd>`:''}
        <dt>Garant(s)</dt><dd>${(bail.garants||[]).map(g=>g.type==='visale'?'Visale'+(g.visa?' n° '+esc(g.visa):''):esc(nomPersonne(g)||g.libelle||'—')).join(', ')||'Aucun'}</dd>
        <dt>Assurance du locataire</dt><dd>${bail.assuranceEcheance?(bail.assuranceEcheance<todayISO()?'<span class="neg">Expirée le '+fdate(bail.assuranceEcheance)+'</span>':'Valable jusqu\'au '+fdate(bail.assuranceEcheance)):'<span class="neg">Non fournie</span>'} <button class="linkbtn" onclick="openAssurance('${bail.id}')">mettre à jour</button></dd>
      </dl><div class="btnrow"><button class="btn btn-ghost btn-sm" onclick="editBail('${bail.id}')">Modifier les informations</button></div></div>
      <div class="card"><h3>L'argent</h3><dl class="dl">
        <dt>Loyer hors charges</dt><dd>${eur(l.loyerHC)}</dd>
        <dt>${bail.chargesType==='forfait'?'Forfait de charges':'Provision pour charges'}</dt><dd>${eur(l.charges)}</dd>
        <dt>Total mensuel</dt><dd><b>${eur(l.loyerHC+l.charges)}</b> — le ${esc(bail.jourPaiement||1)} du mois</dd>
        <dt>Dépôt de garantie</dt><dd>${eur(bail.depot)}</dd>
        <dt>Solde du compte</dt><dd>${c.solde>0.01?`<span class="neg">${eur(c.solde)} dus</span>`:c.solde<-0.01?`<span class="pos">${eur(-c.solde)} d'avance</span>`:'<span class="pos">À jour</span>'}</dd>
        <dt>Révision IRL</dt><dd>${rv.possible?(rv.dejaFaite?'Faite cette année':(rv.publie?`Possible ${rv.enRetard?'dès maintenant':'le '+fdate(rv.anniversaire)} : ${eur(rv.nouveau)}`:'Prochain indice pas encore publié')):esc(rv.raison)}</dd>
      </dl><div class="btnrow"><button class="btn btn-teal btn-sm" onclick="openPaiement('${bail.id}')">Encaisser</button><button class="btn btn-ghost btn-sm" onclick="go('bien',{id:'${bien.id}',tab:'loyers'})">Compte détaillé</button></div></div>
    </div>
    <h2 class="sect">Que voulez-vous faire ?</h2>
    ${docsLibraryHtml(bail)}
    <h2 class="sect">E-mails types</h2>
    <div class="chips">${Object.keys(MAILS).map(k=>`<button class="chip" onclick="openMailType('${bail.id}','${k}')">${MAILS[k].l}</button>`).join('')}</div>
    ${['actif','preavis'].includes(bail.statut)?`<h2 class="sect">Fin du bail</h2><div class="grid3">
      ${tile('brick','📩','Le locataire donne congé','Calcule la date de départ et organise la sortie.', `openDoc('accuse_conge','${bail.id}')`)}
      ${reconductible(bail)?tile('brick','📤','Je veux récupérer le logement','Vente, reprise, motif sérieux : délais vérifiés.', `openDoc('conge_bailleur','${bail.id}')`):''}
      ${tile('brick','🤝','Départ d\'un commun accord','Résiliation amiable à une date choisie.', `openDoc('resiliation_amiable','${bail.id}')`)}
      ${tile('brick','🕯️','Décès ou abandon du logement','Ce que prévoit la loi (transfert du bail, procédure).', "openGuide('deces')")}
    </div>`:''}`;
}
function docsLibraryHtml(bail){
  const x=ctxBail(bail.id);
  return GROUPES_DOCS.map(([g,l,c])=>{
    const items=Object.keys(DOCS).filter(k=>DOCS[k].g===g && !['solde','conge'].includes(k) && (!DOCS[k].show || DOCS[k].show(x)));
    if(!items.length) return '';
    return `<details class="docgroup" ${['mois','incident'].includes(g)&&['actif','preavis'].includes(bail.statut)?'open':''}${g==='entree'&&bail.statut==='brouillon'?' open':''}${g==='sortie'&&bail.statut==='sortie'?' open':''}><summary>${l} <small>(${items.length})</small></summary><div class="grid3">${items.map(k=>tile(c, DOCS[k].ic, DOCS[k].l, DOCS[k].d, `openDoc('${k}','${bail.id}')`)).join('')}</div></details>`;
  }).join('');
}
async function marquerSigne(bailId){
  const b=byId('baux',bailId);
  openModal({title:'Le bail est signé', body:formHtml([{n:'dateSignature', l:'Date de signature', t:'date', v:b.dateSignature||todayISO()},{n:'info', t:'info', l:'Dès maintenant : faites l\'état des lieux d\'entrée, remettez les annexes contre récépissé et demandez l\'attestation d\'assurance.'}]),
    actions:[{label:'Annuler'},{label:'Confirmer', cls:'btn-teal', onClick:(c,bg)=>{ const v=formValues(bg); b.dateSignature=v.dateSignature; b.statut='actif'; upsert('baux',b); toast('Bail en cours : les loyers sont suivis.'); refresh(); }}]});
}
async function supprimerBail(bailId){
  const b=byId('baux',bailId);
  if(!(await confirmBox('Abandonner ce bail ?', 'Le bail en préparation et ses documents seront placés dans la corbeille (récupérables 30 jours). Le logement redevient libre.', 'Abandonner', true))) return;
  STATE.docs.filter(d=>d.bailId===bailId).forEach(d=>softDelete('docs', d.id, 'Document'));
  softDelete('baux', bailId, 'Bail '+nomsLocataires(b)); refresh();
}
async function clotureManuelle(bailId){
  const b=byId('baux',bailId); const c=compteLocatif(b);
  const pb=[]; if(!STATE.docs.some(d=>d.bailId===bailId && d.type==='etat_lieux_sortie')) pb.push('aucun état des lieux de sortie enregistré'); if(!(b.fin||{}).depotRestitueLe && b.type!=='mobilite' && num(b.depot)>0) pb.push('dépôt de garantie non restitué'); if(Math.abs(c.solde)>=0.01) pb.push('compte non soldé ('+eur(c.solde)+')');
  if(await confirmBox('Clôturer et archiver ce bail ?', (pb.length?'<p class="neg">Attention : '+pb.join(', ')+'.</p>':'')+'<p>Le bail passe dans l\'<b>historique</b> du logement : rien n\'est effacé (documents, paiements, photos restent consultables et dans vos sauvegardes). Conservez-les au moins '+R('conservBail')+' ans (prescription) et '+R('conservFiscal')+' ans pour les pièces fiscales.</p>', 'Clôturer')){ cloturerBail(b); toast('Bail archivé.'); refresh(); }
}

/* ---- Onglet Loyers d'un bien ---- */
function tabLoyers(a, bien, bail){
  const baux=bauxDuBien(bien.id).filter(b=>b.statut!=='brouillon');
  const sel = UI.p.bail ? byId('baux', UI.p.bail) : (bail && bail.statut!=='brouillon' ? bail : baux[0]);
  if(!sel){ a.innerHTML='<div class="card empty"><p>Aucun bail signé pour ce logement.</p></div>'; return; }
  const c=compteLocatif(sel);
  const lignes=[...c.lignes].reverse();
  a.innerHTML = `${baux.length>1?`<div class="field inline"><label>Bail</label><select onchange="go('bien',{id:'${bien.id}',tab:'loyers',bail:this.value})">${baux.map(b=>`<option value="${b.id}" ${b.id===sel.id?'selected':''}>${esc(nomsLocataires(b))} — depuis ${fdateCourt(b.dateDebut)} (${STATUTS_BAIL[b.statut].l})</option>`).join('')}</select></div>`:''}
    <div class="kpis"><div class="kpi"><div class="k">Total dû à ce jour</div><div class="v">${eur(c.du)}</div></div><div class="kpi"><div class="k">Total payé</div><div class="v">${eur(c.paye)}</div></div>
      <div class="kpi ${c.solde>0.01?'bad':''}"><div class="k">Solde</div><div class="v">${c.solde>0.01?eur(c.solde)+' dus':c.solde<-0.01?eur(-c.solde)+' d\'avance':'À jour'}</div></div></div>
    <div class="btnrow"><button class="btn btn-teal" onclick="openPaiement('${sel.id}')">+ Encaisser un paiement</button><button class="btn btn-ghost" onclick="openExtra('${sel.id}')">+ Somme due ou avoir</button><button class="btn btn-ghost" onclick="printReleve('${sel.id}')">🖨️ Relevé de compte</button></div>
    <div class="card list tablewrap"><table class="tbl"><thead><tr><th>Échéance</th><th class="num">Dû</th><th class="num">Payé</th><th>État</th><th></th></tr></thead><tbody>
      ${lignes.map(l=>`<tr><td>${esc(l.label)}<br><small>exigible le ${fdateCourt(l.due)}</small></td><td class="num">${eur(l.montant)}</td><td class="num">${eur(l.paye)}</td><td>${etatPill(l.etat)}</td>
        <td class="right">${l.kind==='loyer'&&l.etat==='paye'?`<button class="btn btn-sm btn-ghost" onclick="openDoc('quittance','${sel.id}',{mois:'${l.key}'})">Quittance</button>`:''}${l.kind==='loyer'&&['impaye','partiel'].includes(l.etat)?`<button class="btn btn-sm btn-teal" onclick="quickEncaisser('${sel.id}','${l.key}')">Encaissé</button>`:''}${l.kind==='extra'?`<button class="linkbtn" onclick="delExtra('${sel.id}','${l.id}')">retirer</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5">Aucune échéance.</td></tr>'}
    </tbody></table></div>
    <h3 class="sect">Paiements reçus</h3>
    <div class="card list">${c.paiements.length?[...c.paiements].reverse().map(p=>`<div class="lrow"><div class="lmain"><b>${eur(p.montant)}</b><span>${fdate(p.date)} · ${esc(p.mode||'')}${p.origine&&p.origine!=='locataire'?' · '+esc({caf:'CAF/MSA',garant:'Caution',visale:'Visale'}[p.origine]||p.origine):''}${p.note?' · '+esc(p.note):''}</span></div><div class="lact"><button class="linkbtn" onclick="openPaiement('${sel.id}','${p.id}')">modifier</button></div></div>`).join(''):'<p class="muted pad">Aucun paiement enregistré.</p>'}</div>
    <p class="hint">Les paiements sont imputés sur les échéances les plus anciennes (article 1342-10 du Code civil). Aucune pénalité de retard ni frais de relance ne peuvent être facturés au locataire (article 4 de la loi de 1989).</p>`;
}
function quickEncaisser(bailId, mk){
  const b=byId('baux',bailId); const l=etatMois(b, mk) || echeancesBail(b, monthLast(mk)).find(e=>e.key===mk);
  const reste = l ? (l.reste!==undefined? l.reste : l.montant) : totalMensuel(b);
  upsert('paiements', {id:uid('pa'), bailId, date:todayISO(), montant:r2(reste), mode:b.modePaiement||'virement', origine:'locataire', note:'Loyer '+monthLabel(mk)});
  toast('Paiement de '+eur(reste)+' enregistré.');
  refresh();
  setTimeout(()=>{ const e=etatMois(b, mk); if(e && e.etat==='paye') toastAction('Envoyer la quittance de '+monthLabel(mk)+' ?', 'Quittance', ()=>openDoc('quittance', bailId, {mois:mk})); }, 300);
}
function toastAction(msg, label, fn){
  const t=document.createElement('div'); t.className='toast withact'; t.innerHTML=`<span>${esc(msg)}</span><button>${esc(label)}</button>`;
  t.querySelector('button').onclick=()=>{ t.remove(); fn(); }; document.body.appendChild(t); setTimeout(()=>t.remove(), 7000);
}
function openPaiement(bailId, payId){
  if(!bailId) return pickBail(id=>openPaiement(id));
  const b=byId('baux',bailId); const p=payId?byId('paiements',payId):null; const c=compteLocatif(b);
  const def = p ? p.montant : (c.solde>0 ? c.solde : totalMensuel(b));
  openModal({title:p?'Modifier le paiement':'Encaisser un paiement', body:`<p class="muted">${esc(nomsLocataires(b))} — solde actuel : ${c.solde>0?eur(c.solde)+' dus':'à jour'}</p>`+formHtml([
    {n:'montant', l:'Montant reçu (€)', t:'number', v:def, req:true, col:2}, {n:'date', l:'Date de réception', t:'date', v:p?p.date:todayISO(), req:true, col:2},
    {n:'mode', l:'Mode', t:'select', v:p?p.mode:(b.modePaiement||'virement'), o:[['virement','Virement'],['prélèvement','Prélèvement'],['chèque','Chèque'],['espèces','Espèces'],['autre','Autre']], col:2},
    {n:'origine', l:'Payé par', t:'select', v:p?p.origine:'locataire', o:[['locataire','Le locataire'],['caf','CAF / MSA (aide au logement)'],['garant','La caution'],['visale','Visale'],['autre','Autre']], col:2},
    {n:'note', l:'Note (facultatif)', t:'text', v:p?p.note:''}
    ],'pa'),
    actions:[ ...(p?[{label:'Supprimer', cls:'btn-ghost danger', onClick:async()=>{ if(await confirmBox('Supprimer ce paiement ?','Il ira dans la corbeille (récupérable 30 jours).','Supprimer',true)){ softDelete('paiements', p.id, 'Paiement '+eur(p.montant)); refresh(); } }}]:[]),
      {label:'Annuler'}, {label:'Enregistrer', cls:'btn-teal', onClick:(cl,bg)=>{ if(!formCheckRequired(bg)) return false; const v=formValues(bg); if(!(num(v.montant)>0)){ toast('Montant invalide.'); return false; }
        upsert('paiements', Object.assign(p||{id:uid('pa'), bailId}, {montant:r2(num(v.montant)), date:v.date, mode:v.mode, origine:v.origine, note:v.note})); toast('Paiement enregistré.'); refresh(); }} ]});
}
function openExtra(bailId){
  openModal({title:'Ajouter une somme due ou un avoir', body:formHtml([
    {n:'sens', l:'Type', t:'radio', v:'du', o:[['du','Somme due par le locataire'],['avoir','Avoir / remboursement en sa faveur']]},
    {n:'libelle', l:'Libellé', t:'text', req:true, ph:'Ex. : régularisation de charges 2025, réparation facturée…'}, {n:'montant', l:'Montant (€)', t:'number', req:true, col:2}, {n:'date', l:'Date', t:'date', v:todayISO(), col:2},
    {n:'info', t:'info', l:'Interdit : pénalités de retard, frais de relance, frais de quittance, amendes (article 4 de la loi de 1989).'}],'ex'),
    actions:[{label:'Annuler'},{label:'Ajouter', cls:'btn-teal', onClick:(c,bg)=>{ if(!formCheckRequired(bg)) return false; const v=formValues(bg); const b=byId('baux',bailId); b.extras=b.extras||[]; b.extras.push({id:uid('ex'), date:v.date, libelle:v.libelle, montant: v.sens==='avoir'?-Math.abs(num(v.montant)):Math.abs(num(v.montant))}); upsert('baux',b); refresh(); }}]});
}
function delExtra(bailId, id){ const b=byId('baux',bailId); b.extras=(b.extras||[]).filter(e=>e.id!==id); upsert('baux',b); refresh(); }
function printReleve(bailId){
  const x=ctxBail(bailId); const c=compteLocatif(x.bail);
  let cumul=0; const evts=[]; c.lignes.filter(l=>l.due<=todayISO()).forEach(l=>evts.push({d:l.due, lib:l.label, debit:l.montant>0?l.montant:0, credit:l.montant<0?-l.montant:0}));
  c.paiements.forEach(p=>evts.push({d:p.date, lib:'Paiement '+(p.mode||''), debit:0, credit:num(p.montant)})); evts.sort((a,b)=>a.d.localeCompare(b.d));
  const html=`<div class="docsheet"><div class="letterhead"><div>${blocExp(x.bl)}</div><div class="right">${esc(nomsLocataires(x.bail))}<br>${esc(adresseBien(x.bien))}</div></div><h1>Relevé du compte locatif</h1><p class="small">Arrêté au ${fdate(todayISO())}</p>
    <table><tr><th>Date</th><th>Libellé</th><th class="num">Dû</th><th class="num">Payé</th><th class="num">Solde</th></tr>${evts.map(e=>{ cumul=r2(cumul+e.debit-e.credit); return `<tr><td>${fdateCourt(e.d)}</td><td>${esc(e.lib)}</td><td class="num">${e.debit?eur(e.debit):''}</td><td class="num">${e.credit?eur(e.credit):''}</td><td class="num">${eur(cumul)}</td></tr>`; }).join('')}
    <tr class="tot"><td colspan="4">${c.solde>0?'Reste dû':'Solde'}</td><td class="num">${eur(c.solde)}</td></tr></table></div>`;
  previewDoc(html, 'Relevé de compte');
}

/* ---- Documents d'un bien ---- */
function tabDocs(a, bien){
  const docs=STATE.docs.filter(d=>d.bienId===bien.id || bauxDuBien(bien.id).some(b=>b.id===d.bailId)).sort((x,y)=>(y.createdAt+y.id).localeCompare(x.createdAt+x.id));
  const q=(UI.p.q||'').toLowerCase();
  const list=docs.filter(d=>!q || ((DOCS[d.type]||{}).l||'').toLowerCase().includes(q) || nomsLocataires(byId('baux',d.bailId)||{}).toLowerCase().includes(q));
  a.innerHTML = `<div class="field"><input type="search" placeholder="Rechercher un document…" value="${esc(UI.p.q||'')}" oninput="UI.p.q=this.value; clearTimeout(window._qt); window._qt=setTimeout(()=>{refresh(); const s=document.querySelector('input[type=search]'); if(s){s.focus(); s.setSelectionRange(s.value.length,s.value.length);}},350)" aria-label="Rechercher"></div>
    ${list.length?`<div class="doclist">${list.map(d=>docRow(d)).join('')}</div>`:'<div class="card empty"><div class="ic">🗂️</div><p>Aucun document pour l\'instant.</p></div>'}`;
}
function docRow(d){
  const def=DOCS[d.type]||{l:d.type, ic:'📄'}; const b=byId('baux',d.bailId);
  const env=(d.envois||[]).slice(-1)[0];
  return `<div class="docrow"><div class="di"><div class="swatch" aria-hidden="true">${def.ic}</div><div><div class="t">${esc(def.l)}${d.data&&d.data.mois?' — '+monthLabel(d.data.mois):''}${d.data&&d.data.annee?' '+esc(d.data.annee):''}</div>
    <div class="s">${b?esc(nomsLocataires(b))+' · ':''}${fdate(d.createdAt)}${env?' · envoyé ('+esc({mail:'e-mail',lrar:'recommandé',simple:'courrier',main:'main propre',pdf:'PDF',print:'imprimé',cj:'commissaire'}[env.canal]||env.canal)+') le '+fdateCourt(env.date.slice(0,10)):' · <span class="warnc">pas encore envoyé</span>'}</div></div></div>
    <div class="btnrow nowrap"><button class="btn btn-sm btn-teal" onclick="openEnvoi('${d.id}')">Ouvrir / envoyer</button><button class="linkbtn" onclick="delDoc('${d.id}')" aria-label="Supprimer">🗑</button></div></div>`;
}
async function delDoc(id){ const d=byId('docs',id); if(await confirmBox('Supprimer ce document ?','Il sera placé dans la corbeille pendant 30 jours. Les documents envoyés servent de preuve : ne les supprimez qu\'en cas d\'erreur.','Supprimer',true)){ softDelete('docs', id, (DOCS[d.type]||{}).l||'Document'); refresh(); } }

/* ---- Dépenses ---- */
function tabDepenses(a, bien){
  const an=UI.p.annee||String(parseISO(todayISO()).getFullYear());
  const deps=STATE.depenses.filter(d=>d.bienId===bien.id && (d.date||'').slice(0,4)===an).sort((x,y)=>y.date.localeCompare(x.date));
  const tot=deps.reduce((s,d)=>s+num(d.montant),0), rec=deps.reduce((s,d)=>s+partRecuperable(d),0);
  const years=[...new Set(STATE.depenses.filter(d=>d.bienId===bien.id).map(d=>d.date.slice(0,4)).concat([an, String(parseISO(todayISO()).getFullYear())]))].sort().reverse();
  a.innerHTML = `<div class="btnrow"><select onchange="go('bien',{id:'${bien.id}',tab:'depenses',annee:this.value})" aria-label="Année">${years.map(y=>`<option ${y===an?'selected':''}>${y}</option>`).join('')}</select><button class="btn btn-teal" onclick="openDepense('${bien.id}')">+ Ajouter une dépense</button></div>
    <div class="kpis"><div class="kpi"><div class="k">Dépenses ${an}</div><div class="v">${eur(tot)}</div></div><div class="kpi"><div class="k">dont récupérable sur le locataire</div><div class="v">${eur(rec)}</div></div><div class="kpi"><div class="k">À votre charge</div><div class="v">${eur(tot-rec)}</div></div></div>
    <div class="card list">${deps.length?deps.map(d=>`<div class="lrow"><div class="lmain" onclick="openDepense('${bien.id}','${d.id}')"><b>${esc((CAT_DEPENSES[d.categorie]||{}).l||d.categorie)}</b><span>${fdate(d.date)}${d.libelle?' · '+esc(d.libelle):''}${partRecuperable(d)?' · récupérable : '+eur(partRecuperable(d)):''}</span></div><div class="lamt">${eur(d.montant)}</div></div>`).join(''):'<p class="muted pad">Aucune dépense en '+an+'. Enregistrez taxe foncière, charges de copropriété, assurance, travaux, intérêts d\'emprunt : elles servent à la régularisation des charges et à votre déclaration de revenus.</p>'}</div>
    <p class="hint">Conservez les factures ${R('conservFiscal')} ans (contrôle fiscal). Charges récupérables : liste limitative du décret n° 87-713 (eau, entretien des parties communes et ascenseur, TEOM, chauffage collectif…).</p>`;
}
function openDepense(bienId, depId){
  if(!bienId){ const bs=biensActifs(); if(!bs.length){ toast('Ajoutez d\'abord un bien.'); return; } if(bs.length===1) return openDepense(bs[0].id);
    return openModal({title:'Pour quel bien ?', body:`<div class="menu-list">${bs.map(b=>`<button class="menu-item" data-id="${b.id}"><span>🏠</span>${esc(nomBien(b))}</button>`).join('')}</div>`, onOpen:(bg,close)=>bg.querySelectorAll('.menu-item').forEach(x=>x.onclick=()=>{ close(); openDepense(x.dataset.id); })}); }
  const d=depId?byId('depenses',depId):null;
  const m=openModal({title:d?'Modifier la dépense':'Nouvelle dépense', body:formHtml([
    {n:'categorie', l:'Nature', t:'select', v:d?d.categorie:'taxe_fonciere', o:Object.keys(CAT_DEPENSES).map(k=>[k, CAT_DEPENSES[k].l])},
    {n:'montant', l:'Montant TTC (€)', t:'number', v:d?d.montant:'', req:true, col:2}, {n:'date', l:'Date de paiement', t:'date', v:d?d.date:todayISO(), req:true, col:2},
    {n:'recupPct', l:'Part récupérable sur le locataire (%)', t:'number', v:d&&d.recupPct!==undefined?d.recupPct:'', h:'Laisser vide pour la valeur habituelle. Charges de copropriété : indiquez la part récupérable figurant sur le décompte du syndic (souvent 40 à 70 %).', col:2},
    {n:'libelle', l:'Détail (facultatif)', t:'text', v:d?d.libelle:'', col:2}],'dp'),
    actions:[ ...(d?[{label:'Supprimer', cls:'btn-ghost danger', onClick:async()=>{ if(await confirmBox('Supprimer cette dépense ?','Elle ira dans la corbeille.','Supprimer',true)){ softDelete('depenses', d.id, 'Dépense'); refresh(); } }}]:[]),
      {label:'Annuler'}, {label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ if(!formCheckRequired(bg)) return false; const v=formValues(bg);
        upsert('depenses', Object.assign(d||{id:uid('dp'), bienId}, {categorie:v.categorie, montant:r2(num(v.montant)), date:v.date, recupPct:v.recupPct===''?undefined:num(v.recupPct), libelle:v.libelle})); toast('Dépense enregistrée.'); refresh(); }} ]});
  const sel=m.el.querySelector('[name=categorie]'); const pct=m.el.querySelector('[name=recupPct]');
  const upd=()=>{ if(!d || d.recupPct===undefined) pct.placeholder = (CAT_DEPENSES[sel.value].recup===null?'à préciser':CAT_DEPENSES[sel.value].recup+' %'); }; sel.onchange=upd; upd();
}

/* ---- Historique ---- */
function tabHistorique(a, bien){
  const baux=bauxDuBien(bien.id);
  a.innerHTML = `<p class="hint">Tous les baux de ce logement, en cours et terminés. Un bail terminé n'est jamais effacé automatiquement : il reste consultable ici (documents, paiements, photos) et figure dans vos sauvegardes.</p>
    <div class="card list">${baux.length?baux.map(b=>{ const c=compteLocatif(b); return `<div class="lrow"><div class="lmain" onclick="go('bien',{id:'${bien.id}',tab:'loyers',bail:'${b.id}'})"><b>${esc(nomsLocataires(b))}</b><span>${TYPES_BAIL[b.statut==='brouillon'?b.type:b.type].court} · du ${fdateCourt(b.dateDebut)}${b.fin&&b.fin.date?' au '+fdateCourt(b.fin.date):''} · ${STATE.docs.filter(d=>d.bailId===b.id).length} document(s)${Math.abs(c.solde)>0.01?' · solde '+eur(c.solde):''}</span></div><div>${pill(STATUTS_BAIL[b.statut].l, STATUTS_BAIL[b.statut].c)}</div>
      <div class="lact">${b.statut==='termine'?`<button class="linkbtn" onclick="supprimerBailArchive('${b.id}')">supprimer…</button>`:''}</div></div>`; }).join(''):'<p class="muted pad">Aucun bail.</p>'}</div>`;
}
async function supprimerBailArchive(id){
  const b=byId('baux',id); const fin=(b.fin&&(b.fin.clotureLe||b.fin.date))||b.dateDebut; const ans=diffDays(fin, todayISO())/365.25;
  const msg = ans<R('conservBail') ? `<p class="neg">Ce bail s'est terminé il y a moins de ${R('conservBail')} ans : un litige reste possible (loyers, dépôt, dégradations). Il est conseillé de le garder.</p>` : `<p>Ce bail est terminé depuis plus de ${R('conservBail')} ans. Gardez néanmoins les pièces fiscales ${R('conservFiscal')} ans.</p>`;
  if(await confirmBox('Supprimer ce bail archivé ?', msg+'<p>Le bail, ses paiements et documents iront dans la corbeille (30 jours), puis seront définitivement effacés de cet appareil. Les copies de sauvegarde déjà faites les contiennent encore.</p>', 'Supprimer', true)){
    STATE.docs.filter(d=>d.bailId===id).forEach(d=>softDelete('docs', d.id, 'Document'));
    STATE.paiements.filter(p=>p.bailId===id).forEach(p=>softDelete('paiements', p.id, 'Paiement'));
    softDelete('baux', id, 'Bail '+nomsLocataires(b)); refresh();
  }
}

/* =====================================================================================
   LOYERS — vue mensuelle de tous les biens
   ===================================================================================== */
function scrLoyers(m){
  const mk=UI.p.mois||monthKey(todayISO());
  const baux=STATE.baux.filter(b=>b.statut!=='brouillon' && b.dateDebut && monthKey(b.dateDebut)<=mk && (!finEffective(b) || monthKey(finEffective(b))>=mk));
  const rows=baux.map(b=>({b, l:etatMois(b,mk)})).filter(r=>r.l);
  const att=rows.reduce((s,r)=>s+r.l.montant,0), rec=rows.reduce((s,r)=>s+r.l.paye,0);
  m.innerHTML = head('Loyers', 'Suivi du mois : notez les paiements reçus, envoyez les quittances.') + `
    <div class="monthnav"><button class="btn btn-ghost" onclick="go('loyers',{mois:'${prevMonthKey(mk)}'})" aria-label="Mois précédent">‹</button><b>${monthLabelCap(mk)}</b><button class="btn btn-ghost" onclick="go('loyers',{mois:'${nextMonthKey(mk)}'})" aria-label="Mois suivant">›</button></div>
    <div class="kpis"><div class="kpi"><div class="k">Attendu</div><div class="v">${eur(att)}</div></div><div class="kpi"><div class="k">Reçu</div><div class="v">${eur(rec)}</div></div><div class="kpi ${att-rec>0.01&&mk<=monthKey(todayISO())?'bad':''}"><div class="k">Reste</div><div class="v">${eur(att-rec)}</div></div></div>
    ${rows.length?`<div class="card list">${rows.map(({b,l})=>`<div class="lrow"><div class="lmain" onclick="go('bien',{id:'${b.bienId}',tab:'loyers'})"><b>${esc(nomsLocataires(b))}</b><span>${esc(nomBien(bienDe(b)))} · exigible le ${fdateCourt(l.due)}</span></div>
      <div class="lamt">${eur(l.montant)}${l.paye>0&&l.etat!=='paye'?`<small>reçu ${eur(l.paye)}</small>`:''}</div><div>${etatPill(l.etat)}</div>
      <div class="lact">${l.etat==='paye'?`<button class="btn btn-sm btn-ghost" onclick="openDoc('quittance','${b.id}',{mois:'${mk}'})">Quittance</button>`:`<button class="btn btn-sm btn-teal" onclick="quickEncaisser('${b.id}','${mk}')">Encaissé</button><button class="btn btn-sm btn-ghost" onclick="openPaiement('${b.id}')">Autre montant</button>`}</div></div>`).join('')}</div>
      ${rows.some(r=>r.l.etat==='paye')?`<div class="btnrow"><button class="btn btn-ghost" onclick="quittancesDuMois('${mk}')">🧾 Préparer toutes les quittances de ${monthLabel(mk)}</button><button class="btn btn-ghost" onclick="avisDuMois('${nextMonthKey(mk)}')">📅 Avis d'échéance de ${monthLabel(nextMonthKey(mk))}</button></div>`:''}`
    : '<div class="card empty"><p>Aucun loyer attendu ce mois-ci.</p></div>'}`;
}
function quittancesDuMois(mk){
  let n=0; STATE.baux.forEach(b=>{ const l=etatMois(b,mk); if(l && l.etat==='paye' && !STATE.docs.some(d=>d.bailId===b.id && d.type==='quittance' && (d.data||{}).mois===mk)){ const x=ctxBail(b.id); const doc={id:uid('doc'), type:'quittance', bailId:b.id, bienId:b.bienId, ref:('QUI-'+Date.now().toString(36)+n).toUpperCase(), createdAt:todayISO(), data:{mois:mk, apl:b.aplTiersPayant?num(b.aplMontant):''}, envois:[]}; doc.html=DOCS.quittance.gen(x, doc.data); upsert('docs', doc); n++; } });
  toast(n? plural(n,'quittance')+' préparée(s) : envoyez-les depuis Courriers › Documents de chaque bien.' : 'Toutes les quittances du mois existent déjà.', 4500);
  if(n) go('courriers',{vue:'aenvoyer'});
}
function avisDuMois(mk){
  let n=0; bauxEnCours().forEach(b=>{ if(!STATE.docs.some(d=>d.bailId===b.id && d.type==='avis_echeance' && (d.data||{}).mois===mk)){ const x=ctxBail(b.id); const doc={id:uid('doc'), type:'avis_echeance', bailId:b.id, bienId:b.bienId, ref:('AVI-'+Date.now().toString(36)+n).toUpperCase(), createdAt:todayISO(), data:{mois:mk}, envois:[]}; doc.html=DOCS.avis_echeance.gen(x, doc.data); upsert('docs', doc); n++; } });
  toast(n? plural(n,'avis')+' préparé(s).' : 'Déjà préparés.'); if(n) go('courriers',{vue:'aenvoyer'});
}

/* =====================================================================================
   COURRIERS — bibliothèque complète, documents à envoyer, outils
   ===================================================================================== */
function scrCourriers(m){
  const vue=UI.p.vue||'modeles';
  const baux=STATE.baux.filter(b=>b.statut!=='termine');
  const sel=UI.p.bail ? byId('baux',UI.p.bail) : baux[0];
  const aEnv=STATE.docs.filter(d=>!(d.envois||[]).length).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  m.innerHTML = head('Courriers', 'Tous les documents de la vie du bail, pré-remplis et conformes, prêts à imprimer ou à envoyer.') +
    `<div class="tabs"><button class="${vue==='modeles'?'on':''}" onclick="go('courriers',{vue:'modeles'})">Modèles</button><button class="${vue==='aenvoyer'?'on':''}" onclick="go('courriers',{vue:'aenvoyer'})">À envoyer ${aEnv.length?`<span class="badge">${aEnv.length}</span>`:''}</button><button class="${vue==='tous'?'on':''}" onclick="go('courriers',{vue:'tous'})">Tous les documents</button><button class="${vue==='outils'?'on':''}" onclick="go('courriers',{vue:'outils'})">Outils de calcul</button></div><div id="cArea"></div>`;
  const a=m.querySelector('#cArea');
  if(vue==='aenvoyer'){ a.innerHTML = aEnv.length?`<div class="doclist">${aEnv.map(docRow).join('')}</div>`:'<div class="card empty"><div class="ic">📭</div><p>Tous vos documents ont été envoyés ou remis.</p></div>'; return; }
  if(vue==='tous'){ const all=[...STATE.docs].sort((x,y)=>y.createdAt.localeCompare(x.createdAt)); a.innerHTML = all.length?`<div class="doclist">${all.slice(0,200).map(docRow).join('')}</div>`:'<div class="card empty"><p>Aucun document.</p></div>'; return; }
  if(vue==='outils'){ return outilsHtml(a); }
  if(!sel){ a.innerHTML='<div class="card empty"><p>Créez d\'abord un bail depuis « Mes biens ».</p><button class="btn btn-amber" onclick="go(\'biens\')">Mes biens</button></div>'; return; }
  a.innerHTML = `${baux.length>1?`<div class="field inline"><label>Pour</label><select onchange="go('courriers',{vue:'modeles',bail:this.value})">${baux.map(b=>`<option value="${b.id}" ${b.id===sel.id?'selected':''}>${esc(nomsLocataires(b))} — ${esc(nomBien(bienDe(b)))}</option>`).join('')}</select></div>`:''}
    ${docsLibraryHtml(sel)}<h2 class="sect">E-mails types</h2><div class="chips">${Object.keys(MAILS).map(k=>`<button class="chip" onclick="openMailType('${sel.id}','${k}')">${MAILS[k].l}</button>`).join('')}</div>`;
  a.querySelectorAll('details.docgroup').forEach(d=>d.open=true);
}
function outilsHtml(a){
  const dern=irlDernier();
  a.innerHTML = `<div class="grid2">
    <div class="card"><h3>📈 Calcul de révision IRL</h3>${formHtml([{n:'loyer', l:'Loyer actuel HC (€)', t:'number', col:2},{n:'trim', l:'Trimestre de référence du bail', t:'select', v:irlMemeTrimestreAnneeSuivante(dern.trimestre).replace(/^(\d+)/,y=>String(num(y)-2)), o:Object.keys(REG.params.irl.serie).sort().reverse().map(k=>[k, trimestreLabel(k)+' — '+REG.params.irl.serie[k]]), col:2}],'ir')}<div id="irRes" class="result"></div><p class="hint">Dernier indice publié : ${trimestreLabel(dern.trimestre)} = ${dern.valeur}. Prochaine publication : ${fdate(REG.params.irl.prochaine)}.</p></div>
    <div class="card"><h3>📆 Date de fin de préavis</h3>${formHtml([{n:'rec', l:'Date de réception du congé', t:'date', v:todayISO(), col:2},{n:'mois', l:'Préavis', t:'select', v:'3', o:[['1','1 mois (meublé, zone tendue, cas réduits)'],['3','3 mois (location vide)'],['6','6 mois (congé du bailleur, vide)']], col:2}],'pr')}<div id="prRes" class="result"></div></div>
    <div class="card"><h3>🧱 Vétusté (part à la charge du locataire)</h3>${formHtml([{n:'el', l:'Élément', t:'select', o:VETUSTE.map(v=>[v.k, v.l+' (durée de vie '+v.vie+' ans)'])},{n:'cout', l:'Coût de la réparation (€)', t:'number', col:2},{n:'age', l:'Âge de l\'élément (ans)', t:'number', col:2}],'ve')}<div id="veRes" class="result"></div><p class="hint">Grille indicative inspirée des accords collectifs. Seule une grille annexée au bail s'impose aux parties ; à défaut, elle sert d'argument de bonne foi.</p></div>
    <div class="card"><h3>📏 Prorata du premier ou dernier mois</h3>${formHtml([{n:'tot', l:'Loyer + charges (€)', t:'number', col:2},{n:'d', l:'Date d\'entrée ou de sortie', t:'date', v:todayISO(), col:2},{n:'s', l:'Cas', t:'select', o:[['in','Entrée : du jour au fin de mois'],['out','Sortie : du 1er au jour inclus']]}],'pt')}<div id="ptRes" class="result"></div></div>
  </div>`;
  const calc=()=>{
    const ir=formValues(a.querySelector('#ir_loyer').closest('.card')); const v0=irlValeur(ir.trim), t1=irlMemeTrimestreAnneeSuivante(ir.trim), v1=irlValeur(t1);
    a.querySelector('#irRes').innerHTML = num(ir.loyer)&&v0 ? (v1?`Nouveau loyer maximum : <b>${eur(r2(num(ir.loyer)*v1/v0))}</b> (${eur(ir.loyer)} × ${v1} / ${v0}, +${((v1/v0-1)*100).toFixed(2).replace('.',',')} %)`:`L'indice du ${trimestreLabel(t1)} n'est pas encore publié.`) : '';
    const pr=formValues(a.querySelector('#pr_rec').closest('.card')); a.querySelector('#prRes').innerHTML = pr.rec? `Fin du bail : <b>${fdate(addDays(addMonths(pr.rec, num(pr.mois)),-1))}</b>` : '';
    const ve=formValues(a.querySelector('#ve_el').closest('.card')); a.querySelector('#veRes').innerHTML = num(ve.cout)? `Part imputable au locataire : <b>${eur(partLocataireVetuste(ve.cout, ve.el, ve.age))}</b> sur ${eur(ve.cout)}` : '';
    const pt=formValues(a.querySelector('#pt_tot').closest('.card')); if(num(pt.tot)&&pt.d){ const mk=monthKey(pt.d), dim=daysInMonth(mk), j=pt.s==='in'? dim-num(pt.d.slice(8))+1 : num(pt.d.slice(8)); a.querySelector('#ptRes').innerHTML=`${j} jours sur ${dim} : <b>${eur(r2(num(pt.tot)*j/dim))}</b>`; }
  };
  a.addEventListener('input', calc); a.addEventListener('change', calc);
}

/* =====================================================================================
   BILAN ANNUEL ET IMPÔTS
   ===================================================================================== */
function scrBilan(m){
  const an=UI.p.annee||String(parseISO(todayISO()).getFullYear()-(todayISO().slice(5,7)<'07'?1:0));
  const bil=bilanAnnee(an); const sim=simulationRegimes(bil);
  const years=[]; for(let y=parseISO(todayISO()).getFullYear(); y>=parseISO(todayISO()).getFullYear()-6; y--) years.push(String(y));
  m.innerHTML = head('Bilan & impôts', 'Vos chiffres de l\'année, prêts pour la déclaration de revenus et votre comptable.', `<select onchange="go('bilan',{annee:this.value})" aria-label="Année">${years.map(y=>`<option ${y===an?'selected':''}>${y}</option>`).join('')}</select>`) + `
    <div class="kpis"><div class="kpi"><div class="k">Loyers encaissés (hors charges)</div><div class="v">${eur(bil.tot.loyers)}</div></div><div class="kpi"><div class="k">Charges encaissées</div><div class="v">${eur(bil.tot.charges)}</div></div><div class="kpi"><div class="k">Dépenses à votre charge</div><div class="v">${eur(bil.tot.deductible)}</div></div></div>
    <div class="card list tablewrap"><table class="tbl"><thead><tr><th>Bien</th><th class="num">Loyers HC</th><th class="num">Charges reçues</th><th class="num">Dépenses</th><th class="num">dont récup.</th><th class="num">Résultat</th></tr></thead><tbody>
      ${bil.biens.map(r=>`<tr><td>${esc(nomBien(r.bien))}<br><small>${r.meuble?'Meublé (BIC)':'Vide (revenus fonciers)'}</small></td><td class="num">${eur(r.loyers)}</td><td class="num">${eur(r.charges)}</td><td class="num">${eur(r.depenses)}</td><td class="num">${eur(r.recup)}</td><td class="num"><b>${eur(r.loyers+r.charges-r.depenses)}</b></td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="num">${eur(bil.tot.loyers)}</td><td class="num">${eur(bil.tot.charges)}</td><td class="num">${eur(bil.tot.depenses)}</td><td class="num">${eur(bil.tot.recup)}</td><td class="num">${eur(bil.tot.loyers+bil.tot.charges-bil.tot.depenses)}</td></tr></tbody></table></div>
    <div class="grid2">
      ${sim.vide?`<div class="card"><h3>Location vide — revenus fonciers</h3>
        <p><b>Micro-foncier</b> (si loyers ≤ ${eur0(sim.vide.plafond)}) : abattement de ${sim.vide.abattement} %. ${sim.vide.micro!==null?`Revenu imposable : <b>${eur(sim.vide.micro)}</b>. Case 4BE de la déclaration 2042 : <b>${eur0(sim.vide.loyers)}</b>.`:'<span class="neg">Plafond dépassé : régime réel obligatoire.</span>'}</p>
        <p><b>Régime réel</b> (déclaration 2044) : loyers ${eur(sim.vide.loyers)} − charges déductibles ${eur(sim.vide.loyers-sim.vide.reel-sim.vide.forfait)} − frais de gestion forfaitaires ${eur(sim.vide.forfait)} = <b>${eur(sim.vide.reel)}</b>${sim.vide.reel<0?' (déficit foncier imputable sur le revenu global jusqu\'à '+eur0(R('deficitFoncierPlafond'))+', hors intérêts)':''}.</p>
        <p class="hint">${sim.vide.micro!==null&&sim.vide.reel<sim.vide.micro?'💡 Le réel semble plus avantageux cette année ; l\'option est irrévocable 3 ans.':'Le micro-foncier semble suffisant cette année.'} Les intérêts d'emprunt doivent être saisis dans les dépenses. Prélèvements sociaux : ${R('prelevementsSociaux')} %.</p>
        <details><summary>Où reporter les montants sur la 2044 ?</summary><ul class="small">${Object.entries(bil.biens.filter(b=>!b.meuble).reduce((o,b)=>{ for(const k in b.parLigne) o[k]=(o[k]||0)+b.parLigne[k]; return o; },{})).map(([k,v])=>`<li>Ligne ${esc(k)} : ${eur(v)}</li>`).join('')||'<li>Aucune dépense saisie.</li>'}<li>Ligne 211 (loyers bruts) : ${eur(sim.vide.loyers)}</li><li>Ligne 222 (frais de gestion forfaitaires) : ${eur(sim.vide.forfait)}</li></ul></details></div>`:''}
      ${sim.meuble?`<div class="card"><h3>Location meublée — BIC (LMNP)</h3>
        <p><b>Micro-BIC</b> (recettes ≤ ${eur0(sim.meuble.plafond)}) : abattement de ${sim.meuble.abattement} %. ${sim.meuble.micro!==null?`Revenu imposable : <b>${eur(sim.meuble.micro)}</b> — recettes à déclarer sur la 2042-C-PRO (case 5ND) : <b>${eur0(sim.meuble.loyers)}</b>.`:'<span class="neg">Plafond dépassé : régime réel.</span>'}</p>
        <p><b>Régime réel</b> : recettes − charges = ${eur(sim.meuble.reelAvantAmort)} <i>avant amortissements</i> (le bien et le mobilier s'amortissent : le résultat est souvent nul). Liasse 2031 : un expert-comptable ou un logiciel spécialisé est recommandé.</p>
        ${sim.meuble.lmp?'<p class="neg">Recettes > '+eur0(R('seuilLMP'))+' : vérifiez si vous devenez loueur professionnel (LMP).</p>':''}
        <p class="hint">Obligations du loueur meublé : immatriculation (numéro SIRET via le guichet unique de l'INPI) dans les 15 jours du début de l'activité, CFE chaque année (exonération sous ${eur0(R('cfeExoneration'))} de recettes).</p></div>`:''}
    </div>
    <div class="btnrow"><button class="btn btn-ghost" onclick="exportCSV('${an}')">📥 Exporter pour le comptable (tableur)</button><button class="btn btn-ghost" onclick="printBilan('${an}')">🖨️ Imprimer le bilan</button></div>
    <p class="hint">Estimation fournie à titre d'aide : les revenus sont comptés à l'encaissement, charges et dépenses à la date de paiement. Les règles fiscales évoluent chaque année (loi de finances) : vérifiez sur impots.gouv.fr ou auprès d'un professionnel avant de déclarer.</p>`;
}
function exportCSV(an){
  const rows=[['Type','Date','Bien','Locataire','Libellé','Catégorie','Montant','Récupérable']];
  STATE.paiements.filter(p=>p.date.slice(0,4)===an).forEach(p=>{ const b=byId('baux',p.bailId)||{}; rows.push(['Encaissement',p.date,nomBien(bienDe(b)),nomsLocataires(b),p.note||'Loyer',p.origine||'',String(p.montant).replace('.',','),'']); });
  STATE.depenses.filter(d=>d.date.slice(0,4)===an).forEach(d=>rows.push(['Dépense',d.date,nomBien(byId('biens',d.bienId)||{}),'',d.libelle||'',(CAT_DEPENSES[d.categorie]||{}).l||d.categorie,String(d.montant).replace('.',','),String(partRecuperable(d)).replace('.',',')]));
  const csv='﻿'+rows.map(r=>r.map(c=>'"'+String(c===undefined?'':c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}), 'clef-en-main-bilan-'+an+'.csv');
}
function printBilan(an){
  const bil=bilanAnnee(an); const bl=STATE.bailleurs[0]||{};
  printHtml(`<div class="docsheet"><h1>Bilan locatif ${an}</h1><p>${esc(nomBailleur(bl))}</p><table><tr><th>Bien</th><th class="num">Loyers HC</th><th class="num">Charges</th><th class="num">Dépenses</th><th class="num">Récupérable</th></tr>${bil.biens.map(r=>`<tr><td>${esc(nomBien(r.bien))}</td><td class="num">${eur(r.loyers)}</td><td class="num">${eur(r.charges)}</td><td class="num">${eur(r.depenses)}</td><td class="num">${eur(r.recup)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="num">${eur(bil.tot.loyers)}</td><td class="num">${eur(bil.tot.charges)}</td><td class="num">${eur(bil.tot.depenses)}</td><td class="num">${eur(bil.tot.recup)}</td></tr></table>
    ${bil.biens.map(r=>r.deps.length?`<h2>${esc(nomBien(r.bien))} — détail des dépenses</h2><table>${r.deps.map(d=>`<tr><td>${fdateCourt(d.date)}</td><td>${esc((CAT_DEPENSES[d.categorie]||{}).l)} ${esc(d.libelle||'')}</td><td class="num">${eur(d.montant)}</td></tr>`).join('')}</table>`:'').join('')}</div>`);
}

/* =====================================================================================
   RÉGLAGES
   ===================================================================================== */
function scrReglages(m){
  const regJ=REG.journal.slice(0,8);
  m.innerHTML = head('Réglages') + `
    <div class="card"><h3>👤 Propriétaire(s)</h3><p class="hint">Les coordonnées qui figurent sur vos documents. Ajoutez une SCI ou une indivision si un de vos biens leur appartient.</p>
      <div class="list">${STATE.bailleurs.map(b=>`<div class="lrow"><div class="lmain" onclick="openBailleurForm('${b.id}')"><b>${esc(nomBailleur(b))}</b><span>${esc({physique:'Personne physique',indivision:'Indivision',sci:'SCI familiale',morale:'Société'}[b.type]||'')} · ${esc(adresseBailleur(b))}</span></div></div>`).join('')}</div>
      <button class="btn btn-ghost btn-sm" onclick="openBailleurForm()">+ Ajouter un propriétaire</button></div>
    <div class="card"><h3>💾 Sauvegarde et autres appareils</h3><p>${savedLabel()}</p><p class="hint">Toutes vos données sont enregistrées automatiquement <b>sur cet appareil</b>. Pour les retrouver sur votre téléphone, tablette ou ordinateur, ou les protéger d'une perte, faites une copie et ouvrez-la sur l'autre appareil : les informations sont fusionnées.</p>
      <div class="btnrow"><button class="btn btn-teal" onclick="openSauvegarde()">Copie de sauvegarde / synchroniser</button></div></div>
    <div class="card"><h3>⚖️ Règles légales et veille</h3><p>Référentiel du <b>${fdate(REG.version)}</b> · dernier IRL : ${trimestreLabel(irlDernier().trimestre)} (${irlDernier().valeur}).${STATE.settings.regCheck?' Vérifié en ligne le '+fdateCourt(STATE.settings.regCheck.slice(0,10))+'.':''}</p>
      <p class="hint">Chaque mois, une veille met à jour les indices et les règles. À l'ouverture, l'appli récupère les nouveautés et les applique d'elle-même aux baux concernés (vide, meublé, étudiant, mobilité) ; vous êtes prévenu sur l'accueil.</p>
      <div class="btnrow"><button class="btn btn-ghost" onclick="majRegles()">Rechercher les mises à jour</button><button class="btn btn-ghost" onclick="voirRegles()">Voir toutes les règles appliquées</button></div>
      <h4>Dernières évolutions</h4><ul class="journal">${regJ.map(j=>`<li><b>${fdateCourt(j.date)}</b> — ${esc(j.titre)} <small>(${j.types.map(t=>t==='tous'?'tous les baux':TYPES_BAIL[t]?.court).join(', ')})</small></li>`).join('')}</ul></div>
    <div class="card"><h3>📲 Installer l'application</h3><ul class="small"><li><b>iPhone / iPad</b> (Safari) : bouton Partager › « Sur l'écran d'accueil ».</li><li><b>Android</b> (Chrome) : menu ⋮ › « Installer l'application » ou « Ajouter à l'écran d'accueil ».</li><li><b>Ordinateur</b> (Chrome, Edge) : icône d'installation dans la barre d'adresse.</li></ul><p class="hint">Une fois installée, elle fonctionne sans connexion.</p>${window._installPrompt?'<button class="btn btn-teal btn-sm" onclick="window._installPrompt.prompt()">Installer maintenant</button>':''}</div>
    <div class="card"><h3>🗑️ Corbeille</h3>${STATE.corbeille.length?`<p class="hint">Les éléments supprimés restent 30 jours, puis sont effacés définitivement de cet appareil.</p><div class="list">${STATE.corbeille.map((e,i)=>`<div class="lrow"><div class="lmain"><b>${esc(e.label||e.coll)}</b><span>supprimé le ${fdateCourt(e.deletedAt.slice(0,10))}</span></div><div class="lact"><button class="btn btn-sm btn-ghost" onclick="if(restoreFromCorbeille(${i})!==false){toast('Restauré.');refresh();}">Restaurer</button></div></div>`).join('')}</div><button class="btn btn-ghost btn-sm danger" onclick="viderCorbeille()">Vider la corbeille</button>`:'<p class="muted">La corbeille est vide.</p>'}</div>
    <div class="card"><h3>🔒 Données personnelles</h3><p class="small">Vous traitez des données personnelles de vos locataires (RGPD) : ne collectez que le nécessaire, ne demandez aucune pièce interdite, conservez les données le temps du bail puis le temps des prescriptions (${R('conservBail')} ans ; ${R('conservFiscal')} ans pour les pièces comptables), et informez vos locataires (mention prévue sur la lettre d'accueil). Cette application ne transmet aucune donnée : tout reste sur vos appareils et dans vos copies. Protégez vos copies par un mot de passe si vous les rangez dans un service en ligne.</p></div>
    <div class="card"><h3>ℹ️ À propos et limites</h3><p class="small">Clef en Main ${APP_VERSION}. Outil d'aide à la gestion locative pour les propriétaires qui louent sans agence des logements à usage de résidence principale (loi du 6 juillet 1989), en France métropolitaine. Ne couvre pas : locations saisonnières ou touristiques, baux commerciaux ou professionnels, logements conventionnés (APL/ANAH) dont les plafonds de loyer ne sont pas contrôlés, Alsace-Moselle et Outre-mer pour certaines règles particulières. Les documents suivent les textes en vigueur au ${fdate(REG.version)} mais ne remplacent pas le conseil d'un professionnel du droit : en cas de doute ou de litige, consultez gratuitement l'ADIL de votre département (0 805 160 075, www.anil.org).</p>
      <button class="btn btn-ghost btn-sm danger" onclick="toutEffacer()">Effacer toutes les données de cet appareil…</button></div>`;
}
async function viderCorbeille(){ if(await confirmBox('Vider la corbeille ?','Les éléments seront effacés définitivement de cet appareil (pas de vos copies de sauvegarde).','Vider',true)){ await purgeCorbeille(true); refresh(); } }
async function toutEffacer(){
  if(!(await confirmBox('Tout effacer ?','<p>Toutes vos données (biens, baux, documents, photos) seront effacées de cet appareil. <b>Faites d\'abord une copie de sauvegarde</b> si vous voulez les garder.</p>','Continuer',true))) return;
  const w=await promptBox('Confirmation','Tapez EFFACER pour confirmer',''); if(w!=='EFFACER') return;
  STATE=emptyState(); await saveNow(); if(DB){ const tx=DB.transaction('photos','readwrite'); tx.objectStore('photos').clear(); }
  toast('Données effacées.'); go('accueil');
}
async function majRegles(){ toast('Recherche des mises à jour…'); const r=await regCheckOnline(true); if(r.ok) toast(r.nouveau?'Règles mises à jour au '+fdateCourt(r.version)+'.':'Vous avez déjà les règles les plus récentes ('+fdateCourt(r.version)+').', 4000); else if(r.offline) toast('Ouvrez l\'appli depuis son adresse Internet pour recevoir les mises à jour.'); else toast('Pas de connexion : réessayez plus tard.'); refresh(); }
function voirRegles(){
  const byCat={}; for(const k in REG.params){ const p=REG.params[k]; (byCat[p.cat]=byCat[p.cat]||[]).push([k,p]); }
  openModal({title:'Règles appliquées', wide:true, body:Object.keys(REG.categories).map(c=>`<h3 class="fsect">${esc(REG.categories[c])}</h3><table class="tbl small">${(byCat[c]||[]).map(([k,p])=>{ const v=p.kind==='serie'?irlDernier().valeur+' ('+trimestreLabel(irlDernier().trimestre)+')':R(k); const vs=Array.isArray(v)?v.map(x=>x.nom).join(', '):(v===true?'oui':v); return `<tr><td>${esc(p.label)}${p.note?`<br><small class="muted">${esc(p.note)}</small>`:''}</td><td class="num nowrap">${esc(vs)} ${p.unit&&!['texte','règle','liste','date','classe'].includes(p.unit)?esc(p.unit):''}${p.src?` <a href="${esc(p.src)}" target="_blank" rel="noopener">source</a>`:''}</td></tr>`; }).join('')}</table>`).join('')+'<p class="hint">Types concernés par chaque règle et dates d\'effet : voir regles.js.</p>', actions:[{label:'Fermer'}]});
}

/* ---- Fenêtre de sauvegarde / synchronisation ---- */
function openSauvegarde(mode){
  const m=openModal({title:'💾 Sauvegarde et autres appareils', wide:true, body:`
    <div class="grid2">
      <div class="card flat"><h3>1. Faire une copie</h3><p class="small">Crée un fichier unique avec <b>tout</b> (biens, baux, paiements, documents, photos). Sur téléphone, choisissez « Enregistrer dans Fichiers », Google Drive ou iCloud Drive ; sur ordinateur, il est téléchargé.</p>
        ${formHtml([{n:'chiffrer', l:'Protéger la copie par un mot de passe (conseillé si vous la rangez en ligne)', t:'check', v:false},{n:'pass', l:'Mot de passe (à ne pas perdre : il n\'est stocké nulle part)', t:'text'}],'sv')}
        <button class="btn btn-teal" id="svGo">Faire la copie</button></div>
      <div class="card flat"><h3>2. Ouvrir une copie</h3><p class="small">Sur l'autre appareil : ouvrez Clef en Main, puis choisissez la copie. Les données sont <b>fusionnées</b> fiche par fiche (la version modifiée le plus récemment l'emporte ; rien n'est perdu). Accepte aussi les sauvegardes de l'ancienne version (.json).</p>
        <label class="btn btn-ghost">Choisir le fichier…<input type="file" accept=".clef,.json,application/json" hidden id="svFile"></label>
        <label class="check small"><input type="checkbox" id="svReplace"> Remplacer entièrement les données de cet appareil (au lieu de fusionner)</label></div>
    </div>
    <div class="infobox"><b>Pour utiliser l'appli sur plusieurs appareils :</b> faites la copie sur l'appareil où vous venez de travailler, ouvrez-la sur l'autre. Prenez l'habitude d'une copie par mois (l'accueil vous le rappelle) : c'est aussi votre protection en cas de perte ou de panne.</div>`});
  const p=m.el.querySelector('#sv_pass').closest('.field'); const ch=m.el.querySelector('#sv_chiffrer'); p.style.display='none'; ch.onchange=()=>p.style.display=ch.checked?'':'none';
  m.el.querySelector('#svGo').onclick=async()=>{ const v=formValues(m.el); if(v.chiffrer && (v.pass||'').length<6){ toast('Mot de passe : 6 caractères minimum.'); return; } try{ const ok=await exportBackup(v.chiffrer?v.pass:null); if(ok){ toast('Copie faite. Rangez-la en lieu sûr.'); m.close(); refresh(); } }catch(e){ console.error(e); toast('La copie a échoué.'); } };
  m.el.querySelector('#svFile').onchange=async(e)=>{
    const f=e.target.files[0]; if(!f) return;
    try{ const p=await readBackupFile(f); const rep=m.el.querySelector('#svReplace').checked;
      if(rep && !(await confirmBox('Remplacer toutes les données ?','Les données actuelles de cet appareil seront remplacées par celles du fichier.','Remplacer',true))) return;
      const st= rep ? await replaceWithPayload(p) : await mergePayload(p);
      m.close(); toast(rep?'Données remplacées.':`Fusion terminée : ${st.ajouts} ajout(s), ${st.majs} mise(s) à jour.`, 4500);
      if(biensActifs().length>MAX_BIENS) toast('Attention : plus de 6 biens actifs après fusion. Archivez ceux que vous ne louez plus.', 6000);
      cycleDeVie(); go('accueil');
    }catch(err){ toast(err.message||'Import impossible.', 4500); }
  };
  if(mode==='import') setTimeout(()=>m.el.querySelector('#svFile').click(), 200);
}
