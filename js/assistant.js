/* =====================================================================================
   ASSISTANTS — propriétaire, logement, mise en location (questions simples, une à la fois),
   modification du bail, attestation d'assurance. Les choix juridiques sont déduits des
   réponses ; chaque terme technique est expliqué là où il apparaît.
   ===================================================================================== */

/* ---------------- Propriétaire ---------------- */
function openBailleurForm(id){
  const b=id?byId('bailleurs',id):null;
  const m=openModal({title:b?'Propriétaire':'Vos coordonnées de propriétaire', wide:true, body:`<p class="hint">Elles apparaissent en en-tête de tous vos documents.</p>`+formHtml([
    {n:'type', l:'Le logement appartient à', t:'radio', v:b?b.type:'physique', o:[['physique','Moi (personne physique)'],['indivision','Plusieurs personnes (indivision, couple)'],['sci','Une SCI familiale'],['morale','Une autre société']]},
    {n:'civilite', l:'Civilité', t:'select', v:b?b.civilite:'', o:[['',''],['Madame','Madame'],['Monsieur','Monsieur']], col:3}, {n:'prenom', l:'Prénom', t:'text', v:b?b.prenom:'', col:3}, {n:'nom', l:'Nom', t:'text', v:b?b.nom:'', col:3},
    {n:'raison', l:'Nom de la société / des indivisaires', t:'text', v:b?b.raison:'', h:'Ex. : SCI Les Tilleuls, ou « M. et Mme Martin ».', col:2}, {n:'siret', l:'SIREN / SIRET (société ou loueur meublé)', t:'text', v:b?b.siret:'', col:2},
    {n:'representant', l:'Représentée par (gérant)', t:'text', v:b?b.representant:''},
    {n:'adresse', l:'Adresse', t:'text', v:b?b.adresse:'', req:true}, {n:'cp', l:'Code postal', t:'text', v:b?b.cp:'', col:2}, {n:'ville', l:'Ville', t:'text', v:b?b.ville:'', col:2},
    {n:'tel', l:'Téléphone portable', t:'text', v:b?b.tel:'', col:2}, {n:'email', l:'E-mail', t:'text', v:b?b.email:'', col:2},
    {n:'iban', l:'IBAN pour recevoir les loyers (facultatif)', t:'text', v:b?b.iban:'', h:'Proposé par défaut dans les nouveaux baux et avis d\'échéance.'}],'bl'),
    actions:[{label:'Annuler'},{label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ if(!formCheckRequired(bg)) return false; const v=formValues(bg);
      if(['physique','indivision'].includes(v.type) && !v.nom && !v.raison){ toast('Indiquez au moins un nom.'); return false; }
      if(['sci','morale'].includes(v.type) && !v.raison){ toast('Indiquez le nom de la société.'); return false; }
      const nb=upsert('bailleurs', Object.assign(b||{id:uid('bl')}, v)); toast('Coordonnées enregistrées.');
      if(!b && !STATE.biens.length){ setTimeout(()=>openBienForm(null, nb.id), 200); } else refresh(); }}]});
  const t=()=>{ const v=(m.el.querySelector('[name=type]:checked')||{}).value; ['raison','siret','representant'].forEach(n=>{ const f=m.el.querySelector(`[data-fname=${n}]`); if(f) f.style.display=(v==='physique'&&n!=='siret')?'none':''; }); ['civilite','prenom'].forEach(n=>{ const f=m.el.querySelector(`[data-fname=${n}]`); if(f) f.style.display=['sci','morale'].includes(v)?'none':''; }); };
  m.el.addEventListener('change', t); t();
}

