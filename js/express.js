/* =====================================================================================
   COURRIER RAPIDE — utiliser n'importe quel document sans enregistrer de logement.
   Une « fiche rapide » (propriétaire, locataire, logement, quelques éléments du bail)
   suffit. Elle peut être gardée pour la prochaine fois, ou servir une seule fois.
   Les documents sont rangés dans Courriers › Courrier rapide (et figés avec la fiche).
   Rien n'entre dans les biens, baux, paiements suivis : pas d'emplacement occupé,
   pas d'alerte, pas de bilan. À tout moment, une fiche peut devenir un logement suivi.
   ===================================================================================== */
let EXPRESS_SUITE = null;          // action à reprendre après la saisie d'un décompte de charges
const EXPRESS_TEMP = {};           // fiches non gardées (le temps de la session)
const ficheIds = fid => ({bl:'xpbl_'+fid, bi:'xpbi_'+fid, ba:'xpba_'+fid});
function ficheById(fid){ return STATE.fiches.find(f=>f.id===fid) || EXPRESS_TEMP[fid] || null; }
function expressSnapshot(fid){ const f=ficheById(fid); return f ? JSON.parse(JSON.stringify(f)) : null; }
function nomFiche(f){ return f.nom || [((f.locataires||[])[0]||{}).prenom, ((f.locataires||[])[0]||{}).nom].filter(Boolean).join(' ') || (f.bien||{}).adresse || 'Fiche sans nom'; }

