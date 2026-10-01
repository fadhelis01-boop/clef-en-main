/* =====================================================================================
   MÉTIER — règles de gestion : biens (6 maximum), cycle de vie du bail, compte locatif,
   contrôles de conformité, révision IRL, régularisation des charges, dépôt de garantie,
   alertes « à faire ». Toutes les valeurs légales viennent de R() (regles.js).
   ===================================================================================== */
const TYPES_BAIL = {
  vide:     {l:'Location vide', court:'Vide', meuble:false},
  meuble:   {l:'Location meublée', court:'Meublé', meuble:true},
  etudiant: {l:'Meublé étudiant (9 mois)', court:'Étudiant', meuble:true},
  mobilite: {l:'Bail mobilité (1 à 10 mois)', court:'Mobilité', meuble:true}
};
const STATUTS_BAIL = {
  brouillon:{l:'Brouillon', c:'grey'}, actif:{l:'En cours', c:'teal'}, preavis:{l:'Préavis en cours', c:'amber'},
  sortie:{l:'Parti — à solder', c:'brick'}, termine:{l:'Terminé (archivé)', c:'grey'}
};
const CLASSES = ['A','B','C','D','E','F','G'];

/* ---- Accès ---- */
function biensActifs(){ return STATE.biens.filter(b=>b.statut!=='archive'); }
function bauxDuBien(bienId){ return STATE.baux.filter(b=>b.bienId===bienId).sort((a,b)=>(b.dateDebut||'').localeCompare(a.dateDebut||'')); }
function bailCourant(bienId){ return STATE.baux.find(b=>b.bienId===bienId && ['brouillon','actif','preavis','sortie'].includes(b.statut)) || null; }
function bailOccupe(bienId){ return STATE.baux.find(b=>b.bienId===bienId && ['actif','preavis'].includes(b.statut)) || null; }
function bauxEnCours(){ return STATE.baux.filter(b=>['actif','preavis'].includes(b.statut)); }
function bailleurDe(x){ return byId('bailleurs', x.bailleurId) || (x.bienId && byId('bailleurs', (byId('biens',x.bienId)||{}).bailleurId)) || {}; }
function bienDe(bail){ return byId('biens', bail.bienId) || {}; }
function nomBailleur(bl){ if(!bl) return '—'; return (bl.type==='sci'||bl.type==='morale') ? (bl.raison||'Société') : [bl.prenom, bl.nom].filter(Boolean).join(' ') || '—'; }
function nomPersonne(p){ return p ? [p.civilite, p.prenom, p.nom].filter(Boolean).join(' ') : '—'; }
function nomsLocataires(bail){ return (bail.locataires||[]).map(l=>[l.prenom,l.nom].filter(Boolean).join(' ')).join(' et ') || '—'; }
function adresseBien(bien, court){ if(!bien) return '—'; const a=[bien.adresse, bien.complement].filter(Boolean).join(', '); return court? a : a+', '+(bien.cp||'')+' '+(bien.ville||''); }
function nomBien(bien){ return bien.surnom || adresseBien(bien, true) || 'Bien sans adresse'; }
function estMeuble(bail){ return TYPES_BAIL[bail.type]?.meuble; }
function dpeClasse(bien){ return ((bien.dpe||{}).classe||'').toUpperCase(); }

/* ---- Durée, échéances ---- */
function dureeLegale(bail){
  const bl=bailleurDe(bail);
  if(bail.type==='vide') return bail.dureeReduite ? Math.max(num(bail.dureeMois), R('dureeReduiteMin')) : (bl.type==='morale' ? R('dureeVideMorale') : R('dureeVidePhysique'));
  if(bail.type==='meuble') return R('dureeMeuble');
  if(bail.type==='etudiant') return R('dureeEtudiant');
  return Math.min(Math.max(num(bail.dureeMois)||1,1), R('dureeMobiliteMax'));
}
function reconductible(bail){ return bail.type==='vide' || bail.type==='meuble'; }
/* fin de la période en cours (date incluse = veille de l'anniversaire) */
function echeanceBail(bail, refISO){
  if(!bail.dateDebut) return null;
  const ref=refISO||todayISO(); const d=num(bail.dureeMois)||dureeLegale(bail);
  let fin=addDays(addMonths(bail.dateDebut, d), -1);
  if(!reconductible(bail)) return fin;
  // reconduction tacite : vide = même durée (3 ou 6 ans ; durée réduite → 3 ans), meublé = 1 an
  const step = bail.type==='meuble' ? 12 : (bailleurDe(bail).type==='morale'?72:36);
  let debut=bail.dateDebut, n=0;
  while(fin < ref && n<40){ debut=addDays(fin,1); fin=addDays(addMonths(debut, step), -1); n++; }
  return fin;
}
function dateLimiteCongeBailleur(bail){
  const ech=echeanceBail(bail); if(!ech || !reconductible(bail)) return null;
  const m = bail.type==='vide' ? R('preavisBailleurVide') : R('preavisBailleurMeuble');
  return {echeance:ech, limite:addMonths(addDays(ech,1), -m), mois:m};
}
function preavisLocataire(bail, reduit){
  if(bail.type!=='vide') return R('preavisLocMeuble');
  return (reduit || bienDe(bail).zoneTendue) ? R('preavisLocReduit') : R('preavisLocVide');
}

/* ---- Loyer applicable ---- */
function loyerA(bail, iso){
  const h=(bail.historiqueLoyer&&bail.historiqueLoyer.length)? [...bail.historiqueLoyer].sort((a,b)=>a.du.localeCompare(b.du)) : [{du:bail.dateDebut, loyerHC:bail.loyerHC, charges:bail.charges}];
  let cur=h[0]; for(const x of h){ if(x.du<=iso) cur=x; }
  return {loyerHC:num(cur.loyerHC), charges:num(cur.charges)};
}
function totalMensuel(bail){ const l=loyerA(bail, todayISO()); return r2(l.loyerHC+l.charges); }
function finEffective(bail){ return (bail.fin&&bail.fin.date) || (!reconductible(bail)&&bail.dateDebut ? echeanceBail(bail) : null); }

/* =====================================================================================
   COMPTE LOCATIF : échéances mensuelles (prorata 1er et dernier mois), paiements imputés
   sur les dettes les plus anciennes (art. 1342-10 du Code civil), régularisations.
   ===================================================================================== */
