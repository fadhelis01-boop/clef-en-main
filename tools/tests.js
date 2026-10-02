// Tests automatiques des calculs (sans navigateur) :  node tools/tests.js
// Lancés par tools/build.py avant toute publication.
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.join(__dirname,'..');
const ctx={console, setTimeout, clearTimeout, window:{addEventListener(){}}, document:{addEventListener(){}}, navigator:{userAgent:'test'}, location:{protocol:'file:'}, toast(){}};
vm.createContext(ctx);
for(const f of ['regles.js','js/core.js','js/store.js','js/metier.js','js/textes.js','js/docs.js','js/envoi.js','js/charges.js','js/assistant.js','js/plus.js','js/express.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'), ctx, {filename:f});
let ok=0, ko=0;
const t=(nom, got, exp)=>{ const g=JSON.stringify(got), e=JSON.stringify(exp); if(g===e){ ok++; } else { ko++; console.log('ÉCHEC', nom, '\n  obtenu :', g, '\n  attendu:', e); } };
vm.runInContext(`
  STATE = emptyState(); save = function(){}; toast = function(){};
  todayISO = function(){ return '2026-10-02'; };
  STATE.bailleurs.push({id:'bl1', type:'physique', nom:'Durand', prenom:'Claire', adresse:'1 rue A', cp:'69003', ville:'Lyon'});
  STATE.biens.push({id:'bi1', bailleurId:'bl1', statut:'actif', adresse:'5 rue B', cp:'69004', ville:'Lyon', surface:42, pieces:2, dpe:{classe:'D'}, diagnostics:{erp:'2026-09-15', dpe:'2024-03-10'}, zoneTendue:true, encadrement:{actif:true, loyerRefMaj:16.2}, servitudeRPConnue:true, regime:'mono'});
  STATE.baux.push({id:'ba1', bienId:'bi1', bailleurId:'bl1', statut:'actif', type:'vide', dateDebut:'2025-03-10', jourPaiement:5, terme:'echoir', loyerHC:680, charges:60, chargesType:'provision', depot:680,
    irl:{trimestre:'2024-T4'}, revision:true, historiqueLoyer:[{du:'2025-03-10', loyerHC:680, charges:60}], locataires:[{nom:'Martin', prenom:'Paul'}], garants:[]});
`, ctx);
const R_=(c)=>vm.runInContext(c, ctx);
// référentiel daté
t('IRL T2 2026', R_("irlValeur('2026-T2')"), 148.37);
t('Dépôt max vide', R_("R('depotMaxVide')"), 1);
t('Décence 2026 : minimum F', R_("R('decenceDPE','2026-10-02')"), 'F');
t('Décence 2028 : minimum E', R_("R('decenceDPE','2028-01-01')"), 'E');
t('Commandement 2022 : 8 semaines', R_("R('commandementDelai','2022-01-01')"), 8);
t('Commandement 2026 : 6 semaines', R_("R('commandementDelai')"), 6);
t('Classe G interdite en 2026', R_("classeInterdite('G','2026-10-02')"), 'err');
t('Classe F autorisée en 2026', R_("classeInterdite('F','2026-10-02')"), false);
// dates
t('addMonths fin de mois', R_("addMonths('2026-01-31',1)"), '2026-02-28');
t('Prorata 1er mois (22 j / 31)', R_("echeancesBail(byId('baux','ba1'),'2025-03-31')[0].montant"), 525.16);
t('Échéance bail vide 3 ans', R_("echeanceBail(byId('baux','ba1'),'2026-10-02')"), '2028-03-09');
t('Congé bailleur : 6 mois avant', R_("dateLimiteCongeBailleur(byId('baux','ba1')).limite"), '2027-09-10');
t('Préavis locataire zone tendue', R_("preavisLocataire(byId('baux','ba1'))"), 1);
// compte locatif
R_(`upsert('paiements',{id:'p1', bailId:'ba1', date:'2026-07-05', montant:12365.16}); upsert('paiements',{id:'p2', bailId:'ba1', date:'2026-08-06', montant:300});`);
t('Solde dû', R_("compteLocatif(byId('baux','ba1')).solde"), 1180);
t('Mois impayés', R_("moisImpayes(byId('baux','ba1')).map(l=>l.key+':'+l.etat)"), ['2026-08:partiel','2026-09:impaye']);
t('Date de paiement de juillet', R_("etatMois(byId('baux','ba1'),'2026-07').payeLe"), '2026-07-05');
// révision IRL
t('Révision IRL', R_("(r=>[r.ref,r.prochainTrim,r.nouveau,r.enRetard])(revisionInfo(byId('baux','ba1')))"), ['2024-T4','2025-T4',685.36,true]);
R_(`byId('biens','bi1').dpe.classe='F';`);
t('Gel des loyers classe F', R_("revisionInfo(byId('baux','ba1')).possible"), false);
R_(`byId('biens','bi1').dpe.classe='D';`);
// contrôles de conformité
t('Encadrement dépassé', R_("controlesBail(Object.assign({},byId('baux','ba1'),{loyerHC:720}), byId('biens','bi1')).some(c=>c.lv==='err' && /Encadrement/.test(c.t))"), true);
t('Dépôt trop élevé', R_("controlesBail(Object.assign({},byId('baux','ba1'),{depot:1400}), byId('biens','bi1')).some(c=>c.lv==='err' && /Dépôt/.test(c.t))"), true);
t('Bail mobilité sans dépôt', R_("depotMax({type:'mobilite', loyerHC:600})"), 0);
t('Meublé : 2 mois', R_("depotMax({type:'meuble', loyerHC:600})"), 1200);
// dépôt de garantie : délai et pénalité
R_(`const b=byId('baux','ba1'); b.fin={remiseCles:'2026-07-01', edlConforme:true};`);
t('Restitution : 1 mois, 3 mois de retard', R_("(r=>[r.limite,r.retard,r.penalite])(restitutionInfo(byId('baux','ba1')))"), ['2026-08-01',3,204]);
delete ctx.x;
// vétusté
t('Vétusté peinture 6 ans', R_("partLocataireVetuste(1000,'peinture',6)"), 428.57);
// charges : décompte d'exercice (syndic, 1er juillet – 30 juin), quote-part, gardien 75 %, prorata de présence
R_(`byId('baux','ba1').fin=null;
  STATE.decomptes.push({id:'dc1', bienId:'bi1', du:'2024-07-01', au:'2025-06-30', quotePart:100, lignes:[
    {nature:'eau', total:400}, {nature:'gardien', total:1000}, {nature:'non_recup', total:300}, {nature:'taxes', total:200, pct:100}]});`);