/* ---------------- Logement ---------------- */
function encadrementPour(cp){ const l=R('encadrementVilles')||[]; return l.find(v=>v.cp.some(p=>(cp||'').startsWith(p))) || null; }
function openBienForm(id, bailleurId){
  const b=id?byId('biens',id):null;
  if(!b && biensActifs().length>=MAX_BIENS){ openModal({title:'Les 6 emplacements sont utilisés', body:'<p>Pour ajouter un logement, archivez un bien que vous ne louez plus (vendu, repris pour vous) depuis sa fiche « Le logement ». Ses baux et documents restent consultables.</p>', actions:[{label:'Compris'}]}); return; }
  if(!STATE.bailleurs.length){ toast('Commencez par vos coordonnées de propriétaire.'); return openBailleurForm(); }
  const d=b||{dpe:{}, diagnostics:{}, encadrement:{}, pno:{}, bailleurId:bailleurId||STATE.bailleurs[0].id, regime:'copro', chauffage:'individuel', eauChaude:'individuel', type:'Appartement'};
  const dg=d.diagnostics||{};
  const f=[
    {t:'section', l:'Adresse'},
    {n:'surnom', l:'Petit nom (pour vous repérer)', t:'text', v:d.surnom, ph:'Ex. : Studio Lyon, T2 rue Victor-Hugo', col:2},
    {n:'bailleurId', l:'Propriétaire', t:'select', v:d.bailleurId, o:STATE.bailleurs.map(x=>[x.id, nomBailleur(x)]), col:2},
    {n:'adresse', l:'Adresse', t:'text', v:d.adresse, req:true}, {n:'complement', l:'Complément (bâtiment, escalier)', t:'text', v:d.complement, col:3}, {n:'etage', l:'Étage', t:'text', v:d.etage, col:3}, {n:'porte', l:'N° de porte / lot', t:'text', v:d.porte, col:3},
    {n:'cp', l:'Code postal', t:'text', v:d.cp, req:true, col:2}, {n:'ville', l:'Ville', t:'text', v:d.ville, req:true, col:2},
    {t:'section', l:'Description'},
    {n:'type', l:'Type', t:'select', v:d.type, o:[['Appartement','Appartement'],['Maison','Maison'],['Studio','Studio'],['Chambre','Chambre'],['Autre','Autre']], col:3},
    {n:'surface', l:'Surface habitable (m²)', t:'number', v:d.surface, req:true, h:'Loi Boutin : hors murs, gaines, embrasures, et parties de moins de 1,80 m de haut.', col:3},
    {n:'pieces', l:'Pièces principales', t:'number', v:d.pieces, req:true, h:'Séjour et chambres.', col:3},
    {n:'anneeConstruction', l:'Année de construction', t:'number', v:d.anneeConstruction, col:3}, {n:'regime', l:'Immeuble', t:'select', v:d.regime, o:[['copro','En copropriété'],['mono','Un seul propriétaire']], col:3},
    {n:'chauffage', l:'Chauffage', t:'select', v:d.chauffage, o:[['individuel','Individuel'],['collectif','Collectif']], col:3},
    {n:'chauffageDetail', l:'Énergie du chauffage', t:'text', v:d.chauffageDetail, ph:'Gaz, électrique, pompe à chaleur…', col:2}, {n:'eauChaude', l:'Eau chaude', t:'select', v:d.eauChaude, o:[['individuel','Individuelle'],['collectif','Collective']], col:2},
    {n:'equipements', l:'Équipements du logement', t:'text', v:d.equipements, ph:'Cuisine équipée, douche, WC séparés, double vitrage…'},
    {n:'autresParties', l:'Autres parties du logement', t:'text', v:d.autresParties, ph:'Balcon, terrasse, jardin privatif, grenier…', col:2},
    {n:'annexes', l:'Annexes privatives', t:'text', v:d.annexes, ph:'Cave n° 12, parking n° 4…', col:2},
    {n:'partiesCommunes', l:'Parties et équipements communs', t:'text', v:d.partiesCommunes, ph:'Ascenseur, local vélos, espaces verts, gardiennage…', col:2},
    {n:'tic', l:'Internet / TV', t:'text', v:d.tic, ph:'Fibre, antenne collective…', col:2},
    {t:'section', l:'Énergie et diagnostics', h:'Le DPE conditionne le droit de louer : classe G interdite depuis 2025, F en 2028, E en 2034. Loyer gelé pour F et G.'},
    {n:'dpe_classe', l:'Classe énergie (DPE)', t:'select', v:(d.dpe||{}).classe||'', o:[['','Je ne sais pas']].concat(CLASSES.map(c=>[c,c])), col:3},
    {n:'dpe_ges', l:'Classe climat (GES)', t:'select', v:(d.dpe||{}).ges||'', o:[['','—']].concat(CLASSES.map(c=>[c,c])), col:3},
    {n:'diag_dpe', l:'Date du DPE', t:'date', v:dg.dpe, col:3},
    {n:'dpe_coutMin', l:'Dépenses d\'énergie estimées : min (€/an)', t:'number', v:(d.dpe||{}).coutMin, col:3}, {n:'dpe_coutMax', l:'max (€/an)', t:'number', v:(d.dpe||{}).coutMax, col:3}, {n:'dpe_anneeRef', l:'Année de référence des prix', t:'text', v:(d.dpe||{}).anneeRef, ph:'Ex. : 2023', col:3},
    {n:'diag_erp', l:'État des risques (ERP) — date', t:'date', v:dg.erp, h:'Moins de 6 mois à la signature.', col:3}, {n:'diag_elec', l:'Diagnostic électricité', t:'date', v:dg.elec, h:'Si installation > 15 ans.', col:3}, {n:'diag_gaz', l:'Diagnostic gaz', t:'date', v:dg.gaz, h:'Si installation > 15 ans.', col:3},
    {n:'diag_crep', l:'Constat plomb (CREP)', t:'date', v:dg.crep, h:'Immeuble d\'avant 1949.', col:3}, {n:'diag_amiante', l:'Amiante (DAPP)', t:'date', v:dg.amiante, h:'Permis avant juillet 1997.', col:3}, {n:'diag_bruit', l:'Diagnostic bruit', t:'date', v:dg.bruit, h:'Zone de bruit d\'aéroport.', col:3},
    {t:'section', l:'Règles locales', h:'Ces réponses adaptent automatiquement préavis, plafonds de loyer et mentions du bail.'},
    {n:'zoneTendue', l:'Commune en « zone tendue »', t:'select', v:d.zoneTendue===true?'oui':d.zoneTendue===false?'non':'', o:[['','Je ne sais pas'],['oui','Oui'],['non','Non']], h:'<a href="https://www.service-public.fr/simulateur/calcul/zonesTendues" target="_blank" rel="noopener">Vérifier ma commune (simulateur officiel)</a>. Effets : préavis du locataire d\'un mois, loyer bloqué à la relocation.', col:2},
    {n:'enc_actif', l:'Encadrement des loyers', t:'select', v:(d.encadrement||{}).actif?'oui':'non', o:[['non','Non concerné'],['oui','Oui, ma commune encadre les loyers']], h:'<span id="encHint"></span>', col:2},
    {n:'enc_loyerRef', l:'Loyer de référence (€/m²)', t:'number', v:(d.encadrement||{}).loyerRef, col:2}, {n:'enc_loyerRefMaj', l:'Loyer de référence majoré (€/m²)', t:'number', v:(d.encadrement||{}).loyerRefMaj, h:'Plafond à ne pas dépasser (hors complément justifié).', col:2},
    {n:'permisLouer', l:'Ma commune impose un « permis de louer » (autorisation ou déclaration préalable)', t:'check', v:d.permisLouer},
    {n:'servitudeRP', l:'Servitude de résidence principale (PLU)', t:'select', v:d.servitudeRPConnue?(d.servitudeRP?'oui':'non'):'', o:[['','Je ne sais pas'],['non','Non'],['oui','Oui']], h:'Mention obligatoire dans les baux depuis le 1er octobre 2026 (loi Le Meur). Renseignez-vous en mairie (service urbanisme) ; concerne surtout des logements neufs.'},
    {t:'section', l:'Assurances et contacts'},
    {n:'pno_assureur', l:'Assurance propriétaire non occupant (PNO)', t:'text', v:(d.pno||{}).assureur, ph:'Assureur et n° de contrat', h:'Obligatoire en copropriété.', col:2},
    {n:'gli', l:'Assurance loyers impayés (GLI)', t:'select', v:d.gli?'oui':'non', o:[['non','Non'],['oui','Oui']], h:'Avec une GLI, pas de caution exigible (sauf étudiant ou apprenti).', col:2},
    {n:'contacts', l:'Contacts utiles (syndic, gardien, artisans)', t:'textarea', v:d.contacts}
  ];
  const m=openModal({title:b?'Le logement':'Ajouter un logement ('+(biensActifs().length+1)+'/'+MAX_BIENS+')', wide:true, body:`<form onsubmit="return false">${formHtml(f,'bi')}</form>`,
    actions:[{label:'Annuler'},{label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ if(!formCheckRequired(bg)) return false; const v=formValues(bg);
      const o=Object.assign(b||{id:uid('bi'), statut:'actif', createdAt:todayISO()}, {surnom:v.surnom, bailleurId:v.bailleurId, adresse:v.adresse, complement:v.complement, etage:v.etage, porte:v.porte, cp:v.cp, ville:v.ville, type:v.type, surface:v.surface, pieces:v.pieces, anneeConstruction:v.anneeConstruction, regime:v.regime, chauffage:v.chauffage, chauffageDetail:v.chauffageDetail, eauChaude:v.eauChaude, equipements:v.equipements, autresParties:v.autresParties, annexes:v.annexes, partiesCommunes:v.partiesCommunes, tic:v.tic,
        dpe:{classe:v.dpe_classe, ges:v.dpe_ges, coutMin:v.dpe_coutMin, coutMax:v.dpe_coutMax, anneeRef:v.dpe_anneeRef},
        diagnostics:{dpe:v.diag_dpe, erp:v.diag_erp, elec:v.diag_elec, gaz:v.diag_gaz, crep:v.diag_crep, amiante:v.diag_amiante, bruit:v.diag_bruit},
        zoneTendue: v.zoneTendue==='oui'?true:v.zoneTendue==='non'?false:null, encadrement:{actif:v.enc_actif==='oui', loyerRef:v.enc_loyerRef, loyerRefMaj:v.enc_loyerRefMaj},
        permisLouer:v.permisLouer, servitudeRPConnue:v.servitudeRP!=='', servitudeRP:v.servitudeRP==='oui', pno:{assureur:v.pno_assureur}, gli:v.gli==='oui', contacts:v.contacts});
      upsert('biens', o); toast('Logement enregistré.');
      if(!b){ go('bien',{id:o.id}); setTimeout(async()=>{ if(await confirmBox('Louer ce logement maintenant ?','L\'assistant va vous poser quelques questions pour préparer le bail (ou reprendre un bail déjà en cours).','Oui, continuer')) startAssistantBail(o.id); }, 300); }
      else refresh(); }}]});
  const cpIn=m.el.querySelector('[name=cp]'), hint=m.el.querySelector('#encHint');
  const upd=()=>{ const e=encadrementPour(cpIn.value); hint.innerHTML = e ? `Code postal probablement concerné (${esc(e.nom)}) — <a href="${esc(REG.params.encadrementVilles.src)}" target="_blank" rel="noopener">trouver le loyer de référence</a>.` : ''; const sel=m.el.querySelector('[name=enc_actif]'); if(e && !b && sel.value==='non') sel.value='oui'; };
  cpIn.addEventListener('input', upd); upd();
}
function tabInfos(a, bien){
  const dg=bien.diagnostics||{};
  const rows=(REG.diagnostics||[]).map(d=>{ const dt=dg[d.k]; const fin=dt&&d.ans?addMonths(dt, Math.round(d.ans*12)):null; const exp=fin&&fin<todayISO();
    return `<tr><td>${esc(d.l)}<br><small class="muted">${esc(d.quand)}</small></td><td>${dt?fdateCourt(dt):'<span class="muted">—</span>'}</td><td>${dt?(d.ans?(exp?'<span class="neg">expiré</span>':'jusqu\'au '+fdateCourt(fin)):'illimité'):''}</td></tr>`; }).join('');
  a.innerHTML = `<div class="grid2"><div class="card"><h3>Description</h3><dl class="dl"><dt>Adresse</dt><dd>${esc(adresseBien(bien))}</dd><dt>Type</dt><dd>${esc(bien.type||'—')}, ${esc(bien.surface||'—')} m², ${esc(bien.pieces||'—')} pièce(s)</dd><dt>Immeuble</dt><dd>${bien.regime==='copro'?'Copropriété':'Mono-propriété'}${bien.anneeConstruction?', construit en '+esc(bien.anneeConstruction):''}</dd><dt>Chauffage</dt><dd>${esc(bien.chauffage||'')} ${esc(bien.chauffageDetail||'')}</dd><dt>Propriétaire</dt><dd>${esc(nomBailleur(byId('bailleurs',bien.bailleurId)))}</dd>
    <dt>Zone tendue</dt><dd>${bien.zoneTendue===true?'Oui':bien.zoneTendue===false?'Non':'<span class="warnc">À vérifier</span>'}</dd><dt>Encadrement</dt><dd>${(bien.encadrement||{}).actif?'Oui — plafond '+esc(bien.encadrement.loyerRefMaj||'?')+' €/m²':'Non'}</dd><dt>PNO / GLI</dt><dd>${esc((bien.pno||{}).assureur||'—')} / ${bien.gli?'Oui':'Non'}</dd></dl>
    <div class="btnrow"><button class="btn btn-teal btn-sm" onclick="openBienForm('${bien.id}')">Modifier</button></div></div>
    <div class="card"><h3>Performance énergétique</h3><div class="dpebig">${CLASSES.map(c=>`<span class="dpe dpe-${c} ${dpeClasse(bien)===c?'on':''}">${c}</span>`).join('')}</div>
    <p>${dpeClasse(bien)?(classeInterdite(dpeClasse(bien),todayISO())==='err'?'<span class="neg">Non décent : location interdite (nouveau bail ou renouvellement).</span>':dpeClasse(bien)==='F'?'Location possible jusqu\'au 31/12/2027 ; loyer gelé.':dpeClasse(bien)==='E'?'Location possible jusqu\'au 31/12/2033.':'Location autorisée.'):'<span class="warnc">Classe DPE à renseigner.</span>'}</p></div></div>
    <div class="card"><h3>Diagnostics</h3><div class="tablewrap"><table class="tbl small"><tr><th>Diagnostic</th><th>Date</th><th>Validité</th></tr>${rows}</table></div></div>
    <div class="card"><h3>Retirer ce logement</h3><p class="small">Vendu, repris pour vous ou plus en location ? <b>Archivez-le</b> : il libère un emplacement, et tout son historique (baux, quittances, dépenses) reste consultable et compte dans vos bilans. La suppression définitive n'est possible que pour un logement sans bail.</p>
      <div class="btnrow">${bien.statut==='archive'?`<button class="btn btn-ghost btn-sm" onclick="reactiverBien('${bien.id}')">Réactiver</button>`:`<button class="btn btn-ghost btn-sm" onclick="archiverBien('${bien.id}')">Archiver</button>`}<button class="btn btn-ghost btn-sm danger" onclick="supprimerBien('${bien.id}')">Supprimer…</button></div></div>`;
}
async function archiverBien(id){
  const b=byId('biens',id); if(bailOccupe(id)){ toast('Un bail est en cours : terminez-le avant d\'archiver le logement.'); return; }
  if(await confirmBox('Archiver ce logement ?','Il libère un emplacement. Ses baux et documents restent consultables dans « Mes biens › Biens archivés ».','Archiver')){ b.statut='archive'; upsert('biens',b); go('biens'); }
}
async function supprimerBien(id){
  const b=byId('biens',id); if(STATE.baux.some(x=>x.bienId===id)){ openModal({title:'Suppression impossible', body:'<p>Ce logement a un historique de baux (obligations de conservation : '+R('conservBail')+' ans après la fin du bail, '+R('conservFiscal')+' ans pour la fiscalité). Archivez-le plutôt : il ne compte plus dans les 6 emplacements.</p>', actions:[{label:'Compris'}]}); return; }
  if(await confirmBox('Supprimer ce logement ?','Il ira dans la corbeille (30 jours).','Supprimer',true)){ STATE.depenses.filter(d=>d.bienId===id).forEach(d=>softDelete('depenses',d.id,'Dépense')); softDelete('biens', id, 'Logement '+nomBien(b)); go('biens'); }
}