function echeancesBail(bail, untilISO){
  const out=[]; if(!bail.dateDebut || bail.statut==='brouillon') return out;
  const until = untilISO || todayISO();
  const fin = finEffective(bail);
  // bail repris en cours de route : le suivi commence au mois choisi (pas d'échéances fictives depuis l'origine)
  const start = bail.suiviDepuis && bail.suiviDepuis > bail.dateDebut ? bail.suiviDepuis : bail.dateDebut;
  let mk = monthKey(start);
  const lastKey = monthKey(fin && fin<until ? fin : until);
  let guard=0;
  while(mk<=lastKey && guard<600){
    guard++;
    const debut = start > monthFirst(mk) ? start : monthFirst(mk);
    const finM = fin && fin < monthLast(mk) ? fin : monthLast(mk);
    if(finM >= debut){
      const jours = diffDays(debut, finM)+1, dim=daysInMonth(mk);
      const prorata = jours>=dim ? 1 : jours/dim;
      const l = loyerA(bail, debut);
      const loyerHC=r2(l.loyerHC*prorata), charges=r2(l.charges*prorata);
      const jour = Math.min(num(bail.jourPaiement)||1, 28);
      let due = bail.terme==='echu' ? addMonths(mk+'-'+String(jour).padStart(2,'0'), 1) : mk+'-'+String(jour).padStart(2,'0');
      if(bail.terme!=='echu' && start===bail.dateDebut && mk===monthKey(bail.dateDebut)) due = bail.dateDebut;
      out.push({key:mk, kind:'loyer', label:'Loyer '+monthLabel(mk)+(prorata<1?' (prorata '+jours+' j)':''), debut, fin:finM, prorata, loyerHC, charges, montant:r2(loyerHC+charges), due});
    }
    mk = nextMonthKey(mk);
  }
  (bail.extras||[]).forEach(x=>{ if(x.date<=until) out.push({key:monthKey(x.date), kind:'extra', id:x.id, label:x.libelle, montant:r2(num(x.montant)), loyerHC:0, charges:r2(num(x.montant)), due:x.date}); });
  return out.sort((a,b)=>a.due.localeCompare(b.due));
}
function paiementsBail(bailId){ return STATE.paiements.filter(p=>p.bailId===bailId).sort((a,b)=>a.date.localeCompare(b.date)); }
function compteLocatif(bail, untilISO){
  const until=untilISO||todayISO();
  const lignes = echeancesBail(bail, addMonths(until, 1)).map(e=>Object.assign({}, e, {paye:0}));
  const pays = paiementsBail(bail.id);
  // crédits = paiements + avoirs (montants négatifs : trop-perçu de charges, remise…)
  const credits = pays.map(p=>({date:p.date, montant:num(p.montant), p, alloc:[]}))
    .concat(lignes.filter(l=>l.montant<0).map(l=>({date:l.due, montant:-l.montant, avoir:true, alloc:[]})))
    .sort((a,b)=>a.date.localeCompare(b.date));
  const dettes = lignes.filter(l=>l.montant>0);
  let i=0;
  for(const cr of credits){
    let rest=cr.montant;
    while(rest>0.0001 && i<dettes.length){
      const l=dettes[i]; const need=r2(l.montant-l.paye);
      if(need<=0.0001){ i++; continue; }
      const a=r2(Math.min(need,rest)); l.paye=r2(l.paye+a); rest=r2(rest-a); cr.alloc.push({l,a}); l.payeLe=cr.date; if(cr.p) l.mode=cr.p.mode;
      if(l.montant-l.paye<=0.0001) i++;
    }
    cr.reste=r2(rest);
  }
  lignes.forEach(l=>{
    if(l.montant<0) l.paye=l.montant;
    l.reste = r2(l.montant - l.paye);
    l.etat = l.montant<=0 ? 'avoir' : l.reste<=0.005 ? 'paye' : (l.due>until ? 'avenir' : (l.paye>0 ? 'partiel' : 'impaye'));
  });
  const echues = lignes.filter(l=>l.due<=until);
  const du = r2(echues.reduce((s,l)=>s+l.montant,0));
  const paye = r2(pays.filter(p=>p.date<=until).reduce((s,p)=>s+num(p.montant),0));
  return { lignes, credits, du, paye, solde: r2(du - paye), avance: r2(credits.reduce((s,c)=>s+c.reste,0)), paiements:pays };
}
function etatMois(bail, mk){
  const c=compteLocatif(bail, monthLast(mk) > todayISO() ? todayISO() : monthLast(mk));
  return c.lignes.find(l=>l.kind==='loyer' && l.key===mk) || null;
}
function moisImpayes(bail){ return compteLocatif(bail).lignes.filter(l=>l.kind==='loyer' && ['impaye','partiel'].includes(l.etat)); }

/* ---- Révision IRL ---- */
function irlReference(bail){
  const h=(bail.historiqueLoyer||[]).filter(x=>x.irlTrim).sort((a,b)=>a.du.localeCompare(b.du));
  return h.length ? h[h.length-1].irlTrim : (bail.irl||{}).trimestre || null;
}
function revisionInfo(bail){
  const bien=bienDe(bail);
  if(bail.type==='mobilite') return {possible:false, raison:'Le bail mobilité ne se révise pas.'};
  if(bail.revision===false) return {possible:false, raison:'Le bail ne contient pas de clause de révision.'};
  const cl=dpeClasse(bien);
  if((cl==='F'||cl==='G') && R('gelLoyerFG')) return {possible:false, gel:true, raison:'Logement classé '+cl+' au DPE : toute hausse de loyer est interdite (loi Climat et résilience).'};
  const ref=irlReference(bail); if(!ref) return {possible:false, raison:'Trimestre IRL de référence non renseigné dans le bail.'};
  // date anniversaire : celle prévue au bail, sinon la date de prise d'effet
  const base = bail.dateRevisionBase || bail.dateDebut;
  let anniv = base; while(anniv <= todayISO()) anniv = addMonths(anniv, 12);
  const dernierAnniv = addMonths(anniv, -12);
  const derniereRev = (bail.historiqueLoyer||[]).filter(x=>x.irlTrim).map(x=>x.du).concat(bail.derniereRevision?[bail.derniereRevision]:[]).sort().pop();
  const prochainTrim = irlMemeTrimestreAnneeSuivante(ref);
  const vRef=irlValeur(ref), vNew=irlValeur(prochainTrim);
  const l=loyerA(bail, todayISO());
  const nouveau = vRef&&vNew ? r2(l.loyerHC * vNew / vRef) : null;
  const dejaFaite = derniereRev && derniereRev >= dernierAnniv;
  const enRetard = dernierAnniv > bail.dateDebut && !dejaFaite;
  return { possible:true, ref, vRef, prochainTrim, vNew, publie:!!vNew, actuel:l.loyerHC, nouveau, hausse: nouveau? r2(nouveau-l.loyerHC):null,
    anniversaire: enRetard ? dernierAnniv : anniv, prochainAnniv:anniv, dernierAnniv, enRetard, dejaFaite,
    limite: enRetard ? addMonths(dernierAnniv,12) : addMonths(anniv,12) };
}

