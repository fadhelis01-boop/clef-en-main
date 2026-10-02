/* =====================================================================================
   COMPLÉMENTS (audit d'octobre 2026) :
   - renouvellement du bail avec réévaluation du loyer (vide : art. 17-2 ; meublé : art. 25-9)
   - annonce de location avec les mentions obligatoires
   - évolutions légales intervenues depuis la signature de chaque bail
   - critères de décence (décret n° 2002-120)
   - lexique : définitions accessibles d'un geste sur les termes techniques
   - protections : appli non installée sur iPhone, stockage persistant, erreurs inattendues
   ===================================================================================== */

/* ---------------- Renouvellement avec réévaluation du loyer (art. 17-2 ; meublé : art. 25-9) ---------------- */
function etalementHausse(actuel, nouveau, meuble, dureeAns){
  const h=r2(num(nouveau)-num(actuel)); if(h<=0) return [];
  const plus10 = h/num(actuel) > 0.10;
  if(meuble && !plus10) return [{annee:1, loyer:r2(num(nouveau))}];
  const n = meuble ? 3 : ((plus10 || dureeAns>=6) ? 6 : 3), out=[];
  for(let i=1;i<=n;i++) out.push({annee:i, loyer: i===n ? r2(num(nouveau)) : r2(num(actuel)+h*i/n)});
  return out;
}
DOCS.renouvellement = { l:'Renouvellement avec réévaluation du loyer', g:'sortie', ic:'🔄', envoi:'lrar', d:'Loyer manifestement sous-évalué : proposer un nouveau loyer à l\'échéance (article 17-2, vide et meublé).',
  show:x=>reconductible(x.bail),
  f:(x)=>{ const b=x.bail, bien=x.bien, cl=dpeClasse(bien); const cg=dateLimiteCongeBailleur(b)||{};
    if(cl==='F'||cl==='G') return [{n:'info', t:'info', cls:'warn', l:`Logement classé ${cl} : le loyer ne peut pas être réévalué lors du renouvellement (article 17-2, II).`}];
    const lim = addMonths(addDays(cg.echeance,1),-6);
    return [ {n:'info', t:'info', l:`Échéance du bail : <b>${fdate(cg.echeance)}</b>. La proposition doit être <b>reçue</b> par le locataire au plus tard le <b>${fdate(lim)}</b> (au moins 6 mois avant le terme, ${estMeuble(b)?'règle applicable au meublé par l\'article 25-9':'article 17-2'}).${diffDays(todayISO(),lim)<0?'<br>⚠️ Délai dépassé : la proposition ne pourra valoir que pour l\'échéance suivante.':''}<br>Conditions : le loyer actuel doit être <b>manifestement sous-évalué</b> par rapport aux loyers de logements comparables du voisinage. Vous ne pourrez pas donner congé pour la même échéance. En zone tendue, la hausse est en outre plafonnée par le décret annuel ; dans une commune à encadrement, elle n'est possible que si le loyer actuel est inférieur au loyer de référence minoré, et dans cette limite.`},
      {n:'nouveau', l:'Loyer proposé hors charges (€)', t:'number', req:true, col:2}, {n:'actuel', l:'Loyer actuel (€)', t:'number', v:loyerA(b,todayISO()).loyerHC, col:2},
      {n:'grandeVille', l:'Commune d\'une agglomération de plus d\'un million d\'habitants (Paris, Lyon, Marseille, Lille…) : 6 références au lieu de 3', t:'check', v:/^(75|92|93|94|69|13|59)/.test(bien.cp||'')},
      {n:'references', l:'Loyers de référence (un par ligne : adresse, type, surface, étage, loyer, date du bail)', t:'textarea', rows:6, req:true, h:'Logements comparables du même quartier, représentatifs des loyers du voisinage. Sources : observatoire local des loyers, ADIL, annonces. Sans références suffisantes, la proposition est nulle.'},
      envoiField('lrar',['lrar','cj','main']) ]; },
  gen:(x,d)=>{ const b=x.bail, meuble=estMeuble(b); const cg=dateLimiteCongeBailleur(b)||{}; const et=etalementHausse(d.actuel, d.nouveau, meuble, (bailleurDe(b).type==='morale'?6:3));
    const refs=(d.references||'').split('\n').map(s=>s.trim()).filter(Boolean); const mini=d.grandeVille?6:3;
    return lettre(x,{envoi:d.envoi, objet:'Proposition de renouvellement du bail avec réévaluation du loyer (article 17-2 de la loi du 6 juillet 1989)', corps:`
      <p>Votre bail arrive à échéance le <b>${fdate(cg.echeance)}</b>. Le loyer actuel, de ${eur(d.actuel)} hors charges, étant manifestement sous-évalué par rapport aux loyers habituellement constatés dans le voisinage pour des logements comparables, je vous propose le renouvellement du bail moyennant un nouveau loyer de <b>${eur(d.nouveau)}</b> hors charges par mois.</p>
      <p>Ce montant a été déterminé à partir des ${refs.length} références suivantes :</p><ol>${refs.map(r=>'<li>'+esc(r)+'</li>').join('')}</ol>
      ${refs.length<mini?`<p class="neg">⚠️ ${refs.length} référence(s) seulement : ${mini} au minimum sont exigées.</p>`:''}
      ${et.length>1?`<p>La hausse s'appliquera progressivement, ${meuble?'par tiers annuel':(et.length===6?'par sixième annuel':'par tiers')} :</p>${tableau(et.map(e=>['Année '+e.annee+' du bail renouvelé', eur(e.loyer)]))}`:(et.length?`<p>Ce loyer s'appliquera à compter du renouvellement, le ${fdate(addDays(cg.echeance,1))}.</p>`:'')}
      <p>Les révisions annuelles prévues au bail s'appliqueront à chacune de ces valeurs. En cas de désaccord ou à défaut de réponse de votre part quatre mois avant le terme du bail, l'une ou l'autre des parties saisira la commission départementale de conciliation, puis, à défaut d'accord, le juge, avant le terme du bail.</p>
      <p>Conformément à la loi, le texte intégral du I de l'article 17-2 de la loi du 6 juillet 1989 est reproduit ci-après.</p>`,
      annexe: texteOfficielHtml('art17_2_I'),
      legal:'Vérifiez avant l\'envoi que le texte reproduit est toujours celui en vigueur (Légifrance). Un conseil de l\'ADIL est recommandé.'}); },
  mail:x=>({o:'Renouvellement de votre bail', c:`Bonjour,\n\nVotre bail arrive bientôt à échéance. Je vous adresse par lettre recommandée une proposition de renouvellement ; une copie est jointe.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) };


/* ---------------- Annonce de location ---------------- */
function openAnnonce(bienId){
  const bien=byId('biens',bienId); const prev=bauxDuBien(bienId)[0]; const l=prev?loyerA(prev,todayISO()):{loyerHC:'',charges:''};
  const m=openModal({title:'📣 Annonce de location', wide:true, body:`<p class="hint">L'annonce d'un particulier doit comporter plusieurs mentions obligatoires (performance énergétique, montant du loyer et des charges, encadrement des loyers le cas échéant). L'appli les insère pour vous.</p>
    <form onsubmit="return false">${formHtml([
      {n:'meuble', l:'Loué', t:'select', v:prev&&estMeuble(prev)?'oui':'non', o:[['non','Vide'],['oui','Meublé']], col:3}, {n:'loyer', l:'Loyer HC (€)', t:'number', v:l.loyerHC, col:3}, {n:'charges', l:'Charges (€)', t:'number', v:l.charges, col:3},
      {n:'chargesType', l:'Charges', t:'select', v:prev?prev.chargesType:'provision', o:[['provision','Provision avec régularisation annuelle'],['forfait','Forfait']], col:2}, {n:'dispo', l:'Disponible le', t:'date', v:todayISO(), col:2},
      {n:'desc', l:'Description (atouts, quartier, transports)', t:'textarea', rows:4}],'an')}</form><h3 class="fsect">Texte de l'annonce</h3><textarea class="codebox" id="anTxt" rows="14" readonly></textarea>`,
    actions:[{label:'Fermer'},{label:'Copier le texte', cls:'btn-teal', onClick:(c,bg)=>{ const t=bg.querySelector('#anTxt'); t.select(); (navigator.clipboard?navigator.clipboard.writeText(t.value):Promise.reject()).then(()=>toast('Annonce copiée : collez-la sur le site de votre choix.')).catch(()=>{ document.execCommand('copy'); toast('Annonce copiée.'); }); return false; }}]});
  const upd=()=>{ const v=formValues(m.el.querySelector('form')); const cl=dpeClasse(bien), dpe=bien.dpe||{}, enc=bien.encadrement||{}; const meuble=v.meuble==='oui';
    const depot=r2(num(v.loyer)*(meuble?R('depotMaxMeuble'):R('depotMaxVide')));
    const lignes=[
      `${bien.type||'Logement'} ${meuble?'meublé':'vide'} de ${bien.pieces||'?'} pièce(s), ${bien.surface||'?'} m² habitables — ${bien.ville||''}${bien.cp?' ('+bien.cp+')':''}`,
      '', v.desc||'', '',
      `Loyer : ${eur(num(v.loyer)+num(v.charges))} par mois charges comprises, dont ${eur(v.charges)} de charges (${v.chargesType==='forfait'?'forfait':'provision avec régularisation annuelle'}).`,
      `Loyer hors charges : ${eur(v.loyer)}.`,
      enc.actif ? `Logement soumis à l'encadrement des loyers : loyer de référence majoré ${eur(enc.loyerRefMaj)}/m², soit ${eur(r2(num(enc.loyerRefMaj)*num(bien.surface)))} ; complément de loyer : ${num(prev&&prev.complementLoyer)>0?eur(prev.complementLoyer):'aucun'}.` : '',
      `Dépôt de garantie : ${eur(depot)}.`,
      'Location entre particuliers : aucuns frais d\'agence.',
      `Disponible le ${fdate(v.dispo)}.`, '',
      `Performance énergétique (DPE) : classe énergie ${cl||'non communiquée'}${dpe.ges?', classe climat '+dpe.ges:''}.`,
      dpe.coutMin||dpe.coutMax ? `Montant estimé des dépenses annuelles d'énergie pour un usage standard : entre ${eur0(dpe.coutMin)} et ${eur0(dpe.coutMax)} par an${dpe.anneeRef?' (prix moyens des énergies indexés sur l\'année '+dpe.anneeRef+')':''}.` : 'Montant estimé des dépenses annuelles d\'énergie : à reporter depuis le DPE.',
      (cl==='F'||cl==='G') ? 'Logement à consommation énergétique excessive : l\'obligation de respecter un niveau de performance énergétique minimal s\'appliquera à ce logement (classe E minimum à partir du 1er janvier 2028).' : '',
      bien.zoneTendue ? 'Commune située en zone tendue.' : '', '',
      'Pièces demandées (liste légale) : pièce d\'identité, justificatif de domicile, justificatifs d\'activité et de ressources. Garantie Visale acceptée.'
    ].filter((s,i,a)=>!(s==='' && a[i-1]===''));
    m.el.querySelector('#anTxt').value=lignes.join('\n').replace(/\n{3,}/g,'\n\n').trim();
    if(cl==='G' && classeInterdite('G', todayISO(), bien)==='err') m.el.querySelector('#anTxt').value='⚠️ Ce logement classé G ne peut plus être proposé à la location (non décent) : des travaux sont nécessaires avant toute annonce.';
  };
  m.el.addEventListener('input', upd); m.el.addEventListener('change', upd); upd();
}

