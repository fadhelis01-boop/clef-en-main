/* =====================================================================================
   DOCUMENTS — tous les actes et courriers de la vie du bail.
   Chaque modèle déclare : libellé, groupe, icône, envoi conseillé, champs (pré-remplis),
   génération HTML (impression / PDF) et e-mail type d'accompagnement.
   ===================================================================================== */
function ctxBail(bailId){
  const bail=byId('baux',bailId); if(!bail) return null;
  const bien=bienDe(bail), bl=bailleurDe(bail);
  return {bail, bien, bl, locs:bail.locataires||[], loc:(bail.locataires||[])[0]||{}, garants:bail.garants||[]};
}
function villeSignature(x){ return x.bail.lieuSignature || x.bl.ville || x.bien.ville || ''; }
function adresseBailleur(bl){ return [bl.adresse, [bl.cp, bl.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '); }
function destLocataire(x){
  const nouvelle = x.bail.fin && x.bail.fin.adresseNouvelle && ['sortie','termine'].includes(x.bail.statut);
  return {nom:nomsLocataires(x.bail), adresse: nouvelle ? esc(x.bail.fin.adresseNouvelle) : esc(adresseBien(x.bien,true))+'<br>'+esc((x.bien.cp||'')+' '+(x.bien.ville||''))};
}
function blocExp(bl){
  return `<b>${esc(nomBailleur(bl))}</b>${(bl.type==='sci'||bl.type==='morale')&&bl.representant?'<br>représentée par '+esc(bl.representant):''}<br>${esc(bl.adresse||'')}<br>${esc([bl.cp,bl.ville].filter(Boolean).join(' '))}${bl.tel?'<br>Tél. '+esc(bl.tel):''}${bl.email?'<br>'+esc(bl.email):''}${bl.siret?'<br>SIREN/SIRET '+esc(bl.siret):''}`;
}
const ENVOIS = {lrar:'Lettre recommandée avec accusé de réception', simple:'Lettre simple', main:'Remise en main propre contre émargement', mail:'Envoi par courrier électronique', cj:'Acte de commissaire de justice'};
function envoiField(def, choix){ return {n:'envoi', l:'Comment l\'envoyer ?', t:'select', v:def, o:(choix||['lrar','simple','main','mail']).map(k=>[k,ENVOIS[k]]), h: def==='lrar'?'La lettre recommandée avec accusé de réception (ou la remise en main propre contre signature) vous donne une preuve datée : indispensable en cas de litige.':''}; }
function lettre(x, o){
  const d = o.dest || destLocataire(x);
  return `<div class="docsheet lettre">
    <div class="l-exp">${blocExp(x.bl)}</div>
    <div class="l-dest">${esc(d.nom)}<br>${d.adresse}</div>
    <div class="l-date">${esc(villeSignature(x))}, le ${fdate(o.date||todayISO())}</div>
    ${o.envoi && o.envoi!=='simple' && o.envoi!=='mail' ? `<div class="l-envoi">${ENVOIS[o.envoi]}${o.envoi==='lrar'?' n° ______________':''}</div>`:''}
    <div class="l-objet"><b>Objet :</b> ${o.objet}</div>
    <div class="l-ref">Logement : ${esc(adresseBien(x.bien))} — Bail du ${fdate(x.bail.dateDebut)}${x.bail.ref?' (réf. '+esc(x.bail.ref)+')':''}</div>
    <div class="l-corps">${o.politesseDebut===false?'':'<p>'+(o.civ||'Madame, Monsieur,')+'</p>'}${o.corps}
      <p>${o.politesse||'Je vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.'}</p></div>
    <div class="l-sign">${esc(nomBailleur(x.bl))}${(x.bl.type==='sci'||x.bl.type==='morale')&&x.bl.representant?'<br>'+esc(x.bl.representant):''}<div class="sigspace">Signature</div></div>
    ${o.pj&&o.pj.length?`<div class="l-pj"><b>Pièce(s) jointe(s) :</b> ${o.pj.map(esc).join(' ; ')}</div>`:''}
    ${o.envoi==='main'?`<div class="emarg">Remis en main propre le ____ / ____ / ________ &nbsp;&nbsp; Nom et signature du destinataire :</div>`:''}
    ${o.legal?`<div class="legal">${o.legal}</div>`:''}
  </div>`;
}
function tableau(rows, foot){ return `<table>${rows.map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`).join('')}${foot?`<tr class="tot"><td>${foot[0]}</td><td class="num">${foot[1]}</td></tr>`:''}</table>`; }
function sigrow(a,b){ return `<div class="sigrow"><div class="sigbox">${a}<div class="line">Signature précédée de « Lu et approuvé »</div></div><div class="sigbox">${b}<div class="line">Signature précédée de « Lu et approuvé »</div></div></div>`; }
function moisOptions(bail, n){
  const out=[]; let mk=monthKey(addMonths(todayISO(),1));
  for(let i=0;i<(n||24);i++){ if(bail.dateDebut && mk<monthKey(bail.dateDebut)) break; out.push([mk, monthLabelCap(mk)]); mk=prevMonthKey(mk); }
  return out;
}

/* =====================================================================================
   CONTRAT DE BAIL (contrat type — décret 2015-587 modifié par le décret 2026-596)
   ===================================================================================== */
function genBail(x){
  const {bail,bien,bl,locs}=x; const meuble=estMeuble(bail); const T=TYPES_BAIL[bail.type];
  const ver=R('contratType', bail.dateSignature||bail.dateDebut||todayISO());
  const loyer=num(bail.loyerHC), ch=num(bail.charges);
  const dpe=bien.dpe||{}; const dg=bien.diagnostics||{};
  const ech=echeanceBail(bail, bail.dateDebut);
  const duree = bail.type==='vide' ? (bail.dureeReduite? `${bail.dureeMois} mois (durée réduite, article 11 de la loi du 6 juillet 1989). Événement justifiant la reprise : ${esc(bail.motifDureeReduite)}. Le bailleur confirmera la réalisation de cet événement au moins deux mois avant le terme.` : `${dureeLegale(bail)/12} ans, renouvelable par tacite reconduction`)
    : bail.type==='meuble' ? '1 an, renouvelable par tacite reconduction'
    : bail.type==='etudiant' ? '9 mois. Le bail n\'est pas reconduit tacitement : il prend fin à son terme'
    : `${bail.dureeMois} mois (bail mobilité, non renouvelable et non reconductible)`;
  const prem = echeancesBail(Object.assign({}, bail, {statut:'actif'}), bail.dateDebut)[0];
  const multi = locs.length>1;
  const enc=bien.encadrement||{};
  const annexes=[
    'Dossier de diagnostic technique : DPE'+(dg.crep||num(bien.anneeConstruction)&&num(bien.anneeConstruction)<1949?', constat de risque d\'exposition au plomb':'')+(dg.elec?', état de l\'installation électrique':'')+(dg.gaz?', état de l\'installation de gaz':'')+', état des risques et pollutions'+(dg.bruit?', diagnostic bruit':''),
    'Notice d\'information relative aux droits et obligations des locataires et des bailleurs (arrêté du 29 mai 2015)',
    'État des lieux d\'entrée'+(meuble?' et inventaire détaillé du mobilier':''),
    bien.regime==='copro'?'Extraits du règlement de copropriété concernant la destination de l\'immeuble, la jouissance et l\'usage des parties privatives et communes, et la quote-part des charges':null,
    (bail.garants||[]).some(g=>g.type==='personne')?'Acte(s) de cautionnement':null,
    enc.actif?'Référence aux loyers de référence (encadrement)':null,
    bien.permisLouer?'Autorisation préalable ou récépissé de déclaration de mise en location':null,
    bail.type==='vide' || bail.type==='meuble' ? 'Grille de vétusté (si convenue entre les parties)' : null,
    'Attestation d\'assurance du locataire contre les risques locatifs (à fournir à la remise des clés)'
  ].filter(Boolean);
  return `<div class="docsheet bail">
  <h1 class="center">Contrat de location<br><small>${meuble?'Logement meublé':'Logement nu'} — usage de résidence principale${bail.type==='mobilite'?' — BAIL MOBILITÉ':''}${bail.type==='etudiant'?' — location à un étudiant (9 mois)':''}</small></h1>
  <p class="small center">Soumis au titre Ier${meuble?' bis':''}${bail.type==='mobilite'?' ter':''} de la loi n° 89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs. Établi selon le contrat type défini par le décret n° 2015-587 du 29 mai 2015${ver==='2026-10'?', dans sa rédaction issue du décret n° 2026-596 du 6 juillet 2026':''}.</p>
  <p class="small">Modalités d'application du contrat : le régime de droit commun en matière de baux d'habitation est défini principalement par la loi n° 89-462 du 6 juillet 1989. L'ensemble de ces dispositions étant d'ordre public, elles s'imposent aux parties qui, en principe, ne peuvent pas y renoncer.</p>

  <h2>I. Désignation des parties</h2>
  <p>Le présent contrat est conclu entre les soussignés :</p>
  <p><b>Le bailleur :</b> ${esc(nomBailleur(bl))}${bl.type==='physique'||bl.type==='indivision'?', personne physique':bl.type==='sci'?', société civile immobilière familiale':', personne morale'}${bl.siret?' (SIREN '+esc(bl.siret)+')':''}${(bl.type==='sci'||bl.type==='morale')&&bl.representant?', représentée par '+esc(bl.representant):''}, domicilié(e) ${esc(adresseBailleur(bl))}${bl.email?', courriel : '+esc(bl.email):''}${ver==='2026-10'&&bl.tel?', téléphone portable : '+esc(bl.tel):''}.<br>Le bail est conclu directement entre les parties, sans mandataire ni intermédiaire.</p>
  <p><b>${multi?'Les locataires':'Le locataire'} :</b> ${locs.map(l=>`${esc(nomPersonne(l))}${l.email?', courriel : '+esc(l.email):''}${ver==='2026-10'&&l.tel?', téléphone portable : '+esc(l.tel):''}`).join(' ; ')}.</p>
  <p>Désigné(s) ci-après « le locataire ».</p>

  <h2>II. Objet du contrat</h2>
  <p>Le présent contrat a pour objet la location d'un logement ainsi déterminé :</p>
  <h3>A. Consistance du logement</h3>
  <table>
    <tr><td>Localisation</td><td>${esc(adresseBien(x.bien))}${bien.etage?', étage : '+esc(bien.etage):''}${bien.porte?', porte : '+esc(bien.porte):''}</td></tr>
    <tr><td>Type d'habitat</td><td>${bien.type==='Maison'?'Individuel':'Immeuble collectif'} — ${esc(bien.type||'')}</td></tr>
    <tr><td>Régime juridique de l'immeuble</td><td>${bien.regime==='copro'?'Copropriété':'Mono-propriété'}</td></tr>
    <tr><td>Période de construction</td><td>${esc(bien.anneeConstruction||'—')}</td></tr>
    <tr><td>Surface habitable</td><td>${esc(bien.surface||'—')} m²</td></tr>
    <tr><td>Nombre de pièces principales</td><td>${esc(bien.pieces||'—')}</td></tr>
    <tr><td>Autres parties du logement</td><td>${esc(bien.autresParties||'Néant')}</td></tr>
    <tr><td>Éléments d'équipement</td><td>${esc(bien.equipements||'Cuisine, salle d\'eau, WC')}</td></tr>
    <tr><td>Production de chauffage</td><td>${esc(bien.chauffage==='collectif'?'Collective':'Individuelle')}${bien.chauffageDetail?' — '+esc(bien.chauffageDetail):''}${bien.chauffage==='collectif'?' (répartition : '+esc(bien.repartitionChauffage||'selon tantièmes')+')':''}</td></tr>
    <tr><td>Production d'eau chaude sanitaire</td><td>${esc(bien.eauChaude==='collectif'?'Collective':'Individuelle')}</td></tr>
    <tr><td>Performance énergétique (DPE)</td><td>Classe énergie <b>${esc(dpe.classe||'—')}</b>${dpe.ges?', classe climat '+esc(dpe.ges):''}${dg.dpe?' — DPE du '+fdateCourt(dg.dpe):''}</td></tr>
    <tr><td>Dépenses annuelles d'énergie estimées</td><td>${dpe.coutMin||dpe.coutMax?`Entre ${eur0(dpe.coutMin)} et ${eur0(dpe.coutMax)} par an (prix de l'énergie indexés au ${esc(dpe.anneeRef||'1er janvier de l\'année de référence du DPE')}), pour un usage standard`:'Montant indiqué dans le DPE annexé'}</td></tr>
  </table>
  <h3>B. Destination des locaux</h3><p>${bail.usageMixte?'Usage mixte professionnel et d\'habitation.':'Usage d\'habitation exclusivement.'} Le logement constitue la résidence principale du locataire.</p>
  <h3>C. Locaux et équipements accessoires à usage privatif</h3><p>${esc(bien.annexes||'Néant')}</p>
  <h3>D. Parties et équipements communs</h3><p>${esc(bien.partiesCommunes||(bien.regime==='copro'?'Accès aux parties communes de l\'immeuble selon le règlement de copropriété':'Néant'))}</p>
  <h3>E. Équipements d'accès aux technologies de l'information et de la communication</h3><p>${esc(bien.tic||'Raccordement au réseau téléphonique / fibre selon desserte de l\'immeuble')}</p>
  ${ver==='2026-10'?`<h3>F. Servitude de résidence principale</h3><p>${bien.servitudeRP?'Le logement est soumis à une servitude d\'usage de résidence principale instituée par le plan local d\'urbanisme (article L. 151-14-1 du code de l\'urbanisme) : il doit être occupé exclusivement à titre de résidence principale.':'Le logement n\'est pas soumis, à la connaissance du bailleur, à une servitude de résidence principale prévue par le plan local d\'urbanisme.'}</p>`:''}

  <h2>III. Date de prise d'effet et durée du contrat</h2>
  <p>Date de prise d'effet : <b>${fdate(bail.dateDebut)}</b>.<br>Durée du contrat : ${duree}.${ech&&!reconductible(bail)?' Terme : '+fdate(ech)+'.':''}</p>
  ${bail.type==='mobilite'?`<p>Le locataire justifie, à la date de prise d'effet, être <b>${esc(bail.motifMobilite)}</b> (article 25-12 de la loi du 6 juillet 1989). Le bail mobilité ne peut être ni renouvelé ni reconduit ; sa durée peut être modifiée une fois par avenant sans que la durée totale excède dix mois. Si, au terme, les parties concluent un nouveau bail portant sur le même logement, ce nouveau bail est soumis au titre Ier bis.</p>`:''}
  <p>Le locataire peut mettre fin au bail à tout moment, après avoir donné congé, avec un préavis de ${bail.type==='vide'?`trois mois, réduit à un mois${bien.zoneTendue?' (le logement étant situé en zone tendue)':''} dans les cas prévus à l'article 15 de la loi`:'un mois'}. ${reconductible(bail)?`Le bailleur peut donner congé pour la fin du bail, avec un préavis de ${bail.type==='vide'?'six':'trois'} mois, uniquement pour reprendre le logement, le vendre${bail.type==='meuble'?'':' (avec droit de préemption du locataire)'} ou pour un motif légitime et sérieux.`:''}</p>

  <h2>IV. Conditions financières</h2>
  <h3>A. Loyer</h3>
  <p>Montant du loyer mensuel : <b>${eur(loyer)}</b> hors charges${num(bail.complementLoyer)>0?`, dont un complément de loyer de ${eur(bail.complementLoyer)} justifié par : ${esc(bail.complementMotif)}`:''}.</p>
  ${bien.zoneTendue?`<p>Le logement est situé dans une zone d'urbanisation continue de plus de 50 000 habitants où s'applique le décret fixant annuellement le montant maximum d'évolution des loyers à la relocation.</p>`:''}
  ${enc.actif?`<p>Le loyer est soumis à l'encadrement : loyer de référence ${eur(enc.loyerRef)}/m², loyer de référence majoré ${eur(enc.loyerRefMaj)}/m² (soit ${eur(r2(num(enc.loyerRefMaj)*num(bien.surface)))} pour ${esc(bien.surface)} m²).</p>`:''}
  ${num(bail.dernierLoyer)?`<p>Informations relatives au loyer du dernier locataire : montant du dernier loyer acquitté ${eur(bail.dernierLoyer)}${bail.dernierLoyerDate?', versé le '+fdate(bail.dernierLoyerDate):''}${bail.derniereRevisionPrec?', date de la dernière révision : '+fdate(bail.derniereRevisionPrec):''}.</p>`:''}
  ${bail.type!=='mobilite' && bail.revision!==false?`<p>Révision du loyer : le loyer sera révisé chaque année à la date anniversaire du contrat${bail.dateRevisionBase&&bail.dateRevisionBase!==bail.dateDebut?' (le '+fdate(bail.dateRevisionBase).replace(/ \d{4}$/,'')+')':''}, en fonction de la variation de l'indice de référence des loyers (IRL) publié par l'INSEE. Trimestre de référence : <b>${trimestreLabel((bail.irl||{}).trimestre)}</b>${(bail.irl||{}).valeur?' (valeur '+String(bail.irl.valeur).replace('.',',')+')':''}. ${['F','G'].includes(dpeClasse(bien))?'Le logement étant classé '+dpeClasse(bien)+', le loyer ne peut faire l\'objet d\'aucune révision tant que cette classe n\'est pas améliorée.':''}</p>`:'<p>Le loyer n\'est pas révisable en cours de bail.</p>'}
  <h3>B. Charges récupérables</h3>
  <p>${bail.chargesType==='forfait'?`Forfait de charges : <b>${eur(ch)}</b> par mois. Il ne donne lieu à aucune régularisation${bail.type!=='mobilite'?' et peut être révisé chaque année dans les mêmes conditions que le loyer':''}.`:`Provision sur charges : <b>${eur(ch)}</b> par mois. Elle fait l'objet d'une régularisation annuelle : un mois avant, le bailleur communique le décompte par nature de charges et, en copropriété, le mode de répartition ; les pièces justificatives sont tenues à disposition du locataire pendant six mois.`}</p>
  <h3>C. Modalités de paiement</h3>
  <table>
    <tr><td>Périodicité</td><td>Mensuelle, ${bail.terme==='echu'?'à terme échu':'à terme à échoir (d\'avance)'}</td></tr>
    <tr><td>Date de paiement</td><td>Le ${esc(bail.jourPaiement||1)} de chaque mois</td></tr>
    <tr><td>Mode de paiement</td><td>${esc(bail.modePaiement||'Virement')}${bail.iban?' — '+esc(bail.iban):''}</td></tr>
    <tr><td>Montant mensuel total</td><td><b>${eur(loyer+ch)}</b> (loyer ${eur(loyer)} + charges ${eur(ch)})</td></tr>
    ${prem && prem.prorata<1?`<tr><td>Première échéance (prorata)</td><td>${eur(prem.montant)} pour la période du ${fdate(prem.debut)} au ${fdate(prem.fin)}</td></tr>`:''}
  </table>
  <p>Le bailleur remet gratuitement une quittance au locataire qui en fait la demande. Aucuns frais d'envoi ou de quittance ne peuvent être exigés.</p>

  <h2>V. Travaux</h2>
  <p>Travaux d'amélioration ou de mise en conformité effectués depuis la fin du dernier contrat ou le dernier renouvellement : ${esc(bail.travauxDepuis||'néant')}.</p>
  ${bail.travauxBailleur?`<p>Travaux à la charge du bailleur convenus en cours de bail : ${esc(bail.travauxBailleur)}.</p>`:''}

  <h2>VI. Garanties</h2>
  <p>${bail.type==='mobilite'?'Aucun dépôt de garantie ne peut être exigé (article 25-17 de la loi). ':`Dépôt de garantie : <b>${eur(bail.depot)}</b>, soit au plus ${bail.type==='vide'?'un mois':'deux mois'} de loyer hors charges. Il ne porte pas intérêt et ne peut être révisé. Il est restitué dans un délai d'un mois à compter de la remise des clés si l'état des lieux de sortie est conforme à l'état des lieux d'entrée, de deux mois dans le cas contraire, déduction faite des sommes restant dues et dûment justifiées. À défaut, le montant dû est majoré de 10 % du loyer mensuel hors charges pour chaque période mensuelle commencée en retard. `}
  ${(bail.garants||[]).length?'Garantie(s) : '+(bail.garants||[]).map(g=>g.type==='visale'?'garantie Visale (Action Logement)'+(g.visa?' — visa n° '+esc(g.visa):''):g.type==='personne'?'cautionnement de '+esc(nomPersonne(g))+' (acte séparé annexé)':esc(g.libelle||'autre garantie')).join(' ; ')+'.':''}</p>

  ${multi?`<h2>VII. Clause de solidarité</h2><p>Les locataires sont tenus solidairement et indivisiblement de l'exécution des obligations du présent contrat. En cas de départ de l'un d'eux, sa solidarité (et celle de la personne qui s'est portée caution pour lui) cesse lorsqu'un nouveau colocataire figure au bail ou, à défaut, à l'expiration d'un délai de six mois après la date d'effet de son congé.</p>`:''}

  <h2>${multi?'VIII':'VII'}. Clause résolutoire</h2>
  <p>Le présent contrat sera résilié de plein droit :</p>
  <ul>
    <li>à défaut de paiement de tout ou partie du loyer ou des charges dûment justifiées à leur terme${bail.type==='mobilite'?'':', ou à défaut de versement du dépôt de garantie'}, <b>six semaines</b> après un commandement de payer demeuré infructueux ;</li>
    <li>à défaut de justification d'une assurance contre les risques locatifs, un mois après un commandement demeuré infructueux ;</li>
    <li>en cas de troubles de voisinage constatés par une décision de justice passée en force de chose jugée.</li>
  </ul>
  <p>Le commandement de payer reproduit les dispositions de l'article 24 de la loi du 6 juillet 1989. Le juge peut, à la demande du locataire, accorder des délais de paiement et suspendre les effets de la clause résolutoire pendant ces délais.</p>

  <h2>${multi?'IX':'VIII'}. Honoraires de location</h2>
  <p>Le bail étant conclu sans intermédiaire, aucun honoraire n'est dû par le locataire.</p>

  <h2>${multi?'X':'IX'}. Autres conditions particulières</h2>
  <p>${esc(bail.conditionsParticulieres||'Néant.')}</p>
  ${bail.chargesType==='provision'||bail.chargesType==='forfait'?'':''}
  <p class="small">Le locataire est tenu de s'assurer contre les risques locatifs et d'en justifier lors de la remise des clés puis chaque année. ${meuble?'':'À défaut, le bailleur peut, un mois après une mise en demeure restée sans effet, souscrire une assurance pour le compte du locataire et en récupérer le montant majoré de 10 % au plus. '}Sont réputées non écrites les clauses interdites par l'article 4 de la loi du 6 juillet 1989 (pénalités de retard, frais de relance, prélèvement automatique imposé, interdiction d'héberger ses proches, responsabilité collective, etc.).</p>

  <h2>${multi?'XI':'X'}. Annexes</h2>
  <ul>${annexes.map(a=>'<li>'+esc(a)+'</li>').join('')}</ul>

  <p>Fait à ${esc(villeSignature(x))}, le ${fdate(bail.dateSignature||todayISO())}, en ${locs.length+1} exemplaires originaux, dont un remis à chaque partie qui le reconnaît.</p>
  <div class="sigrow multi">
    <div class="sigbox">Le bailleur<div class="line">Signature précédée de « Lu et approuvé »</div></div>
    ${locs.map(l=>`<div class="sigbox">${esc(nomPersonne(l))}<div class="line">Signature précédée de « Lu et approuvé »</div></div>`).join('')}
  </div>
  <div class="legal">Chaque page doit être paraphée par toutes les parties. Ce contrat reprend la structure et les mentions du contrat type réglementaire ; la rédaction officielle du modèle est consultable sur Légifrance (décret n° 2015-587 et ses annexes). En cas de doute, l'ADIL de votre département vous conseille gratuitement.</div>
  </div>`;
}

/* ---- Acte de cautionnement (article 22-1 de la loi du 6 juillet 1989) ---- */
function genCaution(x, d){
  const g=(x.garants||[])[num(d.garant)||0] || {};
  const {bail}=x; const loyer=num(bail.loyerHC), ch=num(bail.charges);
  const indet = d.duree==='indeterminee';
  return `<div class="docsheet bail">
  <h1 class="center">Acte de cautionnement<br><small>${d.solidaire!==false?'Caution solidaire':'Caution simple'} — bail d'habitation</small></h1>
  <p><b>La caution :</b> ${esc(nomPersonne(g))}${g.dateNaissance?', née le '+fdate(g.dateNaissance):''}, demeurant ${esc(g.adresse||'—')}.</p>
  <p><b>Le bailleur (créancier) :</b> ${esc(nomBailleur(x.bl))}, ${esc(adresseBailleur(x.bl))}.</p>
  <p><b>Le(s) locataire(s) garanti(s) :</b> ${esc(nomsLocataires(bail))}.</p>
  <p><b>Le bail :</b> logement situé ${esc(adresseBien(x.bien))}, bail ${esc(TYPES_BAIL[bail.type].l.toLowerCase())} prenant effet le ${fdate(bail.dateDebut)}${bail.dateSignature?', signé le '+fdate(bail.dateSignature):''}.</p>
  <h2>Engagement</h2>
  <p>Je soussigné(e) ${esc(nomPersonne(g))} déclare me porter caution ${d.solidaire!==false?'solidaire, en renonçant au bénéfice de discussion,':''} pour le paiement du loyer, des charges, des réparations locatives et, le cas échéant, des indemnités d'occupation, frais de procédure et intérêts dus par le locataire au titre du bail désigné ci-dessus.</p>
  <table>
    <tr><td>Montant du loyer mensuel à la signature</td><td class="num">${eur(loyer)}</td></tr>
    <tr><td>Charges mensuelles</td><td class="num">${eur(ch)}</td></tr>
    <tr><td>Conditions de révision du loyer</td><td>${bail.type==='mobilite'||bail.revision===false?'Loyer non révisable':'Révision annuelle à la date anniversaire selon l\'indice de référence des loyers (IRL) — trimestre de référence : '+trimestreLabel((bail.irl||{}).trimestre)}</td></tr>
    <tr><td>Montant maximal de l'engagement</td><td class="num"><b>${eur(d.plafond)}</b></td></tr>
    <tr><td>Durée de l'engagement</td><td>${indet?'Durée indéterminée':'Jusqu\'au '+fdate(d.dateFin)+' (durée déterminée)'}</td></tr>
  </table>
  <p>Je reconnais avoir parfaitement connaissance de la nature et de l'étendue de mon engagement, et avoir reçu un exemplaire du contrat de location.</p>
  <h2>Reproduction de l'avant-dernier alinéa de l'article 22-1 de la loi du 6 juillet 1989</h2>
  <p class="small">« Lorsque le cautionnement d'obligations résultant d'un contrat de location conclu en application du présent titre ne comporte aucune indication de durée ou lorsque la durée du cautionnement est stipulée indéterminée, la caution peut le résilier unilatéralement. La résiliation prend effet au terme du contrat de location, qu'il s'agisse du contrat initial ou d'un contrat reconduit ou renouvelé, au cours duquel le bailleur reçoit notification de la résiliation. »</p>
  <p class="small">La personne qui se porte caution fait précéder sa signature de sa main de la mention de l'engagement ci-dessus (montant maximal et durée). Depuis la loi ELAN du 23 novembre 2018, la mention manuscrite n'est plus exigée à peine de nullité, mais elle reste recommandée comme preuve du consentement éclairé.</p>
  ${x.bien.gli?'<p class="small"><b>Rappel :</b> un bailleur assuré contre les loyers impayés ne peut exiger de caution, sauf si le locataire est étudiant ou apprenti.</p>':''}
  <p>Fait à ${esc(villeSignature(x))}, le ${fdate(d.date||todayISO())}, en deux exemplaires.</p>
  <div class="sigrow"><div class="sigbox">La caution<div class="line">Mention « Bon pour caution ${d.solidaire!==false?'solidaire ':''}à hauteur de ${eur(d.plafond)} ${indet?'pour une durée indéterminée':'jusqu\'au '+fdate(d.dateFin)} » puis signature</div></div><div class="sigbox">Le bailleur<div class="line">Signature</div></div></div>
  </div>`;
}

/* ---- Récépissé de remise des annexes ---- */
function genRemiseAnnexes(x, d){
  const items = (d.items||'').split('\n').filter(Boolean);
  return `<div class="docsheet">
  <h1>Récépissé de remise des documents annexés au bail</h1>
  <p>Je soussigné(e) ${esc(nomsLocataires(x.bail))}, locataire du logement situé ${esc(adresseBien(x.bien))}, reconnais avoir reçu de ${esc(nomBailleur(x.bl))}, le ${fdate(d.date)}, les documents suivants :</p>
  <ul class="checks">${items.map(i=>'<li>☐ '+esc(i)+'</li>').join('')}</ul>
  <p>Ainsi que ${esc(d.cles||'les clés')}.</p>
  <div class="sigrow"><div class="sigbox">Le bailleur<div class="line">Signature</div></div><div class="sigbox">Le(s) locataire(s)<div class="line">Signature</div></div></div>
  </div>`;
}

/* ---- État des lieux (entrée / sortie, avec comparaison et photos) ---- */
function genEtatLieux(x, d, sens){
  const entree = sens==='sortie' ? STATE.docs.filter(o=>o.bailId===x.bail.id && o.type==='etat_lieux_entree').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0] : null;
  const refEtat = (ri, label)=>{ if(!entree) return null; const r=(entree.data.rooms||[])[ri]; if(!r) return null; const it=(r.items||[]).find(i=>i.label===label); return it? it.etat : null; };
  const rooms=(d.rooms||[]).map((r,ri)=>{
    const rows=(r.items||[]).map(it=>{ const e0=refEtat(ri,it.label); const diff = e0 && e0!==it.etat;
      return `<tr${diff?' class="diff"':''}><td>${esc(it.label)}</td>${sens==='sortie'?`<td>${esc(e0||'—')}</td>`:''}<td>${esc(it.etat||'—')}</td><td>${esc(it.obs||'')}</td></tr>`; }).join('');
    const ph=[]; (r.items||[]).forEach(it=>(it.photos||[]).forEach(p=>ph.push({p, l:it.label})));
    return `<h3>${esc(r.name)}</h3><table><tr><th>Élément</th>${sens==='sortie'?'<th>À l\'entrée</th>':''}<th>${sens==='sortie'?'À la sortie':'État'}</th><th>Observations</th></tr>${rows||'<tr><td colspan="4">—</td></tr>'}</table>
      ${ph.length?`<div class="photogrid">${ph.map(o=>`<div class="photobox"><img data-ph="${esc(o.p)}" alt=""><div class="cap">${esc(o.l)}</div></div>`).join('')}</div>`:''}`;
  }).join('');
  const meuble=estMeuble(x.bail);
  const inv = meuble && d.inventaire ? `<h2>Inventaire et état du mobilier</h2><table><tr><th>Équipement</th><th>Qté</th><th>État</th><th>Observations</th></tr>${d.inventaire.map(i=>`<tr${i.entree&&i.entree!==i.etat?' class="diff"':''}><td>${esc(i.label)}${i.entree&&i.entree!==i.etat?' <small>(entrée : '+esc(i.entree)+')</small>':''}</td><td>${esc(i.qte||'')}</td><td>${esc(i.etat||'')}</td><td>${esc(i.obs||'')}</td></tr>`).join('')}</table>`:'';
  return `<div class="docsheet">
  <h1>État des lieux ${sens==='sortie'?'de sortie':'d\'entrée'}${meuble?' et inventaire du mobilier':''}</h1>
  <p class="small">Établi contradictoirement entre les parties (article 3-2 de la loi du 6 juillet 1989, décret n° 2016-382 du 30 mars 2016).</p>
  <table>
    <tr><td>Date de l'état des lieux</td><td>${fdate(d.date)}${d.heure?' à '+esc(d.heure):''}</td></tr>
    <tr><td>Logement</td><td>${esc(adresseBien(x.bien))} — ${esc(x.bien.type||'')} ${meuble?'meublé':'non meublé'}, ${esc(x.bien.surface||'—')} m², ${esc(x.bien.pieces||'—')} pièce(s)</td></tr>
    <tr><td>Bailleur</td><td>${esc(nomBailleur(x.bl))}, ${esc(adresseBailleur(x.bl))}${d.representant?' — représenté par '+esc(d.representant):''}</td></tr>
    <tr><td>Locataire(s)</td><td>${esc(nomsLocataires(x.bail))}${sens==='sortie'&&d.nouvelleAdresse?' — nouvelle adresse : '+esc(d.nouvelleAdresse):''}</td></tr>
    <tr><td>Date d'entrée dans les lieux</td><td>${fdate(x.bail.dateDebut)}</td></tr>
  </table>
  <h2>Relevés des compteurs</h2>
  <table><tr><th>Compteur</th><th>N° / référence</th><th>Relevé</th></tr>
    <tr><td>Électricité</td><td>${esc(d.elecNum||'')}</td><td>${esc(d.compteurElec||'—')}</td></tr>
    <tr><td>Gaz</td><td>${esc(d.gazNum||'')}</td><td>${esc(d.compteurGaz||'—')}</td></tr>
    <tr><td>Eau froide</td><td></td><td>${esc(d.compteurEau||'—')}</td></tr>
    <tr><td>Eau chaude</td><td></td><td>${esc(d.compteurEauChaude||'—')}</td></tr>
  </table>
  <p>Chauffage : ${esc(d.chauffageEtat||'—')} ${d.chaudiereEntretien?' — dernier entretien de la chaudière : '+fdate(d.chaudiereEntretien):''}</p>
  <h2>Pièces et équipements</h2>${rooms}
  ${inv}
  <h2>Clés et moyens d'accès remis</h2><p>${esc(d.cles||'—')}</p>
  <h2>Observations générales${sens==='sortie'?' et réserves':''}</h2><p>${esc(d.observations||'Néant.')}</p>
  ${sens==='sortie'&&entree?'<p class="small">Les lignes surlignées signalent un état différent de celui constaté à l\'entrée. Seules les dégradations imputables au locataire, au-delà de l\'usure normale (vétusté), peuvent être retenues sur le dépôt de garantie.</p>':''}
  ${sens==='entree'?'<p class="small">Le locataire peut demander à compléter cet état des lieux dans les 10 jours suivant son établissement, et, pour les éléments de chauffage, durant le premier mois de la période de chauffe.</p>':''}
  <div class="legal">Le présent état des lieux, établi en autant d'exemplaires que de parties, fait foi entre elles. ${d.photosAnnexe!==false?'Les photographies datées font partie intégrante du document.':''}</div>
  <div class="sigrow"><div class="sigbox">Le bailleur<div class="line">Signature</div></div><div class="sigbox">Le(s) locataire(s)<div class="line">Signature</div></div></div>
  </div>`;
}

/* ---- Quittance (paiement intégral) ou reçu (paiement partiel) — article 21 ---- */
function genQuittance(x, d){
  const ligne = etatMois(x.bail, d.mois) || {loyerHC:0, charges:0, montant:0, paye:0, debut:monthFirst(d.mois), fin:monthLast(d.mois)};
  const integral = ligne.reste<=0.005 && ligne.montant>0;
  const apl = num(d.apl);
  const loc = nomsLocataires(x.bail);
  if(!integral){
    return `<div class="docsheet">
      <div class="letterhead"><div>${blocExp(x.bl)}</div><div class="right">${esc(loc)}<br>${esc(adresseBien(x.bien))}</div></div>
      <h1>Reçu de paiement partiel</h1><p class="small">Période : ${monthLabel(d.mois)}</p>
      <p>Je soussigné(e) ${esc(nomBailleur(x.bl))} reconnais avoir reçu de ${esc(loc)} la somme de <b>${eur(ligne.paye)}</b> à valoir sur le loyer et les charges de ${monthLabel(d.mois)}, dont le montant total est de ${eur(ligne.montant)}.</p>
      ${tableau([['Loyer hors charges dû', eur(ligne.loyerHC)], ['Charges dues', eur(ligne.charges)], ['Total dû', eur(ligne.montant)], ['Montant reçu', eur(ligne.paye)]], ['Reste à payer', eur(ligne.reste)])}
      <div class="legal">Ce document n'est pas une quittance : en cas de paiement partiel, le bailleur délivre un reçu (article 21 de la loi du 6 juillet 1989). La quittance sera remise après paiement intégral.</div>
      <div class="sigrow"><div class="sigbox">Fait à ${esc(villeSignature(x))}, le ${fdate(todayISO())}<div class="line">${esc(nomBailleur(x.bl))}</div></div><div class="sigbox"></div></div>
    </div>`;
  }
  return `<div class="docsheet">
    <div class="letterhead"><div>${blocExp(x.bl)}</div><div class="right">${esc(loc)}<br>${esc(adresseBien(x.bien))}</div></div>
    <h1>Quittance de loyer</h1><p class="small">Période du ${fdate(ligne.debut)} au ${fdate(ligne.fin)}</p>
    <p>Je soussigné(e) ${esc(nomBailleur(x.bl))}, propriétaire du logement désigné ci-dessus, déclare avoir reçu de ${esc(loc)} la somme de <b>${eur(ligne.montant)}</b> au titre du paiement du loyer et des charges pour la période de ${monthLabel(d.mois)}, et lui en donne quittance, sous réserve de tous mes droits.</p>
    ${tableau([['Loyer hors charges', eur(ligne.loyerHC)], [(x.bail.chargesType==='forfait'?'Forfait de charges':'Provision pour charges'), eur(ligne.charges)]].concat(apl?[['dont aide au logement versée directement au bailleur (CAF/MSA)', eur(apl)],['dont part payée par le locataire', eur(ligne.montant-apl)]]:[]), ['Total payé', eur(ligne.montant)])}
    ${ligne.payeLe?`<p class="small">Paiement reçu le ${fdate(d.datePaiement||ligne.payeLe)}${(d.modePaiement||ligne.mode)?' — mode : '+esc(d.modePaiement||ligne.mode):''}.</p>`:''}
    <div class="legal">Quittance délivrée gratuitement (article 21 de la loi n° 89-462 du 6 juillet 1989). Le paiement de cette période ne présume pas du paiement des termes antérieurs.</div>
    <div class="sigrow"><div class="sigbox">Fait à ${esc(villeSignature(x))}, le ${fdate(todayISO())}<div class="line">${esc(nomBailleur(x.bl))}</div></div><div class="sigbox"></div></div>
  </div>`;
}

/* =====================================================================================
   REGISTRE DES MODÈLES
   groupe : entree | mois | an | incident | sortie | attest
   ===================================================================================== */
const DOCS = {
  contrat_bail: { l:'Contrat de bail', g:'entree', ic:'📜', envoi:'main', d:'Le contrat complet au modèle officiel, avec toutes les mentions obligatoires.',
    direct:true, gen:(x)=>genBail(x),
    mail:x=>({o:'Votre contrat de location — '+adresseBien(x.bien,true), c:`Bonjour,\n\nVous trouverez ci-joint le projet de contrat de location du logement situé ${adresseBien(x.bien)}, qui prendra effet le ${fdate(x.bail.dateDebut)}.\n\nMerci de le relire ; nous le signerons ensemble lors de la remise des clés (chaque page paraphée).\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  acte_caution: { l:'Acte de cautionnement', g:'entree', ic:'🤝', envoi:'main', d:'L\'engagement écrit de la personne qui se porte garante.',
    show:x=>x.garants.some(g=>g.type==='personne'),
    f:(x)=>[ {n:'garant', l:'Caution', t:'select', o:x.garants.map((g,i)=>[i, nomPersonne(g)||'Garant '+(i+1)]).filter((_,i)=>x.garants[i].type==='personne')},
      {n:'solidaire', l:'Caution solidaire (recommandé : vous pouvez réclamer directement à la caution)', t:'check', v:true},
      {n:'plafond', l:'Montant maximal garanti (€)', t:'number', v:r2(totalMensuel(x.bail)*36), h:'Usuellement 3 ans de loyers et charges. Ce montant doit figurer dans l\'acte.', req:true, col:2},
      {n:'duree', l:'Durée', t:'select', v:'determinee', o:[['determinee','Durée déterminée'],['indeterminee','Durée indéterminée (résiliable par la caution)']], col:2},
      {n:'dateFin', l:'Fin de l\'engagement (si durée déterminée)', t:'date', v:addMonths(x.bail.dateDebut||todayISO(), 36+ (x.bail.type==='vide'?36:0)), h:'Couvrir au moins le bail initial et un renouvellement.'} ],
    gen:genCaution,
    mail:x=>({o:'Acte de cautionnement — location '+adresseBien(x.bien,true), c:`Bonjour,\n\nVous avez accepté de vous porter caution pour ${nomsLocataires(x.bail)}. Vous trouverez ci-joint l'acte de cautionnement ainsi que le contrat de location.\n\nMerci de compléter la mention indiquée, de signer et de me retourner un exemplaire.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  remise_annexes: { l:'Récépissé de remise des annexes', g:'entree', ic:'🗂️', envoi:'main', d:'Preuve que le locataire a reçu diagnostics, notice et clés.',
    f:(x)=>[ {n:'date', l:'Date', t:'date', v:x.bail.dateDebut||todayISO(), col:2}, {n:'cles', l:'Clés remises', t:'text', v:'2 clés de la porte d\'entrée, 1 badge, 1 clé de boîte aux lettres', col:2},
      {n:'items', l:'Documents remis (un par ligne)', t:'textarea', rows:7, v:['Contrat de location','Notice d\'information (arrêté du 29 mai 2015)','Diagnostic de performance énergétique (DPE)','État des risques et pollutions (ERP)','Constat de risque d\'exposition au plomb (si avant 1949)','États des installations électricité / gaz (si plus de 15 ans)','État des lieux d\'entrée'+(estMeuble(x.bail)?' et inventaire':''),(x.bien.regime==='copro'?'Extraits du règlement de copropriété':'')].filter(Boolean).join('\n')} ],
    gen:genRemiseAnnexes },
  lettre_bienvenue: { l:'Lettre d\'accueil du locataire', g:'entree', ic:'👋', envoi:'mail', d:'Informations pratiques : paiement, contacts, assurance, compteurs, urgences.',
    f:(x)=>[ {n:'urgences', l:'Contacts utiles (syndic, plombier, gardien…)', t:'textarea', v:x.bien.contacts||''}, {n:'infos', l:'Informations pratiques (poubelles, chauffage, parking…)', t:'textarea', v:''} ],
    gen:(x,d)=>lettre(x,{envoi:'simple', objet:'Bienvenue dans votre logement', corps:`<p>Je vous souhaite la bienvenue dans votre nouveau logement. Voici quelques informations utiles :</p>
      <ul><li><b>Loyer :</b> ${eur(totalMensuel(x.bail))} par mois, à régler le ${esc(x.bail.jourPaiement||1)} de chaque mois par ${esc(x.bail.modePaiement||'virement')}${x.bail.iban?' (IBAN '+esc(x.bail.iban)+')':''}. Une quittance vous est remise gratuitement sur simple demande.</li>
      <li><b>Assurance habitation :</b> merci de me transmettre votre attestation dès maintenant, puis chaque année à son renouvellement.</li>
      <li><b>Compteurs :</b> pensez à ouvrir vos contrats d'électricité${x.bien.chauffage!=='collectif'?' et de gaz':''} à votre nom avec les relevés de l'état des lieux.</li>
      <li><b>Aide au logement :</b> vous pouvez faire une demande auprès de la CAF ou de la MSA ; je compléterai l'attestation de loyer.</li>
      <li><b>Réparations :</b> signalez-moi rapidement toute fuite ou panne ; l'entretien courant et les menues réparations restent à votre charge (décret n° 87-712).</li>
      ${d.urgences?'<li><b>Contacts utiles :</b> '+esc(d.urgences).replace(/\n/g,'<br>')+'</li>':''}${d.infos?'<li><b>Informations pratiques :</b> '+esc(d.infos).replace(/\n/g,'<br>')+'</li>':''}</ul>
      <p>Je reste à votre disposition pour toute question.</p>`, politesse:'Bien cordialement.'}),
    mail:x=>({o:'Bienvenue dans votre logement', c:`Bonjour,\n\nBienvenue dans votre nouveau logement ! Vous trouverez ci-joint un récapitulatif des informations pratiques (paiement du loyer, assurance, compteurs, contacts).\n\nN'hésitez pas à me contacter pour toute question.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },

  /* ---------------- Chaque mois ---------------- */
  avis_echeance: { l:'Avis d\'échéance', g:'mois', ic:'📅', envoi:'mail', d:'Le montant à payer pour le mois, avant le paiement.',
    f:(x,p)=>[ {n:'mois', l:'Mois', t:'select', v:p.mois||monthKey(addMonths(todayISO(),1)), o:moisOptions(x.bail)} ],
    gen:(x,d)=>{ const l=etatMois(x.bail,d.mois)||echeancesBail(x.bail, monthLast(d.mois)).find(e=>e.key===d.mois)||{}; const c=compteLocatif(x.bail, addDays(l.due||monthFirst(d.mois),-1)); const solde=c.solde;
      return lettre(x,{envoi:'simple', politesseDebut:false, objet:'Avis d\'échéance — '+monthLabel(d.mois), corps:`${tableau([['Loyer hors charges', eur(l.loyerHC)],[(x.bail.chargesType==='forfait'?'Forfait de charges':'Provision pour charges'), eur(l.charges)]].concat(Math.abs(solde)>0.01?[[solde>0?'Solde antérieur restant dû':'Avance / crédit en votre faveur', eur(solde)]]:[]), ['Total à payer avant le '+fdate(l.due), eur(r2(num(l.montant)+(solde||0)))])}
        <p>Règlement par ${esc(x.bail.modePaiement||'virement')}${x.bail.iban?' — IBAN : '+esc(x.bail.iban):''}.</p>`, legal:'Cet avis n\'est pas une quittance. La quittance est délivrée gratuitement après paiement intégral.', politesse:'Avec mes salutations.'}); },
    mail:(x,d)=>({o:'Loyer de '+monthLabel(d.mois), c:`Bonjour,\n\nVoici l'avis d'échéance pour le loyer de ${monthLabel(d.mois)} : ${eur(totalMensuel(x.bail))}, à régler le ${x.bail.jourPaiement||1}.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  quittance: { l:'Quittance de loyer', g:'mois', ic:'🧾', envoi:'mail', d:'Après paiement complet. Reçu automatique si le paiement est partiel.',
    f:(x,p)=>[ {n:'mois', l:'Mois', t:'select', v:p.mois||monthKey(todayISO()), o:moisOptions(x.bail)},
      {n:'apl', l:'Part payée par la CAF/MSA directement à vous (€)', t:'number', v:x.bail.aplTiersPayant?num(x.bail.aplMontant):'', h:'Laisser vide si l\'aide est versée au locataire.'},
      {n:'info', t:'info', l:'La quittance est établie à partir des paiements enregistrés dans « Loyers ». Si le mois n\'est pas entièrement payé, l\'appli produit un reçu de paiement partiel (une quittance ne doit jamais être remise pour un paiement incomplet).'} ],
    gen:genQuittance,
    mail:(x,d)=>({o:'Quittance de loyer — '+monthLabel(d.mois), c:`Bonjour,\n\nVous trouverez ci-joint votre quittance de loyer pour ${monthLabel(d.mois)}.\n\nMerci pour votre règlement.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },

  /* ---------------- Chaque année ---------------- */
  revision_irl: { l:'Révision annuelle du loyer (IRL)', g:'an', ic:'📈', envoi:'lrar', d:'Calcul automatique avec le dernier indice INSEE.',
    f:(x)=>{ const rv=revisionInfo(x.bail); if(!rv.possible) return [{n:'info', t:'info', cls:'warn', l:rv.raison}];
      return [ {n:'info', t:'info', l:`IRL de référence : ${trimestreLabel(rv.ref)} = ${rv.vRef||'?'} — nouvel IRL : ${trimestreLabel(rv.prochainTrim)} = ${rv.vNew||'pas encore publié'}.<br>Loyer actuel ${eur(rv.actuel)} × ${rv.vNew||'?'} / ${rv.vRef||'?'} = <b>${rv.nouveau?eur(rv.nouveau):'—'}</b>${rv.hausse?' (+'+eur(rv.hausse)+')':''}.${rv.enRetard?'<br>La date anniversaire est passée : la révision ne s\'applique qu\'à partir de votre demande, sans rattrapage, et doit être demandée avant le '+fdate(rv.limite)+'.':''}`},
        {n:'nouveau', l:'Nouveau loyer hors charges (€)', t:'number', v:rv.nouveau||'', req:true, col:2, h:'Vous pouvez appliquer moins que le maximum.'},
        {n:'effet', l:'Applicable à partir du', t:'date', v:rv.enRetard? monthFirst(nextMonthKey(monthKey(todayISO()))) : rv.anniversaire, col:2},
        {n:'appliquer', l:'Mettre à jour le loyer dans l\'appli à cette date', t:'check', v:true}, envoiField('lrar',['lrar','simple','main','mail']) ]; },
    gen:(x,d)=>{ const rv=revisionInfo(x.bail); return lettre(x,{envoi:d.envoi, objet:'Révision annuelle du loyer', corps:`<p>Conformément à l'article 17-1 de la loi du 6 juillet 1989 et à la clause de révision de votre bail, le loyer est révisé en fonction de la variation de l'indice de référence des loyers (IRL) publié par l'INSEE.</p>
      ${tableau([['Loyer actuel hors charges', eur(rv.actuel)],['IRL de référence — '+trimestreLabel(rv.ref), String(rv.vRef).replace('.',',')],['Nouvel IRL — '+trimestreLabel(rv.prochainTrim), String(rv.vNew).replace('.',',')],['Calcul', eur(rv.actuel)+' × '+String(rv.vNew).replace('.',',')+' / '+String(rv.vRef).replace('.',',')]], ['Nouveau loyer hors charges à compter du '+fdate(d.effet), eur(d.nouveau)])}
      <p>Les charges restent inchangées (${eur(loyerA(x.bail,todayISO()).charges)}). À compter du ${fdate(d.effet)}, le montant mensuel total sera donc de <b>${eur(num(d.nouveau)+loyerA(x.bail,todayISO()).charges)}</b>.${x.bail.modePaiement&&/virement/i.test(x.bail.modePaiement)?' Je vous remercie de bien vouloir modifier votre virement permanent.':''}</p>`}); },
    after:(x,d)=>{ if(d.appliquer && num(d.nouveau)>0){ const rv=revisionInfo(x.bail); x.bail.historiqueLoyer=x.bail.historiqueLoyer||[]; x.bail.historiqueLoyer.push({du:d.effet, loyerHC:num(d.nouveau), charges:loyerA(x.bail,d.effet).charges, motif:'Révision IRL', irlTrim:rv.prochainTrim}); upsert('baux', x.bail); } },
    mail:(x,d)=>({o:'Révision annuelle de votre loyer', c:`Bonjour,\n\nComme prévu par votre bail, le loyer est révisé chaque année selon l'indice INSEE (IRL). À compter du ${fdate(d.effet)}, le loyer hors charges passe à ${eur(d.nouveau)}. Le détail du calcul figure dans le courrier joint.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  regularisation_charges: { l:'Régularisation annuelle des charges', g:'an', ic:'⚖️', envoi:'simple', d:'Provisions versées contre charges réelles récupérables.',
    show:x=>x.bail.chargesType==='provision',
    f:(x,p)=>{ const an=p.annee||String(parseISO(todayISO()).getFullYear()-1); const rc=regularisationCalc(x.bail, an);
      return [ {n:'annee', l:'Année', t:'select', v:an, o:[0,1,2,3].map(i=>{const y=String(parseISO(todayISO()).getFullYear()-i); return [y,y];})},
        {n:'info', t:'info', l:`Provisions appelées en ${an} : <b>${eur(rc.provisions)}</b>. Charges récupérables enregistrées pour ce bien (au prorata de l'occupation, ${rc.jours} jours) : <b>${eur(rc.reelles)}</b>.<br>${rc.detail.length?'Détail : '+rc.detail.map(d=>esc(d.libelle)+' '+eur(d.part)).join(' ; '):'⚠️ Aucune dépense récupérable enregistrée : ajoutez d\'abord les charges (eau, entretien, TEOM, part récupérable de copropriété…) dans l\'onglet « Dépenses » du bien.'}`},
        {n:'reelles', l:'Charges récupérables réelles (€)', t:'number', v:rc.reelles, col:2, h:'Modifiable si besoin.'},
        {n:'provisions', l:'Provisions versées (€)', t:'number', v:rc.provisions, col:2},
        {n:'nouvelleProv', l:'Nouvelle provision mensuelle proposée (€)', t:'number', v:rc.nouvelleProvision||'', col:2},
        {n:'inscrire', l:'Inscrire le solde au compte du locataire (à payer ou à rembourser)', t:'check', v:true}, envoiField('simple') ]; },
    gen:(x,d)=>{ const rc=regularisationCalc(x.bail, d.annee); const solde=r2(num(d.reelles)-num(d.provisions));
      return lettre(x,{envoi:d.envoi, objet:'Régularisation des charges locatives de l\'année '+d.annee, corps:`<p>Conformément à l'article 23 de la loi du 6 juillet 1989, je vous adresse le décompte des charges récupérables de l'année ${d.annee}${rc.prorata<0.999?', calculé au prorata de votre période d\'occupation ('+rc.jours+' jours)':''}.</p>
        ${tableau(rc.detail.map(l=>[esc(l.libelle), eur(l.part)]).concat([['<b>Total des charges récupérables</b>', eur(d.reelles)],['Provisions versées', '− '+eur(d.provisions)]]), [solde>=0?'Solde restant à votre charge':'Trop-perçu qui vous sera remboursé', eur(Math.abs(solde))])}
        <p>${solde>=0?`Je vous remercie de bien vouloir régler la somme de ${eur(solde)} avec votre prochain loyer. Si ce montant vous pose difficulté, nous pouvons convenir d'un étalement.`:`Cette somme de ${eur(-solde)} sera déduite de votre prochain loyer (ou remboursée à votre demande).`}</p>
        ${num(d.nouvelleProv)?`<p>Pour tenir compte des dépenses réelles, la provision mensuelle sera de ${eur(d.nouvelleProv)} à compter de la prochaine échéance.</p>`:''}
        <p>Les pièces justificatives (factures, décompte de copropriété, avis de taxe foncière pour la TEOM, contrats d'entretien) sont tenues à votre disposition pendant six mois.</p>`}); },
    after:(x,d)=>{ const solde=r2(num(d.reelles)-num(d.provisions)); if(d.inscrire && Math.abs(solde)>=0.01){ x.bail.extras=x.bail.extras||[]; x.bail.extras.push({id:uid('ex'), date:todayISO(), libelle:'Régularisation des charges '+d.annee, montant:solde}); }
      if(num(d.nouvelleProv)>0){ const eff=monthFirst(nextMonthKey(monthKey(todayISO()))); x.bail.historiqueLoyer=x.bail.historiqueLoyer||[]; x.bail.historiqueLoyer.push({du:eff, loyerHC:loyerA(x.bail,eff).loyerHC, charges:num(d.nouvelleProv), motif:'Nouvelle provision de charges'}); }
      upsert('baux', x.bail); },
    mail:(x,d)=>({o:'Régularisation des charges '+d.annee, c:`Bonjour,\n\nVous trouverez ci-joint le décompte annuel des charges ${d.annee}. Les justificatifs sont à votre disposition sur simple demande.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  demande_assurance: { l:'Demande d\'attestation d\'assurance', g:'an', ic:'🛡️', envoi:'simple', d:'Rappel annuel de l\'obligation d\'assurance du locataire.',
    f:()=>[envoiField('simple')],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Attestation d\'assurance habitation', corps:`<p>L'article 7 g) de la loi du 6 juillet 1989 et votre bail vous obligent à vous assurer contre les risques locatifs (incendie, dégât des eaux, explosion) et à en justifier chaque année.</p><p>Je vous remercie de me faire parvenir, dans les meilleurs délais, l'attestation d'assurance en cours de validité pour le logement.</p>`}),
    mail:x=>({o:'Attestation d\'assurance habitation', c:`Bonjour,\n\nPourriez-vous m'envoyer votre attestation d'assurance habitation en cours de validité pour le logement ${adresseBien(x.bien,true)} ? C'est une obligation annuelle prévue par le bail.\n\nMerci d'avance,\n${nomBailleur(x.bl)}`}) },

  /* ---------------- Problèmes et litiges ---------------- */
  relance: { l:'Relance de loyer impayé', g:'incident', ic:'⏰', envoi:'simple', d:'Rappel amiable puis relance ferme.',
    f:(x,p)=>{ const c=compteLocatif(x.bail); const imp=moisImpayes(x.bail);
      return [ {n:'niveau', l:'Niveau', t:'radio', v:String(p.niveau||1), o:[['1','Rappel amiable'],['2','Relance ferme']]},
        {n:'montant', l:'Montant dû (€)', t:'number', v:c.solde>0?c.solde:'', req:true, col:2},
        {n:'periode', l:'Période(s) concernée(s)', t:'text', v:imp.map(l=>monthLabel(l.key)).join(', '), col:2}, envoiField(p.niveau>1?'lrar':'simple') ]; },
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:d.niveau==='2'?'Relance — loyer impayé':'Rappel — loyer non reçu', corps: d.niveau==='2'
      ? `<p>Malgré mon précédent rappel, je constate que la somme de <b>${eur(d.montant)}</b>, due au titre du loyer et des charges (${esc(d.periode)}), reste impayée à ce jour.</p><p>Je vous demande de régulariser cette situation sous 8 jours. Si vous rencontrez des difficultés, contactez-moi sans attendre : un échéancier peut être envisagé. Vous pouvez également solliciter le Fonds de solidarité pour le logement (FSL) de votre département, la CAF/MSA ou l'ADIL.</p><p>À défaut de règlement ou de proposition, je serai contraint(e) d'engager la procédure prévue par le bail, ce qui entraînerait des frais à votre charge.</p>`
      : `<p>Sauf erreur ou omission de ma part, je n'ai pas reçu le règlement de <b>${eur(d.montant)}</b> correspondant au loyer et aux charges (${esc(d.periode)}).</p><p>Il s'agit peut-être d'un simple oubli : je vous remercie de bien vouloir effectuer ce paiement dès que possible. Si vous rencontrez une difficulté passagère, n'hésitez pas à m'en parler afin que nous trouvions ensemble une solution.</p><p>Si votre règlement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.</p>`}),
    mail:(x,d)=>({o:d.niveau==='2'?'Relance : loyer impayé':'Petit rappel : loyer de '+(d.periode||'ce mois'), c:d.niveau==='2'?`Bonjour,\n\nMalgré mon précédent message, le montant de ${eur(d.montant)} (${d.periode}) n'est toujours pas réglé. Merci de régulariser sous 8 jours ou de me contacter rapidement pour convenir d'un échéancier.\n\nCordialement,\n${nomBailleur(x.bl)}`:`Bonjour,\n\nSauf erreur de ma part, je n'ai pas encore reçu le loyer (${d.periode}, ${eur(d.montant)}). Il s'agit sans doute d'un oubli : pouvez-vous vérifier ? Si vous avez une difficulté, parlons-en.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  mise_en_demeure: { l:'Mise en demeure de payer', g:'incident', ic:'⚠️', envoi:'lrar', d:'Dernière étape amiable avant le commissaire de justice.',
    f:(x)=>{ const c=compteLocatif(x.bail); const imp=moisImpayes(x.bail);
      return [ {n:'montant', l:'Montant dû (€)', t:'number', v:c.solde>0?c.solde:'', req:true, col:2}, {n:'periode', l:'Période(s)', t:'text', v:imp.map(l=>monthLabel(l.key)).join(', '), col:2},
        {n:'delai', l:'Délai laissé (jours)', t:'number', v:8, col:2}, envoiField('lrar',['lrar','main']) ]; },
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Mise en demeure de payer', corps:`<p>Malgré mes relances, la somme de <b>${eur(d.montant)}</b>, correspondant aux loyers et charges impayés (${esc(d.periode)}), demeure due à ce jour.</p>
      <p><b>Par la présente, je vous mets en demeure de me régler cette somme dans un délai de ${esc(d.delai||8)} jours</b> à compter de la réception de ce courrier.</p>
      <p>À défaut, je mandaterai un commissaire de justice pour vous délivrer un commandement de payer visant la clause résolutoire du bail. Si les sommes ne sont pas réglées dans les ${R('commandementDelai')} semaines suivant ce commandement, le bail pourra être résilié et votre expulsion demandée au juge des contentieux de la protection. ${(x.garants||[]).some(g=>g.type==='personne')?'La caution sera également informée et appelée en paiement.':''}</p>
      <p>Je reste disposé(e) à examiner une proposition d'échéancier écrite. Vous pouvez aussi vous rapprocher du Fonds de solidarité pour le logement (FSL), de votre CAF/MSA ou de l'ADIL pour être accompagné(e).</p>`}),
    mail:x=>({o:'Mise en demeure — loyers impayés', c:`Bonjour,\n\nJe vous adresse ce jour par lettre recommandée une mise en demeure concernant les loyers impayés. Une copie est jointe à ce message.\n\nJe reste ouvert(e) à une proposition d'échéancier écrite.\n\n${nomBailleur(x.bl)}`}) },
  info_caution: { l:'Information de la caution', g:'incident', ic:'📨', envoi:'lrar', d:'Prévenir la caution d\'un impayé et l\'appeler en paiement.',
    show:x=>x.garants.some(g=>g.type==='personne'),
    f:(x)=>{ const c=compteLocatif(x.bail); return [ {n:'garant', l:'Caution', t:'select', o:x.garants.map((g,i)=>[i, nomPersonne(g)]).filter((_,i)=>x.garants[i].type==='personne')},
      {n:'montant', l:'Montant dû (€)', t:'number', v:c.solde>0?c.solde:'', col:2}, {n:'appel', l:'Objet', t:'select', v:'info', o:[['info','Information du premier incident'],['appel','Appel en paiement de la caution']], col:2}, envoiField('lrar') ]; },
    gen:(x,d)=>{ const g=x.garants[num(d.garant)]||{}; return lettre(x,{envoi:d.envoi, dest:{nom:nomPersonne(g), adresse:esc(g.adresse||'')}, objet: d.appel==='appel'?'Appel en paiement de la caution':'Information de la caution — incident de paiement',
      corps:`<p>Vous vous êtes porté(e) caution${g.solidaire!==false?' solidaire':''} des engagements de ${esc(nomsLocataires(x.bail))}, locataire du logement situé ${esc(adresseBien(x.bien))}.</p>
      <p>Je vous informe qu'à ce jour, la somme de <b>${eur(d.montant)}</b> reste impayée au titre des loyers et charges.</p>
      ${d.appel==='appel'?`<p>En application de votre engagement, je vous demande de bien vouloir me régler cette somme dans un délai de 15 jours.</p>`:`<p>Je vous adresse cette information afin que vous puissiez, le cas échéant, intervenir auprès du locataire. À défaut de régularisation, je serai amené(e) à faire appel à votre garantie.</p>`}`}); },
    mail:(x,d)=>({o:'Information caution — '+adresseBien(x.bien,true), c:`Bonjour,\n\nEn tant que caution de ${nomsLocataires(x.bail)}, je vous informe d'un impayé de ${eur(d.montant)}. Le courrier joint détaille la situation.\n\nCordialement,\n${nomBailleur(x.bl)}`}) },
  echeancier: { l:'Plan d\'apurement (échéancier amiable)', g:'incident', ic:'🗓️', envoi:'main', d:'Accord écrit pour rembourser la dette en plusieurs fois.',
    f:(x)=>{ const c=compteLocatif(x.bail); return [ {n:'montant', l:'Dette totale (€)', t:'number', v:c.solde>0?c.solde:'', req:true, col:3}, {n:'nb', l:'Nombre de mensualités', t:'number', v:6, col:3}, {n:'debut', l:'Première mensualité le', t:'date', v:monthFirst(nextMonthKey(monthKey(todayISO()))), col:3} ]; },
    gen:(x,d)=>{ const n=Math.max(1,num(d.nb)); const m=r2(num(d.montant)/n); const rows=[]; for(let i=0;i<n;i++) rows.push([fdate(addMonths(d.debut,i)), eur(i===n-1? r2(num(d.montant)-m*(n-1)) : m)]);
      return `<div class="docsheet"><h1>Protocole d'accord — plan d'apurement de la dette locative</h1>
      <p>Entre ${esc(nomBailleur(x.bl))}, bailleur, et ${esc(nomsLocataires(x.bail))}, locataire du logement situé ${esc(adresseBien(x.bien))}.</p>
      <p>Les parties constatent qu'à la date du ${fdate(todayISO())}, le locataire reste devoir la somme de <b>${eur(d.montant)}</b> au titre des loyers et charges.</p>
      <p>Le locataire s'engage à régler cette dette <b>en plus du loyer courant</b>, selon l'échéancier suivant :</p>${tableau(rows,['Total', eur(d.montant)])}
      <p>En cas de non-respect d'une seule échéance ou de non-paiement du loyer courant, et quinze jours après une mise en demeure restée sans effet, la totalité du solde deviendra immédiatement exigible et le bailleur pourra reprendre la procédure de recouvrement.</p>
      ${sigrow('Le bailleur','Le(s) locataire(s)')}</div>`; } },
  signalement_caf: { l:'Signalement d\'impayé à la CAF/MSA', g:'incident', ic:'🏛️', envoi:'lrar', d:'Obligatoire si l\'aide au logement vous est versée directement.',
    f:(x)=>{ const c=compteLocatif(x.bail); return [ {n:'organisme', l:'Organisme', t:'select', v:'CAF', o:[['CAF','CAF'],['MSA','MSA']], col:2}, {n:'allocataire', l:'N° d\'allocataire du locataire', t:'text', v:x.bail.numAllocataire||'', col:2}, {n:'montant', l:'Dette (€)', t:'number', v:c.solde>0?c.solde:'', col:2}, {n:'nbMois', l:'Nombre d\'échéances impayées', t:'number', v:moisImpayes(x.bail).length, col:2}, {n:'adresseOrg', l:'Adresse de l\'organisme', t:'textarea', v:''}, envoiField('lrar') ]; },
    gen:(x,d)=>lettre(x,{envoi:d.envoi, dest:{nom:d.organisme+' — service des aides au logement', adresse:esc(d.adresseOrg||'').replace(/\n/g,'<br>')}, objet:'Signalement d\'un impayé de loyer — allocataire n° '+esc(d.allocataire||'…'),
      corps:`<p>Je perçois directement l'aide au logement de ${esc(nomsLocataires(x.bail))} (allocataire n° ${esc(d.allocataire||'…')}) pour le logement situé ${esc(adresseBien(x.bien))}.</p><p>Je vous signale un impayé de loyer : <b>${eur(d.montant)}</b>, correspondant à ${esc(d.nbMois)} échéance(s) non réglée(s) (part restant à la charge du locataire).</p><p>Le décompte de la dette est joint. Je reste à votre disposition pour la mise en place d'un plan d'apurement.</p>`, pj:['Décompte de la dette (relevé du compte locatif)']}) },
  mandat_commissaire: { l:'Saisine d\'un commissaire de justice', g:'incident', ic:'🏛️', envoi:'simple', d:'Demander la délivrance d\'un commandement de payer.',
    f:(x)=>{ const c=compteLocatif(x.bail); return [ {n:'cj', l:'Nom et adresse de l\'étude', t:'textarea', v:''}, {n:'montant', l:'Dette (€)', t:'number', v:c.solde>0?c.solde:''}, {n:'info', t:'info', l:'Le commandement de payer doit être délivré par un commissaire de justice (ex-huissier). Frais à avancer, récupérables sur le locataire. Il doit être dénoncé à la caution dans les 15 jours.'} ]; },
    gen:(x,d)=>lettre(x,{envoi:'simple', dest:{nom:'Maître', adresse:esc(d.cj||'').replace(/\n/g,'<br>')}, civ:'Maître,', politesse:'Je vous prie d\'agréer, Maître, l\'expression de mes salutations distinguées.', objet:'Demande de délivrance d\'un commandement de payer visant la clause résolutoire',
      corps:`<p>Je vous remercie de bien vouloir délivrer un commandement de payer visant la clause résolutoire à ${esc(nomsLocataires(x.bail))}, locataire du logement situé ${esc(adresseBien(x.bien))}, pour une dette locative de <b>${eur(d.montant)}</b> arrêtée au ${fdate(todayISO())}.</p>${(x.garants||[]).some(g=>g.type==='personne')?`<p>Je vous remercie de le dénoncer à la caution : ${x.garants.filter(g=>g.type==='personne').map(g=>esc(nomPersonne(g)+', '+(g.adresse||''))).join(' ; ')}.</p>`:''}`, pj:['Copie du bail et de ses avenants','Décompte détaillé de la dette','Copies des relances et de la mise en demeure','Acte de cautionnement le cas échéant']}) },
  troubles_voisinage: { l:'Mise en demeure — troubles de voisinage', g:'incident', ic:'🔊', envoi:'lrar', d:'Bruit, nuisances, plaintes de voisins.',
    f:()=>[ {n:'faits', l:'Faits constatés (dates, nature)', t:'textarea', req:true, rows:4}, envoiField('lrar') ],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Troubles de voisinage — mise en demeure', corps:`<p>Mon attention a été attirée sur les faits suivants : ${esc(d.faits)}.</p><p>Je vous rappelle que l'article 7 b) de la loi du 6 juillet 1989 vous oblige à user paisiblement du logement. Le bailleur est lui-même tenu de faire cesser les troubles causés aux voisins par ses locataires.</p><p>Je vous mets en demeure de faire cesser ces troubles immédiatement. À défaut, je pourrai demander au juge la résiliation du bail.</p>`}) },
  manquement: { l:'Mise en demeure — manquement au bail', g:'incident', ic:'📋', envoi:'lrar', d:'Défaut d\'entretien, sous-location, travaux non autorisés, usage non conforme…',
    f:()=>[ {n:'motif', l:'Manquement', t:'select', o:[['entretien','Défaut d\'entretien du logement'],['souslocation','Sous-location sans accord écrit (y compris location touristique)'],['travaux','Transformation des lieux sans accord écrit'],['usage','Usage non conforme à la destination (activité commerciale…)'],['acces','Refus d\'accès pour travaux urgents ou nécessaires'],['autre','Autre']]},
      {n:'faits', l:'Faits constatés', t:'textarea', req:true}, envoiField('lrar') ],
    gen:(x,d)=>{ const t={entretien:'l\'article 7 c) et d) de la loi du 6 juillet 1989 (entretien courant et menues réparations, décret n° 87-712)', souslocation:'l\'article 8 de la loi du 6 juillet 1989 qui interdit toute sous-location sans l\'accord écrit du bailleur, y compris sur le prix', travaux:'l\'article 7 f) de la loi du 6 juillet 1989 (pas de transformation sans accord écrit ; remise en état possible à vos frais)', usage:'l\'article 7 b) de la loi du 6 juillet 1989 (usage paisible suivant la destination prévue au bail)', acces:'l\'article 7 e) de la loi du 6 juillet 1989 (obligation de laisser exécuter les travaux nécessaires)', autre:'les obligations prévues à votre bail'}[d.motif];
      return lettre(x,{envoi:d.envoi, objet:'Mise en demeure de respecter vos obligations locatives', corps:`<p>J'ai constaté les faits suivants : ${esc(d.faits)}.</p><p>Ces faits contreviennent à ${t}.</p><p>Je vous mets en demeure d'y remédier dans un délai de 15 jours à compter de la réception de ce courrier. À défaut, je me réserve la possibilité de saisir le juge des contentieux de la protection.</p>`}); } },
  avis_travaux: { l:'Information de travaux dans le logement', g:'incident', ic:'🛠️', envoi:'lrar', d:'Prévenir le locataire avant des travaux (nature, dates, accès).',
    f:()=>[ {n:'nature', l:'Nature des travaux', t:'textarea', req:true}, {n:'debut', l:'Début', t:'date', col:3}, {n:'duree', l:'Durée estimée (jours)', t:'number', col:3}, {n:'acces', l:'Horaires d\'accès', t:'text', v:'du lundi au vendredi, 9 h – 17 h', col:3}, envoiField('lrar',['lrar','main','simple','mail']) ],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Information préalable — travaux dans votre logement', corps:`<p>Conformément à l'article 7 e) de la loi du 6 juillet 1989, je vous informe que des travaux seront réalisés dans le logement : ${esc(d.nature)}.</p><p>Ils débuteront le ${fdate(d.debut)} pour une durée estimée de ${esc(d.duree||'—')} jour(s). L'accès au logement sera nécessaire ${esc(d.acces)} ; aucun travail ne sera réalisé les samedis, dimanches et jours fériés sans votre accord.</p>${num(d.duree)>21?'<p>Ces travaux durant plus de 21 jours, le loyer sera diminué à proportion du temps et de la partie du logement dont vous serez privé(e).</p>':''}`}) },
  visites: { l:'Organisation de visites (vente / relocation)', g:'incident', ic:'🚪', envoi:'simple', d:'Visites limitées à 2 heures par jour ouvrable.',
    f:()=>[ {n:'motif', l:'Motif', t:'select', o:[['relocation','Relocation (pendant le préavis)'],['vente','Vente du logement']]}, {n:'creneaux', l:'Créneaux proposés', t:'textarea', v:'Du lundi au vendredi, de 17 h à 19 h'}, envoiField('simple') ],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Organisation des visites du logement', corps:`<p>${d.motif==='vente'?'Je vous informe de mon projet de vendre le logement que vous occupez.':'Suite à votre congé, je dois organiser la recherche d\'un nouveau locataire.'} Votre bail prévoit que vous laissiez visiter le logement, dans la limite de deux heures par jour ouvrable (hors dimanches et jours fériés).</p><p>Je vous propose les créneaux suivants : ${esc(d.creneaux).replace(/\n/g,'<br>')}. Je vous préviendrai à l'avance de chaque visite et reste ouvert(e) à vos propositions.</p>`}) },
  reponse_travaux: { l:'Réponse à une demande de réparation du locataire', g:'incident', ic:'🔧', envoi:'simple', d:'Accord, intervention planifiée, ou réparation locative à sa charge.',
    f:()=>[ {n:'demande', l:'Demande reçue (objet, date)', t:'text', req:true}, {n:'reponse', l:'Réponse', t:'select', o:[['accord','J\'interviens (réparation à ma charge)'],['locative','Réparation locative à la charge du locataire'],['visite','Je dois d\'abord constater sur place']]}, {n:'detail', l:'Précisions (date d\'intervention, artisan…)', t:'textarea'}, envoiField('simple') ],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, objet:'Votre demande : '+esc(d.demande), corps:{accord:`<p>J'ai bien reçu votre demande concernant : ${esc(d.demande)}. Cette réparation m'incombe : ${esc(d.detail||'je vous recontacte très vite pour fixer l\'intervention')}.</p>`, locative:`<p>J'ai bien reçu votre demande concernant : ${esc(d.demande)}. Il s'agit d'une réparation locative ou d'un entretien courant à la charge du locataire, selon la liste du décret n° 87-712 du 26 août 1987. ${esc(d.detail||'')}</p><p>Je reste disponible pour vous indiquer un artisan si besoin.</p>`, visite:`<p>J'ai bien reçu votre demande concernant : ${esc(d.demande)}. Afin de déterminer les travaux nécessaires, je vous propose de passer constater sur place : ${esc(d.detail||'merci de m\'indiquer vos disponibilités')}.</p>`}[d.reponse]}) },
  avenant: { l:'Avenant au bail', g:'incident', ic:'✍️', envoi:'main', d:'Modifier le bail d\'un commun accord (colocataire, charges, durée mobilité…).',
    f:()=>[ {n:'objet', l:'Objet de l\'avenant', t:'text', req:true, ph:'Ex. : départ d\'un colocataire et entrée de …'}, {n:'texte', l:'Clauses modifiées', t:'textarea', rows:6, req:true}, {n:'effet', l:'Date d\'effet', t:'date', v:todayISO()} ],
    gen:(x,d)=>`<div class="docsheet bail"><h1 class="center">Avenant au contrat de location</h1>
      <p>Entre ${esc(nomBailleur(x.bl))}, bailleur, et ${esc(nomsLocataires(x.bail))}, locataire(s), concernant le bail du logement situé ${esc(adresseBien(x.bien))}, prenant effet le ${fdate(x.bail.dateDebut)}.</p>
      <h2>Objet</h2><p>${esc(d.objet)}</p><h2>Modifications</h2><p>${esc(d.texte).replace(/\n/g,'<br>')}</p>
      <p>Date d'effet : ${fdate(d.effet)}. Toutes les autres clauses du bail demeurent inchangées.</p>
      <p>Fait à ${esc(villeSignature(x))}, le ${fdate(todayISO())}, en autant d'exemplaires que de parties.</p>${sigrow('Le bailleur','Le(s) locataire(s)')}</div>` },
  saisine_cdc: { l:'Saisine de la commission de conciliation', g:'incident', ic:'🤝', envoi:'lrar', d:'Litige (dépôt, charges, réparations, loyer) : démarche gratuite avant le juge.',
    f:()=>[ {n:'objet', l:'Objet du litige', t:'select', o:[['depot','Dépôt de garantie'],['charges','Charges locatives'],['edl','État des lieux'],['reparations','Réparations'],['loyer','Loyer (révision, réévaluation, complément)'],['decence','Décence du logement'],['conge','Congé'],['autre','Autre']]}, {n:'expose', l:'Exposé du litige', t:'textarea', rows:6, req:true}, {n:'adresseCdc', l:'Adresse de la commission (préfecture / DDETS)', t:'textarea'}, envoiField('lrar') ],
    gen:(x,d)=>lettre(x,{envoi:d.envoi, dest:{nom:'Commission départementale de conciliation', adresse:esc(d.adresseCdc||'').replace(/\n/g,'<br>')}, objet:'Saisine de la commission départementale de conciliation',
      corps:`<p>Je souhaite saisir la commission départementale de conciliation d'un litige m'opposant à ${esc(nomsLocataires(x.bail))}, locataire du logement situé ${esc(adresseBien(x.bien))}, concernant : <b>${esc({depot:'le dépôt de garantie',charges:'les charges locatives',edl:'l\'état des lieux',reparations:'des réparations',loyer:'le loyer',decence:'la décence du logement',conge:'un congé',autre:'un autre point'}[d.objet])}</b>.</p><p>${esc(d.expose).replace(/\n/g,'<br>')}</p><p>Coordonnées de l'autre partie : ${esc(nomsLocataires(x.bail))}, ${esc(x.bail.fin&&x.bail.fin.adresseNouvelle||adresseBien(x.bien))}.</p>`, pj:['Copie du bail','Pièces justificatives du litige']}) },

  /* ---------------- Fin du bail ---------------- */
  accuse_conge: { l:'Réponse au congé du locataire', g:'sortie', ic:'📩', envoi:'simple', d:'Accuse réception, calcule la date de départ, organise la sortie.',
    f:(x)=>[ {n:'dateReception', l:'Date de réception du congé', t:'date', v:todayISO(), req:true, col:2},
      {n:'reduit', l:'Préavis réduit à 1 mois invoqué (vide)', t:'select', v:x.bien.zoneTendue?'zone':'non', o:[['non','Non — préavis de droit commun'],['zone','Logement en zone tendue'],['mutation','Mutation professionnelle'],['emploi','Perte d\'emploi ou nouvel emploi après une perte'],['sante','Raison de santé (certificat médical)'],['rsa','Bénéficiaire du RSA ou de l\'AAH'],['social','Attribution d\'un logement social']], col:2, show:()=>x.bail.type==='vide'},
      {n:'adresseNouvelle', l:'Nouvelle adresse du locataire (si connue)', t:'text', v:(x.bail.fin||{}).adresseNouvelle||''},
      {n:'edl', l:'Rendez-vous proposé pour l\'état des lieux de sortie', t:'text', ph:'Ex. : le 30 juin à 10 h'}, envoiField('simple') ],
    gen:(x,d)=>{ const m = x.bail.type==='vide' ? (d.reduit&&d.reduit!=='non'?R('preavisLocReduit'):R('preavisLocVide')) : R('preavisLocMeuble'); const fin=addDays(addMonths(d.dateReception,m),-1);
      return lettre(x,{envoi:d.envoi, objet:'Accusé de réception de votre congé', corps:`<p>J'accuse réception de votre congé, reçu le ${fdate(d.dateReception)}.</p><p>Le préavis applicable étant de ${m} mois${d.reduit&&d.reduit!=='non'?' (préavis réduit — sous réserve du justificatif correspondant)':''}, votre bail prendra fin le <b>${fdate(fin)}</b>. Le loyer et les charges restent dus jusqu'à cette date, sauf si un nouveau locataire entre dans les lieux plus tôt avec mon accord.</p>
        <p>${d.edl?'Je vous propose de réaliser l\'état des lieux de sortie '+esc(d.edl)+'.':'Je vous contacterai pour fixer la date de l\'état des lieux de sortie.'} Merci de me communiquer votre nouvelle adresse afin de vous restituer le dépôt de garantie dans les délais légaux (un mois si l'état des lieux de sortie est conforme, deux mois sinon).</p>
        <p>Pendant le préavis, je vous remercie de permettre la visite du logement, dans la limite de deux heures par jour ouvrable.</p>`}); },
    after:(x,d)=>{ const m = x.bail.type==='vide' ? (d.reduit&&d.reduit!=='non'?R('preavisLocReduit'):R('preavisLocVide')) : R('preavisLocMeuble');
      x.bail.statut='preavis'; x.bail.fin=Object.assign(x.bail.fin||{}, {date:addDays(addMonths(d.dateReception,m),-1), motif:'Congé du locataire', recuLe:d.dateReception, adresseNouvelle:d.adresseNouvelle||(x.bail.fin||{}).adresseNouvelle}); upsert('baux', x.bail); },
    mail:x=>({o:'Votre congé — fin de bail', c:`Bonjour,\n\nJ'ai bien reçu votre congé. Vous trouverez ci-joint l'accusé de réception avec la date de fin du bail et les prochaines étapes (état des lieux, restitution du dépôt).\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  conge_bailleur: { l:'Congé donné par le bailleur', g:'sortie', ic:'📤', envoi:'lrar', d:'Vente, reprise pour habiter ou motif sérieux — délais contrôlés.',
    show:x=>reconductible(x.bail),
    f:(x)=>{ const cg=dateLimiteCongeBailleur(x.bail)||{};
      return [ {n:'info', t:'info', l:`Échéance du bail : <b>${fdate(cg.echeance)}</b>. Le congé doit être <b>reçu</b> par le locataire au plus tard le <b>${fdate(cg.limite)}</b> (${cg.mois} mois avant). Envoyez-le par lettre recommandée AR, par commissaire de justice ou remettez-le en main propre contre signature.${diffDays(todayISO(),cg.limite)<10?'<br>⚠️ Délai très court : passez par un commissaire de justice pour une date certaine.':''}`},
        {n:'motif', l:'Motif du congé', t:'radio', v:'vente', o:[['vente','Vente du logement'],['reprise','Reprise pour y habiter (moi ou un proche)'],['legitime','Motif légitime et sérieux']]},
        {n:'prix', l:'Prix de vente proposé au locataire (€)', t:'number', h:x.bail.type==='vide'?'Location vide : le congé vaut offre de vente au locataire, qui a 2 mois pour l\'accepter (droit de préemption).':'Location meublée : pas de droit de préemption du locataire.', col:2},
        {n:'conditions', l:'Conditions de la vente', t:'text', v:'Vente libre, paiement comptant', col:2},
        {n:'beneficiaire', l:'Bénéficiaire de la reprise (nom, adresse)', t:'text', col:2}, {n:'lien', l:'Lien avec le bailleur', t:'select', o:[['bailleur','Moi-même'],['conjoint','Conjoint, partenaire de PACS, concubin notoire depuis 1 an au moins'],['ascendant','Ascendant (moi ou mon conjoint)'],['descendant','Descendant (moi ou mon conjoint)']], col:2},
        {n:'caractere', l:'Caractère réel et sérieux de la reprise (justification)', t:'textarea', h:'Obligatoire depuis la loi ALUR : expliquez pourquoi la reprise est nécessaire.'},
        {n:'motifTexte', l:'Motif légitime et sérieux (exposé)', t:'textarea', h:'Ex. : manquements répétés du locataire (retards de paiement, troubles…).'},
        {n:'ageLoc', l:'Le locataire a plus de 65 ans et des ressources modestes', t:'check', h:'Dans ce cas, sauf exceptions, vous devez lui proposer un relogement correspondant à ses besoins et possibilités, dans les limites géographiques prévues par la loi.'},
        envoiField('lrar',['lrar','cj','main']) ]; },
    gen:(x,d)=>{ const cg=dateLimiteCongeBailleur(x.bail)||{}; const vide=x.bail.type==='vide';
      const corps = d.motif==='vente' ? `<p>Je vous donne congé pour le terme de votre bail, soit le <b>${fdate(cg.echeance)}</b>, en raison de ma décision de <b>vendre le logement</b>.</p>${vide?`<p>Conformément à l'article 15-II de la loi du 6 juillet 1989, ce congé vaut <b>offre de vente</b> à votre profit, au prix de <b>${eur(d.prix)}</b>, aux conditions suivantes : ${esc(d.conditions)}. Cette offre est valable pendant les deux premiers mois du préavis. Si vous l'acceptez en déclarant recourir à un prêt, le délai de réalisation de la vente est porté à quatre mois.</p><p>Je reproduis ci-après les cinq premiers alinéas du II de l'article 15 de la loi, comme l'exige le texte (voir au verso).</p>`:''}`
        : d.motif==='reprise' ? `<p>Je vous donne congé pour le terme de votre bail, soit le <b>${fdate(cg.echeance)}</b>, afin de <b>reprendre le logement pour l'habiter</b> au profit de : ${esc(d.beneficiaire)} (${esc({bailleur:'moi-même',conjoint:'conjoint / partenaire / concubin notoire',ascendant:'ascendant',descendant:'descendant'}[d.lien])}).</p><p>Caractère réel et sérieux de cette décision : ${esc(d.caractere)}</p>`
        : `<p>Je vous donne congé pour le terme de votre bail, soit le <b>${fdate(cg.echeance)}</b>, pour le motif légitime et sérieux suivant : ${esc(d.motifTexte)}</p>`;
      return lettre(x,{envoi:d.envoi, objet:'Congé pour '+({vente:'vente',reprise:'reprise',legitime:'motif légitime et sérieux'}[d.motif])+' — fin du bail au '+fdate(cg.echeance), corps: corps+`${d.ageLoc?'<p>Compte tenu de votre âge et de vos ressources, je vous propose un relogement correspondant à vos besoins et possibilités, dans les limites géographiques prévues à l\'article 13 bis de la loi du 1er septembre 1948 : (à préciser).</p>':''}<p>À l'expiration du délai de préavis, vous serez déchu(e) de plein droit de tout titre d'occupation. ${vide?'Vous trouverez jointe la notice d\'information relative aux obligations du bailleur et aux voies de recours et d\'indemnisation du locataire (arrêté du 13 décembre 2017).':''}</p>`,
        pj: vide?['Notice d\'information jointe au congé délivré par le bailleur (arrêté du 13 décembre 2017)']:[],
        legal: d.motif==='vente'&&vide ? 'À joindre ou reproduire au verso : les cinq premiers alinéas du II de l\'article 15 de la loi n° 89-462 du 6 juillet 1989 (texte disponible sur Légifrance). Un congé frauduleux expose le bailleur à une amende pénale pouvant atteindre 6 000 € (30 000 € pour une personne morale).' : 'Un congé frauduleux expose le bailleur à une amende pénale pouvant atteindre 6 000 € (30 000 € pour une personne morale) et à des dommages-intérêts.'}); },
    after:(x,d)=>{ const cg=dateLimiteCongeBailleur(x.bail)||{}; x.bail.statut='preavis'; x.bail.fin=Object.assign(x.bail.fin||{}, {date:cg.echeance, motif:'Congé du bailleur ('+d.motif+')'}); upsert('baux', x.bail); } },
  restitution_depot: { l:'Restitution du dépôt de garantie', g:'sortie', ic:'💶', envoi:'lrar', d:'Décompte des retenues justifiées, délai et pénalités calculés.',
    show:x=>x.bail.type!=='mobilite',
    f:(x)=>{ const f=x.bail.fin||{}; const c=compteLocatif(x.bail);
      return [ {n:'remiseCles', l:'Date de remise des clés', t:'date', v:f.remiseCles||f.date||todayISO(), req:true, col:2}, {n:'conforme', l:'État des lieux de sortie', t:'select', v:f.edlConforme===false?'non':'oui', o:[['oui','Conforme à l\'entrée → 1 mois'],['non','Différences constatées → 2 mois']], col:2},
        {n:'adresseNouvelle', l:'Nouvelle adresse du locataire', t:'text', v:f.adresseNouvelle||'', req:true},
        {n:'impayes', l:'Loyers et charges restant dus (€)', t:'number', v:c.solde>0?c.solde:0, col:2, h:'Repris du compte locatif.'},
        {n:'copro', l:'Retenue provisoire pour charges de copropriété (€)', t:'number', v:0, col:2, h:x.bien.regime==='copro'?'20 % du dépôt au maximum, régularisés dans le mois suivant l\'approbation des comptes.':'Uniquement en copropriété.'},
        {n:'retenues', l:'Retenues pour réparations (une par ligne : description ; montant ; justificatif)', t:'textarea', rows:4, ph:'Trou dans le mur du séjour ; 120 ; devis n°…\nNettoyage du four ; 45 ; facture', h:'Chaque retenue doit être justifiée (devis, facture, constat) et tenir compte de la vétusté — voir l\'outil « Vétusté » dans Courriers.'},
        envoiField('lrar',['lrar','simple','mail']) ]; },
    gen:(x,d)=>{ const lignes=(d.retenues||'').split('\n').map(s=>s.split(';').map(t=>t.trim())).filter(a=>a[0]);
      const tot=r2(lignes.reduce((s,a)=>s+num(a[1]),0)+num(d.impayes)+num(d.copro)); const depot=num(x.bail.depot);
      const mois = d.conforme==='non'?R('depotDelaiNonConforme'):R('depotDelaiConforme'); const limite=addMonths(d.remiseCles, mois);
      let retard=0; if(todayISO()>limite){ let t=limite; while(t<todayISO()){ retard++; t=addMonths(t,1);} } const pen=r2(retard*num(loyerA(x.bail,d.remiseCles).loyerHC)*R('depotPenalite')/100);
      const net=r2(depot-tot+pen);
      return lettre(x,{envoi:d.envoi, dest:{nom:nomsLocataires(x.bail), adresse:esc(d.adresseNouvelle||'')}, objet:'Restitution du dépôt de garantie', corps:`<p>Suite à votre départ du logement et à la remise des clés le ${fdate(d.remiseCles)}, voici le décompte de restitution de votre dépôt de garantie (article 22 de la loi du 6 juillet 1989) :</p>
        ${tableau([['Dépôt de garantie versé', eur(depot)]].concat(num(d.impayes)?[['Loyers et charges restant dus', '− '+eur(d.impayes)]]:[]).concat(lignes.map(a=>[esc(a[0])+(a[2]?' <span class="small">('+esc(a[2])+')</span>':''), '− '+eur(a[1])])).concat(num(d.copro)?[['Retenue provisoire — charges de copropriété (régularisation à l\'approbation des comptes)', '− '+eur(d.copro)]]:[]).concat(pen?[['Majoration légale pour restitution tardive ('+retard+' mois × 10 % du loyer)', '+ '+eur(pen)]]:[]), [net>=0?'Montant restitué':'Reste dû par le locataire', eur(Math.abs(net))])}
        <p>${net>=0?`La somme de <b>${eur(net)}</b> vous est restituée ${x.bail.iban?'par virement':'par le moyen de votre choix'} le ${fdate(todayISO())}.`:`Le dépôt ne couvre pas les sommes dues : je vous remercie de me régler le solde de ${eur(-net)}.`}${lignes.length?' Les justificatifs des retenues sont joints.':''}</p>`, pj: lignes.length?['Justificatifs des retenues (devis, factures)','Copie des états des lieux d\'entrée et de sortie']:[]}); },
    after:(x,d)=>{ x.bail.fin=Object.assign(x.bail.fin||{}, {remiseCles:d.remiseCles, edlConforme:d.conforme!=='non', adresseNouvelle:d.adresseNouvelle, depotRestitueLe:todayISO()}); if(x.bail.statut!=='termine'&&x.bail.statut!=='sortie'){ x.bail.statut='sortie'; x.bail.fin.date=x.bail.fin.date||d.remiseCles; } upsert('baux', x.bail); },
    mail:x=>({o:'Restitution de votre dépôt de garantie', c:`Bonjour,\n\nVous trouverez ci-joint le décompte de restitution de votre dépôt de garantie.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) },
  resiliation_amiable: { l:'Résiliation amiable du bail', g:'sortie', ic:'🤝', envoi:'main', d:'Fin du bail d\'un commun accord, à une date convenue.',
    f:()=>[ {n:'dateEffet', l:'Date de fin convenue', t:'date', v:todayISO(), req:true}, {n:'conditions', l:'Conditions particulières (préavis supprimé, etc.)', t:'textarea'} ],
    gen:(x,d)=>`<div class="docsheet"><h1>Protocole de résiliation amiable du bail</h1>
      <p>Entre ${esc(nomBailleur(x.bl))}, bailleur, et ${esc(nomsLocataires(x.bail))}, locataire(s) du logement situé ${esc(adresseBien(x.bien))}, en vertu d'un bail ayant pris effet le ${fdate(x.bail.dateDebut)}.</p>
      <p>Les parties conviennent, d'un commun accord, de mettre fin au bail le <b>${fdate(d.dateEffet)}</b>. Le loyer et les charges sont dus jusqu'à cette date. Un état des lieux de sortie contradictoire sera établi à cette date ; le dépôt de garantie sera restitué dans les conditions de l'article 22 de la loi du 6 juillet 1989.</p>
      ${d.conditions?'<p>'+esc(d.conditions).replace(/\n/g,'<br>')+'</p>':''}
      <p>Fait à ${esc(villeSignature(x))}, le ${fdate(todayISO())}, en autant d'exemplaires que de parties.</p>${sigrow('Le bailleur — « Bon pour accord »','Le(s) locataire(s) — « Bon pour accord »')}</div>`,
    after:(x,d)=>{ x.bail.statut='preavis'; x.bail.fin=Object.assign(x.bail.fin||{}, {date:d.dateEffet, motif:'Résiliation amiable'}); upsert('baux', x.bail); } },

  /* ---------------- Attestations ---------------- */
  attestation: { l:'Attestation', g:'attest', ic:'📄', envoi:'mail', d:'Loyer (CAF), domicile, paiements à jour, bon voisinage.',
    f:(x,p)=>[ {n:'typeAtt', l:'Type', t:'select', v:p.typeAtt||'loyer_caf', o:[['loyer_caf','Attestation de loyer (CAF / MSA)'],['domicile','Attestation de location (justificatif de domicile)'],['a_jour','Attestation de paiements à jour'],['bon_voisinage','Attestation de bon voisinage']]}, {n:'complement', l:'Complément (optionnel)', t:'textarea'} ],
    gen:(x,d)=>{ const l=loyerA(x.bail,todayISO()); const loc=esc(nomsLocataires(x.bail)); const adr=esc(adresseBien(x.bien)); const c=compteLocatif(x.bail);
      const t={ loyer_caf:`J'atteste que ${loc} est locataire du logement situé ${adr} depuis le ${fdate(x.bail.dateDebut)}, à titre de résidence principale. Le loyer mensuel s'élève à ${eur(l.loyerHC)} hors charges, et les charges à ${eur(l.charges)}. Surface habitable : ${esc(x.bien.surface)} m². Le logement est ${estMeuble(x.bail)?'loué meublé':'loué vide'}.`,
        domicile:`J'atteste que ${loc} occupe, en qualité de locataire, le logement situé ${adr} depuis le ${fdate(x.bail.dateDebut)}, en vertu d'un bail ${x.bail.statut==='actif'?'en cours':'ayant pris fin le '+fdate((x.bail.fin||{}).date)}.`,
        a_jour: c.solde<=0.01 ? `J'atteste que ${loc}, locataire du logement situé ${adr} depuis le ${fdate(x.bail.dateDebut)}, est à jour du paiement de ses loyers et charges à la date du ${fdate(todayISO())}.` : `⚠️ Le compte locatif présente un solde débiteur de ${eur(c.solde)} : l'appli ne peut pas établir une attestation de paiements à jour.`,
        bon_voisinage:`J'atteste que ${loc}, locataire du logement situé ${adr} depuis le ${fdate(x.bail.dateDebut)}, n'a fait l'objet, à ma connaissance, d'aucune plainte pour trouble de voisinage.` }[d.typeAtt];
      const titre={loyer_caf:'Attestation de loyer',domicile:'Attestation de location',a_jour:'Attestation de paiement des loyers',bon_voisinage:'Attestation de bon voisinage'}[d.typeAtt];
      return `<div class="docsheet"><div class="letterhead"><div>${blocExp(x.bl)}</div><div></div></div><h1>${titre}</h1><p>Je soussigné(e) ${esc(nomBailleur(x.bl))}, bailleur,</p><p>${t}</p>${d.complement?'<p>'+esc(d.complement)+'</p>':''}<p>Attestation établie pour servir et valoir ce que de droit.</p><div class="sigrow"><div class="sigbox">Fait à ${esc(villeSignature(x))}, le ${fdate(todayISO())}<div class="line">${esc(nomBailleur(x.bl))}</div></div><div class="sigbox"></div></div><div class="legal">Le fait d'établir une attestation faisant état de faits matériellement inexacts est puni par l'article 441-7 du Code pénal.</div></div>`; },
    mail:x=>({o:'Votre attestation', c:`Bonjour,\n\nVous trouverez ci-joint l'attestation demandée.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) }
};
/* les deux états des lieux passent par l'éditeur de pièces */
DOCS.etat_lieux_entree = { l:'État des lieux d\'entrée', g:'entree', ic:'🔑', envoi:'main', d:'Pièce par pièce, avec photos'+' et inventaire si meublé.', edl:'entree', gen:(x,d)=>genEtatLieux(x,d,'entree') };
DOCS.etat_lieux_sortie = { l:'État des lieux de sortie', g:'sortie', ic:'🚪', envoi:'main', d:'Comparé automatiquement à l\'entrée.', edl:'sortie', gen:(x,d)=>genEtatLieux(x,d,'sortie') };
const GROUPES_DOCS = [
  ['entree','Mise en location','amber'], ['mois','Chaque mois','teal'], ['an','Chaque année','teal'],
  ['incident','Problèmes, impayés, travaux, litiges','brick'], ['sortie','Fin du bail','brick'], ['attest','Attestations','teal']
];
/* types de la v1 */
DOCS.solde = DOCS.restitution_depot; DOCS.conge = DOCS.accuse_conge;