/* ---- Dépôt de garantie ---- */
function depotMax(bail){
  const l=num(bail.loyerHC);
  if(bail.type==='mobilite') return 0;
  return r2(l * (bail.type==='vide' ? R('depotMaxVide') : R('depotMaxMeuble')));
}
function restitutionInfo(bail){
  const f=bail.fin||{};
  if(!f.remiseCles) return null;
  const conforme = f.edlConforme!==false;
  const mois = conforme ? R('depotDelaiConforme') : R('depotDelaiNonConforme');
  const limite = addMonths(f.remiseCles, mois);
  const ref = f.depotRestitueLe || todayISO();
  let retard=0; if(ref>limite){ let d=limite; while(d<ref){ retard++; d=addMonths(d,1); } }
  const penalite = r2(retard * num(loyerA(bail, f.remiseCles).loyerHC) * R('depotPenalite')/100);
  return {limite, mois, conforme, retard, penalite};
}

/* ---- Contrôles de conformité d'un bail (avant création / signature) ---- */
function classeInterdite(classe, dateISO){
  const min=R('decenceDPE', dateISO); if(!classe) return null;
  if(min==='G+') return classe==='G' ? 'warn' : false;
  return CLASSES.indexOf(classe) > CLASSES.indexOf(min) ? 'err' : false;
}
function controlesBail(bail, bien){
  const out=[]; const add=(lv,t)=>out.push({lv,t});
  const d=bail.dateDebut||todayISO(); const cl=dpeClasse(bien);
  const loyer=num(bail.loyerHC);
  // décence énergétique
  if(!cl) add('warn','Classe DPE non renseignée : le DPE est obligatoire et sa classe conditionne la possibilité de louer.');
  else { const ci=classeInterdite(cl,d);
    if(ci==='err') add('err',`Logement classé ${cl} : il n'est plus considéré comme décent à cette date (minimum ${R('decenceDPE',d)}). Aucun nouveau bail ni renouvellement possible avant travaux.`);
    else if(ci==='warn') add('warn','Logement classé G : vérifiez que la consommation est inférieure à 450 kWh/m²/an (sinon non décent).');
    else add('ok',`Classe DPE ${cl} : location autorisée à cette date.`);
    const futur = [['2028-01-01','E'],['2034-01-01','D']].find(([dt,mn])=>dt>d && CLASSES.indexOf(cl)>CLASSES.indexOf(mn));
    if(futur && ci!=='err') add('warn',`Attention : ce logement (${cl}) ne pourra plus être loué ni renouvelé à partir du ${fdate(futur[0])}. Anticipez les travaux.`);
  }
  const dpeDate=(bien.diagnostics||{}).dpe;
  if(dpeDate){ const fin=addMonths(dpeDate, 12*R('dpeValidite')); const an=dpeDate.slice(0,4);
    if(fin<d || an<'2018' || (dpeDate<'2021-07-01' && d>='2025-01-01')) add('err','Le DPE du '+fdateCourt(dpeDate)+' n\'est plus valable : faites réaliser un nouveau DPE.'); }
  // surface
  if(bien.surface && num(bien.surface)<R('surfaceMinDecence')) add('err',`Surface de ${bien.surface} m² inférieure au minimum de décence (${R('surfaceMinDecence')} m² ou 20 m³).`);
  // durée
  if(bail.type==='vide' && bail.dureeReduite){
    if(bailleurDe(bail).type==='morale') add('err','La durée réduite n\'est possible que pour un bailleur personne physique ou SCI familiale.');
    if(!bail.motifDureeReduite) add('err','Durée réduite : l\'événement précis (familial ou professionnel) qui justifie la reprise doit être indiqué dans le bail.');
    if(num(bail.dureeMois)<R('dureeReduiteMin')) add('err','La durée réduite ne peut pas être inférieure à 1 an.');
  }
  if(bail.type==='mobilite'){
    const m=num(bail.dureeMois); if(m<1||m>R('dureeMobiliteMax')) add('err','Le bail mobilité dure de 1 à 10 mois.');
    if(!bail.motifMobilite) add('err','Bail mobilité : précisez la situation du locataire (formation, études, stage, apprentissage, service civique, mutation, mission temporaire).');
    if(bail.chargesType!=='forfait') add('err','Bail mobilité : les charges sont obligatoirement forfaitaires.');
  }
  if(bail.type==='vide' && bail.chargesType==='forfait' && (bail.locataires||[]).length<2) add('err','Location vide : le forfait de charges n\'est permis qu\'en colocation. Prévoyez une provision avec régularisation annuelle.');
  if(bail.chargesType==='provision' && num(bail.charges)===0) add('warn','Aucune provision pour charges : vous ne pourrez récupérer les charges (eau, entretien, TEOM…) qu\'en une fois, lors de la régularisation annuelle.');
  // dépôt
  const dmax=depotMax(bail);
  if(num(bail.depot)>dmax+0.005) add('err', bail.type==='mobilite' ? 'Aucun dépôt de garantie ne peut être demandé dans un bail mobilité.' : `Dépôt de garantie trop élevé : ${eur(dmax)} maximum (${bail.type==='vide'?'1 mois':'2 mois'} de loyer hors charges).`);
  else if(bail.type!=='mobilite') add('ok',`Dépôt de garantie conforme (maximum ${eur(dmax)}).`);
  // zone tendue / relocation / gel F-G
  if(bien.zoneTendue && bail.type!=='mobilite'){
    const prec=num(bail.dernierLoyer);
    if(!prec) add('warn','Zone tendue : indiquez le loyer du précédent locataire (mention obligatoire si départ depuis moins de 18 mois).');
    else if(loyer>prec+0.005 && !bail.justifHausse) add('err',`Zone tendue : le loyer (${eur(loyer)}) dépasse celui de l'ancien locataire (${eur(prec)}). Hausse possible seulement après travaux importants, révision non appliquée ou loyer sous-évalué — à justifier.`);
  }
  if((cl==='F'||cl==='G') && num(bail.dernierLoyer) && loyer>num(bail.dernierLoyer)+0.005) add('err',`Logement ${cl} : le loyer ne peut pas dépasser celui du locataire précédent (gel des loyers des passoires énergétiques).`);
  // encadrement
  const enc=bien.encadrement||{};
  if(enc.actif){
    const s=num(bien.surface), maj=num(enc.loyerRefMaj);
    if(!maj) add('warn','Encadrement des loyers : renseignez le loyer de référence majoré (€/m²) publié pour ce logement.');
    else if(s && loyer>r2(maj*s)+0.005){
      if(num(bail.complementLoyer)>0 && (cl==='F'||cl==='G')) add('err','Complément de loyer interdit pour un logement classé F ou G.');
      else if(num(bail.complementLoyer)>0 && bail.complementMotif) add('warn',`Loyer au-dessus du plafond (${eur(maj*s)}) avec complément de loyer : il doit être justifié par des caractéristiques exceptionnelles, le locataire peut le contester sous 3 mois.`);
      else add('err',`Encadrement : le loyer de base dépasse le plafond (${eur(r2(maj*s))} = ${String(maj).replace('.',',')} €/m² × ${String(s).replace('.',',')} m²).`);
    } else if(s) add('ok','Loyer inférieur au loyer de référence majoré.');
  }
  // garants
  if((bail.garants||[]).some(g=>g.type==='personne') && bien.gli && !['etudiant'].includes(bail.type) && !bail.locataireApprenti)
    add('err','Vous avez une assurance loyers impayés (GLI) : vous ne pouvez pas exiger en plus une caution personne physique (sauf étudiant ou apprenti).');
  // 2026 : servitude de résidence principale
  if(d>='2026-10-01' && !bien.servitudeRPConnue) add('warn','Indiquez si le logement est soumis à une servitude de résidence principale (mention obligatoire depuis le 1er octobre 2026, sous peine de nullité). Par défaut, le bail indique qu\'il n\'y en a pas.');
  if(bien.regime==='copro' && !(bien.pno||{}).assureur) add('warn','Copropriété : l\'assurance propriétaire non occupant (PNO) est obligatoire.');
  if(bien.permisLouer) add('warn','Commune avec « permis de louer » : joignez l\'autorisation ou le récépissé de déclaration de mise en location.');
  if(TYPES_BAIL[bail.type]?.meuble) add('ok','Pensez à l\'inventaire du mobilier : la liste minimale d\'équipements (décret 2015-981) est proposée dans l\'état des lieux.');
  // diagnostics de base
  const dg=bien.diagnostics||{};
  if(!dg.erp) add('warn','État des risques (ERP) : obligatoire, daté de moins de 6 mois à la signature.');
  else if(diffDays(dg.erp, d)>183) add('err','L\'état des risques (ERP) a plus de 6 mois : à refaire avant la signature.');
  if(num(bien.anneeConstruction) && num(bien.anneeConstruction)<1949 && !dg.crep) add('warn','Immeuble d\'avant 1949 : constat plomb (CREP) obligatoire.');
  return out;
}

