/* =====================================================================================
   ENVOI DES DOCUMENTS — impression, PDF, e-mail (partage avec pièce jointe sur téléphone,
   messagerie pré-remplie sur ordinateur), courrier simple / recommandé, remise en main
   propre. Chaque envoi est consigné dans le journal du document (preuve et suivi).
   ===================================================================================== */
let _pdfLib=null;
function loadPdfLib(){
  if(_pdfLib) return _pdfLib;
  _pdfLib = new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='js/vendor/html2pdf.bundle.min.js'; s.onload=()=>res(window.html2pdf); s.onerror=()=>{ _pdfLib=null; rej(new Error('pdf')); }; document.head.appendChild(s); });
  return _pdfLib;
}
async function renderDocHtml(doc){
  if(doc.html) return doc.html;
  const def=DOCS[doc.type]; const x=ctxBail(doc.bailId);
  if(!def || !x) return '<div class="docsheet"><p>Document introuvable.</p></div>';
  try{ return def.gen(x, doc.data||{}); }catch(e){ console.error(e); return '<div class="docsheet"><p>Ce document ne peut pas être affiché.</p></div>'; }
}
async function printHtml(html){
  const pa=document.getElementById('printArea'); pa.innerHTML=html; await hydratePhotos(pa);
  setTimeout(()=>window.print(), 150);
}
async function pdfBlob(html){
  const lib=await loadPdfLib();
  const host=document.createElement('div'); host.className='pdfhost'; host.innerHTML=html; document.body.appendChild(host);
  await hydratePhotos(host);
  try{
    return await lib().set({ margin:[12,12,14,12], image:{type:'jpeg', quality:0.85}, html2canvas:{scale:1.6, useCORS:true, backgroundColor:'#ffffff'},
      jsPDF:{unit:'mm', format:'a4', orientation:'portrait'}, pagebreak:{mode:['css','legacy'], avoid:['tr','.sigrow','.photobox','h2','h3']} }).from(host.firstElementChild).outputPdf('blob');
  } finally { host.remove(); }
}
function docFileName(doc){
  const def=DOCS[doc.type]||{l:'document'}; const x=ctxBail(doc.bailId);
  return slug(def.l)+'-'+slug(x?nomsLocataires(x.bail):'')+'-'+(doc.data&&doc.data.mois?doc.data.mois:doc.createdAt)+'.pdf';
}
function journaliserEnvoi(doc, canal, detail){
  doc.envois=doc.envois||[]; doc.envois.push({date:new Date().toISOString(), canal, detail:detail||''}); upsert('docs', doc);
}
const isMobile = ()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && /Macintosh/.test(navigator.userAgent));