t('Décompte : total et récupérable', R_("(T=>[T.total,T.recup])(decompteTotaux(byId('decomptes','dc1')))"), [1900, 1350]);
t('Présence du locataire sur l\'exercice', R_("occupationPeriode(byId('baux','ba1'),'2024-07-01','2025-06-30').jours"), 113);
t('Provisions appelées sur la période', R_("provisionsPeriode(byId('baux','ba1'),'2024-07-01','2025-06-30')"), 222.58);
t('Régularisation : part et solde', R_("(r=>[r.parts,r.solde])(regulCalc(byId('baux','ba1'), byId('decomptes','dc1')))"), [417.95, 195.37]);
t('Régularisation exigible un mois après', R_("regulCalc(byId('baux','ba1'), byId('decomptes','dc1')).exigible"), '2026-11-02');
t('Régularisation tardive (après fin 2026 ? non)', R_("regulCalc(byId('baux','ba1'), byId('decomptes','dc1')).tardive"), false);
t('Forfait interdit en vide hors colocation', R_("controlesBail(Object.assign({},byId('baux','ba1'),{chargesType:'forfait'}), byId('biens','bi1')).some(c=>c.lv==='err' && /forfait/.test(c.t))"), true);
// indices par zone, décence Outre-mer
t('Zone Corse', R_("irlZoneCp('20090')"), 'corse');
t('Zone Outre-mer', R_("irlZoneCp('97400')"), 'outremer');
t('IRL Corse T2 2026', R_("irlValeur('2026-T2','corse')"), 146.22);
t('IRL Outre-mer avant la création (repli national)', R_("irlValeur('2019-T1','outremer')"), 129.38);
t('Outre-mer : G encore autorisé en 2026', R_("classeInterdite('G','2026-10-02',{cp:'97400'})"), false);
t('Outre-mer : G interdit en 2028', R_("classeInterdite('G','2028-02-01',{cp:'97400'})"), 'err');
// étalement des hausses au renouvellement (art. 17-2 et 25-9)
t('Vide, hausse > 10 % : par sixième', R_("etalementHausse(600,690,false,3).length"), 6);
t('Vide, hausse ≤ 10 % : par tiers', R_("etalementHausse(600,640,false,3).map(e=>e.loyer)"), [613.33, 626.67, 640]);
t('Meublé, hausse ≤ 10 % : en une fois', R_("etalementHausse(600,640,true,1).length"), 1);
t('Meublé, hausse > 10 % : par tiers annuel', R_("etalementHausse(600,700,true,1).length"), 3);
// révision automatique : lettre préparée, loyer appliqué seulement à l'envoi
R_(`byId('baux','ba1').historiqueLoyer=[{du:'2025-03-10', loyerHC:680, charges:60}]; byId('baux','ba1').derniereRevision=''; byId('biens','bi1').dpe.classe='D';`);
t('Lettre de révision préparée automatiquement', R_("preparerRevisionsAuto()"), 1);
t('Loyer inchangé avant l\'envoi', R_("loyerA(byId('baux','ba1'), '2026-12-01').loyerHC"), 680);
t('Pas de 2e lettre le lendemain', R_("preparerRevisionsAuto()"), 0);
R_(`journaliserEnvoi(STATE.docs.find(d=>d.type==='revision_irl'), 'lrar', 'test');`);
t('Loyer révisé appliqué après l\'envoi', R_("loyerA(byId('baux','ba1'), '2026-12-01').loyerHC"), 685.36);
t('Révision marquée faite', R_("revisionInfo(byId('baux','ba1')).dejaFaite"), true);
// courrier rapide : documents sans logement enregistré
R_(`refresh=function(){}; go=function(){}; openEnvoi=function(){}; proposerCopie=function(){};
  window.__nb = {biens:STATE.biens.length, baux:STATE.baux.length, pays:STATE.paiements.length};
  window.__fiche = {id:'fi_t1', bailleur:{type:'physique', prenom:'Ana', nom:'Rossi', adresse:'2 quai Y', cp:'13002', ville:'Marseille'}, locataires:[{prenom:'Léo', nom:'Petit'}], garants:[{type:'personne', prenom:'Marc', nom:'Petit', adresse:'Nice'}],
    bien:{adresse:'9 rue Z', cp:'13001', ville:'Marseille', surface:30, pieces:1, dpe:{classe:'D'}}, bail:{type:'meuble', dateDebut:'2024-09-01', loyerHC:600, charges:50, chargesType:'provision', depot:1200, irlTrim:'2024-T2'}};
  upsert('fiches', window.__fiche); expressCharger(window.__fiche);`);