/* =====================================================================================
   CYCLE DE VIE AUTOMATIQUE — appelé au démarrage et chaque jour
   - préavis échu → « Parti — à solder » (le bien redevient libre pour un nouveau bail)
   - bail étudiant / mobilité arrivé à son terme → idem
   - dépôt restitué et compte soldé → « Terminé » : archivé, consultable, rien n'est effacé
   ===================================================================================== */
function cycleDeVie(){
  const t=todayISO(); let changed=false;
  STATE.baux.forEach(b=>{
    if(['actif','preavis'].includes(b.statut)){
      const fin=finEffective(b);
      if(fin && fin<t){
        b.fin=Object.assign({date:fin, motif: b.statut==='preavis' ? (b.fin&&b.fin.motif)||'Congé' : 'Terme du bail'}, b.fin||{});
        if(!b.fin.remiseCles) b.fin.remiseCles=fin;
        b.statut='sortie'; b.updatedAt=new Date().toISOString(); changed=true;
      }
    }
    if(b.statut==='sortie'){
      const c=compteLocatif(b);
      if(b.fin && b.fin.depotRestitueLe && Math.abs(c.solde)<0.01){ b.statut='termine'; b.fin.clotureLe=t; b.updatedAt=new Date().toISOString(); changed=true; }
    }
  });
  if(changed) save();
}
function cloturerBail(bail){
  bail.statut='termine'; bail.fin=bail.fin||{}; bail.fin.clotureLe=todayISO(); upsert('baux', bail);
}

/* =====================================================================================
   ALERTES « À FAIRE » (accueil) — chaque alerte porte une action en un geste.
   niveau : 1 urgent, 2 à faire bientôt, 3 information
   ===================================================================================== */