/* =====================================================================================
   ASSISTANT « LOUER CE LOGEMENT »
   ===================================================================================== */
let WIZ=null;
function startAssistantBail(bienId){
  const bien=byId('biens',bienId); if(!bien) return;
  const occ=bailOccupe(bienId); if(occ){ toast('Ce logement a déjà un bail en cours.'); return; }
  const brou=STATE.baux.find(b=>b.bienId===bienId && b.statut==='brouillon'); if(brou){ toast('Un bail est déjà en préparation pour ce logement.'); return go('bien',{id:bienId}); }
  const bl=byId('bailleurs',bien.bailleurId)||STATE.bailleurs[0]||{};
  const prev=bauxDuBien(bienId).find(b=>['sortie','termine'].includes(b.statut));
  const dern=irlDernier();
  WIZ={ bien, step:0, d:{ existant:'', rp:'oui', meuble:'', situation:'autre', etudiant:'etudiant9', motifMobilite:'', dureeMois:'', dureeReduite:'non', motifDureeReduite:'',
    locataires:[{id:uid('lo'), civilite:'', prenom:'', nom:'', email:'', tel:'', adresseAvant:''}], garantType:'aucun', garant:{}, visa:'',
    loyerHC:prev?loyerA(prev, (prev.fin||{}).date||todayISO()).loyerHC:'', charges:prev?loyerA(prev,(prev.fin||{}).date||todayISO()).charges:'', chargesType:'provision', complementLoyer:'', complementMotif:'',
    dernierLoyer: prev?loyerA(prev,(prev.fin||{}).date||todayISO()).loyerHC:'', dernierLoyerDate:prev&&prev.fin?prev.fin.date:'', justifHausse:'',
    depot:'', jourPaiement:5, terme:'echoir', modePaiement:'virement', iban:bl.iban||'', aplTiersPayant:false, aplMontant:'',
    dateDebut:'', dateSignature:todayISO(), lieuSignature:bien.ville||'', irlTrim:dern.trimestre, revision:true,
    suiviDepuis:monthFirst(monthKey(todayISO())), soldeInitial:'', derniereRevision:'', travauxDepuis:'', conditionsParticulieres:'', usageMixte:false } };
  wizOpen();
}
const WIZ_STEPS = [
  {k:'existant', t:'Nouveau bail ou bail en cours ?', skip:d=>false, fields:d=>[
    {n:'existant', l:'S\'agit-il…', t:'radio', v:d.existant, o:[['nouveau','D\'une nouvelle location — le bail est à préparer et à signer'],['existant','D\'un bail déjà signé, en cours — je veux le suivre dans l\'appli']]},
    {n:'i', t:'info', l:'Bail déjà en cours : vous saisirez sa situation actuelle (loyer en vigueur, solde du locataire) et le suivi des loyers démarrera au mois que vous choisirez — pas d\'impayés fictifs sur le passé.'}],
    valid:d=>d.existant?null:'Choisissez une réponse.'},
  {k:'rp', t:'Résidence principale ?', fields:d=>[
    {n:'rp', l:'Le locataire va-t-il habiter ce logement à titre de résidence principale (au moins 8 mois par an) ?', t:'radio', v:d.rp, o:[['oui','Oui'],['non','Non (résidence secondaire, saisonnier, Airbnb, bureau…)']]}],
    valid:d=>d.rp==='non'?'Cette application est conçue pour les locations de résidence principale (loi du 6 juillet 1989). Une résidence secondaire, une location saisonnière ou touristique relèvent d\'autres règles (Code civil, Code du tourisme) : rapprochez-vous de l\'ADIL.':null},
  {k:'meuble', t:'Vide ou meublé ?', fields:d=>[
    {n:'meuble', l:'Le logement est-il loué meublé ?', t:'radio', v:d.meuble, o:[['non','Non, il est loué vide'],['oui','Oui, il est meublé']]},
    {n:'i', t:'info', l:'<b>Meublé = équipé pour y vivre dès l\'entrée</b>, avec au minimum : '+(REG.equipementsMeuble||[]).join(', ').toLowerCase()+'. S\'il manque un élément, le juge peut requalifier le bail en location vide (durée de 3 ans, préavis différents).'}],
    valid:d=>d.meuble?null:'Choisissez une réponse.'},
  {k:'situation', t:'Votre locataire', skip:d=>d.meuble!=='oui', fields:d=>[
    {n:'situation', l:'Votre locataire est-il…', t:'radio', v:d.situation, o:[['autre','Dans une situation ordinaire'],['etudiant','Étudiant'],['mobilite','En formation, stage, apprentissage, service civique, mutation ou mission temporaire']]}]},
  {k:'etudiant', t:'Location à un étudiant', skip:d=>d.meuble!=='oui'||d.situation!=='etudiant', fields:d=>[
    {n:'etudiant', l:'Quelle durée ?', t:'radio', v:d.etudiant, o:[['etudiant9','Bail étudiant de 9 mois (année universitaire) — prend fin tout seul, sans reconduction'],['meuble','Bail meublé classique d\'un an, reconductible']]}]},
  {k:'mobilite', t:'Bail mobilité', skip:d=>d.meuble!=='oui'||d.situation!=='mobilite', fields:d=>[
    {n:'mobilite', l:'Souhaitez-vous un bail mobilité ?', t:'radio', v:d.mobilite||'oui', o:[['oui','Oui : 1 à 10 mois, sans dépôt de garantie, non renouvelable'],['non','Non, un bail meublé classique d\'un an']]},
    {n:'motifMobilite', l:'Situation exacte du locataire (sera écrite dans le bail)', t:'select', v:d.motifMobilite, o:[['','—'],['en formation professionnelle','En formation professionnelle'],['en études supérieures','En études supérieures'],['en contrat d\'apprentissage','En contrat d\'apprentissage'],['en stage','En stage'],['en engagement volontaire dans le cadre d\'un service civique','En service civique'],['en mutation professionnelle','En mutation professionnelle'],['en mission temporaire dans le cadre de son activité professionnelle','En mission temporaire']]},
    {n:'dureeMois', l:'Durée (mois, de 1 à 10)', t:'number', v:d.dureeMois||6},
    {n:'i', t:'info', l:'Le bail mobilité ne peut pas comprendre de dépôt de garantie ; les charges sont forfaitaires ; la garantie Visale est possible. S\'il se prolonge au-delà, il faut signer un bail meublé classique.'}],
    valid:d=>d.mobilite!=='non' && (!d.motifMobilite || !(num(d.dureeMois)>=1 && num(d.dureeMois)<=10)) ? 'Indiquez la situation du locataire et une durée de 1 à 10 mois.' : null},
  {k:'duree', t:'Durée du bail', skip:d=>d.meuble!=='non', fields:d=>{ const bl=byId('bailleurs',WIZ.bien.bailleurId)||{}; const morale=bl.type==='morale';
    return [{n:'i', t:'info', l: morale?'Bailleur société (hors SCI familiale) : bail de <b>6 ans</b> minimum.':'Bail vide consenti par un particulier ou une SCI familiale : <b>3 ans</b>, renouvelé automatiquement.'},
      ...(morale?[]:[{n:'dureeReduite', l:'Avez-vous un événement précis, familial ou professionnel, qui vous obligera à reprendre le logement plus tôt ? (durée réduite, article 11)', t:'radio', v:d.dureeReduite, o:[['non','Non — bail de 3 ans'],['oui','Oui — bail de 1 à 3 ans']]},
      {n:'dureeMois', l:'Durée réduite (mois, 12 à 35)', t:'number', v:d.dureeMois||24}, {n:'motifDureeReduite', l:'Événement précis (sera écrit dans le bail)', t:'text', v:d.motifDureeReduite, ph:'Ex. : départ à la retraite prévu en juin 2028 et retour dans la région'}])]; },
    valid:d=>d.dureeReduite==='oui' && (!d.motifDureeReduite || num(d.dureeMois)<12 || num(d.dureeMois)>35) ? 'Durée réduite : précisez l\'événement et une durée de 12 à 35 mois.' : null},
  {k:'locataires', t:'Le ou les locataires', custom:true},
  {k:'garant', t:'Garantie', fields:d=>[
    {n:'garantType', l:'Quelle garantie contre les impayés ?', t:'radio', v:d.garantType, o:[['aucun','Aucune'],['personne','Une personne se porte caution'],['visale','Garantie Visale (Action Logement, gratuite)'],['gli','J\'ai une assurance loyers impayés (GLI)']]},
    {n:'g_prenom', l:'Prénom de la caution', t:'text', v:d.garant.prenom, col:2}, {n:'g_nom', l:'Nom', t:'text', v:d.garant.nom, col:2},
    {n:'g_adresse', l:'Adresse de la caution', t:'text', v:d.garant.adresse}, {n:'g_email', l:'E-mail', t:'text', v:d.garant.email, col:2}, {n:'g_tel', l:'Téléphone', t:'text', v:d.garant.tel, col:2},
    {n:'visa', l:'N° de visa Visale', t:'text', v:d.visa},
    {n:'i', t:'info', l:'Caution : un acte de cautionnement sera préparé (montant maximum et durée obligatoires). Visale : le locataire obtient son visa sur visale.fr, vous signez le contrat de cautionnement en ligne. Une GLI interdit d\'exiger en plus une caution (sauf étudiant ou apprenti).'}]},
  {k:'loyer', t:'Loyer et charges', fields:d=>{ const b=WIZ.bien; const enc=b.encadrement||{}; const cl=dpeClasse(b);
    return [{n:'loyerHC', l:'Loyer mensuel hors charges (€)', t:'number', v:d.loyerHC, req:true, col:2},
      {n:'chargesType', l:'Les charges sont…', t:'select', v:d.chargesType, o:d.mobilite==='oui'&&d.situation==='mobilite'?[['forfait','Forfaitaires (obligatoire en bail mobilité)']]:[['provision','Une provision, régularisée chaque année selon les dépenses réelles (conseillé)'],['forfait','Un forfait fixe, jamais régularisé'+(d.meuble!=='oui'?' (seulement en colocation pour la location vide)':'')]], col:2},
      {n:'charges', l:'Montant mensuel des charges (€)', t:'number', v:d.charges, col:2, h:'Eau, entretien des parties communes, ordures ménagères (TEOM)… Uniquement les charges « récupérables ».'},
      {n:'depot', l:'Dépôt de garantie (€)', t:'number', v:d.depot, col:2, h:'Maximum : 1 mois de loyer HC (vide), 2 mois (meublé), 0 (mobilité).'},
      ...(b.zoneTendue||['F','G'].includes(cl)?[{t:'section', l:b.zoneTendue?'Zone tendue : loyer du précédent locataire':'Logement classé '+cl+' : loyer gelé'}, {n:'dernierLoyer', l:'Dernier loyer HC payé par le précédent locataire (€)', t:'number', v:d.dernierLoyer, col:3, h:'Laisser vide si première location ou logement vacant depuis plus de 18 mois.'}, {n:'dernierLoyerDate', l:'Date de son dernier versement', t:'date', v:d.dernierLoyerDate, col:3}, {n:'derniereRevisionPrec', l:'Date de sa dernière révision', t:'date', v:d.derniereRevisionPrec, col:3},
        {n:'justifHausse', l:'Justification d\'une hausse (si loyer supérieur)', t:'text', v:d.justifHausse, ph:'Ex. : travaux d\'amélioration de 9 000 € réalisés en 2026', show:()=>!['F','G'].includes(cl)}]:[]),
      ...(enc.actif?[{t:'section', l:'Encadrement des loyers'}, {n:'i2', t:'info', l:`Plafond : ${esc(String(enc.loyerRefMaj||'?').replace('.',','))} €/m² × ${esc(b.surface)} m² = <b>${eur(num(enc.loyerRefMaj)*num(b.surface))}</b> hors charges (meublé : utilisez le loyer de référence « meublé »).`}, {n:'complementLoyer', l:'Complément de loyer (€) — exceptionnel', t:'number', v:d.complementLoyer, col:2}, {n:'complementMotif', l:'Caractéristiques exceptionnelles qui le justifient', t:'text', v:d.complementMotif, col:2}]:[]),
      {n:'live', t:'info', l:'<div id="wizChecks"></div>'}]; },
    valid:d=>!(num(d.loyerHC)>0)?'Indiquez le loyer.':null},
  {k:'paiement', t:'Paiement du loyer', fields:d=>[
    {n:'jourPaiement', l:'Jour du mois où le loyer est dû', t:'number', v:d.jourPaiement, col:3, h:'Entre 1 et 28.'}, {n:'terme', l:'Payé', t:'select', v:d.terme, o:[['echoir','D\'avance, au début du mois (usuel)'],['echu','À la fin du mois écoulé']], col:3},
    {n:'modePaiement', l:'Mode de paiement', t:'select', v:d.modePaiement, o:[['virement','Virement'],['prélèvement','Prélèvement (avec l\'accord du locataire)'],['chèque','Chèque'],['autre','Autre']], col:3},
    {n:'iban', l:'IBAN où verser le loyer', t:'text', v:d.iban},
    {n:'aplTiersPayant', l:'L\'aide au logement (APL/ALS) me sera versée directement par la CAF ou la MSA', t:'check', v:d.aplTiersPayant, h:'Vous devrez alors la déduire du loyer réclamé et signaler tout impayé sous 2 mois.'},
    {n:'aplMontant', l:'Montant mensuel de l\'aide versée (€)', t:'number', v:d.aplMontant}]},
  {k:'dates', t:'Dates', fields:d=>{ const ex=d.existant==='existant';
    return [{n:'dateDebut', l:ex?'Date de début du bail (date d\'effet figurant au contrat)':'Date d\'entrée dans les lieux (prise d\'effet)', t:'date', v:d.dateDebut, req:true, col:2},
      {n:'dateSignature', l:'Date de signature', t:'date', v:d.dateSignature, col:2}, {n:'lieuSignature', l:'Lieu de signature', t:'text', v:d.lieuSignature, col:2},
      {n:'irlTrim', l:ex?'Trimestre IRL utilisé à la dernière révision (ou celui du bail)':'Indice de référence (IRL) du bail', t:'select', v:d.irlTrim, o:Object.keys(REG.params.irl.serie).sort().reverse().slice(0,16).map(k=>[k, trimestreLabel(k)+' — '+REG.params.irl.serie[k]]), col:2, h:ex?'':'Par défaut : le dernier indice publié à la signature.'},
      {n:'revision', l:'Le loyer sera révisé chaque année selon l\'IRL (conseillé)', t:'check', v:d.revision},
      ...(ex?[{t:'section', l:'Situation actuelle du bail en cours'}, {n:'derniereRevision', l:'Date de la dernière révision appliquée', t:'date', v:d.derniereRevision, col:2},
        {n:'suiviDepuis', l:'Suivre les loyers à partir du', t:'date', v:d.suiviDepuis, col:2, h:'Les mois antérieurs ne seront pas comptés.'},
        {n:'soldeInitial', l:'Le locataire vous doit-il déjà une somme à cette date ? (€)', t:'number', v:d.soldeInitial, h:'Arriéré à reprendre (montant positif) ou avance déjà versée (montant négatif). Laisser vide si le compte est à jour.'}]:[])]; },
    valid:d=>!d.dateDebut?'Indiquez la date de début.':null},
  {k:'complements', t:'Dernières précisions', fields:d=>[
    {n:'travauxDepuis', l:'Travaux réalisés depuis le départ du précédent locataire (nature et montant)', t:'text', v:d.travauxDepuis, ph:'Ex. : peinture complète (2 400 €), remplacement de la chaudière (3 100 €)'},
    {n:'usageMixte', l:'Le locataire pourra y exercer une activité professionnelle (usage mixte, sans accueil de clientèle ni marchandises)', t:'check', v:d.usageMixte},
    {n:'conditionsParticulieres', l:'Conditions particulières (facultatif)', t:'textarea', v:d.conditionsParticulieres, h:'N\'y mettez pas de clause interdite : pénalités, frais de relance, interdiction d\'animaux (hors chiens dangereux), prélèvement imposé, visites le week-end, etc. Elles seraient nulles.'}]},
  {k:'recap', t:'Vérification finale', custom:true}
];
function wizBuildBail(){
  const d=WIZ.d, bien=WIZ.bien;
  const type = d.meuble!=='oui' ? 'vide' : (d.situation==='mobilite'&&d.mobilite!=='non' ? 'mobilite' : (d.situation==='etudiant'&&d.etudiant==='etudiant9' ? 'etudiant' : 'meuble'));
  const garants=[];
  if(d.garantType==='personne') garants.push({id:uid('ga'), type:'personne', prenom:d.garant.prenom, nom:d.garant.nom, adresse:d.garant.adresse, email:d.garant.email, tel:d.garant.tel});
  if(d.garantType==='visale') garants.push({id:uid('ga'), type:'visale', visa:d.visa});
  const loyer=num(d.loyerHC), ch=num(d.charges);
  const ex=d.existant==='existant';
  const debutHist = ex ? (d.suiviDepuis && d.suiviDepuis>d.dateDebut ? d.suiviDepuis : d.dateDebut) : d.dateDebut;
  return { id:WIZ.editId||uid('ba'), ref:'BAIL-'+(d.dateDebut||todayISO()).slice(0,4)+'-'+Math.floor(1000+Math.random()*9000), bienId:bien.id, bailleurId:bien.bailleurId,
    statut: ex?'actif':'brouillon', type, locataires:d.locataires.filter(l=>l.nom||l.prenom), garants,
    dureeMois: type==='mobilite'?num(d.dureeMois): type==='vide'&&d.dureeReduite==='oui'?num(d.dureeMois):'', dureeReduite: type==='vide'&&d.dureeReduite==='oui', motifDureeReduite:d.motifDureeReduite, motifMobilite:d.motifMobilite,
    dateDebut:d.dateDebut, dateSignature:d.dateSignature, lieuSignature:d.lieuSignature, terme:d.terme, jourPaiement:Math.min(28,Math.max(1,num(d.jourPaiement)||1)), modePaiement:d.modePaiement, iban:d.iban,
    loyerHC:loyer, charges:ch, chargesType: type==='mobilite'?'forfait':d.chargesType, complementLoyer:d.complementLoyer, complementMotif:d.complementMotif, depot: type==='mobilite'?0:num(d.depot),
    dernierLoyer:d.dernierLoyer, dernierLoyerDate:d.dernierLoyerDate, derniereRevisionPrec:d.derniereRevisionPrec, justifHausse:d.justifHausse,
    irl:{trimestre:d.irlTrim, valeur:irlValeur(d.irlTrim)}, revision: type==='mobilite'?false:!!d.revision, derniereRevision: ex?d.derniereRevision:'',
    aplTiersPayant:!!d.aplTiersPayant, aplMontant:d.aplMontant, travauxDepuis:d.travauxDepuis, usageMixte:!!d.usageMixte, conditionsParticulieres:d.conditionsParticulieres,
    suiviDepuis: ex? d.suiviDepuis : '', historiqueLoyer:[{du:debutHist, loyerHC:loyer, charges:ch, motif:ex?'Loyer en vigueur à la reprise':'Loyer initial'}],
    extras: ex && num(d.soldeInitial) ? [{id:uid('ex'), date:d.suiviDepuis||todayISO(), libelle:num(d.soldeInitial)>0?'Arriéré repris':'Avance reprise', montant:num(d.soldeInitial)}] : [],
    createdAt:todayISO() };
}
function wizVisible(){ return WIZ_STEPS.filter(s=>!(s.skip && s.skip(WIZ.d))); }
function wizOpen(){
  const steps=wizVisible(); const st=steps[WIZ.step]; const n=steps.length;
  let body='';
  if(st.k==='locataires') body=wizLocatairesHtml();
  else if(st.k==='recap') body=wizRecapHtml();
  else body=`<form onsubmit="return false">${formHtml(st.fields(WIZ.d).filter(f=>!f.show||f.show()),'wz')}</form>`;
  if(WIZ.modal) WIZ.modal.close();
  WIZ.modal=openModal({ title:`<span class="wizstep">Étape ${WIZ.step+1} / ${n}</span> ${st.t}`, wide:true, sticky:true, body:`<div class="wizbar"><span style="width:${(WIZ.step+1)/n*100}%"></span></div><div class="wizbody">${body}</div>`,
    actions:[ {label:WIZ.step?'← Précédent':'Annuler', onClick:()=>{ wizCollect(); if(WIZ.step){ WIZ.step--; wizOpen(); return false; } WIZ=null; }},
      st.k==='recap' ? {label: WIZ.d.existant==='existant'?'Enregistrer le bail':'Créer le bail', cls:'btn-amber', onClick:()=>wizFinish()} : {label:'Suivant →', cls:'btn-teal', onClick:()=>{ wizCollect(); const err=st.valid&&st.valid(WIZ.d); if(err){ toast(err, 5000); return false; } const bg=WIZ.modal.el; if(!formCheckRequired(bg)) return false; WIZ.step++; wizOpen(); return false; }} ]});
  const el=WIZ.modal.el;
  if(st.k==='loyer'){ const upd=()=>{ wizCollect(); const b=wizBuildBail(); const c=controlesBail(b, WIZ.bien).filter(x=>/loyer|Dépôt|dépôt|Zone|Encadrement|Complément|classé/i.test(x.t)); const box=el.querySelector('#wizChecks'); if(box) box.innerHTML = c.length?`<ul class="checks">${c.map(x=>`<li class="${x.lv}">${esc(x.t)}</li>`).join('')}</ul>`:''; const dep=el.querySelector('[name=depot]'); if(dep){ dep.placeholder='max '+eur(depotMax(b)); if(dep.dataset.touched!=='1' && num(WIZ.d.loyerHC)>0){ dep.value=String(depotMax(b)).replace('.',','); WIZ.d.depot=depotMax(b); } } };
    const depIn=el.querySelector('[name=depot]'); if(depIn){ if(WIZ.d.depot!=='' && WIZ.d.depot!==undefined) depIn.dataset.touched=String(WIZ.d.depot)!==String(depotMax(wizBuildBail()))?'1':''; depIn.addEventListener('input', ()=>depIn.dataset.touched='1'); }
    el.addEventListener('input', upd); el.addEventListener('change', upd); upd();
    }
  if(st.k==='garant'){ const t=()=>{ const v=(el.querySelector('[name=garantType]:checked')||{}).value; ['g_prenom','g_nom','g_adresse','g_email','g_tel'].forEach(n=>{ const f=el.querySelector(`[data-fname=${n}]`); if(f) f.style.display=v==='personne'?'':'none'; }); const vf=el.querySelector('[data-fname=visa]'); if(vf) vf.style.display=v==='visale'?'':'none'; }; el.addEventListener('change', t); t(); }
  if(st.k==='duree'){ const t=()=>{ const v=(el.querySelector('[name=dureeReduite]:checked')||{}).value; ['dureeMois','motifDureeReduite'].forEach(n=>{ const f=el.querySelector(`[data-fname=${n}]`); if(f) f.style.display=v==='oui'?'':'none'; }); }; el.addEventListener('change', t); t(); }
  if(st.k==='paiement'){ const t=()=>{ const f=el.querySelector('[data-fname=aplMontant]'); f.style.display=el.querySelector('[name=aplTiersPayant]').checked?'':'none'; }; el.addEventListener('change', t); t(); }
  if(st.k==='locataires'){ el.querySelector('#addLoc').onclick=()=>{ wizCollect(); WIZ.d.locataires.push({id:uid('lo')}); wizOpen(); }; el.querySelectorAll('[data-delloc]').forEach(b=>b.onclick=()=>{ wizCollect(); WIZ.d.locataires.splice(+b.dataset.delloc,1); wizOpen(); }); }
}
function wizLocatairesHtml(){
  const L=WIZ.d.locataires;
  return `<p class="hint">Plusieurs locataires (couple non marié, colocation) : ajoutez-les tous. Ils seront tenus <b>solidairement</b> (chacun peut être tenu de payer la totalité).</p>
    ${L.map((l,i)=>`<fieldset class="locblock" data-loc="${i}"><legend>Locataire ${i+1}${L.length>1?` <button type="button" class="linkbtn" data-delloc="${i}">retirer</button>`:''}</legend>${formHtml([
      {n:'civilite', l:'Civilité', t:'select', v:l.civilite||'', o:[['',''],['Madame','Madame'],['Monsieur','Monsieur']], col:3}, {n:'prenom', l:'Prénom', t:'text', v:l.prenom, req:i===0, col:3}, {n:'nom', l:'Nom', t:'text', v:l.nom, req:i===0, col:3},
      {n:'email', l:'E-mail', t:'text', v:l.email, col:2}, {n:'tel', l:'Téléphone portable', t:'text', v:l.tel, col:2},
      {n:'adresseAvant', l:'Adresse actuelle (avant l\'entrée)', t:'text', v:l.adresseAvant}],'lo'+i)}</fieldset>`).join('')}
    ${L.length<6?'<button type="button" class="btn btn-ghost btn-sm" id="addLoc">+ Ajouter un locataire</button>':''}`;
}
function wizCollect(){
  if(!WIZ||!WIZ.modal) return; const el=WIZ.modal.el;
  const blocks=el.querySelectorAll('.locblock');
  if(blocks.length){ blocks.forEach(b=>{ const i=+b.dataset.loc; Object.assign(WIZ.d.locataires[i], formValues(b)); }); return; }
  const f=el.querySelector('form'); if(!f) return; const v=formValues(f);
  for(const k in v){
    if(k.startsWith('g_')) WIZ.d.garant[k.slice(2)]=v[k];
    else if(k!=='i' && k!=='i2' && k!=='live') WIZ.d[k]=v[k];
  }
}
function wizRecapHtml(){
  const b=wizBuildBail(); const ctl=controlesBail(b, WIZ.bien); const errs=ctl.filter(c=>c.lv==='err');
  const prem=echeancesBail(Object.assign({},b,{statut:'actif'}), b.dateDebut)[0];
  return `<div class="grid2"><div class="card flat"><h3>${TYPES_BAIL[b.type].l}</h3><dl class="dl">
    <dt>Logement</dt><dd>${esc(nomBien(WIZ.bien))}</dd><dt>Locataire(s)</dt><dd>${esc(nomsLocataires(b))}</dd>
    <dt>Durée</dt><dd>${b.type==='mobilite'?b.dureeMois+' mois':b.type==='etudiant'?'9 mois':b.type==='meuble'?'1 an reconductible':b.dureeReduite?b.dureeMois+' mois (durée réduite)':'3 ans reconductibles'}</dd>
    <dt>Début</dt><dd>${fdate(b.dateDebut)}</dd><dt>Loyer</dt><dd>${eur(b.loyerHC)} + ${eur(b.charges)} de charges (${b.chargesType})</dd>
    ${prem&&prem.prorata<1?`<dt>1er mois (prorata)</dt><dd>${eur(prem.montant)}</dd>`:''}
    <dt>Dépôt de garantie</dt><dd>${eur(b.depot)}</dd><dt>Garantie</dt><dd>${b.garants.map(g=>g.type==='visale'?'Visale':nomPersonne(g)).join(', ')||'Aucune'}</dd>
    <dt>Préavis du locataire</dt><dd>${preavisLocataire(Object.assign({}, b, {bienId:WIZ.bien.id}))} mois</dd></dl></div>
    <div class="card flat"><h3>Contrôle de conformité</h3><ul class="checks">${ctl.map(c=>`<li class="${c.lv}">${esc(c.t)}</li>`).join('')}</ul>
    ${errs.length?`<p class="neg"><b>${plural(errs.length,'point bloquant','points bloquants')}</b> : corrigez-les (bouton Précédent) avant de signer. Vous pouvez enregistrer le bail en brouillon en attendant.</p>`:'<p class="pos"><b>Aucun point bloquant.</b></p>'}</div></div>
    ${WIZ.d.existant==='existant'?'<p class="hint">Le bail sera enregistré comme <b>en cours</b>. Le suivi des loyers démarre le '+fdate(b.suiviDepuis||b.dateDebut)+'.</p>':'<p class="hint">Le bail sera créé <b>en préparation</b>. Étapes suivantes : imprimer et signer le bail (avec ses annexes), faire l\'état des lieux d\'entrée, remettre les clés, puis indiquer « Le bail est signé ».</p>'}`;
}
function wizFinish(){
  const b=wizBuildBail();
  if(WIZ.d.garantType==='gli'){ WIZ.bien.gli=true; upsert('biens', WIZ.bien); }
  upsert('baux', b);
  const bienId=WIZ.bien.id, ex=WIZ.d.existant==='existant'; WIZ=null;
  toast(ex?'Bail enregistré : les loyers sont suivis.':'Bail créé en préparation.');
  go('bien',{id:bienId});
  if(!ex) setTimeout(()=>openDoc('contrat_bail', b.id), 250);
}