/* ---------------- Évolutions légales depuis la signature ---------------- */
function evolutionsDepuis(bail){
  const depuis=bail.dateSignature||bail.dateDebut||'2000-01-01';
  return (REG.journal||[]).filter(j=>j.date>depuis && (j.types.includes('tous')||j.types.includes(bail.type)));
}
function evolutionsHtml(bail){
  const ev=evolutionsDepuis(bail); if(!ev.length) return '';
  return `<details class="card"><summary><b>⚖️ ${plural(ev.length,'évolution légale','évolutions légales')} depuis la signature de ce bail</b></summary>
    <p class="small">L'appli applique d'elle-même les nouvelles valeurs (indices, délais, plafonds) à ce bail. Ce qui demande une action de votre part est signalé sur l'accueil.</p>
    <ul class="journal">${ev.map(j=>`<li><b>${fdateCourt(j.date)}</b> — ${esc(j.titre)}<br><span class="small">${esc(j.texte)}</span>${j.src?` <a href="${esc(j.src)}" target="_blank" rel="noopener">source</a>`:''}</li>`).join('')}</ul></details>`;
}

/* ---------------- Critères de décence (décret n° 2002-120) ---------------- */
const DECENCE = [
  'Pièce principale d\'au moins 9 m² et 2,20 m de hauteur (ou 20 m³)',
  'Clos et couvert en bon état : toiture, murs, menuiseries étanches, sans infiltration',
  'Garde-corps des fenêtres, escaliers et balcons en bon état',
  'Pas de risque manifeste pour la santé (amiante, plomb dégradé, monoxyde de carbone…)',
  'Réseaux d\'électricité et de gaz conformes aux normes de sécurité et en bon état',
  'Chauffage adapté et suffisant, avec dispositifs d\'aération et de ventilation fonctionnels',
  'Eau potable avec pression et débit suffisants, eau chaude, évacuation des eaux usées',
  'Cuisine ou coin cuisine avec évier (eau chaude et froide) et emplacement pour cuisson',
  'Installation sanitaire intérieure : WC séparé de la cuisine, douche ou baignoire',
  'Éclairage naturel suffisant des pièces principales',
  'Absence de nuisibles (rongeurs, insectes)',
  'Performance énergétique minimale (classe DPE autorisée à la date du bail)',
  'Détecteur de fumée installé'
];