/* Fenêtre « Envoyer » d'un document enregistré */
async function openEnvoi(docId){
  const doc=byId('docs', docId); if(!doc) return;
  const def=DOCS[doc.type]||{l:'Document'}; const x=ctxBail(doc.bailId); if(!x) return;
  const mailTpl = def.mail ? def.mail(x, doc.data||{}) : {o:def.l, c:`Bonjour,\n\nVous trouverez ci-joint : ${def.l.toLowerCase()}.\n\nBien cordialement,\n${nomBailleur(x.bl)}`};
  const destMail = doc.data && doc.data.destEmail || (x.locs.map(l=>l.email).filter(Boolean).join(','));
  const conseil = (doc.data&&doc.data.envoi) || def.envoi || 'mail';
  const journal = (doc.envois||[]).map(e=>`<li>${fdateCourt(e.date.slice(0,10))} — ${esc({mail:'E-mail',lrar:'Recommandé AR',simple:'Courrier simple',main:'Remis en main propre',pdf:'PDF téléchargé',print:'Imprimé',cj:'Commissaire de justice'}[e.canal]||e.canal)}${e.detail?' : '+esc(e.detail):''}</li>`).join('');
  const m=openModal({ title: def.ic+' '+def.l, wide:true, body:`
    <p class="muted">${esc(nomsLocataires(x.bail))} — ${esc(nomBien(x.bien))} · créé le ${fdate(doc.createdAt)}${doc.ref?' · réf. '+esc(doc.ref):''}</p>
    ${conseil==='lrar'?`<div class="infobox warn">Pour ce document, <b>la lettre recommandée avec accusé de réception</b> (ou la remise en main propre contre signature) est conseillée : elle prouve la date de réception. L'e-mail seul ne suffit pas en cas de litige.</div>`:''}
    <div class="sendgrid">
      <button class="sendtile" data-s="view"><span>👁️</span><b>Voir</b><small>Aperçu à l'écran</small></button>
      <button class="sendtile" data-s="print"><span>🖨️</span><b>Imprimer</b><small>ou « Enregistrer en PDF »</small></button>
      <button class="sendtile" data-s="pdf"><span>📄</span><b>PDF</b><small>Télécharger le fichier</small></button>
      <button class="sendtile" data-s="mail"><span>📧</span><b>Par e-mail</b><small>${isMobile()?'Avec le PDF en pièce jointe':'Ouvre votre messagerie'}</small></button>
      <button class="sendtile" data-s="poste"><span>📮</span><b>Par courrier</b><small>Simple ou recommandé</small></button>
      <button class="sendtile" data-s="main"><span>✋</span><b>En main propre</b><small>Contre signature</small></button>
    </div>
    <div id="sendPanel"></div>
    ${journal?`<h3 class="fsect">Historique des envois</h3><ul class="journal">${journal}</ul>`:''}`});
  const panel=m.el.querySelector('#sendPanel');
  m.el.querySelectorAll('.sendtile').forEach(b=>b.onclick=async()=>{
    const s=b.dataset.s; const html=await renderDocHtml(doc);
    if(s==='view'){ return previewDoc(html, def.l); }
    if(s==='print'){ journaliserEnvoi(doc,'print'); return printHtml(html); }
    if(s==='pdf'){ toast('Préparation du PDF…'); try{ const bl=await pdfBlob(html); downloadBlob(bl, docFileName(doc)); journaliserEnvoi(doc,'pdf'); }catch(e){ toast('PDF impossible ici : utilisez « Imprimer » puis « Enregistrer au format PDF ».', 5000); } return; }
    if(s==='mail'){
      panel.innerHTML = `<h3 class="fsect">E-mail</h3>${formHtml([
        {n:'to', l:'Destinataire(s)', t:'text', v:destMail, ph:'adresse@exemple.fr'},
        {n:'objet', l:'Objet', t:'text', v:mailTpl.o}, {n:'corps', l:'Message', t:'textarea', rows:8, v:mailTpl.c}],'ml')}
        <div class="btnrow"><button class="btn btn-teal" id="mlSend">${isMobile()?'Partager avec le PDF':'Ouvrir ma messagerie'}</button>${isMobile()?'<button class="btn btn-ghost" id="mlTxt">Sans pièce jointe</button>':''}</div>
        <p class="hint">${isMobile()?'Choisissez Gmail, Mail, Outlook… dans la liste : le PDF est joint automatiquement.':'Le PDF est téléchargé en même temps : glissez-le dans le message comme pièce jointe.'} Les quittances par e-mail nécessitent l'accord du locataire (article 21).</p>`;
      const send=async(withPdf)=>{
        const v=formValues(panel);
        let ok=false;
        if(withPdf && isMobile() && navigator.canShare){
          try{ toast('Préparation du PDF…'); const bl=await pdfBlob(html); const f=new File([bl], docFileName(doc), {type:'application/pdf'});
            if(navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:v.objet, text:v.corps}); ok=true; } }
          catch(e){ if(e&&e.name==='AbortError') return; }
        }
        if(!ok){
          if(withPdf && !isMobile()){ try{ toast('Préparation du PDF…'); const bl=await pdfBlob(html); downloadBlob(bl, docFileName(doc)); }catch(e){ toast('PDF indisponible : imprimez en PDF puis joignez-le.', 4500); } }
          location.href='mailto:'+encodeURIComponent(v.to||'')+'?subject='+encodeURIComponent(v.objet)+'&body='+encodeURIComponent(v.corps);
        }
        journaliserEnvoi(doc,'mail', v.to||''); toast('Envoi noté dans l\'historique du document.');
      };
      panel.querySelector('#mlSend').onclick=()=>send(true);
      const t=panel.querySelector('#mlTxt'); if(t) t.onclick=()=>send(false);
      return;
    }
    if(s==='poste'){
      panel.innerHTML = `<h3 class="fsect">Envoi par la Poste</h3>
        <ol class="steps"><li>Imprimez le document (bouton ci-dessous) — l'adresse est placée pour une <b>enveloppe à fenêtre</b> (format DL, 110 × 220 mm).</li>
        <li>Signez-le et gardez une copie.</li>
        <li>Recommandé avec AR : au bureau de poste, ou en ligne sans vous déplacer (<a href="https://www.laposte.fr/lettre-recommandee-en-ligne" target="_blank" rel="noopener">lettre recommandée en ligne de La Poste</a> : vous déposez le PDF, La Poste imprime et distribue).</li>
        <li>Notez le numéro de suivi ci-dessous et conservez l'accusé de réception.</li></ol>
        ${formHtml([{n:'mode', l:'Type d\'envoi', t:'select', v:conseil==='lrar'?'lrar':'simple', o:[['lrar','Recommandé avec accusé de réception'],['simple','Lettre simple']], col:2},{n:'suivi', l:'N° de suivi / recommandé', t:'text', col:2}],'po')}
        <div class="btnrow"><button class="btn btn-ghost" id="poPrint">🖨️ Imprimer</button><button class="btn btn-ghost" id="poPdf">📄 PDF pour l'envoi en ligne</button><button class="btn btn-teal" id="poSave">Noter l'envoi</button></div>`;
      panel.querySelector('#poPrint').onclick=()=>printHtml(html);
      panel.querySelector('#poPdf').onclick=async()=>{ try{ const bl=await pdfBlob(html); downloadBlob(bl, docFileName(doc)); }catch(e){ toast('PDF indisponible : utilisez Imprimer › Enregistrer en PDF.'); } };
      panel.querySelector('#poSave').onclick=()=>{ const v=formValues(panel); journaliserEnvoi(doc, v.mode, v.suivi); toast('Envoi enregistré.'); m.close(); refresh(); };
      return;
    }
    if(s==='main'){
      panel.innerHTML = `<h3 class="fsect">Remise en main propre</h3><p>Imprimez <b>deux exemplaires</b> : le destinataire signe et date le vôtre (« reçu le … »). C'est une preuve aussi valable que le recommandé pour un congé ou un état des lieux.</p>
        ${formHtml([{n:'date', l:'Date de remise', t:'date', v:todayISO()}],'mp')}<div class="btnrow"><button class="btn btn-ghost" id="mpPrint">🖨️ Imprimer</button><button class="btn btn-teal" id="mpSave">Noter la remise</button></div>`;
      panel.querySelector('#mpPrint').onclick=()=>printHtml(html);
      panel.querySelector('#mpSave').onclick=()=>{ const v=formValues(panel); journaliserEnvoi(doc,'main', 'le '+fdateCourt(v.date)); toast('Remise enregistrée.'); m.close(); refresh(); };
    }
  });
}
async function previewDoc(html, title){
  const m=openModal({title:title||'Aperçu', wide:true, body:`<div class="preview">${html}</div>`, actions:[{label:'Fermer'},{label:'🖨️ Imprimer', cls:'btn-teal', onClick:()=>{ printHtml(html); return false; }}]});
  await hydratePhotos(m.el);
}