/* ---------------- Modifier un bail ---------------- */
function editBail(bailId){
  const b=byId('baux',bailId); const l=b.locataires||[];
  const m=openModal({title:'Modifier le bail', wide:true, body:`<form onsubmit="return false">${formHtml([
    {t:'section', l:'Locataires'}, ...l.flatMap((x,i)=>[{n:`l${i}_prenom`, l:'Prénom', t:'text', v:x.prenom, col:3},{n:`l${i}_nom`, l:'Nom', t:'text', v:x.nom, col:3},{n:`l${i}_email`, l:'E-mail', t:'text', v:x.email, col:3},{n:`l${i}_tel`, l:'Téléphone', t:'text', v:x.tel, col:2},{n:`l${i}_adresseAvant`, l:'Adresse précédente', t:'text', v:x.adresseAvant, col:2}]),
    {t:'section', l:'Paiement'}, {n:'jourPaiement', l:'Jour de paiement', t:'number', v:b.jourPaiement, col:3}, {n:'modePaiement', l:'Mode', t:'text', v:b.modePaiement, col:3}, {n:'iban', l:'IBAN', t:'text', v:b.iban, col:3},
    {n:'aplTiersPayant', l:'Aide au logement versée directement au bailleur', t:'check', v:b.aplTiersPayant}, {n:'aplMontant', l:'Montant de l\'aide (€)', t:'number', v:b.aplMontant, col:2}, {n:'numAllocataire', l:'N° allocataire', t:'text', v:b.numAllocataire, col:2},
    {t:'section', l:'Autres informations'}, {n:'dateSignature', l:'Date de signature', t:'date', v:b.dateSignature, col:2}, {n:'lieuSignature', l:'Lieu', t:'text', v:b.lieuSignature, col:2},
    {n:'dateRevisionBase', l:'Date de révision annuelle (si différente de la date d\'effet)', t:'date', v:b.dateRevisionBase, col:2}, {n:'revision', l:'Révision IRL prévue au bail', t:'check', v:b.revision!==false},
    {n:'conditionsParticulieres', l:'Conditions particulières', t:'textarea', v:b.conditionsParticulieres},
    {n:'i', t:'info', l:'Pour changer le loyer en cours de bail : utilisez la révision IRL (Courriers) ou un avenant signé. Le loyer ne peut pas être augmenté autrement. Le dépôt de garantie ne peut pas être révisé.'}],'eb')}</form>`,
    actions:[{label:'Annuler'},{label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ const v=formValues(bg);
      l.forEach((x,i)=>['prenom','nom','email','tel','adresseAvant'].forEach(k=>x[k]=v[`l${i}_${k}`]));
      ['jourPaiement','modePaiement','iban','aplTiersPayant','aplMontant','numAllocataire','dateSignature','lieuSignature','dateRevisionBase','conditionsParticulieres'].forEach(k=>b[k]=v[k]); b.revision=v.revision;
      if(b.statut==='brouillon'){ /* le brouillon peut encore tout changer : relancer l'assistant */ }
      upsert('baux',b); toast('Bail mis à jour.'); refresh(); }}]});
}
function openAssurance(bailId){
  const b=byId('baux',bailId);
  openModal({title:'Attestation d\'assurance du locataire', body:formHtml([{n:'assureur', l:'Assureur', t:'text', v:b.assureur, col:2},{n:'assuranceEcheance', l:'Valable jusqu\'au', t:'date', v:b.assuranceEcheance||addMonths(todayISO(),12), req:true, col:2},{n:'i', t:'info', l:'À défaut d\'attestation, vous pouvez, un mois après une mise en demeure, souscrire une assurance pour le compte du locataire et lui en refacturer le coût (+10 % maximum), ou mettre en œuvre la clause résolutoire.'}],'as'),
    actions:[{label:'Annuler'},{label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ const v=formValues(bg); b.assureur=v.assureur; b.assuranceEcheance=v.assuranceEcheance; upsert('baux',b); toast('Attestation enregistrée.'); refresh(); }}]});
}