/* fiche → objets temporaires utilisables par tous les modèles */
function expressCharger(f){
  const ids=ficheIds(f.id);
  const blReel = f.bailleurId ? STATE.bailleurs.find(b=>b.id===f.bailleurId) : null;
  const bl = blReel || Object.assign({}, f.bailleur||{}, {id:ids.bl, express:true});
  if(!blReel) EXPRESS.bailleurs[ids.bl]=bl;
  const bien = Object.assign({dpe:{}, diagnostics:{}, encadrement:{}, pno:{}}, JSON.parse(JSON.stringify(f.bien||{})), {id:ids.bi, express:true, ficheId:f.id, statut:'express', bailleurId:bl.id});
  EXPRESS.biens[ids.bi]=bien;
  const b=f.bail||{}; const loyer=num(b.loyerHC), ch=num(b.charges);
  const bail = Object.assign({}, JSON.parse(JSON.stringify(b)), {
    id:ids.ba, express:true, ficheId:f.id, bienId:ids.bi, bailleurId:bl.id, ref:'',
    statut: b.dateFin && b.dateFin<=todayISO() ? 'sortie' : 'actif',
    type:b.type||'vide', locataires:JSON.parse(JSON.stringify(f.locataires||[])), garants:JSON.parse(JSON.stringify(f.garants||[])),
    loyerHC:loyer, charges:ch, chargesType:b.chargesType||'provision', depot:num(b.depot), jourPaiement:num(b.jourPaiement)||1, terme:b.terme||'echoir',
    revision:b.revision!==false, revisionAuto:false, dureeMois:b.dureeMois||'',
    irl:{trimestre:b.irlTrim||'', valeur:b.irlTrim?irlValeur(b.irlTrim, irlZoneCp(bien.cp)):''},
    historiqueLoyer:[{du:b.dateDebut||'2000-01-01', loyerHC:loyer, charges:ch, motif:'Fiche rapide'}],
    suiviDepuis: monthFirst(nextMonthKey(monthKey(todayISO()))), extras:[],
    fin: b.dateFin ? {date:b.dateFin, remiseCles:b.dateFin, adresseNouvelle:b.adresseNouvelle||'', edlConforme:true} : null });
  EXPRESS.baux[ids.ba]=bail;
  EXPRESS.decomptes = EXPRESS.decomptes.filter(d=>d.bienId!==ids.bi).concat((f.decomptes||[]).map(d=>Object.assign({}, d, {bienId:ids.bi, express:true, ficheId:f.id})));
  return bail;
}
function expressRestaurer(bailId){
  const fid=bailId.slice(5);
  const f = ficheById(fid) || ((STATE.docs.filter(d=>d.bailId===bailId && d.ficheSnap).pop()||{}).ficheSnap);
  if(f) expressCharger(f);
}
/* écritures provenant des modèles (ex. décompte de charges, état des lieux de sortie) */
function expressUpsert(coll, obj){
  if(coll==='decomptes'){
    const f=ficheById(obj.ficheId); if(!f) return;
    const propre=Object.assign({}, obj); delete propre.express; delete propre.bienId; delete propre.ficheId; propre.updatedAt=new Date().toISOString();
    f.decomptes=(f.decomptes||[]).filter(d=>d.id!==obj.id).concat([propre]);
    if(STATE.fiches.some(x=>x.id===f.id)) upsert('fiches', f);
    EXPRESS.decomptes=EXPRESS.decomptes.filter(d=>d.id!==obj.id).concat([obj]);
    return;
  }
  if(EXPRESS[coll] && !Array.isArray(EXPRESS[coll])) EXPRESS[coll][obj.id]=obj;
}
/* réglages propres à chaque document avant sa fabrication */
function expressAvantGen(type, x, d, apercu){
  EXPRESS.paiements=[]; x.bail.extras=[]; x.bail.suiviDepuis=monthFirst(nextMonthKey(monthKey(todayISO())));
  if(!['quittance','avis_echeance'].includes(type) || !d.mois) return;
  if(!x.bail.dateDebut || x.bail.dateDebut>monthLast(d.mois)){ x.bail.dateDebut=monthFirst(d.mois); x.bail.historiqueLoyer[0].du=monthFirst(d.mois); }
  x.bail.suiviDepuis=monthFirst(d.mois);
  if(type==='avis_echeance' && num(d.soldeAnterieur)) x.bail.extras=[{id:'xp_solde', date:addDays(monthFirst(d.mois),-1), libelle:'Solde antérieur', montant:num(d.soldeAnterieur)}];
  if(type==='quittance'){
    if(d.moisFin && d.moisFin>d.mois && !apercu){
      let mk=d.mois, n=0; const docs=[];
      while(mk<=d.moisFin && n<36){ docs.push(saveDocSilencieux(type, x, {mois:mk, apl:d.apl, datePaiement:'', envoi:d.envoi})); mk=nextMonthKey(mk); n++; }
      toast(plural(n,'quittance')+' préparée(s) : retrouvez-les dans Courriers › À envoyer.', 4500); go('courriers',{vue:'aenvoyer'}); return 'multi';
    }
    const l=echeancesBail(x.bail, monthLast(d.mois)).find(e=>e.key===d.mois);
    const montant = (d.montantRecu===''||d.montantRecu===undefined) ? (l?l.montant:0) : num(d.montantRecu);
    EXPRESS.paiements=[{id:'xp_paiement', bailId:x.bail.id, date:d.datePaiement||monthFirst(d.mois), montant, mode:x.bail.modePaiement||'virement'}];
  }
}
function saveDocSilencieux(type, x, data){
  expressAvantGen(type, x, data, true);
  const doc={ id:uid('doc'), type, bailId:x.bail.id, bienId:x.bien.id, ref:(type.slice(0,3)+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,4)).toUpperCase(), createdAt:todayISO(), data, envois:[], express:true, ficheId:x.bail.ficheId, ficheSnap:expressSnapshot(x.bail.ficheId) };
  const def=DOCS[type]; if(def.prepare) def.prepare(x,data); doc.html=def.gen(x,data); upsert('docs', doc); return doc;
}

/* ---- champs requis selon le document ---- */
const EXPRESS_BASE = ['bl_nom','bl_adresse','lo_nom','bi_adresse','bi_cp','bi_ville'];
const EXPRESS_BESOINS = {
  contrat_bail:['ba_type','ba_dateDebut','ba_loyerHC','ba_charges','ba_depot','bi_surface','bi_pieces','ba_irlTrim'],
  acte_caution:['ba_dateDebut','ba_loyerHC','ga_nom'], info_caution:['ga_nom'],
  lettre_bienvenue:['ba_loyerHC'], avis_echeance:['ba_loyerHC'], quittance:['ba_loyerHC'],
  revision_irl:['ba_dateDebut','ba_loyerHC','ba_irlTrim'], regularisation_charges:['ba_dateDebut','ba_charges'], modif_provision:['ba_charges'],
  conge_bailleur:['ba_type','ba_dateDebut'], renouvellement:['ba_type','ba_dateDebut','ba_loyerHC'], accuse_conge:['ba_type'],
  restitution_depot:['ba_depot','ba_loyerHC'], attestation:['ba_dateDebut','ba_loyerHC'],
  etat_lieux_entree:['ba_type'], etat_lieux_sortie:['ba_type'], annonce:['bi_surface','bi_pieces','ba_loyerHC']
};
const EXPRESS_EXTRAS = { annonce:{l:'Annonce de location', ic:'📣', d:'Texte avec les mentions obligatoires.'} };
function libelleDoc(type){ if(type.startsWith('mail:')) return '📧 '+MAILS[type.slice(5)].l; const d=DOCS[type]||EXPRESS_EXTRAS[type]; return d? d.ic+' '+d.l : type; }