/* ---------------- Lexique ---------------- */
const LEXIQUE = {
  'IRL':'Indice de référence des loyers, publié chaque trimestre par l\'INSEE. Il sert à calculer la hausse annuelle maximale du loyer (révision). Il en existe un pour la métropole, un pour la Corse et un pour l\'Outre-mer.',
  'révision':'Hausse annuelle du loyer, au maximum selon la variation de l\'IRL, si le bail le prévoit. Elle n\'est jamais rétroactive : elle s\'applique à partir de la demande.',
  'provision':'Avance mensuelle sur les charges, versée avec le loyer. Une fois par an, on la compare aux charges réelles : c\'est la régularisation.',
  'forfait de charges':'Montant fixe de charges, jamais régularisé. Possible en meublé et en colocation, obligatoire en bail mobilité.',
  'régularisation':'Comparaison annuelle entre les provisions versées et les charges réelles récupérables : le locataire paie le complément ou est remboursé du trop-perçu.',
  'charges récupérables':'Dépenses que le propriétaire peut refacturer au locataire. La liste est fixée par le décret n° 87-713 (eau, ascenseur, entretien des parties communes, TEOM…).',
  'TEOM':'Taxe d\'enlèvement des ordures ménagères, payée avec la taxe foncière et récupérable sur le locataire (hors frais de gestion).',
  'dépôt de garantie':'Somme versée à l\'entrée (1 mois de loyer hors charges en vide, 2 en meublé, rien en bail mobilité), rendue à la sortie, moins les sommes dues justifiées.',
  'quittance':'Reçu prouvant que le loyer d\'une période a été entièrement payé. Gratuite, due au locataire qui la demande.',
  'avis d\'échéance':'Courrier indiquant le montant à payer pour la période à venir. Facultatif, ce n\'est pas une quittance.',
  'préavis':'Délai à respecter entre l\'envoi du congé et la fin du bail.',
  'congé':'Lettre par laquelle le locataire ou le bailleur met fin au bail, dans les formes et délais légaux.',
  'zone tendue':'Commune où la demande de logements dépasse fortement l\'offre : préavis du locataire d\'un mois, hausse de loyer encadrée à la relocation.',
  'encadrement des loyers':'Dispositif en vigueur dans certaines villes : le loyer ne peut dépasser le loyer de référence majoré fixé par arrêté préfectoral.',
  'loyer de référence majoré':'Plafond de loyer au m² dans les villes à encadrement des loyers.',
  'complément de loyer':'Supplément au-dessus du plafond d\'encadrement, permis seulement pour des caractéristiques exceptionnelles du logement, et contestable par le locataire.',
  'DPE':'Diagnostic de performance énergétique, classé de A à G. Les logements G ne peuvent plus être loués (depuis 2025), F à partir de 2028, E à partir de 2034.',
  'décence':'Ensemble de critères minimaux (surface, sécurité, équipements, énergie) qu\'un logement loué doit respecter.',
  'clause résolutoire':'Clause du bail qui permet la résiliation automatique en cas d\'impayé, de défaut d\'assurance ou de troubles, après un commandement resté sans effet.',
  'commandement de payer':'Acte délivré par un commissaire de justice qui laisse 6 semaines au locataire pour payer avant que la clause résolutoire puisse jouer.',
  'commissaire de justice':'Nouveau nom de l\'huissier de justice (depuis 2022).',
  'caution':'Personne qui s\'engage à payer à la place du locataire défaillant. « Solidaire » : on peut lui réclamer directement, sans poursuivre d\'abord le locataire.',
  'Visale':'Garantie gratuite d\'Action Logement qui couvre les impayés de loyer pour certains locataires.',
  'GLI':'Garantie (assurance) des loyers impayés souscrite par le propriétaire. Interdit alors d\'exiger une caution, sauf étudiant ou apprenti.',
  'PNO':'Assurance propriétaire non occupant, obligatoire en copropriété.',
  'vétusté':'Usure normale due au temps : elle reste à la charge du propriétaire et ne peut pas être retenue sur le dépôt de garantie.',
  'état des lieux':'Description contradictoire du logement à l\'entrée et à la sortie. Sa comparaison détermine les éventuelles retenues sur le dépôt de garantie.',
  'bail mobilité':'Bail meublé de 1 à 10 mois pour un locataire en formation, études, stage, mission ou mutation. Sans dépôt de garantie, non renouvelable.',
  'solidarité':'Dans une colocation ou un couple non marié, chaque locataire peut être tenu de payer la totalité du loyer.',
  'tacite reconduction':'Renouvellement automatique du bail à son échéance, aux mêmes conditions, si personne n\'a donné congé.',
  'LRAR':'Lettre recommandée avec accusé de réception : prouve la date de réception d\'un courrier.',
  'commission de conciliation':'Commission départementale gratuite qui aide propriétaire et locataire à trouver un accord avant d\'aller devant le juge.',
  'ADIL':'Agence départementale d\'information sur le logement : conseil juridique gratuit et neutre (0 805 160 075).',
  'FSL':'Fonds de solidarité pour le logement : aide départementale aux locataires en difficulté de paiement.',
  'CCAPEX':'Commission de coordination des actions de prévention des expulsions, informée des procédures d\'impayés.',
  'trêve hivernale':'Période du 1er novembre au 31 mars pendant laquelle aucune expulsion ne peut être exécutée.',
  'micro-foncier':'Régime fiscal simplifié des loyers d\'une location vide (jusqu\'à 15 000 € par an) : abattement forfaitaire de 30 %.',
  'régime réel':'Régime fiscal où l\'on déduit les charges réelles (travaux, intérêts, taxe foncière…) au lieu d\'un abattement forfaitaire.',
  'déficit foncier':'Quand les charges dépassent les loyers (location vide au réel) : une partie est déductible du revenu global.',
  'LMNP':'Loueur en meublé non professionnel : statut fiscal de la location meublée (micro-BIC ou réel avec amortissements).',
  'CFE':'Cotisation foncière des entreprises, due chaque année par les loueurs en meublé (sauf petites recettes).',
  'prescription':'Délai au-delà duquel une somme ne peut plus être réclamée en justice (3 ans pour les loyers et charges).',
  'tantièmes':'Quote-part d\'un lot de copropriété, qui sert à répartir les charges entre copropriétaires.',
  'décompte':'Relevé annuel des charges réelles, détaillé par nature ; base de la régularisation.',
  'exigible':'Se dit d\'une somme qui peut être réclamée à partir d\'une date donnée.',
  'indivision':'Propriété d\'un bien par plusieurs personnes (héritiers, couple non marié). Tous doivent consentir au bail.',
  'copie de sécurité':'Fichier qui contient toutes vos données Clef en Main. Il permet de les retrouver sur un autre appareil ou après la perte du téléphone.'
};
function openTerme(k){ openModal({title:'📖 '+esc(k.charAt(0).toUpperCase()+k.slice(1)), body:`<p>${esc(LEXIQUE[k])}</p><p class="hint"><button class="linkbtn" onclick="document.querySelectorAll('.modalbg').forEach(e=>e.remove()); MODAL_STACK=[]; go('aide',{lexique:1})">Voir tout le lexique</button></p>`, actions:[{label:'Compris', cls:'btn-teal'}]}); }
let _lexRe=null;
function lexRegex(){ if(_lexRe) return _lexRe; const keys=Object.keys(LEXIQUE).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\']/g,m=>m==="'"?"['’]":'\\'+m)); _lexRe=new RegExp('(^|[^\\p{L}])('+keys.join('|')+')(?![\\p{L}])','iu'); return _lexRe; }
function lexKey(t){ const low=t.toLowerCase().replace('’','\''); return Object.keys(LEXIQUE).find(k=>k.toLowerCase()===low) || null; }
/* souligne la 1re occurrence de chaque terme dans les textes d'aide (jamais dans les documents ni les champs) */
function annoterLexique(root){
  if(!root) return; const re=lexRegex(); const vus=new Set();
  root.querySelectorAll('.hint, .alert-d, .infobox, .pagehead p, .card > p, .card .small, .checks li, .prose p, .prose li, .dl dt').forEach(el=>{
    if(el.closest('.docsheet, .preview, button, a, label, .codebox')) return;
    const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const n of nodes){
      if(n.parentElement.closest('button, a, .term, input, textarea, select')) continue;
      const m=n.nodeValue.match(re); if(!m) continue; const key=lexKey(m[2]); if(!key || vus.has(key)) continue; vus.add(key);
      const i=m.index+m[1].length; const after=n.splitText(i); after.splitText(m[2].length);
      const b=document.createElement('button'); b.type='button'; b.className='term'; b.dataset.terme=key; b.title='Définition'; b.textContent=after.nodeValue; after.replaceWith(b);
    }
  });
}
document.addEventListener('click', e=>{ const t=e.target.closest && e.target.closest('.term'); if(t){ e.preventDefault(); e.stopPropagation(); openTerme(t.dataset.terme); } }, true);
function lexiqueHtml(){ return `<div class="card" id="lexique"><h3>📖 Lexique</h3><p class="small">Les mots soulignés en pointillés dans l'appli sont expliqués ici : touchez-les pour voir leur définition.</p><dl class="lexique">${Object.keys(LEXIQUE).sort((a,b)=>a.localeCompare(b,'fr')).map(k=>`<dt>${esc(k.charAt(0).toUpperCase()+k.slice(1))}</dt><dd>${esc(LEXIQUE[k])}</dd>`).join('')}</dl></div>`; }

/* ---------------- Protections et aide à l'installation ---------------- */
const estInstallee = ()=> (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true;
const estIOS = ()=> /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && /Macintosh/.test(navigator.userAgent));
function bandeauInstallation(){
  if(estInstallee() || location.protocol==='file:') return '';
  if(estIOS()) return `<div class="infobox warn"><b>Installez l'appli sur l'écran d'accueil.</b> Sur iPhone, les données d'un site ouvert seulement dans Safari peuvent être effacées par Apple après quelques jours sans visite. Bouton Partager › « Sur l'écran d'accueil ». <button class="linkbtn" onclick="openGuide('mobile')">Pas à pas</button></div>`;
  if(/Android/.test(navigator.userAgent)) return `<div class="infobox">Astuce : installez l'appli (menu ⋮ › « Installer l'application ») pour l'ouvrir comme une application, même sans connexion. <button class="linkbtn" onclick="openGuide('mobile')">Pas à pas</button></div>`;
  return '';
}
function bandeauCopie(){
  const lb=STATE.settings.lastBackup; const j=lb?diffDays(lb.slice(0,10), todayISO()):null;
  if(!STATE.baux.length && !STATE.biens.length) return '';
  const cls = j===null || j>30 ? 'warn' : '';
  return `<div class="infobox ${cls} copiebar"><span>💾 ${lb?`Dernière copie de sécurité : ${j===0?'aujourd\'hui':j===1?'hier':'il y a '+j+' jours'}`:'Aucune copie de sécurité : vos données ne sont que sur cet appareil'}.</span> <button class="btn btn-sm ${cls?'btn-teal':'btn-ghost'}" onclick="openSauvegarde()">Faire la copie</button> <button class="linkbtn" onclick="openGuide('sauvegarde')">Pourquoi ?</button></div>`;
}
async function etatStockageHtml(){
  let persist=null, usage=null, quota=null;
  try{ if(navigator.storage&&navigator.storage.persisted) persist=await navigator.storage.persisted(); }catch(e){}
  try{ if(navigator.storage&&navigator.storage.estimate){ const e=await navigator.storage.estimate(); usage=e.usage; quota=e.quota; } }catch(e){}
  return `<p class="small">Espace utilisé : <b>${usage!==null?(usage/1048576).toFixed(1).replace('.',',')+' Mo':'—'}</b>${quota?' sur '+Math.round(quota/1048576).toLocaleString('fr-FR')+' Mo disponibles':''}. Stockage protégé contre l'effacement automatique : <b>${persist===true?'oui':persist===false?'non (installez l\'appli et faites des copies régulières)':'inconnu'}</b>.</p>`;
}
let _errT=0;
function signalerErreur(e){ console.error(e); if(Date.now()-_errT<15000) return; _errT=Date.now(); toast('Un petit problème est survenu. Vos données sont enregistrées ; si cela se répète, faites une copie de sécurité puis rechargez l\'appli.', 6000); }
window.addEventListener('error', e=>signalerErreur(e.error||e.message));
window.addEventListener('unhandledrejection', e=>signalerErreur(e.reason));

/* ---------------- Guides supplémentaires (aide contextuelle) ---------------- */
Object.assign(GUIDES, {
  sauvegarde:{t:'Pourquoi faire une copie de sécurité ?', c:()=>`<p>Vos données (biens, baux, paiements, documents, photos) sont enregistrées <b>uniquement sur cet appareil</b>. Rien n'est envoyé sur Internet : c'est confidentiel, mais si le téléphone est perdu, volé, réinitialisé, ou si les données du navigateur sont effacées, tout disparaît.</p>
    <p>La <b>copie de sécurité</b> est un fichier unique (.clef) qui contient tout. Rangez-le hors du téléphone : iCloud Drive (« Enregistrer dans Fichiers »), Google Drive, ou envoyez-le vous par e-mail. Protégez-le par un mot de passe si vous le rangez en ligne.</p>
    <ul><li><b>Quand ?</b> Une fois par mois (l'accueil vous le rappelle), après une étape importante (bail signé, état des lieux), et toujours avant de changer de téléphone.</li>
    <li><b>Pour retrouver vos données</b> : ☰ Plus › Copie de sécurité › Restaurer une copie. Les données sont fusionnées, rien n'est écrasé.</li>
    <li><b>Deux appareils ?</b> Copie sur celui que vous venez d'utiliser, restauration sur l'autre avant d'y travailler.</li></ul>
    <div class="btnrow"><button class="btn btn-teal" onclick="document.querySelectorAll('.modalbg').forEach(e=>e.remove()); MODAL_STACK=[]; openSauvegarde()">Faire la copie maintenant</button><button class="btn btn-ghost" onclick="rappelCalendrier()">Rappel mensuel dans mon agenda</button></div>`},
  loyers:{t:'Comment fonctionne le suivi des loyers ?', c:()=>`<ol class="steps"><li>Chaque mois, l'appli calcule ce que doit le locataire : loyer + charges, au prorata pour le premier et le dernier mois. Le loyer suit tout seul les révisions et les nouvelles provisions.</li>
    <li>Quand l'argent arrive, touchez <b>Encaissé</b> (ou « Autre montant » si le paiement est partiel). Les paiements remboursent toujours les dettes les plus anciennes en premier.</li>
    <li>Mois payé en entier : <b>quittance</b>. Paiement partiel : l'appli fait un <b>reçu</b> (une quittance pour un paiement incomplet serait une erreur).</li>
    <li>Retard : l'accueil propose la bonne étape (rappel amiable, relance, mise en demeure, caution, CAF).</li></ol>
    <p class="small">Interdit : pénalités de retard, frais de relance ou de quittance facturés au locataire.</p>`},
  charges:{t:'Les charges en 4 étapes', c:()=>`<ol class="steps"><li><b>Chaque mois</b>, le locataire verse une <b>provision</b> pour charges avec son loyer : c'est une avance (ou un <b>forfait</b> fixe en meublé ou en colocation).</li>
    <li><b>Toute l'année</b>, enregistrez vos dépenses (eau, TEOM sur l'avis de taxe foncière, appels de fonds du syndic, contrats d'entretien).</li>
    <li><b>Une fois par an</b>, saisissez le <b>décompte</b> des charges réelles (onglet Charges du logement), idéalement recopié du décompte annuel du syndic, nature par nature. L'appli ne retient que les charges <b>récupérables</b>.</li>
    <li>L'appli calcule la <b>régularisation</b> de chaque locataire au prorata de sa présence : complément à payer (exigible un mois après l'envoi du décompte) ou trop-perçu à rembourser, puis propose d'ajuster la provision. Le compte du locataire est mis à jour automatiquement.</li></ol>`},
  revision:{t:'La révision annuelle du loyer, automatiquement', c:()=>`<ol class="steps"><li>À la date anniversaire du bail (ou dès la publication de l'indice), l'appli calcule le nouveau loyer avec l'indice prévu au contrat (IRL métropole, Corse ou Outre-mer) et <b>prépare la lettre</b> : elle apparaît sur l'accueil.</li>
    <li>Vous envoyez la lettre (recommandé conseillé). Dès que vous notez l'envoi, le nouveau loyer est appliqué dans les loyers, les avis d'échéance et les quittances.</li>
    <li>Si la date anniversaire est passée, la hausse vaut seulement à partir de la demande (pas de rattrapage) et le droit est perdu au bout d'un an.</li></ol>
    <p class="small">Pas de révision pour un logement classé F ou G, ni en bail mobilité, ni si le bail ne la prévoit pas. Vous pouvez désactiver la préparation automatique dans « Modifier les informations » du bail.</p>`},
  emplacements:{t:'Les 6 emplacements et la fin d\'un bail', c:()=>`<p>Chaque emplacement correspond à un <b>logement</b>. Quand un bail se termine, le logement reste et peut être reloué ; l'ancien bail passe dans son historique (rien n'est effacé). Pour libérer un emplacement, <b>archivez</b> le logement (vendu, repris pour vous) depuis sa fiche « Le logement ».</p>`}
});