/* =====================================================================================
   CRÉATION D'UN DOCUMENT : formulaire pré-rempli → aperçu → enregistrement → envoi
   ===================================================================================== */
function openDoc(type, bailId, preset){
  const def=DOCS[type]; const x=ctxBail(bailId); if(!def||!x) return;
  if(def.edl) return openEDL(bailId, def.edl);
  preset=preset||{};
  if(def.direct) return saveDoc(type, x, {}, true);
  const fields=(def.f? def.f(x, preset) : []).filter(f=>!f.show || f.show());
  fields.forEach(f=>{ if(preset[f.n]!==undefined && f.t!=='info') f.v=preset[f.n]; });
  const blocked = fields.length===1 && fields[0].t==='info' && fields[0].cls==='warn';
  openModal({ title:def.ic+' '+def.l, wide:true, body:`<p class="muted">${esc(nomsLocataires(x.bail))} — ${esc(nomBien(x.bien))}</p><form class="docform" onsubmit="return false">${formHtml(fields,'d')}</form>`,
    actions: blocked ? [{label:'Fermer'}] : [
      {label:'Annuler'},
      {label:'👁️ Aperçu', cls:'btn-ghost', onClick:(c,bg)=>{ const f=bg.querySelector('form'); const d=Object.assign({}, preset, formValues(f)); previewDoc(def.gen(x,d), def.l); return false; }},
      {label:'Enregistrer et envoyer', cls:'btn-teal', onClick:(c,bg)=>{ const f=bg.querySelector('form'); if(!formCheckRequired(f)) return false; const d=Object.assign({}, preset, formValues(f)); saveDoc(type, x, d); }}
    ]});
}
function saveDoc(type, x, data, openSend){
  const def=DOCS[type];
  const doc={ id:uid('doc'), type, bailId:x.bail.id, bienId:x.bien.id, ref:(type.slice(0,3)+'-'+Date.now().toString(36)).toUpperCase(), createdAt:todayISO(), data, envois:[] };
  try{ doc.html = def.gen(x, data); }catch(e){ console.error(e); toast('Erreur lors de la création du document.'); return; }
  upsert('docs', doc);
  if(def.after){ try{ def.after(x, data); }catch(e){ console.error(e); } }
  toast('Document enregistré dans le dossier du bail.');
  refresh();
  openEnvoi(doc.id);
  if(typeof proposerCopie==='function') proposerCopie();
  return doc;
}

/* =====================================================================================
   E-MAILS TYPES (sans document) — messages courants prêts à envoyer
   ===================================================================================== */