/* ---- 1. choisir le document ---- */
function openExpress(type, ficheId){
  if(type) return choisirFiche(type, ficheId);
  const groupes = GROUPES_DOCS.map(([g,l])=>{ const items=Object.keys(DOCS).filter(k=>DOCS[k].g===g && !['solde','conge'].includes(k)); if(g==='entree') items.push('annonce'); return {l, items}; })
    .concat([{l:'E-mails types', items:Object.keys(MAILS).map(k=>'mail:'+k)}]);
  const m=openModal({title:'⚡ Courrier rapide', wide:true, body:`<p>Faites n'importe quel courrier ou document <b>sans enregistrer de logement</b> : vous remplissez une fiche courte (propriétaire, locataire, logement), l'appli fait le reste. Quel document voulez-vous ?</p>
    <div class="field"><input type="search" id="xpQ" placeholder="Rechercher : quittance, relance, congé, attestation…" aria-label="Rechercher un document"></div>
    <div id="xpListe">${groupes.map(g=>`<h3 class="fsect">${esc(g.l)}</h3><div class="xpgrid">${g.items.map(k=>`<button class="xpdoc" data-t="${k}">${esc(libelleDoc(k))}</button>`).join('')}</div>`).join('')}</div>`});
  m.el.querySelector('#xpQ').addEventListener('input', e=>{ const q=e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); m.el.querySelectorAll('.xpdoc').forEach(b=>b.style.display=b.textContent.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(q)?'':'none'); m.el.querySelectorAll('#xpListe h3').forEach(h=>{ const g=h.nextElementSibling; h.style.display=[...g.children].some(c=>c.style.display!=='none')?'':'none'; }); });
  m.el.querySelectorAll('.xpdoc').forEach(b=>b.onclick=()=>{ m.close(); const cible=EXPRESS_FICHE_CIBLE; EXPRESS_FICHE_CIBLE=null; if(cible && ficheById(cible)){ const f=ficheById(cible); expressCharger(f); lancerExpressAvecVerif(b.dataset.t, f); } else choisirFiche(b.dataset.t); });
  m.el.querySelector('.closebtn').addEventListener('click', ()=>{ EXPRESS_FICHE_CIBLE=null; });
}
/* ---- 2. choisir ou créer la fiche ---- */
function choisirFiche(type, ficheId){
  if(ficheId) return ficheForm(type, ficheById(ficheId));
  if(!STATE.fiches.length) return ficheForm(type, null);
  openModal({title:libelleDoc(type)+' — pour qui ?', body:`<div class="menu-list">${STATE.fiches.map(f=>`<button class="menu-item" data-id="${f.id}"><span>👤</span><div><b>${esc(nomFiche(f))}</b><br><small>${esc([(f.bien||{}).adresse,(f.bien||{}).ville].filter(Boolean).join(', '))}</small></div></button>`).join('')}<button class="menu-item" data-id=""><span>＋</span><b>Nouvelle fiche</b></button></div>`,
    onOpen:(bg,close)=>bg.querySelectorAll('.menu-item').forEach(x=>x.onclick=()=>{ close(); ficheForm(type, x.dataset.id?ficheById(x.dataset.id):null); })});
}
/* ---- 3. la fiche : seulement ce que le document demande est obligatoire ---- */
function ficheForm(type, f0){
  const f=f0?JSON.parse(JSON.stringify(f0)):{id:uid('fi'), locataires:[{}], garants:[], bien:{}, bail:{}, bailleur:{}};
  const bl=f.bailleur||{}, lo=(f.locataires||[])[0]||{}, lo2=(f.locataires||[])[1]||{}, bi=f.bien||{}, ba=f.bail||{}, ga=(f.garants||[])[0]||{};
  const req=new Set(EXPRESS_BASE.concat(EXPRESS_BESOINS[type]||[]));
  const profils=STATE.bailleurs;
  const R_=n=>req.has(n);
  const champs=[
    {t:'section', l:'Propriétaire'},
    ...(profils.length?[{n:'blId', l:'Qui signe ?', t:'select', v:f.bailleurId||(f0&&!f.bailleurId?'autre':profils[0].id), o:profils.map(p=>[p.id, nomBailleur(p)+' (mon profil)']).concat([['autre','Une autre personne ou société']])}]:[]),
    {n:'bl_type', l:'Le propriétaire est', t:'select', v:bl.type||'physique', o:[['physique','Une personne'],['indivision','Plusieurs personnes (indivision)'],['sci','Une SCI familiale'],['morale','Une société']], col:2}, {n:'bl_raison', l:'Nom de la société / des indivisaires', t:'text', v:bl.raison, col:2},
    {n:'bl_prenom', l:'Prénom', t:'text', v:bl.prenom, col:2}, {n:'bl_nom', l:'Nom', t:'text', v:bl.nom, req:R_('bl_nom'), col:2},
    {n:'bl_adresse', l:'Adresse', t:'text', v:bl.adresse, req:R_('bl_adresse')}, {n:'bl_cp', l:'Code postal', t:'text', v:bl.cp, col:3}, {n:'bl_ville', l:'Ville', t:'text', v:bl.ville, col:3}, {n:'bl_tel', l:'Téléphone', t:'text', v:bl.tel, col:3},
    {n:'bl_email', l:'E-mail', t:'text', v:bl.email, col:2}, {n:'bl_iban', l:'IBAN (loyers)', t:'text', v:bl.iban, col:2},
    {t:'section', l:'Locataire'},
    {n:'lo_civilite', l:'Civilité', t:'select', v:lo.civilite||'', o:[['',''],['Madame','Madame'],['Monsieur','Monsieur']], col:3}, {n:'lo_prenom', l:'Prénom', t:'text', v:lo.prenom, col:3}, {n:'lo_nom', l:'Nom', t:'text', v:lo.nom, req:R_('lo_nom'), col:3},
    {n:'lo_email', l:'E-mail', t:'text', v:lo.email, col:2}, {n:'lo_tel', l:'Téléphone', t:'text', v:lo.tel, col:2},
    {n:'lo2_prenom', l:'2e locataire : prénom (facultatif)', t:'text', v:lo2.prenom, col:2}, {n:'lo2_nom', l:'2e locataire : nom', t:'text', v:lo2.nom, col:2},
    {t:'section', l:'Logement'},
    {n:'bi_adresse', l:'Adresse', t:'text', v:bi.adresse, req:R_('bi_adresse')}, {n:'bi_cp', l:'Code postal', t:'text', v:bi.cp, req:R_('bi_cp'), col:3}, {n:'bi_ville', l:'Ville', t:'text', v:bi.ville, req:R_('bi_ville'), col:3}, {n:'bi_complement', l:'Bâtiment, étage, porte', t:'text', v:bi.complement, col:3},
    {n:'bi_type', l:'Type', t:'select', v:bi.type||'Appartement', o:[['Appartement','Appartement'],['Maison','Maison'],['Studio','Studio'],['Chambre','Chambre']], col:3}, {n:'bi_surface', l:'Surface (m²)', t:'number', v:bi.surface, req:R_('bi_surface'), col:3}, {n:'bi_pieces', l:'Pièces principales', t:'number', v:bi.pieces, req:R_('bi_pieces'), col:3},
    {n:'bi_regime', l:'Immeuble', t:'select', v:bi.regime||'copro', o:[['copro','Copropriété'],['mono','Un seul propriétaire']], col:3}, {n:'bi_dpe', l:'Classe DPE', t:'select', v:(bi.dpe||{}).classe||'', o:[['','?']].concat(CLASSES.map(c=>[c,c])), col:3}, {n:'bi_zoneTendue', l:'Zone tendue', t:'select', v:bi.zoneTendue===true?'oui':bi.zoneTendue===false?'non':'', o:[['','Je ne sais pas'],['oui','Oui'],['non','Non']], col:3},
    {t:'section', l:'Bail'},
    {n:'ba_type', l:'Type de location', t:'select', v:ba.type||'vide', o:Object.keys(TYPES_BAIL).map(k=>[k, TYPES_BAIL[k].l]), req:R_('ba_type'), col:2}, {n:'ba_dateDebut', l:'Début du bail', t:'date', v:ba.dateDebut, req:R_('ba_dateDebut'), col:2},
    {n:'ba_loyerHC', l:'Loyer hors charges (€)', t:'number', v:ba.loyerHC, req:R_('ba_loyerHC'), col:3}, {n:'ba_charges', l:'Charges (€/mois)', t:'number', v:ba.charges, req:R_('ba_charges'), col:3}, {n:'ba_chargesType', l:'Charges', t:'select', v:ba.chargesType||'provision', o:[['provision','Provision'],['forfait','Forfait']], col:3},
    {n:'ba_depot', l:'Dépôt de garantie (€)', t:'number', v:ba.depot, req:R_('ba_depot'), col:3}, {n:'ba_jourPaiement', l:'Jour de paiement', t:'number', v:ba.jourPaiement||1, col:3}, {n:'ba_modePaiement', l:'Mode de paiement', t:'text', v:ba.modePaiement||'virement', col:3},
    {n:'ba_irlTrim', l:'Trimestre de l\'indice des loyers (IRL) du bail', t:'select', v:ba.irlTrim||'', o:[['','—']].concat(Object.keys(REG.params.irl.serie).sort().reverse().slice(0,16).map(k=>[k, trimestreLabel(k)])), req:R_('ba_irlTrim'), col:2}, {n:'ba_derniereRevision', l:'Dernière révision du loyer', t:'date', v:ba.derniereRevision, col:2},
    {n:'ba_dateFin', l:'Si le locataire est parti : date de départ', t:'date', v:ba.dateFin, col:2}, {n:'ba_adresseNouvelle', l:'Sa nouvelle adresse', t:'text', v:ba.adresseNouvelle, col:2},
    {t:'section', l:'Garant (facultatif)'},
    {n:'ga_type', l:'Garantie', t:'select', v:ga.type||'aucun', o:[['aucun','Aucune'],['personne','Une personne se porte caution'],['visale','Visale']], col:2}, {n:'ga_visa', l:'N° de visa Visale', t:'text', v:ga.visa, col:2},
    {n:'ga_prenom', l:'Prénom de la caution', t:'text', v:ga.prenom, col:2}, {n:'ga_nom', l:'Nom de la caution', t:'text', v:ga.nom, req:R_('ga_nom'), col:2}, {n:'ga_adresse', l:'Adresse de la caution', t:'text', v:ga.adresse},
    {t:'section', l:'Enregistrement'},
    {n:'nom', l:'Nom de la fiche (pour la retrouver)', t:'text', v:f.nom||'', ph:'Ex. : Studio rue Victor-Hugo — M. Martin'},
    {n:'garder', l:'Garder cette fiche pour mes prochains courriers', t:'check', v:f0?STATE.fiches.some(x=>x.id===f.id):true}
  ];
  const m=openModal({title:type?libelleDoc(type):'Fiche rapide', wide:true, sticky:true, body:`<p class="hint">Seuls les champs marqués <span class="req">*</span> sont nécessaires pour ce document. Rien n'est ajouté à « Mes biens » : vos 6 emplacements restent libres.</p><form onsubmit="return false">${formHtml(champs,'xf')}</form>`,
    actions:[{label:'Annuler'},{label:'Continuer →', cls:'btn-teal', onClick:(c,bg)=>{
      const form=bg.querySelector('form'); const v=formValues(form);
      const autreBl = !profils.length || v.blId==='autre';
      // champs du propriétaire requis seulement s'il ne s'agit pas d'un profil existant
      if(!autreBl){ ['bl_nom','bl_adresse'].forEach(n=>{ const el=form.querySelector(`[name=${n}]`); if(el) el.removeAttribute('required'); }); }
      if(!formCheckRequired(form)) return false;
      if(v.ga_type==='personne' && R_('ga_nom') && !v.ga_nom){ toast('Indiquez la caution.'); return false; }
      const fiche={ id:f.id, nom:v.nom, createdAt:f.createdAt||todayISO(), decomptes:f.decomptes||[],
        bailleurId: autreBl?'':v.blId,
        bailleur: autreBl?{type:v.bl_type, raison:v.bl_raison, prenom:v.bl_prenom, nom:v.bl_nom, adresse:v.bl_adresse, cp:v.bl_cp, ville:v.bl_ville, tel:v.bl_tel, email:v.bl_email, iban:v.bl_iban}:{},
        locataires:[{civilite:v.lo_civilite, prenom:v.lo_prenom, nom:v.lo_nom, email:v.lo_email, tel:v.lo_tel}].concat(v.lo2_nom?[{prenom:v.lo2_prenom, nom:v.lo2_nom}]:[]),
        bien:{adresse:v.bi_adresse, cp:v.bi_cp, ville:v.bi_ville, complement:v.bi_complement, type:v.bi_type, surface:v.bi_surface, pieces:v.bi_pieces, regime:v.bi_regime, dpe:{classe:v.bi_dpe}, zoneTendue:v.bi_zoneTendue==='oui'?true:v.bi_zoneTendue==='non'?false:null, servitudeRPConnue:true},
        bail:{type:v.ba_type, dateDebut:v.ba_dateDebut, loyerHC:v.ba_loyerHC, charges:v.ba_charges, chargesType:v.ba_chargesType, depot:v.ba_depot, jourPaiement:v.ba_jourPaiement, modePaiement:v.ba_modePaiement, iban:v.bl_iban||'', irlTrim:v.ba_irlTrim, derniereRevision:v.ba_derniereRevision, dateFin:v.ba_dateFin, adresseNouvelle:v.ba_adresseNouvelle},
        garants: v.ga_type==='personne'?[{type:'personne', prenom:v.ga_prenom, nom:v.ga_nom, adresse:v.ga_adresse}] : v.ga_type==='visale'?[{type:'visale', visa:v.ga_visa}] : [] };
      if(v.garder){ upsert('fiches', fiche); delete EXPRESS_TEMP[fiche.id]; } else { EXPRESS_TEMP[fiche.id]=fiche; if(STATE.fiches.some(x=>x.id===fiche.id)) softDelete('fiches', fiche.id, 'Fiche rapide'); }
      expressCharger(fiche);
      if(!type){ toast('Fiche enregistrée.'); refresh(); return true; }
      setTimeout(()=>lancerExpress(type, fiche), 150);
    }}]});
  const tog=()=>{ const autre=!profils.length || (m.el.querySelector('[name=blId]')||{}).value==='autre';
    ['bl_type','bl_raison','bl_prenom','bl_nom','bl_adresse','bl_cp','bl_ville','bl_tel','bl_email','bl_iban'].forEach(n=>{ const x=m.el.querySelector(`[data-fname=${n}]`); if(x) x.style.display=autre?'':'none'; });
    const gt=m.el.querySelector('[name=ga_type]').value; ['ga_prenom','ga_nom','ga_adresse'].forEach(n=>m.el.querySelector(`[data-fname=${n}]`).style.display=gt==='personne'?'':'none'); m.el.querySelector('[data-fname=ga_visa]').style.display=gt==='visale'?'':'none'; };
  m.el.addEventListener('change', tog); tog();
}
/* ---- 4. ouvrir le document avec cette fiche ---- */
function lancerExpress(type, fiche){
  const ids=ficheIds(fiche.id);
  if(type==='annonce') return openAnnonce(ids.bi);
  if(type.startsWith('mail:')) return openMailType(ids.ba, type.slice(5));
  if(type==='regularisation_charges' && !decomptesDuBien(ids.bi).length){
    EXPRESS_SUITE=()=>openDoc('regularisation_charges', ids.ba);
    toast('Saisissez d\'abord les charges réelles de l\'année (décompte), puis la régularisation s\'ouvrira.', 5000);
    return openDecompte(ids.bi);
  }
  openDoc(type, ids.ba);
}