let ALERT_FN = {};
function alerte(list, niv, bien, bail, titre, texte, actions){ list.push({niv, bienId:bien?bien.id:null, bailId:bail?bail.id:null, titre, texte, actions:actions||[]}); }
function computeAlerts(){
  const L=[]; const t=todayISO(); ALERT_FN={};
  // sauvegarde
  const lb=STATE.settings.lastBackup;
  if(typeof syncActive==='function' && syncActive() && SYNC.meta.lastError && SYNC.meta.errCode!=='reseau')
    alerte(L, SYNC.meta.errCode==='jeton'?1:2, null, null, 'Synchronisation interrompue', SYNC.meta.lastError, [{l:SYNC.meta.errCode==='jeton'?'Remplacer la clé':'Voir', fn:()=>go('reglages')}]);
  if(STATE.baux.length && !(typeof syncActive==='function' && syncActive()) && (!lb || diffDays(lb.slice(0,10), t)>30))
    alerte(L, lb?2:1, null, null, lb?'Faites une copie de sauvegarde':'Aucune copie de sauvegarde', lb?'Dernière copie le '+fdate(lb.slice(0,10))+'. Une copie par mois protège vos données (perte du téléphone, changement d\'appareil).':'Vos données ne sont que sur cet appareil. Faites une copie et rangez-la dans votre Drive ou iCloud.', [{l:'Faire la copie', fn:()=>openSauvegarde()}]);
  // nouveautés réglementaires non lues
  const vu=STATE.settings.regVu||STATE.settings.createdAt||'2000-01-01';
  REG.journal.filter(j=>j.date>vu).slice(0,3).forEach(j=>{
    const concernes=bauxEnCours().filter(b=>j.types.includes('tous')||j.types.includes(b.type));
    alerte(L, 3, null, null, 'Nouveauté : '+j.titre, j.texte+(concernes.length?` — Concerne ${plural(concernes.length,'bail','baux')} en cours.`:''), [{l:'J\'ai compris', fn:()=>{ STATE.settings.regVu=REG.journal[0].date; save(); refresh(); }}, {l:'Source', fn:()=>window.open(j.src,'_blank','noopener')}]);
  });
  biensActifs().forEach(bien=>{
    const bail=bailCourant(bien.id);
    const cl=dpeClasse(bien);
    if(!bail){ alerte(L,3,bien,null,'Bien libre : '+nomBien(bien), 'Aucun bail en cours. Vous pouvez préparer la prochaine location.', [{l:'Louer ce bien', fn:()=>startAssistantBail(bien.id)}]); }
    // décence
    if(cl && classeInterdite(cl, t)==='err') alerte(L,1,bien,bail,'Logement non décent ('+cl+') : '+nomBien(bien),'Ce logement ne peut plus faire l\'objet d\'un nouveau bail ni d\'un renouvellement. Le bail en cours continue, mais le locataire peut exiger des travaux.', [{l:'Voir le bien', fn:()=>go('bien',{id:bien.id, tab:'infos'})}]);
    else if(cl==='F') alerte(L,3,bien,bail,'DPE F : interdiction au 1er janvier 2028',nomBien(bien)+' — prévoyez les travaux (aides MaPrimeRénov\'). Loyer gelé en attendant.', []);
    // diagnostics expirés
    const dg=bien.diagnostics||{};
    (REG.diagnostics||[]).forEach(dd=>{ if(!dd.ans || !dg[dd.k] || dd.k==='erp') return; const fin=addMonths(dg[dd.k], Math.round(dd.ans*12)); if(fin<addDays(t,60)) alerte(L, fin<t?2:3, bien, bail, dd.l+(fin<t?' expiré':' bientôt expiré'), nomBien(bien)+' — valable jusqu\'au '+fdate(fin)+'.', [{l:'Mettre à jour', fn:()=>go('bien',{id:bien.id, tab:'infos'})}]); });
    if(bien.regime==='copro' && !(bien.pno||{}).assureur) alerte(L,3,bien,bail,'Assurance PNO à renseigner', nomBien(bien)+' : l\'assurance propriétaire non occupant est obligatoire en copropriété.', [{l:'Compléter', fn:()=>go('bien',{id:bien.id, tab:'infos'})}]);
    // charges : décompte annuel attendu, puis régularisation de chaque bail (y compris anciens locataires)
    const avecProv=STATE.baux.filter(b=>b.bienId===bien.id && b.statut!=='brouillon' && b.chargesType==='provision' && b.dateDebut);
    if(avecProv.length){
      const dcs=decomptesDuBien(bien.id); const lastAu=dcs.length?dcs[0].au:null;
      const attendu = lastAu ? addMonths(lastAu,12) : avecProv.map(b=>b.dateDebut).sort()[0].slice(0,4)+'-12-31';
      if(addMonths(attendu,3)<=t) alerte(L,2,bien,null,'Décompte des charges à saisir : '+nomBien(bien), `Saisissez les charges réelles de l'exercice ${lastAu?'qui suit le '+fdate(lastAu):'se terminant le '+fdate(attendu)} (décompte annuel du syndic, factures d'eau, TEOM…) : c'est la base de la régularisation des provisions.`, [{l:'Saisir le décompte', fn:()=>openDecompte(bien.id)}]);
      dcs.filter(dc=>diffDays(dc.au,t)<365*3).forEach(dc=>bauxDuDecompte(dc).forEach(b=>{
        if(regulFaite(b.id, dc.id)) return; const rc=regulCalc(b,dc);
        alerte(L, rc.tardive?1:2, bien, b, 'Régularisation des charges à envoyer : '+nomsLocataires(b), `Période du ${fdateCourt(dc.du)} au ${fdateCourt(dc.au)} : ${rc.solde>=0?'complément dû par le locataire : '+eur(rc.solde):'trop-perçu à lui rembourser : '+eur(-rc.solde)}${['sortie','termine'].includes(b.statut)?' — ancien locataire, envoi à sa nouvelle adresse':''}${rc.tardive?' — régularisation tardive : le locataire peut demander à payer en 12 mensualités':''}.`, [{l:'Faire la régularisation', fn:()=>openDoc('regularisation_charges', b.id, {decompteId:dc.id})}]);
      }));
    }
    if(!bail) return;
    const nom=nomsLocataires(bail);
    if(bail.statut==='brouillon') alerte(L,2,bien,bail,'Bail à finaliser : '+nom,'Le bail est préparé mais pas encore marqué comme signé.', [{l:'Ouvrir', fn:()=>go('bien',{id:bien.id})}]);
    if(['actif','preavis'].includes(bail.statut)){
      // impayés
      const imp=moisImpayes(bail); const c=compteLocatif(bail);
      if(imp.length && c.solde>0.01){
        const plusVieux=imp[0]; const jours=diffDays(plusVieux.due, t);
        if(jours>=3){
          const niv = jours>30 ? 1 : (jours>10 ? 1 : 2);
          const relances=STATE.docs.filter(d=>d.bailId===bail.id && ['relance','mise_en_demeure'].includes(d.type) && d.createdAt>=plusVieux.due);
          const prochaine = relances.some(d=>d.type==='mise_en_demeure') ? 'commissaire' : relances.length>=2 ? 'mise_en_demeure' : 'relance';
          const acts=[{l:'Encaisser', fn:()=>openPaiement(bail.id)}];
          if(prochaine==='relance') acts.push({l:relances.length?'2e relance':'Relance amiable', fn:()=>openDoc('relance', bail.id, {niveau:relances.length?2:1})});
          if(prochaine==='mise_en_demeure') acts.push({l:'Mise en demeure', fn:()=>openDoc('mise_en_demeure', bail.id)});
          if(prochaine==='commissaire') acts.push({l:'Que faire ensuite ?', fn:()=>openGuide('impayes')});
          alerte(L, niv, bien, bail, 'Loyer impayé : '+nom, `${eur(c.solde)} dus — échéance la plus ancienne : ${monthLabel(plusVieux.key)} (${jours} jours de retard)${relances.length?' — '+plural(relances.length,'relance')+' envoyée(s)':''}.`, acts);
          if(bail.aplTiersPayant && imp.length>=2) alerte(L,1,bien,bail,'Signalement CAF obligatoire', `Impayé de ${imp.length} échéances avec aide au logement versée à vous : signalez-le à la CAF/MSA sous ${R('cafSignalement')} mois.`, [{l:'Courrier CAF', fn:()=>openDoc('signalement_caf', bail.id)}]);
          if((bail.garants||[]).some(g=>g.type==='personne') && imp.length>=1 && jours>15 && !STATE.docs.some(d=>d.bailId===bail.id && d.type==='info_caution' && d.createdAt>=plusVieux.due))
            alerte(L,2,bien,bail,'Informer la caution', 'La personne qui se porte caution doit être informée du premier incident de paiement.', [{l:'Lettre à la caution', fn:()=>openDoc('info_caution', bail.id)}]);
        }
      }
      // quittances non envoyées pour les mois soldés (3 derniers mois)
      const sans=c.lignes.filter(l=>l.kind==='loyer' && l.etat==='paye' && l.key>=prevMonthKey(prevMonthKey(monthKey(t))) && !STATE.docs.some(d=>d.bailId===bail.id && d.type==='quittance' && (d.data||{}).mois===l.key));
      if(sans.length) alerte(L,3,bien,bail,'Quittance à envoyer : '+nom, sans.map(l=>monthLabel(l.key)).join(', ')+' payé — la quittance est due si le locataire la demande (gratuite).', [{l:'Faire la quittance', fn:()=>openDoc('quittance', bail.id, {mois:sans[sans.length-1].key})}]);
      // révision IRL
      const rv=revisionInfo(bail);
      if(rv.possible && !rv.dejaFaite){
        const dans=diffDays(t, rv.anniversaire);
        if(rv.enRetard && rv.publie) alerte(L,2,bien,bail,'Révision du loyer possible : '+nom, `Date anniversaire passée (${fdate(rv.dernierAnniv)}). Nouveau loyer possible : ${eur(rv.nouveau)} au lieu de ${eur(rv.actuel)}. Sans rétroactivité : la hausse s'applique à partir de votre demande, et le droit est perdu le ${fdate(rv.limite)}.`, [{l:'Réviser', fn:()=>openDoc('revision_irl', bail.id)}]);
        else if(!rv.enRetard && dans<=30 && rv.publie) alerte(L,3,bien,bail,'Révision annuelle le '+fdate(rv.anniversaire), `${nom} : nouveau loyer possible ${eur(rv.nouveau)} (IRL ${trimestreLabel(rv.prochainTrim)}).`, [{l:'Préparer la lettre', fn:()=>openDoc('revision_irl', bail.id)}]);
      }
      // assurance du locataire
      if(!bail.assuranceEcheance || bail.assuranceEcheance<t) alerte(L, bail.assuranceEcheance?2:3, bien, bail, 'Attestation d\'assurance à demander : '+nom, bail.assuranceEcheance?'L\'attestation enregistrée a expiré le '+fdate(bail.assuranceEcheance)+'.':'Aucune attestation enregistrée. Le locataire doit la fournir à l\'entrée puis chaque année.', [{l:'Demander', fn:()=>openDoc('demande_assurance', bail.id)}, {l:'J\'ai l\'attestation', fn:()=>openAssurance(bail.id)}]);
      // congé bailleur : fenêtre
      const cg=dateLimiteCongeBailleur(bail);
      if(cg && bail.statut==='actif'){ const j=diffDays(t, cg.limite); if(j>=0 && j<=90) alerte(L,3,bien,bail,'Échéance du bail le '+fdate(cg.echeance), `Si vous souhaitez vendre, reprendre le logement ou ne pas renouveler pour motif sérieux, le congé doit être REÇU par le locataire avant le ${fdate(cg.limite)} (${cg.mois} mois). Sinon le bail se renouvelle automatiquement.`, [{l:'Donner congé', fn:()=>openDoc('conge_bailleur', bail.id)}]); }
      if(!reconductible(bail)){ const fin=echeanceBail(bail); const j=diffDays(t, fin); if(j>=0 && j<=45) alerte(L,2,bien,bail,'Fin du bail le '+fdate(fin), `${TYPES_BAIL[bail.type].l} : il prend fin automatiquement. Organisez l'état des lieux de sortie.`, [{l:'État des lieux de sortie', fn:()=>openEDL(bail.id,'sortie')}]); }
      if(bail.statut==='preavis' && bail.fin && bail.fin.date){ const j=diffDays(t, bail.fin.date); if(j>=0 && j<=30) alerte(L,2,bien,bail,'Départ du locataire le '+fdate(bail.fin.date), nom+' : fixez le rendez-vous d\'état des lieux de sortie et demandez sa nouvelle adresse.', [{l:'État des lieux de sortie', fn:()=>openEDL(bail.id,'sortie')}]); }
    }
    if(bail.statut==='sortie'){
      const ri=restitutionInfo(bail);
      const hasEDL=STATE.docs.some(d=>d.bailId===bail.id && d.type==='etat_lieux_sortie');
      if(!hasEDL) alerte(L,1,bien,bail,'État des lieux de sortie à faire : '+nom,'Le locataire est parti (ou doit partir). L\'état des lieux de sortie est indispensable pour retenir quoi que ce soit sur le dépôt.', [{l:'Faire l\'état des lieux', fn:()=>openEDL(bail.id,'sortie')}]);
      if(ri && !bail.fin.depotRestitueLe){ const j=diffDays(t, ri.limite);
        alerte(L, j<10?1:2, bien, bail, 'Restituer le dépôt de garantie avant le '+fdate(ri.limite), `${nom} : ${eur(bail.depot)} versés. ${ri.retard?`En retard : pénalité de ${eur(ri.penalite)} déjà due (10 % du loyer par mois commencé).`:'Au-delà, pénalité de 10 % du loyer par mois de retard commencé.'}`, [{l:'Décompte de restitution', fn:()=>openDoc('restitution_depot', bail.id)}]); }
      if(bail.fin && bail.fin.depotRestitueLe){ const c=compteLocatif(bail); if(Math.abs(c.solde)>=0.01) alerte(L,2,bien,bail,'Compte à solder : '+nom, c.solde>0?`Reste dû par l'ancien locataire : ${eur(c.solde)}.`:`Vous devez encore ${eur(-c.solde)} à l'ancien locataire.`, [{l:'Voir le compte', fn:()=>go('bien',{id:bien.id, tab:'loyers'})}, {l:'Clôturer quand même', fn:async()=>{ if(await confirmBox('Clôturer le bail ?','Le bail sera archivé avec son compte non soldé. Toutes les données restent consultables dans l\'historique du bien.','Clôturer')){ cloturerBail(bail); refresh(); } }}]); }
    }
  });
  // échéances fiscales et déclaratives
  const mo=t.slice(5,7), y=t.slice(0,4);
  if(STATE.baux.length){
    if(['04','05'].includes(mo)) alerte(L,2,null,null,'Déclaration des revenus '+(num(y)-1)+' (avril-juin)', 'Les totaux de vos loyers et charges de l\'année sont prêts dans « Bilan ». Location vide : 2044 ou micro-foncier ; meublé : 2042-C-PRO.', [{l:'Ouvrir le bilan', fn:()=>go('bilan',{annee:String(num(y)-1)})}]);
    if(['05','06'].includes(mo)) alerte(L,3,null,null,'Déclaration d\'occupation des logements (avant le 1er juillet)', 'Sur impots.gouv.fr › « Gérer mes biens immobiliers » : à faire si l\'occupant d\'un de vos logements a changé depuis le 1er janvier précédent.', [{l:'impots.gouv.fr', fn:()=>window.open('https://www.impots.gouv.fr/particulier/gerer-mes-biens-immobiliers','_blank','noopener')}]);
    if(['09','10'].includes(mo)) alerte(L,3,null,null,'Taxe foncière (mi-octobre)', 'Pensez à l\'enregistrer dans les dépenses du bien : la part « ordures ménagères » (TEOM) se récupère sur le locataire.', [{l:'Ajouter une dépense', fn:()=>openDepense()}]);
    if(['11','12'].includes(mo) && STATE.baux.some(b=>estMeuble(b) && ['actif','preavis'].includes(b.statut))) alerte(L,3,null,null,'CFE des locations meublées (15 décembre)', 'La cotisation foncière des entreprises concerne les loueurs en meublé (exonération possible sous '+eur0(R('cfeExoneration'))+' de recettes).', []);
  }
  L.sort((a,b)=>a.niv-b.niv);
  return L;
}

