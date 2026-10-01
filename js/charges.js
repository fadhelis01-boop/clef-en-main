/* =====================================================================================
   CHARGES LOCATIVES — onglet « Charges » d'un logement :
   1. ce que paie le locataire chaque mois (provision ou forfait) et son détail par nature ;
   2. les décomptes annuels des charges réelles (syndic, factures), par nature, part récupérable ;
   3. la régularisation de chaque bail concerné, y compris les locataires partis.
   ===================================================================================== */
function tabCharges(a, bien, bail){
  const dcs=decomptesDuBien(bien.id);
  const b = bail && bail.statut!=='brouillon' ? bail : null;
  const l = b ? loyerA(b, todayISO()) : null;
  const det = b ? detailCharges(b) : [];
  a.innerHTML = `
    <div class="card"><h3>Ce que paie le locataire chaque mois</h3>
    ${b ? `<div class="kpis"><div class="kpi"><div class="k">Loyer hors charges</div><div class="v">${eur(l.loyerHC)}</div></div>
        <div class="kpi"><div class="k">${b.chargesType==='forfait'?'Forfait de charges':'Provision pour charges'}</div><div class="v">${eur(l.charges)}</div></div>
        <div class="kpi"><div class="k">Total mensuel</div><div class="v">${eur(l.loyerHC+l.charges)}</div></div></div>
      ${b.chargesType==='forfait'
        ? `<p class="small">Forfait : montant fixe, <b>jamais régularisé</b>. Il peut être révisé une fois par an comme le loyer (lettre de révision IRL). Il ne doit pas être manifestement disproportionné par rapport aux charges réelles.</p>`
        : `<p class="small">Provision : une avance sur les charges réelles. Une fois par an, l'appli compare les provisions versées aux charges récupérables réelles (décompte ci-dessous) et calcule le complément à demander ou le trop-perçu à rembourser.</p>`}
      <h4>Détail par nature</h4>
      ${det.length?`<table class="tbl small">${det.map(x=>`<tr><td>${esc(natureCharge(x.nature).l)}${x.libelle?' — '+esc(x.libelle):''}</td><td class="num">${eur(x.montant)} / mois</td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="num">${eur(det.reduce((s,x)=>s+num(x.montant),0))}</td></tr></table>${Math.abs(det.reduce((s,x)=>s+num(x.montant),0)-l.charges)>0.01?'<p class="warnc small">Le détail ne correspond pas au montant mensuel : mettez-le à jour.</p>':''}`:'<p class="muted small">Pas encore de détail. Le détailler rend le montant compréhensible pour le locataire : il figure sur les avis d\'échéance et les quittances.</p>'}
      <div class="btnrow"><button class="btn btn-teal btn-sm" onclick="openProvision('${b.id}')">${b.chargesType==='forfait'?'Modifier le forfait ou son détail':'Modifier la provision ou son détail'}</button></div>`
      : '<p class="muted">Aucun bail en cours.</p>'}
    </div>
    <div class="card"><h3>Charges réelles de l'année (décomptes)</h3>
      <p class="small">Chaque année, saisissez les charges réellement payées pour ce logement : le <b>décompte annuel du syndic</b> (copropriété), les factures d'eau, la TEOM de l'avis de taxe foncière, les contrats d'entretien… Indiquez la période exacte : l'exercice du syndic n'est pas toujours l'année civile.</p>
      ${dcs.length?`<div class="list">${dcs.map(dc=>{ const T=decompteTotaux(dc); const bx=bauxDuDecompte(dc);
        return `<div class="lrow"><div class="lmain" onclick="openDecompte('${bien.id}','${dc.id}')"><b>Du ${fdateCourt(dc.du)} au ${fdateCourt(dc.au)}</b><span>Total ${eur(T.total)} · récupérable ${eur(T.recup)} · à votre charge ${eur(T.total-T.recup)}${dc.source?' · '+esc(dc.source):''}</span></div>
          <div class="lact">${bx.map(x=>{ const f=regulFaite(x.id, dc.id); return f?`<button class="btn btn-sm btn-ghost" onclick="openEnvoi('${f.id}')">✓ ${esc(nomsLocataires(x))}</button>`:`<button class="btn btn-sm btn-teal" onclick="openDoc('regularisation_charges','${x.id}',{decompteId:'${dc.id}'})">Régulariser : ${esc(nomsLocataires(x))}</button>`; }).join('')}</div></div>`; }).join('')}</div>`:'<p class="muted">Aucun décompte saisi.</p>'}
      <div class="btnrow"><button class="btn btn-teal" onclick="openDecompte('${bien.id}')">+ Saisir un décompte annuel</button></div>
    </div>
    <details class="card"><summary><b>Quelles charges peut-on récupérer sur le locataire ?</b></summary>
      <p class="small">La liste est <b>limitative</b> (décret n° 87-713) : ce qui n'y figure pas reste à votre charge, même si le bail dit le contraire.</p>
      <table class="tbl small">${(REG.chargesNatures||[]).map(n=>`<tr><td><b>${esc(n.l)}</b><br>${esc(n.ex)}</td><td class="num">${n.pct} %</td></tr>`).join('')}</table>
    </details>`;
}

/* ---- Modifier la provision / le forfait et son détail ---- */
function openProvision(bailId){
  const b=byId('baux',bailId); const l=loyerA(b, todayISO());
  let lignes = detailCharges(b).length ? JSON.parse(JSON.stringify(detailCharges(b))) : [{nature:'eau', montant:''},{nature:'communs', montant:''},{nature:'taxes', montant:''}];
  const dcs=decomptesDuBien(b.bienId); const dernier=dcs[0];
  const m=openModal({title:b.chargesType==='forfait'?'Forfait de charges':'Provision pour charges', wide:true, body:`
    <p class="small">Montant mensuel actuel : <b>${eur(l.charges)}</b>. ${b.chargesType==='provision'?'Une provision doit correspondre à une estimation sincère des charges réelles (budget prévisionnel du syndic, dernier décompte). En cours d\'année, une modification doit être justifiée et annoncée par écrit.':'Le forfait n\'est révisable qu\'une fois par an, comme le loyer.'}</p>
    ${dernier&&b.chargesType==='provision'?`<div class="infobox">Dernier décompte (${fdateCourt(dernier.du)} – ${fdateCourt(dernier.au)}) : charges récupérables ${eur(decompteTotaux(dernier).recup)} par an, soit ${eur(decompteTotaux(dernier).recup/12)} par mois. <button type="button" class="linkbtn" id="pvFromDc">Reprendre ce détail</button></div>`:''}
    <div id="pvLines"></div><button type="button" class="btn btn-ghost btn-sm" id="pvAdd">+ Ajouter une nature</button>
    <div class="result" id="pvTot"></div>
    ${formHtml([{n:'effet', l:'À partir de', t:'date', v:monthFirst(nextMonthKey(monthKey(todayISO()))), col:2},{n:'lettre', l:'Préparer la lettre d\'information au locataire', t:'check', v:true, col:2}],'pv')}`,
    actions:[{label:'Annuler'},{label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{
      collect(); const tot=r2(lignes.reduce((s,x)=>s+num(x.montant),0));
      const eff=bg.querySelector('[name=effet]').value||todayISO(); const lettre=bg.querySelector('[name=lettre]').checked;
      const ancien=l.charges;
      b.chargesDetail=lignes.filter(x=>num(x.montant)>0);
      if(Math.abs(tot-ancien)>0.005){ b.historiqueLoyer=b.historiqueLoyer||[]; b.historiqueLoyer.push({du:eff, loyerHC:loyerA(b,eff).loyerHC, charges:tot, motif:b.chargesType==='forfait'?'Nouveau forfait de charges':'Nouvelle provision pour charges'}); }
      upsert('baux', b); toast('Charges mises à jour.'); refresh();
      if(lettre && Math.abs(tot-ancien)>0.005) setTimeout(()=>openDoc('modif_provision', b.id, {ancien, nouveau:tot, effet:eff}), 200);
    }}]});
  const opts=k=>(REG.chargesNatures||[]).filter(n=>n.k!=='non_recup').map(n=>`<option value="${n.k}" ${n.k===k?'selected':''}>${esc(n.l)}</option>`).join('');
  const draw=()=>{ m.el.querySelector('#pvLines').innerHTML=lignes.map((x,i)=>`<div class="pvrow"><select data-i="${i}" data-f="nature">${opts(x.nature)}</select><input type="text" data-i="${i}" data-f="libelle" value="${esc(x.libelle||'')}" placeholder="Précision (facultatif)"><input type="text" inputmode="decimal" data-i="${i}" data-f="montant" value="${esc(x.montant)}" placeholder="€ / mois"><button type="button" class="linkbtn" data-del="${i}" aria-label="Retirer">✕</button></div>`).join(''); tot(); };
  const collect=()=>m.el.querySelectorAll('#pvLines [data-i]').forEach(el=>{ const x=lignes[+el.dataset.i]; x[el.dataset.f]= el.dataset.f==='montant'? (el.value.trim()===''?'':num(el.value)) : el.value; });
  const tot=()=>{ collect(); m.el.querySelector('#pvTot').innerHTML=`Nouveau montant mensuel : <b>${eur(lignes.reduce((s,x)=>s+num(x.montant),0))}</b>`; };
  m.el.querySelector('#pvLines').addEventListener('input', tot);
  m.el.querySelector('#pvLines').addEventListener('click', e=>{ const d=e.target.closest('[data-del]'); if(d){ collect(); lignes.splice(+d.dataset.del,1); draw(); } });
  m.el.querySelector('#pvAdd').onclick=()=>{ collect(); lignes.push({nature:'communs', montant:''}); draw(); };
  const fd=m.el.querySelector('#pvFromDc'); if(fd) fd.onclick=()=>{ const T=decompteTotaux(dernier); const map={}; T.lignes.filter(x=>x.recup>0).forEach(x=>map[x.nature]=(map[x.nature]||0)+x.recup); lignes=Object.keys(map).map(k=>({nature:k, montant:r2(map[k]/12)})); draw(); };
  draw();
}

/* ---- Saisie d'un décompte annuel ---- */
const DEP_VERS_NATURE = {teom:'taxes', eau_energie:'eau', entretien_recup:'individuel', copro:'communs'};
function openDecompte(bienId, dcId){
  const bien=byId('biens',bienId); const dc0=dcId?byId('decomptes',dcId):null;
  const dern=decomptesDuBien(bienId)[0];
  const y=String(parseISO(todayISO()).getFullYear()-1);
  const dc=dc0? JSON.parse(JSON.stringify(dc0)) : {id:uid('dc'), bienId, du: dern? addDays(dern.au,1) : y+'-01-01', au: dern? addMonths(dern.au,12) : y+'-12-31', source: bien.regime==='copro'?'Décompte annuel du syndic':'Factures', quotePart:100, lignes:[], note:''};
  const m=openModal({title:'Décompte annuel des charges — '+esc(nomBien(bien)), wide:true, sticky:true, body:`
    ${dc0 && STATE.baux.some(b=>regulFaite(b.id, dc0.id))?'<div class="infobox warn">Une régularisation a déjà été envoyée à partir de ce décompte. Si vous le corrigez, faites une nouvelle lettre de régularisation (bouton « Régulariser » après avoir supprimé l\'ancienne, ou un avoir / une somme due dans le compte du locataire) pour l\'écart.</div>':''}
    <p class="hint">Recopiez les montants <b>par nature</b> : en copropriété, le décompte individuel du syndic (« relevé des dépenses ») indique pour votre lot le total et souvent la part « récupérable » ou « locative ». Pour une maison ou un immeuble entier, saisissez les factures.</p>
    <form onsubmit="return false">${formHtml([
      {n:'du', l:'Période du', t:'date', v:dc.du, req:true, col:3}, {n:'au', l:'au', t:'date', v:dc.au, req:true, col:3}, {n:'source', l:'Source', t:'text', v:dc.source, col:3},
      {n:'quotePart', l:'Part de ce logement dans les montants saisis (%)', t:'number', v:dc.quotePart, h:'100 % si les montants concernent uniquement ce logement (cas du décompte du syndic pour votre lot). Si vous saisissez une facture de tout l\'immeuble que vous possédez, indiquez la part de ce logement (tantièmes ou surface).'}],'dc')}</form>
    <div class="dctable"><div class="dchead"><span>Nature</span><span>Précision</span><span>Montant (€)</span><span>% récup.</span><span>Récupérable</span><span></span></div><div id="dcLines"></div></div>
    <div class="btnrow"><button type="button" class="btn btn-ghost btn-sm" id="dcAdd">+ Ajouter une ligne</button><button type="button" class="btn btn-ghost btn-sm" id="dcImp">Reprendre les dépenses saisies sur la période</button></div>
    <div class="result" id="dcTot"></div>
    ${formHtml([{n:'note', l:'Mode de répartition / remarques (repris sur la lettre de régularisation)', t:'textarea', v:dc.note||(bien.regime==='copro'?'Répartition entre copropriétaires selon les tantièmes de charges générales et spéciales du règlement de copropriété, d\'après le décompte du syndic.':''), rows:2}],'dc2')}`,
    actions:[ ...(dc0?[{label:'Supprimer', cls:'btn-ghost danger', onClick:async()=>{ if(await confirmBox('Supprimer ce décompte ?','Les régularisations déjà envoyées restent dans les documents.','Supprimer',true)){ softDelete('decomptes', dc0.id, 'Décompte de charges'); refresh(); } }}]:[]),
      {label:'Annuler'},
      {label:'Enregistrer', cls:'btn-teal', onClick:(c,bg)=>{ collect(); const f=formValues(bg); if(!f.du||!f.au||f.au<f.du){ toast('Période invalide.'); return false; }
        if(diffDays(f.du,f.au)>400){ toast('La période dépasse un an : un décompte couvre un exercice de 12 mois.'); return false; }
        const chev=decomptesDuBien(bienId).find(o=>o.id!==dc.id && o.du<=f.au && o.au>=f.du);
        if(chev){ toast('Cette période chevauche le décompte du '+fdateCourt(chev.du)+' au '+fdateCourt(chev.au)+' : les mêmes charges seraient réclamées deux fois. Modifiez plutôt ce décompte.', 6500); return false; }
        Object.assign(dc, {du:f.du, au:f.au, source:f.source, quotePart:f.quotePart===''?100:num(f.quotePart), note:f.note, lignes:dc.lignes.filter(x=>num(x.total)!==0)});
        if(!dc.lignes.length){ toast('Ajoutez au moins une ligne.'); return false; }
        upsert('decomptes', dc); toast('Décompte enregistré.'); go('bien',{id:bienId, tab:'charges'}); }} ]});
  const opts=k=>(REG.chargesNatures||[]).map(n=>`<option value="${n.k}" ${n.k===k?'selected':''}>${esc(n.l)}</option>`).join('');
  const collect=()=>m.el.querySelectorAll('#dcLines [data-i]').forEach(el=>{ const x=dc.lignes[+el.dataset.i]; if(!x) return; const f=el.dataset.f; x[f] = (f==='total'||f==='pct') ? (el.value.trim()===''?'':num(el.value)) : el.value; });
  const tot=()=>{ collect(); const q=(m.el.querySelector('[name=quotePart]').value.trim()===''?100:num(m.el.querySelector('[name=quotePart]').value));
    const T=decompteTotaux(Object.assign({}, dc, {quotePart:q}));
    m.el.querySelectorAll('[data-rec]').forEach(el=>{ const x=T.lignes[+el.dataset.rec]; el.textContent=x?eur(x.recup):''; });
    m.el.querySelector('#dcTot').innerHTML=`Total ${eur(T.total)} · <b>récupérable sur le(s) locataire(s) : ${eur(T.recup)}</b> · à votre charge : ${eur(T.total-T.recup)}`; };
  const draw=()=>{ m.el.querySelector('#dcLines').innerHTML=dc.lignes.map((x,i)=>`<div class="dcrow"><select data-i="${i}" data-f="nature" aria-label="Nature">${opts(x.nature)}</select><input type="text" data-i="${i}" data-f="libelle" value="${esc(x.libelle||'')}" placeholder="Ex. : eau froide, contrat ascenseur" aria-label="Précision"><input type="text" inputmode="decimal" data-i="${i}" data-f="total" value="${esc(x.total)}" aria-label="Montant"><input type="text" inputmode="decimal" data-i="${i}" data-f="pct" value="${esc(x.pct===undefined?'':x.pct)}" placeholder="${natureCharge(x.nature).pct}" aria-label="Pourcentage récupérable"><span data-rec="${i}" class="num"></span><button type="button" class="linkbtn" data-del="${i}" aria-label="Retirer">✕</button><small class="dchint">${esc(natureCharge(x.nature).ex)}</small></div>`).join('')||'<p class="muted pad">Aucune ligne.</p>'; tot(); };
  m.el.querySelector('#dcLines').addEventListener('input', tot);
  m.el.querySelector('#dcLines').addEventListener('change', e=>{ if(e.target.dataset.f==='nature'){ collect(); draw(); } });
  m.el.querySelector('[name=quotePart]').addEventListener('input', tot);
  m.el.querySelector('#dcLines').addEventListener('click', e=>{ const d=e.target.closest('[data-del]'); if(d){ collect(); dc.lignes.splice(+d.dataset.del,1); draw(); } });
  m.el.querySelector('#dcAdd').onclick=()=>{ collect(); dc.lignes.push({id:uid('dl'), nature:'eau', libelle:'', total:'', pct:''}); draw(); };
  m.el.querySelector('#dcImp').onclick=()=>{ collect(); const du=m.el.querySelector('[name=du]').value, au=m.el.querySelector('[name=au]').value; let n=0;
    const deja=[];
    STATE.depenses.filter(d=>d.bienId===bienId && d.date>=du && d.date<=au && DEP_VERS_NATURE[d.categorie]).forEach(d=>{ if(dc.lignes.some(x=>x.depId===d.id)) return;
      if(dc.lignes.some(x=>!x.depId && x.nature===DEP_VERS_NATURE[d.categorie] && num(x.total)>0)){ deja.push((CAT_DEPENSES[d.categorie]||{}).l); return; }
      n++;
      dc.lignes.push({id:uid('dl'), depId:d.id, nature:DEP_VERS_NATURE[d.categorie], libelle:(CAT_DEPENSES[d.categorie]||{}).l+(d.libelle?' — '+d.libelle:''), total:num(d.montant), pct: d.recupPct!==undefined&&d.recupPct!==''? d.recupPct : (d.categorie==='copro'?'':'')}); });
    draw(); toast((n? plural(n,'dépense')+' reprise(s). Pour les charges de copropriété, détaillez si possible par nature selon le décompte du syndic.' : 'Aucune nouvelle dépense à reprendre sur cette période.')+(deja.length?' Non reprises car une ligne de même nature est déjà saisie (pas de double compte) : '+deja.join(', ')+'.':''), 6000); };
  if(!dc.lignes.length){ dc.lignes=[{id:uid('dl'), nature:'eau', total:'', pct:''},{id:uid('dl'), nature:'communs', total:'', pct:''},{id:uid('dl'), nature:'taxes', libelle:'TEOM (hors frais de gestion)', total:'', pct:''}]; }
  draw();
}

/* =====================================================================================
   DOCUMENTS LIÉS AUX CHARGES
   ===================================================================================== */
DOCS.regularisation_charges = { l:'Régularisation annuelle des charges', g:'an', ic:'⚖️', envoi:'lrar', d:'Charges réelles contre provisions versées, par nature, au prorata de présence.',
  show:x=>x.bail.chargesType==='provision',
  f:(x,p)=>{
    const dcs=decomptesDuBien(x.bien.id).filter(dc=>occupationPeriode(x.bail, dc.du, dc.au).jours>0);
    const dc = (p.decompteId && byId('decomptes',p.decompteId)) || dcs[0];
    if(!dc) return [{n:'info', t:'info', cls:'warn', l:'Aucun décompte de charges réelles ne couvre la période de ce bail. Saisissez d\'abord le décompte annuel dans l\'onglet « Charges » du logement (décompte du syndic, factures, TEOM).'}];
    const rc=regulCalc(x.bail, dc);
    return [ {n:'decompteId', l:'Décompte', t:'select', v:dc.id, o:dcs.map(d=>[d.id, 'Du '+fdateCourt(d.du)+' au '+fdateCourt(d.au)])},
      {n:'info', t:'info', l:`Présence du locataire sur la période : <b>${rc.occ.jours} jours</b> (du ${fdateCourt(rc.occ.debut)} au ${fdateCourt(rc.occ.fin)}), soit ${(rc.occ.prorata*100).toFixed(1).replace('.',',')} % de l'exercice.<br>Charges récupérables à sa charge : <b>${eur(rc.parts)}</b> — provisions appelées : <b>${eur(rc.provisions)}</b> — <b>${rc.solde>=0?'complément dû : '+eur(rc.solde):'trop-perçu : '+eur(-rc.solde)}</b>.${rc.prescrite?'<br>⚠️ Plus de 3 ans : la somme est probablement prescrite (article 7-1).':''}${rc.tardive?'<br>Régularisation faite après la fin de l\'année civile suivante : le locataire peut exiger de payer en 12 mensualités (article 23).':''}`},
      {t:'section', l:'Part du locataire par ligne', h:'Modifiable : par exemple pour l\'eau, si vous répartissez selon les relevés de compteur de l\'état des lieux plutôt qu\'au prorata du temps.'},
      ...rc.lignes.map((l,i)=>({n:'p_'+i, l:esc(natureCharge(l.nature).l)+(l.libelle?' — '+esc(l.libelle):'')+` <small>(récupérable ${eur(l.recup)})</small>`, t:'number', v:l.part, col:2})),
      {n:'provisions', l:'Provisions appelées sur la période (€)', t:'number', v:rc.provisions, col:2, h:'Calculées d\'après le bail ; modifiez-les si le locataire n\'a pas tout payé, les impayés restant suivis dans son compte.'},
      {n:'nouvelleProv', l:'Nouvelle provision mensuelle (€)', t:'number', v:['actif','preavis'].includes(x.bail.statut)&&rc.nouvelleProvision?rc.nouvelleProvision:'', col:2, h:'Laisser vide pour ne pas changer.'},
      {n:'etalement', l:'Étaler le complément sur 12 mois', t:'check', v:rc.tardive && rc.solde>0},
      {n:'inscrire', l:'Inscrire le solde au compte du locataire', t:'check', v:true}, envoiField('lrar',['lrar','simple','main','mail']) ];
  },
  gen:(x,d)=>{
    const dc=byId('decomptes', d.decompteId); if(!dc) return '<div class="docsheet"><p>Décompte introuvable.</p></div>';
    const rc=regulCalc(x.bail, dc); const T=decompteTotaux(dc);
    const parts=rc.lignes.map((l,i)=>Object.assign({}, l, {part: d['p_'+i]!==undefined&&d['p_'+i]!==''? num(d['p_'+i]) : l.part}));
    const totPart=r2(parts.reduce((s,l)=>s+l.part,0)); const prov=d.provisions!==undefined&&d.provisions!==''?num(d.provisions):rc.provisions; const solde=r2(totPart-prov);
    const exig = addMonths(todayISO(), R('regulPreavis'));
    const chauffColl = parts.some(l=>l.nature==='chauffage');
    return lettre(x,{envoi:d.envoi, objet:`Régularisation des charges locatives — période du ${fdate(dc.du)} au ${fdate(dc.au)}`, corps:`
      <p>Conformément à l'article 23 de la loi du 6 juillet 1989, je vous adresse le décompte des charges récupérables de la période du ${fdate(dc.du)} au ${fdate(dc.au)}${rc.occ.prorata<0.999?`, calculé pour votre période de présence dans le logement (du ${fdate(rc.occ.debut)} au ${fdate(rc.occ.fin)}, soit ${rc.occ.jours} jours)`:''}.</p>
      <table><tr><th>Nature de la charge</th><th class="num">Montant pour le logement</th><th class="num">Part récupérable</th><th class="num">Votre part</th></tr>
        ${parts.map(l=>`<tr><td>${esc(natureCharge(l.nature).l)}${l.libelle?' — '+esc(l.libelle):''}</td><td class="num">${eur(l.totalLot)}</td><td class="num">${eur(l.recup)}${l.taux<100?' ('+l.taux+' %)':''}</td><td class="num">${eur(l.part)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="3">Total des charges récupérables à votre charge</td><td class="num">${eur(totPart)}</td></tr>
        <tr><td colspan="3">Provisions pour charges appelées sur la période</td><td class="num">− ${eur(prov)}</td></tr>
        <tr class="tot"><td colspan="3">${solde>=0?'Solde restant à votre charge':'Trop-perçu en votre faveur'}</td><td class="num">${eur(Math.abs(solde))}</td></tr></table>
      <p class="small">Mode de répartition : ${esc(dc.note||'charges récupérables du logement'+(T.q<1?' (quote-part de '+(T.q*100).toFixed(2).replace('.',',')+' % des dépenses de l\'immeuble)':''))}${rc.occ.prorata<0.999?' ; répartition au prorata de la durée d\'occupation':''}. Seules les dépenses figurant sur la liste du décret n° 87-713 du 26 août 1987 vous sont réclamées.${chauffColl?' Chauffage et eau chaude collectifs : la note d\'information sur les modalités de calcul (répartition, consommations) est jointe ou tenue à votre disposition.':''}</p>
      <p>${solde>0.004 ? (d.etalement ? `Cette somme de ${eur(solde)} pourra être réglée en douze mensualités de ${eur(r2(solde/12))}, en plus du loyer, à compter de l'échéance du ${fdate(exig)}.` : `Cette somme de ${eur(solde)} sera exigible avec l'échéance suivant le ${fdate(exig)}, soit un mois après l'envoi du présent décompte.${rc.tardive?' Cette régularisation intervenant après la fin de l\'année civile suivant l\'exercice, vous pouvez demander à la régler en douze mensualités.':' Si ce montant vous pose difficulté, nous pouvons convenir d\'un étalement.'}`)
        : solde<-0.004 ? `Cette somme de ${eur(-solde)} vous sera remboursée ${['actif','preavis'].includes(x.bail.statut)?'par déduction de votre prochain loyer, ou par virement si vous le préférez':'par virement'}.` : 'Les provisions versées couvrent exactement les charges : aucune somme n\'est due.'}</p>
      ${num(d.nouvelleProv)>0?`<p>Pour tenir compte des dépenses réelles, la provision mensuelle pour charges sera de <b>${eur(d.nouvelleProv)}</b> à compter de l'échéance du ${fdate(monthFirst(nextMonthKey(monthKey(exig))))}.</p>`:''}
      <p>Les pièces justificatives (décompte du syndic, factures, contrats d'entretien, avis de taxe foncière pour la TEOM) sont tenues à votre disposition pendant ${R('justifCharges')} mois à compter de l'envoi de ce décompte ; je peux aussi vous les transmettre par voie électronique.</p>`}); },
  after:(x,d)=>{
    const dc=byId('decomptes', d.decompteId); if(!dc) return; const rc=regulCalc(x.bail, dc);
    const parts=rc.lignes.reduce((s,l,i)=>s+(d['p_'+i]!==undefined&&d['p_'+i]!==''?num(d['p_'+i]):l.part),0);
    const prov=d.provisions!==undefined&&d.provisions!==''?num(d.provisions):rc.provisions; const solde=r2(parts-prov);
    const exig=addMonths(todayISO(), R('regulPreavis')); const lib='Régularisation des charges '+fdateCourt(dc.du)+' – '+fdateCourt(dc.au);
    x.bail.extras=x.bail.extras||[];
    if(d.inscrire && Math.abs(solde)>=0.01){
      if(d.etalement && solde>0){ const m=r2(solde/12); for(let i=0;i<12;i++) x.bail.extras.push({id:uid('ex'), date:addMonths(exig,i), libelle:lib+' ('+(i+1)+'/12)', montant: i===11? r2(solde-m*11) : m, regul:dc.id}); }
      else x.bail.extras.push({id:uid('ex'), date: solde>0?exig:todayISO(), libelle:lib, montant:solde, regul:dc.id});
    }
    if(num(d.nouvelleProv)>0 && ['actif','preavis'].includes(x.bail.statut)){ const eff=monthFirst(nextMonthKey(monthKey(exig))); x.bail.historiqueLoyer=x.bail.historiqueLoyer||[]; x.bail.historiqueLoyer.push({du:eff, loyerHC:loyerA(x.bail,eff).loyerHC, charges:num(d.nouvelleProv), motif:'Provision ajustée après régularisation'}); }
    upsert('baux', x.bail);
  },
  mail:(x,d)=>({o:'Régularisation de vos charges locatives', c:`Bonjour,\n\nVous trouverez ci-joint le décompte annuel de vos charges locatives, détaillé par nature, avec le solde calculé. Les justificatifs sont à votre disposition sur simple demande.\n\nBien cordialement,\n${nomBailleur(x.bl)}`}) };

DOCS.modif_provision = { l:'Information : nouveau montant des charges', g:'an', ic:'🧮', envoi:'simple', d:'Prévenir le locataire d\'un changement de provision ou de forfait.',
  f:(x,p)=>{ const l=loyerA(x.bail, todayISO()); return [
    {n:'ancien', l:'Ancien montant mensuel (€)', t:'number', v:p.ancien!==undefined?p.ancien:l.charges, col:3}, {n:'nouveau', l:'Nouveau montant mensuel (€)', t:'number', v:p.nouveau!==undefined?p.nouveau:l.charges, col:3}, {n:'effet', l:'À partir du', t:'date', v:p.effet||monthFirst(nextMonthKey(monthKey(todayISO()))), col:3},
    {n:'motif', l:'Justification', t:'select', v:x.bail.chargesType==='forfait'?'irl':'budget', o:[['budget','Budget prévisionnel voté par l\'assemblée générale des copropriétaires'],['decompte','Montant des charges réelles du dernier exercice'],['hausse','Hausse d\'un poste (eau, énergie, contrat d\'entretien)'],['irl','Révision annuelle du forfait (indice de référence des loyers)']]},
    {n:'precision', l:'Précision (facultatif)', t:'text'}, envoiField('simple') ]; },
  gen:(x,d)=>{ const det=detailCharges(x.bail);
    return lettre(x,{envoi:d.envoi, objet:(x.bail.chargesType==='forfait'?'Nouveau montant du forfait de charges':'Nouveau montant de la provision pour charges'), corps:`
    <p>À compter de l'échéance du ${fdate(d.effet)}, ${x.bail.chargesType==='forfait'?'le forfait de charges':'la provision mensuelle pour charges'} passe de ${eur(d.ancien)} à <b>${eur(d.nouveau)}</b>, soit un total mensuel de <b>${eur(loyerA(x.bail,d.effet).loyerHC+num(d.nouveau))}</b> avec le loyer.</p>
    <p>Motif : ${esc({budget:'budget prévisionnel de la copropriété voté en assemblée générale',decompte:'montant des charges réelles constaté lors du dernier exercice',hausse:'augmentation d\'un poste de charges',irl:'révision annuelle du forfait selon l\'indice de référence des loyers, comme prévu au bail'}[d.motif])}${d.precision?' — '+esc(d.precision):''}.</p>
    ${det.length?`<table>${det.map(l=>`<tr><td>${esc(natureCharge(l.nature).l)}${l.libelle?' — '+esc(l.libelle):''}</td><td class="num">${eur(l.montant)}</td></tr>`).join('')}</table>`:''}
    ${x.bail.chargesType==='provision'?'<p>Il s\'agit toujours d\'une avance : elle sera comparée chaque année aux charges réelles, et l\'écart vous sera réclamé ou remboursé.</p>':''}
    ${x.bail.modePaiement&&/virement/i.test(x.bail.modePaiement)?'<p>Merci d\'ajuster votre virement permanent.</p>':''}`}); } };