const XP="ctxBail('xpba_fi_t1')";
const gen=(type,d)=>R_(`(()=>{ const x=${XP}; const d=${JSON.stringify(d)}; expressAvantGen('${type}', x, d, true); if(DOCS['${type}'].prepare) DOCS['${type}'].prepare(x,d); const h=DOCS['${type}'].gen(x,d); return h.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' '); })()`);
t('Rapide : contexte reconstruit', R_(`${XP}.bail.loyerHC + '|' + ${XP}.bl.nom + '|' + ${XP}.bien.ville`), '600|Rossi|Marseille');
t('Rapide : quittance complète', /Quittance de loyer/.test(gen('quittance',{mois:'2026-09', montantRecu:'', datePaiement:'2026-09-03'})) && /650,00/.test(gen('quittance',{mois:'2026-09', montantRecu:''})), true);
t('Rapide : paiement partiel → reçu', /Reçu de paiement partiel/.test(gen('quittance',{mois:'2026-09', montantRecu:400})), true);
t('Rapide : avis avec solde antérieur', /Solde antérieur restant dû/.test(gen('avis_echeance',{mois:'2026-11', soldeAnterieur:120})), true);
t('Rapide : relance', /1 180,00|1 180,00/.test(gen('relance',{niveau:'1', montant:1180, periode:'septembre'})), true);
t('Rapide : contrat de bail meublé', /Logement meublé/.test(gen('contrat_bail',{})), true);
t('Rapide : acte de caution', /Marc Petit/.test(gen('acte_caution',{garant:0, plafond:20000, duree:'determinee', dateFin:'2027-09-01'})), true);
t('Rapide : attestation de loyer', /600,00/.test(gen('attestation',{typeAtt:'loyer_caf'})), true);
t('Rapide : révision IRL (indice du bail)', /Révision annuelle du loyer/.test(gen('revision_irl',{nouveau:610, effet:'2026-10-02', quand:'non'})), true);
R_(`upsert('decomptes', {id:'dc_x', express:true, ficheId:'fi_t1', bienId:'xpbi_fi_t1', du:'2025-01-01', au:'2025-12-31', quotePart:100, lignes:[{nature:'eau', total:365}]});`);
t('Rapide : décompte rangé dans la fiche', R_("byId('fiches','fi_t1').decomptes.length"), 1);
t('Rapide : régularisation', /Régularisation des charges/.test(gen('regularisation_charges',{decompteId:'dc_x'})), true);
t('Rapide : aucune donnée suivie modifiée', R_("JSON.stringify({biens:STATE.biens.length, baux:STATE.baux.length, pays:STATE.paiements.length})===JSON.stringify(window.__nb) && !STATE.decomptes.some(d=>d.id==='dc_x')"), true);
t('Rapide : un bail rapide ne rejoint jamais les baux suivis', R_("upsert('baux', ctxBail('xpba_fi_t1').bail); STATE.baux.some(b=>b.id==='xpba_fi_t1')"), false);
R_(`EXPRESS.baux={}; EXPRESS.biens={}; EXPRESS.bailleurs={};`);
t('Rapide : contexte restauré après redémarrage', R_(`${XP}.bail.loyerHC`), 600);
t('Rapide : le document est bien enregistré', R_(`(()=>{ const n=STATE.docs.length; saveDoc('relance', ${XP}, {niveau:'1', montant:300, periode:'sept.', envoi:'simple'}); const d=STATE.docs[STATE.docs.length-1]; return STATE.docs.length===n+1 && d.express===true && !!d.ficheSnap && d.bailId==='xpba_fi_t1'; })()`), true);
t('Rapide : plusieurs quittances d\'un coup', R_(`(()=>{ const n=STATE.docs.length; saveDoc('quittance', ${XP}, {mois:'2026-06', moisFin:'2026-08'}); return STATE.docs.length-n; })()`), 3);
R_(`confirmBox=()=>Promise.resolve(true); window.__conv=expressConvertir('fi_t1');`);
// documents : génération sans erreur
const types=Object.keys(R_('DOCS')).filter(k=>!['solde','conge'].includes(k));
let genErr=[];
R_(`byId('baux','ba1').fin=null; byId('baux','ba1').garants=[{type:'personne', nom:'Martin', prenom:'Jean', adresse:'Dijon'}];`);
for(const k of types){ try{ const html=R_(`DOCS['${k}'].gen(ctxBail('ba1'), {decompteId:'dc1', mois:'2026-07', annee:'2025', niveau:'1', montant:100, nouveau:690, effet:'2026-11-01', motif:'vente', prix:200000, remiseCles:'2026-07-01', retenues:'Peinture ; 100', typeAtt:'loyer_caf', rooms:[], dateReception:'2026-09-20', objet:'x', texte:'y', faits:'z', nature:'w', demande:'d', reponse:'accord', expose:'e', dateEffet:'2026-12-31', nb:3, debut:'2026-11-01', garant:0, plafond:20000, duree:'determinee', dateFin:'2029-03-10', items:'a\\nb'})`); if(!html || html.length<200) genErr.push(k); }catch(e){ genErr.push(k+': '+e.message); } }
t('Tous les modèles se génèrent ('+types.length+')', genErr, []);
(async()=>{
  await R_('window.__conv');
  t('Rapide : fiche devenue logement suivi', R_("(()=>{ const b=STATE.baux.find(x=>x.locataires&&x.locataires[0]&&x.locataires[0].nom==='Petit'); return !!b && STATE.docs.filter(d=>d.bailId===b.id).length>=4 && STATE.decomptes.some(d=>d.bienId===b.bienId) && !STATE.fiches.some(f=>f.id==='fi_t1'); })()"), true);
  console.log(`Tests : ${ok} réussis, ${ko} en échec.`);
  process.exit(ko?1:0);
})();