/* =====================================================================================
   BILAN ANNUEL — encaissements ventilés loyer / charges, dépenses par ligne fiscale
   ===================================================================================== */
const CAT_DEPENSES = {
  taxe_fonciere:{l:'Taxe foncière (hors ordures ménagères)', ligne:'227', recup:0},
  teom:{l:'Taxe d\'enlèvement des ordures ménagères (TEOM)', ligne:'récupérable', recup:100},
  copro:{l:'Charges de copropriété (appels de fonds)', ligne:'229', recup:null},
  assurance:{l:'Assurances (PNO, loyers impayés)', ligne:'223', recup:0},
  travaux:{l:'Travaux d\'entretien, réparation, amélioration', ligne:'224', recup:0},
  entretien_recup:{l:'Entretien récupérable (chaudière, parties communes, ascenseur…)', ligne:'récupérable', recup:100},
  eau_energie:{l:'Eau, chauffage collectif, électricité des communs', ligne:'récupérable', recup:100},
  gestion:{l:'Frais de gestion, procédure, commissaire de justice, avocat', ligne:'221', recup:0},
  interets:{l:'Intérêts et frais d\'emprunt', ligne:'250', recup:0},
  mobilier:{l:'Achat de mobilier / électroménager (meublé)', ligne:'amortissable', recup:0},
  autre:{l:'Autre dépense', ligne:'—', recup:0}
};
function partRecuperable(dep){ const c=CAT_DEPENSES[dep.categorie]||{}; const p = dep.recupPct!==undefined && dep.recupPct!=='' ? num(dep.recupPct) : (c.recup||0); return r2(num(dep.montant)*p/100); }
function bilanAnnee(annee, bienId){
  const biens = bienId ? [byId('biens',bienId)] : STATE.biens.filter(b=>b.statut!=='archive' || STATE.baux.some(x=>x.bienId===b.id));
  const res = {annee, biens:[], tot:{loyers:0, charges:0, encaisse:0, depenses:0, recup:0, deductible:0}};
  biens.forEach(bien=>{
    if(!bien) return;
    const r={bien, loyers:0, charges:0, encaisse:0, deps:[], depenses:0, recup:0, parLigne:{}, meuble:false, mois:0};
    STATE.baux.filter(b=>b.bienId===bien.id && b.statut!=='brouillon').forEach(bail=>{
      if(estMeuble(bail)) r.meuble=true;
      // ventilation loyer / charges des sommes ENCAISSÉES dans l'année (règle fiscale des encaissements)
      const c=compteLocatif(bail, annee+'-12-31');
      c.lignes.forEach(l=>{ if(l.kind==='loyer' && l.key.slice(0,4)===annee) r.mois++; });
      c.credits.filter(cr=>!cr.avoir && cr.date.slice(0,4)===annee).forEach(cr=>{
        r.encaisse += cr.montant;
        cr.alloc.forEach(({l,a})=>{ const pl = l.montant ? l.loyerHC/l.montant : 0; r.loyers += a*pl; r.charges += a*(1-pl); });
        r.loyers += cr.reste; // avance non encore imputée
      });
    });
    STATE.depenses.filter(d=>d.bienId===bien.id && (d.date||'').slice(0,4)===annee).forEach(d=>{
      r.deps.push(d); r.depenses+=num(d.montant); const rc=partRecuperable(d); r.recup+=rc;
      const ligne=(CAT_DEPENSES[d.categorie]||{}).ligne||'—';
      r.parLigne[ligne]=(r.parLigne[ligne]||0)+num(d.montant)-rc;
    });
    ['loyers','charges','encaisse','depenses','recup'].forEach(k=>r[k]=r2(r[k]));
    r.deductible = r2(r.depenses - r.recup - (r.parLigne['amortissable']||0));
    res.biens.push(r);
    ['loyers','charges','encaisse','depenses','recup','deductible'].forEach(k=>res.tot[k]=r2(res.tot[k]+r[k]));
  });
  return res;
}
function simulationRegimes(bil){
  const vide = bil.biens.filter(b=>!b.meuble), meub=bil.biens.filter(b=>b.meuble);
  const d=bil.annee+'-12-31';
  const lv=r2(vide.reduce((s,b)=>s+b.loyers,0)), dv=r2(vide.reduce((s,b)=>s+b.deductible,0));
  const lm=r2(meub.reduce((s,b)=>s+b.loyers,0)), dm=r2(meub.reduce((s,b)=>s+b.deductible,0));
  const forfait = vide.length*R('fraisGestionForfait', d);
  return {
    vide: vide.length ? { loyers:lv, micro: lv<=R('microFoncierPlafond',d) ? r2(lv*(1-R('microFoncierAbattement',d)/100)) : null,
      reel: r2(lv - dv - forfait), plafond:R('microFoncierPlafond',d), abattement:R('microFoncierAbattement',d), forfait } : null,
    meuble: meub.length ? { loyers:lm, micro: lm<=R('microBicPlafond',d) ? r2(lm*(1-R('microBicAbattement',d)/100)) : null,
      reelAvantAmort: r2(lm - dm), plafond:R('microBicPlafond',d), abattement:R('microBicAbattement',d), lmp: lm>R('seuilLMP',d) } : null
  };
}