/* ---- transformer une fiche en logement suivi ---- */
async function expressConvertir(fid){
  const f=ficheById(fid); if(!f) return;
  if(biensActifs().length>=MAX_BIENS){ toast('Les 6 emplacements sont occupés : archivez d\'abord un logement.', 5000); return; }
  if(!(await confirmBox('Suivre ce logement dans l\'appli ?', `<p>La fiche « ${esc(nomFiche(f))} » devient un logement suivi (1 emplacement sur ${MAX_BIENS}) avec son bail en cours : loyers, alertes, révisions, charges et bilan. Le suivi des loyers commence ce mois-ci. Les documents déjà faits sont rattachés au logement.</p><p class="small">Complétez ensuite la fiche du logement (diagnostics, DPE…) et le bail si besoin.</p>`, 'Suivre ce logement'))) return;
  let blId=f.bailleurId;
  if(!blId){ const b=f.bailleur||{}; const ex=STATE.bailleurs.find(x=>(x.nom+'|'+x.adresse).toLowerCase()===((b.nom||'')+'|'+(b.adresse||'')).toLowerCase()); blId = ex ? ex.id : upsert('bailleurs', Object.assign({id:uid('bl')}, b)).id; }
  const bien=upsert('biens', Object.assign({diagnostics:{}, encadrement:{}, pno:{}}, JSON.parse(JSON.stringify(f.bien||{})), {id:uid('bi'), bailleurId:blId, statut:'actif', createdAt:todayISO()}));
  const ba=f.bail||{}; const loyer=num(ba.loyerHC), ch=num(ba.charges); const debut=ba.dateDebut||todayISO();
  const bail=upsert('baux', { id:uid('ba'), ref:'BAIL-'+debut.slice(0,4)+'-'+Math.floor(1000+Math.random()*9000), bienId:bien.id, bailleurId:blId, statut: ba.dateFin&&ba.dateFin<=todayISO()?'sortie':'actif',
    type:ba.type||'vide', locataires:f.locataires||[], garants:f.garants||[], dateDebut:debut, loyerHC:loyer, charges:ch, chargesType:ba.chargesType||'provision', depot:num(ba.depot),
    jourPaiement:num(ba.jourPaiement)||1, terme:'echoir', modePaiement:ba.modePaiement||'virement', iban:ba.iban||'', irl:{trimestre:ba.irlTrim||'', valeur:ba.irlTrim?irlValeur(ba.irlTrim, irlZoneCp(bien.cp)):''},
    revision:true, derniereRevision:ba.derniereRevision||'', suiviDepuis:monthFirst(monthKey(todayISO())) > debut ? monthFirst(monthKey(todayISO())) : debut,
    historiqueLoyer:[{du:debut, loyerHC:loyer, charges:ch, motif:'Repris d\'une fiche rapide'}], extras:[], fin: ba.dateFin?{date:ba.dateFin, remiseCles:ba.dateFin, adresseNouvelle:ba.adresseNouvelle||''}:null, createdAt:todayISO() });
  (f.decomptes||[]).forEach(d=>upsert('decomptes', Object.assign({}, d, {id:uid('dc'), bienId:bien.id})));
  const ids=ficheIds(fid);
  STATE.docs.filter(d=>d.bailId===ids.ba).forEach(d=>{ d.bailId=bail.id; d.bienId=bien.id; delete d.express; upsert('docs', d); });
  if(STATE.fiches.some(x=>x.id===fid)) softDelete('fiches', fid, 'Fiche rapide (devenue logement suivi)');
  toast('Logement ajouté à « Mes biens ».'); go('bien',{id:bien.id});
}
async function expressSupprimer(fid){
  const f=ficheById(fid); const n=STATE.docs.filter(d=>d.bailId===ficheIds(fid).ba).length;
  if(await confirmBox('Supprimer cette fiche ?', `<p>La fiche « ${esc(nomFiche(f))} » ira dans la corbeille (30 jours).${n?` Ses ${n} document(s) restent consultables dans « Courriers » (ils gardent une copie de la fiche).`:''}</p>`, 'Supprimer', true)){ softDelete('fiches', fid, 'Fiche rapide '+nomFiche(f)); refresh(); }
}