/* =====================================================================================
   GUIDES « QUE FAIRE SI… »
   ===================================================================================== */
const GUIDES = {
  mobile:{t:'Pas à pas : l\'appli sur iPhone et Android', c:()=>`
    <p>Adresse de l'appli : <b>https://fadhelis01-boop.github.io/clef-en-main/</b></p>
    <h3>1. Installer l'appli (5 minutes, une seule fois)</h3>
    <div class="grid2"><div class="card flat"><h4>📱 iPhone / iPad</h4><ol class="steps">
      <li>Ouvrez l'adresse dans <b>Safari</b>.</li>
      <li>Touchez le bouton <b>Partager</b> (carré avec une flèche vers le haut, en bas de l'écran).</li>
      <li>Faites défiler et touchez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li>
      <li>Ouvrez désormais l'appli <b>uniquement par l'icône « Clef en Main »</b> de l'écran d'accueil.</li></ol>
      <p class="small warnc">Important sur iPhone : un site ouvert seulement dans Safari peut voir ses données effacées par Apple après quelques jours sans visite. Installée sur l'écran d'accueil, l'appli est protégée. Faites aussi votre copie de sécurité chaque mois (étape 3).</p></div>
    <div class="card flat"><h4>🤖 Android</h4><ol class="steps">
      <li>Ouvrez l'adresse dans <b>Chrome</b>.</li>
      <li>Touchez le menu <b>⋮</b> (en haut à droite).</li>
      <li>Touchez <b>« Installer l'application »</b> (ou « Ajouter à l'écran d'accueil »), puis <b>Installer</b>.</li>
      <li>L'icône « Clef en Main » apparaît avec vos autres applications.</li></ol></div></div>
    <p class="small">Une fois installée, l'appli fonctionne <b>sans connexion</b> (sauf l'envoi d'e-mails). Vos données sont enregistrées <b>uniquement sur l'appareil</b> : rien n'est envoyé sur Internet.</p>
    <h3>2. Premier lancement</h3>
    <ol class="steps"><li><b>Si vous avez déjà vos données sur un autre appareil</b> : ne saisissez rien, passez directement à l'étape 3 « Passer d'un appareil à l'autre ».</li>
      <li>Sinon : touchez <b>Commencer</b>, saisissez vos coordonnées de propriétaire, puis votre logement. L'assistant « Louer ce logement » vous pose ensuite les questions du bail (ou reprend un bail déjà en cours).</li></ol>
    <h3>3. Copie de sécurité et passage d'un appareil à l'autre</h3>
    <ol class="steps"><li><b>Faire la copie</b> (sur l'appareil où vous venez de travailler) : menu <b>☰ Plus</b> › <b>Copie de sécurité</b> › <b>Faire la copie</b>.
        <br>iPhone : choisissez <b>« Enregistrer dans Fichiers »</b> (iCloud Drive) ou envoyez-la-vous par e-mail. Android : choisissez <b>Drive</b> ou <b>Gmail</b>. Sur ordinateur, le fichier <code>.clef</code> est téléchargé.</li>
      <li><b>Restaurer la copie sur l'autre appareil</b> : ouvrez Clef en Main › <b>☰ Plus</b> › <b>Copie de sécurité</b> › <b>Choisir le fichier…</b>, puis sélectionnez la copie (dans Fichiers, Drive ou les téléchargements). Les données sont <b>fusionnées</b> : rien n'est perdu sur aucun des deux appareils.</li>
      <li><b>Option</b> : cochez « Protéger la copie par un mot de passe » si vous la rangez en ligne (Drive, iCloud, e-mail). Notez ce mot de passe : sans lui, la copie ne peut pas être ouverte.</li>
      <li><b>Le bon rythme</b> : une copie par mois (l'accueil vous le rappelle ; Réglages › « Rappel mensuel dans mon agenda » ajoute un rappel à votre agenda), et toujours avant de changer de téléphone. Si vous travaillez sur deux appareils, faites la copie sur celui que vous venez d'utiliser et restaurez-la sur l'autre avant de continuer.</li></ol>
    <h3>4. Au quotidien sur le téléphone</h3>
    <ul><li><b>Le loyer est arrivé</b> : onglet <b>Loyers</b> › <b>Encaissé</b>. L'appli propose aussitôt la quittance.</li>
      <li><b>Envoyer un document par e-mail</b> : <b>Ouvrir / envoyer</b> › <b>Par e-mail</b>. La liste de partage du téléphone s'ouvre avec le PDF déjà joint : choisissez Mail, Gmail ou Outlook.</li>
      <li><b>Garder un PDF</b> : bouton <b>PDF</b> › iPhone : « Enregistrer dans Fichiers » ; Android : dossier Téléchargements.</li>
      <li><b>Imprimer</b> : bouton <b>Imprimer</b> (imprimante AirPrint ou Wi-Fi). Pour un recommandé sans vous déplacer : <b>Par courrier</b> › « lettre recommandée en ligne ».</li>
      <li><b>État des lieux sur place</b> : le bouton 📷 de chaque élément ouvre l'appareil photo. Tout est enregistré au fur et à mesure : un appel ou l'écran qui se verrouille ne fait rien perdre (« Fermer (garder le brouillon) »).</li>
      <li><b>Une dépense</b> (taxe foncière, facture) : Accueil › Raccourcis › <b>Ajouter une dépense</b>.</li>
      <li><b>À faire</b> : l'accueil liste les urgences du jour (impayés, révision du loyer, assurance, régularisation des charges, fin de bail) avec le bon bouton à chaque fois.</li></ul>
    <h3>5. Bon à savoir</h3>
    <ul><li><b>Mises à jour</b> : quand un bandeau « Nouvelle version » apparaît, touchez <b>Mettre à jour</b>. Les règles légales (indice des loyers, etc.) se mettent à jour toutes seules.</li>
      <li><b>Pas de notifications</b> quand l'appli est fermée : ouvrez-la une fois par semaine, ou au début du mois, pour voir les tâches.</li>
      <li><b>Changement de téléphone</b> : faites une copie sur l'ancien, installez l'appli sur le nouveau, restaurez la copie. En cas de perte ou de vol, vous repartez de votre dernière copie : d'où l'intérêt de la faire chaque mois.</li>
      <li><b>Ne videz pas les données du navigateur</b> (Réglages Safari › Effacer historique et données, ou Chrome › Effacer les données) : cela effacerait aussi vos données de l'appli. Faites d'abord une copie.</li>
      <li><b>Sécurité</b> : verrouillez votre téléphone par code ou biométrie ; l'appli contient des données personnelles de vos locataires. Protégez par mot de passe les copies rangées en ligne.</li></ul>`},
  impayes:{t:'Mon locataire ne paie plus', c:()=>`<ol class="steps">
    <li><b>Dès 3 à 5 jours de retard</b> : un appel ou un e-mail amiable (« Relance » niveau 1). Souvent un oubli.</li>
    <li><b>Après 10 à 15 jours</b> : relance ferme par écrit. Proposez un échéancier si la difficulté est passagère (modèle « Plan d'apurement »). Orientez vers la CAF/MSA, le FSL, l'ADIL.</li>
    <li><b>Si l'aide au logement vous est versée</b> : signalement obligatoire à la CAF/MSA dès que l'impayé atteint 2 mois.</li>
    <li><b>Caution</b> : informez-la dès le premier incident ; vous pourrez l'appeler en paiement. Visale : déclarez l'impayé en ligne sur visale.fr.</li>
    <li><b>Mise en demeure</b> par lettre recommandée (8 jours).</li>
    <li><b>Commandement de payer</b> par un commissaire de justice : il vise la clause résolutoire. Le locataire a ${R('commandementDelai')} semaines pour payer. Le commandement est dénoncé à la caution sous 15 jours ; la CCAPEX est informée.</li>
    <li><b>Assignation</b> devant le juge des contentieux de la protection (assistance d'un avocat conseillée), qui peut accorder des délais ou constater la résiliation et ordonner l'expulsion.</li>
    <li><b>Expulsion</b> : uniquement par un commissaire de justice, jamais pendant la trêve hivernale (1er novembre – 31 mars). Changer les serrures ou couper l'eau soi-même est un délit.</li></ol>
    <p class="hint">Interdits : pénalités de retard, frais de relance facturés, retenue sur salaire sans jugement. Les loyers impayés se prescrivent par ${R('prescriptionLoyers')} ans.</p>`},
  depart:{t:'Mon locataire s\'en va', c:()=>`<ol class="steps"><li><b>Congé reçu</b> : vérifiez la date de réception (point de départ du préavis) et le préavis : 3 mois en vide (1 mois en zone tendue ou cas prévus : mutation, perte d'emploi, santé, RSA/AAH, logement social — avec justificatif), 1 mois en meublé.</li><li>Envoyez l'accusé de réception (modèle « Réponse au congé ») : date de fin, nouvelle adresse, rendez-vous d'état des lieux.</li><li>Pendant le préavis : visites limitées à 2 heures par jour ouvrable.</li><li><b>État des lieux de sortie</b> : comparé automatiquement à l'entrée. Sans état des lieux de sortie, vous ne pouvez rien retenir.</li><li><b>Dépôt de garantie</b> : 1 mois (sortie conforme) ou 2 mois (dégradations), sinon +10 % du loyer par mois de retard. Retenues uniquement justifiées (devis, factures) et en tenant compte de la vétusté.</li><li>Relevez les compteurs, récupérez toutes les clés, faites la déclaration d'occupation sur impots.gouv.fr si le logement reste vide ou change d'occupant.</li><li>Le bail passe ensuite en « Terminé » : le logement est libre pour un nouveau bail, l'historique est conservé.</li></ol>`},
  vente:{t:'Je veux vendre ou récupérer mon logement', c:()=>`<p>Vous ne pouvez reprendre un logement loué qu'<b>à l'échéance du bail</b>, avec un préavis de 6 mois (vide) ou 3 mois (meublé), et pour l'un de ces trois motifs : <b>vente</b>, <b>reprise pour habiter</b> (vous, conjoint/partenaire/concubin, ascendants, descendants) ou <b>motif légitime et sérieux</b> (manquements du locataire).</p><ul><li>Vente d'un logement vide : le locataire a un droit de préemption (le congé vaut offre de vente, 2 mois pour accepter).</li><li>Locataire de plus de 65 ans aux ressources modestes : relogement à proposer (sauf exceptions).</li><li>Vous pouvez aussi <b>vendre le logement occupé</b> à tout moment : le bail continue avec l'acheteur, à qui vous transférez le dépôt de garantie.</li><li>Logement acheté occupé : congé pour vente impossible avant le terme du premier renouvellement ; congé pour reprise après 2 ans de propriété.</li></ul><p class="hint">Un congé frauduleux est puni d'une amende pénale jusqu'à 6 000 € (30 000 € pour une société).</p>`},
  deces:{t:'Décès ou abandon du logement', c:()=>`<h3>Décès du locataire</h3><p>Le bail est transféré (article 14 de la loi de 1989) au conjoint, au partenaire de PACS, au concubin notoire ou aux proches qui vivaient avec lui depuis au moins un an (descendants, ascendants, personnes à charge). Sinon, le bail est résilié de plein droit par le décès ; la succession reste redevable des sommes dues jusqu'à la restitution des clés.</p><h3>Décès du bailleur</h3><p>Le bail continue avec les héritiers.</p><h3>Abandon du logement</h3><p>Si le locataire a disparu, ne changez pas les serrures : la procédure de l'article 14-1 passe par un commissaire de justice (mise en demeure de justifier de l'occupation, constat d'abandon après un mois, puis décision du juge).</p><h3>Couple</h3><p>Les époux sont cotitulaires du bail de plein droit, même si un seul a signé ; les partenaires de PACS le deviennent sur demande conjointe.</p>`},
  travaux:{t:'Travaux, réparations, décence', c:()=>`<ul><li><b>À votre charge</b> : grosses réparations, mise en conformité, remplacement des équipements vétustes, décence (chauffage, électricité, humidité, performance énergétique).</li><li><b>À la charge du locataire</b> : entretien courant et menues réparations (décret n° 87-712 : joints, ampoules, entretien de la chaudière, débouchage…), sauf vétusté, malfaçon ou force majeure.</li><li>Travaux en cours de bail : prévenez le locataire par écrit (modèle « Information de travaux ») ; au-delà de 21 jours, baisse de loyer proportionnelle.</li><li>Le locataire ne peut transformer le logement sans accord écrit. Ses demandes d'adaptation (handicap, perte d'autonomie, rénovation énergétique) valent accord si vous ne répondez pas dans les 2 mois.</li><li>Logement non décent : le locataire peut saisir la commission de conciliation puis le juge ; la CAF peut suspendre le versement de l'aide au bailleur.</li><li>Rénovation énergétique : renseignez-vous sur MaPrimeRénov' (france-renov.gouv.fr), éco-PTZ, et le déficit foncier.</li></ul>`},
  litige:{t:'Un désaccord avec mon locataire', c:()=>`<ol class="steps"><li>Dialogue et écrit : un e-mail ou un courrier qui rappelle les faits et la règle.</li><li><b>ADIL</b> : conseil juridique gratuit et neutre, pour vous comme pour le locataire (0 805 160 075).</li><li><b>Commission départementale de conciliation</b> (gratuite) : dépôt de garantie, charges, état des lieux, réparations, loyer, décence, congés. Modèle « Saisine de la commission ».</li><li><b>Conciliateur de justice</b> (gratuit) : tentative amiable obligatoire avant le juge pour les litiges de moins de 5 000 €.</li><li><b>Juge des contentieux de la protection</b> du tribunal judiciaire.</li></ol>`},
  colocation:{t:'Colocation et départ d\'un colocataire', c:()=>`<ul><li>Un bail unique signé par tous, avec clause de solidarité : chacun peut devoir la totalité du loyer.</li><li>Quand un colocataire part (congé individuel), sa solidarité et celle de sa caution cessent dès qu'un remplaçant figure au bail, ou au plus tard 6 mois après la fin de son préavis.</li><li>Entrée d'un nouveau colocataire : avenant signé par tous (modèle « Avenant »), nouvel état des lieux partiel conseillé.</li><li>Le dépôt de garantie est en principe restitué à la fin du bail, pas à chaque départ (sauf accord).</li></ul>`},
  souslocation:{t:'Sous-location, Airbnb, animaux', c:()=>`<ul><li>Sous-location interdite sans votre accord écrit, y compris sur le prix. En cas de location touristique illégale, vous pouvez réclamer les sommes perçues par le locataire.</li><li>Héberger des proches est un droit du locataire (pas de clause contraire).</li><li>Animaux : une clause d'interdiction est nulle, sauf pour les chiens d'attaque (1re catégorie). Le locataire répond des dégâts.</li><li>Tabac : une interdiction de fumer dans le logement n'est pas valable ; seules les dégradations (jaunissement) peuvent être retenues.</li></ul>`},
  candidats:{t:'Choisir un locataire sans risque juridique', c:()=>`<p>Pièces autorisées (liste limitative, décret n° 2015-1437) :</p><ul>${REG.piecesCandidat.map(p=>'<li>'+esc(p)+'</li>').join('')}</ul><p>Pièces interdites (amende jusqu'à 3 000 € pour un particulier) :</p><ul>${REG.piecesInterdites.map(p=>'<li>'+esc(p)+'</li>').join('')}</ul><p>Discrimination interdite (origine, sexe, âge, situation de famille, santé, handicap, opinions…). Méfiez-vous des faux dossiers : vérifiez l'avis d'imposition sur impots.gouv.fr (service de vérification) et les bulletins de salaire. La garantie Visale est gratuite pour vous et couvre les impayés.</p>`},
  fiscalite:{t:'Impôts et obligations du propriétaire', c:()=>`<ul><li><b>Location vide</b> : revenus fonciers. Micro-foncier si loyers ≤ ${eur0(R('microFoncierPlafond'))} (abattement ${R('microFoncierAbattement')} %), sinon régime réel (2044) — possible sur option, irrévocable 3 ans.</li><li><b>Location meublée</b> : BIC. Micro-BIC (abattement ${R('microBicAbattement')} %, plafond ${eur0(R('microBicPlafond'))}) ou réel avec amortissements. Immatriculation obligatoire (SIRET), CFE annuelle.</li><li>Prélèvements sociaux : ${R('prelevementsSociaux')} % sur les revenus fonciers.</li><li>Chaque année avant le 1er juillet : déclaration d'occupation de vos logements sur impots.gouv.fr si un occupant a changé.</li><li>Taxe foncière à votre charge (la part TEOM est récupérable). Logement vide durablement : taxe sur les logements vacants possible (réforme en 2027).</li><li>Conservez factures et justificatifs ${R('conservFiscal')} ans.</li></ul><p class="hint">L'onglet « Bilan & impôts » calcule vos montants. Pour un choix de régime ou un investissement (dispositif « Jeanbrun », déficit foncier, LMNP au réel), un conseiller fiscal ou un expert-comptable est recommandé.</p>`},
  appareils:{t:'Utiliser l\'appli sur plusieurs appareils', c:()=>`<ol class="steps"><li>Installez l'appli sur chaque appareil (Réglages › Installer).</li><li>Sur l'appareil où vous avez travaillé : « Sauvegarde › Faire une copie ». Rangez le fichier dans Google Drive, iCloud Drive, OneDrive, ou envoyez-le-vous par e-mail.</li><li>Sur l'autre appareil : « Sauvegarde › Ouvrir une copie ». Les données sont fusionnées : rien n'est écrasé, la version la plus récente de chaque fiche l'emporte.</li></ol><p class="hint">Vos données ne quittent jamais vos appareils sans votre action : aucun compte, aucun serveur. Protégez la copie par un mot de passe si vous la rangez en ligne.</p>`}
};
function openGuide(k){ const g=GUIDES[k]; if(!g) return; openModal({title:'🧭 '+g.t, wide:true, body:`<div class="prose">${g.c()}</div>`, actions:[{label:'Fermer'}]}); }
function scrAide(m){
  m.innerHTML = head('Aide & guides', 'Les réponses aux situations courantes, expliquées simplement, avec les bons modèles de courrier.') +
    `<div class="grid3">${Object.keys(GUIDES).map(k=>tile('teal','🧭',GUIDES[k].t,'', `openGuide('${k}')`)).join('')}</div>
    <div class="card"><h3>Besoin d'un conseil personnalisé ?</h3><p>L'<b>ADIL</b> (Agence départementale d'information sur le logement) conseille gratuitement les propriétaires et les locataires : <a href="https://www.anil.org/lanil-et-les-adil/votre-adil/" target="_blank" rel="noopener">trouver votre ADIL</a> — 0 805 160 075 (appel gratuit).</p>
    <p>Textes officiels : <a href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000509310" target="_blank" rel="noopener">loi du 6 juillet 1989</a> · <a href="https://www.service-public.fr/particuliers/vosdroits/N337" target="_blank" rel="noopener">fiches Service-public « Location immobilière »</a>.</p></div>`;
}