/* =====================================================================================
   CHARGES LOCATIVES ET RÉGULARISATION (article 23 de la loi de 1989, décret n° 87-713)
   - Décompte annuel des charges réelles d'un logement, ligne par ligne, par nature, sur la
     période de l'exercice (année civile ou exercice du syndic, ex. 1er juillet – 30 juin),
     avec une quote-part si la dépense concerne tout un immeuble.
   - Régularisation par bail : part récupérable × prorata de présence, moins les provisions
     appelées sur la même période ; exigible un mois après l'envoi du décompte ; étalement
     sur 12 mois à la demande du locataire si elle est faite après l'année civile suivante.
   ===================================================================================== */
function natureCharge(k){ return (REG.chargesNatures||[]).find(n=>n.k===k) || {k, l:k||'Autre', pct:0, ex:''}; }
function ligneTaux(l){ return (l.pct===''||l.pct===undefined||l.pct===null) ? natureCharge(l.nature).pct : num(l.pct); }
function decomptesDuBien(bienId){ return (STATE.decomptes||[]).filter(d=>d.bienId===bienId).sort((a,b)=>(b.au||'').localeCompare(a.au||'')); }
function decompteTotaux(dc){
  const q=(dc.quotePart===''||dc.quotePart===undefined?100:num(dc.quotePart))/100;
  const lignes=(dc.lignes||[]).map(l=>{ const total=r2(num(l.total)*q); return Object.assign({}, l, {totalLot:total, taux:ligneTaux(l), recup:r2(total*ligneTaux(l)/100)}); });
  return { lignes, total:r2(lignes.reduce((s,l)=>s+l.totalLot,0)), recup:r2(lignes.reduce((s,l)=>s+l.recup,0)), q };
}
function occupationPeriode(bail, du, au){
  const debut = bail.dateDebut>du ? bail.dateDebut : du;
  const fe = (bail.fin&&bail.fin.date) || finEffective(bail);
  const fin = fe && fe<au ? fe : au;
  const jours = fin>=debut ? diffDays(debut, fin)+1 : 0;
  return {debut, fin, jours, prorata: jours/(diffDays(du,au)+1)};
}
/* provisions sur charges dues pour la période (calcul théorique sur l'historique du loyer :
   juste même si le suivi des loyers dans l'appli a commencé plus tard) */