/* ---- écran Courriers › Courrier rapide ---- */
function rapideHtml(){
  const fiches=[...STATE.fiches].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  const orphelins=STATE.docs.filter(d=>d.express && !STATE.fiches.some(f=>ficheIds(f.id).ba===d.bailId));
  return `<div class="card cta"><div><h2>⚡ Courrier rapide</h2><p>Un courrier, une quittance, un avis de loyer ou une attestation <b>sans enregistrer de logement</b> : choisissez le document, remplissez une fiche courte, c'est prêt. Idéal pour un besoin ponctuel, un logement géré pour un proche, ou pour essayer l'appli.</p></div><div class="btnrow"><button class="btn btn-amber btn-lg" onclick="openExpress()">Nouveau courrier rapide</button><button class="linkbtn" onclick="openGuide('rapide')">Comment ça marche ?</button></div></div>
    ${fiches.length?`<h2 class="sect">Mes fiches rapides</h2>${fiches.map(f=>{ const docs=STATE.docs.filter(d=>d.bailId===ficheIds(f.id).ba).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return `<div class="card"><div class="lrow" style="padding:0 0 8px"><div class="lmain"><b>${esc(nomFiche(f))}</b><span>${esc([(f.bien||{}).adresse,(f.bien||{}).cp,(f.bien||{}).ville].filter(Boolean).join(' '))}${(f.bail||{}).loyerHC?' · loyer '+eur(f.bail.loyerHC):''}</span></div></div>
        <div class="btnrow"><button class="btn btn-teal btn-sm" onclick="nouveauDocFiche('${f.id}')">Nouveau document</button><button class="btn btn-ghost btn-sm" onclick="ficheForm(null, ficheById('${f.id}'))">Modifier la fiche</button><button class="btn btn-ghost btn-sm" onclick="expressConvertir('${f.id}')">Suivre ce logement</button><button class="linkbtn" onclick="expressSupprimer('${f.id}')">supprimer</button></div>
        ${docs.length?`<div class="doclist">${docs.slice(0,8).map(docRow).join('')}</div>${docs.length>8?`<p class="hint">+ ${docs.length-8} autres dans « Tous les documents ».</p>`:''}`:'<p class="muted small">Aucun document pour cette fiche.</p>'}</div>`; }).join('')}`:''}
    ${orphelins.length?`<h2 class="sect">Courriers rapides sans fiche gardée</h2><div class="doclist">${orphelins.map(docRow).join('')}</div>`:''}
    <p class="hint">Les courriers rapides n'ont ni suivi des paiements, ni alertes, ni bilan : pour cela, utilisez « Suivre ce logement ». Ils sont inclus dans vos copies de sécurité.</p>`;
}
/* « Nouveau document » d'une fiche : choisir le document, puis directement le document (la fiche n'est rouverte que s'il manque une information) */
function nouveauDocFiche(fid){ EXPRESS_FICHE_CIBLE=fid; openExpress(); }
let EXPRESS_FICHE_CIBLE=null;
/* document choisi pour une fiche existante : si un champ requis manque, on rouvre la fiche */
function lancerExpressAvecVerif(type, f){
  const v={bl_nom:f.bailleurId||(f.bailleur||{}).nom, bl_adresse:f.bailleurId||(f.bailleur||{}).adresse, lo_nom:((f.locataires||[])[0]||{}).nom, bi_adresse:(f.bien||{}).adresse, bi_cp:(f.bien||{}).cp, bi_ville:(f.bien||{}).ville, bi_surface:(f.bien||{}).surface, bi_pieces:(f.bien||{}).pieces,
    ba_type:(f.bail||{}).type, ba_dateDebut:(f.bail||{}).dateDebut, ba_loyerHC:(f.bail||{}).loyerHC, ba_charges:(f.bail||{}).charges, ba_depot:(f.bail||{}).depot, ba_irlTrim:(f.bail||{}).irlTrim, ga_nom:((f.garants||[])[0]||{}).nom};
  const manque=EXPRESS_BASE.concat(EXPRESS_BESOINS[type]||[]).filter(k=>v[k]===undefined||v[k]===null||String(v[k]).trim()==='');
  if(manque.length){ toast('Ce document demande quelques informations de plus : complétez la fiche.', 4000); return ficheForm(type, f); }
  lancerExpress(type, f);
}