const MAILS = {
  paiement_recu:{l:'Confirmer la réception d\'un paiement', f:x=>({o:'Loyer bien reçu', c:`Bonjour,\n\nJe vous confirme la bonne réception de votre loyer. Merci !\n\nVotre quittance est disponible sur simple demande.\n\nBien cordialement,\n${nomBailleur(x.bl)}`})},
  rdv_edl:{l:'Fixer le rendez-vous d\'état des lieux', f:x=>({o:'Rendez-vous pour l\'état des lieux', c:`Bonjour,\n\nJe vous propose de réaliser l'état des lieux le [date] à [heure], au logement ${adresseBien(x.bien)}. Prévoyez environ une heure.\n\nMerci de me confirmer cette date ou de m'en proposer une autre.\n\nBien cordialement,\n${nomBailleur(x.bl)}`})},
  nouvelle_adresse:{l:'Demander la nouvelle adresse (départ)', f:x=>({o:'Votre nouvelle adresse', c:`Bonjour,\n\nAfin de vous restituer votre dépôt de garantie dans les délais légaux, pourriez-vous me communiquer votre nouvelle adresse postale ainsi que vos coordonnées bancaires (RIB) ?\n\nMerci d'avance,\n${nomBailleur(x.bl)}`})},
  releves:{l:'Demander les relevés de compteurs', f:x=>({o:'Relevés de compteurs', c:`Bonjour,\n\nPourriez-vous m'envoyer une photo des compteurs (eau, électricité${x.bien.chauffage!=='collectif'?', gaz':''}) avec la date du relevé ? C'est nécessaire pour [motif].\n\nMerci,\n${nomBailleur(x.bl)}`})},
  intervention:{l:'Annoncer une intervention (artisan, syndic)', f:x=>({o:'Intervention prévue dans le logement', c:`Bonjour,\n\nUne intervention est prévue le [date] entre [heure] et [heure] pour [nature des travaux], par [entreprise].\n\nPourriez-vous me confirmer que l'accès au logement sera possible ? Si ce créneau ne vous convient pas, proposez-m'en un autre.\n\nMerci,\n${nomBailleur(x.bl)}`})},
  entretien_chaudiere:{l:'Rappeler l\'entretien annuel de la chaudière', f:x=>({o:'Entretien annuel de la chaudière', c:`Bonjour,\n\nPetit rappel : l'entretien annuel de la chaudière est obligatoire et à la charge du locataire. Merci de me transmettre l'attestation d'entretien une fois réalisé.\n\nBien cordialement,\n${nomBailleur(x.bl)}`})},
  demande_quittance:{l:'Proposer l\'envoi des quittances par e-mail', f:x=>({o:'Envoi de vos quittances par e-mail', c:`Bonjour,\n\nAcceptez-vous de recevoir désormais vos quittances de loyer par e-mail, au format PDF ? Il vous suffit de répondre « oui » à ce message (votre accord est nécessaire, article 21 de la loi du 6 juillet 1989).\n\nBien cordialement,\n${nomBailleur(x.bl)}`})},
  difficulte:{l:'Proposer de l\'aide en cas de difficulté de paiement', f:x=>({o:'Votre situation — trouvons une solution', c:`Bonjour,\n\nJe constate un retard dans le paiement du loyer. Si vous traversez une difficulté, je préfère que nous en parlions pour trouver une solution (échéancier).\n\nVous pouvez aussi être aidé(e) par :\n- la CAF ou la MSA (aide au logement),\n- le Fonds de solidarité pour le logement (FSL) de votre département,\n- l'ADIL (conseil gratuit) : 0 805 160 075 ou www.anil.org.\n\nBien cordialement,\n${nomBailleur(x.bl)}`})}
};
function openMailType(bailId, key){
  const x=ctxBail(bailId); const m=MAILS[key]; if(!x||!m) return; const t=m.f(x);
  openModal({title:'📧 '+m.l, wide:true, body:`<form onsubmit="return false">${formHtml([{n:'to', l:'Destinataire(s)', t:'text', v:x.locs.map(l=>l.email).filter(Boolean).join(',')},{n:'objet', l:'Objet', t:'text', v:t.o},{n:'corps', l:'Message (complétez les [crochets])', t:'textarea', rows:10, v:t.c}],'mt')}</form>`,
    actions:[{label:'Annuler'},{label:'Copier le texte', onClick:(c,bg)=>{ const v=formValues(bg); navigator.clipboard&&navigator.clipboard.writeText(v.corps).then(()=>toast('Texte copié.')); return false; }},
      {label:'Ouvrir ma messagerie', cls:'btn-teal', onClick:(c,bg)=>{ const v=formValues(bg); if(/\[[^\]]+\]/.test(v.corps) && !confirm('Le message contient encore des [crochets] à compléter. Envoyer quand même ?')) return false; location.href='mailto:'+encodeURIComponent(v.to||'')+'?subject='+encodeURIComponent(v.objet)+'&body='+encodeURIComponent(v.corps); }}]});
}