function provisionsPeriode(bail, du, au){
  const o=occupationPeriode(bail, du, au); if(!o.jours) return 0;
  let s=0, mk=monthKey(o.debut);
  while(mk<=monthKey(o.fin)){
    const d0=o.debut>monthFirst(mk)?o.debut:monthFirst(mk), d1=o.fin<monthLast(mk)?o.fin:monthLast(mk);
    s += loyerA(bail, d0).charges * (diffDays(d0,d1)+1)/daysInMonth(mk);
    mk=nextMonthKey(mk);
  }
  return r2(s);
}
function regulCalc(bail, dc){
  const T=decompteTotaux(dc); const o=occupationPeriode(bail, dc.du, dc.au);
  const lignes=T.lignes.filter(l=>l.recup>0).map(l=>Object.assign({}, l, {part:r2(l.recup*o.prorata)}));
  const parts=r2(lignes.reduce((s,l)=>s+l.part,0));
  const provisions=provisionsPeriode(bail, dc.du, dc.au);
  const t=todayISO();
  return { dc, occ:o, lignes, parts, provisions, solde:r2(parts-provisions),
    nouvelleProvision: o.jours ? r2(T.recup/12) : 0,
    exigible: addMonths(t, R('regulPreavis')),
    tardive: t > (num(dc.au.slice(0,4))+1)+'-12-31',
    prescrite: diffDays(dc.au, t) > 365*R('prescriptionLoyers') };
}
function bauxDuDecompte(dc){ return STATE.baux.filter(b=>b.bienId===dc.bienId && b.statut!=='brouillon' && b.chargesType==='provision' && occupationPeriode(b, dc.du, dc.au).jours>0); }
function regulFaite(bailId, dcId){ return STATE.docs.find(d=>d.bailId===bailId && d.type==='regularisation_charges' && (d.data||{}).decompteId===dcId) || null; }
/* répartition mensuelle d'une provision (affichage) */
function detailCharges(bail){ return (bail.chargesDetail||[]).filter(l=>num(l.montant)>0); }

/* ---- Grille de vétusté indicative (accords collectifs de location) ---- */
const VETUSTE = [
  {k:'peinture', l:'Peintures, papiers peints', vie:9, franchise:2},
  {k:'moquette', l:'Moquette, revêtement souple', vie:9, franchise:2},
  {k:'parquet', l:'Parquet (vitrification)', vie:15, franchise:3},
  {k:'carrelage', l:'Carrelage, faïence', vie:25, franchise:5},
  {k:'sanitaire', l:'Sanitaires (lavabo, WC, baignoire)', vie:20, franchise:5},
  {k:'robinet', l:'Robinetterie', vie:12, franchise:3},
  {k:'electro', l:'Électroménager', vie:8, franchise:2},
  {k:'menuiserie', l:'Menuiseries intérieures, portes', vie:20, franchise:5},
  {k:'mobilier', l:'Mobilier (meublé)', vie:10, franchise:2},
  {k:'literie', l:'Literie', vie:8, franchise:2}
];
function partLocataireVetuste(cout, k, ageAns){
  const g=VETUSTE.find(x=>x.k===k); if(!g) return num(cout);
  const util = Math.max(0, num(ageAns)-g.franchise); const taux = Math.max(0, 1 - util/(g.vie-g.franchise));
  return r2(num(cout)*Math.min(1,taux));
}