/* ---- aide ---- */
Object.assign(GUIDES, { rapide:{t:'Le courrier rapide (sans enregistrer de logement)', c:()=>`<ol class="steps">
  <li><b>Choisissez le document</b> : quittance, avis d'échéance, relance, mise en demeure, attestation, congé, contrat, état des lieux, régularisation des charges, e-mail type… (tous les modèles de l'appli).</li>
  <li><b>Remplissez la fiche</b> : propriétaire, locataire, logement. Seuls les champs marqués d'un astérisque sont demandés pour ce document. Si vous avez déjà un profil de propriétaire, il est proposé.</li>
  <li><b>Gardez la fiche</b> (case cochée par défaut) pour refaire un document en deux gestes le mois suivant : Courriers › Courrier rapide › « Nouveau document ».</li>
  <li><b>Envoyez</b> le document : PDF, e-mail, courrier, recommandé ou main propre, comme pour un logement suivi.</li></ol>
  <ul><li>Quittances : indiquez le montant reçu ; s'il est incomplet, l'appli fait un reçu partiel. Plusieurs mois d'un coup : choisissez « Jusqu'au mois ».</li>
  <li>Régularisation des charges : l'appli vous demande d'abord le décompte des charges réelles de l'année.</li>
  <li>Le courrier rapide n'occupe <b>aucun des 6 emplacements</b> et n'a ni suivi des paiements, ni alertes, ni bilan. Pour cela : « Suivre ce logement » transforme la fiche en logement suivi, avec ses documents.</li>
  <li>Les fiches et documents rapides sont inclus dans vos copies de sécurité.</li></ul>`} });
LEXIQUE['fiche rapide']='Fiche courte (propriétaire, locataire, logement) qui permet de faire un document sans enregistrer le logement dans « Mes biens ».';
